# Architecture

One application, two connected workspaces: a **DMS** (the source of truth for documents) and an **AI knowledge partner** that reads from it. Search indexes are derived data and can be rebuilt at any time.

```mermaid
flowchart LR
  subgraph Web["Next.js web app (port 3470)"]
    DMSUI["Documents workspace"]
    ASKUI["Ask workspace"]
  end
  subgraph API["FastAPI (port 8000)"]
    AUTH["Auth, roles, access rules"]
    DMS["DMS service: folders, versions, approval"]
    ING["Ingestion worker"]
    SEARCH["Hybrid search"]
    AGENTS["LangGraph agents"]
  end
  PG[("PostgreSQL + pgvector")]
  FS[("Object store: originals")]
  OLL["Ollama (host): Qwen3 8B, BGE-M3"]
  NLLB["NLLB-200 translation (CPU)"]
  Web -->|cookie session + CSRF header| API
  DMS --> PG
  DMS --> FS
  ING -->|DocumentSource adapter| DMS
  ING -->|chunks + embeddings| PG
  ING --> OLL
  SEARCH --> PG
  AGENTS --> SEARCH
  AGENTS --> OLL
  AGENTS --> NLLB
```

## Document flow

```mermaid
flowchart TD
  U["Upload (admin or manager)"] --> V["Validate: type, signature, size, name, personal-data screen"]
  V --> S["Store original (write-once, key from ids + SHA-256)"]
  S --> D["Draft version (never searchable)"]
  D -->|approve: one transaction| C["approved_current; previous becomes superseded"]
  C --> J["Queue ingestion job"]
  J --> X["Extract text: sections, headings, pages"]
  X --> K["Chunk by section with overlap"]
  K --> E["Embed locally (BGE-M3)"]
  E --> I["Index: full-text + vector"]
```

If embeddings are unavailable the chunks are still stored and the version stays searchable by keyword, with a warning on the job.

## Question flow (six roles)

```mermaid
flowchart TD
  Q["Staff question"] --> SUP["1 Supervisor: plan searches"]
  SUP --> RET["2 Retrieval: access-filtered hybrid search"]
  RET -->|no evidence| ABS["Abstain: no_evidence"]
  RET -->|model down| MU["model_unavailable, sources still listed"]
  RET --> POL["3 Policy & Version: older versions, drafts, conflicts"]
  POL --> SYN["4 Synthesis: claims with evidence ids"]
  SYN --> VER["5 Verification: citation, permission, figures, entailment"]
  VER -->|fails, first time| RET
  VER -->|fails again| ABS
  VER --> BIL["6 Bilingual: English draft, Dzongkha draft, back-translation check"]
  BIL --> OUT["Answer + citations + warnings + drafts (staff review)"]
```

* The retry loop runs **at most once**; LangGraph's recursion limit is a second guard.
* A conflict skips drafting: the documents must be reconciled by their owners first.
* The LLM never decides access. Retrieval applies the rules inside the query, and the verifier re-checks every cited version.

## Where the boundaries are

| Boundary | Today | Notes |
|----------|-------|-------|
| Documents to knowledge layer | `DocumentSource` interface, `LocalDMSAdapter` | Ingestion reads original files only through the adapter. See [dms-adapter.md](dms-adapter.md) |
| Search backend | PostgreSQL full-text + pgvector | OpenSearch is an optional compose profile and is **not implemented** |
| Chat model | Ollama, local | Never a cloud API |
| Dzongkha | NLLB-200 | Experimental, always human-validated |
