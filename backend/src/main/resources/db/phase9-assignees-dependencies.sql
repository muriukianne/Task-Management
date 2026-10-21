-- Phase 9: Multi-assignee collaboration + task dependencies.
--
--   psql "$DATABASE_URL" -f backend/src/main/resources/db/phase9-assignees-dependencies.sql
--
-- Design:
--   • tasks.assigned_to remains the primary LEAD (backward compatible).
--   • task_assignees holds LEAD + CO_ASSIGNEE rows (LEAD mirrors assigned_to).
--   • task_dependencies: task_id cannot start (→ in_progress) until depends_on
--     reaches resolved or done.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'task_assignees'
  ) THEN
    RAISE NOTICE 'Phase 9 schema already applied — skipping';
    RETURN;
  END IF;

  CREATE TABLE task_assignees (
    id         BIGSERIAL PRIMARY KEY,
    task_id    BIGINT       NOT NULL
                 REFERENCES tasks (task_id) ON DELETE CASCADE,
    user_id    BIGINT       NOT NULL
                 REFERENCES app_users (id) ON DELETE RESTRICT,
    role       VARCHAR(20)  NOT NULL DEFAULT 'CO_ASSIGNEE'
                 CHECK (role IN ('LEAD', 'CO_ASSIGNEE')),
    created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, user_id)
  );

  CREATE INDEX idx_task_assignees_task_id ON task_assignees (task_id);
  CREATE INDEX idx_task_assignees_user_id ON task_assignees (user_id);
  CREATE INDEX idx_task_assignees_user_task ON task_assignees (user_id, task_id);

  -- Backfill: every existing task's assigned_to becomes LEAD
  INSERT INTO task_assignees (task_id, user_id, role, created_at)
  SELECT t.task_id, t.assigned_to, 'LEAD', COALESCE(t.created_at, NOW())
  FROM tasks t
  WHERE t.assigned_to IS NOT NULL
  ON CONFLICT (task_id, user_id) DO NOTHING;

  CREATE TABLE task_dependencies (
    id                  BIGSERIAL PRIMARY KEY,
    task_id             BIGINT    NOT NULL
                          REFERENCES tasks (task_id) ON DELETE CASCADE,
    depends_on_task_id  BIGINT    NOT NULL
                          REFERENCES tasks (task_id) ON DELETE CASCADE,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, depends_on_task_id),
    CHECK (task_id <> depends_on_task_id)
  );

  CREATE INDEX idx_task_deps_task_id ON task_dependencies (task_id);
  CREATE INDEX idx_task_deps_depends_on ON task_dependencies (depends_on_task_id);

  RAISE NOTICE 'Phase 9: task_assignees + task_dependencies created (with lead backfill)';
END $$;

COMMIT;
