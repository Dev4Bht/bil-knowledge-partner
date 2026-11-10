# Decisions

Primary specification: [`CLAUDE.md`](../CLAUDE.md). This file records where reality forced a choice and why.

## Environment found (Phase 0, 2026-11-10)

| Item | Finding |
|------|---------|
| Machine | Apple M5 Pro, 24 GB RAM, about 457 GB free disk |
| Docker | Running, but Docker Desktop is limited to about 8 GB RAM and 15 CPUs |
| Ollama | **Not installed** (needed from Phase 4) |
| Python | 3.12 and 3.13 available through `uv`; the API supports 3.11+ |
| Node | 24 with pnpm 10 |
| Ports in use by other projects | 5432, 5433, 5434 (Postgres), 6380, 9090, 9091, 4222, 8222 |

## Decisions

1. **`CLAUDE.md` overrides the earlier design.** The first design (Claude API, SQLite, plain HTML) was approved before `CLAUDE.md` was supplied. `CLAUDE.md` requires local open-source models only, so no cloud AI API is used anywhere. The SQLite prototype was removed; it remains in git history at `3760fd0`.
2. **Search backend: PostgreSQL full-text plus pgvector first, OpenSearch optional.** Docker has about 8 GB, shared with Postgres, the API, the web app and the embedding model's memory use on the host. `CLAUDE.md` allows this fallback. A `SearchBackend` interface keeps the choice swappable, and an `opensearch` compose profile exists for machines that can afford it. Only one backend is active at a time.
3. **Object store: local filesystem by default, S3-compatible optional.** The compose file originally used MinIO. `minio/minio` is no longer pulled from Docker Hub and `quay.io/minio/minio` returned 401 (tested 2026-11-10), so no verified official MinIO image was available. I did not substitute an unverified third-party image for the document store. `CLAUDE.md` permits a filesystem adapter. `ObjectStore` has a write-once `LocalFileStore` and an `S3ObjectStore` that works with any S3 server. Originals are never overwritten with different bytes.
4. **Host ports: Postgres 5440, web 3470, API 8000.** The usual ports are taken by other local projects, and I did not touch those. Configurable with `POSTGRES_HOST_PORT` and `WEB_HOST_PORT`. Lesson learned: other dev servers (Next.js on 3000 and 3100) listen on IPv6 `*`, while Docker publishes on IPv4 `127.0.0.1`. A browser resolving `localhost` to IPv6 first reaches the wrong app, so ports must be free on both stacks, not merely unbound on IPv4.
5. **`pgvector/pgvector:pg16` image.** Official pgvector project image, pulled successfully. The vector column and extension are added with the search backend in Phase 3, not before they are needed.
6. **One approved current version per document is enforced by the database,** with a partial unique index, not only by application code. Verified by an integration test against real Postgres.
7. **Next.js 16 with Cache Components.** The installed version differs from older conventions, so I read the bundled docs. The shell stays static; live data is fetched client-side, and request-time reads must sit behind `<Suspense>`. Google-hosted fonts were removed so builds work offline; a system font stack with Tibetan-script fallbacks covers Dzongkha.
8. **Secrets.** `.env` is git-ignored; `.env.example` holds placeholders only; the API refuses the development JWT secret when `APP_ENV=production`.

## Open items

- Install Ollama and pull a Qwen3 model before Phase 4 (8B if memory allows, otherwise 4B).
- Choose and verify an English to Dzongkha translation model and its licence before Phase 5.
- BGE-M3 needs a download of roughly 2 GB before Phase 3.
