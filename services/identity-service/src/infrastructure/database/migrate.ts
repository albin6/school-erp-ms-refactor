import { getPool } from './db';
import { logger } from '../../config/logger';
export const runMigrations = async (): Promise<void> => {
    const pool = getPool();
    logger.info('Running identity-db migrations...');
    await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
      failed_login_attempts INT NOT NULL DEFAULT 0,
      lockout_until TIMESTAMPTZ,
      last_login_at TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      must_reset_password BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(512) NOT NULL,
      family_id UUID NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      created_ip INET,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_rt_token_hash ON refresh_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_rt_family_id ON refresh_tokens(family_id);
    CREATE INDEX IF NOT EXISTS idx_rt_user_id ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_rt_expires_at ON refresh_tokens(expires_at) WHERE revoked_at IS NULL;
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL,
      otp_hash VARCHAR(512) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      attempts INT NOT NULL DEFAULT 0,
      max_attempts INT NOT NULL DEFAULT 5,
      ip_address INET,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_prt_email_active
      ON password_reset_tokens(email, used_at, expires_at);
    CREATE TABLE IF NOT EXISTS outbox_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      aggregate_type VARCHAR(100) NOT NULL,
      aggregate_id UUID NOT NULL,
      event_type VARCHAR(100) NOT NULL,
      event_version INT NOT NULL DEFAULT 1,
      correlation_id VARCHAR(255),
      causation_id VARCHAR(255),
      payload JSONB NOT NULL,
      claimed_at TIMESTAMPTZ,
      processed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
    ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS event_version INT NOT NULL DEFAULT 1;
    ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(255);
    ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS causation_id VARCHAR(255);
    CREATE INDEX IF NOT EXISTS idx_identity_outbox_unprocessed
      ON outbox_events(processed_at) WHERE processed_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_identity_outbox_claimed
      ON outbox_events(claimed_at) WHERE processed_at IS NULL;
    CREATE TABLE IF NOT EXISTS processed_events (
      event_id UUID PRIMARY KEY,
      event_type VARCHAR(255) NOT NULL,
      processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS failed_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id UUID,
      event_type VARCHAR(255),
      topic VARCHAR(255) NOT NULL,
      payload JSONB NOT NULL,
      error_message TEXT NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
    logger.info(' identity-db migrations complete');
};
