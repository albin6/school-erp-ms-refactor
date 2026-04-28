import { getPool } from './db';
import { logger } from '../../config/logger';

export const runMigrations = async (): Promise<void> => {
    const pool = getPool();
    logger.info('Running academic-db migrations...');
    await pool.query(`
    CREATE TABLE IF NOT EXISTS academic_years (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      branch_id UUID,
      name VARCHAR(120) NOT NULL,
      starts_on DATE NOT NULL,
      ends_on DATE NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT chk_academic_year_dates CHECK (starts_on <= ends_on),
      CONSTRAINT chk_academic_year_status CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED'))
    );
    CREATE INDEX IF NOT EXISTS idx_academic_years_tenant_status ON academic_years(tenant_id, status);
    CREATE INDEX IF NOT EXISTS idx_academic_years_branch ON academic_years(tenant_id, branch_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_years_unique_name
      ON academic_years(tenant_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

    CREATE TABLE IF NOT EXISTS terms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      name VARCHAR(120) NOT NULL,
      starts_on DATE NOT NULL,
      ends_on DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT chk_term_dates CHECK (starts_on <= ends_on),
      UNIQUE(tenant_id, academic_year_id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_terms_year ON terms(tenant_id, academic_year_id);

    CREATE TABLE IF NOT EXISTS classes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      branch_id UUID,
      academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      name VARCHAR(120) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT chk_class_status CHECK (status IN ('ACTIVE', 'ARCHIVED')),
      UNIQUE(tenant_id, academic_year_id, branch_id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_classes_tenant_year ON classes(tenant_id, academic_year_id);
    CREATE INDEX IF NOT EXISTS idx_classes_branch ON classes(tenant_id, branch_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_unique_name
      ON classes(tenant_id, academic_year_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

    CREATE TABLE IF NOT EXISTS sections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      name VARCHAR(80) NOT NULL,
      capacity INT,
      status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT chk_section_capacity CHECK (capacity IS NULL OR capacity > 0),
      CONSTRAINT chk_section_status CHECK (status IN ('ACTIVE', 'ARCHIVED')),
      UNIQUE(tenant_id, class_id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_sections_class ON sections(tenant_id, class_id);

    CREATE TABLE IF NOT EXISTS subjects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      branch_id UUID,
      code VARCHAR(40) NOT NULL,
      name VARCHAR(160) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT chk_subject_status CHECK (status IN ('ACTIVE', 'ARCHIVED')),
      UNIQUE(tenant_id, branch_id, code),
      UNIQUE(tenant_id, branch_id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_subjects_tenant ON subjects(tenant_id, branch_id, status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_unique_code
      ON subjects(tenant_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), code);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_unique_name
      ON subjects(tenant_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

    CREATE TABLE IF NOT EXISTS class_subjects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(tenant_id, class_id, subject_id)
    );
    CREATE INDEX IF NOT EXISTS idx_class_subjects_class ON class_subjects(tenant_id, class_id);

    CREATE TABLE IF NOT EXISTS student_enrollments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      student_user_id UUID NOT NULL,
      academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      class_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
      section_id UUID NOT NULL REFERENCES sections(id) ON DELETE RESTRICT,
      roll_number VARCHAR(60),
      status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
      enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT chk_enrollment_status CHECK (status IN ('ACTIVE', 'TRANSFERRED', 'WITHDRAWN', 'PROMOTED')),
      UNIQUE(tenant_id, academic_year_id, student_user_id),
      UNIQUE(tenant_id, academic_year_id, section_id, roll_number)
    );
    CREATE INDEX IF NOT EXISTS idx_enrollments_student ON student_enrollments(tenant_id, student_user_id);
    CREATE INDEX IF NOT EXISTS idx_enrollments_class_section ON student_enrollments(tenant_id, class_id, section_id, status);

    CREATE TABLE IF NOT EXISTS class_teacher_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      teacher_user_id UUID NOT NULL,
      academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(tenant_id, academic_year_id, class_id, section_id),
      UNIQUE(tenant_id, academic_year_id, teacher_user_id, class_id, section_id)
    );
    CREATE INDEX IF NOT EXISTS idx_class_teacher_assignments_teacher ON class_teacher_assignments(tenant_id, teacher_user_id);

    CREATE TABLE IF NOT EXISTS subject_teacher_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      section_id UUID REFERENCES sections(id) ON DELETE CASCADE,
      subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      teacher_user_id UUID NOT NULL,
      academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(tenant_id, academic_year_id, class_id, section_id, subject_id, teacher_user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_subject_teacher_assignments_teacher ON subject_teacher_assignments(tenant_id, teacher_user_id);
    CREATE INDEX IF NOT EXISTS idx_subject_teacher_assignments_subject ON subject_teacher_assignments(tenant_id, subject_id);

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
    CREATE INDEX IF NOT EXISTS idx_academic_outbox_unprocessed
      ON outbox_events(processed_at) WHERE processed_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_academic_outbox_claimed
      ON outbox_events(claimed_at) WHERE processed_at IS NULL;
  `);
    logger.info(' academic-db migrations complete');
};
