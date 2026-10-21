# Database schema (manual phases)

This project runs **exclusively against a local PostgreSQL** — there are no
third-party managed database connections (Supabase / Aiven / Neon / Atlas /
Firebase / RDS have all been removed). Everything below targets `localhost`.

Hibernate schema management is frozen at **`none`**
(`quarkus.hibernate-orm.schema-management.strategy=${DB_SCHEMA_STRATEGY:none}`).

Starting the app or running tests will **not** create, alter, or drop columns.
Schema changes are applied only by running these scripts in order against the
target database.

## Local development

`quarkus:dev` reads `backend/.env` and connects to local Postgres
(`localhost:5432/taskmanagement`, user `tm`). Create that database once, then
apply the phase scripts (they are idempotent).

```powershell
# From the repo root (Windows Postgres 16; superuser password is typically "postgres")
$env:PGPASSWORD = "postgres"
psql -U postgres -h localhost -c "CREATE USER tm WITH PASSWORD 'tm';" 
psql -U postgres -h localhost -c "CREATE DATABASE taskmanagement OWNER tm;"
psql -U postgres -h localhost -d taskmanagement -c "GRANT ALL ON SCHEMA public TO tm; ALTER SCHEMA public OWNER TO tm;"

$env:PGPASSWORD = "tm"
Get-ChildItem backend/src/main/resources/db/phase*.sql | Sort-Object Name | ForEach-Object {
  psql -U tm -h localhost -d taskmanagement -f $_.FullName
}

# Optional demo content (idempotent): 4 users + 4 tasks
psql -U tm -h localhost -d taskmanagement -f backend/src/main/resources/db/seed.sql
```

Alternatively, `docker compose up -d` starts Postgres on **5433**. Point
`TM_JDBC_URL` at `jdbc:postgresql://localhost:5433/taskmanagement` and apply
the same scripts against that port (`psql -p 5433 ...`).

Copy `backend/.env.example` → `backend/.env` if you do not already have one.

## Apply (any target)

Scripts are idempotent (skip when already applied). Run from the repo root:

```bash
psql "$DATABASE_URL" -f backend/src/main/resources/db/phase1-baseline.sql
psql "$DATABASE_URL" -f backend/src/main/resources/db/phase2-immutable-user-ids.sql
psql "$DATABASE_URL" -f backend/src/main/resources/db/phase3-task-activity-logs.sql
psql "$DATABASE_URL" -f backend/src/main/resources/db/phase4-task-version.sql
psql "$DATABASE_URL" -f backend/src/main/resources/db/phase5-audit-trail.sql
psql "$DATABASE_URL" -f backend/src/main/resources/db/phase6-task-comments.sql
psql "$DATABASE_URL" -f backend/src/main/resources/db/phase7-notifications.sql
psql "$DATABASE_URL" -f backend/src/main/resources/db/phase8-task-documents.sql
psql "$DATABASE_URL" -f backend/src/main/resources/db/phase9-assignees-dependencies.sql
```

`phase1` creates `app_users` / `tasks` on a **new empty** database. Older local
databases may already have those tables; the script skips or only adds
`approval_requested_by` if missing. Do not use Hibernate `update` as the
running default.

## Test database (`mvnw test`)

The `%test` profile in `application.properties` connects to a second local
database, `taskmanagement_test`, and verifies JWTs against a **local RSA key
pair** in `src/test/resources` — `mvnw test` never opens an external network
connection. Create it once:

```powershell
$env:PGPASSWORD = "postgres"
psql -U postgres -h localhost -c "CREATE DATABASE taskmanagement_test OWNER tm;"

$env:PGPASSWORD = "tm"
Get-ChildItem backend/src/main/resources/db/phase*.sql | Sort-Object Name | ForEach-Object {
  psql -U tm -h localhost -d taskmanagement_test -f $_.FullName
}
```

Integration tests write data there; to reset, drop and recreate the database
and re-apply the phases.

## Phase map

| Script | What it adds |
|--------|----------------|
| `phase1-baseline.sql` | `app_users`, `tasks` (fresh DB) + `approval_requested_by` |
| `phase2-immutable-user-ids.sql` | `app_users.id` PK; nullable `clerk_id` |
| `phase3-task-activity-logs.sql` | `task_activity_logs` |
| `phase4-task-version.sql` | `tasks.version` (OCC) |
| `phase5-audit-trail.sql` | Nullable `task_id` on activity logs |
| `phase6-task-comments.sql` | `task_comments` |
| `phase7-notifications.sql` | `notifications` |
| `phase8-task-documents.sql` | `task_documents` |
| `phase9-assignees-dependencies.sql` | `task_assignees`, `task_dependencies` |

Optional CI check (read-only, still does not mutate):

```bash
DB_SCHEMA_STRATEGY=validate ./mvnw test
```
