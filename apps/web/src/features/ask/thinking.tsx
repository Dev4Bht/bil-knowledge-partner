"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingRegion } from "@/components/ui/skeleton";

export const AGENT_STAGES = ["Supervisor", "Retrieval", "Policy & Version", "Synthesis", "Verification", "Bilingual Response"];

/**
 * Shown while the local model works (30 to 90 seconds is normal). The request is never timed out early.
 * The server reports no live progress, so the list is an honest indeterminate "working through these"
 * display: it does not claim which stage is current and never shows a fake percentage.
 */
export function Thinking({ onCancel }: { onCancel: () => void }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const pulse = seconds % AGENT_STAGES.length;
  return (
    <LoadingRegion label={`Reading the approved documents. ${seconds} seconds so far.`} className="space-y-3 rounded-[12px] border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[15px] font-semibold text-heading" aria-hidden="true">
          Reading the approved documents
          <span className="tabular ml-2 font-normal text-muted" data-testid="elapsed">{seconds}s</span>
        </p>
        <Button size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <p className="text-[14px] text-muted" aria-hidden="true">
        The model runs on this machine, so a full answer with drafts usually takes 30 to 90 seconds. Nothing leaves it.
      </p>
      <ol className="grid gap-1.5 sm:grid-cols-2" aria-hidden="true">
        {AGENT_STAGES.map((agent, i) => (
          <li key={agent} className="flex items-center gap-2.5 rounded-[8px] bg-surface-2 px-3 py-2 text-[14px]">
            <span className={`size-2.5 shrink-0 rounded-full transition-colors duration-300 ${i === pulse ? "bg-gold" : "bg-line-strong"}`} />
            <span className="text-muted">{i + 1}.</span>
            <span className="font-semibold text-ink">{agent}</span>
          </li>
        ))}
      </ol>
    </LoadingRegion>
  );
}
