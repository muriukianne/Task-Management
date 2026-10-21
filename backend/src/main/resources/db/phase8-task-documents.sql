-- Phase 8: Multiple documents per task (upload / download / delete).
--
--   psql "$DATABASE_URL" -f backend/src/main/resources/db/phase8-task-documents.sql

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'task_documents'
  ) THEN
    RAISE NOTICE 'Phase 8 schema already applied — skipping';
    RETURN;
  END IF;

  CREATE TABLE task_documents (
    id            BIGSERIAL PRIMARY KEY,
    task_id       BIGINT       NOT NULL
                    REFERENCES tasks (task_id) ON DELETE CASCADE,
    uploaded_by   BIGINT       NOT NULL
                    REFERENCES app_users (id) ON DELETE RESTRICT,
    original_name VARCHAR(255) NOT NULL,
    stored_name   VARCHAR(512) NOT NULL UNIQUE,
    content_type  VARCHAR(120),
    size_bytes    BIGINT       NOT NULL DEFAULT 0,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
  );

  CREATE INDEX idx_task_documents_task_id
    ON task_documents (task_id);

  CREATE INDEX idx_task_documents_task_created
    ON task_documents (task_id, created_at DESC);

  RAISE NOTICE 'Phase 8: task_documents created';
END $$;

COMMIT;
