"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { IconCheck } from "@/components/ui/icons";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/callout";
import { Tabs, TabPanel } from "@/components/ui/tabs";

export const DZONGKHA_LABEL = "Dzongkha draft. Human validation required.";

/** True when one short token makes up most of a long text: a sign of a model stuck repeating itself. */
export function looksDegenerate(text: string): boolean {
  const tokens = text.split(/[\s\u0F0B\u0F0D\u0F0E]+/).filter((t) => t.length > 0);
  if (tokens.length < 12) return false;
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return Math.max(...counts.values()) / tokens.length > 0.6;
}

type Lang = "en" | "dzo";

export function DraftCard({ drafts, notes = [], preferred = "en", idPrefix }: { drafts: { en: string | null; dzo: string | null }; notes?: string[]; preferred?: "en" | "dz"; idPrefix: string }) {
  const [tab, setTab] = useState<Lang>(preferred === "dz" && drafts.dzo ? "dzo" : "en");
  const [reviewed, setReviewed] = useState<Record<Lang, boolean>>({ en: false, dzo: false });
  const text = drafts[tab];
  const isReviewed = reviewed[tab];

  return (
    <Card className="overflow-hidden" aria-labelledby={`${idPrefix}-draft-h`}>
      <div className="border-b border-line bg-surface-2 px-5 py-3">
        <h3 id={`${idPrefix}-draft-h`} className="font-display text-[18px] font-semibold">
          Draft reply for the customer
        </h3>
        <p className="text-[13px] text-muted">For you to review and edit. Nothing is sent anywhere automatically.</p>
      </div>
      <div className="p-5">
        <Tabs
          variant="pill"
          label="Draft language"
          idPrefix={`${idPrefix}-draft`}
          value={tab}
          onChange={(id) => setTab(id as Lang)}
          tabs={[
            { id: "en", label: "English" },
            { id: "dzo", label: "Dzongkha" },
          ]}
          className="w-fit"
        />
        {(["en", "dzo"] as Lang[]).map((lang) => (
          <TabPanel key={lang} id={lang} idPrefix={`${idPrefix}-draft`} active={tab === lang} className="mt-4 outline-none">
            {lang === "dzo" && (
              <p className="mb-3 inline-flex items-center gap-2 rounded-[8px] border border-warn/45 bg-warn-soft px-3 py-1.5 text-[14px] font-semibold text-warn" data-testid="dz-label">
                {DZONGKHA_LABEL}
              </p>
            )}
            {drafts[lang] && looksDegenerate(drafts[lang]!) && (
              <Callout kind="error" title="This draft looks broken" className="mb-3">
                The text is mostly one word repeated, so it is probably not a usable translation. Do not send it. Ask a Dzongkha speaker to write the reply.
              </Callout>
            )}
            {drafts[lang] ? (
              <div lang={lang === "dzo" ? "dz" : "en"} className={`whitespace-pre-wrap break-words rounded-[10px] border border-line bg-bg px-4 py-3 text-[16px] leading-relaxed text-ink ${lang === "dzo" ? "font-dz" : ""}`}>
                {drafts[lang]}
              </div>
            ) : (
              <p className="rounded-[10px] border border-dashed border-line-strong px-4 py-6 text-center text-[15px] text-muted">
                {lang === "dzo" ? "No Dzongkha draft was produced for this answer. English is never passed off as Dzongkha." : "No English draft was produced for this answer."}
              </p>
            )}
          </TabPanel>
        ))}
        {notes.length > 0 && (
          <Callout kind="warning" title="Notes on these drafts" className="mt-4">
            <ul className="space-y-1">
              {notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </Callout>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <CopyButton text={text ?? ""} disabled={!text} label={`Copy ${tab === "dzo" ? "Dzongkha" : "English"} draft`} />
          <Button
            size="sm"
            variant={isReviewed ? "secondary" : "primary"}
            disabled={!text}
            aria-pressed={isReviewed}
            onClick={() => setReviewed((r) => ({ ...r, [tab]: !r[tab] }))}
            icon={isReviewed ? <IconCheck size={16} /> : undefined}
          >
            {isReviewed ? "Reviewed. Undo" : "Mark as reviewed"}
          </Button>
          {text && <Badge tone={isReviewed ? "ok" : "warn"}>{isReviewed ? "Reviewed by you" : "Not reviewed yet"}</Badge>}
        </div>
      </div>
    </Card>
  );
}
