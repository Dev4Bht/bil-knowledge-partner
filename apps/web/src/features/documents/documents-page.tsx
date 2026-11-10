"use client";

import { useQueryStates } from "nuqs";
import { useMemo, useState } from "react";
import { getFolders, listDocuments } from "@/lib/api";
import { BUSINESS_LINES, STATUS_LABEL, isManager } from "@/lib/format";
import { documentFilters, type StatusValue } from "@/lib/filters";
import { useSession } from "@/lib/session";
import type { Folder } from "@/lib/types";
import { useAsync } from "@/lib/use-async";
import { useDebounced } from "@/lib/use-debounced";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { EmptyState } from "@/components/ui/empty-state";
import { TextInput } from "@/components/ui/fields";
import { IconChevronDown, IconChevronLeft, IconChevronRight, IconDocs, IconFilter, IconSearch, IconUpload } from "@/components/ui/icons";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { useRouter } from "next/navigation";
import { DocumentTable, DocumentTableSkeleton, sortDocuments } from "./document-table";
import { FolderTree } from "./folder-tree";
import { UploadDialog } from "./upload-dialog";
import { LoadingRegion } from "@/components/ui/skeleton";

const PAGE_SIZE = 20;
const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "approved_current", label: STATUS_LABEL.approved_current },
  { id: "draft", label: STATUS_LABEL.draft },
  { id: "superseded", label: STATUS_LABEL.superseded },
  { id: "archived", label: STATUS_LABEL.archived },
];

export function DocumentsPage() {
  const { user } = useSession();
  const router = useRouter();
  const canUpload = isManager(user);
  const [filters, setFilters] = useQueryStates(documentFilters);
  const { q, businessLine, status, folder, page, sort } = filters;
  const [uploadOpen, setUploadOpen] = useState(false);
  const [foldersOpen, setFoldersOpen] = useState(false);

  const debouncedQ = useDebounced(q.trim(), 250);
  const foldersState = useAsync("folders", (signal) => getFolders(signal));
  const folders = useMemo(() => foldersState.data ?? [], [foldersState.data]);
  const visibleFolders = useMemo(() => (businessLine ? folders.filter((f) => f.business_line === businessLine) : folders), [folders, businessLine]);

  const docs = useAsync(`docs:${debouncedQ}|${businessLine}|${status}|${folder}|${page}`, (signal) =>
    listDocuments(
      { q: debouncedQ || undefined, business_line: businessLine ?? undefined, status: status ?? undefined, folder_id: folder ?? undefined, page, page_size: PAGE_SIZE },
      signal,
    ),
  );

  const items = useMemo(() => sortDocuments(docs.data?.items ?? [], sort), [docs.data, sort]);
  const total = docs.data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtersActive = !!(q || businessLine || status || folder);
  const selectedFolder = folders.find((f) => f.id === folder) ?? null;

  const clearFilters = () => setFilters({ q: null, businessLine: null, status: null, folder: null, page: null });
  const setPage = (next: number) => setFilters({ page: next });

  const selectFolder = (f: Folder | null) => setFilters({ folder: f?.id ?? null, businessLine: f ? f.business_line : businessLine, page: null });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-semibold leading-tight md:text-[32px]">Documents</h1>
          <p className="mt-1 text-[15px] text-muted">Approved documents, versions and drafts you are allowed to see.</p>
        </div>
        {canUpload && (
          <Button variant="primary" onClick={() => setUploadOpen(true)} icon={<IconUpload size={18} />}>
            Upload
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-md">
          <IconSearch size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <TextInput
            type="search"
            aria-label="Search document titles"
            placeholder="Search titles and descriptions"
            value={q}
            onChange={(e) => setFilters({ q: e.target.value || null, page: null })}
            className="pl-10"
          />
        </div>
        <Tabs
          variant="pill"
          label="Status"
          idPrefix="status"
          value={status ?? "all"}
          onChange={(id) => setFilters({ status: id === "all" ? null : (id as StatusValue), page: null })}
          tabs={STATUS_TABS}
        />
      </div>

      <Tabs
        label="Business line"
        idPrefix="line"
        value={businessLine ?? "all"}
        onChange={(id) => setFilters({ businessLine: id === "all" ? null : (id as NonNullable<typeof businessLine>), folder: null, page: null })}
        tabs={[{ id: "all", label: "All lines" }, ...BUSINESS_LINES.map((b) => ({ id: b.code, label: b.name }))]}
      />

      <TabPanel id={businessLine ?? "all"} idPrefix="line" active className="grid gap-5 outline-none lg:grid-cols-[260px_minmax(0,1fr)]">
        <div>
          <button
            type="button"
            className="mb-2 flex min-h-11 w-full items-center justify-between rounded-[10px] border border-line bg-surface px-3 text-[15px] font-semibold lg:hidden"
            aria-expanded={foldersOpen}
            aria-controls="folder-panel"
            onClick={() => setFoldersOpen((v) => !v)}
          >
            <span className="flex items-center gap-2">
              <IconFilter size={18} /> Folders{selectedFolder ? `: ${selectedFolder.name}` : ""}
            </span>
            <IconChevronDown size={16} className={foldersOpen ? "rotate-180" : ""} />
          </button>
          <nav id="folder-panel" aria-label="Folders" className={`${foldersOpen ? "block" : "hidden"} rounded-[12px] border border-line bg-surface p-2 lg:block`}>
            {foldersState.loading && !foldersState.data ? (
              <LoadingRegion label="Loading folders" className="space-y-2 p-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-8" />
                ))}
              </LoadingRegion>
            ) : foldersState.error ? (
              <div className="p-2 text-[14px]">
                <p className="text-bad">Folders could not be loaded.</p>
                <button type="button" className="mt-1 font-semibold text-link underline" onClick={foldersState.reload}>
                  Retry
                </button>
              </div>
            ) : (
              <FolderTree key={businessLine ?? "all"} folders={visibleFolders} selectedId={folder} onSelect={selectFolder} businessLine={businessLine} />
            )}
          </nav>
        </div>

        <section aria-label="Document list" className="min-w-0">
          <div className="mb-3 flex min-h-8 flex-wrap items-center justify-between gap-2 text-[14px] text-muted" aria-live="polite">
            <p>
              {docs.loading && !docs.data
                ? "Loading documents…"
                : docs.error
                  ? ""
                  : total === 0
                    ? "No documents"
                    : `Showing ${(page - 1) * PAGE_SIZE + 1} to ${Math.min(page * PAGE_SIZE, total)} of ${total}`}
              {selectedFolder && !docs.error ? ` in ${selectedFolder.path}` : ""}
            </p>
            {filtersActive && (
              <button type="button" onClick={clearFilters} className="font-semibold text-link underline underline-offset-2">
                Clear filters
              </button>
            )}
          </div>

          {docs.error ? (
            <Callout
              kind="error"
              title="Documents could not be loaded"
              actions={
                <Button size="sm" onClick={docs.reload}>
                  Try again
                </Button>
              }
            >
              {docs.error.message}
            </Callout>
          ) : docs.loading && !docs.data ? (
            <LoadingRegion label="Loading documents">
              <DocumentTableSkeleton />
            </LoadingRegion>
          ) : items.length === 0 ? (
            filtersActive ? (
              <EmptyState icon={<IconSearch size={24} />} title="No documents match these filters" action={<Button onClick={clearFilters}>Clear filters</Button>}>
                Try a different search, business line or status. Drafts are only visible to managers and admins.
              </EmptyState>
            ) : (
              <EmptyState
                icon={<IconDocs size={24} />}
                title="Nothing here yet"
                action={canUpload ? <Button variant="primary" onClick={() => setUploadOpen(true)} icon={<IconUpload size={18} />}>Upload a document</Button> : undefined}
              >
                {canUpload ? "Upload the first document. It starts as a draft until you approve it." : "No approved documents are available to you yet. Ask a manager if you expected to see something here."}
              </EmptyState>
            )
          ) : (
            <div className={docs.loading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={docs.loading}>
              <DocumentTable items={items} sort={sort} onSort={(s) => setFilters({ sort: s === "updated" ? null : s })} />
            </div>
          )}

          {total > PAGE_SIZE && !docs.error && (
            <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3">
              <Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} icon={<IconChevronLeft size={16} />}>
                Previous
              </Button>
              <span className="text-[14px] text-muted">
                Page {page} of {lastPage}
              </span>
              <Button size="sm" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>
                Next <IconChevronRight size={16} />
              </Button>
            </nav>
          )}
        </section>
      </TabPanel>

      {canUpload && (
        <UploadDialog
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          target={{ kind: "document", folders, defaultBusinessLine: businessLine, defaultFolderId: folder }}
          onDone={(created) => {
            setUploadOpen(false);
            docs.reload();
            if ("versions" in created) router.push(`/documents/${created.id}`);
          }}
        />
      )}
    </div>
  );
}
