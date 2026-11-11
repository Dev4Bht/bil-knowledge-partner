import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ADMIN, CAPS_OFF, MANAGER, STAFF } from "@/test/fixtures";
import { mockApi, renderApp, route } from "@/test/utils";
import { DashboardPage } from "./dashboard-page";

const days = (n: number, per: number[]) => Array.from({ length: n }, (_, i) => ({ day: `2026-11-${String(i + 1).padStart(2, "0")}`, questions: per[i] ?? 0 }));
const board = (over: Record<string, unknown> = {}) => ({
  generated_at: "2026-11-10T07:03:00Z",
  documents: {
    documents: 12, awaiting_approval: 2, demo_fixtures: 5,
    by_status: [{ key: "draft", count: 2 }, { key: "approved_current", count: 9 }, { key: "superseded", count: 1 }, { key: "archived", count: 0 }],
    by_business_line: [{ key: "credit", count: 1 }, { key: "corporate", count: 2 }, { key: "general_insurance", count: 6 }, { key: "pf_gf", count: 0 }],
  },
  indexing: { indexed_passages: 1234, average_duration_ms: 4200, jobs: [{ key: "queued", count: 0 }, { key: "processing", count: 0 }, { key: "indexed", count: 11 }, { key: "failed", count: 0 }] },
  activity: {
    days: 14, questions: 6, with_version_warnings: 1, searches: 4, denied: 2, active_people: 3,
    outcomes: [{ key: "answered", count: 4 }, { key: "conflict", count: 1 }, { key: "no_evidence", count: 1 }, { key: "needs_clarification", count: 0 }, { key: "model_unavailable", count: 0 }],
    per_day: days(14, [0, 1, 0, 2, 3]),
  },
  ...over,
});

describe("DashboardPage", () => {
  it("denies staff without calling the API, using neutral wording", () => {
    const { calls } = mockApi();
    renderApp(<DashboardPage />, { user: STAFF });
    expect(screen.getByTestId("admin-only")).toHaveTextContent(/may not have access to this page, or it does not exist/i);
    expect(calls).toHaveLength(0);
  });

  it("shows a loading state, then the key numbers, outcomes and business lines as text", async () => {
    mockApi(route("GET", "/dashboard", { body: board() }), route("GET", "/capabilities", { body: CAPS_OFF }));
    renderApp(<DashboardPage />, { user: MANAGER });
    expect(screen.getByRole("status")).toHaveTextContent(/loading dashboard/i);
    const key = await screen.findByRole("region", { name: "Key numbers" });
    expect(within(key).getByText("1,234")).toBeInTheDocument();
    expect(within(key).getByText("Awaiting approval")).toBeInTheDocument();
    const outcomes = screen.getByRole("list", { name: "Question outcomes" });
    expect(within(outcomes).getByText("Answered")).toBeInTheDocument();
    expect(within(outcomes).getByText("No evidence")).toBeInTheDocument();
    const lines = screen.getByRole("list", { name: "Documents by business line" });
    expect(within(lines).getByText("General Insurance")).toBeInTheDocument();
    expect(screen.getByText(/5 of the documents are labelled fictional test fixtures/i)).toBeInTheDocument();
  });

  it("explains that declining to answer is intended, and says nothing about confidence", async () => {
    mockApi(route("GET", "/dashboard", { body: board() }), route("GET", "/capabilities", { body: CAPS_OFF }));
    renderApp(<DashboardPage />, { user: ADMIN });
    expect(await screen.findByText(/declining to answer when the documents do not say is the intended behaviour/i)).toBeInTheDocument();
    expect(screen.queryByText(/confidence|accuracy/i)).not.toBeInTheDocument();
  });

  it("warns, in words and with a link, when documents failed to index", async () => {
    const failed = board({ indexing: { indexed_passages: 10, average_duration_ms: null, jobs: [{ key: "queued", count: 0 }, { key: "processing", count: 0 }, { key: "indexed", count: 1 }, { key: "failed", count: 2 }] } });
    mockApi(route("GET", "/dashboard", { body: failed }), route("GET", "/capabilities", { body: CAPS_OFF }));
    renderApp(<DashboardPage />, { user: ADMIN });
    expect(await screen.findByRole("alert")).toHaveTextContent(/2 document versions failed to index/i);
    expect(screen.getByRole("link", { name: "Open documents" })).toHaveAttribute("href", "/documents");
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
  });

  it("shows an empty message instead of empty bars when nothing happened", async () => {
    const quiet = board({ activity: { days: 14, questions: 0, with_version_warnings: 0, searches: 0, denied: 0, active_people: 0, outcomes: [], per_day: days(14, []) } });
    mockApi(route("GET", "/dashboard", { body: quiet }), route("GET", "/capabilities", { body: CAPS_OFF }));
    renderApp(<DashboardPage />, { user: MANAGER });
    expect(await screen.findByText("No questions in this period yet.")).toBeInTheDocument();
  });

  it("changes the period through the URL and asks the API for that many days", async () => {
    const { calls } = mockApi(route("GET", "/dashboard", { body: board() }), route("GET", "/capabilities", { body: CAPS_OFF }));
    const updates: string[] = [];
    renderApp(<DashboardPage />, { user: MANAGER, onUrlUpdate: (u) => updates.push(u.queryString) });
    await screen.findByRole("region", { name: "Key numbers" });
    await userEvent.setup().selectOptions(screen.getByLabelText("Period"), "30");
    await waitFor(() => expect(calls.some((c) => c.url.pathname === "/dashboard" && c.url.searchParams.get("days") === "30")).toBe(true));
    expect(updates.some((q) => q.includes("days=30"))).toBe(true);
  });

  it("ignores an invalid period in the URL and uses the default", async () => {
    const { calls } = mockApi(route("GET", "/dashboard", { body: board() }), route("GET", "/capabilities", { body: CAPS_OFF }));
    renderApp(<DashboardPage />, { user: MANAGER, search: "?days=9999" });
    await screen.findByRole("region", { name: "Key numbers" });
    expect(calls.find((c) => c.url.pathname === "/dashboard")?.url.searchParams.get("days")).toBe("14");
  });

  it("offers a retry when the dashboard cannot be loaded", async () => {
    mockApi(route("GET", "/dashboard", { status: 500, body: { detail: "Something went wrong" } }), route("GET", "/capabilities", { body: CAPS_OFF }));
    renderApp(<DashboardPage />, { user: MANAGER });
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be loaded/i);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("gives the daily chart a text alternative: labelled columns and a table", async () => {
    mockApi(route("GET", "/dashboard", { body: board() }), route("GET", "/capabilities", { body: CAPS_OFF }));
    renderApp(<DashboardPage />, { user: MANAGER });
    await screen.findByRole("region", { name: "Key numbers" });
    expect(screen.getByRole("img", { name: "4 Nov: 2 questions" })).toBeInTheDocument();
    expect(screen.getByText("View as table")).toBeInTheDocument();
  });
});
