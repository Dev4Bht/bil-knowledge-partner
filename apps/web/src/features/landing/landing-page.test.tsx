import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { STAFF } from "@/test/fixtures";
import { renderApp } from "@/test/utils";
import { AGENTS, RESULTS } from "./content";
import { LandingPage } from "./landing-page";

describe("LandingPage", () => {
  it("has one h1, a skip link, and the sections in reading order", () => {
    renderApp(<LandingPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/the answer, the page it came from, and a draft reply/i);
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#content");
    const titles = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(titles[0]).toMatch(/spread across handbooks/i);
    expect(titles).toContain("Six agents, each with one job.");
    expect(titles.at(-1)).toBe("See it answer a real question.");
  });

  it("offers the demo to visitors and the app to signed-in users", () => {
    const { unmount } = renderApp(<LandingPage />);
    for (const link of screen.getAllByRole("link", { name: "Try the demo" })) expect(link).toHaveAttribute("href", "/login");
    unmount();
    renderApp(<LandingPage />, { user: STAFF });
    for (const link of screen.getAllByRole("link", { name: "Open the app" })) expect(link).toHaveAttribute("href", "/ask");
    expect(screen.queryByRole("link", { name: "Try the demo" })).not.toBeInTheDocument();
  });

  it("lists all six agents in order and shows the first one's details", () => {
    renderApp(<LandingPage />);
    const tabs = within(screen.getByRole("tablist", { name: /six agents/i })).getAllByRole("tab");
    expect(tabs).toHaveLength(6);
    expect(tabs.map((t) => t.textContent)).toEqual(AGENTS.map((a, i) => `${i + 1}${a.name}${a.job}`));
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent(AGENTS[0].does);
  });

  it("is operable by keyboard: arrows move and select, Home and End jump, only one tab is tabbable", async () => {
    const user = userEvent.setup();
    renderApp(<LandingPage />);
    const tabs = screen.getAllByRole("tab");
    tabs[0].focus();
    await user.keyboard("{ArrowDown}");
    expect(tabs[1]).toHaveFocus();
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent(AGENTS[1].does);
    expect(tabs.filter((t) => t.tabIndex === 0)).toHaveLength(1);
    await user.keyboard("{End}");
    expect(tabs[5]).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent(AGENTS[5].guard);
    await user.keyboard("{ArrowDown}");
    expect(tabs[0]).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(tabs[5]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(tabs[0]).toHaveFocus();
  });

  it("clicking an agent shows its details and says who does the work", async () => {
    renderApp(<LandingPage />);
    await userEvent.setup().click(screen.getByRole("tab", { name: /Retrieval/ }));
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveTextContent(/never retrieved, so no model ever sees it/i);
    expect(panel).toHaveTextContent("Database search. No language model.");
  });

  it("states the measured results exactly as recorded, with their caveats", () => {
    renderApp(<LandingPage />);
    const results = screen.getByRole("region", { name: /what one run on one laptop showed/i });
    for (const r of RESULTS) expect(within(results).getByText(r.value)).toBeInTheDocument();
    expect(within(results).getByText("16 of 18")).toBeInTheDocument();
    expect(results).toHaveTextContent(/baseline, not a benchmark/i);
    expect(results).toHaveTextContent(/two questions still give answers that are correct but less specific/i);
  });

  it("keeps the results band readable: its heading is explicitly white, since the band is navy in both themes", () => {
    renderApp(<LandingPage />);
    expect(screen.getByRole("heading", { name: /what one run on one laptop showed/i })).toHaveClass("text-white");
  });

  it("is honest about its limits and never claims confidence scores, official status or Dzongkha fluency", () => {
    renderApp(<LandingPage />);
    const limits = screen.getByRole("region", { name: /what it is not, yet/i });
    expect(limits).toHaveTextContent(/not an official bil service/i);
    expect(limits).toHaveTextContent(/dzongkha is experimental/i);
    expect(limits).toHaveTextContent(/no ocr/i);
    expect(document.body).not.toHaveTextContent(/\b\d+(\.\d+)?\s?% (confidence|accurate)|100% accurate|guaranteed|never wrong/i);
    expect(screen.getByRole("contentinfo")).toHaveTextContent(/not an official bil service, and not bil policy/i);
  });

  it("describes the hero image for screen readers", () => {
    renderApp(<LandingPage />);
    expect(screen.getByRole("img", { name: /ask screen.*flood cover.*draft reply/i })).toHaveAttribute("src", "/landing/answer.png");
  });
});
