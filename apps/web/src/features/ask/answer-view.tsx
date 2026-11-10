"use client";

import Link from "next/link";
import { useState } from "react";
import type { AskResponse, Citation, VersionWarning } from "@/lib/types";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { IconChevronDown, IconDocs, IconRefresh } from "@/components/ui/icons";
import { CitationChip } from "./citation";
import { DraftCard } from "./draft-card";

const WARNING_COPY: Record<VersionWarning["kind"], { kind: "info" | "warning" | "conflict"; title: string }> = {
  conflict: { kind: "conflict", title: "Conflict between current documents" },
  older_version_ignored: { kind: "info", title: "An older version was ignored" },
  draft_excluded: { kind: "info", title: "Draft versions were left out" },
  history_included: { kind: "warning", title: "Older versions were included" },
};

export function VersionNotices({ warnings, citations }: { warnings: VersionWarning[]; citations: Citation[] }) {
  const current = citations.filter((c) => c.version_status === "approved_current");
  const seen = new Set<string>();
  const basedOn = current.filter((c) => (seen.has(c.version_id) ? false : (seen.add(c.version_id), true)));
  if (warnings.length === 0 && basedOn.length === 0) return null;
  return (
    <div className="space-y-2.5" aria-label="Version notices" role="region">
      {basedOn.length > 0 && (
        <Callout kind="success" title="Based on current versions">
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {basedOn.map((c) => (
              <li key={c.version_id} className="flex items-center gap-1.5">
                {c.title} <strong>{c.version_label}</strong> <StatusBadge status={c.version_status} />
              </li>
            ))}
          </ul>
        </Callout>
      )}
      {[...warnings].sort((a, b) => Number(b.kind === "conflict") - Number(a.kind === "conflict")).map((w, i) => {
        const copy = WARNING_COPY[w.kind];
        return (
          <Callout key={`${w.kind}-${i}`} kind={copy.kind} title={copy.title}>
            {w.message}
            {w.kind === "conflict" && <p className="mt-1.5 font-semibold">Both are current. Do not pick one yourself: escalate to the team that owns the policy.</p>}
          </Callout>
        );
      })}
    </div>
  );
}


function Steps({ response, idPrefix }: { response: AskResponse; idPrefix: string }) {
  const [open, setOpen] = useState(false);
  if (response.steps.length === 0) return null;
  return (
    <div className="rounded-[10px] border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${idPrefix}-steps`}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-2 px-4 text-left text-[15px] font-semibold text-heading"
      >
        How this answer was made
        <IconChevronDown size={18} className={open ? "rotate-180" : ""} />
      </button>
      {open && (
        <ol id={`${idPrefix}-steps`} className="space-y-2 border-t border-line px-4 py-3">
          {response.steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-[14px]">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[11px] font-bold text-muted">{i + 1}</span>
              <span>
                <span className="font-semibold text-heading">{s.agent}</span>
                <span className="text-muted">: {s.summary}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function AnswerView({ response, language, onOpenCitation, onRetry, idPrefix }: {
  response: AskResponse;
  language: "en" | "dz";
  onOpenCitation: (c: Citation) => void;
  onRetry: () => void;
  idPrefix: string;
}) {
  const byId = new Map(response.citations.map((c, i) => [c.id, { c, n: i + 1 }]));
  const hasDrafts = !!(response.drafts.en || response.drafts.dzo);

  if (response.status === "model_unavailable" || response.status === "error") {
    return (
      <div className="space-y-3">
        <Callout
          kind={response.status === "error" ? "error" : "warning"}
          title={response.status === "error" ? "The question could not be answered" : "The language model is not available right now"}
          actions={<Button size="sm" onClick={onRetry} icon={<IconRefresh size={16} />}>Try again</Button>}
        >
          {response.abstention_reason ?? "Nothing was answered and nothing was guessed. Try again in a moment, or look in the documents directly."}
        </Callout>
        {response.citations.length > 0 && (
          <Card className="p-4" data-testid="fallback-passages">
            <h3 className="font-display text-[17px] font-semibold">Most relevant passages</h3>
            <p className="text-[13px] text-muted">Found by search. They are not an answer.</p>
            <ol className="mt-3 space-y-3">
              {response.citations.map((c, i) => (
                <li key={c.id} className="space-y-1">
                  <CitationChip citation={c} index={i + 1} onOpen={onOpenCitation} />
                  <p className="text-[14.5px] leading-relaxed text-ink">{c.snippet}</p>
                </li>
              ))}
            </ol>
          </Card>
        )}
        <Steps response={response} idPrefix={idPrefix} />
      </div>
    );
  }

  if (response.status === "needs_clarification") {
    return (
      <Callout kind="info" title="One more detail is needed before this can be answered">
        <p className="text-[16px] font-semibold text-heading">{response.abstention_reason ?? "Please add more detail to the question."}</p>
        <p className="mt-1 text-muted">Add it to your question and ask again. Nothing has been guessed.</p>
      </Callout>
    );
  }

  if (response.status === "conflict") {
    return (
      <div className="space-y-4" data-testid="conflict">
        <VersionNotices warnings={response.version_warnings} citations={response.citations} />
        <Callout kind="conflict" title="The current documents disagree. No answer or draft is given.">
          <p className="text-[16px] font-semibold text-heading">{response.abstention_reason ?? "Escalate to the team that owns the policy."}</p>
          {response.citations.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {response.citations.map((c, i) => (
                <CitationChip key={c.id} citation={c} index={i + 1} onOpen={onOpenCitation} />
              ))}
            </div>
          )}
        </Callout>
        <Steps response={response} idPrefix={idPrefix} />
      </div>
    );
  }

  if (response.status === "no_evidence") {
    return (
      <Card className="space-y-3 p-5" data-testid="no-evidence">
        <h3 className="font-display text-[20px] font-semibold">
          {response.version_warnings.some((w) => w.kind === "conflict") ? "No single answer: the current documents conflict" : "The approved documents do not answer this"}
        </h3>
        <p className="text-[15px] text-ink">{response.abstention_reason ?? "No approved, current document covers this question, so no answer is given. Nothing has been guessed."}</p>
        <VersionNotices warnings={response.version_warnings} citations={response.citations} />
        <p className="text-[15px] text-muted">Ask the team that owns this topic, or browse the documents yourself.</p>
        <Link href="/documents" className={buttonClasses("secondary", "sm", "w-fit")}>
          <IconDocs size={16} /> Browse documents
        </Link>
        <Steps response={response} idPrefix={idPrefix} />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <VersionNotices warnings={response.version_warnings} citations={response.citations} />

      {(response.answer || response.claims.length > 0 || response.citations.length > 0) && (
      <Card className="p-5" aria-labelledby={`${idPrefix}-answer-h`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={`${idPrefix}-answer-h`} className="font-display text-[20px] font-semibold">Answer</h3>
          {response.needs_human_review && <Badge tone="warn">Review before use</Badge>}
        </div>
        {response.answer && !(response.claims.length > 0 && response.claims.every((c) => response.answer!.includes(c.text))) && (
          <p className="mt-2 text-[17px] leading-relaxed text-ink">{response.answer}</p>
        )}
        {response.claims.length > 0 && (
          <ul className={`space-y-3 ${response.answer && !response.claims.every((c) => response.answer!.includes(c.text)) ? "mt-4 border-t border-line pt-4" : "mt-3"}`} aria-label="Claims and their sources">
            {response.claims.map((claim, i) => (
              <li key={i} className="text-[15.5px] leading-relaxed text-ink">
                <span>{claim.text}</span>{" "}
                <span className="mt-1 flex min-w-0 flex-wrap gap-1.5">
                  {claim.citation_ids.map((id) => {
                    const hit = byId.get(id);
                    return hit ? <CitationChip key={id} citation={hit.c} index={hit.n} onOpen={onOpenCitation} /> : null;
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
        {response.caveats && response.caveats.length > 0 && (
          <Callout kind="info" title="A rule in the documents is not a decision on this customer's case" className="mt-4">
            <ul className="space-y-1 text-[14px]">
              {response.caveats.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </Callout>
        )}
        {response.claims.length === 0 && response.citations.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-4">
            {response.citations.map((c, i) => (
              <CitationChip key={c.id} citation={c} index={i + 1} onOpen={onOpenCitation} />
            ))}
          </div>
        )}
      </Card>
      )}

      {hasDrafts && <DraftCard drafts={response.drafts} notes={response.draft_notes} preferred={language} idPrefix={idPrefix} />}

      <Steps response={response} idPrefix={idPrefix} />
    </div>
  );
}
