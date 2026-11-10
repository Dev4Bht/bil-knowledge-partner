# Progress

Spec: [`CLAUDE.md`](../CLAUDE.md). Decisions: [`decisions.md`](decisions.md). Web app design: [`webapp-design.md`](webapp-design.md).

Last updated 2026-11-10. Everything below was run, not assumed. Test counts are from this machine.

## Phase 0: inspect repository and system. Done
Findings are in `decisions.md`.

## Phase 1: runnable scaffold. Done
FastAPI, Alembic, Next.js 16, Docker Compose (Postgres with pgvector, API, web). Verified by booting the stack.

## Phase 2: DMS vertical slice. Done (backend); web UI in progress
- Auth: Argon2, httpOnly cookie session, CSRF header, login rate limit.
- Roles admin, manager, staff; folder scope; document classification; drafts hidden from staff; denied reads answered as 404 and audited.
- Upload validation (type, signature, size, sanitised name, CID screen), write-once storage, atomic approval, archive, text diff, audit log.
- Fictional demo fixtures flagged `is_demo_fixture`, seeded outside production only.
- Tests: access and cross-role leakage, approval including concurrent approvals, upload safety, seed behaviour per role.

## Phase 3: ingestion and search. Done
- Text, PDF and DOCX extraction with sections, headings, page numbers and offsets. Scanned PDFs are reported, not silently skipped (OCR is **not** implemented).
- Background worker (database job queue, retries, stale-job recovery, startup backfill). Re-indexing is idempotent.
- BGE-M3 embeddings through Ollama; PostgreSQL full-text plus pgvector; reciprocal rank fusion; query synonyms; keyword-only fallback when embeddings are down.
- Access rules applied inside retrieval; drafts never searchable. Real-model test: a "natural calamity" question finds the "flood damage" section.
- **Not done:** OpenSearch backend, reranker.

## Phase 4: agent flow. Done
LangGraph workflow with the six roles, a checkpointer and a bounded retry. Code-verified conflicts, citation/permission/figure checks, abstention, model-unavailable mode that still returns sources. Real-model run of the brief's flood question: `answered`, correct citation, superseded version flagged. See `architecture.md`.

## Phase 5: bilingual drafting. Done, experimental
English draft plus a Dzongkha draft from NLLB-200 (Qwen3 8B produced looping syllables and is not used for Dzongkha). Drafts are checked for script, repetition, figures and back-translation drift and always labelled for human validation. Quality is unvalidated by a Dzongkha speaker. Weights are CC-BY-NC (non-commercial).

## Phase 6: polish and demo. In progress
- Evaluation harness and a 12-question labelled set: `apps/api/eval/`. Results: see `evaluation.md` once the run completes.
- Web interface (design system, Documents, Ask, Audit): being built; see the status section at the end of this file when updated.

## Test status
API: 104 passed (pytest, real PostgreSQL; includes tests against the real Qwen3 and BGE-M3 models, skipped when Ollama is absent).

## Known gaps
- The knowledge layer shares the DMS database (see `dms-adapter.md`); swapping in BIL's DMS needs a separate index with its own access data.
- No OCR; no reranker; no OpenSearch; PDF and DOCX are not screened for personal data.
- A real answer takes roughly 30 to 90 seconds on this machine (local 8B model, six steps).
- The API container image is about 9.5 GB because PyTorch pulls CUDA packages on Linux; a CPU-only build would be much smaller.
