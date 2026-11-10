import { CLASSIFICATION_LABEL, formatBytes, formatDate, formatDateTime } from "@/lib/format";
import type { DocumentDetail, DocVersion } from "@/lib/types";
import { StatusBadge } from "@/components/ui/badge";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 border-b border-line py-2.5 last:border-b-0 sm:grid-cols-[170px_1fr] sm:gap-4">
      <dt className="text-[14px] text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-[15px] text-ink">{children}</dd>
    </div>
  );
}

export function DetailsPanel({ doc, version }: { doc: DocumentDetail; version: DocVersion }) {
  const superseded = doc.versions.find((v) => v.id === version.supersedes_version_id);
  return (
    <div className="space-y-5">
      <section aria-labelledby="det-doc">
        <h3 id="det-doc" className="mb-1 font-display text-[18px] font-semibold">Document</h3>
        <dl>
          <Row label="Business line">{doc.business_line.name}</Row>
          <Row label="Folder">{doc.folder.path}</Row>
          <Row label="Classification">{CLASSIFICATION_LABEL[doc.access_classification]}</Row>
          <Row label="Roles allowed">
            {doc.access_classification === "restricted" ? (doc.access_roles.length ? doc.access_roles.join(", ") : "None listed") : "Not restricted by role"}
          </Row>
          <Row label="Owner">{doc.owner ?? "Not set"}</Row>
          <Row label="Description">{doc.description || "No description"}</Row>
          <Row label="Last updated">{formatDateTime(doc.updated_at)}</Row>
        </dl>
      </section>
      <section aria-labelledby="det-ver">
        <h3 id="det-ver" className="mb-1 flex items-center gap-2 font-display text-[18px] font-semibold">
          Version {version.version_label} <StatusBadge status={version.status} />
        </h3>
        <dl>
          <Row label="Effective from">{formatDate(version.effective_from)}</Row>
          <Row label="Effective to">{version.effective_to ? formatDate(version.effective_to) : "Open ended"}</Row>
          <Row label="Language">{version.language === "dz" ? "Dzongkha" : "English"}</Row>
          <Row label="File">
            {version.original_filename}, {formatBytes(version.size_bytes)}, {version.mime_type}
          </Row>
          <Row label="SHA-256"><code className="break-all font-mono text-[13px]">{version.sha256}</code></Row>
          <Row label="Uploaded by">{version.uploaded_by ?? "Unknown"}, {formatDateTime(version.created_at)}</Row>
          <Row label="Approved by">{version.approved_at ? `${version.approved_by ?? "Unknown"}, ${formatDateTime(version.approved_at)}` : "Not approved yet"}</Row>
          <Row label="Lineage">
            {version.source_lineage || "Not recorded"}
            {superseded && <span className="block text-muted">Supersedes {superseded.version_label}</span>}
          </Row>
        </dl>
      </section>
    </div>
  );
}
