"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type SyntheticEvent } from "react";
import { ApiError, fetchPageImage, getViewerInfo, versionFileUrl } from "@/lib/api";
import type { ViewerInfo } from "@/lib/types";
import { useAsync } from "@/lib/use-async";
import { Button, IconButton, buttonClasses } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { IconChevronLeft, IconChevronRight, IconLock } from "@/components/ui/icons";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

const block = (event: SyntheticEvent) => event.preventDefault();

/**
 * The only way people read a document. Pages are images rendered by the server for this person, with a watermark
 * naming them and the time. There is no original file and no text in the page to copy, and the controls below switch
 * off the browser's copy, drag, save and print routes. A browser cannot stop the operating system capturing the
 * screen; the watermark is what makes a capture traceable.
 */
export function ProtectedViewer({ documentId, versionId, title, page = 1 }: { documentId: string; versionId: string; title: string; page?: number }) {
  const info = useAsync(`viewer:${versionId}`, (signal) => getViewerInfo(documentId, versionId, signal));
  if (info.error) {
    return (
      <Callout kind="error" title="The document could not be opened" actions={<Button size="sm" onClick={info.reload}>Try again</Button>}>
        {info.error.message}
      </Callout>
    );
  }
  if (!info.data) {
    return (
      <LoadingRegion label="Opening the document" className="space-y-2 rounded-[10px] border border-line bg-surface p-4">
        <Skeleton className="h-[420px]" />
      </LoadingRegion>
    );
  }
  return <Pages info={info.data} documentId={documentId} versionId={versionId} title={title} start={page} />;
}

function Pages({ info, documentId, versionId, title, start }: { info: ViewerInfo; documentId: string; versionId: string; title: string; start: number }) {
  const total = Math.max(1, info.page_count);
  const [current, setCurrent] = useState(Math.min(Math.max(1, start), total));
  const [hidden, setHidden] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const image = useAsync(`page:${versionId}:${current}`, (signal) => fetchPageImage(documentId, versionId, current, signal));
  const url = image.data;

  // An object URL holds the page in memory until it is released.
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  // Where the browser reports a screenshot key, blank the page briefly and empty the clipboard. This helps on Windows
  // only; it is a deterrent, not a lock. Printing is handled by the print stylesheet.
  useEffect(() => {
    let timer: number | undefined;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "PrintScreen") return;
      setHidden(true);
      void navigator.clipboard?.writeText("").catch(() => undefined);
      timer = window.setTimeout(() => setHidden(false), 2500);
    };
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keyup", onKey);
      window.clearTimeout(timer);
    };
  }, []);

  const go = (next: number) => setCurrent(Math.min(Math.max(1, next), total));
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === "ArrowRight" || event.key === "PageDown") { event.preventDefault(); go(current + 1); }
    else if (event.key === "ArrowLeft" || event.key === "PageUp") { event.preventDefault(); go(current - 1); }
  };

  return (
    <section aria-label={`Viewer for ${title}`} className="space-y-3">
      <p className="protected-print-note rounded-[10px] border border-line bg-surface p-4 text-[15px]">This document is view-only and cannot be printed.</p>
      <div className="protected-view space-y-3">
        <p className="flex items-start gap-2 rounded-[10px] bg-surface-2 px-3 py-2 text-[13px] leading-snug text-muted">
          <IconLock size={16} className="mt-0.5 shrink-0" />
          <span>
            <strong className="text-ink">View-only.</strong> Copying, saving and printing are switched off, and every page shows your name and the time.
          </span>
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5" role="group" aria-label="Pages">
            <IconButton label="Previous page" onClick={() => go(current - 1)} disabled={current <= 1}><IconChevronLeft size={18} /></IconButton>
            <label className="flex items-center gap-1.5 text-[14px] text-muted">
              Page
              <input
                type="number"
                min={1}
                max={total}
                value={current}
                onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n >= 1) go(Math.round(n)); }}
                aria-label="Page number"
                className="h-9 w-16 rounded-[8px] border border-line-strong bg-surface px-2 text-center text-[15px] text-ink"
              />
              of {total}
            </label>
            <IconButton label="Next page" onClick={() => go(current + 1)} disabled={current >= total}><IconChevronRight size={18} /></IconButton>
          </div>
          {info.can_download && (
            <a href={versionFileUrl(documentId, versionId)} className={buttonClasses("secondary", "sm")}>Download original</a>
          )}
        </div>

        {image.error ? (
          <Callout
            kind={image.error instanceof ApiError && image.error.status === 429 ? "warning" : "error"}
            title="This page could not be shown"
            actions={<Button size="sm" onClick={image.reload}>Try again</Button>}
          >
            {image.error.message}
          </Callout>
        ) : (
          <div
            ref={holder}
            tabIndex={0}
            aria-label={`Page ${current} of ${total}`}
            onKeyDown={onKeyDown}
            onContextMenu={block}
            onCopy={block}
            onCut={block}
            onDragStart={block}
            className="relative max-h-[70vh] min-h-[320px] select-none overflow-auto rounded-[10px] border border-line bg-surface outline-none [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-[var(--link)]"
          >
            {url && !hidden ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={`Page ${current} of ${total} of ${title}. This is a view-only image, so its text is not available to screen readers.`}
                draggable={false}
                className="pointer-events-none block w-full select-none"
              />
            ) : (
              <div className="grid min-h-[320px] place-items-center p-6 text-center text-[15px] text-muted">
                {hidden ? "Hidden for a moment: this document is view-only." : <Skeleton className="h-[300px] w-full" />}
              </div>
            )}
            {image.loading && url && (
              <span role="status" className="absolute right-3 top-3 rounded-full bg-surface px-3 py-1 text-[12px] font-semibold text-muted shadow-[var(--shadow-sm)]">Loading page&hellip;</span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
