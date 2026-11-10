# CLAUDE.md — BIL Agentic Knowledge Partner (Hackathon 2026)

You are the lead full-stack engineer, AI/RAG engineer, and test engineer working inside this VS Code repository. **Implement a working MVP**, not merely a proposal. Make changes in the repository, run checks, fix problems, and report precise results. Work autonomously through the phases below unless an essential secret, permission, or externally supplied document is missing. Never claim something works without testing it.

## 0. Goal and official scope

Build a **lightweight temporary Document Management System (DMS)** plus an **AI Agentic Knowledge Partner** for Bhutan Insurance Limited (BIL). For the hackathon, our DMS contains only approved, public-facing/unclassified sample documents. Later, BIL's existing DMS will replace our temporary DMS as the document source using a swappable read-only adapter; the AI system must not depend directly on the temporary DMS database.

The official challenge wants: an innovative concept; a working MVP that answers questions from sample BIL documents with **exact sources**; and a user journey from staff question to trusted answer and draft reply. The solution must support General Insurance, Credit, PF/GF and Corporate content. It must identify superseded/conflicting versions, synthesize multiple sources, provide English answers and **English/Dzongkha draft replies** for staff review, respect document access rights, and abstain when sources do not support the answer. English questions are the minimum scope; Dzongkha question understanding is a stretch goal. Do not use customer personal data. No customer-facing automatic sending.

**Never fabricate BIL policy contents, coverage outcomes, source citations or official documents.** Use clearly identified non-authoritative DEMO fixtures to test the system if real approved sample documents are not supplied. Make the UI visibly distinguish demo fixtures from real approved BIL content.

## 1. Technology constraints

- No mandatory paid API keys or paid hosted AI services. Everything must work locally with free/open-source components. Do not mistake free software for free compute.
- Frontend: Next.js App Router, TypeScript, Tailwind CSS, accessible component primitives (shadcn/ui acceptable), `nuqs` for URL search/query/filter state. `nuqs` is **not the search engine**.
- Backend: Python FastAPI, Pydantic, SQLAlchemy, Alembic, Python 3.11+.
- Database: PostgreSQL for users/roles, document metadata, immutable versions, job state and audit events.
- File store: S3-compatible MinIO in Docker Compose for local deployment, with local filesystem adapter if resource-constrained.
- Retrieval: OpenSearch self-hosted hybrid BM25 + vector index, with exact file/section/page metadata and ACL filters. If OpenSearch is too resource-heavy on the developer laptop, implement a clearly documented local fallback (PostgreSQL full-text + pgvector); keep a SearchBackend interface. Use one real working backend at a time, not a fake one.
- Embeddings: local BGE-M3 via a supported Python inference library. If resource-limited, use a smaller multilingual model with explicit warning that Dzongkha retrieval quality is **unvalidated**; include a retrieval evaluation script.
- Optional reranker: local multilingual reranker, disabled by default on low-memory machines.
- Orchestration: LangGraph with checkpointing and bounded loops; an agent is a logical workflow role, not necessarily a separate LLM process.
- LLM: Ollama local Qwen3 8B if hardware permits, otherwise local Qwen3 4B (or comparably available small open-weight model); configure model by env and expose a friendly unavailable-model error. Never silently call a cloud API.
- Document extraction: Docling or equivalent for PDF/DOCX; text files supported; OCR optional for scanned PDFs, with a visible extraction status and error path. Preserve PDF page numbers and section headings where extractable.
- Containerization: Docker Compose for Postgres, MinIO, OpenSearch (optional profile), API and web. Ollama may run on host to avoid container GPU issues.
- Use pinned/compatible package versions **after checking available package documentation**, avoid relying on deprecated APIs. Implement an environment example, setup guide, migrations, seed flow, tests and demo script.

## 2. Architecture and boundaries

Two connected workspaces, one application:

**A. DMS Admin workspace** — folders, uploads, documents, metadata, document preview, version history, status, approved/published state, access levels, indexing state, audit trail.

**B. AI Staff workspace** — conversational search, filters, answer grounded in approved documents, citations clickable to exact file/page/section, version warnings, English and Dzongkha draft replies, staff review/copy, follow-up questions.

Data flow:

`DMS upload -> validate -> object store -> metadata/version -> extraction/OCR -> section/page-aware chunks -> local embedding -> search index -> ready for querying`

`authenticated staff -> Next.js/nuqs -> FastAPI -> LangGraph supervisor -> access-filtered retrieval -> version/authority check -> synthesis -> verifier -> bilingual draft -> staff review`

The original documents, stored version history, and approval metadata remain the source of truth. Search indexes are derived artifacts and can be rebuilt. Never let the model decide access rights. Enforcement must happen **before any passage reaches the LLM** and again at document-view/download APIs.

### Future DMS integration contract

Define `DocumentSource` with typed methods for:
- `list_documents(changed_since, cursor)` / incremental sync
- `get_document_stream(source_document_id, version_id)`
- `get_document_metadata(source_document_id, version_id)`
- `get_version_history(source_document_id)`
- `get_acl(source_document_id, version_id)`

Implement `LocalDMSAdapter` now. Include a **stub/example** `BILDMSReadOnlyAdapter` with clear TODOs for BIL's actual integration. Do not invent endpoints or claim access to the real DMS. Keep ingestion idempotent by source ID + version + content hash. The AI must work unchanged when adapters are swapped after permissions/metadata mapping.

## 3. DMS domain model

Create Alembic migrations and typed ORM models for at least:

- `users`: ID, display name, email, password hash or local dev SSO-compatible auth, active state; NEVER use plaintext passwords.
- `roles`: admin, staff, optional manager; role memberships.
- `business_lines`: general_insurance, credit, pf_gf, corporate.
- `folders`: hierarchical, business line, optional access scope.
- `documents`: logical document identity, title, description, business line, folder, owner, access classification, timestamps.
- `document_versions`: immutable version ID, version label, effective_from/to, status (`draft`, `approved_current`, `superseded`, `archived`), approved_by/at, supersedes_version_id, storage object key, SHA256, mime, size, language, source lineage.
- `document_chunks`: version ID, chunk ordinal, text, page start/end, heading, section or clause label, offsets, extraction confidence/quality flag.
- `ingestion_jobs`: state (`queued`, `processing`, `indexed`, `failed`), attempt count, error messages, durations.
- `conversations` and `messages`: minimal necessary staff session state, source identifiers, avoid collecting customer personal data.
- `audit_events`: actor, event, resource, time, result (no sensitive question contents in logs by default).
- optionally `document_relations`: circular modifies/revokes clause, authority precedence with reviewer-approved labels; do not infer legal supremacy solely from date or filename.

Use transactional approvals. **Only approved_current content is eligible by default for answers.** Archive/superseded content may be used for explicit history or change-comparison questions, clearly labeled. If the current version is ambiguous, do not guess: show a conflict and escalate. When a new version is approved, transition prior current status atomically; retain immutable originals and associated citations.

## 4. Six logical agent roles (LangGraph)

1. **Supervisor Agent**: extracts business line, intent, constraints and language; selects search plan; clarifies only when truly necessary; routes for document comparison or straightforward question. Enforce bounded tool calls.
2. **Retrieval Agent**: normalize query; run hybrid BM25 + dense retrieval with role/ACL, published-version filters applied **inside the retrieval query**; rerank optionally; return structured evidence (document ID, immutable version ID, file path, page, section, snippet, citation target, score). Query expansion may include approved synonyms (e.g., flood/natural calamity) but must not change the customer's meaning.
3. **Policy & Version Agent**: review effective dates, status, explicit supersession, approved circular relationships; detect contradictory current evidence and missing policy-specific facts. Do not equate newest upload with most authoritative policy.
4. **Knowledge Synthesis Agent**: compose concise answer **only from retrieved evidence** and distinguish general rules from customer-specific determinations. Every meaningful claim must map to one or more evidence IDs. Answer across multiple documents when necessary.
5. **Verification Agent**: deterministic citation existence/permission/version checks plus LLM-supported entailment checks. Require all factual claims supported; if not, retry retrieval at most once or abstain/escalate. Citation-free or fabricated answers are unacceptable. Run verification again after bilingual drafting for semantic drift.
6. **Bilingual Response Agent**: draft an employee-reviewable response in English and Dzongkha. For a free solution, use a local model and optional locally licensed English–Dzongkha translation model after checking licensing and availability. **Do not claim native Dzongkha proficiency**. Include a visible 'Dzongkha draft — human validation required' notice, a terminology/glossary file, and evaluation examples. Do not require Dzongkha questions for initial acceptance.

Implement nodes as testable functions with Pydantic state/evidence schemas. Do not overengineer separate services/LLMs for every role. Prefer deterministic checks where appropriate. If Ollama or translation models are unavailable, search and citations should remain usable, with clear status.

## 5. Document ingestion details

- Accept approved `pdf`, `docx`, `txt`, optional `xlsx` after safe parser support; constrain size and MIME, reject executable/script formats, sanitize names, prevent path traversal.
- Hash files, deduplicate *binary content* without merging distinct document/version identities.
- Extract section headings, page labels, tables where feasible. Chunk by heading/paragraph with moderate overlap; never lose filename + immutable version ID + exact page/section info.
- Tag business line, folder, classification, language and permission scope; show `needs_review` for ambiguous extraction.
- Index when approved and committed; reindex on metadata/ACL changes; delete/disable indexed content on revocation and refresh relevant caches.
- Background job handling can be a DB-backed worker/polling process for MVP; ensure idempotency and user-visible progress. No hard dependency on Redis or hosted queues.

## 6. Search and answer contracts

Create typed endpoints such as:

- `POST /auth/login`, `GET /auth/me` (dev local auth; no hardcoded production credentials)
- `GET /business-lines`, `GET/POST /folders`
- `POST /documents/upload`, `GET /documents`, `GET /documents/{id}`
- `GET /documents/{id}/versions`, `POST /documents/{id}/versions/{version_id}/approve`
- `GET /documents/{id}/versions/{version_id}/file` (authorized, preferably streaming/short-lived URL)
- `POST /documents/{id}/reindex`, `GET /ingestion-jobs/{id}`
- `POST /search` for direct results with permission-filtered snippets and facets
- `POST /chat/ask` for structured answer + evidence/citations + version warnings + bilingual drafts + abstention reason
- `GET /health`, `GET /ready`

Use stable response objects including `answer`, `citations[{document_id, version_id, title, folder_path, section, page, snippet, url}]`, `version_warnings`, `drafts{en,dzo}`, `needs_human_review`, `status`, and `unsupported_claims` for diagnostics (not necessarily exposed to non-admins). Response citations must lead to the actual authorized file/page, not made-up URLs. Avoid exposing unpublished drafts through chat or search.

## 7. Frontend UX

Professional BIL-inspired navy/cream/gold styling (no copyrighted logos unless supplied). Responsive and accessible UI with keyboard navigation and Unicode Dzongkha font fallback (do not redistribute proprietary fonts).

**DMS workspace**: sidebar for four business lines and folder tree; document table with status, version, effective date, classification, uploader, updated time; drag-and-drop upload; preview with page anchors; version diff/compare (simple text diff sufficient); approve/supersede controls; indexing progress; role-aware actions.

**AI workspace**: prominent question composer; side search filters controlled by `nuqs` (`q`, `businessLine`, `language`, `status`, `page`); conversational results; source chips that open an authorized preview on correct page; 'current policy' or 'version conflict' indicators; separate answer and draft-reply cards; English/Dzongkha switch and copy buttons; review/approval action; no automatic external sending.

Provide a deliberate empty-state, loading-state, error-state and no-evidence state. Don't display fake confidence percentages; show evidence/citation quality and review requirements instead. Do not present illustrative claim-policy text as BIL-approved.

## 8. Security and governance

- For the hackathon accept **only unclassified and public-facing approved sample files**. No customer PII; redact/remove sensitive demo data if found.
- Authentication, API authorization, role + document ACL filters at query time and document access. Frontend filters are never authorization.
- All documents are untrusted: resist prompt injection in retrieved contents; text from PDFs may never override agent rules or execute tools.
- File upload protection: type/size limits, sanitized names, safe object keys, no server-side code execution from documents.
- Restrict CORS, secure cookies/session or JWT, CSRF protection as appropriate, secrets in `.env` (not git), restrictive defaults, rate limits, request and answer audit logs without PII.
- Preserve source citations; never make financial/insurance eligibility determinations without adequate applicable policy and review. Staff are final authority.
- BIL DMS future adapter remains read-only; this temporary DMS alone supports upload/edit/approval for the demonstration.

## 9. Tests, benchmarks and acceptance criteria

Create tests for:
- file ingestion PDF/DOCX/TXT and extraction failures
- document ACL and cross-role leakage (search, AI, direct file endpoints)
- immutable version history, only approved-current selection, supersession, version conflicts
- idempotent reindex and revocation/removal behavior
- no hallucinated references; citations resolve to real document version and page/section
- model unavailable and no-answer fallback
- English and Dzongkha draft display; human review labels
- `nuqs` filters and basic frontend flows

Include a reproducible evaluation dataset with **clearly labeled fictional demo documents** and at least 10 questions spanning motor flood claim, housing loan eligibility, PF/GF partial withdrawal, version conflict, unsupported query, policy change comparison, and access-denied behavior. Measure retrieval Recall@k, citation correctness, answer groundedness, version selection accuracy and latency. Establish a baseline; don't invent benchmark scores or claim speed before measuring. Build a short live demo flow that visibly exercises upload -> indexing -> question -> cited answer -> bilingual draft -> staff review.

## 10. Phased implementation — act, don't just plan

**Phase 0: Inspect repository and system**. Identify existing code before making changes. Check runtime, Docker, RAM/storage constraints, available model. Explain any tradeoffs in `docs/decisions.md`. Don't wipe existing work.

**Phase 1: Runnable scaffold**. Create `apps/web`, `apps/api`, `packages` if needed, `infra`, `docs`, `tests`. Compose DB/storage/search services; configure env example; implement healthcheck and migrations. Verify local boot.

**Phase 2: DMS vertical slice**. Implement login/roles, folders, upload, original storage, metadata, versions, approval and preview. Confirm via UI and API tests.

**Phase 3: Ingestion and search**. Extract text, preserve page/section, create embeddings, build OpenSearch hybrid index and filters, clickable citations. Test direct search without LLM.

**Phase 4: Agent flow**. Implement six LangGraph roles as lightweight modules with local Ollama, source evidence schema, conflict detection, abstention and audit. Verify at least one multi-document answer.

**Phase 5: Bilingual drafting**. English and Dzongkha reply UI, translation adapter, glossary and review warning. If no suitable locally usable Dzongkha model is available, provide an explicitly marked experimental draft and document quality/licensing limitations; do not disguise English as Dzongkha.

**Phase 6: Polish and demo**. Add tests, seeded *fictional* materials, evaluation runner, loading/empty/error screens, README, screenshots if tools support them, reproducible commands.

After each phase: run tests/commands, fix failures, update `docs/progress.md` with actual completed items and blockers. Continue to the next phase without repeatedly asking for permission. If not feasible in one session, leave a running vertical slice, list exact remaining tasks, and provide the next command to execute.

## 11. Repository deliverables

- Real source files and migrations in repository; not merely pseudocode or mock UI.
- `README.md`: prerequisites, hardware recommendations, setup, run/test, admin seed, model download, demo steps, offline limitations.
- `.env.example` with safe defaults and documented secrets; `.gitignore` excludes env, data files, uploaded docs and model artifacts.
- `docker-compose.yml` and optional low-memory profile. Provide exact commands.
- `docs/architecture.md` diagrams (Mermaid), `docs/api.md`, `docs/data-model.md`, `docs/security.md`, `docs/dms-adapter.md`, `docs/evaluation.md`, `docs/progress.md`.
- Realistic but clearly fictional sample documents generated by the project; avoid passing off fabricated policies as BIL's.
- Automated backend, frontend and end-to-end smoke tests where possible.

## 12. Interaction protocol

Start now by inspecting the repository and writing a short numbered implementation plan. Then **create the code** beginning with the smallest functioning end-to-end slice. Prefer running code over long theoretical discussions. Do not ask me to choose routine architecture details; make sound defaults. If unable to access Docker/Ollama, build and test everything possible with explicit graceful fallbacks and exact local run instructions. When done, report:

1. Files implemented and architecture decisions.
2. Commands actually executed and test results.
3. How to run the MVP in VS Code.
4. What is demo-ready vs not yet complete.
5. What BIL data/integration details would be required later.
