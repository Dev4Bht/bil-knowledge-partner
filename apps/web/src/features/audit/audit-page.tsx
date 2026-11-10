"use client";

import Link from "next/link";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { listAudit } from "@/lib/api";
import { formatDateTime, isAdmin } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { AdminOnly } from "@/components/access-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Select } from "@/components/ui/fields";
import { IconChevronLeft, IconChevronRight, IconShield } from "@/components/ui/icons";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 25;
const EVENTS = ["auth.login", "document.create", "document.view", "file.view", "folder.create", "version.upload", "version.approve", "version.archive"];
const audit = { event: parseAsString, result: parseAsString, page: parseAsInteger.withDefault(1) };

export function AuditPage() {
  const { user } = useSession();
  if (!isAdmin(user)) return <AdminOnly />;
  return <AuditTable />;
}

function AuditTable() {
  const [filters, setFilters] = useQueryStates(audit);
  const { event, result, page } = filters;
  const log = useAsync(`audit:${event}|${result}|${page}`, (signal) =>
    listAudit({ event: event ?? undefined, result: result ?? undefined, page, page_size: PAGE_SIZE }, signal),
  );
  const total = log.data?.total ?? 0;
  const last = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = !!(event || result);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[28px] font-semibold leading-tight md:text-[32px]">Audit log</h1>
        <p className="mt-1 max-w-2xl text-[15px] text-muted">Who did what, and when. It records actions and outcomes only. It never contains question text, passwords or customer data.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Event" htmlFor="audit-event" className="min-w-52">
          <Select id="audit-event" value={event ?? ""} onChange={(e) => setFilters({ event: e.target.value || null, page: null })}>
            <option value="">All events</option>
            {EVENTS.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </Select>
        </Field>
        <Field label="Result" htmlFor="audit-result" className="min-w-40">
          <Select id="audit-result" value={result ?? ""} onChange={(e) => setFilters({ result: e.target.value || null, page: null })}>
            <option value="">All results</option>
            <option value="ok">Succeeded</option>
            <option value="denied">Denied</option>
          </Select>
        </Field>
        {filtered && (
          <Button variant="quiet" onClick={() => setFilters({ event: null, result: null, page: null })}>
            Clear filters
          </Button>
        )}
      </div>

      {log.error ? (
        log.error.status === 403 || log.error.status === 404 ? (
          <AdminOnly />
        ) : (
          <Callout kind="error" title="The audit log could not be loaded" actions={<Button size="sm" onClick={log.reload}>Try again</Button>}>
            {log.error.message}
          </Callout>
        )
      ) : !log.data ? (
        <LoadingRegion label="Loading audit log" className="space-y-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </LoadingRegion>
      ) : log.data.items.length === 0 ? (
        <EmptyState icon={<IconShield size={24} />} title="No events match" action={filtered ? <Button onClick={() => setFilters({ event: null, result: null, page: null })}>Clear filters</Button> : undefined}>
          {filtered ? "Try a different event or result." : "Nothing has been recorded yet."}
        </EmptyState>
      ) : (
        <div className={log.loading ? "opacity-60" : ""}>
          <div className="overflow-hidden rounded-[12px] border border-line bg-surface shadow-[var(--shadow-card)]">
            <table className="w-full border-collapse text-[14px]">
              <caption className="sr-only">Audit events, newest first</caption>
              <thead className="hidden border-b border-line bg-surface-2 text-[12px] uppercase tracking-wide text-muted md:table-header-group">
                <tr>
                  {["When", "Who", "Event", "Resource", "Result"].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2.5 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {log.data.items.map((item) => (
                  <tr key={item.id} className="block px-4 py-3 md:table-row md:px-0 md:py-0">
                    <td className="tabular block whitespace-nowrap text-muted md:table-cell md:px-3 md:py-3">{formatDateTime(item.created_at)}</td>
                    <td className="block font-semibold text-heading md:table-cell md:px-3 md:py-3">{item.actor ?? "Unknown or signed out"}</td>
                    <td className="block md:table-cell md:px-3 md:py-3"><code className="rounded bg-surface-3 px-1.5 py-0.5 text-[13px]">{item.event}</code></td>
                    <td className="block break-all text-muted md:table-cell md:px-3 md:py-3">
                      {item.resource_type}
                      {item.resource_id && item.resource_type === "document" ? (
                        <Link href={`/documents/${item.resource_id}`} className="ml-1.5 font-mono text-[12px] text-link underline">{item.resource_id.slice(0, 8)}</Link>
                      ) : item.resource_id ? (
                        <span className="ml-1.5 font-mono text-[12px]">{item.resource_id.slice(0, 8)}</span>
                      ) : null}
                    </td>
                    <td className="mt-1 block md:table-cell md:px-3 md:py-3">
                      <Badge tone={item.result === "ok" ? "ok" : "bad"}>{item.result === "ok" ? "Succeeded" : item.result === "denied" ? "Denied" : item.result}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3">
            <Button size="sm" disabled={page <= 1} onClick={() => setFilters({ page: page - 1 })} icon={<IconChevronLeft size={16} />}>Previous</Button>
            <span className="text-[14px] text-muted" aria-live="polite">Page {page} of {last}, {total} events</span>
            <Button size="sm" disabled={page >= last} onClick={() => setFilters({ page: page + 1 })}>Next <IconChevronRight size={16} /></Button>
          </nav>
        </div>
      )}
    </div>
  );
}
