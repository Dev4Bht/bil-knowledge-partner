"use client";

import { useQueryStates } from "nuqs";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ApiError, askQuestion, getCapabilities, searchDocuments } from "@/lib/api";
import { BUSINESS_LINES } from "@/lib/format";
import { askFilters, type StatusValue } from "@/lib/filters";
import type { AskResponse, Citation, SearchHit } from "@/lib/types";
import { useAsync } from "@/lib/use-async";
import { useMediaQuery } from "@/lib/use-media-query";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { Field, Select, TextArea } from "@/components/ui/fields";
import { IconAsk, IconSearch, IconSend } from "@/components/ui/icons";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { AnswerView } from "./answer-view";
import { CapabilityNotice, LayoutPreview, readinessOf } from "./capability-notice";
import { CitationChip, CitationDrawer } from "./citation";
import { SearchResults } from "./search-results";
import { Thinking } from "./thinking";

type Turn = { id: number; question: string; state: "loading" | "done" | "failed" | "cancelled"; response?: AskResponse; error?: string };
type Mode = "ask" | "search";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404 || error.status === 405) return "The question service is not available on this server yet.";
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

export function AskPage() {
  const caps = useAsync("capabilities", (signal) => getCapabilities(signal));
  const readiness = readinessOf(caps.data);
  const [filters, setFilters] = useQueryStates(askFilters);
  const { q, businessLine, language, status } = filters;
  const [mode, setMode] = useState<Mode>("ask");
  const [includeHistory, setIncludeHistory] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [openCitation, setOpenCitation] = useState<Citation | null>(null);
  const [submittedSearch, setSubmittedSearch] = useState<{ query: string; nonce: number } | null>(null);
  const counter = useRef(0);
  const controllers = useRef(new Map<number, AbortController>());
  const endRef = useRef<HTMLDivElement>(null);
  const wide = useMediaQuery("(min-width: 1024px)");

  const canAsk = mode === "ask" ? readiness.ready : readiness.search;
  const busy = turns.some((t) => t.state === "loading");

  const search = useAsync(submittedSearch ? `search:${submittedSearch.query}|${businessLine}|${status}|${submittedSearch.nonce}` : null, (signal) =>
    searchDocuments({ query: submittedSearch!.query, business_line: businessLine ?? undefined, status: status ?? undefined }, signal),
  );

  const lastAnswered = [...turns].reverse().find((t) => t.response && t.response.citations.length > 0)?.response;

  useEffect(() => {
    if (turns.length > 0) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [turns.length]);

  const runAsk = async (question: string) => {
    const id = ++counter.current;
    const controller = new AbortController();
    controllers.current.set(id, controller);
    setTurns((list) => [...list, { id, question, state: "loading" }]);
    try {
      // No client-side timeout: a local model needs 30 to 90 seconds. Only the person can cancel.
      const response = await askQuestion(
        {
          question,
          business_line: businessLine ?? undefined,
          language,
          include_history: includeHistory,
          conversation_id: conversationId,
        },
        controller.signal,
      );
      setConversationId(response.conversation_id);
      setTurns((list) => list.map((t) => (t.id === id ? { ...t, state: "done", response } : t)));
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setTurns((list) => list.map((t) => (t.id === id ? { ...t, state: "cancelled" } : t)));
      } else {
        setTurns((list) => list.map((t) => (t.id === id ? { ...t, state: "failed", error: errorMessage(error) } : t)));
      }
    } finally {
      controllers.current.delete(id);
    }
  };

  const cancel = (id: number) => controllers.current.get(id)?.abort();

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const text = q.trim();
    if (!text || !canAsk || busy) return;
    if (mode === "ask") {
      setFilters({ q: null });
      void runAsk(text);
    } else {
      setSubmittedSearch({ query: text, nonce: Date.now() });
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit();
  };

  const hitToCitation = (hit: SearchHit): Citation => ({
    id: hit.id,
    document_id: hit.document_id,
    version_id: hit.version_id,
    title: hit.title,
    folder_path: hit.folder_path,
    version_label: hit.version_label,
    version_status: hit.version_status,
    section: hit.section,
    page: hit.page,
    snippet: hit.snippet,
    url: hit.url,
    is_demo_fixture: !!hit.is_demo_fixture,
  });

  const filtersPanel = (
    <Card className="space-y-4 p-4" aria-label="Filters" role="group">
      <h2 className="font-display text-[17px] font-semibold">Filters</h2>
      <Field label="Business line" htmlFor="ask-line">
        <Select id="ask-line" value={businessLine ?? ""} onChange={(e) => setFilters({ businessLine: (e.target.value || null) as typeof businessLine })}>
          <option value="">All business lines</option>
          {BUSINESS_LINES.map((b) => (
            <option key={b.code} value={b.code}>{b.name}</option>
          ))}
        </Select>
      </Field>
      {mode === "ask" ? (
        <>
          <Field label="Reply language" htmlFor="ask-lang" hint="English is always drafted. Dzongkha drafts always need human validation.">
            <Select id="ask-lang" value={language} onChange={(e) => setFilters({ language: e.target.value as "en" | "dz" })}>
              <option value="en">English</option>
              <option value="dz">Dzongkha (draft)</option>
            </Select>
          </Field>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[15px]">
            <input type="checkbox" className="mt-1 size-4 accent-[var(--navy-soft)]" checked={includeHistory} onChange={(e) => setIncludeHistory(e.target.checked)} />
            <span>
              <span className="font-semibold text-heading">Include older versions</span>
              <span className="block text-[13px] text-muted">Normally only current versions are used. Turn this on to read history.</span>
            </span>
          </label>
        </>
      ) : (
        <Field label="Version status" htmlFor="ask-status">
          <Select id="ask-status" value={status ?? ""} onChange={(e) => setFilters({ status: (e.target.value || null) as StatusValue | null })}>
            <option value="">Any status</option>
            <option value="approved_current">Current</option>
            <option value="superseded">Superseded</option>
            <option value="archived">Archived</option>
          </Select>
        </Field>
      )}
    </Card>
  );

  const sourcesPanel = (
    <Card className="p-4" aria-label="Sources">
      <h2 className="font-display text-[17px] font-semibold">Sources</h2>
      {lastAnswered ? (
        <ol className="mt-3 space-y-2">
          {lastAnswered.citations.map((c, i) => (
            <li key={c.id}>
              <CitationChip citation={c} index={i + 1} onOpen={setOpenCitation} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-1.5 text-[14px] text-muted">Sources for the latest answer will be listed here. Each one opens on the cited page.</p>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-semibold leading-tight md:text-[32px]">Ask BIL Knowledge Partner</h1>
          <p className="mt-1 max-w-2xl text-[15px] text-muted">Describe a real situation. Answers come only from approved documents, with the page they came from.</p>
        </div>
        <Tabs variant="pill" label="Mode" idPrefix="mode" value={mode} onChange={(id) => setMode(id as Mode)} tabs={[{ id: "ask", label: "Ask", icon: <IconAsk size={16} /> }, { id: "search", label: "Search passages", icon: <IconSearch size={16} /> }]} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          {caps.error && (
            <Callout kind="error" title="Could not check what this system can do" actions={<Button size="sm" onClick={caps.reload}>Try again</Button>}>
              {caps.error.message}
            </Callout>
          )}
          {!caps.data && !caps.error && (
            <LoadingRegion label="Checking what is available" className="space-y-3">
              <Skeleton className="h-32" />
            </LoadingRegion>
          )}
          {caps.data && !canAsk && (mode === "ask" || !readiness.search) && <CapabilityNotice caps={caps.data} />}

          {!wide && <details className="rounded-[12px] border border-line bg-surface"><summary className="flex min-h-11 cursor-pointer items-center px-4 text-[15px] font-semibold">Filters</summary><div className="p-3 pt-0">{filtersPanel}</div></details>}

          <form onSubmit={submit} className="space-y-3 rounded-[14px] border border-line bg-surface p-4 shadow-[var(--shadow-md)]" aria-describedby={!canAsk && caps.data ? "ask-disabled-why" : undefined}>
            <label htmlFor="question" className="text-[15px] font-semibold text-heading">
              {mode === "ask" ? "Your question" : "Search the approved documents"}
            </label>
            <TextArea
              id="question"
              value={q}
              onChange={(e) => setFilters({ q: e.target.value || null })}
              onKeyDown={onKeyDown}
              disabled={!canAsk}
              rows={3}
              maxLength={2000}
              placeholder={canAsk ? (mode === "ask" ? "Ask about a real situation, for example the product and what the customer wants to know." : "Words to look for in approved documents") : "Not available yet. See what is missing above."}
              className="resize-y text-[17px]"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p id="ask-disabled-why" className="text-[13px] text-muted">
                {canAsk ? "Press Ctrl+Enter or Cmd+Enter to send. Do not include customer personal data." : "The composer is switched off until the missing pieces are running."}
              </p>
              <Button type="submit" variant="primary" disabled={!canAsk || !q.trim() || busy} loading={busy} icon={<IconSend size={18} />}>
                {mode === "ask" ? "Ask" : "Search"}
              </Button>
            </div>
          </form>

          {caps.data && !canAsk && <LayoutPreview />}

          {mode === "ask" && (
            <div className="space-y-8" aria-live="polite">
              {turns.map((turn, index) => (
                <section key={turn.id} aria-label={`Question ${index + 1}`} className="space-y-3">
                  <div className="flex justify-end">
                    <p className="max-w-[90%] rounded-[14px] rounded-br-sm bg-primary px-4 py-2.5 text-[16px] text-primary-ink">{turn.question}</p>
                  </div>
                  {turn.state === "loading" && (
                    <Thinking onCancel={() => cancel(turn.id)} />
                  )}
                  {turn.state === "cancelled" && (
                    <Callout kind="info" title="You cancelled this question" actions={<Button size="sm" onClick={() => void runAsk(turn.question)}>Ask again</Button>}>
                      Nothing was answered.
                    </Callout>
                  )}
                  {turn.state === "failed" && (
                    <Callout kind="error" title="The question could not be sent" actions={<Button size="sm" onClick={() => void runAsk(turn.question)}>Try again</Button>}>
                      {turn.error}
                    </Callout>
                  )}
                  {turn.state === "done" && turn.response && (
                    <AnswerView response={turn.response} language={language} onOpenCitation={setOpenCitation} onRetry={() => void runAsk(turn.question)} idPrefix={`turn${turn.id}`} />
                  )}
                </section>
              ))}
              <div ref={endRef} />
            </div>
          )}

          {mode === "search" && readiness.search && submittedSearch && (
            search.error ? (
              <Callout kind="error" title="The search failed" actions={<Button size="sm" onClick={search.reload}>Try again</Button>}>
                {errorMessage(search.error)}
              </Callout>
            ) : !search.data ? (
              <LoadingRegion label="Searching" className="space-y-2">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </LoadingRegion>
            ) : (
              <SearchResults data={search.data} onOpen={(hit) => setOpenCitation(hitToCitation(hit))} onFacet={(code) => setFilters({ businessLine: code as typeof businessLine })} activeLine={businessLine} />
            )
          )}
        </div>

        <aside className="space-y-4" aria-label="Filters and sources">
          {wide && filtersPanel}
          {sourcesPanel}
        </aside>
      </div>

      <CitationDrawer citation={openCitation} onClose={() => setOpenCitation(null)} />
    </div>
  );
}
