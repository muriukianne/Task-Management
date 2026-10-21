-- Phase 7: In-app notifications for comments, rejections, and status changes.
--
--   psql "$DATABASE_URL" -f backend/src/main/resources/db/phase7-notifications.sql

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    RAISE NOTICE 'Phase 7 schema already applied — skipping';
    RETURN;
  END IF;

  CREATE TABLE notifications (
    id            BIGSERIAL PRIMARY KEY,
    recipient_id  BIGINT       NOT NULL
                    REFERENCES app_users (id) ON DELETE CASCADE,
    actor_id      BIGINT
                    REFERENCES app_users (id) ON DELETE SET NULL,
    task_id       BIGINT
                    REFERENCES tasks (task_id) ON DELETE SET NULL,
    type          VARCHAR(50)  NOT NULL,
    title         VARCHAR(200) NOT NULL,
    body          TEXT,
    read_at       TIMESTAMP,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
  );

  CREATE INDEX idx_notifications_recipient_created
    ON notifications (recipient_id, created_at DESC);

  CREATE INDEX idx_notifications_recipient_unread
    ON notifications (recipient_id)
    WHERE read_at IS NULL;

  RAISE NOTICE 'Phase 7: notifications created';
END $$;

COMMIT;
