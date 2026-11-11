"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/format";
import { AGENTS, type Agent } from "./content";

const KIND_LABEL: Record<Agent["kind"], string> = { model: "Model", code: "Code", mixed: "Model and code" };

/** The six roles as a vertical pipeline. Roving tabindex, arrow keys, Home and End, like any WAI-ARIA tab list. */
export function AgentExplorer() {
  const [active, setActive] = useState(AGENTS[0].id);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const current = AGENTS.find((a) => a.id === active) ?? AGENTS[0];

  const move = (event: KeyboardEvent, index: number) => {
    let next = index;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (index + 1) % AGENTS.length;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = (index - 1 + AGENTS.length) % AGENTS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = AGENTS.length - 1;
    else return;
    event.preventDefault();
    setActive(AGENTS[next].id);
    refs.current[AGENTS[next].id]?.focus();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
      <div role="tablist" aria-orientation="vertical" aria-label="The six agents, in the order they work" className="relative">
        <span aria-hidden="true" className="absolute bottom-6 left-[27px] top-6 w-px bg-line-strong" />
        {AGENTS.map((agent, index) => {
          const selected = agent.id === active;
          return (
            <button
              key={agent.id}
              ref={(node) => {
                refs.current[agent.id] = node;
              }}
              role="tab"
              type="button"
              id={`agent-tab-${agent.id}`}
              aria-selected={selected}
              aria-controls="agent-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(agent.id)}
              onKeyDown={(event) => move(event, index)}
              className={cn(
                "group relative flex w-full items-center gap-4 rounded-[10px] px-2 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--link)]",
                selected ? "bg-surface shadow-[var(--shadow-md)]" : "hover:bg-surface/60",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "relative z-10 grid h-[38px] w-[38px] shrink-0 rotate-45 place-items-center rounded-[6px] border-2 transition-colors",
                  selected ? "border-gold bg-primary" : "border-line-strong bg-surface group-hover:border-gold",
                )}
              >
                <span className={cn("-rotate-45 font-display text-[15px] font-semibold tabular-nums", selected ? "text-primary-ink" : "text-heading")}>
                  {index + 1}
                </span>
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[19px] font-semibold leading-tight text-heading">{agent.name}</span>
                <span className="block text-[15px] text-muted">{agent.job}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="agent-panel"
        aria-labelledby={`agent-tab-${current.id}`}
        tabIndex={0}
        key={current.id}
        className="animate-[rise-in_.25s_ease-out] rounded-[14px] border border-line bg-surface p-6 outline-none focus-visible:ring-2 focus-visible:ring-[var(--link)] md:p-8 motion-reduce:animate-none"
      >
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-gold-ink">
          Step {AGENTS.indexOf(current) + 1} of {AGENTS.length}
        </p>
        <h3 className="mt-1 font-display text-[28px] font-semibold leading-tight text-heading">{current.name}</h3>
        <p className="mt-4 text-[17px] leading-relaxed">{current.does}</p>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[10px] bg-surface-2 p-4">
            <dt className="text-[13px] font-semibold uppercase tracking-wide text-muted">What keeps it honest</dt>
            <dd className="mt-1 text-[15px] leading-relaxed">{current.guard}</dd>
          </div>
          <div className="rounded-[10px] bg-surface-2 p-4">
            <dt className="text-[13px] font-semibold uppercase tracking-wide text-muted">Who does the work</dt>
            <dd className="mt-1 text-[15px] leading-relaxed">
              <span className="mb-1 inline-block rounded-[4px] border border-line bg-surface px-1.5 text-[12px] font-semibold leading-5 text-heading">
                {KIND_LABEL[current.kind]}
              </span>
              <br />
              {current.worker}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
