"use client";

import Link from "next/link";
import { citationHref } from "@/lib/api";
import type { Citation } from "@/lib/types";
import { DemoBadge, StatusBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { IconDocs, IconExternal } from "@/components/ui/icons";
import { Drawer } from "@/components/ui/overlay";

export const citationLabel = (c: Pick<Citation, "title" | "version_label" | "page" | "section">) =>
  [c.title, c.version_label, c.page ? `p. ${c.page}` : c.section].filter(Boolean).join(" · ");

/** A claim-to-source chip. Clicking opens the authorized preview on the cited page. */
export function CitationChip({ citation, index, onOpen }: { citation: Citation; index: number; onOpen: (c: Citation) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(citation)}
      aria-label={`Open source ${index}: ${citationLabel(citation)}`}
      className="inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-full border border-info/35 bg-info-soft px-2.5 py-0.5 text-[13px] font-semibold text-info transition-colors hover:border-info hover:bg-surface-3"
    >
      <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center rounded-full bg-info text-[10px] font-bold text-white">
        {index}
      </span>
      <span className="truncate">{citationLabel(citation)}</span>
    </button>
  );
}

export function CitationDrawer({ citation, onClose }: { citation: Citation | null; onClose: () => void }) {
  if (!citation) return null;
  const href = citationHref(citation.url);
  const notCurrent = citation.version_status !== "approved_current";
  return (
    <Drawer
      open
      onClose={onClose}
      title={citation.title}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <span>{citation.folder_path}</span>
          <span aria-hidden="true">·</span>
          <span className="font-semibold text-ink">{citation.version_label}</span>
          <StatusBadge status={citation.version_status} />
          {citation.is_demo_fixture && <DemoBadge />}
        </span>
      }
    >
      <div className="space-y-4 p-5">
        {notCurrent && (
          <Callout kind="warning" title="This is not the current version">
            Do not rely on it as current policy. It is shown because the answer cites it.
          </Callout>
        )}
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">
            Cited passage{citation.page ? `, page ${citation.page}` : ""}
            {citation.section ? `, ${citation.section}` : ""}
          </p>
          <blockquote className="mt-1.5 rounded-[10px] border-l-4 border-gold bg-gold-soft px-4 py-3 text-[15px] leading-relaxed text-ink">{citation.snippet}</blockquote>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={href} target="_blank" rel="noreferrer" className={buttonClasses("secondary", "sm")}>
            <IconExternal size={16} /> Open file in a new tab
          </a>
          <Link href={`/documents/${citation.document_id}?version=${citation.version_id}`} className={buttonClasses("quiet", "sm")}>
            <IconDocs size={16} /> Open document page
          </Link>
        </div>
        <iframe title={`Preview of ${citation.title}${citation.page ? `, page ${citation.page}` : ""}`} src={href} className="h-[60vh] w-full rounded-[10px] border border-line bg-surface" />
      </div>
    </Drawer>
  );
}
