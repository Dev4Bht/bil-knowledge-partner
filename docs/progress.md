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
- BGE-M3 embeddings through Ollama; PostgreSQL full-text plus pgvector; weighted reciprocal rank fusion (vector 4 : keyword 1, chosen by measurement, see `evaluation.md`); query synonyms; keyword-only fallback when embeddings are down.
- Access rules applied inside retrieval; drafts never searchable. Real-model test: a "natural calamity" question finds the "flood damage" section.
- **Not done:** OpenSearch backend, reranker.

## Phase 4: agent flow. Done
LangGraph workflow with the six roles, a checkpointer and a bounded retry. Code-verified conflicts, citation/permission/figure checks, abstention, model-unavailable mode that still returns sources. Real-model run of the brief's flood question: `answered`, correct citation, superseded version flagged. See `architecture.md`.

## Phase 5: bilingual drafting. Done, experimental
English draft plus a Dzongkha draft from NLLB-200 (Qwen3 8B produced looping syllables and is not used for Dzongkha). Drafts are checked for script, repetition, figures and back-translation drift and always labelled for human validation. Quality is unvalidated by a Dzongkha speaker. Weights are CC-BY-NC (non-commercial).

## Phase 6: polish and demo. Mostly done
- Evaluation: 18 labelled questions (12 on real public BIL/RMA documents, 6 controls on labelled fictional fixtures). Last run: 16 of 18 fully pass; the two misses (R01, R10) are vaguer-than-possible answers, not ungrounded ones. Details, causes and the corrected Recall@8 (0.964, section level) are in `evaluation.md`.
- Web interface: Documents, Ask, Audit; user-selectable theme colour with light and dark; saved chats (re-open, rename, delete one or all; each user sees only their own; answers are re-checked against current access and status every time a chat is opened).
- Landing page at `/` (public, static): what the six agents do, how answers stay trustworthy, the measured results and the limits. All claims live in `apps/web/src/features/landing/content.ts`; the result figures are copied from `evaluation.md` and must be updated with it. Hero image is a real capture (`apps/web/e2e/landing-assets.mjs`). Browser check: `apps/web/e2e/landing.mjs`. Signed-in visitors see "Open the app"; others "Try the demo".
- Dashboard (managers and admins): document, indexing and question-outcome counts, questions per day, refused requests, assistant status. Counts only. Screenshots: `docs/screenshots/dashboard-*.png`; browser check: `apps/web/e2e/dashboard.mjs`.
- Saved-chat endpoints: `GET/PATCH/DELETE /chat/conversations[/{id}]`, `DELETE /chat/conversations`. Audit records never contain question or answer text.
- **Not verified:** the PDF preview renders blank in headless Chromium (Chromium's built-in PDF viewer is not available there); it has not been checked in a normal browser by automated test.

## Test status
API: 146 tests passed (pytest, real PostgreSQL; the tests against the real Qwen3 and BGE-M3 models are skipped when Ollama is absent). Web: 180 passed (Vitest). Browser scripts under `apps/web/e2e/` run against the live stack (walkthrough, appearance, chat history, live ask).

## Known gaps
- The knowledge layer shares the DMS database (see `dms-adapter.md`); swapping in BIL's DMS needs a separate index with its own access data.
- No OCR; no reranker; no OpenSearch; PDF and DOCX are not screened for personal data.
- A real answer takes roughly 10 to 110 seconds on this machine (local 8B model, six steps); it is slower when the models are cold or other programs are using memory.
- Conflict detection only flags differing figures (days, amounts, dates). A contradiction with no number in it is not auto-flagged, by design, to avoid blocking correct answers.
- Two evaluation questions still fail (R01, R10): the answer is correct but less specific than the documents allow.
- Five labelled "EVAL FIXTURE" documents created by the evaluation runner remain in the DMS and are visible to admin and manager accounts.
- The API image is 472 MB without the Dzongkha translation extra (opt in with `WITH_TRANSLATION=true`, which brings back the multi-GB PyTorch/CUDA install).
