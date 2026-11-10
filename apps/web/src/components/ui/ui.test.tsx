import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./toast";
import { Badge, ClassificationBadge, DemoBadge, StatusBadge } from "./badge";
import { Button } from "./button";
import { Callout } from "./callout";
import { CopyButton } from "./copy-button";
import { checkFile, FileDropzone } from "./file-dropzone";
import { Dialog, Drawer } from "./overlay";
import { Tabs } from "./tabs";
import { EmptyState } from "./empty-state";

describe("badges", () => {
  it("status badges always carry a text label, never colour alone", () => {
    render(
      <>
        <StatusBadge status="approved_current" />
        <StatusBadge status="draft" />
        <StatusBadge status="superseded" />
        <StatusBadge status="archived" />
      </>,
    );
    for (const label of ["Current", "Draft", "Superseded", "Archived"]) expect(screen.getByText(label)).toBeInTheDocument();
    expect(document.querySelectorAll("svg[aria-hidden='true']").length).toBe(4);
  });
  it("renders the DEMO and classification badges", () => {
    render(
      <>
        <DemoBadge />
        <ClassificationBadge value="restricted" />
        <Badge>Plain</Badge>
      </>,
    );
    expect(screen.getByText("DEMO")).toHaveAttribute("title", expect.stringMatching(/not BIL policy/i));
    expect(screen.getByText("Restricted")).toBeInTheDocument();
  });
});

describe("Button", () => {
  it("is disabled and busy while loading", () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("aria-busy", "true");
  });
});

describe("Callout", () => {
  it("announces errors as alerts and others as notes", () => {
    render(
      <>
        <Callout kind="error" title="Broke" />
        <Callout kind="conflict" title="Clash" />
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Broke");
    expect(screen.getByText("Clash").closest("[data-kind]")).toHaveAttribute("data-kind", "conflict");
  });
});

describe("EmptyState", () => {
  it("shows title, body and action", () => {
    render(<EmptyState title="Nothing here yet" action={<button>Go</button>}>Body</EmptyState>);
    expect(screen.getByRole("heading", { name: "Nothing here yet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
  });
});

describe("Tabs", () => {
  function Harness() {
    const [value, setValue] = useState("a");
    return <Tabs label="Demo" idPrefix="t" value={value} onChange={setValue} tabs={[{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }, { id: "c", label: "Gamma" }]} />;
  }
  it("uses roving tabindex and arrow keys, wrapping at the ends", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const alpha = screen.getByRole("tab", { name: "Alpha" });
    expect(alpha).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute("tabindex", "-1");
    alpha.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Gamma" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Gamma" })).toHaveFocus();
  });
});

describe("Dialog", () => {
  function Harness({ onClose }: { onClose?: () => void }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        <Dialog open={open} onClose={() => { setOpen(false); onClose?.(); }} title="Confirm thing" description="Details here" footer={<button>Yes</button>}>
          <input aria-label="Name" />
        </Dialog>
      </>
    );
  }
  it("is a labelled modal that moves focus in, traps Tab, closes on Escape and returns focus", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByRole("button", { name: "Open" });
    await user.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Confirm thing" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Details here");
    expect(screen.getByRole("button", { name: "Close dialog" })).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText("Name")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Yes" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Close dialog" })).toHaveFocus(); // wrapped, did not leave
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
    expect(opener).toHaveFocus();
  });
  it("renders a right-hand drawer with a labelled close button", async () => {
    const onClose = vi.fn();
    render(<Drawer open onClose={onClose} title="Preview" subtitle="sub"><p>body</p></Drawer>);
    expect(screen.getByRole("dialog", { name: "Preview" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close preview" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("Toast", () => {
  function Harness() {
    const toast = useToast();
    return <button onClick={() => toast({ tone: "success", title: "Saved", description: "All good" })}>Fire</button>;
  }
  it("announces a toast in a live region and can be dismissed", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><Harness /></ToastProvider>);
    await user.click(screen.getByRole("button", { name: "Fire" }));
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    await user.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });
});

describe("CopyButton", () => {
  it("copies text and confirms", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><CopyButton text="hello draft" /></ToastProvider>);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe("hello draft");
  });
});

describe("FileDropzone", () => {
  const file = (name: string, size = 10, type = "text/plain") => new File([new Uint8Array(size)], name, { type });
  it("checks type and emptiness immediately", () => {
    expect(checkFile(file("a.txt")).ok).toBe(true);
    expect(checkFile(file("a.exe")).problems[0]).toMatch(/Only PDF, DOCX and TXT/);
    expect(checkFile(file("a.pdf", 0)).problems[0]).toMatch(/empty/i);
    expect(checkFile(file("big.pdf", 26 * 1024 * 1024)).warnings[0]).toMatch(/25 MB/);
  });
  it("accepts a file by browsing and shows its type and size", async () => {
    const onFile = vi.fn();
    const { rerender } = render(<FileDropzone file={null} onFile={onFile} />);
    await userEvent.upload(screen.getByLabelText(/browse files/i), file("notes.txt", 2048));
    expect(onFile).toHaveBeenCalledWith(expect.objectContaining({ name: "notes.txt" }));
    rerender(<FileDropzone file={file("notes.txt", 2048)} onFile={onFile} />);
    expect(screen.getByText(/TXT, 2.0 KB/)).toBeInTheDocument();
  });
  it("accepts a dropped file and flags an unsupported one", async () => {
    const onFile = vi.fn();
    const { container, rerender } = render(<FileDropzone file={null} onFile={onFile} />);
    const zone = container.querySelector("[data-dragging], div.border-dashed") as HTMLElement;
    const dropped = file("policy.pdf", 100, "application/pdf");
    await waitFor(() => zone.dispatchEvent(Object.assign(new Event("drop", { bubbles: true }), { dataTransfer: { files: [dropped] } })));
    expect(onFile).toHaveBeenCalledWith(dropped);
    rerender(<FileDropzone file={file("virus.exe")} onFile={onFile} />);
    expect(screen.getByText(/Only PDF, DOCX and TXT/)).toBeInTheDocument();
  });
});
