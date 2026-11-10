# API

Base URL `http://localhost:8000`. Interactive docs at `/docs`. All requests use the session cookie (`credentials: "include"`); every non-GET request must send `X-Requested-With: bil-web`. Errors are `{"detail": "...", "code": "..."}`.

## Auth
| Endpoint | Notes |
|----------|-------|
| `POST /auth/login` `{email, password}` | Sets the `bil_session` cookie. 401 `invalid_credentials`, 429 `rate_limited` |
| `POST /auth/logout` | 204 |
| `GET /auth/me` | Current user and roles |

## Catalogue
`GET /business-lines`, `GET /folders` (only folders the user may see), `POST /folders` (admin).

## Documents
| Endpoint | Who | Notes |
|----------|-----|-------|
| `GET /documents?q&business_line&folder_id&status&page&page_size` | signed in | Only documents and versions the user may see |
| `POST /documents/upload` (multipart) | admin, manager | Creates the document with a **draft** first version |
| `GET /documents/{id}` | signed in | Detail with visible versions, each with `indexing_status` |
| `POST /documents/{id}/versions` (multipart) | admin, manager | New draft version |
| `POST /documents/{id}/versions/{vid}/approve` | admin, manager | Atomic; queues indexing |
| `POST /documents/{id}/versions/{vid}/archive` | admin, manager | |
| `GET /documents/{id}/versions/{vid}/file` | signed in, access checked | Inline bytes; PDFs open at `#page=N` |
| `GET /documents/{id}/compare?from=&to=` | signed in | Line diff (text files) |
| `POST /documents/{id}/reindex` | admin, manager | Queue indexing again; 202 |
| `GET /ingestion-jobs/{id}` | admin, manager | State, attempts, error, warning |

## Search (no language model)
`POST /search` `{query, business_line?, status: "current"|"history", page?}` returns `{items:[{id, document_id, version_id, title, folder_path, business_line, version_label, version_status, section, page, snippet, url, score, is_demo_fixture}], total, facets, mode, notes}`. `mode` is `keyword_only` when embeddings are down.

## Ask
`POST /chat/ask` `{question, business_line?, language?, include_history?, conversation_id?}` returns:

| Field | Meaning |
|-------|---------|
| `status` | `answered`, `conflict`, `no_evidence`, `model_unavailable`, `needs_clarification`, `error` |
| `answer`, `claims[{text, citation_ids}]` | The answer is the verified claims joined; every claim has citations |
| `citations[{id, document_id, version_id, title, folder_path, version_label, version_status, section, page, snippet, url, is_demo_fixture}]` | `url` is an API-relative path to the real file |
| `version_warnings[{kind, message, version_ids}]` | `older_version_ignored`, `conflict`, `draft_excluded` (managers only), `history_included` |
| `drafts{en, dzo}`, `draft_notes[]` | Customer reply drafts for staff review, with check results |
| `caveats[]` | e.g. a rule is not a decision on a specific customer |
| `needs_human_review` | Always `true` |
| `abstention_reason` | Why no answer, or the conflict instruction |
| `steps[{agent, summary}]` | What each of the six roles did, with timings |
| `unsupported_claims[]` | Rejected claims, **admins only** |

Questions containing CID-style numbers are refused (422 `personal_data`). 30 questions per user per minute.

## System
`GET /capabilities` (what is actually available: extraction, search, llm, translation, model name, notes), `GET /audit` (admin), `GET /health`, `GET /ready`.
