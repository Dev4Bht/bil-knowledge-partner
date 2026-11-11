import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ADMIN, detail, MANAGER, STAFF, version } from "@/test/fixtures";
import { mockApi, renderApp, route, viewerRoutes } from "@/test/utils";
import { DiffView } from "./diff-view";
import { DocumentDetailPage } from "./document-detail";
import { describeApproval } from "./version-timeline";
import { flattenTree } from "./folder-tree";


describe("DocumentDetailPage", () => {
  it("shows a skeleton, then header, DEMO badge, role-aware timeline and the preview", async () => {
    mockApi(route("GET", "/documents/doc-1", { body: detail() }), ...viewerRoutes());
    renderApp(<DocumentDetailPage documentId="doc-1" />, { user: ADMIN });
    expect(screen.getByRole("status")).toHaveTextContent(/loading document/i);
    expect(await screen.findByRole("heading", { level: 1, name: "Motor Insurance Handbook" })).toBeInTheDocument();
    expect(screen.getByText("DEMO")).toBeInTheDocument();
    const timeline = screen.getByRole("list", { name: /Version history/ });
    expect(within(timeline).getAllByRole("article")).toHaveLength(2);
    expect(within(timeline).getByRole("button", { name: /Approve as current/ })).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: /Page 1 of 3/ })).toBeInTheDocument();
    expect(screen.getByText(/View-only\./)).toBeInTheDocument();
    // Documents are view-only: nothing offers the file itself.
    expect(screen.queryByRole("link", { name: /open in a new tab|download/i })).not.toBeInTheDocument();
    expect(document.querySelector("iframe, embed, object")).toBeNull();
  });

  it("answers 404 and 403 with the same words so existence never leaks", async () => {
    mockApi(route("GET", "/documents/gone", { status: 404, body: { detail: "Not found", code: "not_found" } }), route("GET", "/documents/secret", { status: 403, body: { detail: "Forbidden", code: "forbidden" } }));
    const first = renderApp(<DocumentDetailPage documentId="gone" />, { user: STAFF });
    const a = (await screen.findByTestId("not-available")).textContent;
    first.unmount();
    renderApp(<DocumentDetailPage documentId="secret" />, { user: STAFF });
    const b = (await screen.findByTestId("not-available")).textContent;
    expect(a).toBe(b);
    expect(a).toMatch(/may not have access to this document, or it does not exist/i);
  });

  it("shows a retryable error for other failures", async () => {
    mockApi(route("GET", "/documents/doc-1", { status: 500, body: { detail: "Server exploded", code: "x" } }));
    renderApp(<DocumentDetailPage documentId="doc-1" />, { user: ADMIN });
    expect(await screen.findByText("The document could not be loaded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("hides approve, archive and upload from staff", async () => {
    mockApi(route("GET", "/documents/doc-1", { body: detail({ versions: detail().versions.filter((v) => v.status !== "draft") }) }), ...viewerRoutes());
    renderApp(<DocumentDetailPage documentId="doc-1" />, { user: STAFF });
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("button", { name: /Approve as current/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Archive/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Upload new version/ })).not.toBeInTheDocument();
  });

  it("explains what approval changes, then posts it with the CSRF header and updates the timeline optimistically", async () => {
    const user = userEvent.setup();
    let approved = false;
    const { calls } = mockApi(
      route("GET", "/documents/doc-1", () => {
        const d = detail();
        if (approved) d.versions = [{ ...d.versions[0], status: "superseded" }, { ...d.versions[1], status: "approved_current" }];
        return { body: d };
      }),
      route("POST", "/documents/doc-1/versions/v2-id/approve", () => {
        approved = true;
        return { body: version({ id: "v2-id", status: "approved_current" }) };
      }),
      ...viewerRoutes(),
    );
    renderApp(<DocumentDetailPage documentId="doc-1" />, { user: MANAGER });
    await screen.findByRole("heading", { level: 1 });
    await user.click(screen.getByRole("button", { name: /Approve as current/ }));
    const dialog = screen.getByRole("dialog", { name: "Approve 2024 as current?" });
    expect(within(dialog).getByText(/2024 becomes the current version/)).toBeInTheDocument();
    expect(within(dialog).getByText(/2022 becomes superseded/)).toBeInTheDocument();
    expect(calls.some((c) => c.init.method === "POST")).toBe(false); // nothing sent before confirming
    await user.click(within(dialog).getByRole("button", { name: "Approve 2024" }));
    expect(await screen.findByText("2024 is now the current version")).toBeInTheDocument();
    const post = calls.find((c) => c.init.method === "POST")!;
    expect((post.init.headers as Record<string, string>)["X-Requested-With"]).toBe("bil-web");
    await waitFor(() => expect(screen.getByLabelText("Version 2024, approved current")).toBeInTheDocument());
    expect(screen.getByLabelText("Version 2022, superseded")).toBeInTheDocument();
  });

  it("rolls the optimistic change back and reports the server's reason when approval fails", async () => {
    const user = userEvent.setup();
    mockApi(route("GET", "/documents/doc-1", { body: detail() }), route("POST", /approve$/, { status: 409, body: { detail: "Only a draft version can be approved", code: "not_draft" } }), ...viewerRoutes());
    renderApp(<DocumentDetailPage documentId="doc-1" />, { user: ADMIN });
    await screen.findByRole("heading", { level: 1 });
    await user.click(screen.getByRole("button", { name: /Approve as current/ }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Approve 2024" }));
    expect(await screen.findByText("Only a draft version can be approved")).toBeInTheDocument();
    expect(screen.getByLabelText("Version 2024, draft")).toBeInTheDocument();
  });

  it("warns that archiving the current version leaves none current", async () => {
    const user = userEvent.setup();
    mockApi(route("GET", "/documents/doc-1", { body: detail() }), ...viewerRoutes());
    renderApp(<DocumentDetailPage documentId="doc-1" />, { user: ADMIN });
    await screen.findByRole("heading", { level: 1 });
    const current = screen.getByLabelText("Version 2022, approved current");
    await user.click(within(current).getByRole("button", { name: /Archive/ }));
    expect(within(screen.getByRole("dialog")).getByText("This is the current version")).toBeInTheDocument();
  });

  it("compares two versions and shows additions and removals with text marks", async () => {
    const user = userEvent.setup();
    const d = detail();
    mockApi(
      route("GET", "/documents/doc-1", { body: d }),
      route("GET", "/documents/doc-1/compare", () => ({
        body: { from_version: d.versions[0], to_version: d.versions[1], lines: [{ kind: "hunk", text: "@@ -1 +1 @@" }, { kind: "del", text: "reported within 7 days" }, { kind: "add", text: "reported within 14 days" }, { kind: "ctx", text: "same line" }], },
      })),
      ...viewerRoutes(),
    );
    renderApp(<DocumentDetailPage documentId="doc-1" />, { user: ADMIN });
    await screen.findByRole("heading", { level: 1 });
    await user.click(screen.getByRole("tab", { name: "Compare" }));
    expect(await screen.findByText("1 added")).toBeInTheDocument();
    expect(screen.getByText("1 removed")).toBeInTheDocument();
    expect(screen.getByText("reported within 14 days").closest("tr")).toHaveAttribute("data-kind", "add");
    expect(screen.getByText("reported within 7 days").closest("tr")).toHaveAttribute("data-kind", "del");
  });

  it("explains that PDF and DOCX comparison is not available yet instead of failing", async () => {
    const user = userEvent.setup();
    mockApi(route("GET", "/documents/doc-1", { body: detail() }), route("GET", "/documents/doc-1/compare", { status: 422, body: { detail: "Comparison works for text files for now", code: "not_text" } }), ...viewerRoutes());
    renderApp(<DocumentDetailPage documentId="doc-1" />, { user: ADMIN });
    await screen.findByRole("heading", { level: 1 });
    await user.click(screen.getByRole("tab", { name: "Compare" }));
    expect(await screen.findByText("Comparison is not available for this file type yet")).toBeInTheDocument();
  });

  it("shows details and the honest indexing state", async () => {
    const user = userEvent.setup();
    mockApi(route("GET", "/documents/doc-1", { body: detail() }), route("GET", "/capabilities", { body: { dms: true, extraction: false, search: false, llm: false, translation: false, llm_model: null, notes: [] } }), ...viewerRoutes());
    renderApp(<DocumentDetailPage documentId="doc-1" />, { user: ADMIN });
    await screen.findByRole("heading", { level: 1 });
    await user.click(screen.getByRole("tab", { name: "Details" }));
    expect(screen.getByText("SHA-256")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Indexing" }));
    expect(await screen.findByText("Not indexed yet", { selector: "p" })).toBeInTheDocument();
  });

  it("opens a PDF in the view-only viewer on the requested page, never in an embedded file", async () => {
    const pdf = version({ id: "v9", mime_type: "application/pdf", original_filename: "circular.pdf" });
    const { calls } = mockApi(route("GET", "/documents/doc-1", { body: detail({ versions: [pdf], current_version: pdf, latest_version: pdf }) }), ...viewerRoutes({ page_count: 5 }));
    renderApp(<DocumentDetailPage documentId="doc-1" />, { user: STAFF, search: "?page=3" });
    expect(await screen.findByRole("img", { name: /Page 3 of 5/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Page number")).toHaveValue(3);
    expect(calls.some((c) => c.url.pathname === "/documents/doc-1/versions/v9/pages/3")).toBe(true);
    expect(calls.some((c) => c.url.pathname.endsWith("/file"))).toBe(false);
    expect(document.querySelector("iframe")).toBeNull();
  });
});

describe("pure helpers", () => {
  it("describes approval including the version being superseded", () => {
    const [current, draft] = detail().versions;
    const lines = describeApproval([current, draft], draft);
    expect(lines.join(" ")).toMatch(/2024 becomes the current/);
    expect(lines.join(" ")).toMatch(/2022 becomes superseded/);
    expect(describeApproval([draft], draft).join(" ")).toMatch(/nothing is superseded/);
  });
  it("flattens a folder tree honouring expansion and orphaned parents", () => {
    const f = (id: string, name: string, parent: string | null) => ({ id, name, path: name, business_line: "credit" as const, parent_id: parent, required_role: null });
    const tree = [f("a", "A", null), f("b", "B", "a"), f("c", "C", "hidden-parent")];
    expect(flattenTree(tree, new Set()).map((n) => n.folder.id)).toEqual(["a", "c"]);
    expect(flattenTree(tree, new Set(["a"])).map((n) => [n.folder.id, n.depth])).toEqual([["a", 0], ["b", 1], ["c", 0]]);
  });
  it("DiffView says so when versions are identical", () => {
    const { container } = renderApp(<DiffView lines={[{ kind: "ctx", text: "same" }]} />);
    expect(container).toHaveTextContent(/identical text/);
  });
});
