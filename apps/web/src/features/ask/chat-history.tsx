"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { ApiError, deleteAllConversations, deleteConversation, listConversations, renameConversation } from "@/lib/api";
import { cn, relativeTime } from "@/lib/format";
import type { ConversationSummary } from "@/lib/types";
import { useAsync } from "@/lib/use-async";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { IconChat, IconPencil, IconPlus, IconTrash } from "@/components/ui/icons";
import { Dialog } from "@/components/ui/overlay";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

type Group = { label: string; chats: ConversationSummary[] };

/** Today, Yesterday, Previous 7 days, Older: the way people expect a chat list to be grouped. */
export function groupChats(chats: ConversationSummary[], now = new Date()): Group[] {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(now);
  const buckets: Group[] = [
    { label: "Today", chats: [] },
    { label: "Yesterday", chats: [] },
    { label: "Previous 7 days", chats: [] },
    { label: "Older", chats: [] },
  ];
  for (const chat of chats) {
    const days = Math.round((today - startOfDay(new Date(chat.updated_at))) / 86_400_000);
    buckets[days <= 0 ? 0 : days === 1 ? 1 : days <= 7 ? 2 : 3].chats.push(chat);
  }
  return buckets.filter((group) => group.chats.length > 0);
}

type Confirm = { kind: "one"; chat: ConversationSummary } | { kind: "all" } | null;

export function ChatHistory({ activeId, reloadKey, onSelect, onNew, onRemoved }: {
  activeId: string | null;
  /** Change this number to make the list reload (after a question is asked in a new chat). */
  reloadKey: number;
  onSelect: (id: string) => void;
  onNew: () => void;
  /** Called after a delete so the page can leave a chat that no longer exists. */
  onRemoved: (removed: "all" | string) => void;
}) {
  const list = useAsync(`chats:${reloadKey}`, (signal) => listConversations(signal));
  const toast = useToast();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const chats = list.data ?? [];

  const startRename = (chat: ConversationSummary) => {
    setRenaming(chat.id);
    setDraft(chat.title);
  };

  const saveRename = async (chat: ConversationSummary) => {
    const title = draft.trim();
    setRenaming(null);
    if (!title || title === chat.title) return;
    try {
      await renameConversation(chat.id, title);
      list.reload();
    } catch (error) {
      toast({ tone: "error", title: "Could not rename the chat", description: error instanceof ApiError ? error.message : undefined });
    }
  };

  const onRenameKey = (event: KeyboardEvent<HTMLInputElement>, chat: ConversationSummary) => {
    if (event.key === "Enter") void saveRename(chat);
    if (event.key === "Escape") setRenaming(null);
  };

  const remove = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === "all") await deleteAllConversations();
      else await deleteConversation(confirm.chat.id);
      onRemoved(confirm.kind === "all" ? "all" : confirm.chat.id);
      list.reload();
      toast({ tone: "info", title: confirm.kind === "all" ? "All chats deleted" : "Chat deleted" });
      setConfirm(null);
    } catch (error) {
      toast({ tone: "error", title: "Could not delete", description: error instanceof ApiError ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4" aria-label="Chats">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-[17px] font-semibold">Chats</h2>
        <Button size="sm" variant="primary" icon={<IconPlus size={16} />} onClick={onNew}>
          New chat
        </Button>
      </div>

      <div className="mt-3">
        {list.error ? (
          <Callout kind="error" title="Could not load your chats" actions={<Button size="sm" onClick={list.reload}>Try again</Button>}>
            {list.error.message}
          </Callout>
        ) : !list.data ? (
          <LoadingRegion label="Loading your chats" className="space-y-2">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </LoadingRegion>
        ) : chats.length === 0 ? (
          <p className="text-[14px] text-muted">No saved chats yet. Each question you ask is saved here automatically, and only you can see it.</p>
        ) : (
          <nav aria-label="Saved chats" className="max-h-[22rem] space-y-3 overflow-y-auto pr-1">
            {groupChats(chats).map((group) => (
              <div key={group.label}>
                <h3 className="px-2 pb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{group.label}</h3>
                <ul className="space-y-0.5">
                  {group.chats.map((chat) => {
                    const active = chat.id === activeId;
                    return (
                      <li key={chat.id} className={cn("group flex items-center gap-1 rounded-[6px]", active ? "bg-info-soft" : "hover:bg-surface-3")}>
                        {renaming === chat.id ? (
                          <input
                            autoFocus
                            aria-label="Chat title"
                            value={draft}
                            maxLength={120}
                            onChange={(event) => setDraft(event.target.value)}
                            onKeyDown={(event) => onRenameKey(event, chat)}
                            onBlur={() => void saveRename(chat)}
                            className="m-1 h-9 min-w-0 flex-1 rounded-[6px] border border-line-strong bg-surface px-2 text-[14px] text-ink"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSelect(chat.id)}
                            aria-current={active ? "true" : undefined}
                            title={chat.title}
                            className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-[6px] px-2 py-1.5 text-left"
                          >
                            <IconChat size={16} className="shrink-0 text-muted" />
                            <span className="min-w-0">
                              <span className={cn("block truncate text-[14px]", active ? "font-semibold text-heading" : "text-ink")}>{chat.title}</span>
                              <span className="block text-[12px] text-muted">{relativeTime(chat.updated_at)}</span>
                            </span>
                          </button>
                        )}
                        {renaming !== chat.id && (
                          <span className="flex shrink-0 pr-1 md:opacity-0 md:transition-opacity md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                            <button type="button" aria-label={`Rename chat: ${chat.title}`} title="Rename" onClick={() => startRename(chat)} className="grid size-8 place-items-center rounded-[6px] text-muted hover:bg-surface hover:text-ink">
                              <IconPencil size={15} />
                            </button>
                            <button type="button" aria-label={`Delete chat: ${chat.title}`} title="Delete" onClick={() => setConfirm({ kind: "one", chat })} className="grid size-8 place-items-center rounded-[6px] text-muted hover:bg-bad-soft hover:text-bad">
                              <IconTrash size={15} />
                            </button>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        )}
      </div>

      {chats.length > 0 && (
        <button type="button" onClick={() => setConfirm({ kind: "all" })} className="mt-3 text-[13px] font-medium text-bad underline-offset-2 hover:underline">
          Delete all chats
        </button>
      )}

      <Dialog
        open={confirm !== null}
        onClose={() => !busy && setConfirm(null)}
        title={confirm?.kind === "all" ? "Delete all your chats?" : "Delete this chat?"}
        description={
          confirm?.kind === "all"
            ? `All ${chats.length} of your chats, with their questions and answers, will be permanently deleted. This cannot be undone.`
            : confirm
              ? `“${confirm.chat.title}” and its answers will be permanently deleted. This cannot be undone.`
              : undefined
        }
        size="sm"
        initialFocusRef={cancelRef}
        footer={
          <>
            <Button ref={cancelRef} variant="secondary" onClick={() => setConfirm(null)} disabled={busy}>Cancel</Button>
            <Button variant="danger" onClick={() => void remove()} loading={busy}>
              {confirm?.kind === "all" ? "Delete all" : "Delete chat"}
            </Button>
          </>
        }
      >
        <p className="text-[14px] text-muted">Your chats are saved only to your account. Deleting removes them from the server, not just from this screen.</p>
      </Dialog>
    </Card>
  );
}
