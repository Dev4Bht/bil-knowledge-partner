import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STAFF } from "@/test/fixtures";
import { renderApp } from "@/test/utils";
import { EVIDENCE, REFUSALS, ROLES } from "./content";
import { LandingPage } from "./landing-page";
import { RUNS } from "./runs";

afterEach(() => vi.useRealTimers());

describe("LandingPage", () => {
  it("has one h1, a skip link and the sections in reading order", () => {
    renderApp(<LandingPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Every answer comes with the page it came from.");
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#content");
    const titles = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual([
      "Watch the agents answer, decline and disagree.",
      "One job each, and one rule each that holds.",
      "Four things it will not do.",
      "Tested on 18 labelled questions.",
      "Try it, then check its sources.",
    ]);
  });

  it("offers the demo to visitors and the app to signed-in users", () => {
    const { unmount } = renderApp(<LandingPage />);
    for (const link of screen.getAllByRole("link", { name: "Try the demo" })) expect(link).toHaveAttribute("href", "/login");
    unmount();
    renderApp(<LandingPage />, { user: STAFF });
    for (const link of screen.getAllByRole("link", { name: "Open the app" })) expect(link).toHaveAttribute("href", "/ask");
    expect(screen.queryByRole("link", { name: "Try the demo" })).not.toBeInTheDocument();
  });

  it("ties the hero claim to the exact sentence it came from", () => {
    renderApp(<LandingPage />);
    const figure = screen.getByRole("figure", { name: /a claim tied to its source/i });
    expect(figure).toHaveTextContent(/within a maximum of 3 working days/);
    expect(within(figure).getByText(/Acknowledgement of complaints within maximum of 3 working days/).tagName).toBe("MARK");
    expect(figure).toHaveTextContent(/p\. 11/);
  });

  describe("the recorded run", () => {
    it("shows three real runs, with the first selected and complete", () => {
      renderApp(<LandingPage />);
      const tabs = screen.getAllByRole("tab");
      expect(tabs.map((t) => t.textContent)).toEqual(RUNS.map((r) => `${{ answered: "Answered", declined: "Declined", conflict: "Conflict" }[r.kind]}${r.question}`));
      expect(tabs[0]).toHaveAttribute("aria-selected", "true");
      const panel = screen.getByRole("tabpanel");
      expect(panel).toHaveTextContent("Answered");
      expect(panel).toHaveTextContent(/within a maximum of 3 working days/);
      expect(panel).toHaveTextContent(/Draft reply, for staff to review/);
      // The log is the system's own wording, in the order the roles ran.
      expect(within(panel).getAllByText(/^(Supervisor|Retrieval|Policy & Version|Synthesis|Verification|Bilingual Response)$/).map((e) => e.textContent)).toEqual(RUNS[0].steps.map((s) => s.agent));
    });

    it("shows what a declined run looks like: no claims, no sources, nothing drafted, and the retry", async () => {
      renderApp(<LandingPage />);
      const user = userEvent.setup();
      await user.click(screen.getByRole("tab", { name: /share price/ }));
      await user.click(screen.getByRole("button", { name: "Skip to result" }));
      expect(await screen.findByText(/0 claims · 0 sources · 0 drafts/)).toBeInTheDocument();
      expect(screen.getByRole("tabpanel")).toHaveTextContent(/The evidence does not provide information about BIL's share price/);
      expect(screen.getByRole("tabpanel")).toHaveTextContent("retry");
      expect(screen.getByRole("tabpanel")).toHaveTextContent(/searched 2 times/);
    });

    it("shows a conflict side by side, labelled as fictional test documents, with no draft", async () => {
      renderApp(<LandingPage />);
      const user = userEvent.setup();
      await user.click(screen.getByRole("tab", { name: /working days must a settled claim/ }));
      await user.click(screen.getByRole("button", { name: "Skip to result" }));
      expect(await screen.findByText(/Fictional test documents, not BIL policy/)).toBeInTheDocument();
      const panel = screen.getByRole("tabpanel");
      expect(panel).toHaveTextContent(/within 10 working days/);
      expect(panel).toHaveTextContent(/within 20 working days/);
      expect(panel).toHaveTextContent(/No customer reply was drafted because the current documents conflict/);
      expect(panel).not.toHaveTextContent(/Draft reply, for staff to review/);
    });

    it("plays the steps in one at a time when a question is chosen", async () => {
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
      renderApp(<LandingPage />);
      fireEvent.click(screen.getByRole("tab", { name: /share price/ }));
      expect(screen.getByRole("status")).toHaveTextContent(/Working… step 1 of 9/);
      await act(async () => { vi.advanceTimersByTime(520 * 3); });
      expect(screen.getByRole("status")).toHaveTextContent(/step 4 of 9/);
      await act(async () => { vi.advanceTimersByTime(520 * 20); });
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.getByRole("tabpanel")).toHaveTextContent(/0 claims/);
    });

    it("is operable by keyboard: arrows move and select, and only one tab is tabbable", async () => {
      const user = userEvent.setup();
      renderApp(<LandingPage />);
      const tabs = screen.getAllByRole("tab");
      tabs[0].focus();
      await user.keyboard("{ArrowRight}");
      expect(tabs[1]).toHaveFocus();
      expect(tabs[1]).toHaveAttribute("aria-selected", "true");
      expect(tabs.filter((t) => t.tabIndex === 0)).toHaveLength(1);
      await user.keyboard("{End}");
      expect(tabs[2]).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      expect(tabs[0]).toHaveFocus();
      await user.keyboard("{ArrowLeft}");
      expect(tabs[2]).toHaveFocus();
      await user.keyboard("{Home}");
      expect(tabs[0]).toHaveFocus();
    });

    it("says it is a recording and that pacing is staged", () => {
      renderApp(<LandingPage />);
      expect(screen.getByText(/exactly what the system returned; only the pacing is staged/i)).toBeInTheDocument();
      expect(screen.getByText(/Recorded 11 Nov 2026/)).toBeInTheDocument();
      expect(screen.getByText(/Played back faster than real time/)).toBeInTheDocument();
    });
  });

  it("lists the six roles in a real table, using the names the log uses", () => {
    renderApp(<LandingPage />);
    const table = screen.getByRole("table", { name: /six roles/i });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => within(r).getByRole("rowheader").textContent)).toEqual(ROLES.map((r, i) => `${i + 1}${r.name}`));
    const logged = new Set(RUNS.flatMap((r) => r.steps.map((s) => s.agent)));
    for (const role of ROLES) expect(logged.has(role.name) || role.name === "Bilingual Response").toBe(true);
  });

  it("states four refusals", () => {
    renderApp(<LandingPage />);
    const section = screen.getByRole("region", { name: /four things it will not do/i });
    expect(within(section).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(REFUSALS.map((r) => r.no));
    expect(screen.getByText(/Memo A says 10 working days\. Memo B says 20 working days/)).toBeInTheDocument();
  });

  it("reports the measured results exactly as recorded, with a one-line method note", () => {
    renderApp(<LandingPage />);
    const evidence = screen.getByRole("region", { name: /tested on 18 labelled questions/i });
    for (const e of EVIDENCE) expect(within(evidence).getByText(e.result)).toBeInTheDocument();
    expect(within(evidence).getByText("16 of 18")).toBeInTheDocument();
    expect(evidence).toHaveTextContent(/The method and every result are in docs\/evaluation\.md/);
  });

  it("reads like a product site: no limits section, no apologies and no 'prototype' wording", () => {
    renderApp(<LandingPage />);
    expect(screen.queryByRole("region", { name: /what it is not/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^limits$/i })).not.toBeInTheDocument();
    const body = document.body.textContent ?? "";
    for (const phrase of [/dzongkha is experimental/i, /scanned pdfs cannot be read/i, /conflicts are caught by figures/i, /it is slow/i, /what these checks do not prove/i, /found by reading the answers/i, /not fixed/i, /prototype/i, /not on this page/i]) {
      expect(body).not.toMatch(phrase);
    }
  });

  it("still claims nothing it cannot back up: no confidence scores, perfection or official status", () => {
    renderApp(<LandingPage />);
    expect(document.body).not.toHaveTextContent(/\b\d+(\.\d+)?\s?% (confidence|accurate)|100% accurate|guaranteed|never wrong|trust(ed)? by/i);
    expect(screen.getByRole("contentinfo")).toHaveTextContent(/not an official bil service/i);
  });

  it("describes sources as opening the cited page, not a file", () => {
    renderApp(<LandingPage />);
    expect(document.body).not.toHaveTextContent(/stored file/i);
    expect(screen.getByText(/each source opens that page in the document viewer/i)).toBeInTheDocument();
  });

  describe("static public copy (no API behind it)", () => {
    it("offers no demo or sign-in, only a way to keep reading", () => {
      renderApp(<LandingPage staticSite />);
      expect(screen.queryByRole("link", { name: /try the demo|open the app|sign in/i })).not.toBeInTheDocument();
      for (const link of screen.getAllByRole("link", { name: "See how it works" })) expect(link).toHaveAttribute("href", "#run");
      expect(screen.getByRole("heading", { name: /watch it answer, decline and disagree/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Watch a real run" })).toHaveAttribute("href", "#run");
      expect(document.body).not.toHaveTextContent(/runs on a laptop, not on this page|needs a database/i);
    });

    it("points the demo at the hosted app when one is configured, and drops the 'runs on a laptop' message", () => {
      renderApp(<LandingPage staticSite appUrl="https://app.example.org" />);
      for (const link of screen.getAllByRole("link", { name: "Try the demo" })) expect(link).toHaveAttribute("href", "https://app.example.org/login");
      expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "https://app.example.org/login");
      expect(screen.getByRole("heading", { name: /try it, then check its sources/i })).toBeInTheDocument();
    });

    it("keeps the recorded runs, roles and evidence", () => {
      renderApp(<LandingPage staticSite />);
      expect(screen.getAllByRole("tab")).toHaveLength(3);
      expect(screen.getByRole("table", { name: /six roles/i })).toBeInTheDocument();
      expect(screen.getByRole("region", { name: /tested on 18 labelled questions/i })).toBeInTheDocument();
    });
  });
});
