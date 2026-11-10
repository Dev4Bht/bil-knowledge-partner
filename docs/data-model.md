# Data model

PostgreSQL 16 with pgvector. Migrations: `apps/api/alembic/versions/` (0001 domain model, 0002 search index). `alembic check` reports no drift between models and migrations.

| Table | Purpose |
|-------|---------|
| `users`, `roles`, `user_roles` | Accounts (Argon2 password hashes) and the roles admin, manager, staff |
| `business_lines` | general_insurance, credit, pf_gf, corporate |
| `folders` | Hierarchy per business line; optional `required_role_id` scopes a whole subtree |
| `documents` | Logical document: title, business line, folder, owner, `access_classification` (public, staff, restricted), `is_demo_fixture` |
| `document_access_roles` | Roles allowed to read a `restricted` document |
| `document_versions` | **Immutable** version: label, dates, status, approval, `supersedes_version_id`, object key, SHA-256, MIME, size, language, lineage |
| `document_chunks` | Derived: text, page range, heading, section label, offsets, quality flag, `embedding vector(1024)`, generated `tsv` |
| `ingestion_jobs` | queued, processing, indexed, failed; attempts, error, warning, chunk count, duration |
| `conversations`, `messages` | Staff chat sessions; messages hold source version ids only |
| `audit_events` | Who did what; no question or answer text |
| `document_relations` | Reviewer-approved links (modifies, revokes, clarifies). Table exists; not used by the agents yet |

## Rules enforced by the database

* One `approved_current` version per document (partial unique index `uq_one_current_per_document`).
* Unique version label per document; unique folder name per parent.

## Version lifecycle

`draft` -> `approved_current` -> `superseded` or `archived`. Only drafts can be approved. Approval locks the document row and, in one transaction, supersedes the previous current version and links `supersedes_version_id`. Files and hashes never change after upload.
