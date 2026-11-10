# BIL Knowledge Partner: Web App Design

Status: design for review, written before building. Follows [`CLAUDE.md`](../CLAUDE.md) (sections 3, 6, 7, 8). Nothing in this file is built yet unless marked **built**.

## 1. What this app is

One application with two connected workspaces for BIL staff:

- **Documents (DMS).** Where approved documents live: folders, uploads, versions, approval, access levels, history. Built first because everything else depends on it.
- **Ask (AI knowledge partner).** Where a staff member asks a real question and gets a sourced answer and a draft reply in English and Dzongkha, for review before use.

Design goal: it should feel like a calm, trustworthy tool for people who are mid-conversation with a customer. Fast to scan, nothing decorative that costs reading time, and every claim traceable to a document.

### Honesty rules (these shape the UI)

1. The **Ask** workspace is built as a real interface, but it cannot answer until extraction, search and the local model exist (Phases 3 to 5). Until then it says so plainly, driven by a `/capabilities` API response. It never shows a fake answer, fake citation or fake confidence.
2. Fictional demo documents are flagged in the database (`is_demo_fixture`) and carry a visible **DEMO** badge everywhere they appear. They are never presented as BIL policy.
3. Dzongkha text is always labelled "Dzongkha draft. Human validation required".
4. No fake percentages. Evidence quality is shown as facts: how many sources, which versions, any conflicts.

## 2. Users and what each needs

| Role | Can do |
|------|--------|
| **Staff** | Browse approved documents they may see. Ask questions. Copy reviewed drafts. |
| **Manager** | Everything staff can, plus see drafts, upload, approve, archive. |
| **Admin** | Everything, plus create folders, manage access levels, read the audit log. |

Real-life personas from the BIL brief: front-line and customer service, underwriters and claims officers, credit officers, PF/GF desk staff, management and new joiners. The demo accounts map to roles, not to individual people.

## 3. Visual design system

**Mood:** institutional and warm, not corporate-grey. Deep navy for trust, cream for calm reading, restrained gold for emphasis and status. Original geometric motifs inspired by Bhutanese pattern work. No BIL logo or other copyrighted marks are used; a simple original mark (nested diamond) stands in until BIL supplies one.

### Colour tokens

| Token | Light | Use |
|-------|-------|-----|
| `navy` | `#1B2A4E` | Header, primary buttons, headings |
| `navy-soft` | `#2F4170` | Hover, secondary surfaces |
| `cream` | `#F5F0EA` | Page background |
| `paper` | `#FFFFFF` | Cards, tables |
| `gold` | `#B87D0A` | Accents, focus ring, "current" highlights |
| `ink` | `#2B2F3A` | Body text |
| `muted` | `#5D6472` | Secondary text |
| `ok` | `#1F6F5C` | Current, success |
| `warn` | `#9A6500` | Conflict, needs review |
| `bad` | `#A3382D` | Errors, denied |

A dark theme follows `prefers-color-scheme` with the same tokens remapped. All text and control colours meet WCAG AA contrast (4.5:1 body, 3:1 large text and UI). Status is never colour-only: every badge has a text label and an icon.

### Typography

- Headings: a serif display face for character. Body and UI: a clean humanist sans. Both are open-licence fonts bundled with the app (no Google Fonts request, so it works offline).
- Dzongkha: Tibetan-script fallback (Noto Sans Tibetan or similar open font) so Dzongkha never renders as boxes. No proprietary fonts are redistributed.
- Scale: 12 / 14 / 16 / 18 / 24 / 32 / 44. Body 16, tables 14.

### Space, shape, motion

- 4 px base grid. Cards radius 12, controls radius 8. Soft low shadows, 1 px warm borders.
- Motion is short (120 to 200 ms), purposeful (panel slide, list reorder, toast) and fully disabled under `prefers-reduced-motion`.
- Subtle pattern band (SVG, original) on the login screen and empty states only. Never behind text that must be read.

### Core components

`AppShell` (rail + top bar), `Button` (primary, secondary, quiet, danger), `Badge` (status, DEMO, classification), `Card`, `DataTable` (sortable, keyboard navigable), `Dialog` and `Drawer`, `Tabs`, `Toast`, `Skeleton`, `EmptyState`, `Callout` (info, warning, conflict), `FileDropzone`, `VersionTimeline`, `DiffView`, `CitationChip`, `CommandPalette`, `CopyButton`.

Built with Tailwind and small hand-written accessible components (focus trapping in dialogs, ARIA roles, visible focus rings). No heavy UI framework.

## 4. Information architecture

```
/login                      Sign in
/                           Redirects: signed in -> /ask, otherwise /login
/ask                        AI workspace            (filters in the URL via nuqs)
/documents                  DMS workspace           (filters in the URL via nuqs)
/documents/[documentId]     Document detail: versions, preview, compare, approve
/admin/audit                Audit log (admin only)
```

Global: left rail (Ask, Documents, Audit for admins), top bar (breadcrumb, **Ctrl/Cmd+K** command palette to jump to any document, theme, user menu). On phones the rail becomes a bottom tab bar.

URL state with `nuqs`: `q`, `businessLine`, `status`, `folder`, `page`, `sort` on Documents; `q`, `businessLine`, `language`, `status` on Ask. Every view is linkable and survives refresh. `nuqs` only holds UI state; it is not the search engine.

## 5. Screens

### 5.1 Login

Split layout: left, navy panel with the original pattern, product name and the one-line promise. Right, a cream card with email and password, a clear error line, and a "Demo environment" note listing the demo accounts and that documents are fictional. Rate-limited on the server; errors never say which half was wrong.

### 5.2 Documents workspace

```
+------+----------------------------------------------------------------+
| rail | Documents                         [Search title...]  [+ Upload]  |
|      |----------------------------------------------------------------|
|      | General Insurance | Credit | PF/GF | Corporate      (tabs)       |
|      | Folders (tree)   |  Status: All  Current  Draft  Superseded      |
|      | > Handbooks      |  +------------------------------------------+ |
|      | > SOPs           |  | Title              Status  Ver  Effective| |
|      | > Claims         |  | Motor Handbook DEMO  Current v2  1 Jan 24| |
|      | > Products       |  | Claims SOP     DEMO  Current v1  1 Jun 22| |
|      | > Forms          |  | ...                                      | |
+------+------------------+------------------------------------------+---+
```

- Business-line tabs and folder tree on the left; document table on the right with status, current version, effective date, classification, owner, updated time.
- **Upload dialog** (admin, manager): drag and drop or browse, shows file type and size checks immediately, then metadata (title, business line, folder, access level, effective dates, language). Clear message that only unclassified, public-facing documents are allowed, with no customer personal data.
- States: loading skeleton rows; empty folder ("Nothing here yet" with an upload button for those who may); error with retry; no results for the filter with a "clear filters" button.

### 5.3 Document detail

Header: title, DEMO badge if relevant, business line, folder path, classification, owner. Below, a two-column layout:

- **Left: version timeline.** Each version is a card: label, status badge, effective dates, who uploaded and approved and when, file name and size and hash (short). Actions by role: **Approve as current**, **Archive**, **Upload new version**. Approving shows what will change ("v2 becomes current, v1 becomes superseded") before confirming.
- **Right: tabs.** *Preview* (text files inline, PDFs in the browser viewer, with a page anchor such as `#page=3`), *Compare* (pick two versions, see a line diff with additions and deletions; text files until extraction exists), *Details* (all metadata, access roles, lineage), *Indexing* (shows "Not indexed yet. Extraction arrives in Phase 3" until built, then real job state).

Superseded and archived versions are clearly muted and labelled; they can be read but never look current.

### 5.4 Ask (AI workspace)

```
+------+-----------------------------------------------+----------------+
| rail |  Ask BIL Knowledge Partner                    | Filters         |
|      |  +------------------------------------------+ | Business line   |
|      |  | Ask a question about a real situation... | | Language        |
|      |  +------------------------------------------+ | Include history |
|      |  [Ask]                                        |                |
|      |                                               | Sources panel   |
|      |  Answer card   (claims -> source chips)       |                |
|      |  Version notices (current / conflict)         |                |
|      |  Draft reply card:  [English] [Dzongkha]      |                |
|      |  [Copy] [Mark as reviewed]                    |                |
+------+-----------------------------------------------+----------------+
```

Built as the final design, wired to the real endpoint when it exists. **Until Phases 3 to 5 land,** the composer is disabled and a callout explains exactly what is missing, read from `/capabilities` (for example: "Search index: not built. Local model: not installed. Dzongkha drafting: not available"). The page still shows how citations, version notices and the two draft cards will look using clearly labelled empty states, never invented content.

When live, the page shows:

- **Answer card.** Short answer; each claim followed by `CitationChip`s (file, version, page or section). Clicking opens the Preview drawer at that page.
- **Version notices.** "Based on current version v2 (effective 1 Jan 2024)". "An older version was ignored." "Conflict: Circular 2024/017 says 14 days; Motor Handbook v2 says 7 days. Both are current. Escalate to the Claims team." Conflicts are never resolved silently.
- **No-evidence state.** "The approved documents do not answer this." with the reason and who to ask. No guess.
- **Draft reply.** Separate card with English and Dzongkha tabs, a copy button, and a **Mark as reviewed** action. Dzongkha carries the permanent human-validation notice. Nothing is sent anywhere automatically.
- **Follow-ups** keep context within the conversation.

### 5.5 Audit log (admin)

Table of who did what and when (login, upload, approve, archive, denied access). Filters by event and result. Contains no question text or customer data.

### 5.6 Cross-cutting UX

Command palette; toasts for every mutation; optimistic list updates with rollback on error; inline validation; unsaved-upload warning; skeletons not spinners; clear 403 and 404 pages ("You may not have access to this document, or it does not exist." The same message for both, so existence never leaks).

## 6. Accessibility and responsiveness

- Full keyboard use: skip link, logical focus order, roving focus in tables and trees, Esc closes dialogs and returns focus.
- Landmarks and headings per page; ARIA live regions for status changes and toasts.
- Touch targets at least 44 px on mobile. Layouts tested at 360, 768 and 1280 px widths.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`. Zoom to 200% without loss.
- Dzongkha text uses a script-appropriate font stack and line height.

## 7. Backend for the DMS (Phase 2)

### 7.1 Auth and security

- Login with email and password; passwords hashed with Argon2; never stored or logged in plaintext.
- Session is a signed JWT in an **httpOnly, SameSite=Lax cookie** (Secure when served over HTTPS). Not readable by scripts.
- CSRF: state-changing requests must carry `X-Requested-With: bil-web`, and CORS allows only the web origin. A cross-site page cannot send that header.
- Login rate limit per IP and email. Audit event on every login, success or denial.
- Demo accounts are created only when `APP_ENV` is not `production` and `DEMO_PASSWORD` is set.

### 7.2 Access rules (enforced on the server, never in the UI)

| Rule | Behaviour |
|------|-----------|
| Admin | Sees everything. |
| Classification `public` | Any signed-in user. |
| Classification `staff` | Staff, manager, admin. |
| Classification `restricted` | Only roles listed on the document, plus admin. |
| Folder with a required role | Only that role (and admin) may see the folder or anything in it. |
| Draft versions | Visible to admin and manager only. |
| Unseen document | The API answers 404, the same as a missing one, and records a `denied` audit event. |

### 7.3 Version rules

- Versions are immutable. Only status and approval fields ever change; the stored file and its SHA-256 never do.
- Statuses: `draft` -> `approved_current` -> `superseded` or `archived`. Only a draft can be approved.
- **Approval is one transaction** that locks the document, marks the previous current version `superseded` (setting its end date), links `supersedes_version_id`, and sets the new one current. The database index guarantees at most one current version per document.
- Newest upload never means authoritative. Authority comes only from approval.

### 7.4 Upload safety

Allowed: PDF, DOCX, TXT (XLSX later). Extension whitelist plus content check (PDF and Office magic bytes, valid UTF-8 for text). Size limit from settings. File name sanitised and never used in a storage path (keys are made from ids and the hash). Plain-text files containing 11-digit CID-like numbers are rejected. Everything else is checked again at extraction in Phase 3.

### 7.5 Endpoints (contract)

| Method and path | Who | Purpose |
|-----------------|-----|---------|
| `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | all | Session |
| `GET /business-lines` | signed in | The four business lines |
| `GET /folders`, `POST /folders` | read: signed in; create: admin | Folder tree filtered by access |
| `GET /documents` | signed in | Paged, filtered list (`q`, `business_line`, `folder_id`, `status`, `page`, `page_size`) |
| `POST /documents/upload` | admin, manager | New document with a first draft version |
| `GET /documents/{id}` | signed in | Detail with visible versions |
| `POST /documents/{id}/versions` | admin, manager | Upload a new draft version |
| `POST /documents/{id}/versions/{vid}/approve` | admin, manager | Atomic approval |
| `POST /documents/{id}/versions/{vid}/archive` | admin, manager | Archive |
| `GET /documents/{id}/versions/{vid}/file` | signed in, access checked | Stream the original (inline) |
| `GET /documents/{id}/compare?from=&to=` | signed in | Line diff (text files) |
| `GET /capabilities` | signed in | Which features exist yet |
| `GET /audit` | admin | Audit events |
| `GET /health`, `GET /ready` | public | **Built** |

Errors share one shape: `{ "detail": "...", "code": "..." }`.

### 7.6 Demo data (fictional, flagged)

Seeded by a command, only in non-production. Every demo file begins "FICTIONAL DEMO FIXTURE - not BIL policy." and is flagged `is_demo_fixture`. The set covers every case the product must handle:

- Motor Insurance Handbook: v1 superseded, v2 current (flood cover differs between them).
- Circular 2024/017: states a claim-reporting period that **conflicts** with the handbook (14 days vs 7 days).
- Claims SOP, Fire renewal checklist (a draft v2 that only admin and manager see), Housing Loan SOP, PF/GF Partial Withdrawal procedure, Customer Service Charter, Motor product catalogue.
- One `restricted` document visible to managers only, to demonstrate access control.

Demo accounts: `admin`, `manager`, `staff` at `*@demo.bil.test`, password from `DEMO_PASSWORD` in `.env`.

## 8. Testing

**Backend (pytest, real Postgres):** login and cookie flags, rate limit, role checks; each access rule in 7.2 including cross-role leakage on list, detail and file endpoints; approval transaction (supersession, single current, concurrent approvals); immutability; upload validation (type, magic bytes, size, traversal, CID); diff; audit entries and that no sensitive text is logged.

**Frontend (Vitest and Testing Library):** components (badges, timeline, diff, dropzone), `nuqs` filter round trips, each screen's loading, empty, error and denied states, and keyboard behaviour of dialogs.

**End to end:** a scripted run through the live stack: sign in, upload, approve, compare, preview, sign in as staff and confirm a draft and a restricted document are invisible. Screenshots at three widths for review.

## 9. Build order (each step ends tested and committed)

1. **M1 Backend core.** Settings, security, access rules, errors, audit, demo seed. Tests first.
2. **M2 Documents API.** Folders, upload, versions, approve, archive, file, compare, capabilities. Tests first.
3. **M3 Design system.** Tokens, fonts, components, app shell, command palette, login screen.
4. **M4 Documents workspace.** List, filters in the URL, upload dialog, document detail with timeline, preview and compare.
5. **M5 Ask workspace shell.** Composer, filters, capability-driven states, empty states, draft and citation components ready for Phase 3 to 5.
6. **M6 Polish and proof.** Accessibility pass, responsive pass, end-to-end run, screenshots, README and progress update, then run it locally for review.

## 10. Out of scope for this design

Text extraction, search, the local model, agents and Dzongkha drafting (Phases 3 to 5). The Ask workspace is designed here so those slot in without redesign, but it will not claim to work before they do.

## 11. Open questions

1. Is a serif display face acceptable for headings, or should everything be sans?
2. Are three demo accounts (admin, manager, staff) enough, or should each BIL role from the brief have its own?
3. Should staff be allowed to see superseded versions (read-only history), or only the current one? The design assumes they can, clearly labelled.
