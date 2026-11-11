import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STAFF } from "@/test/fixtures";
import { mockApi, renderApp, route } from "@/test/utils";
import type { ConversationSummary } from "@/lib/types";
import { ChatHistory, groupChats } from "./chat-history";

const NOW = new Date(2026, 10, 10, 15, 0, 0);
const at = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString();
const chat = (id: string, title: string, daysAgo = 0): ConversationSummary => ({ id, title, created_at: at(daysAgo), updated_at: at(daysAgo), question_count: 1 });

const THREE = [chat("c1", "Flood claims for comprehensive motor", 0), chat("c2", "Fire policy renewal documents", 1), chat("c3", "PF withdrawal procedure", 30)];
const list = (items = THREE) => route("GET", "/chat/conversations", { body: items });

function setup(items = THREE, extra: ReturnType<typeof route>[] = [], activeId: string | null = null) {
  const handlers = { onSelect: vi.fn(), onNew: vi.fn(), onRemoved: vi.fn() };
  const mocked = mockApi(...extra, list(items));
  renderApp(<ChatHistory activeId={activeId} reloadKey={0} {...handlers} />, { user: STAFF });
  return { ...handlers, ...mocked };
}

describe("groupChats", () => {
  it("groups by calendar day the way a chat list should", () => {
    const groups = groupChats([chat("a", "A", 0), chat("b", "B", 1), chat("c", "C", 4), chat("d", "D", 40)], NOW);
    expect(groups.map((g) => [g.label, g.chats.map((c) => c.id)])).toEqual([["Today", ["a"]], ["Yesterday", ["b"]], ["Previous 7 days", ["c"]], ["Older", ["d"]]]);
  });
  it("omits empty groups", () => {
    expect(groupChats([chat("a", "A", 0)], NOW).map((g) => g.label)).toEqual(["Today"]);
    expect(groupChats([], NOW)).toEqual([]);
  });
});

describe("ChatHistory", () => {
  // The fixtures are built around NOW; freeze only the clock (not timers) so day headings never depend on the real date.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists saved chats under day headings and marks the open one", async () => {
    setup(THREE, [], "c2");
    expect(await screen.findByRole("button", { name: /^Flood claims for comprehensive motor/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Fire policy renewal documents/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: /^Flood claims/ })).not.toHaveAttribute("aria-current");
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Today", "Yesterday", "Older"]);
  });

  it("explains the empty state and says only the user can see their chats", async () => {
    setup([]);
    expect(await screen.findByText(/No saved chats yet/i)).toHaveTextContent(/only you can see it/i);
    expect(screen.queryByRole("button", { name: /Delete all chats/ })).not.toBeInTheDocument();
  });

  it("shows an error with a retry when the list cannot be loaded", async () => {
    mockApi(route("GET", "/chat/conversations", { status: 500, body: { detail: "db down", code: "x" } }));
    renderApp(<ChatHistory activeId={null} reloadKey={0} onSelect={vi.fn()} onNew={vi.fn()} onRemoved={vi.fn()} />, { user: STAFF });
    expect(await screen.findByText("Could not load your chats")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("opens a chat and starts a new one", async () => {
    const user = userEvent.setup();
    const { onSelect, onNew } = setup();
    await user.click(await screen.findByRole("button", { name: /^PF withdrawal procedure/ }));
    expect(onSelect).toHaveBeenCalledWith("c3");
    await user.click(screen.getByRole("button", { name: "New chat" }));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it("renames a chat with Enter and sends the new title", async () => {
    const user = userEvent.setup();
    const { calls } = setup(THREE, [route("PATCH", "/chat/conversations/c1", { body: chat("c1", "Flood Q&A") })]);
    await user.click(await screen.findByRole("button", { name: "Rename chat: Flood claims for comprehensive motor" }));
    const input = screen.getByRole("textbox", { name: "Chat title" });
    await user.clear(input);
    await user.type(input, "Flood Q&A{Enter}");
    await waitFor(() => expect(calls.some((c) => c.init.method === "PATCH")).toBe(true));
    const patch = calls.find((c) => c.init.method === "PATCH")!;
    expect(patch.url.pathname).toBe("/chat/conversations/c1");
    expect(JSON.parse(String(patch.init.body))).toEqual({ title: "Flood Q&A" });
    expect(new Headers(patch.init.headers).get("X-Requested-With")).toBe("bil-web");
  });

  it("leaves the title alone when rename is cancelled with Escape or left empty", async () => {
    const user = userEvent.setup();
    const { calls } = setup();
    await user.click(await screen.findByRole("button", { name: /Rename chat: Fire policy/ }));
    await user.type(screen.getByRole("textbox", { name: "Chat title" }), " extra{Escape}");
    expect(screen.queryByRole("textbox", { name: "Chat title" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Rename chat: Fire policy/ }));
    await user.clear(screen.getByRole("textbox", { name: "Chat title" }));
    await user.keyboard("{Enter}");
    expect(calls.some((c) => c.init.method === "PATCH")).toBe(false);
  });

  it("asks for confirmation naming the chat, and Cancel deletes nothing", async () => {
    const user = userEvent.setup();
    const { calls, onRemoved } = setup();
    await user.click(await screen.findByRole("button", { name: "Delete chat: PF withdrawal procedure" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("“PF withdrawal procedure”");
    expect(dialog).toHaveTextContent(/permanently deleted/i);
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(calls.some((c) => c.init.method === "DELETE")).toBe(false);
    expect(onRemoved).not.toHaveBeenCalled();
  });

  it("deletes a chat after confirmation, tells the page, and reloads the list", async () => {
    const user = userEvent.setup();
    const { calls, onRemoved } = setup(THREE, [route("DELETE", "/chat/conversations/c3", { status: 204 })]);
    await user.click(await screen.findByRole("button", { name: "Delete chat: PF withdrawal procedure" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete chat" }));
    await waitFor(() => expect(onRemoved).toHaveBeenCalledWith("c3"));
    expect(calls.find((c) => c.init.method === "DELETE")!.url.pathname).toBe("/chat/conversations/c3");
    expect(calls.filter((c) => (c.init.method ?? "GET") === "GET" && c.url.pathname === "/chat/conversations").length).toBeGreaterThanOrEqual(2);
    expect(await screen.findByText("Chat deleted")).toBeInTheDocument();
  });

  it("deletes all chats only after confirmation and says how many", async () => {
    const user = userEvent.setup();
    const { calls, onRemoved } = setup(THREE, [route("DELETE", "/chat/conversations", { status: 204 })]);
    await user.click(await screen.findByRole("button", { name: "Delete all chats" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("All 3 of your chats");
    await user.click(within(dialog).getByRole("button", { name: "Delete all" }));
    await waitFor(() => expect(onRemoved).toHaveBeenCalledWith("all"));
    expect(calls.find((c) => c.init.method === "DELETE")!.url.pathname).toBe("/chat/conversations");
  });

  it("keeps the chat and says so when a delete fails", async () => {
    const user = userEvent.setup();
    const { onRemoved } = setup(THREE, [route("DELETE", "/chat/conversations/c1", { status: 500, body: { detail: "nope", code: "x" } })]);
    await user.click(await screen.findByRole("button", { name: /Delete chat: Flood claims/ }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete chat" }));
    expect(await screen.findByText("Could not delete")).toBeInTheDocument();
    expect(onRemoved).not.toHaveBeenCalled();
    act(() => undefined);
    expect(screen.getByRole("button", { name: /^Flood claims for comprehensive motor/ })).toBeInTheDocument();
  });
});
