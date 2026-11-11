"use client";

import type { DocVersion } from "@/lib/types";
import { ProtectedViewer } from "./protected-viewer";

/** Documents are view-only: there is no "open the file" or download link here, for PDF, Word or text alike. */
export function PreviewPanel({ documentId, version, page }: { documentId: string; version: DocVersion; page?: number }) {
  return (
    <div className="space-y-3">
      <p className="text-[14px] text-muted">
        Showing <span className="font-semibold text-ink">{version.version_label}</span>, {version.original_filename}
      </p>
      <ProtectedViewer key={`${version.id}:${page ?? 1}`} documentId={documentId} versionId={version.id} title={version.original_filename} page={page ?? 1} />
    </div>
  );
}
