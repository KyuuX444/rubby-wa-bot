import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { realtimeHub } from '../services/realtimeHub.js';
import { recordBotLog } from '../services/loggerService.js';
import {
  getUserSessionStatus,
  disconnectUserWhatsAppSession,
  restartUserBot,
  cleanupUserSocket,
} from '../../bot/sessionManager.js';
import type { OwnerGlobalStats, OwnerBotMonitorItem, UserRole, UserStatus } from '../../shared/types.js';

export const ownerRouter = Router();

ownerRouter.use(requireAuth, requireRole('OWNER'));

const updateRoleSchema = z.object({
  role: z.enum(['OWNER', 'FREE']),
});

const updateStatusSchema = z.object({
  status: z.enum(['active', 'banned', 'inactive']),
});

ownerRouter.get('/overview', async (req: Request, res: Response) => {
  try {
    const statsRes = await query<OwnerGlobalStats>(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS total_users,
        (SELECT COUNT(*)::int FROM users WHERE status = 'active') AS active_users,
        (SELECT COUNT(*)::int FROM users WHERE status = 'banned') AS banned_users,
        (SELECT COUNT(*)::int FROM users WHERE role = 'OWNER') AS owner_users,
        (SELECT COUNT(*)::int FROM users WHERE role = 'FREE') AS free_users,
        (SELECT COUNT(*)::int FROM whatsapp_sessions WHERE connection_status = 'connected') AS connected_whatsapp,
        (SELECT COUNT(*)::int FROM whatsapp_sessions WHERE bot_status = 'running') AS active_bots,
        (SELECT COUNT(*)::int FROM whatsapp_sessions WHERE connection_status != 'connected') AS disconnected_bots,
        (SELECT COALESCE(SUM(messages_received), 0)::bigint FROM whatsapp_sessions) AS total_messages,
        (SELECT COALESCE(SUM(commands_executed), 0)::bigint FROM whatsapp_sessions) AS total_commands
    `);

    const botsRes = await query<OwnerBotMonitorItem>(`
      SELECT
        u.id AS user_id,
        u.username,
        u.email,
        u.role,
        u.status AS user_status,
        ws.phone_number,
        ws.push_name,
        COALESCE(ws.connection_status, 'disconnected') AS connection_status,
        COALESCE(ws.bot_status, 'stopped') AS bot_status,
        COALESCE(bs.bot_name, 'WhatsApp Bot') AS bot_name,
        COALESCE(bs.prefix, '/') AS prefix,
        COALESCE(bs.public_mode, true) AS public_mode,
        COALESCE(bs.maintenance_mode, false) AS maintenance_mode,
        COALESCE(ws.messages_received, 0)::bigint AS messages_received,
        COALESCE(ws.commands_executed, 0)::bigint AS commands_executed,
        ws.connected_at,
        CASE
          WHEN ws.connection_status = 'connected' AND ws.connected_at IS NOT NULL
          THEN GREATEST(0, EXTRACT(EPOCH FROM (NOW() - ws.connected_at))::int)
          ELSE 0
        END AS uptime_seconds
      FROM users u
      LEFT JOIN whatsapp_sessions ws ON ws.user_id = u.id
      LEFT JOIN bot_settings bs ON bs.user_id = u.id
      ORDER BY u.id ASC
    `);

    const enrichedBots = await Promise.all(
      botsRes.rows.map(async (item) => {
        const live = await getUserSessionStatus(item.user_id);
        return {
          ...item,
          phone_number: live.phone_number,
          push_name: live.push_name,
          connection_status: live.connection_status,
          bot_status: live.bot_status,
          messages_received: Number(live.messages_received || 0),
          commands_executed: Number(live.commands_executed || 0),
          connected_at: live.connected_at,
          uptime_seconds: live.uptime_seconds,
        };
      })
    );

    const logsRes = await query(`
      SELECT
        l.id,
        l.user_id,
        u.username,
        l.event,
        l.level,
        l.message,
        l.created_at
      FROM bot_logs l
      JOIN users u ON u.id = l.user_id
      ORDER BY l.created_at DESC
      LIMIT 100
    `);

    const rawStats = statsRes.rows[0];
    const connectedCount = enrichedBots.filter((b) => b.connection_status === 'connected').length;
    const activeBotCount = enrichedBots.filter((b) => b.bot_status === 'running').length;
    const disconnectedCount = enrichedBots.length - connectedCount;

    res.json({
      stats: {
        ...rawStats,
        connected_whatsapp: connectedCount,
        active_bots: activeBotCount,
        disconnected_bots: disconnectedCount,
        total_messages: Number(rawStats.total_messages || 0),
        total_commands: Number(rawStats.total_commands || 0),
      },
      bots: enrichedBots,
      logs: logsRes.rows,
    });
  } catch (error) {
    console.error('Owner overview error:', error);
    res.status(500).json({ error: 'Failed to load owner panel data.' });
  }
});

ownerRouter.get('/users', async (req: Request, res: Response) => {
  try {
    const search = String(req.query.q || '').trim();
    const roleFilter = String(req.query.role || '').trim();
    const statusFilter = String(req.query.status || '').trim();

    const conditions: string[] = [];
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      if (/^\d+$/.test(search)) {
        params.push(Number(search));
        conditions.push(
          `(u.username ILIKE $${idx} OR u.email ILIKE $${idx} OR u.id = $${params.length})`
        );
      } else {
        conditions.push(`(u.username ILIKE $${idx} OR u.email ILIKE $${idx})`);
      }
    }

    if (roleFilter === 'OWNER' || roleFilter === 'FREE') {
      params.push(roleFilter);
      conditions.push(`u.role = $${params.length}`);
    }

    if (statusFilter === 'active' || statusFilter === 'banned' || statusFilter === 'inactive') {
      params.push(statusFilter);
      conditions.push(`u.status = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const usersRes = await query(
      `SELECT
         u.id,
         u.username,
         u.email,
         u.role,
         u.status,
         u.created_at,
         u.updated_at,
         ws.phone_number,
         COALESCE(ws.connection_status, 'disconnected') AS connection_status,
         COALESCE(ws.bot_status, 'stopped') AS bot_status,
         COALESCE(ws.messages_received, 0)::int AS messages_received,
         COALESCE(ws.commands_executed, 0)::int AS commands_executed
       FROM users u
       LEFT JOIN whatsapp_sessions ws ON ws.user_id = u.id
       ${whereClause}
       ORDER BY u.id ASC`,
      params
    );

    res.json({ users: usersRes.rows });
  } catch (error) {
    console.error('Owner search users error:', error);
    res.status(500).json({ error: 'Failed to search users.' });
  }
});

ownerRouter.patch('/users/:id/role', async (req: Request, res: Response) => {
  try {
    const targetUserId = Number(req.params.id);
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid role value. Must be OWNER or FREE.' });
      return;
    }

    const newRole: UserRole = parsed.data.role;

    if (newRole === 'FREE') {
      const ownersRes = await query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM users WHERE role = 'OWNER' AND status = 'active' AND id != $1`,
        [targetUserId]
      );
      if (ownersRes.rows[0].count === 0) {
        res.status(400).json({
          error: 'Cannot demote the only remaining active OWNER account.',
        });
        return;
      }
    }

    const updateRes = await query(
      `UPDATE users
       SET role = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, username, email, role, status, created_at, updated_at`,
      [newRole, targetUserId]
    );

    if (updateRes.rows.length === 0) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const updatedUser = updateRes.rows[0];

    realtimeHub.updateUserRole(targetUserId, newRole);

    await recordBotLog(
      targetUserId,
      'auth',
      `Account role changed to ${newRole} by Owner (${req.user!.username}). Bot permissions automatically synchronized to ${newRole} without reconnecting.`,
      'info'
    );

    res.json({
      message: `User ${updatedUser.username} role updated to ${newRole}. Bot permissions updated in real time.`,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Owner update role error:', error);
    res.status(500).json({ error: 'Failed to update user role.' });
  }
});

ownerRouter.patch('/users/:id/status', async (req: Request, res: Response) => {
  try {
    const targetUserId = Number(req.params.id);
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    if (targetUserId === req.user!.id) {
      res.status(400).json({ error: 'You cannot ban or deactivate your own OWNER account.' });
      return;
    }

    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid status value.' });
      return;
    }

    const newStatus: UserStatus = parsed.data.status;

    const updateRes = await query(
      `UPDATE users
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, username, email, role, status, created_at, updated_at`,
      [newStatus, targetUserId]
    );

    if (updateRes.rows.length === 0) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const updatedUser = updateRes.rows[0];

    if (newStatus !== 'active') {
      await query(`DELETE FROM user_sessions WHERE user_id = $1`, [targetUserId]);
      realtimeHub.disconnectUser(targetUserId, `Account ${newStatus} by administrator.`);
      await disconnectUserWhatsAppSession(targetUserId, false);
    }

    await recordBotLog(
      targetUserId,
      'auth',
      `Account status changed to ${newStatus.toUpperCase()} by Owner (${req.user!.username}).`,
      newStatus === 'active' ? 'success' : 'warn'
    );

    res.json({
      message: `User ${updatedUser.username} status updated to ${newStatus}.`,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Owner update status error:', error);
    res.status(500).json({ error: 'Failed to update user status.' });
  }
});

ownerRouter.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    const targetUserId = Number(req.params.id);
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    if (targetUserId === req.user!.id) {
      res.status(400).json({ error: 'You cannot delete your own OWNER account.' });
      return;
    }

    realtimeHub.disconnectUser(targetUserId, 'Account deleted by administrator.');
    await cleanupUserSocket(targetUserId, true);

    const delRes = await query(`DELETE FROM users WHERE id = $1 RETURNING id, username`, [
      targetUserId,
    ]);

    if (delRes.rows.length === 0) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.json({
      message: `Account "${delRes.rows[0].username}" (ID: ${targetUserId}) and its bot session have been deleted.`,
    });
  } catch (error) {
    console.error('Owner delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user account.' });
  }
});

ownerRouter.post('/bots/:userId/restart', async (req: Request, res: Response) => {
  try {
    const targetUserId = Number(req.params.userId);
    const session = await restartUserBot(targetUserId);
    await recordBotLog(
      targetUserId,
      'system',
      `Bot restarted by platform Owner (${req.user!.username})`,
      'info'
    );
    res.json({ message: `Restarted bot for user ID ${targetUserId}.`, session });
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to restart user bot.' });
  }
});

ownerRouter.post('/bots/:userId/disconnect', async (req: Request, res: Response) => {
  try {
    const targetUserId = Number(req.params.userId);
    const session = await disconnectUserWhatsAppSession(targetUserId, true);
    await recordBotLog(
      targetUserId,
      'connection',
      `WhatsApp session disconnected by platform Owner (${req.user!.username})`,
      'warn'
    );
    res.json({ message: `Disconnected WhatsApp for user ID ${targetUserId}.`, session });
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to disconnect user bot.' });
  }
});
