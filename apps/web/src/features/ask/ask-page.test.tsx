import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CAPS_OFF, CAPS_ON, MANAGER, STAFF } from "@/test/fixtures";
import { mockApi, renderApp, route } from "@/test/utils";
import type { AskResponse, Citation } from "@/lib/types";
import { AskPage } from "./ask-page";
import { looksDegenerate } from "./draft-card";

const citation = (over: Partial<Citation> = {}): Citation => ({
  id: "E1",
  document_id: "doc-1",
  version_id: "ver-1",
  title: "Motor Insurance Handbook",
  folder_path: "Handbooks",
  version_label: "2024",
  version_status: "approved_current",
  section: "§4.1 Flood damage",
  page: 3,
  snippet: "Flood damage is treated as a natural calamity.",
  url: "/documents/doc-1/versions/ver-1/file#page=3",
  is_demo_fixture: true,
  ...over,
});

const response = (over: Partial<AskResponse> = {}): AskResponse => ({
  conversation_id: "conv-1",
  status: "answered",
  answer: "Flood damage is covered, subject to exclusions.",
  claims: [{ text: "Flood damage is a natural calamity and is covered.", citation_ids: ["E1"] }],
  citations: [citation()],
  version_warnings: [{ kind: "older_version_ignored", message: "An older version (2022) was ignored because 2024 is current.", version_ids: ["old"] }],
  drafts: { en: "Dear customer, flood damage is covered subject to exclusions.", dzo: "ཁྱེད་རང་" },
  needs_human_review: true,
  abstention_reason: null,
  steps: [{ agent: "Retrieval", summary: "8 passages (0.2s)" }],
  caveats: [],
  draft_notes: [],
  ...over,
});

const ask = (r: AskResponse | { status: number; body: unknown }) => route("POST", "/chat/ask", "conversation_id" in r ? { body: r } : r);
const caps = (c = CAPS_ON) => route("GET", "/capabilities", { body: c });
const chats = route("GET", "/chat/conversations", { body: [] });

async function submit(question: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Your question"), question);
  await user.click(screen.getByRole("button", { name: "Ask" }));
  return user;
}

describe("Ask when the backend cannot answer yet", () => {
  it("disables the composer, explains what is missing from /capabilities, and invents nothing", async () => {
    const { calls } = mockApi(chats, caps(CAPS_OFF));
    renderApp(<AskPage />, { user: STAFF });
    expect(await screen.findByTestId("capability-notice")).toHaveTextContent("Ask cannot answer yet");
    expect(screen.getByText("The search index is not built yet.")).toBeInTheDocument();
    expect(screen.getByText("Dzongkha drafting is not available yet.")).toBeInTheDocument();
    expect(screen.getByLabelText("Your question")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
    expect(screen.getByText(/No content here is an answer/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Question 1/ })).not.toBeInTheDocument();
    expect(calls.some((c) => c.url.pathname === "/chat/ask")).toBe(false);
  });

  it("shows a loading state, then an error with retry if capabilities fail", async () => {
    mockApi(chats, route("GET", "/capabilities", { status: 500, body: { detail: "caps down", code: "x" } }));
    renderApp(<AskPage />, { user: STAFF });
    expect(screen.getByText(/checking what is available/i)).toBeInTheDocument();
    expect(await screen.findByText("Could not check what this system can do")).toBeInTheDocument();
  });
});

describe("Ask answers", () => {
  it("sends the question with filters and shows claims with source chips, version notices, and the English draft", async () => {
    const { calls } = mockApi(chats, caps(), ask(response()));
    renderApp(<AskPage />, { user: STAFF, search: "?businessLine=general_insurance&language=dz" });
    await submit("Is flood covered?");
    expect(await screen.findByRole("heading", { name: "Answer" })).toBeInTheDocument();
    const body = JSON.parse(calls.find((c) => c.url.pathname === "/chat/ask")!.init.body as string);
    expect(body).toMatchObject({ question: "Is flood covered?", business_line: "general_insurance", language: "dz", include_history: false });
    const chip = screen.getAllByRole("button", { name: /Open source 1: Motor Insurance Handbook · 2024 · p\. 3/ })[0];
    expect(chip).toBeInTheDocument();
    expect(screen.getByText("An older version was ignored")).toBeInTheDocument();
    expect(screen.getByText("Based on current versions")).toBeInTheDocument();
    expect(screen.getByText("Review before use")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Draft reply for the customer" })).toBeInTheDocument();
  });

  it("opens the cited document at the right page in a preview drawer", async () => {
    mockApi(chats, caps(), ask(response()));
    renderApp(<AskPage />, { user: STAFF });
    const user = await submit("Is flood covered?");
    await screen.findByRole("heading", { name: "Answer" });
    await user.click(screen.getAllByRole("button", { name: /Open source 1/ })[0]);
    const drawer = screen.getByRole("dialog", { name: "Motor Insurance Handbook" });
    expect(within(drawer).getByTitle(/Preview of Motor Insurance Handbook, page 3/)).toHaveAttribute("src", "http://localhost:8000/documents/doc-1/versions/ver-1/file#page=3");
    expect(within(drawer).getByText("DEMO")).toBeInTheDocument();
    expect(within(drawer).getByText(/natural calamity/)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("flags a cited version that is not current", async () => {
    mockApi(chats, caps(), ask(response({ citations: [citation({ version_status: "superseded", version_label: "2022" })] })));
    renderApp(<AskPage />, { user: MANAGER });
    const user = await submit("q");
    await screen.findByRole("heading", { name: "Answer" });
    await user.click(screen.getAllByRole("button", { name: /Open source 1/ })[0]);
    expect(screen.getByText("This is not the current version")).toBeInTheDocument();
  });

  it("switches between English and Dzongkha drafts; Dzongkha always carries the human-validation label", async () => {
    mockApi(chats, caps(), ask(response()));
    renderApp(<AskPage />, { user: STAFF });
    const user = await submit("q");
    await screen.findByRole("heading", { name: "Draft reply for the customer" });
    expect(screen.getByText(/Dear customer, flood damage is covered/)).toBeInTheDocument();
    expect(screen.queryByTestId("dz-label")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Dzongkha" }));
    expect(screen.getByTestId("dz-label")).toHaveTextContent("Dzongkha draft. Human validation required.");
    const dz = screen.getByText("ཁྱེད་རང་");
    expect(dz).toHaveAttribute("lang", "dz");
  });

  it("never passes English off as Dzongkha when the Dzongkha draft is withheld, and shows the check notes", async () => {
    mockApi(chats, caps(), ask(response({ drafts: { en: "English only draft", dzo: null }, draft_notes: ["Dzongkha check withheld the translation: back-translation did not match."] })));
    renderApp(<AskPage />, { user: STAFF });
    const user = await submit("q");
    await screen.findByText("English only draft");
    expect(screen.getByText(/Dzongkha check withheld the translation/)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Dzongkha" }));
    expect(screen.getByText(/No Dzongkha draft was produced/)).toBeInTheDocument();
    expect(screen.getByTestId("dz-label")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy Dzongkha draft/ })).toBeDisabled();
  });

  it("copies the draft and marks it reviewed", async () => {
    mockApi(chats, caps(), ask(response()));
    renderApp(<AskPage />, { user: STAFF });
    const user = await submit("q");
    await screen.findByText(/Dear customer/);
    await user.click(screen.getByRole("button", { name: "Copy English draft" }));
    expect(await navigator.clipboard.readText()).toBe("Dear customer, flood damage is covered subject to exclusions.");
    expect(screen.getByText("Not reviewed yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mark as reviewed" }));
    expect(screen.getByText("Reviewed by you")).toBeInTheDocument();
  });

  it("shows caveats quietly and the steps in a collapsible section", async () => {
    mockApi(chats, caps(), ask(response({ caveats: ["Check the customer's own policy schedule."], steps: [{ agent: "Supervisor", summary: "planned (3.4s)" }, { agent: "Verification", summary: "2 claims verified (3.4s)" }] })));
    renderApp(<AskPage />, { user: STAFF });
    const user = await submit("q");
    await screen.findByText(/not a decision on this customer's case/);
    expect(screen.getByText("Check the customer's own policy schedule.")).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "How this answer was made" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/planned \(3.4s\)/)).not.toBeInTheDocument();
    await user.click(toggle);
    expect(screen.getByText(/planned \(3.4s\)/)).toBeInTheDocument();
    expect(screen.getByText("Verification")).toBeInTheDocument();
  });
});

describe("Ask other outcomes", () => {
  it("shows a conflict naming both sources, no draft, and the instruction", async () => {
    const handbook = citation({ id: "E1", title: "Motor Insurance Handbook", version_label: "2024" });
    const circular = citation({ id: "E3", document_id: "doc-2", version_id: "ver-9", title: "Circular 2024/017 Motor Claims", version_label: "2024/017" });
    mockApi(chats, caps(), ask(response({
      status: "conflict", answer: null, claims: [], drafts: { en: null, dzo: null }, citations: [handbook, circular],
      version_warnings: [{ kind: "conflict", message: "Motor Insurance Handbook (§5.1) says 7 days while Circular 2024/017 Motor Claims says 14 days.", version_ids: ["a", "b"] }],
      abstention_reason: "Escalate to the Claims team before telling the customer a deadline.",
    })));
    renderApp(<AskPage />, { user: STAFF });
    await submit("How many days to report?");
    const conflict = await screen.findByTestId("conflict");
    expect(within(conflict).getByText(/says 7 days while Circular 2024\/017 Motor Claims says 14 days/)).toBeInTheDocument();
    expect(within(conflict).getByText("Escalate to the Claims team before telling the customer a deadline.")).toBeInTheDocument();
    expect(within(conflict).getAllByRole("button", { name: /Open source/ })).toHaveLength(2);
    expect(screen.queryByRole("heading", { name: "Answer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Draft reply/ })).not.toBeInTheDocument();
  });

  it("shows the no-evidence state without guessing", async () => {
    mockApi(chats, caps(), ask(response({ status: "no_evidence", answer: null, claims: [], citations: [], version_warnings: [], drafts: { en: null, dzo: null }, abstention_reason: "No approved document gives a school bus premium." })));
    renderApp(<AskPage />, { user: STAFF });
    await submit("premium for a school bus?");
    const card = await screen.findByTestId("no-evidence");
    expect(card).toHaveTextContent("The approved documents do not answer this");
    expect(card).toHaveTextContent("No approved document gives a school bus premium.");
    expect(within(card).getByRole("link", { name: /Browse documents/ })).toHaveAttribute("href", "/documents");
    expect(screen.queryByRole("heading", { name: "Answer" })).not.toBeInTheDocument();
  });

  it("shows the clarifying question for needs_clarification", async () => {
    mockApi(chats, caps(), ask(response({ status: "needs_clarification", answer: null, claims: [], citations: [], drafts: { en: null, dzo: null }, abstention_reason: "Which product is the customer asking about?" })));
    renderApp(<AskPage />, { user: STAFF });
    await submit("what is covered?");
    expect(await screen.findByText("Which product is the customer asking about?")).toBeInTheDocument();
  });

  it("handles model_unavailable with a retry that resends the question", async () => {
    let calls = 0;
    mockApi(chats, caps(), route("POST", "/chat/ask", () => (++calls === 1 ? { body: response({ status: "model_unavailable", answer: null, claims: [], citations: [], drafts: { en: null, dzo: null }, abstention_reason: null }) } : { body: response() })));
    renderApp(<AskPage />, { user: STAFF });
    const user = await submit("q");
    expect(await screen.findByText("The language model is not available right now")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Answer" })).toBeInTheDocument();
  });

  it("lists the retrieved passages, labelled as not an answer, when the model is unavailable", async () => {
    mockApi(chats, caps(), ask(response({ status: "model_unavailable", answer: null, claims: [], drafts: { en: null, dzo: null }, abstention_reason: "The local language model is not available, so no answer was composed." })));
    renderApp(<AskPage />, { user: STAFF });
    await submit("q");
    const passages = await screen.findByTestId("fallback-passages");
    expect(passages).toHaveTextContent("They are not an answer");
    expect(passages).toHaveTextContent("Flood damage is treated as a natural calamity.");
    expect(screen.queryByRole("heading", { name: "Answer" })).not.toBeInTheDocument();
  });

  it("handles an HTTP failure and an unreachable server", async () => {
    mockApi(chats, caps(), route("POST", "/chat/ask", { status: 500, body: { detail: "Model crashed", code: "x" } }));
    const first = renderApp(<AskPage />, { user: STAFF });
    await submit("q");
    expect(await screen.findByText("The question could not be sent")).toBeInTheDocument();
    expect(screen.getByText("Model crashed")).toBeInTheDocument();
    first.unmount();
    mockApi(chats, caps(), route("POST", "/chat/ask", { status: 404, body: { detail: "Not Found", code: "x" } }));
    renderApp(<AskPage />, { user: STAFF });
    await submit("q");
    expect(await screen.findByText(/not available on this server yet/)).toBeInTheDocument();
  });
});

describe("Ask patience and cancel", () => {
  it("shows the six agents, an elapsed counter, never times out, and can be cancelled", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let seenSignal: AbortSignal | undefined;
    mockApi(chats, caps(), (url, init) => {
      if (url.pathname !== "/chat/ask") return undefined;
      seenSignal = init.signal as AbortSignal;
      return new Promise((_, reject) => seenSignal!.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
    });
    renderApp(<AskPage />, { user: STAFF });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.type(await screen.findByLabelText("Your question"), "slow one");
    await user.click(screen.getByRole("button", { name: "Ask" }));
    for (const agent of ["Supervisor", "Retrieval", "Policy & Version", "Synthesis", "Verification", "Bilingual Response"]) {
      expect(await screen.findByText(agent)).toBeInTheDocument();
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(95000);
    });
    expect(screen.getByTestId("elapsed")).toHaveTextContent("95s");
    expect(seenSignal!.aborted).toBe(false); // still waiting after 95 seconds
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("You cancelled this question")).toBeInTheDocument();
    expect(seenSignal!.aborted).toBe(true);
    vi.useRealTimers();
  });
});

describe("Ask search mode", () => {
  it("searches passages and filters by business line facet", async () => {
    const hit = { id: "h1", document_id: "doc-1", version_id: "ver-1", title: "Motor Insurance Handbook", folder_path: "Handbooks", version_label: "2024", version_status: "approved_current", section: "§4.1", page: null, snippet: "Flood damage is covered.", url: "/documents/doc-1/versions/ver-1/file", is_demo_fixture: true };
    const { calls } = mockApi(chats, caps(), route("POST", "/search", { body: { items: [hit], total: 1, facets: { business_line: { general_insurance: 1 } } } }));
    renderApp(<AskPage />, { user: STAFF });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: /Search passages/ }));
    await user.type(screen.getByLabelText("Search the approved documents"), "flood");
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("Flood damage is covered.")).toBeInTheDocument();
    expect(JSON.parse(calls.find((c) => c.url.pathname === "/search")!.init.body as string)).toMatchObject({ query: "flood" });
    await user.click(screen.getByRole("button", { name: /General Insurance/ }));
    await waitFor(() => expect(calls.filter((c) => c.url.pathname === "/search").length).toBe(2));
    expect(JSON.parse(calls.filter((c) => c.url.pathname === "/search")[1].init.body as string)).toMatchObject({ business_line: "general_insurance" });
  });
});

describe("looksDegenerate", () => {
  it("flags text that is one repeated word and passes normal text", () => {
    expect(looksDegenerate("གི་".repeat(40))).toBe(true);
    expect(looksDegenerate("Flood damage is covered under the comprehensive motor policy, subject to exclusions and excess.")).toBe(false);
  });
});

// ---------------------------------------------------------------- saved chats

const message = (role: "user" | "assistant", content: string, over: Partial<{ result: AskResponse | null; notices: string[] }> = {}) => ({
  id: `m-${role}-${content.length}`, role, content, created_at: "2026-11-10T09:00:00Z", result: null, notices: [], ...over,
});
const detail = (messages: ReturnType<typeof message>[]) => ({ id: "conv-1", title: "Flood question", created_at: "2026-11-10T09:00:00Z", updated_at: "2026-11-10T09:05:00Z", messages });
const summary = { id: "conv-1", title: "Flood question", created_at: "2026-11-10T09:00:00Z", updated_at: "2026-11-10T09:05:00Z", question_count: 1 };
const savedChat = (body: unknown, status = 200) => route("GET", "/chat/conversations/conv-1", { status, body });

describe("Saved chats on the Ask page", () => {
  it("re-opens a chat from the URL with its questions and answers as they were shown", async () => {
    mockApi(route("GET", "/chat/conversations", { body: [summary] }), caps(),
      savedChat(detail([message("user", "Is flood covered?"), message("assistant", "Flood damage is covered, subject to exclusions.", { result: response() })])));
    renderApp(<AskPage />, { user: STAFF, search: "?chat=conv-1" });
    expect(await screen.findByText("Is flood covered?")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Answer" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Open source 1: Motor Insurance Handbook/ })[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Flood question/ })).toHaveAttribute("aria-current", "true");
  });

  it("warns that a saved answer may be out of date", async () => {
    mockApi(chats, caps(),
      savedChat(detail([message("user", "Is flood covered?"), message("assistant", "x", { result: response(), notices: ["Motor Insurance Handbook (2024) is now superseded. This answer may be out of date; ask again for the current one."] })])));
    renderApp(<AskPage />, { user: STAFF, search: "?chat=conv-1" });
    expect(await screen.findByText(/is now superseded\. This answer may be out of date/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Answer" })).toBeInTheDocument(); // still readable: the user may still open the document
  });

  it("shows only an explanation, and none of the answer, when the server hid it because access was lost", async () => {
    const hidden = response({ answer: null, claims: [], citations: [], drafts: { en: null, dzo: null }, version_warnings: [], steps: [] });
    mockApi(chats, caps(),
      savedChat(detail([message("user", "Is flood covered?"), message("assistant", "", { result: hidden, notices: ["This answer used a document you can no longer open, so its text is hidden. Ask the question again to get an answer based on what you can see now."] })])));
    renderApp(<AskPage />, { user: STAFF, search: "?chat=conv-1" });
    expect(await screen.findByText(/you can no longer open, so its text is hidden/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Answer" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Flood damage is covered/)).not.toBeInTheDocument();
  });

  it("explains a chat that no longer exists and offers a fresh start", async () => {
    const user = userEvent.setup();
    mockApi(chats, caps(), savedChat({ detail: "Chat not found", code: "not_found" }, 404));
    renderApp(<AskPage />, { user: STAFF, search: "?chat=conv-1" });
    expect(await screen.findByText("Could not open this chat")).toBeInTheDocument();
    expect(screen.getByText(/no longer exists/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start a new chat" }));
    await waitFor(() => expect(screen.queryByText("Could not open this chat")).not.toBeInTheDocument());
  });

  it("opens a chat chosen from the list", async () => {
    const user = userEvent.setup();
    mockApi(route("GET", "/chat/conversations", { body: [summary] }), caps(),
      savedChat(detail([message("user", "Is flood covered?"), message("assistant", "ok", { result: response() })])));
    renderApp(<AskPage />, { user: STAFF });
    await user.click(await screen.findByRole("button", { name: /^Flood question/ }));
    expect(await screen.findByText("Is flood covered?")).toBeInTheDocument();
  });

  it("clears the conversation when New chat is pressed", async () => {
    const user = userEvent.setup();
    mockApi(route("GET", "/chat/conversations", { body: [summary] }), caps(),
      savedChat(detail([message("user", "Is flood covered?"), message("assistant", "ok", { result: response() })])));
    renderApp(<AskPage />, { user: STAFF, search: "?chat=conv-1" });
    expect(await screen.findByText("Is flood covered?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "New chat" }));
    await waitFor(() => expect(screen.queryByText("Is flood covered?")).not.toBeInTheDocument());
  });

  it("keeps the new chat in the URL and refreshes the list after a question is answered", async () => {
    const onUrlUpdate = vi.fn();
    const { calls } = mockApi(chats, caps(), ask(response()));
    renderApp(<AskPage />, { user: STAFF, onUrlUpdate });
    await submit("Is flood covered?");
    expect(await screen.findByRole("heading", { name: "Answer" })).toBeInTheDocument();
    await waitFor(() => expect(onUrlUpdate.mock.calls.some(([u]) => String(u.queryString).includes("chat=conv-1"))).toBe(true));
    expect(calls.filter((c) => c.url.pathname === "/chat/conversations" && (c.init.method ?? "GET") === "GET").length).toBeGreaterThanOrEqual(2);
  });
});
