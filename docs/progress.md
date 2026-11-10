# Progress

Spec: [`CLAUDE.md`](../CLAUDE.md). Decisions and environment: [`decisions.md`](decisions.md).

## Phase 0: inspect repository and system. Done

Repository was nearly empty. Hardware, Docker and runtimes checked; results in `decisions.md`. A SQLite prototype built earlier (tasks 1 to 4 of an abandoned plan) was retired in favour of `CLAUDE.md`.

## Phase 1: runnable scaffold. In progress

Done and verified:
- `apps/api`: FastAPI app with `/health` and `/ready`, restrictive CORS, settings from the environment, full domain model (14 tables).
- Alembic migration `0001`, run up, down and up again against real PostgreSQL 16 (pgvector image).
- Object store interface with filesystem and S3 backends. Path traversal and overwrite tests.
- `apps/web`: Next.js 16, TypeScript, Tailwind, `nuqs` adapter, accessible live status panel.
- `infra/docker-compose.yml`: Postgres, optional OpenSearch profile, api and web services.
- Tests: API 20 passed (3 of them integration tests against Postgres); web 4 passed; web lint clean; web production build succeeds.

Still to verify for Phase 1: container builds for `api` and `web`, and a full boot check of API plus web together.

Blockers and deviations: see `decisions.md` (MinIO images unavailable, port 5440, Ollama not installed yet).

## Phase 2: DMS vertical slice. Not started
## Phase 3: ingestion and search. Not started
## Phase 4: agent flow. Not started
## Phase 5: bilingual drafting. Not started
## Phase 6: polish and demo. Not started
