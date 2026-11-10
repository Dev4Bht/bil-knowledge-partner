"use client";

import { useState } from "react";
import { compareVersions } from "@/lib/api";
import type { DocVersion } from "@/lib/types";
import { useAsync } from "@/lib/use-async";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Select } from "@/components/ui/fields";
import { IconDiff } from "@/components/ui/icons";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";
import { DiffView } from "./diff-view";

export function ComparePanel({ documentId, versions }: { documentId: string; versions: DocVersion[] }) {
  // versions arrive newest first: compare the previous one (from) to the newest (to).
  const [from, setFrom] = useState(versions[1]?.id ?? "");
  const [to, setTo] = useState(versions[0]?.id ?? "");
  const same = from === to;
  const diff = useAsync(from && to && !same ? `cmp:${from}:${to}` : null, (signal) => compareVersions(documentId, from, to, signal));

  if (versions.length < 2) {
    return (
      <EmptyState icon={<IconDiff size={24} />} title="Only one version so far">
        Upload a second version to compare what changed between them.
      </EmptyState>
    );
  }
  const label = (v: DocVersion) => `${v.version_label} (${v.status === "approved_current" ? "current" : v.status})`;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="From (older)" htmlFor="cmp-from">
          <Select id="cmp-from" value={from} onChange={(e) => setFrom(e.target.value)}>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>{label(v)}</option>
            ))}
          </Select>
        </Field>
        <Field label="To (newer)" htmlFor="cmp-to">
          <Select id="cmp-to" value={to} onChange={(e) => setTo(e.target.value)}>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>{label(v)}</option>
            ))}
          </Select>
        </Field>
        <Button onClick={() => { setFrom(to); setTo(from); }} aria-label="Swap the two versions">Swap</Button>
      </div>
      {same ? (
        <Callout kind="info">Choose two different versions to see what changed.</Callout>
      ) : diff.error ? (
        <Callout kind={diff.error.code === "not_text" ? "info" : "error"} title={diff.error.code === "not_text" ? "Comparison is not available for this file type yet" : "The comparison could not be loaded"} actions={diff.error.code === "not_text" ? undefined : <Button size="sm" onClick={diff.reload}>Try again</Button>}>
          {diff.error.message}
        </Callout>
      ) : diff.loading ? (
        <LoadingRegion label="Comparing versions" className="space-y-2">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-32" />
        </LoadingRegion>
      ) : diff.data ? (
        <DiffView lines={diff.data.lines} />
      ) : null}
    </div>
  );
}
