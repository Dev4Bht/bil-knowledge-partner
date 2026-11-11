import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { STAFF } from "@/test/fixtures";
import { mockApi, renderApp, route, viewerRoutes } from "@/test/utils";
import { ProtectedViewer } from "./protected-viewer";

const open = (props: { page?: number } = {}) =>
  renderApp(<ProtectedViewer documentId="d" versionId="v" title="Motor Handbook" {...props} />, { user: STAFF });
const image = (n: number, total: number) => screen.findByRole("img", { name: new RegExp(`Page ${n} of ${total} of Motor Handbook`) });

describe("ProtectedViewer", () => {
  it("opens on the requested page and says plainly that the document is view-only", async () => {
    const { calls } = mockApi(...viewerRoutes({ page_count: 12 }));
    open({ page: 7 });
    expect(await image(7, 12)).toBeInTheDocument();
    expect(screen.getByText(/View-only\./)).toBeInTheDocument();
    expect(screen.getByText(/Copying, saving and printing are switched off, and every page shows your name and the time/)).toBeInTheDocument();
    expect(calls.map((c) => c.url.pathname)).toEqual(["/documents/d/versions/v/pages", "/documents/d/versions/v/pages/7"]);
  });

  it("clamps a page that does not exist to the last one", async () => {
    mockApi(...viewerRoutes({ page_count: 4 }));
    open({ page: 99 });
    expect(await image(4, 4)).toBeInTheDocument();
  });

  it("moves between pages with the buttons, the number box and the arrow keys, and stops at both ends", async () => {
    const { calls } = mockApi(...viewerRoutes({ page_count: 3 }));
    const user = userEvent.setup();
    open();
    await image(1, 3);
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(await image(2, 3)).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Page number"));
    await user.type(screen.getByLabelText("Page number"), "3");
    expect(await image(3, 3)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    screen.getByLabelText("Page 3 of 3").focus();
    await user.keyboard("{ArrowLeft}");
    expect(await image(2, 3)).toBeInTheDocument();
    expect(calls.filter((c) => /pages\/\d+$/.test(c.url.pathname)).map((c) => c.url.pathname.split("/").pop())).toEqual(["1", "2", "3", "2"]);
  });

  it("switches off copy, cut, drag and the context menu on the page, and the image cannot be dragged or selected", async () => {
    mockApi(...viewerRoutes());
    open();
    const picture = await image(1, 3);
    const holder = screen.getByLabelText("Page 1 of 3");
    for (const fire of [fireEvent.contextMenu, fireEvent.copy, fireEvent.cut, fireEvent.dragStart]) {
      expect(fire(holder)).toBe(false); // false means the event's default was prevented
    }
    expect(picture).toHaveAttribute("draggable", "false");
    expect(picture.className).toMatch(/select-none/);
    expect(picture.className).toMatch(/pointer-events-none/);
    expect(holder.className).toMatch(/select-none/);
  });

  it("never renders the document as text, an embedded file or a link to the file", async () => {
    mockApi(...viewerRoutes());
    const { container } = open();
    await image(1, 3);
    expect(container.querySelector("iframe, embed, object")).toBeNull();
    expect(screen.queryByRole("link", { name: /download|open in a new tab|open file/i })).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/page-image/); // the page bytes are an image, never text in the DOM
    expect(screen.getByRole("img", { name: /view-only image, so its text is not available to screen readers/ })).toBeInTheDocument();
  });

  it("offers a download only when the server says it is allowed (off by default)", async () => {
    mockApi(...viewerRoutes({ can_download: true }));
    open();
    await image(1, 3);
    expect(screen.getByRole("link", { name: "Download original" })).toHaveAttribute("href", expect.stringMatching(/\/documents\/d\/versions\/v\/file$/));
  });

  it("is replaced by a short note when printed, via a print-only element", async () => {
    mockApi(...viewerRoutes());
    const { container } = open();
    await image(1, 3);
    expect(container.querySelector(".protected-print-note")).toHaveTextContent(/view-only and cannot be printed/i);
    expect(container.querySelector(".protected-view")).not.toBeNull();
  });

  it("blanks the page and empties the clipboard when a screenshot key is reported, then restores it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    mockApi(...viewerRoutes());
    open();
    await image(1, 3);
    fireEvent.keyUp(window, { key: "PrintScreen" });
    expect(screen.queryByRole("img", { name: /Page 1 of 3/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Hidden for a moment/)).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith("");
    expect(await screen.findByRole("img", { name: /Page 1 of 3/ }, { timeout: 4000 })).toBeInTheDocument(); // back after about 2.5 s
  });

  it("explains a rate limit in plain words and lets the person retry", async () => {
    let calls = 0;
    mockApi(
      route("GET", "/documents/d/versions/v/pages", { body: { page_count: 3, view_only: true, can_download: false, kind: "pdf" } }),
      route("GET", "/documents/d/versions/v/pages/1", () => (++calls === 1 ? { status: 429, body: { detail: "x", code: "too_many_pages" } } : { text: "img" })),
    );
    const user = userEvent.setup();
    open();
    const alert = await screen.findByText("This page could not be shown");
    expect(alert.closest("[data-kind]")).toHaveAttribute("data-kind", "warning");
    expect(screen.getByText(/very quickly/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await image(1, 3)).toBeInTheDocument();
  });

  it("shows a retryable error when the document cannot be opened, and never claims it can be downloaded instead", async () => {
    mockApi(route("GET", "/documents/d/versions/v/pages", { status: 422, body: { detail: "The PDF could not be opened (PdfiumError)", code: "not_viewable" } }));
    open();
    const error = await screen.findByText("The document could not be opened");
    expect(within(error.closest("[data-kind]") as HTMLElement).getByText(/PdfiumError/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText(/download/i)).not.toBeInTheDocument();
  });

  it("shows a loading state first", () => {
    mockApi(...viewerRoutes());
    open();
    expect(screen.getByRole("status")).toHaveTextContent(/opening the document/i);
  });

  it("releases each page's memory when the page changes and when the viewer closes", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    mockApi(...viewerRoutes());
    const user = userEvent.setup();
    const { unmount } = open();
    await image(1, 3);
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await image(2, 3);
    await waitFor(() => expect(revoke).toHaveBeenCalledTimes(1));
    unmount();
    expect(revoke).toHaveBeenCalledTimes(2);
    revoke.mockRestore();
  });
});
