-- Phase 1: Baseline schema for a fresh database (local or restored empty).
-- Safe to re-run: skips when app_users / tasks already exist.
--
-- This is the current shape of app_users + tasks (post phase 2 + 4), including
-- approval_requested_by. Phases 3 and 5–9 add the remaining tables.
--
--   psql "$DATABASE_URL" -f backend/src/main/resources/db/phase1-baseline.sql

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'app_users'
  ) THEN
    CREATE TABLE app_users (
      id          BIGSERIAL PRIMARY KEY,
      clerk_id    VARCHAR(255) UNIQUE,
      email       VARCHAR(255) NOT NULL UNIQUE,
      first_name  VARCHAR(255) NOT NULL,
      last_name   VARCHAR(255) NOT NULL,
      role        VARCHAR(50)  NOT NULL,
      created_at  TIMESTAMP
    );

    CREATE UNIQUE INDEX idx_app_users_clerk_id ON app_users (clerk_id);
    CREATE UNIQUE INDEX idx_app_users_email ON app_users (email);

    RAISE NOTICE 'Phase 1: app_users created';
  ELSE
    RAISE NOTICE 'Phase 1: app_users already exists — skipping';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tasks'
  ) THEN
    CREATE TABLE tasks (
      task_id                 BIGSERIAL PRIMARY KEY,
      task_title              VARCHAR(200) NOT NULL,
      task_description        TEXT         NOT NULL,
      status                  VARCHAR(20)  NOT NULL,
      priority                VARCHAR(10)  DEFAULT 'medium',
      due_date                DATE,
      assigned_to             BIGINT       NOT NULL REFERENCES app_users (id),
      assigned_by             BIGINT       NOT NULL REFERENCES app_users (id),
      attached_file           VARCHAR(255),
      version                 INTEGER      NOT NULL DEFAULT 0,
      created_at              TIMESTAMP    NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMP    NOT NULL DEFAULT NOW(),
      approval_requested_by   BIGINT       REFERENCES app_users (id)
    );

    CREATE INDEX idx_task_status            ON tasks (status);
    CREATE INDEX idx_task_assigned_to       ON tasks (assigned_to);
    CREATE INDEX idx_task_priority          ON tasks (priority);
    CREATE INDEX idx_task_due_date          ON tasks (due_date);
    CREATE INDEX idx_task_assigned_status   ON tasks (assigned_to, status);
    CREATE INDEX idx_task_status_priority   ON tasks (status, priority);

    RAISE NOTICE 'Phase 1: tasks created';
  ELSE
    -- Existing older local DBs may be missing this column.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tasks'
        AND column_name = 'approval_requested_by'
    ) THEN
      ALTER TABLE tasks
        ADD COLUMN approval_requested_by BIGINT REFERENCES app_users (id);
      RAISE NOTICE 'Phase 1: tasks.approval_requested_by added';
    ELSE
      RAISE NOTICE 'Phase 1: tasks already exists — skipping';
    END IF;
  END IF;
END $$;

COMMIT;
