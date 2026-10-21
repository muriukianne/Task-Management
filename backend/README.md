# Backend — Quarkus Task Management API

Java 21 / Quarkus 3.31 REST API for the Task Management app. Runs exclusively
against a **local PostgreSQL** instance; JWTs are validated via OIDC (Clerk) in
dev/prod and via a **local RSA key pair** in tests (fully offline).

## Run in dev mode

```bash
cp .env.example .env          # then fill in local DB + OIDC values
.\mvnw.cmd quarkus:dev        # Windows   |  ./mvnw quarkus:dev
```

- API base: `http://localhost:8080/tm/api/v1`
- OpenAPI UI: `http://localhost:8080/q/swagger-ui`

The database schema must be created beforehand with the phased SQL scripts —
see [`src/main/resources/db/README.md`](src/main/resources/db/README.md).
Hibernate schema management is frozen at `none`; Dev Services are disabled.

## Tests

```bash
.\mvnw.cmd test               # 33 unit + integration tests, all offline
```

Requirements (one-time setup, documented in db/README.md):

1. Local `taskmanagement_test` database with the phase scripts applied.
2. Test RSA key pair in `src/test/resources`
   (`openssl genrsa -out test-private-key.pem 2048` + `openssl rsa -pubout`).
   The private key is gitignored; integration tests mint JWTs with it
   (`TestTokens`) while the app verifies against the committed public key.

## Packaging

```bash
.\mvnw.cmd package                 # → target/taskassesment-dev.jar (JVM mode)
docker build -f src/main/docker/Dockerfile.jvm -t tm-backend .
```

Full quick start, architecture, and API overview: see the
[root README](../README.md).
