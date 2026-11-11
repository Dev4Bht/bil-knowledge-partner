"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/format";
import { RECORDED_ON, RUNS, type Run } from "./runs";

const TAB_LABEL: Record<Run["kind"], string> = { answered: "Answered", declined: "Declined", conflict: "Conflict" };
const STAMP: Record<Run["kind"], { text: string; tone: string }> = {
  answered: { text: "Answered", tone: "border-ok text-ok" },
  declined: { text: "No answer", tone: "border-warn text-warn" },
  conflict: { text: "Conflict", tone: "border-bad text-bad" },
};
const STEP_MS = 520;

const Label = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cn("text-[12px] font-semibold uppercase tracking-[0.16em] text-muted", className)}>{children}</p>
);

const noMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const plain = (title: string) => title.replace(/^EVAL FIXTURE:\s*/, "");

function Stamp({ kind }: { kind: Run["kind"] }) {
  return (
    <span className={cn("inline-block -rotate-2 border-2 px-3 py-1 font-display text-[15px] font-semibold uppercase tracking-[0.14em]", STAMP[kind].tone)}>
      {STAMP[kind].text}
    </span>
  );
}

function Result({ run }: { run: Run }) {
  const retrievals = run.steps.filter((s) => s.agent === "Retrieval").length;
  if (run.kind === "declined") {
    return (
      <div>
        <Stamp kind="declined" />
        <p className="mt-5 max-w-xl font-display text-[24px] leading-snug text-heading">{run.reason}</p>
        <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-muted">
          It searched {retrievals === 1 ? "once" : `${retrievals} times`} and found nothing that answers this, so it stopped. No claims, no sources, and nothing was drafted.
        </p>
        <Label className="mt-6">0 claims · 0 sources · 0 drafts</Label>
      </div>
    );
  }
  if (run.kind === "conflict") {
    return (
      <div>
        <div className="flex flex-wrap items-center gap-4">
          <Stamp kind="conflict" />
          <Label>Fictional test documents, not BIL policy</Label>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {run.sources.map((s, i) => (
            <figure key={s.title} className="border border-line-strong bg-surface-2 p-4">
              <Label>{plain(s.title)}</Label>
              <blockquote className="mt-2 font-display text-[19px] leading-snug text-heading">{`“${s.snippet}”`}</blockquote>
              <figcaption className="mt-2 text-[13px] text-muted">Version {s.version} · {s.section} · source {i + 1}</figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed">{run.reason}</p>
        <p className="mt-2 text-[15px] text-muted">{run.notes[0]}</p>
      </div>
    );
  }
  return (
    <div>
      <Stamp kind="answered" />
      <ol className="mt-5 space-y-3">
        {run.claims.map((c) => (
          <li key={c.text} className="max-w-xl font-display text-[22px] leading-snug text-heading">
            {c.text}
            {c.sources.map((n) => (
              <sup key={n} className="ml-0.5 font-sans text-[13px] font-bold text-gold-ink">{n}</sup>
            ))}
          </li>
        ))}
      </ol>
      <ol className="mt-6 space-y-3 border-t border-line-strong pt-4">
        {run.sources.map((s, i) => (
          <li key={s.title + (s.page ?? i)} className="grid grid-cols-[1.5rem_1fr] gap-x-2 text-[15px]">
            <span className="font-bold text-gold-ink">{i + 1}</span>
            <span>
              <span className="font-semibold text-heading">{s.title}</span>
              <span className="text-muted"> · {s.version}{s.section ? ` · ${s.section}` : ""}{s.page ? ` · p. ${s.page}` : ""}</span>
              <span className="mt-1 block text-[14px] italic leading-relaxed text-muted">{`“${s.snippet}”`}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-6 border border-dashed border-line-strong p-4">
        <Label>Draft reply, for staff to review</Label>
        <p className="mt-1 text-[16px] leading-relaxed">{run.draft}</p>
      </div>
    </div>
  );
}

/** A real recorded run, replayed. The log lines are the system's own words; only the pacing is staged. */
export function Replay() {
  const [index, setIndex] = useState(0);
  const run = RUNS[index];
  const total = run.steps.length + 1; // every step, then the result
  const [shown, setShown] = useState(total); // starts complete, so the page is whole without JavaScript or motion
  const [playing, setPlaying] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const start = useCallback(() => {
    if (noMotion()) {
      setPlaying(false);
      setShown(Number.MAX_SAFE_INTEGER);
      return;
    }
    setShown(0);
    setPlaying(true);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setShown((s) => {
        if (s + 1 >= total) setPlaying(false);
        return Math.min(s + 1, total);
      });
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [playing, total]);

  const choose = (next: number) => {
    if (next === index) return;
    setIndex(next);
    start();
  };
  const onKey = (event: KeyboardEvent, i: number) => {
    let next = i;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (i + 1) % RUNS.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (i - 1 + RUNS.length) % RUNS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = RUNS.length - 1;
    else return;
    event.preventDefault();
    choose(next);
    tabs.current[next]?.focus();
  };
  const done = shown >= total;

  return (
    <div className="border border-line-strong bg-surface shadow-[8px_8px_0_var(--line)]">
      <div role="tablist" aria-label="Three recorded questions" className="grid divide-y divide-line-strong border-b border-line-strong sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {RUNS.map((r, i) => {
          const selected = i === index;
          return (
            <button
              key={r.kind}
              ref={(node) => {
                tabs.current[i] = node;
              }}
              role="tab"
              type="button"
              id={`run-tab-${r.kind}`}
              aria-selected={selected}
              aria-controls="run-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => choose(i)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "relative flex flex-col items-start justify-start px-5 py-4 text-left outline-none transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--link)]",
                selected ? "bg-surface-2" : "hover:bg-surface-2/60",
              )}
            >
              {selected && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-gold" />}
              <Label className={selected ? "text-gold-ink" : undefined}>{TAB_LABEL[r.kind]}</Label>
              <span className="mt-1 block font-display text-[18px] leading-snug text-heading">{r.question}</span>
            </button>
          );
        })}
      </div>

      <div id="run-panel" role="tabpanel" aria-labelledby={`run-tab-${run.kind}`} tabIndex={0} className="grid outline-none lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="border-b border-line-strong p-5 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3">
            <Label>What the agents logged</Label>
            <span className="flex gap-3 text-[13px] font-semibold">
              <button type="button" onClick={start} className="text-link underline-offset-2 hover:underline">Replay</button>
              {!done && <button type="button" onClick={() => { setPlaying(false); setShown(total); }} className="text-link underline-offset-2 hover:underline">Skip to result</button>}
            </span>
          </div>
          <ol className="mt-4 space-y-3.5 font-mono text-[13px] leading-relaxed">
            {run.steps.map((s, i) => {
              const visible = i < shown;
              const retry = /retrying/.test(s.text);
              return (
                <li key={i} aria-hidden={!visible || undefined} className={cn("transition-opacity duration-300 motion-reduce:transition-none", visible ? "opacity-100" : "opacity-0")}>
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="font-bold text-heading">{s.agent}{retry && <span className="ml-2 rounded-sm bg-warn-soft px-1 text-[11px] font-semibold uppercase text-warn">retry</span>}</span>
                    <span className="tabular-nums text-muted">{s.seconds.toFixed(1)} s</span>
                  </p>
                  <p className="text-ink/90">{s.text}</p>
                </li>
              );
            })}
          </ol>
          <p className="mt-5 border-t border-line-strong pt-3 text-[13px] leading-relaxed text-muted">
            Recorded {RECORDED_ON}: {run.totalSeconds.toFixed(0)} s in total on a laptop. Played back faster than real time.
          </p>
        </div>

        <div className="min-h-[22rem] p-5 md:p-7" aria-live="polite">
          {done ? (
            <div className="animate-[fade-in_.35s_ease-out] motion-reduce:animate-none"><Result run={run} /></div>
          ) : (
            <p className="font-mono text-[13px] text-muted" role="status">
              Working&hellip; step {Math.min(shown + 1, run.steps.length)} of {run.steps.length}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
