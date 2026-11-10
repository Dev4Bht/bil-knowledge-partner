# BIL Agentic Knowledge Partner: Design (DRAFT v2 for review)

Date: 2026-11-10
Status: Draft v2, awaiting owner approval. No implementation has started.
Supersedes: draft v1 (four-department policy Q&A), which was written before the
BIL Hackathon 2026 brief ("Agentic Knowledge Partner") was shared.

## 1. Problem

BIL keeps its knowledge (handbooks, policy wordings, SOPs, circulars, credit
guidelines, fund rules) in a Document Management System that only offers keyword
search. Staff open files one by one, cannot tell which version is current, and
answer customers by hand without a source. Wrong or unsourced answers are a trust
and compliance risk in a regulated insurer.

## 2. Goal

A staff member asks a real-life question in plain words and gets:
1. a clear answer built from the right documents,
2. exact citations (folder, file, section) and a flag for outdated or conflicting
   content,
3. a ready-to-review draft reply in English or Dzongkha.

The AI informs and drafts. A person reviews and sends.

## 3. What we build, in order

The owner asked for the DMS first so documents can be uploaded, then the agent.
Because the brief says the AI sits **on top of** BIL's existing DMS over
read-only access, we build the DMS as a stand-in for BIL's real one and keep a
hard boundary between the two.

| Phase | Deliverable | Why this order |
|-------|-------------|----------------|
| 1 | **DMS**: upload, folders, versions, access rights, read-only API | Gives the owner somewhere to upload documents, and gives the agent its source of truth |
| 2 | **Knowledge layer**: extraction, chunking, tagging, semantic index | Turns documents into searchable, version-aware, access-aware knowledge |
| 3 | **Agent**: plans search, reads, answers with citations, flags conflicts | The core of the hackathon brief |
| 4 | **Staff chat UI** and **English/Dzongkha draft replies** | The part staff see |
| 5 | **Evaluation set** and user-journey demo | Proves trust: citations, refusals, versions |

## 4. Scope

In scope (MVP):
- Business lines from the brief: **General Insurance, Credit, PF/GF, Corporate**.
- Document types: PDF, DOCX, XLSX, TXT. OCR for scanned PDFs is optional
  (phase 2 stretch).
- Questions in English; drafted replies in English and Dzongkha.
- Roles from the brief: front-line/customer service, underwriter/claims officer,
  credit officer, PF/GF desk, management.
- Documents are unclassified or public-facing only. **No customer personal
  data.** The upload screen states this, and ingestion rejects obvious personal
  identifiers (for example Bhutanese CID number patterns) with a warning.

Out of scope for the MVP:
- Writing back to BIL's real DMS (read-only by design).
- Sending replies to customers. Staff copy the reviewed draft.
- Fine-tuning, voice input, mobile app.
- Connectors for BIL's real DMS (the boundary makes them possible later).

## 5. Architecture

```
 Staff chat UI ──────────────┐
                             ▼
 DMS web UI            Agent service ──► Claude API
 (upload, browse)        │   ▲
        │                ▼   │ tools: search / read section / list versions
        ▼          Knowledge layer (semantic + keyword index, metadata, ACL)
   DMS service              ▲
 (storage, versions,        │ ingestion pulls ONLY through the read-only API
  ACL, audit)  ─────────────┘
   read-only API
```

Three separately testable units with one narrow interface between each:
- **DMS service** exposes a read-only HTTP API. Nothing else touches its storage.
- **Knowledge layer** consumes that API through a `DocumentSource` interface, so
  BIL's real DMS can replace ours by writing one adapter.
- **Agent service** only calls the knowledge layer's `search` and `read`.

### 5.1 DMS service (phase 1)
- **Folders** mirror the brief: General Insurance (Handbooks, SOPs, Claims,
  Products, Forms), Credit, PF/GF, Corporate (Circulars, Forms, Training).
  Admins can add folders.
- **Documents and versions.** A document has many versions. Each version stores
  file, uploader, upload time, effective date, and a status: `draft`, `current`,
  `superseded`. Uploading a new version of a document marks the previous one
  `superseded` (admin can override). Superseded files stay viewable and are
  never deleted.
- **Metadata:** title, business line, document type, effective date, owner.
- **Access rights.** Users belong to groups; each folder has read rules per
  group. The API returns only what the caller may read.
- **Roles:** `admin` (uploads, manages folders and users), `staff` (browse and
  ask). Seeded demo users cover the five roles in the brief.
- **Audit log** of uploads, status changes and reads.
- **Read-only API** (what the knowledge layer and agent are allowed to use):
  `GET /api/folders`, `GET /api/documents`, `GET /api/documents/{id}/versions`,
  `GET /api/versions/{id}/file`, `GET /api/changes?since=...` for incremental
  indexing.
- **Web UI:** folder tree, upload form with metadata, version history, download.
- **Storage:** local filesystem for files, SQLite for metadata. No external
  services to run.

### 5.2 Knowledge layer (phase 2)
- **Ingestion:** polls `/api/changes`, extracts text (PDF, DOCX, XLSX, TXT),
  splits by section headings first, then by size, so a chunk is a coherent
  clause.
- **Each chunk carries:** folder path, file name, section title, page, business
  line, document type, version id, version status, effective date, and the ACL
  groups allowed to read it.
- **Version awareness, two layers:**
  1. Trust the DMS version status. Only `current` is searchable by default;
     `superseded` is searchable only so the agent can say "an older version
     says X but is superseded".
  2. Heuristics for messy real-world folders: normalise titles ("_final",
     "rev2", `/Old`), group near-duplicates, and flag groups with no explicit
     status for an admin to resolve. Flagged items are listed in a "needs
     review" screen in the DMS.
- **Retrieval:** hybrid, vector similarity plus BM25 keyword match, so both
  "natural calamity" ≈ "flood" (meaning) and exact terms like clause numbers
  work. The ACL filter is applied **inside** the query, never after.
- Interface: `search(query, user, business_line=None, include_superseded=False,
  k=8)` and `read_section(chunk_id, user)`.

### 5.3 Agent service (phase 3)
This is a real tool-using agent, not a single retrieve-then-answer call. Claude
runs a loop with these tools:

| Tool | Purpose |
|------|---------|
| `search_documents(query, business_line?)` | Semantic and keyword search, current versions, user's access only |
| `read_section(chunk_id)` | Read the full section around a hit |
| `list_versions(document_id)` | See what is current, what is superseded |
| `finish(answer, citations, conflicts, status)` | Return the structured result |

Behaviour:
- **Plans the search.** Works out the business line and breaks a situation
  ("flood-damaged car, is she covered, what to submit") into sub-questions,
  and searches each across handbook, SOP and circular.
- **Cites every claim** as folder › file › section › page, with the version and
  effective date.
- **Flags** (a) superseded versions it ignored and (b) conflicts between
  current documents (for example a circular that contradicts a handbook).
- **Abstains** when documents are silent: status `not_found`, no invented
  answer, plus the owning business line's contact.
- **Guardrails in code, not only in the prompt:**
  - Every citation must match a chunk the agent actually retrieved, or the
    result is rejected and retried once, then downgraded to `not_found`.
  - If the best retrieval score is below a threshold, return `not_found`
    without answering.
  - Tool calls always run with the asking user's identity, so access rights
    are enforced by the knowledge layer, not trusted to the model.
- **Model:** `claude-sonnet-5-5` for the agent loop.
- Interface: `ask(question, history, user) -> Answer`.

### 5.4 Draft replies in English and Dzongkha (phase 4)
- After the answer is final, a second step drafts a customer-ready reply,
  using **only** the approved answer text.
- **English first, then Dzongkha as a translation of the English draft.** This
  follows the research finding that Dzongkha quality improves when an English
  version is present. A maintained glossary of insurance terms (English to
  Dzongkha) is injected so terms stay consistent.
- Dzongkha drafts are labelled **"machine-drafted, review before sending"**.
  The draft is never sent automatically.
- **Known risk:** LLM Dzongkha is weaker than English. Mitigation is a
  glossary, short sentences, a label, and a review by a Dzongkha-literate BIL
  staff member before launch. We do not claim parity with English.

### 5.5 Staff chat UI (phase 4)
- Chat with streaming answers. Citations show as chips
  (`GI › Handbooks › Motor Insurance Handbook (current) › §4.1`); clicking opens
  the exact passage and the source document.
- A visible banner when older versions were ignored or documents conflict.
- A "Draft reply" panel with English and Dzongkha tabs and a copy button.
- Follow-up questions keep context. Thumbs up and down feed the log.
- Served by the same backend; plain HTML and JavaScript with no build step, to
  keep it easy for BIL's IT team to maintain.

### 5.6 Governance
- Inherits DMS access rights (section 5.2).
- Logs every question, answer, cited chunks, flags and feedback.
- No customer personal data in scope; screened at upload (section 4).
- Staff review before sending (section 5.4).
- Unanswered questions form a list of documentation gaps for policy owners.

## 6. Error handling
- Claude API failure or timeout: retry with backoff, then a clear "service
  unavailable" message, never a fabricated answer.
- Unreadable or scanned document: recorded in the ingestion report and shown in
  the DMS as "not indexed", never silently dropped.
- Weak or empty retrieval: `not_found` path.
- Superseded documents are never presented as current policy.

## 7. Testing and evaluation
- Test-first for all code. Unit tests for version rules, ACL filtering,
  chunking, citation validation and the read-only API contract.
- **Golden question set** of about 10 to 15 questions per business line, each
  with the expected source, plus deliberate traps: a superseded version, two
  conflicting documents, an unanswerable question, and a question the asking
  user is not allowed to see. Metrics: citation correctness, correct refusal,
  correct version choice, no access leaks.
- The brief's own example (flood damage under comprehensive motor cover) is the
  first scenario in the set.
- Development uses **synthetic sample documents** written by us, never real
  BIL policy text. Real documents and indexes are git-ignored.

## 8. Proposed stack (defaults, open to change)
- Python 3.12, FastAPI, SQLAlchemy with SQLite, pytest.
- Anthropic SDK for the agent loop.
- Embeddings: a local multilingual sentence-transformers model, so only the
  question and retrieved passages are sent to the cloud API, not the corpus.
- Index: ChromaDB (embedded) plus a BM25 index. No external database in the MVP.
- Frontend: plain HTML, CSS and JavaScript.
- Single `docker compose up` to run everything.

## 9. Build order inside each phase (becomes the implementation plan)
1. Skeleton, config, test harness.
2. DMS: models, folders, document and version rules, ACL.
3. DMS: upload API and read-only API, then the web UI.
4. Sample corpus (synthetic) across the four business lines.
5. Knowledge layer: extraction, chunking, index, hybrid search with ACL.
6. Version heuristics and "needs review" list.
7. Agent loop, tools, guardrails.
8. Chat UI, citations, flags.
9. Draft replies, English then Dzongkha, glossary.
10. Golden set and evaluation; user-journey walkthrough for the demo.

## 10. Open questions
1. Authentication for the MVP: seeded demo users with a simple login, or
   something closer to BIL's real directory? (Default: seeded users.)
2. Is OCR for scanned PDFs needed in the MVP, or only for the real rollout?
3. Who can review Dzongkha drafts and the glossary?
4. Cloud approval for sending retrieved passages to the Claude API was given by
   the owner. Confirm in writing with BIL before any real document is loaded.
5. Where will the demo run (a laptop, or BIL's server)?
