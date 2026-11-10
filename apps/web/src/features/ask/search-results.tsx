"use client";

import type { SearchHit, SearchResponse } from "@/lib/types";
import { businessLineName } from "@/lib/format";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { IconSearch } from "@/components/ui/icons";

export function SearchResults({ data, onOpen, onFacet, activeLine }: { data: SearchResponse; onOpen: (hit: SearchHit) => void; onFacet: (code: string | null) => void; activeLine: string | null }) {
  const facets = Object.entries(data.facets?.business_line ?? {});
  return (
    <section aria-label="Search results" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[14px] text-muted" aria-live="polite">{data.total} {data.total === 1 ? "result" : "results"}</p>
        {facets.map(([code, count]) => (
          <button
            key={code}
            type="button"
            aria-pressed={activeLine === code}
            onClick={() => onFacet(activeLine === code ? null : code)}
            className={`min-h-8 rounded-full border px-3 text-[13px] font-semibold ${activeLine === code ? "border-gold bg-gold-soft text-gold-ink" : "border-line bg-surface text-ink hover:bg-surface-3"}`}
          >
            {businessLineName(code)} <span className="text-muted">{count}</span>
          </button>
        ))}
      </div>
      {data.items.length === 0 ? (
        <EmptyState icon={<IconSearch size={24} />} title="No matching passages">Try different words, or remove a filter.</EmptyState>
      ) : (
        <ul className="space-y-2.5">
          {data.items.map((hit) => (
            <li key={hit.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => onOpen(hit)} className="text-left text-[16px] font-semibold text-link underline-offset-2 hover:underline">
                    {hit.title}
                  </button>
                  <span className="text-[13px] font-semibold text-ink">{hit.version_label}</span>
                  <StatusBadge status={hit.version_status} />
                </div>
                <p className="mt-0.5 text-[13px] text-muted">
                  {hit.folder_path}
                  {hit.page ? ` · page ${hit.page}` : ""}
                  {hit.section ? ` · ${hit.section}` : ""}
                </p>
                <p className="mt-2 text-[15px] leading-relaxed text-ink">{hit.snippet}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
