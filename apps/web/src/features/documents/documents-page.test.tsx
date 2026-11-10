import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ADMIN, MANAGER, STAFF, summary } from "@/test/fixtures";
import { mockApi, renderApp, route } from "@/test/utils";
import type { Folder } from "@/lib/types";
import { DocumentsPage } from "./documents-page";

const folders: Folder[] = [
  { id: "f-claims", name: "Claims", path: "Claims", business_line: "general_insurance", parent_id: null, required_role: null },
  { id: "f-motor", name: "Motor", path: "Claims/Motor", business_line: "general_insurance", parent_id: "f-claims", required_role: null },
  { id: "f-loans", name: "Policy and Manuals", path: "Policy and Manuals", business_line: "credit", parent_id: null, required_role: null },
];
const page = (items = [summary()], total = items.length) => ({ items, total, page: 1, page_size: 20 });
const foldersRoute = route("GET", "/folders", { body: folders });

type UrlUpdate = { searchParams: URLSearchParams };
/** Updates are emitted per parser (the search box is debounced), so assertions look across all of them. */
const urls = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.map((c) => (c[0] as UrlUpdate).searchParams);

describe("DocumentsPage states", () => {
  it("shows skeleton rows while loading, then the table", async () => {
    let release: (v: unknown) => void = () => {};
    const gate = new Promise((resolve) => (release = resolve));
    mockApi(foldersRoute, async (url) => (url.pathname === "/documents" ? (await gate, { body: page() }) : undefined));
    renderApp(<DocumentsPage />, { user: ADMIN });
    expect(screen.getAllByRole("status").some((el) => /loading documents/i.test(el.textContent ?? ""))).toBe(true);
    release(null);
    expect(await screen.findByRole("link", { name: "Motor Insurance Handbook" })).toHaveAttribute("href", "/documents/doc-1");
    expect(screen.getByText("DEMO")).toBeInTheDocument();
    expect(screen.getByText("Showing 1 to 1 of 1")).toBeInTheDocument();
  });

  it("shows the empty state with an upload button for managers", async () => {
    mockApi(foldersRoute, route("GET", "/documents", { body: page([], 0) }));
    renderApp(<DocumentsPage />, { user: MANAGER });
    expect(await screen.findByRole("heading", { name: "Nothing here yet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload a document" })).toBeInTheDocument();
  });

  it("hides every upload control from staff", async () => {
    mockApi(foldersRoute, route("GET", "/documents", { body: page([], 0) }));
    renderApp(<DocumentsPage />, { user: STAFF });
    expect(await screen.findByRole("heading", { name: "Nothing here yet" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /upload/i })).not.toBeInTheDocument();
  });

  it("explains an empty result for active filters and clears them", async () => {
    const updates = vi.fn();
    mockApi(foldersRoute, route("GET", "/documents", { body: page([], 0) }));
    renderApp(<DocumentsPage />, { user: ADMIN, search: "?q=zzz&status=draft", onUrlUpdate: updates });
    expect(await screen.findByRole("heading", { name: "No documents match these filters" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search document titles")).toHaveValue("zzz");
    await userEvent.click(screen.getAllByRole("button", { name: "Clear filters" })[0]);
    await waitFor(() => expect(screen.getByLabelText("Search document titles")).toHaveValue(""));
    expect(await screen.findByRole("tab", { name: "All", selected: true })).toBeInTheDocument();
    await waitFor(() => expect(urls(updates).some((p) => !p.has("status"))).toBe(true));
    await waitFor(() => expect(urls(updates).some((p) => !p.has("q"))).toBe(true), { timeout: 2000 });
  });

  it("shows an error with retry that refetches", async () => {
    let fail = true;
    const { calls } = mockApi(foldersRoute, route("GET", "/documents", () => (fail ? { status: 500, body: { detail: "Database down", code: "boom" } } : { body: page() })));
    renderApp(<DocumentsPage />, { user: ADMIN });
    expect(await screen.findByText("Documents could not be loaded")).toBeInTheDocument();
    expect(screen.getByText("Database down")).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "Motor Insurance Handbook" })).toBeInTheDocument();
    expect(calls.filter((c) => c.url.pathname === "/documents").length).toBe(2);
  });

  it("flags a pending draft on a document that already has a current version", async () => {
    const doc = summary({ latest_version: { ...summary().current_version!, id: "d", version_label: "v2", status: "draft" }, version_count: 2 });
    mockApi(foldersRoute, route("GET", "/documents", { body: page([doc]) }));
    renderApp(<DocumentsPage />, { user: ADMIN });
    expect(await screen.findByText("Draft pending: v2")).toBeInTheDocument();
  });
});

describe("DocumentsPage URL state (nuqs)", () => {
  it("reads q, businessLine, status, folder and page from the URL and sends them to the API", async () => {
    const { calls } = mockApi(foldersRoute, route("GET", "/documents", { body: page([summary()], 45) }));
    renderApp(<DocumentsPage />, { user: ADMIN, search: "?q=motor&businessLine=general_insurance&status=approved_current&folder=f-claims&page=2" });
    await screen.findByRole("link", { name: "Motor Insurance Handbook" });
    const call = calls.filter((c) => c.url.pathname === "/documents").at(-1)!;
    expect(Object.fromEntries(call.url.searchParams)).toMatchObject({ q: "motor", business_line: "general_insurance", status: "approved_current", folder_id: "f-claims", page: "2", page_size: "20" });
    expect(screen.getByLabelText("Search document titles")).toHaveValue("motor");
    expect(screen.getByRole("tab", { name: "General Insurance" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Current" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
  });

  it("writes filter changes back to the URL and resets to page 1", async () => {
    const updates = vi.fn();
    mockApi(foldersRoute, route("GET", "/documents", { body: page([summary()], 45) }));
    renderApp(<DocumentsPage />, { user: ADMIN, search: "?page=3", onUrlUpdate: updates });
    await screen.findByRole("link", { name: "Motor Insurance Handbook" });
    await userEvent.click(screen.getByRole("tab", { name: "Draft" }));
    await waitFor(() => expect(urls(updates).some((p) => p.get("status") === "draft" && !p.has("page"))).toBe(true));
    expect(await screen.findByRole("tab", { name: "Draft", selected: true })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Credit" }));
    await waitFor(() => expect(urls(updates).some((p) => p.get("businessLine") === "credit" && p.get("status") === "draft")).toBe(true));
  });

  it("round-trips the search box through the URL", async () => {
    const updates = vi.fn();
    mockApi(foldersRoute, route("GET", "/documents", { body: page() }));
    renderApp(<DocumentsPage />, { user: ADMIN, onUrlUpdate: updates });
    await screen.findByRole("link", { name: "Motor Insurance Handbook" });
    await userEvent.type(screen.getByLabelText("Search document titles"), "flood");
    expect(screen.getByLabelText("Search document titles")).toHaveValue("flood");
    await waitFor(() => expect(urls(updates).some((p) => p.get("q") === "flood")).toBe(true), { timeout: 2000 });
  });

  it("selecting a folder sets folder and its business line", async () => {
    const updates = vi.fn();
    mockApi(foldersRoute, route("GET", "/documents", { body: page() }));
    renderApp(<DocumentsPage />, { user: ADMIN, onUrlUpdate: updates });
    await screen.findByRole("link", { name: "Motor Insurance Handbook" });
    await userEvent.click(await screen.findByRole("treeitem", { name: /Policy and Manuals/ }));
    await waitFor(() => expect(urls(updates).some((p) => p.get("folder") === "f-loans" && p.get("businessLine") === "credit")).toBe(true));
  });
});

describe("DocumentsPage upload", () => {
  it("opens the upload dialog for managers, validates, and uploads with the right form fields", async () => {
    const user = userEvent.setup();
    const created = { ...summary(), versions: [], access_roles: [] };
    const { calls } = mockApi(foldersRoute, route("GET", "/documents", { body: page() }), route("POST", "/documents/upload", { status: 201, body: created }));
    renderApp(<DocumentsPage />, { user: MANAGER, search: "?businessLine=general_insurance" });
    await screen.findByRole("link", { name: "Motor Insurance Handbook" });
    await user.click(screen.getByRole("button", { name: "Upload" }));
    const dialog = screen.getByRole("dialog", { name: "Upload a document" });
    expect(within(dialog).getByText(/Only unclassified, public-facing documents/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Upload as draft" }));
    expect(within(dialog).getByText("Choose a file to upload.")).toBeInTheDocument();
    expect(within(dialog).getByText("Give the document a title.")).toBeInTheDocument();
    expect(calls.some((c) => c.url.pathname === "/documents/upload")).toBe(false);

    await user.upload(within(dialog).getByLabelText(/browse files/i), new File(["hello world"], "Fire_Renewal-notes.txt", { type: "text/plain" }));
    expect(within(dialog).getByLabelText("Title")).toHaveValue("Fire Renewal notes");
    await user.selectOptions(within(dialog).getByLabelText("Folder"), "f-claims");
    await user.click(within(dialog).getByRole("button", { name: "Upload as draft" }));

    await waitFor(() => expect(calls.some((c) => c.url.pathname === "/documents/upload")).toBe(true));
    const post = calls.find((c) => c.url.pathname === "/documents/upload")!;
    const form = post.init.body as FormData;
    expect(form.get("title")).toBe("Fire Renewal notes");
    expect(form.get("business_line")).toBe("general_insurance");
    expect(form.get("folder_id")).toBe("f-claims");
    expect(form.get("access_classification")).toBe("staff");
    expect((form.get("file") as File).name).toBe("Fire_Renewal-notes.txt");
    expect((post.init.headers as Record<string, string>)["X-Requested-With"]).toBe("bil-web");
    expect(await screen.findByText("Document uploaded as a draft")).toBeInTheDocument();
  });

  it("surfaces a server rejection inside the dialog and warns before discarding a filled form", async () => {
    const user = userEvent.setup();
    mockApi(foldersRoute, route("GET", "/documents", { body: page() }), route("POST", "/documents/upload", { status: 422, body: { detail: "Only PDF, DOCX and TXT files can be uploaded", code: "unsupported_type" } }));
    renderApp(<DocumentsPage />, { user: ADMIN, search: "?businessLine=general_insurance" });
    await screen.findByRole("link", { name: "Motor Insurance Handbook" });
    await user.click(screen.getByRole("button", { name: "Upload" }));
    const dialog = screen.getByRole("dialog");
    await user.upload(within(dialog).getByLabelText(/browse files/i), new File(["x"], "a.txt", { type: "text/plain" }));
    await user.selectOptions(within(dialog).getByLabelText("Folder"), "f-claims");
    await user.click(within(dialog).getByRole("button", { name: "Upload as draft" }));
    expect(await within(dialog).findByText("The upload was not accepted")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(within(dialog).getByText(/Discard this upload\?/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await user.click(within(dialog).getByRole("button", { name: "Discard" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
