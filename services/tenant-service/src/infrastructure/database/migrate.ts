import { getPool } from './db';
import { logger } from '../../config/logger';
export const runMigrations = async (): Promise<void> => {
    const pool = getPool();
    logger.info('Running tenant-db migrations...');
    await pool.query(`
    -- Create enums if they don't exist
    DO $$ BEGIN
      CREATE TYPE tenant_status_enum AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      CREATE TYPE membership_role_enum AS ENUM ('ADMIN', 'STAFF', 'STUDENT');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      CREATE TYPE membership_sub_role_enum AS ENUM ('PRINCIPAL', 'TEACHER', 'OFFICE_STAFF', 'OFFICE_ASSISTANT');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    -- Tenants Table
    CREATE TABLE IF NOT EXISTS tenants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      subdomain VARCHAR(100) UNIQUE NOT NULL,
      domain VARCHAR(255),
      status tenant_status_enum NOT NULL DEFAULT 'ACTIVE',
      settings JSONB NOT NULL DEFAULT '{}',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by UUID, -- No FK constraint: points to Identity Service DB
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);
    CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status, is_active);
    -- Branches Table
    CREATE TABLE IF NOT EXISTS branches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) NOT NULL,
      address TEXT,
      phone VARCHAR(50),
      email VARCHAR(255),
      status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(tenant_id, name),
      UNIQUE(tenant_id, slug)
    );
    CREATE INDEX IF NOT EXISTS idx_branches_tenant ON branches(tenant_id);
    -- Memberships Table
    CREATE TABLE IF NOT EXISTS memberships (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL, -- No FK constraint: points to Identity Service DB
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
      role membership_role_enum NOT NULL,
      sub_role membership_sub_role_enum,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, tenant_id)
    );
    CREATE INDEX IF NOT EXISTS idx_memberships_tenant_role ON memberships(tenant_id, role, sub_role);
    CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
    CREATE INDEX IF NOT EXISTS idx_memberships_branch ON memberships(tenant_id, branch_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_single_principal_per_branch
      ON memberships(tenant_id, branch_id)
      WHERE role = 'STAFF' AND sub_role = 'PRINCIPAL' AND branch_id IS NOT NULL;
    -- Outbox Table for Transactional Outbox Pattern
    CREATE TABLE IF NOT EXISTS outbox_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      aggregate_type VARCHAR(100) NOT NULL,
      aggregate_id UUID NOT NULL,
      event_type VARCHAR(100) NOT NULL,
      payload JSONB NOT NULL,
      claimed_at TIMESTAMPTZ,
      processed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_outbox_unprocessed ON outbox_events(processed_at) WHERE processed_at IS NULL;
    ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS idx_outbox_claimed ON outbox_events(claimed_at) WHERE processed_at IS NULL;
  `);
    logger.info(' tenant-db migrations complete');
};
