"use client";

import Link from "next/link";
import { useQueryState, parseAsString } from "nuqs";
import { useMemo, useState } from "react";
import { approveVersion, archiveVersion, ApiError, getDocument } from "@/lib/api";
import { isManager } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { DocumentDetail, DocVersion, VersionStatus } from "@/lib/types";
import { useAsync } from "@/lib/use-async";
import { NotAvailable } from "@/components/access-notice";
import { Crumb } from "@/components/shell/crumb";
import { Badge, ClassificationBadge, DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { IconChevronLeft, IconDiff, IconDocs, IconEye, IconFolder, IconList, IconRefresh, IconUpload } from "@/components/ui/icons";
import { Dialog } from "@/components/ui/overlay";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { ComparePanel } from "./compare-panel";
import { DetailsPanel } from "./details-panel";
import { IndexingPanel } from "./indexing-panel";
import { PreviewPanel } from "./preview-panel";
import { UploadDialog } from "./upload-dialog";
import { describeApproval, VersionTimeline } from "./version-timeline";

const TABS = [
  { id: "preview", label: "Preview", icon: <IconEye size={16} /> },
  { id: "compare", label: "Compare", icon: <IconDiff size={16} /> },
  { id: "details", label: "Details", icon: <IconList size={16} /> },
  { id: "indexing", label: "Indexing", icon: <IconRefresh size={16} /> },
];

type Pending = { kind: "approve" | "archive"; version: DocVersion } | null;

export function DocumentDetailSkeleton() {
  return (
    <LoadingRegion label="Loading document" className="space-y-5">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-9 w-2/3" />
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <Skeleton className="h-72" />
        <Skeleton className="h-96" />
      </div>
    </LoadingRegion>
  );
}

export function DocumentDetailPage({ documentId }: { documentId: string }) {
  const { user } = useSession();
  const toast = useToast();
  const canManage = isManager(user);
  const doc = useAsync(`doc:${documentId}`, (signal) => getDocument(documentId, signal));
  const [tab, setTab] = useQueryState("tab", parseAsString.withDefault("preview"));
  const [versionParam, setVersionParam] = useQueryState("version", parseAsString);
  const [pageParam] = useQueryState("page", parseAsString);
  const [pending, setPending] = useState<Pending>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  // Optimistic status overrides apply only to the data object they were made against, so a reload clears them.
  const [optimistic, setOptimistic] = useState<{ base: DocumentDetail; map: Record<string, VersionStatus> } | null>(null);

  const data = doc.data;
  const versions = useMemo<DocVersion[]>(() => {
    if (!data) return [];
    const map = optimistic && optimistic.base === data ? optimistic.map : {};
    return [...data.versions].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((v) => (map[v.id] ? { ...v, status: map[v.id] } : v));
  }, [data, optimistic]);

  if (doc.error) {
    if (doc.error.status === 404 || doc.error.status === 403) return <NotAvailable />;
    return (
      <div className="mx-auto max-w-xl py-8">
        <Callout kind="error" title="The document could not be loaded" actions={<Button size="sm" onClick={doc.reload}>Try again</Button>}>
          {doc.error.message}
        </Callout>
      </div>
    );
  }
  if (!data) return <DocumentDetailSkeleton />;

  const current = versions.find((v) => v.status === "approved_current") ?? null;
  const selected = versions.find((v) => v.id === versionParam) ?? current ?? versions[0] ?? null;
  const pageNumber = pageParam && /^\d+$/.test(pageParam) ? Number(pageParam) : undefined;

  const runMutation = async (kind: "approve" | "archive", version: DocVersion) => {
    setPending(null);
    setBusyId(version.id);
    const map: Record<string, VersionStatus> = {};
    if (kind === "approve") {
      map[version.id] = "approved_current";
      if (current) map[current.id] = "superseded";
    } else map[version.id] = "archived";
    setOptimistic({ base: data, map });
    try {
      if (kind === "approve") await approveVersion(data.id, version.id);
      else await archiveVersion(data.id, version.id);
      toast({ tone: "success", title: kind === "approve" ? `${version.version_label} is now the current version` : `${version.version_label} archived` });
    } catch (error) {
      setOptimistic(null); // roll back
      toast({ tone: "error", title: kind === "approve" ? "Could not approve" : "Could not archive", description: error instanceof ApiError ? error.message : "Please try again." });
    } finally {
      setBusyId(null);
      doc.reload();
    }
  };

  return (
    <div className="space-y-6">
      <Crumb label={data.title} />
      <div>
        <Link href="/documents" className="mb-2 inline-flex min-h-9 items-center gap-1 text-[14px] font-semibold text-link hover:underline">
          <IconChevronLeft size={16} /> All documents
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-[26px] font-semibold leading-tight md:text-[32px]">{data.title}</h1>
              {data.is_demo_fixture && <DemoBadge />}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[14px] text-muted">
              <span className="inline-flex items-center gap-1.5"><IconDocs size={16} />{data.business_line.name}</span>
              <span className="inline-flex items-center gap-1.5"><IconFolder size={16} />{data.folder.path}</span>
              <ClassificationBadge value={data.access_classification} />
              <span>Owner: {data.owner ?? "Not set"}</span>
            </div>
            {data.description && <p className="mt-2 max-w-3xl text-[15px] text-ink">{data.description}</p>}
          </div>
          {canManage && (
            <Button variant="primary" icon={<IconUpload size={18} />} onClick={() => setUploadOpen(true)}>
              Upload new version
            </Button>
          )}
        </div>
      </div>

      {!current && (
        <Callout kind="warning" title="This document has no current version">
          {canManage ? "Approve a draft to make it current. Until then staff cannot use this document." : "No version has been approved yet."}
        </Callout>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,390px)_minmax(0,1fr)]">
        <section aria-labelledby="timeline-heading">
          <h2 id="timeline-heading" className="mb-3 font-display text-[20px] font-semibold">
            Versions <span className="ml-1 text-[15px] font-normal text-muted">({versions.length})</span>
          </h2>
          <VersionTimeline
            versions={versions}
            selectedId={selected?.id ?? null}
            onSelect={(id) => {
              setVersionParam(id);
              setTab("preview");
            }}
            canManage={canManage}
            onApprove={(v) => setPending({ kind: "approve", version: v })}
            onArchive={(v) => setPending({ kind: "archive", version: v })}
            busyId={busyId}
          />
        </section>

        <section aria-label="Document content" className="min-w-0 rounded-[10px] border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
          <Tabs tabs={TABS} value={tab} onChange={setTab} label="Document views" idPrefix="doc" />
          <div className="pt-4">
            <TabPanel id="preview" idPrefix="doc" active={tab === "preview"} className="outline-none">
              {selected && <PreviewPanel key={selected.id} documentId={data.id} version={selected} page={pageNumber} />}
            </TabPanel>
            <TabPanel id="compare" idPrefix="doc" active={tab === "compare"} className="outline-none">
              <ComparePanel key={versions.map((v) => v.id).join()} documentId={data.id} versions={versions} />
            </TabPanel>
            <TabPanel id="details" idPrefix="doc" active={tab === "details"} className="outline-none">
              {selected && <DetailsPanel doc={data} version={selected} />}
            </TabPanel>
            <TabPanel id="indexing" idPrefix="doc" active={tab === "indexing"} className="outline-none">
              <IndexingPanel versions={versions} />
            </TabPanel>
          </div>
        </section>
      </div>

      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        size="sm"
        title={pending?.kind === "approve" ? `Approve ${pending.version.version_label} as current?` : `Archive ${pending?.version.version_label}?`}
        footer={
          <>
            <Button onClick={() => setPending(null)}>Cancel</Button>
            {pending && (
              <Button variant={pending.kind === "approve" ? "primary" : "danger"} onClick={() => runMutation(pending.kind, pending.version)}>
                {pending.kind === "approve" ? `Approve ${pending.version.version_label}` : `Archive ${pending.version.version_label}`}
              </Button>
            )}
          </>
        }
      >
        {pending?.kind === "approve" && (
          <div className="space-y-3">
            <p className="text-[15px] text-ink">This is what will change:</p>
            <ul className="space-y-2">
              {describeApproval(versions, pending.version).map((line) => (
                <li key={line} className="flex gap-2 text-[15px] text-ink">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}
        {pending?.kind === "archive" && (
          <div className="space-y-3 text-[15px] text-ink">
            <p>
              {pending.version.version_label} will be kept for history but marked <Badge>Archived</Badge>. It cannot be approved again.
            </p>
            {pending.version.status === "approved_current" && (
              <Callout kind="warning" title="This is the current version">
                Archiving it leaves the document with no current version until another draft is approved.
              </Callout>
            )}
          </div>
        )}
      </Dialog>

      {canManage && (
        <UploadDialog
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          target={{ kind: "version", documentId: data.id, documentTitle: data.title }}
          onDone={() => {
            setUploadOpen(false);
            doc.reload();
          }}
        />
      )}
      <div className="sr-only" aria-live="polite">
        {current ? `Current version is ${current.version_label}` : "No current version"}
      </div>
    </div>
  );
}
