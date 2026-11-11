"use client";

import Link from "next/link";
import { useQueryStates } from "nuqs";
import { getCapabilities, getDashboard } from "@/lib/api";
import { DASHBOARD_DAYS, dashboardFilters } from "@/lib/filters";
import { STATUS_LABEL, businessLineName, formatDateTime, isManager } from "@/lib/format";
import type { CountItem, VersionStatus } from "@/lib/types";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { AdminOnly } from "@/components/access-notice";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/fields";
import { IconAlert, IconCheck } from "@/components/ui/icons";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";
import { BarList, DayColumns, StatTile } from "./charts";

const OUTCOME_LABEL: Record<string, { label: string; hint: string }> = {
  answered: { label: "Answered", hint: "Answered from approved documents, with citations" },
  no_evidence: { label: "No evidence", hint: "The documents do not support an answer, so none was given" },
  conflict: { label: "Conflict", hint: "Current documents disagree; sent to the owning team" },
  needs_clarification: { label: "Needed a clearer question", hint: "The assistant asked the person to clarify" },
  model_unavailable: { label: "Model unavailable", hint: "Sources were shown but the language model was down" },
};
const JOB_LABEL: Record<string, string> = { queued: "Waiting", processing: "Indexing now", indexed: "Indexed", failed: "Failed" };

const count = (items: CountItem[], key: string) => items.find((i) => i.key === key)?.count ?? 0;

export function DashboardPage() {
  const { user } = useSession();
  if (!isManager(user)) return <AdminOnly />;
  return <DashboardView />;
}

function Panel({ title, note, children, className }: { title: string; note?: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`p-5 ${className ?? ""}`}>
      <h2 className="font-display text-[20px] font-semibold text-heading">{title}</h2>
      {note && <p className="mb-4 mt-0.5 text-[14px] text-muted">{note}</p>}
      {!note && <div className="mb-3" />}
      {children}
    </Card>
  );
}

function DashboardView() {
  const [{ days }, setFilters] = useQueryStates(dashboardFilters);
  const data = useAsync(`dashboard:${days}`, (signal) => getDashboard(Number(days), signal));
  const caps = useAsync("dashboard:caps", (signal) => getCapabilities(signal));
  const d = data.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-semibold leading-tight md:text-[32px]">Dashboard</h1>
          <p className="mt-1 max-w-2xl text-[15px] text-muted">
            How the knowledge base and the assistant are doing. These are counts only: no question text, document titles or names appear here.
          </p>
        </div>
        <Field label="Period" htmlFor="dash-days" className="w-44">
          <Select id="dash-days" value={days} onChange={(e) => setFilters({ days: e.target.value as (typeof DASHBOARD_DAYS)[number] })}>
            {DASHBOARD_DAYS.map((v) => (
              <option key={v} value={v}>Last {v} days</option>
            ))}
          </Select>
        </Field>
      </div>

      {data.error ? (
        data.error.status === 403 || data.error.status === 404 ? (
          <AdminOnly />
        ) : (
          <Callout kind="error" title="The dashboard could not be loaded" actions={<Button size="sm" onClick={data.reload}>Try again</Button>}>
            {data.error.message}
          </Callout>
        )
      ) : !d ? (
        <LoadingRegion label="Loading dashboard" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
          <Skeleton className="h-64" />
        </LoadingRegion>
      ) : (
        <>
          {count(d.indexing.jobs, "failed") > 0 && (
            <Callout
              kind="error"
              title={`${count(d.indexing.jobs, "failed")} document ${count(d.indexing.jobs, "failed") === 1 ? "version" : "versions"} failed to index`}
              actions={<Link href="/documents" className={buttonClasses("secondary", "sm")}>Open documents</Link>}
            >
              Failed versions cannot be found by search or cited in answers. A common cause is a scanned PDF with no readable text (OCR is not available) or a page that only links elsewhere; open the document to see the reason, and upload a text version if needed.
            </Callout>
          )}

          <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Documents" value={d.documents.documents} note={`${count(d.documents.by_status, "approved_current")} current ${count(d.documents.by_status, "approved_current") === 1 ? "version" : "versions"}`} />
            <StatTile label="Awaiting approval" value={d.documents.awaiting_approval} note="Drafts nobody can search yet" />
            <StatTile label="Searchable passages" value={d.indexing.indexed_passages.toLocaleString("en-GB")} note={d.indexing.average_duration_ms === null ? undefined : `About ${Math.max(1, Math.round(d.indexing.average_duration_ms / 1000))} s to index a version`} />
            <StatTile label={`Questions, ${d.activity.days} days`} value={d.activity.questions} note={`${d.activity.active_people} ${d.activity.active_people === 1 ? "person" : "people"} signed in`} />
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="How questions ended" note="Declining to answer when the documents do not say is the intended behaviour, not a failure.">
              <BarList
                ariaLabel="Question outcomes"
                emptyText="No questions in this period yet."
                rows={d.activity.outcomes.map((o) => ({ key: o.key, label: OUTCOME_LABEL[o.key]?.label ?? o.key, hint: OUTCOME_LABEL[o.key]?.hint, count: o.count }))}
              />
              {d.activity.with_version_warnings > 0 && (
                <p className="mt-4 text-[14px] text-muted">
                  <strong className="text-heading">{d.activity.with_version_warnings}</strong> of these showed a version notice, such as an older version being ignored.
                </p>
              )}
            </Panel>

            <Panel title="Questions per day" note="One column per day, oldest first.">
              <DayColumns points={d.activity.per_day} />
            </Panel>

            <Panel title="Current documents by business line" note="Documents that have an approved current version.">
              <BarList
                ariaLabel="Documents by business line"
                emptyText="No approved documents yet."
                rows={d.documents.by_business_line.map((b) => ({ key: b.key, label: businessLineName(b.key), count: b.count }))}
              />
            </Panel>

            <Panel title="Versions by status" note="Only approved current versions are used to answer questions.">
              <BarList
                ariaLabel="Versions by status"
                emptyText="No documents yet."
                rows={d.documents.by_status.map((s) => ({ key: s.key, label: STATUS_LABEL[s.key as VersionStatus] ?? s.key, count: s.count }))}
              />
            </Panel>

            <Panel title="Indexing" note="Each uploaded version is read, split into passages and made searchable.">
              <ul className="space-y-2 text-[15px]">
                {d.indexing.jobs.map((j) => (
                  <li key={j.key} className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-0 last:pb-0">
                    <span>{JOB_LABEL[j.key] ?? j.key}</span>
                    <span className="flex items-center gap-2">
                      {j.key === "failed" && j.count > 0 && <Badge tone="bad" icon={<IconAlert size={12} />}>Needs attention</Badge>}
                      {j.key === "indexed" && j.count > 0 && <Badge tone="ok" icon={<IconCheck size={12} />}>Ready</Badge>}
                      <span className="w-10 text-right font-semibold tabular-nums text-heading">{j.count}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Access and use" note={`Last ${d.activity.days} days.`}>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[15px]">
                <div><dt className="text-muted">Searches</dt><dd className="font-display text-[24px] font-semibold tabular-nums text-heading">{d.activity.searches}</dd></div>
                <div><dt className="text-muted">Refused requests</dt><dd className="font-display text-[24px] font-semibold tabular-nums text-heading">{d.activity.denied}</dd></div>
              </dl>
              <p className="mt-3 text-[14px] text-muted">A refused request is someone trying to open something their role does not allow. The audit log lists them.</p>
            </Panel>
          </div>

          <Panel title="Assistant status" note="What this server can do right now.">
            {caps.data ? (
              <ul className="flex flex-wrap gap-2 text-[15px]">
                <li><Badge tone={caps.data.llm ? "ok" : "warn"}>{caps.data.llm ? `Answering on (${caps.data.llm_model ?? "local model"})` : "Answering off: sources only"}</Badge></li>
                <li><Badge tone={caps.data.search ? "ok" : "warn"}>{caps.data.search ? "Search on" : "Search off"}</Badge></li>
                <li><Badge tone={caps.data.translation ? "ok" : "neutral"}>{caps.data.translation ? "Dzongkha draft on (experimental)" : "Dzongkha draft off"}</Badge></li>
              </ul>
            ) : caps.error ? (
              <p className="text-[15px] text-muted">Status is unavailable right now.</p>
            ) : (
              <Skeleton className="h-6 w-64" />
            )}
          </Panel>

          <p className="text-[13px] text-muted">
            Updated {formatDateTime(d.generated_at)}.
            {d.documents.demo_fixtures > 0 && ` ${d.documents.demo_fixtures} of the documents are labelled fictional test fixtures, not BIL content.`}
          </p>
        </>
      )}
    </div>
  );
}
