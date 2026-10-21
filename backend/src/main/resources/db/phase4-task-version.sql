-- Phase 4: Optimistic concurrency control — tasks.version
-- Safe to re-run: skips when tasks.version already exists.
--
-- Run against your local PostgreSQL:
--   psql "$DATABASE_URL" -f backend/src/main/resources/db/phase4-task-version.sql
--
-- Hibernate schema strategy is `none` — this script adds and backfills version.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'version'
  ) THEN
    RAISE NOTICE 'Phase 4 schema already applied — skipping';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tasks'
  ) THEN
    RAISE NOTICE 'No tasks table — skipping (Hibernate will create new schema)';
    RETURN;
  END IF;

  ALTER TABLE tasks
    ADD COLUMN version INTEGER NOT NULL DEFAULT 0;

  RAISE NOTICE 'Phase 4: tasks.version added';
END $$;

COMMIT;
