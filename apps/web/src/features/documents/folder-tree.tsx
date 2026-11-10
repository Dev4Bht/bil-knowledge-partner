"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { cn, businessLineName } from "@/lib/format";
import type { BusinessLineCode, Folder } from "@/lib/types";
import { IconChevronDown, IconChevronRight, IconFolder, IconLock } from "@/components/ui/icons";

type Node = { folder: Folder; depth: number; hasChildren: boolean };

/** Flattens the visible part of the tree in display order. Expanded state decides which children appear. */
export function flattenTree(folders: Folder[], expanded: Set<string>): Node[] {
  const children = new Map<string | null, Folder[]>();
  const ids = new Set(folders.map((f) => f.id));
  for (const folder of folders) {
    // A folder whose parent is hidden from this user becomes a root, so nothing is orphaned.
    const parent = folder.parent_id && ids.has(folder.parent_id) ? folder.parent_id : null;
    children.set(parent, [...(children.get(parent) ?? []), folder]);
  }
  const out: Node[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const folder of (children.get(parent) ?? []).sort((a, b) => a.name.localeCompare(b.name))) {
      const kids = children.get(folder.id) ?? [];
      out.push({ folder, depth, hasChildren: kids.length > 0 });
      if (kids.length > 0 && expanded.has(folder.id)) walk(folder.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export function FolderTree({ folders, selectedId, onSelect, businessLine }: {
  folders: Folder[];
  selectedId: string | null;
  onSelect: (folder: Folder | null) => void;
  businessLine: BusinessLineCode | null;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(folders.filter((f) => !f.parent_id).map((f) => f.id)));
  const [focusId, setFocusId] = useState<string | null>(null);

  const groups = useMemo(() => {
    if (businessLine) return [{ code: businessLine, folders: folders.filter((f) => f.business_line === businessLine) }];
    const codes = Array.from(new Set(folders.map((f) => f.business_line)));
    return codes.map((code) => ({ code, folders: folders.filter((f) => f.business_line === code) }));
  }, [folders, businessLine]);

  const visible = useMemo(() => groups.flatMap((g) => flattenTree(g.folders, expanded)), [groups, expanded]);
  const tabbableId = visible.find((n) => n.folder.id === focusId)?.folder.id ?? visible.find((n) => n.folder.id === selectedId)?.folder.id ?? visible[0]?.folder.id;

  const toggle = (id: string, open?: boolean) =>
    setExpanded((cur) => {
      const next = new Set(cur);
      if (open ?? !next.has(id)) next.add(id);
      else next.delete(id);
      return next;
    });

  const focusNode = (id: string) => {
    setFocusId(id);
    requestAnimationFrame(() => document.getElementById(`ft-${id}`)?.focus());
  };

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const node = visible[index];
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (visible[index + 1]) focusNode(visible[index + 1].folder.id);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (visible[index - 1]) focusNode(visible[index - 1].folder.id);
        break;
      case "ArrowRight":
        event.preventDefault();
        if (node.hasChildren && !expanded.has(node.folder.id)) toggle(node.folder.id, true);
        else if (visible[index + 1]?.depth > node.depth) focusNode(visible[index + 1].folder.id);
        break;
      case "ArrowLeft":
        event.preventDefault();
        if (node.hasChildren && expanded.has(node.folder.id)) toggle(node.folder.id, false);
        else {
          const parent = [...visible.slice(0, index)].reverse().find((n) => n.depth < node.depth);
          if (parent) focusNode(parent.folder.id);
        }
        break;
      case "Home":
        event.preventDefault();
        focusNode(visible[0].folder.id);
        break;
      case "End":
        event.preventDefault();
        focusNode(visible[visible.length - 1].folder.id);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        onSelect(selectedId === node.folder.id ? null : node.folder);
        break;
    }
  };

  if (folders.length === 0) return <p className="px-2 py-3 text-[14px] text-muted">No folders to show.</p>;

  let index = -1;
  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-pressed={selectedId === null}
        className={cn(
          "mb-1 flex min-h-11 w-full items-center gap-2 rounded-[8px] px-2.5 text-[15px] font-semibold md:min-h-9",
          selectedId === null ? "bg-info-soft text-heading" : "text-ink hover:bg-surface-3",
        )}
      >
        <IconFolder size={18} />
        All folders
      </button>
      {groups.map((group) => (
        <div key={group.code} className="mt-2">
          {!businessLine && <p className="px-2.5 pb-1 pt-2 text-[12px] font-bold uppercase tracking-wider text-muted">{businessLineName(group.code)}</p>}
          <ul role="tree" aria-label={`${businessLineName(group.code)} folders`}>
            {flattenTree(group.folders, expanded).map((node) => {
              index += 1;
              const i = index;
              const selected = selectedId === node.folder.id;
              const isOpen = expanded.has(node.folder.id);
              return (
                <li key={node.folder.id} role="none">
                  <div
                    id={`ft-${node.folder.id}`}
                    role="treeitem"
                    aria-selected={selected}
                    aria-expanded={node.hasChildren ? isOpen : undefined}
                    aria-level={node.depth + 1}
                    tabIndex={tabbableId === node.folder.id ? 0 : -1}
                    onKeyDown={(e) => onKeyDown(e, i)}
                    onFocus={() => setFocusId(node.folder.id)}
                    onClick={() => onSelect(selected ? null : node.folder)}
                    style={{ paddingLeft: 8 + node.depth * 16 }}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-1.5 rounded-[8px] pr-2 text-[15px] md:min-h-9",
                      selected ? "bg-info-soft font-semibold text-heading ring-1 ring-info/30" : "text-ink hover:bg-surface-3",
                    )}
                  >
                    {node.hasChildren ? (
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-label={`${isOpen ? "Collapse" : "Expand"} ${node.folder.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(node.folder.id);
                        }}
                        className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted hover:bg-black/5"
                      >
                        {isOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                      </button>
                    ) : (
                      <span className="size-6 shrink-0" />
                    )}
                    <IconFolder size={16} className="shrink-0 text-gold" />
                    <span className="min-w-0 flex-1 truncate">{node.folder.name}</span>
                    {node.folder.required_role && (
                      <span title={`${node.folder.required_role} only`} className="shrink-0 text-muted">
                        <IconLock size={14} />
                        <span className="sr-only">{node.folder.required_role} only</span>
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
