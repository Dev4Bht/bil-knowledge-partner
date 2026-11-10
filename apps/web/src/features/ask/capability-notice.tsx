import Link from "next/link";
import type { Capabilities } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { IconCheck, IconClock, IconDocs } from "@/components/ui/icons";

export type AskReadiness = { search: boolean; llm: boolean; translation: boolean; ready: boolean };

export const readinessOf = (caps: Capabilities | undefined): AskReadiness => ({
  search: !!caps?.search,
  llm: !!caps?.llm,
  translation: !!caps?.translation,
  ready: !!caps?.search && !!caps?.llm,
});

/** Explains, from /capabilities, exactly what is missing. Never shows invented content. */
export function CapabilityNotice({ caps }: { caps: Capabilities }) {
  const rows: { label: string; ok: boolean; detail?: string }[] = [
    { label: "Search index", ok: caps.search },
    { label: "Local language model", ok: caps.llm, detail: caps.llm && caps.llm_model ? caps.llm_model : undefined },
    { label: "Dzongkha drafting", ok: caps.translation },
  ];
  return (
    <div className="space-y-4" data-testid="capability-notice">
      <Callout
        kind="info"
        title="Ask cannot answer yet"
        actions={
          <Link href="/documents" className={buttonClasses("secondary", "sm")}>
            <IconDocs size={16} /> Browse documents meanwhile
          </Link>
        }
      >
        This workspace only answers from approved documents, so it stays switched off until the pieces below are running. Nothing is faked in the meantime.
      </Callout>
      <Card className="p-4">
        <h3 className="text-[15px] font-semibold text-heading">What is ready</h3>
        <ul className="mt-2 divide-y divide-line">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-3 py-2 text-[15px]">
              <span>{row.label}{row.detail && <span className="ml-1.5 text-muted">({row.detail})</span>}</span>
              <Badge tone={row.ok ? "ok" : "neutral"} icon={row.ok ? <IconCheck size={13} strokeWidth={2.4} /> : <IconClock size={13} />}>
                {row.ok ? "Ready" : "Not ready"}
              </Badge>
            </li>
          ))}
        </ul>
        {caps.notes.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t border-line pt-3 text-[14px] text-muted">
            {caps.notes.map((note) => (
              <li key={note} className="flex gap-2">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" />
                {note}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** Clearly labelled empty frames that show where results will appear. They hold no sample content. */
export function LayoutPreview() {
  const frames = [
    { title: "Answer", body: "A short answer, then each claim followed by source chips naming the file, version and page." },
    { title: "Version notices", body: "Which version the answer is based on, any older version that was ignored, and conflicts between current documents." },
    { title: "Draft reply", body: "English and Dzongkha tabs with Copy and Mark as reviewed. Dzongkha always carries a human validation label." },
  ];
  return (
    <section aria-label="Layout preview" className="space-y-3">
      <p className="text-[12px] font-bold uppercase tracking-wider text-muted">Layout preview. No content here is an answer.</p>
      <div className="grid gap-3 md:grid-cols-3">
        {frames.map((frame) => (
          <div key={frame.title} className="relative overflow-hidden rounded-[12px] border border-dashed border-line-strong bg-surface p-4">
            <div aria-hidden="true" className="pattern-band absolute inset-x-0 top-0 h-2 opacity-60" />
            <h3 className="mt-1 font-display text-[17px] font-semibold">{frame.title}</h3>
            <p className="mt-1 text-[14px] text-muted">{frame.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
