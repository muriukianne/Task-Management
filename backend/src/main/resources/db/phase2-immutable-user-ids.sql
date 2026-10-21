-- Phase 2: Immutable internal user IDs + nullable clerk_id
-- Safe to re-run: skips when app_users already has bigint "id" PK.
--
-- Run against your local PostgreSQL before starting the backend with the new entities:
--   psql "$DATABASE_URL" -f backend/src/main/resources/db/phase2-immutable-user-ids.sql

BEGIN;

DO $$
BEGIN
  -- Already migrated?
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_users' AND column_name = 'id'
      AND data_type = 'bigint'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_users' AND column_name = 'user_id'
  ) THEN
    RAISE NOTICE 'Phase 2 schema already applied — skipping';
    RETURN;
  END IF;

  -- Fresh DB with no app_users: restore a baseline dump first (Hibernate
  -- schema strategy is `none` and will not create tables).
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'app_users'
  ) THEN
    RAISE NOTICE 'No app_users table — skipping (restore baseline schema first; Hibernate will not create it)';
    RETURN;
  END IF;

  -- ── Rebuild app_users ─────────────────────────────────────────────────────
  CREATE TABLE app_users_new (
    id          BIGSERIAL PRIMARY KEY,
    clerk_id    VARCHAR(255) UNIQUE,
    email       VARCHAR(255) NOT NULL UNIQUE,
    first_name  VARCHAR(255) NOT NULL,
    last_name   VARCHAR(255) NOT NULL,
    role        VARCHAR(50)  NOT NULL,
    created_at  TIMESTAMP
  );

  -- Preserve rows. Clerk-looking ids (user_*) become clerk_id; local UUIDs stay null.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_users' AND column_name = 'user_id'
  ) THEN
    INSERT INTO app_users_new (clerk_id, email, first_name, last_name, role, created_at)
    SELECT
      CASE
        WHEN user_id LIKE 'user_%' THEN user_id
        ELSE NULL
      END,
      email,
      first_name,
      last_name,
      role,
      created_at
    FROM app_users;
  ELSE
    -- Unexpected shape: copy what we can
    INSERT INTO app_users_new (email, first_name, last_name, role, created_at)
    SELECT email, first_name, last_name, role, created_at FROM app_users;
  END IF;

  CREATE TEMP TABLE user_id_map ON COMMIT DROP AS
  SELECT u.user_id AS old_id, n.id AS new_id
  FROM app_users u
  JOIN app_users_new n ON lower(n.email) = lower(u.email);

  -- ── Rebuild task FK columns as BIGINT ─────────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tasks'
  ) THEN
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to_new BIGINT;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_by_new BIGINT;

    UPDATE tasks t
    SET assigned_to_new = m.new_id
    FROM user_id_map m
    WHERE t.assigned_to::text = m.old_id;

    UPDATE tasks t
    SET assigned_by_new = m.new_id
    FROM user_id_map m
    WHERE t.assigned_by::text = m.old_id;

    -- Drop tasks that cannot be remapped (orphan string FKs)
    DELETE FROM tasks
    WHERE assigned_to_new IS NULL OR assigned_by_new IS NULL;

    ALTER TABLE tasks DROP COLUMN assigned_to;
    ALTER TABLE tasks DROP COLUMN assigned_by;
    ALTER TABLE tasks RENAME COLUMN assigned_to_new TO assigned_to;
    ALTER TABLE tasks RENAME COLUMN assigned_by_new TO assigned_by;
    ALTER TABLE tasks ALTER COLUMN assigned_to SET NOT NULL;
    ALTER TABLE tasks ALTER COLUMN assigned_by SET NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_task_assigned_to ON tasks (assigned_to);
    CREATE INDEX IF NOT EXISTS idx_task_assigned_status ON tasks (assigned_to, status);
  END IF;

  DROP TABLE app_users;
  ALTER TABLE app_users_new RENAME TO app_users;

  CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_clerk_id ON app_users (clerk_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_email ON app_users (email);

  RAISE NOTICE 'Phase 2 migration completed';
END $$;

COMMIT;
