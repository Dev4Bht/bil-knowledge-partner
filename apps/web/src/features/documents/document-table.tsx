"use client";

import Link from "next/link";
import { formatDate, relativeTime, cn } from "@/lib/format";
import type { DocumentSummary } from "@/lib/types";
import { ClassificationBadge, DemoBadge, StatusBadge, Badge } from "@/components/ui/badge";
import { IconClock } from "@/components/ui/icons";

export type SortKey = "updated" | "title" | "effective";

export const effectiveOf = (doc: DocumentSummary) => (doc.current_version ?? doc.latest_version)?.effective_from ?? "";

export function sortDocuments(items: DocumentSummary[], sort: SortKey): DocumentSummary[] {
  const copy = [...items];
  if (sort === "title") copy.sort((a, b) => a.title.localeCompare(b.title));
  else if (sort === "effective") copy.sort((a, b) => effectiveOf(b).localeCompare(effectiveOf(a)));
  else copy.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return copy;
}

function SortHeader({ label, sortKey, sort, onSort, className }: { label: string; sortKey: SortKey; sort: SortKey; onSort: (s: SortKey) => void; className?: string }) {
  const active = sort === sortKey;
  return (
    <th scope="col" aria-sort={active ? (sortKey === "title" ? "ascending" : "descending") : "none"} className={cn("px-3 py-2.5 text-left", className)}>
      <button type="button" onClick={() => onSort(sortKey)} className={cn("inline-flex items-center gap-1 rounded font-semibold uppercase tracking-wide hover:text-ink", active ? "text-heading" : "text-muted")}>
        {label}
        <span aria-hidden="true" className={cn("text-[10px]", !active && "opacity-0")}>{sortKey === "title" ? "▲" : "▼"}</span>
        <span className="sr-only">{active ? ", sorted" : ", sort by this"}</span>
      </button>
    </th>
  );
}

export function DocumentTable({ items, sort, onSort }: { items: DocumentSummary[]; sort: SortKey; onSort: (s: SortKey) => void }) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-line bg-surface shadow-[var(--shadow-card)]">
      <table className="w-full border-collapse text-[14px]">
        <caption className="sr-only">Documents. Sorted by {sort === "title" ? "title" : sort === "effective" ? "effective date" : "last updated"}.</caption>
        <thead className="hidden border-b border-line bg-surface-2 text-[12px] md:table-header-group">
          <tr>
            <SortHeader label="Title" sortKey="title" sort={sort} onSort={onSort} />
            <th scope="col" className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-muted">Status</th>
            <th scope="col" className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-muted">Version</th>
            <SortHeader label="Effective" sortKey="effective" sort={sort} onSort={onSort} />
            <th scope="col" className="hidden px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-muted min-[1500px]:table-cell">Access</th>
            <th scope="col" className="hidden px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-muted min-[1500px]:table-cell">Owner</th>
            <SortHeader label="Updated" sortKey="updated" sort={sort} onSort={onSort} />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((doc) => {
            const shown = doc.current_version ?? doc.latest_version;
            const pendingDraft = doc.current_version && doc.latest_version?.status === "draft" ? doc.latest_version : null;
            return (
              <tr key={doc.id} className="group relative block px-4 py-3.5 transition-colors hover:bg-surface-2 md:table-row md:px-0 md:py-0">
                <td className="block px-0 md:table-cell md:px-3 md:py-3.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link href={`/documents/${doc.id}`} className="text-[16px] font-semibold text-heading underline-offset-2 hover:underline after:absolute after:inset-0 after:content-[''] md:text-[15px]">
                      {doc.title}
                    </Link>
                    {doc.is_demo_fixture && <DemoBadge />}
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
                    <span className="truncate">{doc.business_line.name} / {doc.folder.path}</span>
                    <span className="hidden md:inline-flex min-[1500px]:hidden"><ClassificationBadge value={doc.access_classification} /></span>
                  </p>
                  {/* On phones the table columns collapse into this summary line. */}
                  <div className="mt-2 flex flex-wrap items-center gap-2 md:hidden">
                    {shown && <StatusBadge status={shown.status} />}
                    {shown && <span className="text-[13px] font-semibold text-ink">{shown.version_label}</span>}
                    <ClassificationBadge value={doc.access_classification} />
                    <span className="text-[13px] text-muted">Updated {relativeTime(doc.updated_at)}</span>
                  </div>
                </td>
                <td className="hidden px-3 py-3.5 md:table-cell">
                  <div className="flex flex-col items-start gap-1">
                    {shown ? <StatusBadge status={shown.status} /> : <Badge>No version</Badge>}
                    {pendingDraft && (
                      <Badge tone="warn" icon={<IconClock size={12} />}>
                        Draft pending: {pendingDraft.version_label}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="hidden px-3 py-3.5 md:table-cell">
                  <span className="font-semibold text-ink">{shown?.version_label ?? "None"}</span>
                  <span className="block text-[12px] text-muted">{doc.version_count} {doc.version_count === 1 ? "version" : "versions"}</span>
                </td>
                <td className="tabular hidden px-3 py-3.5 text-ink md:table-cell">{formatDate(shown?.effective_from)}</td>
                <td className="hidden px-3 py-3.5 min-[1500px]:table-cell"><ClassificationBadge value={doc.access_classification} /></td>
                <td className="hidden px-3 py-3.5 text-ink min-[1500px]:table-cell">{doc.owner ?? "Not set"}</td>
                <td className="hidden whitespace-nowrap px-3 py-3.5 text-muted md:table-cell">{relativeTime(doc.updated_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function DocumentTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-[12px] border border-line bg-surface" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line px-4 py-4 last:border-b-0">
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-3 w-1/3" />
          </div>
          <div className="skeleton hidden h-6 w-20 md:block" />
          <div className="skeleton hidden h-4 w-16 md:block" />
        </div>
      ))}
    </div>
  );
}
