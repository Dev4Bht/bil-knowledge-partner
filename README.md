# BIL Agentic Knowledge Partner

BIL Hackathon 2026 prototype. A lightweight document management system (DMS) plus an AI knowledge partner that answers staff questions from approved BIL documents with exact sources, flags outdated or conflicting versions, and drafts replies in English and Dzongkha for staff to review. Everything runs locally on free, open-source components. No paid AI API is used.

The primary specification is [`CLAUDE.md`](CLAUDE.md). Choices made along the way are in [`docs/decisions.md`](docs/decisions.md); current status is in [`docs/progress.md`](docs/progress.md).

**Status: Phase 1 (runnable scaffold) is complete. The DMS features, search, agents and drafting are not built yet.** See `docs/progress.md` for exactly what works.

Only unclassified, public-facing documents belong in this system. No customer personal data. Fictional demo fixtures are always labelled and are never BIL policy.

## Prerequisites

- Docker (Compose v2), about 6 GB of memory available to it
- [uv](https://docs.astral.sh/uv/) and Python 3.11+ (for running the API and tests on the host)
- Node 22+ and pnpm (for running the web app and tests on the host)
- Later phases: [Ollama](https://ollama.com) with a Qwen3 model (8B if you have 16 GB+ of RAM, otherwise 4B)

## Run everything in containers

```bash
cp .env.example .env        # then edit the passwords and JWT_SECRET
docker compose --env-file .env -f infra/docker-compose.yml up -d --build
```

| Service | URL |
|---------|-----|
| Web app | http://localhost:3470 |
| API | http://localhost:8000 (`/health`, `/ready`, interactive docs at `/docs`) |
| PostgreSQL | `localhost:5440` |

Check it works: `curl localhost:8000/ready` should report the database and document store as ready, and the web page shows the same status.

Stop with `docker compose --env-file .env -f infra/docker-compose.yml down` (add `-v` to also delete the data).

## Develop on the host

```bash
docker compose --env-file .env -f infra/docker-compose.yml up -d postgres

cd apps/api
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload          # http://localhost:8000
uv run pytest                                  # integration tests need the postgres service

cd ../web
pnpm install
pnpm dev --port 3470                           # http://localhost:3470
pnpm test && pnpm lint && pnpm build
```

## Layout

```
apps/api    FastAPI, SQLAlchemy, Alembic migrations, tests
apps/web    Next.js (App Router), TypeScript, Tailwind, nuqs, Vitest
infra       docker-compose.yml (Postgres, optional OpenSearch profile, api, web)
docs        decisions, progress, and (as built) architecture, API, data model, security
CLAUDE.md   the specification this project follows
```

## Notes

- Original documents are stored on a local volume by default (`OBJECT_STORE_BACKEND=filesystem`). An S3-compatible server can be used instead (`OBJECT_STORE_BACKEND=s3`). See `docs/decisions.md` for why no MinIO container is included.
- Search defaults to PostgreSQL full-text plus pgvector. An optional OpenSearch profile exists: add `--profile opensearch` to the compose command.
- `.env`, uploaded documents, databases, indexes and model files are git-ignored.
