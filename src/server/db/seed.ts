import argon2 from 'argon2';
import { pool, query } from './pool.js';
import { runMigrations } from './migrate.js';

export async function ensureDefaultOwner(): Promise<void> {
  await runMigrations();

  const existingOwner = await query<{ id: number; username: string }>(
    `SELECT id, username FROM users WHERE role = 'OWNER' LIMIT 1`
  );

  if (existingOwner.rows.length === 0) {
    const defaultPassword = process.env.DEFAULT_OWNER_PASSWORD || 'Owner@12345';
    const passwordHash = await argon2.hash(defaultPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    const userRes = await query<{ id: number }>(
      `INSERT INTO users (username, email, password_hash, role, status)
       VALUES ($1, $2, $3, 'OWNER', 'active')
       ON CONFLICT (username) DO UPDATE SET role = 'OWNER'
       RETURNING id`,
      ['admin', 'admin@jadibot.local', passwordHash]
    );

    const userId = userRes.rows[0].id;

    await query(
      `INSERT INTO whatsapp_sessions (user_id, connection_status, bot_status)
       VALUES ($1, 'disconnected', 'stopped')
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    await query(
      `INSERT INTO bot_settings (user_id, bot_name, prefix, auto_read, auto_typing, auto_online, public_mode, maintenance_mode)
       VALUES ($1, 'Ruby Master Bot', '/', false, true, true, true, false)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    await query(
      `INSERT INTO bot_logs (user_id, event, level, message)
       VALUES ($1, 'system', 'info', 'Initial OWNER account initialized')`,
      [userId]
    );

    console.log(`Initialized default OWNER account: username="admin", email="admin@jadibot.local", id=${userId}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  ensureDefaultOwner()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
