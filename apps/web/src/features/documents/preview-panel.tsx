"use client";

import { fetchVersionText, versionFileUrl } from "@/lib/api";
import { isPdf, isText } from "@/lib/format";
import type { DocVersion } from "@/lib/types";
import { useAsync } from "@/lib/use-async";
import { Button, buttonClasses } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { IconExternal } from "@/components/ui/icons";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

export function PreviewPanel({ documentId, version, page }: { documentId: string; version: DocVersion; page?: number }) {
  const url = versionFileUrl(documentId, version.id);
  const text = isText(version.mime_type);
  const textState = useAsync(text ? `text:${version.id}` : null, (signal) => fetchVersionText(documentId, version.id, signal));

  const openLink = (
    <a href={page ? `${url}#page=${page}` : url} target="_blank" rel="noreferrer" className={buttonClasses("secondary", "sm")}>
      <IconExternal size={16} /> Open in a new tab
    </a>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14px] text-muted">
          Showing <span className="font-semibold text-ink">{version.version_label}</span>, {version.original_filename}
        </p>
        {openLink}
      </div>
      {text ? (
        textState.error ? (
          <Callout kind="error" title="The preview could not be loaded" actions={<Button size="sm" onClick={textState.reload}>Try again</Button>}>
            {textState.error.message}
          </Callout>
        ) : textState.loading ? (
          <LoadingRegion label="Loading preview" className="space-y-2 rounded-[10px] border border-line bg-surface p-4">
            <Skeleton className="w-3/4" />
            <Skeleton className="w-full" />
            <Skeleton className="w-2/3" />
          </LoadingRegion>
        ) : (
          <pre tabIndex={0} aria-label={`Text of ${version.original_filename}`} className="max-h-[560px] overflow-auto whitespace-pre-wrap break-words rounded-[10px] border border-line bg-surface p-4 font-mono text-[13.5px] leading-6 text-ink">
            {textState.data}
          </pre>
        )
      ) : isPdf(version.mime_type) ? (
        <iframe title={`Preview of ${version.original_filename}`} src={`${url}#page=${page ?? 1}`} className="h-[560px] w-full rounded-[10px] border border-line bg-surface" />
      ) : (
        <Callout kind="info" title="This file type cannot be shown in the browser">
          {version.original_filename} is a Word document. Use &quot;Open in a new tab&quot; to download and read it. Text and PDF files preview here.
        </Callout>
      )}
    </div>
  );
}
