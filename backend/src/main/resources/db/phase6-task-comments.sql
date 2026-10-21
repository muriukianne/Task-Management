-- Phase 6: Task comments (supervisor/admin feedback + rejection notes).
--
--   psql "$DATABASE_URL" -f backend/src/main/resources/db/phase6-task-comments.sql

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'task_comments'
  ) THEN
    RAISE NOTICE 'Phase 6 schema already applied — skipping';
    RETURN;
  END IF;

  CREATE TABLE task_comments (
    id         BIGSERIAL PRIMARY KEY,
    task_id    BIGINT       NOT NULL
                 REFERENCES tasks (task_id) ON DELETE CASCADE,
    author_id  BIGINT       NOT NULL
                 REFERENCES app_users (id) ON DELETE RESTRICT,
    body       TEXT         NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW()
  );

  CREATE INDEX idx_task_comments_task_id
    ON task_comments (task_id);

  CREATE INDEX idx_task_comments_task_created
    ON task_comments (task_id, created_at DESC);

  RAISE NOTICE 'Phase 6: task_comments created';
END $$;

COMMIT;
