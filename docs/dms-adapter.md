# DMS adapter contract

The AI side must read documents through `DocumentSource` (`apps/api/app/source.py`) so BIL's real DMS can replace the temporary one.

| Method | Purpose |
|--------|---------|
| `list_documents(changed_since, cursor)` | Incremental sync, paged |
| `get_document_stream(source_document_id, version_id)` | Original bytes of one immutable version |
| `get_document_metadata(source_document_id, version_id)` | Version label, status, dates, hash, MIME, language |
| `get_version_history(source_document_id)` | All versions, oldest first |
| `get_acl(source_document_id, version_id)` | Classification, allowed roles, folder scope |

`LocalDMSAdapter` implements it over the temporary DMS and is read-only. `BILDMSReadOnlyAdapter` is a **stub**: every method raises `NotImplementedError`. It lists what BIL must provide: authentication method and the read-only API or staging directory, folder to business-line mapping, how approval and "current" are marked, how access rights map to roles, and a change feed. No BIL endpoint is assumed.

## What is decoupled today, and what is not
* **Decoupled:** ingestion reads original files only through the adapter.
* **Not yet decoupled:** the knowledge layer shares the application database with the DMS. Ingestion reads chunk metadata, version status and access rules from the DMS tables, and search and access checks use those tables at query time. To truly swap in BIL's DMS, `list_documents` and `get_acl` must feed a separate index that stores its own copy of version status and access data, and the access functions must read that copy. This is the remaining work for the swap and is not built.
* Idempotency: re-indexing a version replaces its chunks, so repeated runs give identical results (tested). Keying jobs on source id + version + content hash is not implemented; jobs are keyed on the version id.
