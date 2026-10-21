-- Phase 5: Broaden task_activity_logs into a global audit trail.
-- Allows system/user actions without a task_id (nullable FK).
--
--   psql "$DATABASE_URL" -f backend/src/main/resources/db/phase5-audit-trail.sql

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'task_activity_logs'
      AND column_name = 'task_id'
      AND is_nullable = 'YES'
  ) THEN
    RAISE NOTICE 'Phase 5 schema already applied — skipping';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'task_activity_logs'
  ) THEN
    RAISE NOTICE 'task_activity_logs missing — run phase3 first';
    RETURN;
  END IF;

  -- Drop FK so we can relax NOT NULL, then re-add as nullable
  ALTER TABLE task_activity_logs
    DROP CONSTRAINT IF EXISTS task_activity_logs_task_id_fkey;

  ALTER TABLE task_activity_logs
    ALTER COLUMN task_id DROP NOT NULL;

  ALTER TABLE task_activity_logs
    ADD CONSTRAINT task_activity_logs_task_id_fkey
      FOREIGN KEY (task_id) REFERENCES tasks (task_id) ON DELETE SET NULL;

  CREATE INDEX IF NOT EXISTS idx_activity_created
    ON task_activity_logs (created_at DESC);

  RAISE NOTICE 'Phase 5: audit trail task_id nullable + created_at index';
END $$;

COMMIT;
