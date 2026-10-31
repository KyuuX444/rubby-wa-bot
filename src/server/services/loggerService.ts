import { query } from '../db/pool.js';
import { realtimeHub } from './realtimeHub.js';
import type { BotLog } from '../../shared/types.js';

export async function recordBotLog(
  userId: number,
  event: string,
  message: string,
  level: 'info' | 'warn' | 'error' | 'success' = 'info'
): Promise<BotLog | null> {
  try {
    const res = await query<BotLog>(
      `INSERT INTO bot_logs (user_id, event, level, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, event, level, message, created_at`,
      [userId, event, level, message]
    );

    const logEntry = res.rows[0];
    if (logEntry) {
      realtimeHub.sendToUser(userId, 'bot.log', logEntry);
      realtimeHub.sendToOwners('owner.log', logEntry);
    }
    return logEntry;
  } catch (err) {
    console.error('Failed to record bot log:', err);
    return null;
  }
}
