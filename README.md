# BIL Agentic Knowledge Partner

BIL Hackathon 2026 prototype. A lightweight document management system (DMS) plus an AI knowledge partner that answers staff questions from approved BIL documents with exact sources, flags outdated or conflicting versions, and drafts replies in English and Dzongkha for staff to review. Everything runs locally on free, open-source components. No paid AI API is used.

The primary specification is [`CLAUDE.md`](CLAUDE.md). Choices made along the way are in [`docs/decisions.md`](docs/decisions.md); current status is in [`docs/progress.md`](docs/progress.md).

**Status: a working prototype.** DMS (upload, versions, approval, access rules), hybrid search with exact citations, the six-role agent workflow with conflict detection and abstention, English reply drafts, saved chats and a theme-colour setting all run locally and are tested. Dzongkha drafting is experimental and switched off by default. See `docs/progress.md` for what is and is not done, and `docs/evaluation.md` for measured results (16 of 18 evaluation questions pass; two known misses are listed there).

Only unclassified, public-facing documents belong in this system. No customer personal data. Fictional demo fixtures are always labelled and are never BIL policy.

## Prerequisites

- Docker (Compose v2), about 6 GB of memory available to it
- [uv](https://docs.astral.sh/uv/) and Python 3.11+ (for running the API and tests on the host)
- Node 22+ and pnpm (for running the web app and tests on the host)
- [Ollama](https://ollama.com) on the host with the models below. Hardware: the 8B chat model wants 16 GB+ of RAM; on less, set `OLLAMA_MODEL=qwen3:4b`. Answers take roughly 10 to 110 seconds on a laptop, longer when the models are cold.

```bash
ollama pull qwen3:8b      # answers
ollama pull bge-m3        # embeddings for search
```

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

## First run with real documents

Demo accounts (fictional people) are created when `SEED_DEMO=true`: `admin@demo.bil.test`, `manager@demo.bil.test`, `staff@demo.bil.test`, all with the `DEMO_PASSWORD` from `.env`. Then import the real public BIL and RMA documents (downloaded from their official sites, stored as approved versions and indexed):

```bash
cd apps/api && uv run python scripts/import_public_documents.py --password "$DEMO_PASSWORD"
```

The landing page at http://localhost:3470 explains the agents and links to the demo sign-in. Demo steps: sign in as admin, open Documents and upload a file, wait for indexing, approve it; sign in as staff, ask a question on Ask, open a citation, copy the draft reply. Staff are the final authority: nothing is sent to customers. Fictional test documents (`SEED_FIXTURES=true`) are always labelled and are never BIL policy.

Evaluation (needs the running stack and Ollama): `cd apps/api && uv run python eval/run_eval.py --password "$DEMO_PASSWORD"`.

## Putting the landing page online

Only the landing page can be hosted free; the app needs a database and local models. `cd apps/web && pnpm build:static` writes a deployable folder, and `docs/deploy.md` lists the commands for free static hosts.

## Offline and size notes

- Everything runs without internet once the documents and models are on the machine. The importer is the only step that needs internet.
- The API image is about 470 MB. The optional Dzongkha translation model needs PyTorch and adds several GB: build with `WITH_TRANSLATION=true` and set `TRANSLATION_ENABLED=true`. Its weights are non-commercial (CC-BY-NC) and its Dzongkha output has not been validated by a speaker.
- Only public, unclassified documents belong here, and no customer personal data.

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
