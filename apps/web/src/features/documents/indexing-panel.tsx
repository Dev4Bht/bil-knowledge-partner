"use client";

import { getCapabilities } from "@/lib/api";
import type { DocVersion, IndexingStatus } from "@/lib/types";
import { useAsync } from "@/lib/use-async";
import { Badge, type Tone } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";

const LABEL: Record<IndexingStatus, string> = {
  not_indexed: "Not indexed yet",
  queued: "Queued",
  processing: "Processing",
  indexed: "Indexed",
  failed: "Failed",
};
const TONE: Record<IndexingStatus, Tone> = { not_indexed: "neutral", queued: "info", processing: "info", indexed: "ok", failed: "bad" };

export function IndexingPanel({ versions }: { versions: DocVersion[] }) {
  const caps = useAsync("capabilities", (signal) => getCapabilities(signal));
  const anyIndexed = versions.some((v) => v.indexing_status !== "not_indexed");
  return (
    <div className="space-y-4">
      {caps.data && !caps.data.extraction && !anyIndexed && (
        <Callout kind="info" title="Not indexed yet">
          Text extraction is not switched on in this system, so files are stored but not read. Once it is, each version shows its real job state here.
        </Callout>
      )}
      <ul className="divide-y divide-line rounded-[10px] border border-line bg-surface">
        {versions.map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="min-w-0">
              <span className="block font-semibold text-heading">{v.version_label}</span>
              <span className="block truncate text-[13px] text-muted">{v.original_filename}</span>
            </span>
            <Badge tone={TONE[v.indexing_status]}>{LABEL[v.indexing_status]}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
