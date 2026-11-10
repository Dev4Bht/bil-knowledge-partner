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

9. **Dzongkha uses NLLB-200, not the chat model.** Qwen3 8B returned looping Tibetan syllables (tested). NLLB-200 (`facebook/nllb-200-distilled-600M`) supports `dzo_Tibt` and produced coherent Dzongkha, but drifted in meaning on one sentence ("motor" became "transportation"), which the back-translation check caught. Its weights are CC-BY-NC 4.0: acceptable for a hackathon prototype, **not** for commercial use. Quality has not been validated by a Dzongkha speaker.
10. **Conflicts must be provable.** The first version trusted the model and raised a false conflict between agreeing documents. The model now has to quote the differing words from each passage and the code checks that each quote appears in its passage and that the quotes differ.
11. **Docs reference only what is built.** `/capabilities` reports real state (index counts, model availability) so the UI never claims a feature that is missing.
12. **API container size.** The `translation` extra pulls PyTorch with CUDA libraries on Linux, which made the image about 9.5 GB. Translation is parked, so the image now builds without it by default and measures 472 MB (checked 2026-11-10; the app, search, chat and evaluation questions run unchanged and Dzongkha reports as unavailable). To include it: `WITH_TRANSLATION=true docker compose --env-file .env -f infra/docker-compose.yml up -d --build api`. That build still pulls the large CUDA wheels; a CPU-only PyTorch index would shrink it and is not done.
13. **Model cache.** The compose file mounts the host Hugging Face cache so the translation weights are not downloaded twice.

## Open items

- Have a Dzongkha speaker review the draft translations and supply a terminology glossary (`docs` has no glossary yet: inventing Dzongkha terms would be unsafe).
- Decide on a commercially licensed translation model before any real deployment.
- OCR for scanned PDFs, a reranker and an OpenSearch backend are not built.
