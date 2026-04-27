import { getPool } from './db';
import { logger } from '../../config/logger';
export const runMigrations = async (): Promise<void> => {
    const pool = getPool();
    logger.info('Running audit-db migrations...');
    await pool.query(`
    -- Append-only audit log table
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id UUID NOT NULL UNIQUE,
      event_type VARCHAR(255) NOT NULL,
      aggregate_id VARCHAR(255) NOT NULL,
      correlation_id VARCHAR(255),
      occurred_at TIMESTAMPTZ NOT NULL,
      payload JSONB NOT NULL,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_logs(event_type);
    CREATE INDEX IF NOT EXISTS idx_audit_aggregate_id ON audit_logs(aggregate_id);
    CREATE INDEX IF NOT EXISTS idx_audit_correlation_id ON audit_logs(correlation_id);
    CREATE INDEX IF NOT EXISTS idx_audit_occurred_at ON audit_logs(occurred_at);
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
    logger.info(' audit-db migrations complete');
};
