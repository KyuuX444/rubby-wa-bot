import { pool } from './pool.js';

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE SEQUENCE IF NOT EXISTS users_id_seq START WITH 1001 INCREMENT BY 1;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY DEFAULT nextval('users_id_seq'),
        username VARCHAR(64) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'FREE' CHECK (role IN ('OWNER', 'FREE')),
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'banned', 'inactive')),
        github_id VARCHAR(64) UNIQUE,
        github_username VARCHAR(100),
        avatar_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS github_id VARCHAR(64) UNIQUE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS github_username VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        phone_number VARCHAR(32),
        jid VARCHAR(128),
        push_name VARCHAR(128),
        connection_status VARCHAR(32) NOT NULL DEFAULT 'disconnected' CHECK (connection_status IN ('disconnected', 'waiting', 'connecting', 'connected')),
        bot_status VARCHAR(32) NOT NULL DEFAULT 'stopped' CHECK (bot_status IN ('running', 'stopped', 'maintenance', 'error')),
        session_data JSONB NOT NULL DEFAULT '{}'::jsonb,
        messages_received BIGINT NOT NULL DEFAULT 0,
        commands_executed BIGINT NOT NULL DEFAULT 0,
        connected_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_user_id ON whatsapp_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_status ON whatsapp_sessions(connection_status);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bot_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        bot_name VARCHAR(100) NOT NULL DEFAULT 'WhatsApp Bot',
        prefix VARCHAR(10) NOT NULL DEFAULT '/',
        auto_read BOOLEAN NOT NULL DEFAULT false,
        auto_typing BOOLEAN NOT NULL DEFAULT true,
        auto_online BOOLEAN NOT NULL DEFAULT true,
        public_mode BOOLEAN NOT NULL DEFAULT true,
        maintenance_mode BOOLEAN NOT NULL DEFAULT false,
        disabled_commands JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bot_settings_user_id ON bot_settings(user_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bot_logs (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event VARCHAR(64) NOT NULL,
        level VARCHAR(16) NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error', 'success')),
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bot_logs_user_id_created ON bot_logs(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_bot_logs_created ON bot_logs(created_at DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id VARCHAR(128) PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        csrf_token VARCHAR(64) NOT NULL,
        ip_address VARCHAR(64),
        user_agent TEXT,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(128) UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "baileys_auth" (
        session TEXT NOT NULL,
        type TEXT NOT NULL,
        id TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (session, type, id)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_baileys_auth_session ON "baileys_auth"(session);
    `);

    await client.query('COMMIT');
    console.log('Database migrations completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
