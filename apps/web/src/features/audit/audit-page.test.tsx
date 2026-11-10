import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ADMIN, STAFF } from "@/test/fixtures";
import { mockApi, renderApp, route } from "@/test/utils";
import { AuditPage } from "./audit-page";

const event = (over = {}) => ({ id: "e1", created_at: "2026-11-10T07:03:00Z", actor: "Demo Admin", event: "version.approve", resource_type: "document", resource_id: "abcdef12-0000", result: "ok", detail: {}, ...over });

describe("AuditPage", () => {
  it("denies non-admins without calling the API, using neutral wording", () => {
    const { calls } = mockApi();
    renderApp(<AuditPage />, { user: STAFF });
    expect(screen.getByTestId("admin-only")).toHaveTextContent(/may not have access to this page, or it does not exist/i);
    expect(calls).toHaveLength(0);
  });

  it("shows a skeleton then the events with text results", async () => {
    mockApi(route("GET", "/audit", { body: { items: [event(), event({ id: "e2", result: "denied", event: "document.view", actor: null, resource_id: "99999999-0000" })], total: 2, page: 1, page_size: 25 } }));
    renderApp(<AuditPage />, { user: ADMIN });
    expect(screen.getByRole("status")).toHaveTextContent(/loading audit log/i);
    expect(await screen.findByText("version.approve")).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByText("Succeeded")).toBeInTheDocument();
    expect(within(table).getByText("Denied")).toBeInTheDocument();
    expect(screen.getByText("Unknown or signed out")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "abcdef12" })).toHaveAttribute("href", "/documents/abcdef12-0000");
  });

  it("filters via the URL and sends event and result to the API", async () => {
    const { calls } = mockApi(route("GET", "/audit", { body: { items: [event()], total: 1, page: 1, page_size: 25 } }));
    renderApp(<AuditPage />, { user: ADMIN, search: "?event=version.approve" });
    await screen.findByText("Page 1 of 1, 1 events");
    expect(calls[0].url.searchParams.get("event")).toBe("version.approve");
    await userEvent.selectOptions(screen.getByLabelText("Result"), "denied");
    await waitFor(() => expect(calls.some((c) => c.url.searchParams.get("result") === "denied")).toBe(true));
  });

  it("handles empty and error states", async () => {
    mockApi(route("GET", "/audit", { body: { items: [], total: 0, page: 1, page_size: 25 } }));
    const first = renderApp(<AuditPage />, { user: ADMIN });
    expect(await screen.findByRole("heading", { name: "No events match" })).toBeInTheDocument();
    first.unmount();
    mockApi(route("GET", "/audit", { status: 500, body: { detail: "Audit store down", code: "x" } }));
    renderApp(<AuditPage />, { user: ADMIN });
    expect(await screen.findByText("The audit log could not be loaded")).toBeInTheDocument();
    expect(screen.getByText("Audit store down")).toBeInTheDocument();
  });
});
