"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/format";

export type TabDef = { id: string; label: string; icon?: ReactNode; count?: number };

/** WAI-ARIA tabs: roving tabindex, Arrow/Home/End keys, automatic activation. */
export function Tabs({ tabs, value, onChange, label, idPrefix, className, variant = "underline" }: {
  tabs: TabDef[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  idPrefix: string;
  className?: string;
  variant?: "underline" | "pill";
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const move = (event: KeyboardEvent, index: number) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    onChange(tabs[next].id);
    refs.current[tabs[next].id]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "flex gap-1 overflow-x-auto",
        variant === "underline" ? "border-b border-line" : "rounded-[10px] bg-surface-3 p-1",
        className,
      )}
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[tab.id] = node;
            }}
            role="tab"
            type="button"
            id={`${idPrefix}-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={selected ? `${idPrefix}-panel-${tab.id}` : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => move(event, index)}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap px-3.5 text-[15px] font-semibold transition-colors md:min-h-10",
              variant === "underline" &&
                cn("-mb-px border-b-[3px]", selected ? "border-gold text-heading" : "border-transparent text-muted hover:text-ink"),
              variant === "pill" &&
                cn("rounded-[8px]", selected ? "bg-surface text-heading shadow-[var(--shadow-sm)]" : "text-muted hover:text-ink"),
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span className="rounded-full bg-surface-3 px-1.5 text-[12px] tabular text-muted">{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, idPrefix, active, children, className }: {
  id: string;
  idPrefix: string;
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${id}`}
      aria-labelledby={`${idPrefix}-tab-${id}`}
      hidden={!active}
      tabIndex={0}
      className={className}
    >
      {active ? children : null}
    </div>
  );
}
