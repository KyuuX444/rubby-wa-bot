import { Router } from 'express';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { recordBotLog } from '../services/loggerService.js';
import {
  getUserSessionStatus,
  startUserWhatsAppSession,
  requestUserPairingCode,
  disconnectUserWhatsAppSession,
  restartUserBot,
  applyUpdatedBotSettings,
} from '../../bot/sessionManager.js';
import { BOT_COMMANDS } from '../../bot/commandHandler.js';

export const botRouter = Router();

botRouter.use(requireAuth);

const connectLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many connection requests. Please wait a moment before trying again.' },
});

const pairingSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .min(6, 'Phone number must include country code and be at least 6 digits')
    .max(20, 'Phone number is too long'),
  customCode: z
    .string()
    .trim()
    .optional(),
  forceNew: z.boolean().optional(),
});

const settingsSchema = z.object({
  bot_name: z.string().trim().min(1, 'Bot name is required').max(80, 'Bot name max 80 chars'),
  prefix: z
    .string()
    .trim()
    .min(1, 'Prefix must be at least 1 character')
    .max(5, 'Prefix cannot exceed 5 characters'),
  auto_read: z.boolean(),
  auto_typing: z.boolean(),
  auto_online: z.boolean(),
  public_mode: z.boolean(),
  maintenance_mode: z.boolean(),
  disabled_commands: z.array(z.string()).optional(),
});

botRouter.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const status = await getUserSessionStatus(userId);

    const logsRes = await query(
      `SELECT id, user_id, event, level, message, created_at
       FROM bot_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 60`,
      [userId]
    );

    res.json({
      user: req.user,
      session: {
        id: status.id,
        user_id: status.user_id,
        phone_number: status.phone_number,
        jid: status.jid,
        push_name: status.push_name,
        connection_status: status.connection_status,
        bot_status: status.bot_status,
        connection_mode: (status as any).connection_mode || 'qr',
        messages_received: status.messages_received,
        commands_executed: status.commands_executed,
        connected_at: status.connected_at,
        updated_at: status.updated_at,
        uptime_seconds: status.uptime_seconds,
        qr_data_url: status.qr_data_url,
        pairing_code: status.pairing_code,
        pairing_phone: (status as any).pairing_phone || null,
        pairing_expires_in: (status as any).pairing_expires_in || 0,
      },
      settings: status.settings,
      commands: BOT_COMMANDS,
      logs: logsRes.rows,
    });
  } catch (error) {
    console.error('Dashboard fetch error:', error);
    res.status(500).json({ error: 'Failed to load bot dashboard data.' });
  }
});

botRouter.post('/connect/qr', connectLimiter, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const forceReset = Boolean(req.body?.forceReset);
    await startUserWhatsAppSession(userId, { mode: 'qr', resetAuth: true, forceReset });

    for (let i = 0; i < 14; i++) {
      const current = await getUserSessionStatus(userId);
      if (current.qr_data_url || current.connection_status === 'connected') {
        res.json({
          status: current.connection_status,
          qrDataUrl: current.qr_data_url,
          session: current,
        });
        return;
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    const current = await getUserSessionStatus(userId);
    res.json({
      status: current.connection_status,
      qrDataUrl: current.qr_data_url,
      session: current,
    });
  } catch (error: any) {
    console.error('QR connection error:', error);
    res.status(400).json({ error: error?.message || 'Failed to initialize QR connection.' });
  }
});

botRouter.post('/connect/pairing', connectLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = pairingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const userId = req.user!.id;
    const { phoneNumber, customCode, forceNew } = parsed.data;

    const pairingResult = await requestUserPairingCode(
      userId,
      phoneNumber,
      customCode,
      Boolean(forceNew)
    );
    const current = await getUserSessionStatus(userId);

    res.json({
      code: pairingResult.code,
      phoneNumber: pairingResult.phoneNumber,
      expiresInSeconds: pairingResult.expiresInSeconds,
      session: current,
    });
  } catch (error: any) {
    console.error('Pairing code error:', error);
    const statusCode = error?.output?.statusCode || 400;
    res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 400).json({
      error: error?.message || 'Failed to request pairing code from WhatsApp server.',
    });
  }
});

botRouter.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const session = await disconnectUserWhatsAppSession(userId, true);
    res.json({
      message: 'WhatsApp session disconnected.',
      session,
    });
  } catch (error: any) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: error?.message || 'Failed to disconnect WhatsApp session.' });
  }
});

botRouter.post('/restart', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const session = await restartUserBot(userId);
    res.json({
      message: 'Bot runtime restarted successfully.',
      session,
    });
  } catch (error: any) {
    console.error('Restart bot error:', error);
    res.status(500).json({ error: error?.message || 'Failed to restart bot.' });
  }
});

botRouter.put('/settings', async (req: Request, res: Response) => {
  try {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const userId = req.user!.id;
    const data = parsed.data;
    const disabledCommands = Array.isArray(data.disabled_commands) ? data.disabled_commands : [];

    const updateRes = await query(
      `UPDATE bot_settings
       SET bot_name = $1,
           prefix = $2,
           auto_read = $3,
           auto_typing = $4,
           auto_online = $5,
           public_mode = $6,
           maintenance_mode = $7,
           disabled_commands = $8,
           updated_at = NOW()
       WHERE user_id = $9
       RETURNING *`,
      [
        data.bot_name,
        data.prefix,
        data.auto_read,
        data.auto_typing,
        data.auto_online,
        data.public_mode,
        data.maintenance_mode,
        JSON.stringify(disabledCommands),
        userId,
      ]
    );

    const updatedSettings = updateRes.rows[0];
    await applyUpdatedBotSettings(userId, updatedSettings);

    await recordBotLog(
      userId,
      'settings',
      `Updated bot settings (Name: "${data.bot_name}", Prefix: "${data.prefix}", Mode: ${data.public_mode ? 'Public' : 'Private'}, Maintenance: ${data.maintenance_mode ? 'ON' : 'OFF'})`,
      'info'
    );

    res.json({
      message: 'Bot settings saved and applied to runtime.',
      settings: updatedSettings,
    });
  } catch (error) {
    console.error('Update bot settings error:', error);
    res.status(500).json({ error: 'Failed to update bot settings.' });
  }
});

botRouter.get('/logs', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(200, Math.max(10, Number(req.query.limit) || 100));
    const logsRes = await query(
      `SELECT id, user_id, event, level, message, created_at
       FROM bot_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    res.json({ logs: logsRes.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bot logs.' });
  }
});

botRouter.delete('/logs', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    await query(`DELETE FROM bot_logs WHERE user_id = $1`, [userId]);
    await recordBotLog(userId, 'system', 'Activity logs cleared by user', 'info');
    res.json({ message: 'Logs cleared.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear logs.' });
  }
});
