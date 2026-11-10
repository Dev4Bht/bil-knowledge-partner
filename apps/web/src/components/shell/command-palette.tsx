"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { listDocuments } from "@/lib/api";
import { isAdmin } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useDebounced } from "@/lib/use-debounced";
import { useAsync } from "@/lib/use-async";
import { DemoBadge, StatusBadge } from "@/components/ui/badge";
import { IconAsk, IconDocs, IconSearch, IconShield } from "@/components/ui/icons";
import { useModal } from "@/components/ui/overlay";

type Item = { id: string; label: string; hint?: string; href: string; kind: "page" | "document"; demo?: boolean; status?: import("@/lib/types").VersionStatus };

export function CommandPaletteTrigger({ onOpen }: { onOpen: () => void }) {
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Search documents and pages"
      aria-keyshortcuts="Control+K Meta+K"
      className="flex min-h-11 flex-1 items-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-left text-[15px] text-muted transition-colors hover:border-line-strong md:min-h-10 md:max-w-md"
    >
      <IconSearch size={18} />
      <span className="flex-1 truncate">Jump to a document or page</span>
      <kbd className="hidden rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[12px] text-muted sm:inline">
        {mac ? "⌘" : "Ctrl"} K
      </kbd>
    </button>
  );
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <PaletteInner onClose={onClose} />;
}

function PaletteInner({ onClose }: { onClose: () => void }) {
  const { user } = useSession();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const debounced = useDebounced(query.trim(), 200);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  useModal(ref, onClose, inputRef);

  const docs = useAsync(`palette:${debounced}`, (signal) => listDocuments({ q: debounced || undefined, page_size: 8 }, signal));

  const items = useMemo<Item[]>(() => {
    const pages: Item[] = [
      { id: "p-ask", label: "Ask a question", hint: "Ask workspace", href: "/ask", kind: "page" },
      { id: "p-docs", label: "Browse documents", hint: "Documents workspace", href: "/documents", kind: "page" },
    ];
    if (isAdmin(user)) pages.push({ id: "p-audit", label: "Audit log", hint: "Admin only", href: "/admin/audit", kind: "page" });
    const q = query.trim().toLowerCase();
    const filteredPages = q ? pages.filter((p) => p.label.toLowerCase().includes(q)) : pages;
    const documents: Item[] = (docs.data?.items ?? []).map((d) => ({
      id: `d-${d.id}`,
      label: d.title,
      hint: `${d.business_line.name} / ${d.folder.path}`,
      href: `/documents/${d.id}`,
      kind: "document",
      demo: d.is_demo_fixture,
      status: (d.current_version ?? d.latest_version)?.status,
    }));
    return [...filteredPages, ...documents];
  }, [user, query, docs.data]);

  const safeActive = Math.min(active, Math.max(items.length - 1, 0));
  const go = (item: Item) => {
    onClose();
    router.push(item.href);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((safeActive + 1) % Math.max(items.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((safeActive - 1 + items.length) % Math.max(items.length, 1));
    } else if (event.key === "Enter" && items[safeActive]) {
      event.preventDefault();
      go(items[safeActive]);
    }
  };

  useEffect(() => {
    document.getElementById(`${listId}-opt-${safeActive}`)?.scrollIntoView({ block: "nearest" });
  }, [safeActive, listId]);

  return createPortal(
    <div className="anim-fade fixed inset-0 z-50 flex items-start justify-center bg-[var(--scrim)] p-3 pt-[10vh] sm:p-6 sm:pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Command palette" tabIndex={-1} className="anim-rise w-full max-w-xl overflow-hidden rounded-[16px] border border-line bg-surface shadow-[var(--shadow-modal)]">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <IconSearch size={20} className="text-muted" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={items[safeActive] ? `${listId}-opt-${safeActive}` : undefined}
            aria-autocomplete="list"
            aria-label="Search documents and pages"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search documents by title, or jump to a page"
            className="h-14 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-muted"
          />
          <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[12px] text-muted">Esc</kbd>
        </div>
        <ul id={listId} role="listbox" aria-label="Results" className="max-h-[50vh] overflow-y-auto p-2">
          {items.map((item, index) => (
            <li
              key={item.id}
              id={`${listId}-opt-${index}`}
              role="option"
              aria-selected={index === safeActive}
              onMouseMove={() => setActive(index)}
              onClick={() => go(item)}
              className={`flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 ${index === safeActive ? "bg-surface-3" : ""}`}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-info-soft text-info">
                {item.kind === "document" ? <IconDocs size={18} /> : item.id === "p-audit" ? <IconShield size={18} /> : item.id === "p-ask" ? <IconAsk size={18} /> : <IconDocs size={18} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-heading">{item.label}</span>
                {item.hint && <span className="block truncate text-[13px] text-muted">{item.hint}</span>}
              </span>
              {item.demo && <DemoBadge />}
              {item.status && <StatusBadge status={item.status} />}
            </li>
          ))}
          {items.length === 0 && (
            <li role="presentation" className="px-3 py-8 text-center text-[15px] text-muted">
              {docs.loading ? "Searching…" : docs.error ? "Documents could not be searched. Try again." : "No documents match. Titles only are searched here."}
            </li>
          )}
        </ul>
        <div className="flex items-center gap-4 border-t border-line bg-surface-2 px-4 py-2 text-[12px] text-muted" aria-hidden="true">
          <span>Up and Down to move</span>
          <span>Enter to open</span>
          <span className="ml-auto" aria-live="polite">{docs.loading ? "Searching…" : ""}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
