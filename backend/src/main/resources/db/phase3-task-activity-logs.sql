-- Phase 3: Task activity logs (audit trail for status, comments, uploads)
-- Safe to re-run: skips when task_activity_logs already exists.
--
-- Run against your local PostgreSQL before relying on the activity feed:
--   psql "$DATABASE_URL" -f backend/src/main/resources/db/phase3-task-activity-logs.sql
--
-- Hibernate schema strategy is `none` — this script (not ORM) creates the table.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'task_activity_logs'
  ) THEN
    RAISE NOTICE 'Phase 3 schema already applied — skipping';
    RETURN;
  END IF;

  CREATE TABLE task_activity_logs (
    id           BIGSERIAL PRIMARY KEY,
    task_id      BIGINT       NOT NULL
                   REFERENCES tasks (task_id) ON DELETE CASCADE,
    actor_id     BIGINT       NOT NULL
                   REFERENCES app_users (id) ON DELETE RESTRICT,
    action_type  VARCHAR(50)  NOT NULL,
    old_value    TEXT,
    new_value    TEXT,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
  );

  CREATE INDEX idx_activity_task_id
    ON task_activity_logs (task_id);

  CREATE INDEX idx_activity_task_created
    ON task_activity_logs (task_id, created_at DESC);

  CREATE INDEX idx_activity_actor_id
    ON task_activity_logs (actor_id);

  CREATE INDEX idx_activity_action_type
    ON task_activity_logs (action_type);

  RAISE NOTICE 'Phase 3: task_activity_logs created';
END $$;

COMMIT;
