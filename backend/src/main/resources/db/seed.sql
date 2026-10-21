BEGIN;

INSERT INTO app_users (clerk_id, email, first_name, last_name, role, created_at)
SELECT v.clerk_id, v.email, v.first_name, v.last_name, v.role, NOW()
FROM (VALUES
  (NULL, 'admin@local.dev',    'Ada',  'Admin',        'admin'),
  (NULL, 'supervisor@local.dev','Sam', 'Supervisor',   'supervisor'),
  (NULL, 'emp1@local.dev',     'Emi',  'Employee',     'employee'),
  (NULL, 'emp2@local.dev',     'Omar', 'Reyes',        'employee')
) AS v(clerk_id, email, first_name, last_name, role)
WHERE NOT EXISTS (SELECT 1 FROM app_users u WHERE u.email = v.email);

-- ── Tasks (only when the tasks table is empty) ───────────────────────────────
DO $$
DECLARE
  admin_id  BIGINT;
  super_id  BIGINT;
  emp1_id   BIGINT;
  emp2_id   BIGINT;
BEGIN
  IF (SELECT COUNT(*) FROM tasks) > 0 THEN
    RAISE NOTICE 'Seed: tasks already present — skipping';
    RETURN;
  END IF;

  SELECT id INTO admin_id  FROM app_users WHERE email = 'admin@local.dev';
  SELECT id INTO super_id  FROM app_users WHERE email = 'supervisor@local.dev';
  SELECT id INTO emp1_id   FROM app_users WHERE email = 'emp1@local.dev';
  SELECT id INTO emp2_id   FROM app_users WHERE email = 'emp2@local.dev';

  INSERT INTO tasks (task_title, task_description, status, priority, due_date,
                     assigned_to, assigned_by, version, created_at, updated_at)
  VALUES
    ('Set up local PostgreSQL',
     'Create taskmanagement / taskmanagement_test databases and apply phase scripts.',
     'done', 'high', CURRENT_DATE - 2, emp1_id, super_id, 0, NOW(), NOW()),
    ('Seed demo dashboard data',
     'Populate a few sample tasks in various statuses so the kanban has content.',
     'in_progress', 'medium', CURRENT_DATE + 2, emp1_id, super_id, 0, NOW(), NOW()),
    ('Review dependency cycle detection',
     'Manual QA of blocked-task behaviour across the assignee and lead flows.',
     'assigned', 'critical', CURRENT_DATE + 1, emp2_id, admin_id, 0, NOW(), NOW()),
    ('Write onboarding guide',
     'Document how a new team member is invited and links their account on first login.',
     'pending_approval', 'low', CURRENT_DATE + 7, emp2_id, super_id, 0, NOW(), NOW());

  -- Mirror leads into task_assignees (LEAD rows the API expects)
  INSERT INTO task_assignees (task_id, user_id, role, created_at)
  SELECT t.task_id, t.assigned_to, 'LEAD', NOW()
  FROM tasks t
  WHERE NOT EXISTS (
    SELECT 1 FROM task_assignees a WHERE a.task_id = t.task_id AND a.user_id = t.assigned_to
  );
END $$;

COMMIT;
