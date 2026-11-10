# BIL Policy Agent: Design (DRAFT for review)

Date: 2026-11-10
Status: Draft, awaiting owner review. No implementation has started.

## 1. Problem

Staff at Bhutan Insurance Limited (BIL) misunderstand HR documents and internal
policy and guidelines. They get wrong answers from colleagues or from memory, and
in a regulated insurer a wrong answer is a compliance risk.

## 2. Goal

One chat agent that answers staff questions about policy, grounded in BIL's own
documents and the RMA regulations, and **always cites the source**. If the
documents do not support an answer, it says so and points to the owning department.

## 3. Scope of version 1

In scope:
- Four departments: **HR, Claims, Underwriting, Finance**.
- Corpus: BIL internal policies for those departments (supplied by BIL), BIL
  public documents (Insurance Handbook, forms, privacy policies), and RMA
  regulation (Financial Services Act 2011 as amended in 2025; Rules and
  Regulations for Insurance and Reinsurance Companies 2019; RMA circulars).
- English only.
- Cloud LLM API allowed (confirmed by the owner).

Out of scope for v1 (YAGNI):
- Taking actions (approving claims, changing records). The agent only answers.
- Customer-facing use.
- Dzongkha. Research shows LLMs are noticeably weaker in Dzongkha; revisit later
  with an English pivot.
- Departments beyond the four.
- Fine-tuning. Retrieval is enough.

## 4. Approach

Retrieval-augmented generation (RAG): hybrid retrieval over chunked documents,
then a Claude model that answers only from the retrieved chunks and returns
structured, citation-checked output. The model call sits behind a small
interface so a self-hosted model can replace it later if BIL's data policy
changes.

Rejected: fully self-hosted model (owner allows cloud; lower quality, needs
GPUs) and stuffing whole documents into the prompt (costly, imprecise
citations, does not scale).

## 5. Architecture

```
 staff browser
      |
   Chat UI  ---->  API (FastAPI)  ---->  Answer agent  ----> Claude API
                       |                     |
                       |                     v
                       |                 Retriever  ----> Index (vectors + keyword)
                       v                                       ^
                  Audit log / feedback                         |
                                                    Ingestion pipeline
                                              (PDF / DOCX / HTML / TXT + manifest)
```

### 5.1 Ingestion pipeline
- Reads a **manifest** (`corpus.yaml`) listing every document: department,
  title, version, effective date, status (`active` or `superseded`), source.
- Loads PDF, DOCX, HTML and TXT. Splits by section heading first, then by size,
  so a chunk is a coherent clause, not an arbitrary window.
- Each chunk keeps: document, section title, page, department, version,
  effective date.
- Embeds chunks and writes them to the index. Re-running ingestion is
  idempotent; changing a document's version replaces its chunks.
- Interface: `ingest(manifest_path) -> IngestReport`.

### 5.2 Retriever
- Hybrid search: vector similarity plus BM25 keyword match, merged. Keyword
  match matters for exact terms such as clause numbers and form codes.
- Filters: `status = active` always; `department` when the user selects one.
- Returns top-k chunks with scores.
- Interface: `retrieve(query, department=None, k=8) -> list[Chunk]`.

### 5.3 Answer agent
- Rewrites follow-up questions into standalone queries using the last few turns.
- Calls the retriever, then calls Claude with a strict system prompt: answer
  only from the supplied chunks, cite every claim, never fill gaps from general
  knowledge, say "not found" when unsupported.
- Returns structured output: `answer`, `citations[]` (document, section, page,
  effective date), `status` (`answered` or `not_found`).
- **Guardrails in code, not just in the prompt:**
  - If the best retrieval score is below a threshold, skip the model and return
    `not_found` with the owning department's contact.
  - Every citation the model returns must match a chunk that was actually
    retrieved; otherwise the response is rejected and retried once, then
    downgraded to `not_found`.
- Interface: `answer(question, history, department=None) -> Answer`.

### 5.4 API and chat UI
- FastAPI: `POST /chat`, `POST /feedback`, `GET /health`. Streaming responses.
- Minimal web chat page: department selector (default "All"), answer with
  clickable citations showing the source passage, thumbs up/down.
- v1 authentication: one shared access token per deployment, via environment
  variable. SSO is a later decision (see open questions).

### 5.5 Audit log and feedback
- Every question, answer, cited chunks and feedback goes to a local database.
  This gives BIL an audit trail and a list of questions the documents fail to
  answer, which is a to-do list for policy owners.

## 6. Error handling
- LLM API failure or timeout: retry with backoff, then a clear "service
  unavailable" message. Never a fabricated answer.
- Unparseable document: ingestion records it in the report and continues; the
  document is not silently dropped.
- Empty or weak retrieval: `not_found` path above.
- Superseded documents are never retrieved, so staff cannot be cited stale
  policy.

## 7. Testing and evaluation
- Unit tests for chunking, manifest parsing, filtering and citation validation.
- A **golden question set**, about 15 to 20 questions per department, each with
  the expected source document. Metrics: retrieval hit rate, citation
  correctness, and correct refusal on out-of-scope questions.
- Evaluation runs in CI and must not regress. Test-first for all code.
- Development uses sample documents. Real internal documents are never committed
  (`data/raw/` and `data/index/` are git-ignored).

## 8. Proposed stack (defaults, open to change)
- Python 3.12, FastAPI, pytest.
- Claude via the Anthropic SDK (answering model: `claude-sonnet-5-5`).
- Embeddings: a local open-source model (sentence-transformers), so only the
  final question and retrieved passages go to the cloud API, not the full corpus.
- Index: a local embedded store (Chroma or SQLite-based) plus a BM25 index.
  No external database to operate in v1.

## 9. Build order (becomes the implementation plan)
1. Project skeleton, config, test harness.
2. Manifest and ingestion for TXT/HTML, then PDF/DOCX.
3. Chunker with section awareness.
4. Index and hybrid retriever with filters.
5. Answer agent with guardrails.
6. API and chat UI.
7. Audit log and feedback.
8. Golden question set and evaluation in CI.
9. Load the real BIL and RMA documents and tune.

## 10. Open questions for BIL
1. Which internal documents exist per department, and in what formats? (Scans
   need OCR, which adds work.)
2. Who owns each department's documents and keeps them current?
3. Single sign-on, or is a shared token acceptable for the pilot?
4. Where will it run (BIL servers or a cloud host)?
5. Does BIL's data policy or RMA guidance restrict sending internal policy text
   to a foreign cloud API? Confirm in writing before real documents are loaded.
6. Is the RMA website reachable and which of its documents are authoritative?
   The site failed a certificate check during research, so the primary RMA
   documents have not been read yet.
