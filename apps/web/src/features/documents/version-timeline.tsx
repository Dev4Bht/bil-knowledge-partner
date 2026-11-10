"use client";

import { cn, formatBytes, formatDate, formatDateTime, shortHash } from "@/lib/format";
import type { DocVersion } from "@/lib/types";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconArchive, IconCheck, IconEye, IconHash } from "@/components/ui/icons";

export function VersionTimeline({ versions, selectedId, onSelect, canManage, onApprove, onArchive, busyId }: {
  versions: DocVersion[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  canManage: boolean;
  onApprove: (version: DocVersion) => void;
  onArchive: (version: DocVersion) => void;
  busyId: string | null;
}) {
  return (
    <ol className="relative space-y-3 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-0.5 before:bg-line" aria-label="Version history, newest first">
      {versions.map((v) => {
        const muted = v.status === "superseded" || v.status === "archived";
        const selected = v.id === selectedId;
        return (
          <li key={v.id} className="relative pl-10" data-version-status={v.status}>
            <span
              aria-hidden="true"
              className={cn(
                "absolute left-[7px] top-5 flex size-4 items-center justify-center rounded-full border-2",
                v.status === "approved_current" ? "border-ok bg-ok text-white" : v.status === "draft" ? "border-warn bg-surface" : "border-line-strong bg-surface",
              )}
            >
              {v.status === "approved_current" && <IconCheck size={10} strokeWidth={3.5} />}
            </span>
            <article
              className={cn(
                "rounded-[10px] border bg-surface p-4 shadow-[var(--shadow-card)] transition-colors",
                selected ? "border-gold ring-1 ring-gold/50" : "border-line",
                muted && "bg-surface-2",
              )}
              aria-label={`Version ${v.version_label}, ${v.status.replace("_", " ")}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className={cn("font-display text-[20px] font-semibold leading-tight", muted && "text-muted")}>{v.version_label}</h3>
                <StatusBadge status={v.status} />
              </div>
              <dl className={cn("mt-2 space-y-0.5 text-[13.5px]", muted ? "text-muted" : "text-ink")}>
                <div className="flex gap-1.5">
                  <dt className="text-muted">Effective</dt>
                  <dd className="tabular">
                    {formatDate(v.effective_from)}
                    {v.effective_to ? ` to ${formatDate(v.effective_to)}` : v.status === "approved_current" ? " onward" : ""}
                  </dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-muted">Uploaded</dt>
                  <dd>
                    {v.uploaded_by ?? "Unknown"}, {formatDateTime(v.created_at)}
                  </dd>
                </div>
                {v.approved_at && (
                  <div className="flex gap-1.5">
                    <dt className="text-muted">Approved</dt>
                    <dd>
                      {v.approved_by ?? "Unknown"}, {formatDateTime(v.approved_at)}
                    </dd>
                  </div>
                )}
                <div className="flex items-center gap-1.5 break-all">
                  <dt className="sr-only">File</dt>
                  <dd className="text-muted">
                    {v.original_filename}, {formatBytes(v.size_bytes)}
                    <span className="ml-1.5 inline-flex items-center gap-0.5 font-mono text-[12px]" title={v.sha256}>
                      <IconHash size={12} />
                      {shortHash(v.sha256)}
                    </span>
                  </dd>
                </div>
              </dl>
              {v.status === "superseded" && <p className="mt-2 text-[13px] font-medium text-muted">Replaced by a newer version. Read only, never use it as current.</p>}
              {v.status === "archived" && <p className="mt-2 text-[13px] font-medium text-muted">Archived. Kept for history only.</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant={selected ? "secondary" : "quiet"} onClick={() => onSelect(v.id)} aria-pressed={selected} icon={<IconEye size={16} />}>
                  {selected ? "Selected" : "Preview"}
                </Button>
                {canManage && v.status === "draft" && (
                  <Button size="sm" variant="primary" onClick={() => onApprove(v)} loading={busyId === v.id} icon={<IconCheck size={16} />}>
                    Approve as current
                  </Button>
                )}
                {canManage && v.status !== "archived" && (
                  <Button size="sm" variant="quiet" onClick={() => onArchive(v)} disabled={busyId === v.id} icon={<IconArchive size={16} />}>
                    Archive
                  </Button>
                )}
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}

/** What approving will change, shown before the user confirms. */
export function describeApproval(versions: DocVersion[], target: DocVersion): string[] {
  const current = versions.find((v) => v.status === "approved_current" && v.id !== target.id);
  const lines = [`${target.version_label} becomes the current version, and staff will start to see it as current policy.`];
  if (current) lines.push(`${current.version_label} becomes superseded and its effective period ends. It stays readable but is never treated as current.`);
  else lines.push("There is no current version today, so nothing is superseded.");
  lines.push("Approval cannot be undone. To go back, upload the earlier content as a new version.");
  return lines;
}
