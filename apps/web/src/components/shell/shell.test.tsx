import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ADMIN, STAFF, summary } from "@/test/fixtures";
import { navState, routerMock } from "@/test/next-navigation";
import { mockApi, renderApp, route } from "@/test/utils";
import { AuthGate } from "./app-shell";
import { setThemePreference } from "@/lib/theme";
import { FolderTree } from "@/features/documents/folder-tree";

const docs = route("GET", "/documents", { body: { items: [summary()], total: 1, page: 1, page_size: 8 } });

describe("AuthGate", () => {
  it("sends anonymous visitors to /login and remembers where they were going", async () => {
    navState.pathname = "/documents";
    mockApi();
    renderApp(<AuthGate>secret</AuthGate>);
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/login?next=%2Fdocuments"));
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("shows the shell with role-appropriate navigation", () => {
    mockApi(docs);
    navState.pathname = "/ask";
    const { unmount } = renderApp(<AuthGate>page body</AuthGate>, { user: STAFF });
    expect(screen.getByText("page body")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Documents" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Audit" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute("href", "#main");
    unmount();
    renderApp(<AuthGate>page body</AuthGate>, { user: ADMIN });
    expect(screen.getAllByRole("link", { name: "Audit" }).length).toBeGreaterThan(0);
  });

  it("opens the command palette with Ctrl+K, finds a document and navigates with Enter", async () => {
    mockApi(docs);
    navState.pathname = "/documents";
    renderApp(<AuthGate>x</AuthGate>, { user: ADMIN });
    const user = userEvent.setup();
    await user.keyboard("{Control>}k{/Control}");
    const input = await screen.findByRole("combobox", { name: /search documents and pages/i });
    expect(input).toHaveFocus();
    const option = await screen.findByRole("option", { name: /Motor Insurance Handbook/ });
    expect(option).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{Enter}");
    expect(routerMock.push).toHaveBeenCalledWith("/documents/doc-1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("only lists the Audit page in the palette for admins and closes on Escape", async () => {
    mockApi(docs);
    renderApp(<AuthGate>x</AuthGate>, { user: STAFF });
    const user = userEvent.setup();
    await user.keyboard("{Meta>}k{/Meta}");
    await screen.findByRole("option", { name: /Browse documents/ });
    expect(screen.queryByRole("option", { name: /Audit log/ })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("theme", () => {
  it("applies and clears the data-theme attribute", () => {
    act(() => setThemePreference("dark"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    act(() => setThemePreference("system"));
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});

describe("FolderTree keyboard", () => {
  const f = (id: string, name: string, parent: string | null) => ({ id, name, path: name, business_line: "credit" as const, parent_id: parent, required_role: null });
  it("supports arrows, expand/collapse and Enter to select", async () => {
    const picked: (string | null)[] = [];
    const folders = [f("a", "Alpha", null), f("b", "Beta", "a"), f("c", "Gamma", null)];
    renderApp(<FolderTree folders={folders} selectedId={null} onSelect={(x) => picked.push(x?.id ?? null)} businessLine="credit" />);
    const user = userEvent.setup();
    const alpha = screen.getByRole("treeitem", { name: /Alpha/ });
    expect(alpha).toHaveAttribute("aria-expanded", "true");
    alpha.focus();
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(screen.getByRole("treeitem", { name: /Beta/ })).toHaveFocus());
    await user.keyboard("{ArrowLeft}");
    await waitFor(() => expect(alpha).toHaveFocus());
    await user.keyboard("{ArrowLeft}");
    expect(alpha).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("treeitem", { name: /Beta/ })).not.toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(picked).toEqual(["a"]);
  });
});
