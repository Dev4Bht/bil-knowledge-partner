import type { Capabilities, DocumentDetail, DocumentSummary, DocVersion, User } from "@/lib/types";

export const ADMIN: User = { id: "u-admin", email: "admin@demo.bil.test", display_name: "Demo Admin", roles: ["admin"] };
export const MANAGER: User = { id: "u-mgr", email: "manager@demo.bil.test", display_name: "Demo Manager", roles: ["manager"] };
export const STAFF: User = { id: "u-staff", email: "staff@demo.bil.test", display_name: "Demo Staff", roles: ["staff"] };

export function version(over: Partial<DocVersion> = {}): DocVersion {
  return {
    id: "v1-id",
    document_id: "doc-1",
    version_label: "v1",
    status: "approved_current",
    effective_from: "2024-01-01",
    effective_to: null,
    approved_at: "2024-01-02T09:00:00Z",
    approved_by: "Demo Admin",
    supersedes_version_id: null,
    original_filename: "handbook.txt",
    mime_type: "text/plain",
    size_bytes: 714,
    sha256: "810436bf73aabbccddeeff00112233445566778899aabbccddeeff0011223344",
    language: "en",
    source_lineage: "Fictional demo fixture",
    uploaded_by: "Demo Admin",
    created_at: "2024-01-01T09:00:00Z",
    indexing_status: "not_indexed",
    ...over,
  };
}

export function summary(over: Partial<DocumentSummary> = {}): DocumentSummary {
  const v = version();
  return {
    id: "doc-1",
    title: "Motor Insurance Handbook",
    description: "Cover rules for motor insurance.",
    business_line: { code: "general_insurance", name: "General Insurance" },
    folder: { id: "f-1", name: "Handbooks", path: "Handbooks" },
    access_classification: "staff",
    is_demo_fixture: true,
    owner: "Demo Admin",
    current_version: v,
    latest_version: v,
    version_count: 1,
    updated_at: "2026-11-10T07:00:00Z",
    ...over,
  };
}

export function detail(over: Partial<DocumentDetail> = {}): DocumentDetail {
  const current = version({ id: "v1-id", version_label: "2022", created_at: "2022-01-01T00:00:00Z" });
  const draft = version({ id: "v2-id", version_label: "2024", status: "draft", approved_at: null, approved_by: null, created_at: "2024-01-01T00:00:00Z" });
  return { ...summary({ current_version: current, latest_version: draft, version_count: 2 }), versions: [current, draft], access_roles: [], ...over };
}

export const CAPS_OFF: Capabilities = {
  dms: true,
  extraction: false,
  search: false,
  llm: false,
  translation: false,
  llm_model: null,
  notes: ["The search index is not built yet.", "Dzongkha drafting is not available yet."],
};
export const CAPS_ON: Capabilities = { dms: true, extraction: true, search: true, llm: true, translation: true, llm_model: "qwen3:8b", notes: [] };
