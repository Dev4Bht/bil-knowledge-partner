"use client";

import { useState } from "react";
import { cn } from "@/lib/format";

// One hue for magnitude. var(--link) is readable on both the light and the dark surfaces and follows the user's
// theme colour, so the charts match whatever colour they chose. Numbers and labels stay in text colours.
const BAR = "var(--link)";

export function StatTile({ label, value, note, tone }: { label: string; value: string | number; note?: string; tone?: "bad" }) {
  return (
    <div className="rounded-[10px] border border-line bg-surface p-4">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("mt-1 font-display text-[34px] font-semibold leading-none tabular-nums text-heading", tone === "bad" && "text-bad")}>{value}</p>
      {note && <p className="mt-2 text-[14px] text-muted">{note}</p>}
    </div>
  );
}

export type BarRow = { key: string; label: string; count: number; hint?: string };

/** Ranked horizontal bars on one baseline. The bar is decoration: every row also says its label and number in text. */
export function BarList({ rows, emptyText, ariaLabel }: { rows: BarRow[]; emptyText: string; ariaLabel: string }) {
  const max = Math.max(0, ...rows.map((r) => r.count));
  if (max === 0) return <p className="text-[15px] text-muted">{emptyText}</p>;
  return (
    <ul aria-label={ariaLabel} className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.key} className="grid grid-cols-[minmax(5.5rem,11rem)_1fr_2.25rem] sm:grid-cols-[minmax(7rem,11rem)_1fr_3rem] items-center gap-3 text-[15px]">
          <span className="min-w-0 truncate" title={row.hint}>{row.label}</span>
          <span aria-hidden="true" className="h-3 rounded-full bg-surface-3">
            <span className="block h-3 rounded-full" style={{ width: `${(row.count / max) * 100}%`, background: BAR, minWidth: row.count > 0 ? 6 : 0 }} />
          </span>
          <span className="text-right font-semibold tabular-nums text-heading">{row.count}</span>
        </li>
      ))}
    </ul>
  );
}

export type DayPoint = { day: string; questions: number };

const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Questions per day as columns, with a hover or focus readout and a table for anyone who prefers numbers. */
export function DayColumns({ points }: { points: DayPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => p.questions));
  const total = points.reduce((sum, p) => sum + p.questions, 0);
  const shown = active === null ? null : points[active];
  const step = Math.max(1, Math.ceil(points.length / 7));
  return (
    <div>
      <div className="mb-2 min-h-6 text-[14px] text-muted" aria-live="polite">
        {shown ? (
          <span><strong className="text-heading">{shown.questions}</strong> {shown.questions === 1 ? "question" : "questions"} on {dayLabel(shown.day)}</span>
        ) : (
          `${total} in this period. Hover or focus a column to see a day.`
        )}
      </div>
      <div className="relative flex h-40 items-end gap-[3px] border-b border-line-strong" onMouseLeave={() => setActive(null)}>
        {[0.5, 1].map((f) => (
          <span key={f} aria-hidden="true" className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${f * 100}%` }} />
        ))}
        <span aria-hidden="true" className="pointer-events-none absolute -top-0.5 right-0 bg-surface pl-1 text-[12px] tabular-nums text-muted">{max}</span>
        {points.map((p, i) => (
          <div
            key={p.day}
            tabIndex={0}
            role="img"
            aria-label={`${dayLabel(p.day)}: ${p.questions} ${p.questions === 1 ? "question" : "questions"}`}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className="relative flex h-full min-w-0 flex-1 items-end rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--link)]"
          >
            <span
              className={cn("block w-full rounded-t-[4px]", active !== null && active !== i && "opacity-60")}
              style={{ height: `${(p.questions / max) * 100}%`, minHeight: p.questions > 0 ? 3 : 0, background: BAR }}
            />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="mt-1.5 flex gap-[3px] text-[12px] text-muted">
        {points.map((p, i) => (
          <span key={p.day} className="min-w-0 flex-1 whitespace-nowrap text-center">{i % step === 0 ? dayLabel(p.day) : ""}</span>
        ))}
      </div>
      <details className="mt-3 text-[14px]">
        <summary className="cursor-pointer text-link hover:underline">View as table</summary>
        <table className="mt-2 w-full max-w-sm text-left">
          <thead><tr className="text-muted"><th className="py-1 font-semibold">Day</th><th className="py-1 text-right font-semibold">Questions</th></tr></thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.day} className="border-t border-line"><td className="py-1">{dayLabel(p.day)}</td><td className="py-1 text-right tabular-nums">{p.questions}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
