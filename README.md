# Task Management — Full-Stack Application

A production-style task management platform for supervisors and employees: task
assignment with multi-assignee support, approval/rejection workflows, an
optimistically-concurrent task lifecycle, task dependency graphs, comments,
file/document attachments, in-app notifications with scheduled due-date alerts,
and a complete audit trail — backed by a **Quarkus (Java 21)** REST API and a
**Next.js 16 (React 19)** frontend, running **100 % against a local PostgreSQL
database** with no third-party managed DB dependencies.

---

## Key Features

| Area | What it does |
|------|--------------|
| **Task lifecycle** | Create → assign → in-progress → review → complete, with supervisor approval and employee rejection (with reason) flows. |
| **Optimistic Concurrency Control** | Every task carries a `version` column; updates use compare-and-set so concurrent edits are detected and rejected (HTTP 409) instead of silently overwriting. |
| **Task dependency graph** | Tasks can declare blocking dependencies (`task_dependencies`); the API validates edges and prevents cycles / self-dependencies. |
| **Multi-assignee** | Tasks support many assignees (`task_assignees`) with per-assignee acceptance and rejection state. |
| **Notifications** | In-app notification center (bell + unread count) driven by assignment, status change, comment, and approval events. |
| **Due-date alerts** | A Quarkus scheduler job (`@Scheduled`, cron-configurable) scans upcoming/overdue tasks daily and fans out notifications. |
| **Audit trail** | Every mutation is recorded in `task_activity_logs` via a CDI event listener — action, actor, before/after state, timestamps. |
| **Task documents** | Upload / list / download / delete attachments per task; bytes stored on the local filesystem, metadata in `task_documents`. |
| **Comments** | Threaded task discussion (`task_comments`). |
| **Natural-language quick-add** | `POST /tasks/parse` extracts title, priority, due date, and assignees from free text (pure, unit-tested parser). |
| **Dashboard metrics** | Aggregated workload/status counts for the supervisor dashboard. |
| **Role-based access** | `supervisor` vs `employee` roles extracted from a custom JWT claim and enforced with `@RolesAllowed` at the API boundary. |

---

## Tech Stack

### Backend
- **[Quarkus 3.31](https://quarkus.io/)** on **Java 21** — reactive-capable REST API (`quarkus-rest` + Vert.x, `Uni` responses)
- **Hibernate ORM with Panache**, PostgreSQL JDBC driver
- **SmallRye JWT + Quarkus OIDC** — Bearer-token validation against Clerk's OIDC issuer
- **Hibernate Validator** for request DTO validation, plus custom business validators (status transitions, priority)
- **Quarkus Scheduler** for the due-alert cron job; **CDI events** for audit logging
- **SmallRye OpenAPI**, request-correlation logging (`requestId`/`correlationId` in MDC), security-headers and CORS filters

### Frontend
- **Next.js 16** (App Router) with **React 19** and **TypeScript**
- **Clerk** (`@clerk/nextjs`) for authentication; `proxy.ts` route guard (Next 16 middleware layer) with clock-skew tolerance
- **Tailwind CSS v4**; optimistic UI with toast feedback; role-split dashboards (`/supervisor`, `/employee`)
- An `AuthTokenBridge` provider relays Clerk session tokens to the backend as `Authorization: Bearer …`

### DevOps & Tools
- **Docker Compose** — optional local PostgreSQL 16 (host port `5433`)
- **Phased, idempotent SQL migrations** (`phase1`–`phase9` + `seed.sql`) — no runtime schema automation
- **Local RSA key pair** for fully offline JWT signing/verification in tests
- **Vitest + React Testing Library** (frontend) and **Quarkus JUnit 5 + RestAssured** (backend)

---

## Architecture

```
┌────────────────────────┐        ┌──────────────────────┐
│  Next.js 16 frontend   │        │        Clerk         │
│  (localhost:3000)      │        │  (auth / user idp)   │
│                        │        └──────────┬───────────┘
│  proxy.ts route guard  │◄──── session / JWT token issuance
│  AuthTokenBridge ──────┼───┐               │
└────────────────────────┼───┘               │ signed JWT (role claim)
                         │                   ▼
                         │  Bearer token   ┌───────────────────────────┐
                         └────────────────►  Quarkus API               │
                            REST/JSON      │  (localhost:8080)         │
                                           │  OIDC / SmallRye JWT      │
                                           │  validation + @RolesAllowed
                                           │  Controllers → Services   │
                                           │  Panache Repositories     │
                                           │  CDI audit events,        │
                                           │  scheduled due-alerts     │
                                           └────────────┬──────────────┘
                                                        ▼
                                           ┌───────────────────────────┐
                                           │  Local PostgreSQL         │
                                           │  localhost:5432           │
                                           │  taskmanagement{,_test}   │
                                           └───────────────────────────┘
```

**Auth & state flow**

1. User signs in via Clerk on the frontend; `proxy.ts` protects all non-`/login` routes.
2. `AuthTokenBridge` obtains the Clerk session JWT and attaches it to every backend call.
3. Quarkus validates the JWT signature/issuer (OIDC in dev/prod; **local RSA key pair in tests — no network**) and maps the custom `role` claim to `@RolesAllowed`.
4. A `UserProvisioningFilter` lazily syncs the authenticated identity into `app_users`, so the local DB is the single source of truth for app-side relations (assignees, comments, documents, activity).
5. Services enforce business rules (status machine, OCC version checks, dependency validation) and publish audit events; repositories persist to local PostgreSQL via Panache.

---

## Repository Layout

```
.
├── backend/                  # Quarkus REST API (Java 21)
│   ├── src/main/java/api/v1/tm/
│   │   ├── controller/       # JAX-RS endpoints (tasks, users, notifications, …)
│   │   ├── services/         # Business logic (OCC, dependencies, NL parser, …)
│   │   ├── repository/       # Panache repositories
│   │   ├── entity/           # Hibernate entities
│   │   ├── dtos/             # Request/response records
│   │   ├── validation/       # Custom business validators
│   │   ├── filter/           # CORS, security headers, correlation, user provisioning
│   │   ├── activity/         # CDI audit events + listener
│   │   ├── notification/     # Notification types
│   │   ├── scheduler/        # Due-date alert cron job
│   │   ├── security/         # Current-user resolution
│   │   └── exception/        # App exceptions + status-mapping mappers
│   ├── src/main/resources/db/  # Phased SQL migrations + seed (see db/README.md)
│   ├── src/test/             # Unit + integration tests, offline JWT tooling
│   ├── .env.example
│   └── pom.xml
├── frontend/                 # Next.js 16 app
│   ├── app/
│   │   ├── supervisor/       # Supervisor dashboard, audit trail, detail pages
│   │   ├── employee/         # Employee dashboard, task detail
│   │   ├── components/       # tasks / users / layout / ui / providers
│   │   ├── lib/              # API client, token helpers, due-date utils
│   │   └── api/clerk/        # Server routes for Clerk user sync/update
│   ├── tests/                # Vitest unit + component tests
│   ├── .env.local.example
│   └── package.json
└── docker-compose.yml        # Optional local Postgres 16 on :5433
```

---

## Quick Start

### 1. Prerequisites

- **Java 21+** (Maven wrapper is included — no local Maven needed)
- **Node.js 20+** and npm
- **PostgreSQL 14+** on `localhost:5432` — *or* Docker (use `docker-compose.yml`, Postgres on `:5433`)
- `psql` client on your PATH

### 2. Environment files

```powershell
# Windows PowerShell (from the repo root)
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.local.example frontend\.env.local
```

```bash
# macOS / Linux
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

`backend/.env` — local DB credentials and OIDC settings (see file comments):

```properties
TM_JDBC_URL=jdbc:postgresql://localhost:5432/taskmanagement
TM_JDBC_USER=tm
DATABASE_PASSWORD=tm
OIDC_AUTH_SERVER_URL=https://<your-clerk-instance>.clerk.accounts.dev
OIDC_TOKEN_ISSUER=https://<your-clerk-instance>.clerk.accounts.dev
```

`frontend/.env.local` — Clerk keys (from the Clerk dashboard) and the API base URL
(`NEXT_PUBLIC_API_URL=http://localhost:8080/tm/api/v1`).

### 3. Database initialization

Hibernate schema management is frozen at `none` — the schema is created **only**
by the ordered, idempotent phase scripts in `backend/src/main/resources/db/`:

```powershell
$env:PGPASSWORD = "postgres"
psql -U postgres -h localhost -c "CREATE USER tm WITH PASSWORD 'tm';"
psql -U postgres -h localhost -c "CREATE DATABASE taskmanagement OWNER tm;"
psql -U postgres -h localhost -d taskmanagement -c "GRANT ALL ON SCHEMA public TO tm; ALTER SCHEMA public OWNER TO tm;"

$env:PGPASSWORD = "tm"
Get-ChildItem backend/src/main/resources/db/phase*.sql | Sort-Object Name | ForEach-Object {
  psql -U tm -h localhost -d taskmanagement -f $_.FullName
}

# Optional demo data: 4 users + 4 tasks (idempotent)
psql -U tm -h localhost -d taskmanagement -f backend/src/main/resources/db/seed.sql
```

Prefer Docker instead? `docker compose up -d` starts Postgres on `:5433`;
set `TM_JDBC_URL=jdbc:postgresql://localhost:5433/taskmanagement` and run the
same scripts with `psql -p 5433`. Full details (including the **test database**)
in [`backend/src/main/resources/db/README.md`](backend/src/main/resources/db/README.md).

### 4. Run the backend

```bash
cd backend
./mvnw quarkus:dev        # Windows: .\mvnw.cmd quarkus:dev
```

API at `http://localhost:8080/tm/api/v1`, OpenAPI UI at `http://localhost:8080/q/swagger-ui`.

### 5. Run the frontend

```bash
cd frontend
npm install
npm run dev               # http://localhost:3000
```

---

## Testing

Both suites run **entirely offline** — local databases and local cryptography
only, no cloud calls, no Testcontainers/Docker required during `mvnw test`.

### Backend (33 tests: unit + integration)

```powershell
# One-time: create the isolated test database
$env:PGPASSWORD = "postgres"
psql -U postgres -h localhost -c "CREATE DATABASE taskmanagement_test OWNER tm;"
$env:PGPASSWORD = "tm"
Get-ChildItem backend/src/main/resources/db/phase*.sql | Sort-Object Name | ForEach-Object {
  psql -U tm -h localhost -d taskmanagement_test -f $_.FullName
}

# One-time: generate the local RSA key pair used to mint/verify test JWTs
openssl genrsa -out backend/src/test/resources/test-private-key.pem 2048
openssl rsa -in backend/src/test/resources/test-private-key.pem -pubout -out backend/src/test/resources/test-public-key.pem

cd backend
./mvnw test               # Windows: .\mvnw.cmd test
```

- **Unit tests** — natural-language parser, status/priority validators, pagination, token helpers: pure JVM, no DB.
- **Integration tests** (`TaskFlowTest`, RestAssured against the `%test` profile) — full user/task/notification flows on `taskmanagement_test`. The `%test` profile disables OIDC discovery and verifies `RS256` JWTs signed by `TestTokens` with the local key pair (`test-private-key.pem` is gitignored; the public key is committed).

### Frontend (29 tests: unit + component)

```bash
cd frontend
npm install
npm test                  # vitest run
npm run test:watch        # interactive mode
```

Vitest + jsdom + React Testing Library cover the API client helpers, auth token
decoding, due-date urgency logic, and shared UI components — all mocked, no
network.

---

## API Surface (summary)

Base path: `/tm/api/v1` — all endpoints require a Clerk-issued Bearer JWT.

| Group | Endpoints |
|-------|-----------|
| **Tasks** | `POST /tasks` · `GET /tasks` (filter/paged) · `GET /tasks/{id}` · `PUT /tasks/{id}/status` (OCC) · `POST /tasks/assign` · `POST /tasks/{id}/reject` · `POST /tasks/parse` (NL quick-add) |
| **Dependencies** | `POST /tasks/{id}/dependencies` · `DELETE /tasks/{id}/dependencies/{depId}` |
| **Comments** | `GET|POST /tasks/{id}/comments` |
| **Documents** | `POST /tasks/{id}/upload` · `GET|POST /tasks/{id}/documents` · `GET /tasks/{id}/documents/{docId}/download` · `DELETE /tasks/{id}/documents/{docId}` |
| **Users** | `POST /users/create` · `GET /users` · `GET /users/get-users` · `GET /users/{id}` · `PUT /users/me` · `PUT /users/{id}` · `DELETE /users/{id}` · `POST /users/sync` |
| **Notifications** | `GET /notifications` · `GET /notifications/unread-count` · `POST /notifications/{id}/read` · `POST /notifications/read-all` |
| **Activity / Dashboard** | `GET /activity` (audit trail, supervisor) · `GET /dashboard/metrics` |
| **Ops** | `POST /due-alerts/run` (manual trigger of the scheduled job) |

Responses use a uniform envelope (`ApiResponse`) with structured error codes;
concurrency conflicts return `409`, validation failures `400` with field-level
messages.

---

## Design Notes & Engineering Highlights

- **Local-DB independence.** All third-party managed-database integrations were
  removed; the datasource points exclusively at `localhost` with explicit
  `TM_JDBC_URL` / `TM_JDBC_USER` / `DATABASE_PASSWORD` variables (generic
  `DATABASE_URL` interpolation is deliberately avoided so stale cloud env vars
  cannot silently override it). Dev Services/Testcontainers are disabled.
- **Optimistic concurrency.** `tasks.version` is bumped by a conditional update;
  a zero-row update means a concurrent writer won, and the API surfaces a `409`
  so the client can refetch — no lost updates, no row locks held across requests.
- **Audit-by-events.** Mutations publish CDI events consumed by
  `TaskActivityEventListener`, keeping audit logic out of business services and
  making the trail trivially extensible.
- **Offline test security.** The `%test` OIDC bypass + local RSA key pair let
  integration tests exercise the *real* JWT validation pipeline (signature,
  issuer, role claim) with zero external dependencies.
- **Windows clock-drift tolerance.** Clerk JWTs and Windows clock skew are
  reconciled via `clockSkewInMs` in the Next.js proxy and `lifespan-grace`/
  `clock.skew` on the Quarkus side, preventing `nbf`/`exp` 401 loops in dev.
- **Idempotent phased migrations.** Each `phaseN-*.sql` checks
  `information_schema` and skips cleanly if already applied — safe to re-run,
  and the full schema can be rebuilt from scratch in order.

---

## Configuration Reference

| Variable | Where | Default | Purpose |
|----------|-------|---------|---------|
| `TM_JDBC_URL` | `backend/.env` | `jdbc:postgresql://localhost:5432/taskmanagement` | Local PostgreSQL JDBC URL |
| `TM_JDBC_USER` / `DATABASE_PASSWORD` | `backend/.env` | `tm` / `tm` | Local DB credentials |
| `OIDC_AUTH_SERVER_URL` / `OIDC_TOKEN_ISSUER` | `backend/.env` | — | Clerk issuer for JWT validation |
| `OIDC_CLIENT_ID` / `OIDC_ROLE_CLAIM_PATH` | `backend/.env` | `backend` / `role` | Client id + custom role claim |
| `CORS_ORIGINS` | `backend/.env` | `http://localhost:3000` | Allowed frontend origins |
| `DUE_ALERTS_ENABLED` / `DUE_ALERTS_CRON` / `DUE_ALERTS_SOON_DAYS` | `backend/.env` | `true` / daily 08:00 / `3` | Scheduled due-date alert behavior |
| `DB_SCHEMA_STRATEGY` | env | `none` | Keep frozen; `validate` for CI checks |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | `frontend/.env.local` | — | Clerk auth |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | — | Backend base URL |

---

## Troubleshooting

- **`401` on every request (dev):** confirm `OIDC_AUTH_SERVER_URL` matches the
  host encoded in your publishable key, and that system clock drift is within
  the configured grace (300 s).
- **Backend won't start — auth timeout:** it is trying to reach Clerk for OIDC
  discovery; check network or set the URL explicitly. Tests never do this.
- **`relation "tasks" does not exist`:** phase scripts not applied to the
  database you're pointing at — re-run section 3 of the Quick Start.
- **`mvnw test` fails with datasource error:** the `taskmanagement_test`
  database is missing — create it (see Testing above).
- **Port collisions:** frontend `:3000`, backend `:8080`, Docker Postgres
  `:5433` (native Postgres stays on `:5432`).
