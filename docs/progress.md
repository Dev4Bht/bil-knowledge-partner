# Progress

Spec: [`CLAUDE.md`](../CLAUDE.md). Decisions and environment: [`decisions.md`](decisions.md).

## Phase 0: inspect repository and system. Done

Repository was nearly empty. Hardware, Docker and runtimes checked; results in `decisions.md`. A SQLite prototype built earlier (tasks 1 to 4 of an abandoned plan) was retired in favour of `CLAUDE.md`.

## Phase 1: runnable scaffold. Done

Done and verified:
- `apps/api`: FastAPI app with `/health` and `/ready`, restrictive CORS, settings from the environment, full domain model (14 tables).
- Alembic migration `0001`, run up, down and up again against real PostgreSQL 16 (pgvector image).
- Object store interface with filesystem and S3 backends. Path traversal and overwrite tests.
- `apps/web`: Next.js 16, TypeScript, Tailwind, `nuqs` adapter, accessible live status panel.
- `infra/docker-compose.yml`: Postgres, optional OpenSearch profile, api and web services.
- Tests: API 20 passed (3 of them integration tests against Postgres); web 4 passed; web lint clean; web production build succeeds.

Verified on 2026-11-10 by actually running it:
- `docker compose up -d --build` builds and starts `postgres`, `api` and `web`.
- `GET /health` returns `{"status":"ok"}`; `GET /ready` reports database ready and document store ready (filesystem).
- The web page is served at `http://localhost:3470`; a CORS preflight from that origin is allowed by the API.
- API: 20 tests pass (3 integration tests against Postgres). Web: 4 tests pass, lint clean, production build succeeds.

Not yet verified: the web status panel in a real browser (checked by component tests and by the HTML being served, not by a browser session).

Blockers and deviations: see `decisions.md` (MinIO images unavailable, port 5440, Ollama not installed yet).

## Phase 2: DMS vertical slice. Design written, build not started

Full design for the DMS backend and the web app: [`webapp-design.md`](webapp-design.md). Auth dependencies (argon2, PyJWT) and ORM relationships are added; no endpoints yet.
## Phase 3: ingestion and search. Not started
## Phase 4: agent flow. Not started
## Phase 5: bilingual drafting. Not started
## Phase 6: polish and demo. Not started
