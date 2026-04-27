import { getPool } from './db';
import { logger } from '../../config/logger';
export const runMigrations = async (): Promise<void> => {
    const pool = getPool();
    logger.info('Running notification-db migrations...');
    await pool.query(`
    -- Notification Logs table ensures idempotency.
    -- If a Kafka consumer Group re-reads a message, we don't double-send the email.
    CREATE TABLE IF NOT EXISTS notification_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id UUID NOT NULL,
      event_type VARCHAR(255) NOT NULL,
      recipient VARCHAR(255) NOT NULL,
      channel VARCHAR(50) NOT NULL DEFAULT 'EMAIL',
      status VARCHAR(50) NOT NULL,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      heartbeat_at TIMESTAMPTZ,
      UNIQUE(event_id, recipient, channel)
    );
    ALTER TABLE notification_logs
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE notification_logs
      ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS idx_notif_logs_event ON notification_logs(event_id);
    CREATE INDEX IF NOT EXISTS idx_notif_logs_recipient ON notification_logs(recipient);
    CREATE INDEX IF NOT EXISTS idx_notif_logs_heartbeat ON notification_logs(heartbeat_at);
    CREATE TABLE IF NOT EXISTS sent_notifications (
      idempotency_key VARCHAR(128) PRIMARY KEY,
      event_id UUID NOT NULL,
      event_type VARCHAR(255) NOT NULL,
      recipient VARCHAR(255) NOT NULL,
      channel VARCHAR(50) NOT NULL DEFAULT 'EMAIL',
      provider_message_id VARCHAR(255),
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sent_notifications_event_id ON sent_notifications(event_id);
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
    logger.info(' notification-db migrations complete');
};
