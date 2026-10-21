# Frontend — Next.js Task Management UI

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4. Auth is
handled by Clerk (`@clerk/nextjs`); `proxy.ts` guards every route except
`/login`. Session JWTs are relayed to the Quarkus backend as Bearer tokens by
the `AuthTokenBridge` provider.

## Run in dev mode

```bash
cp .env.local.example .env.local   
npm install
npm run dev                          # http://localhost:3000
```

The backend must be running at `NEXT_PUBLIC_API_URL`
(default `http://localhost:8080/tm/api/v1`).

## Routes

| Route | Purpose |
|-------|---------|
| `/login` | Clerk sign-in (only public route) |
| `/supervisor` | Supervisor dashboard — Kanban/table, filters, metrics |
| `/supervisor/tasks/{id}` · `/supervisor/users/{id}` · `/supervisor/audit` | Detail views, user management, audit trail |
| `/employee` | Employee dashboard — assigned tasks, status updates |
| `/employee/tasks/{id}` | Task detail (comments, documents, dependencies) |
| `/account` | Profile settings (syncs name/role to the backend) |

## Tests

```bash
npm test         
npm run test:watch
```

## Build

```bash
npm run build && npm start
```

Full quick start, architecture, and API overview: see the
[root README](../README.md).
