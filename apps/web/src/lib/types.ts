// Types mirror apps/api/app/schemas.py. Do not guess shapes: change them here only when the API changes.

export type BusinessLineCode = "general_insurance" | "credit" | "pf_gf" | "corporate";
export type AccessClassification = "public" | "staff" | "restricted";
export type VersionStatus = "draft" | "approved_current" | "superseded" | "archived";
export type Role = "admin" | "manager" | "staff";
export type IndexingStatus = "not_indexed" | "queued" | "processing" | "indexed" | "failed";

export type User = { id: string; email: string; display_name: string; roles: string[] };
export type BusinessLine = { code: BusinessLineCode; name: string };

export type FolderRef = { id: string; name: string; path: string };
export type Folder = FolderRef & {
  business_line: BusinessLineCode;
  parent_id: string | null;
  required_role: string | null;
};

export type DocVersion = {
  id: string;
  document_id: string;
  version_label: string;
  status: VersionStatus;
  effective_from: string | null;
  effective_to: string | null;
  approved_at: string | null;
  approved_by: string | null;
  supersedes_version_id: string | null;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  language: string;
  source_lineage: string;
  uploaded_by: string | null;
  created_at: string;
  indexing_status: IndexingStatus;
};

export type DocumentSummary = {
  id: string;
  title: string;
  description: string;
  business_line: BusinessLine;
  folder: FolderRef;
  access_classification: AccessClassification;
  is_demo_fixture: boolean;
  owner: string | null;
  current_version: DocVersion | null;
  latest_version: DocVersion | null;
  version_count: number;
  updated_at: string;
};

export type DocumentDetail = DocumentSummary & { versions: DocVersion[]; access_roles: string[] };
export type DocumentPage = { items: DocumentSummary[]; total: number; page: number; page_size: number };

export type DiffLine = { kind: "add" | "del" | "ctx" | "hunk"; text: string };
export type CompareResult = { from_version: DocVersion; to_version: DocVersion; lines: DiffLine[] };

export type Capabilities = {
  dms: boolean;
  extraction: boolean;
  search: boolean;
  llm: boolean;
  translation: boolean;
  llm_model: string | null;
  notes: string[];
};

export type AuditEvent = {
  id: string;
  created_at: string;
  actor: string | null;
  event: string;
  resource_type: string;
  resource_id: string | null;
  result: string;
  detail: Record<string, unknown>;
};
export type AuditPage = { items: AuditEvent[]; total: number; page: number; page_size: number };

// ---- Future endpoints (Phase 3 to 5). Typed to the agreed contract; the UI copes with them not existing yet.

export type AskStatus = "answered" | "no_evidence" | "conflict" | "model_unavailable" | "needs_clarification" | "error";
export type AskLanguage = "en" | "dz";

export type AskRequest = {
  question: string;
  business_line?: BusinessLineCode;
  language?: AskLanguage;
  include_history?: boolean;
  conversation_id?: string;
};

export type Citation = {
  id: string;
  document_id: string;
  version_id: string;
  title: string;
  folder_path: string;
  version_label: string;
  version_status: VersionStatus;
  section: string | null;
  page: number | null;
  snippet: string;
  url: string;
  is_demo_fixture: boolean;
};

export type Claim = { text: string; citation_ids: string[] };

export type VersionWarning = {
  kind: "older_version_ignored" | "conflict" | "draft_excluded" | "history_included";
  message: string;
  version_ids: string[];
};

export type AskResponse = {
  conversation_id: string;
  status: AskStatus;
  answer: string | null;
  claims: Claim[];
  citations: Citation[];
  version_warnings: VersionWarning[];
  drafts: { en: string | null; dzo: string | null };
  needs_human_review: boolean;
  abstention_reason: string | null;
  steps: { agent: string; summary: string }[];
  /** Extra fields the live API returns beyond the agreed contract. Optional so older servers still type-check. */
  caveats?: string[];
  draft_notes?: string[];
  /** Admin diagnostics only. Never rendered for other roles. */
  unsupported_claims?: unknown[];
};

export type SearchRequest = { query: string; business_line?: string; status?: string; page?: number };
export type SearchHit = {
  id: string;
  document_id: string;
  version_id: string;
  title: string;
  folder_path: string;
  version_label: string;
  version_status: VersionStatus;
  section: string | null;
  page: number | null;
  snippet: string;
  url: string;
  score?: number;
  is_demo_fixture?: boolean;
  business_line?: string;
};
export type SearchResponse = {
  items: SearchHit[];
  total: number;
  facets: { business_line: Record<string, number> };
};

// ---- Saved chats
export type ConversationSummary = { id: string; title: string; created_at: string; updated_at: string; question_count: number };
export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  /** The answer exactly as it was shown, re-checked by the server against what the user may open today. */
  result: AskResponse | null;
  /** Why a saved answer may be out of date, or why its text is hidden. */
  notices: string[];
};
export type ConversationDetail = { id: string; title: string; created_at: string; updated_at: string; messages: ConversationMessage[] };

// ---- Dashboard (counts only: no question text, titles or names)
export type CountItem = { key: string; count: number };
export type Dashboard = {
  generated_at: string;
  documents: { documents: number; awaiting_approval: number; by_status: CountItem[]; by_business_line: CountItem[]; demo_fixtures: number };
  indexing: { indexed_passages: number; jobs: CountItem[]; average_duration_ms: number | null };
  activity: {
    days: number;
    questions: number;
    outcomes: CountItem[];
    with_version_warnings: number;
    searches: number;
    denied: number;
    active_people: number;
    per_day: { day: string; questions: number }[];
  };
};

// ---- View-only viewer
export type ViewerInfo = { page_count: number; view_only: boolean; can_download: boolean; kind: "pdf" | "text" };
