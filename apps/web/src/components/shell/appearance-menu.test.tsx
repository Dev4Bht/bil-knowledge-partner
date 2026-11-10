import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ACCENT_KEY, DEFAULT_ACCENT, setAccent } from "@/lib/accent";
import { setThemePreference } from "@/lib/theme";
import { AppearanceMenu } from "./appearance-menu";

afterEach(() => {
  act(() => {
    setThemePreference("system");
    setAccent(DEFAULT_ACCENT);
  });
  localStorage.clear();
});

async function open() {
  const user = userEvent.setup();
  render(<AppearanceMenu />);
  await user.click(screen.getByRole("button", { name: "Appearance" }));
  return { user, panel: screen.getByRole("dialog", { name: "Appearance" }) };
}

describe("AppearanceMenu", () => {
  it("opens from a labelled button and closes with Escape, returning focus to the button", async () => {
    const { user } = await open();
    expect(screen.getByRole("button", { name: "Appearance" })).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Appearance" })).toHaveFocus();
  });

  it("closes when the user clicks elsewhere", async () => {
    const { user } = await open();
    await user.click(document.body);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("switches between Light, Dark and System", async () => {
    const { user, panel } = await open();
    const modes = within(within(panel).getByRole("radiogroup", { name: "Colour mode" }));
    await user.click(modes.getByRole("radio", { name: "Dark" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(modes.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
    await user.click(modes.getByRole("radio", { name: "Light" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    await user.click(modes.getByRole("radio", { name: "System" }));
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("starts on Default and lets the user pick a preset colour", async () => {
    const { user, panel } = await open();
    const colours = within(within(panel).getByRole("radiogroup", { name: "Theme colour" }));
    expect(colours.getByRole("radio", { name: /Default/ })).toHaveAttribute("aria-checked", "true");
    await user.click(colours.getByRole("radio", { name: "Magenta" }));
    expect(colours.getByRole("radio", { name: "Magenta" })).toHaveAttribute("aria-checked", "true");
    expect(colours.getByRole("radio", { name: /Default/ })).toHaveAttribute("aria-checked", "false");
    expect(within(panel).getByText("Magenta", { selector: "[data-current-colour]" })).toBeInTheDocument();
    expect(document.documentElement.hasAttribute("data-accent")).toBe(true);
    expect(JSON.parse(localStorage.getItem(ACCENT_KEY)!).id).toBe("magenta");
  });

  it("returns to the BIL default colour", async () => {
    const { user, panel } = await open();
    const colours = within(within(panel).getByRole("radiogroup", { name: "Theme colour" }));
    await user.click(colours.getByRole("radio", { name: "Orange" }));
    await user.click(colours.getByRole("radio", { name: /Default/ }));
    expect(document.documentElement.hasAttribute("data-accent")).toBe(false);
  });

  it("applies a custom hex colour, and an invalid entry explains itself and keeps the last valid colour", async () => {
    const { user, panel } = await open();
    const colours = within(within(panel).getByRole("radiogroup", { name: "Theme colour" }));
    await user.click(colours.getByRole("radio", { name: "Custom" }));
    expect(JSON.parse(localStorage.getItem(ACCENT_KEY)!)).toEqual({ id: "custom", hex: "#2f6fe0" });
    const input = within(panel).getByLabelText("Hex colour");
    await user.clear(input);
    expect(within(panel).queryByRole("alert")).not.toBeInTheDocument(); // empty is not an error while typing
    await user.type(input, "#12");
    expect(within(panel).getByRole("alert")).toHaveTextContent(/colour like #2f6fe0/i);
    expect(JSON.parse(localStorage.getItem(ACCENT_KEY)!).hex).toBe("#2f6fe0"); // unchanged
    await user.clear(input);
    await user.type(input, "#C0FFEE");
    expect(within(panel).queryByRole("alert")).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(ACCENT_KEY)!)).toEqual({ id: "custom", hex: "#c0ffee" });
    expect(colours.getByRole("radio", { name: "Custom" })).toHaveAttribute("aria-checked", "true");
  });

  it("is operable by keyboard alone", async () => {
    const { user, panel } = await open();
    const colours = within(panel).getByRole("radiogroup", { name: "Theme colour" });
    const orange = within(colours).getByRole("radio", { name: "Orange" });
    orange.focus();
    await user.keyboard("{Enter}");
    expect(orange).toHaveAttribute("aria-checked", "true");
    await user.keyboard(" ");
    expect(orange).toHaveAttribute("aria-checked", "true");
  });
});
