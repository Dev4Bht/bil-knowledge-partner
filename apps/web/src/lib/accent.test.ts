import { afterEach, describe, expect, it } from "vitest";
import {
  ACCENT_CSS_KEY,
  ACCENT_KEY,
  DEFAULT_ACCENT,
  PRESETS,
  accentCss,
  accentTokens,
  contrast,
  normalizeHex,
  readAccent,
  safeAccentCss,
  setAccent,
} from "./accent";

const CREAM = "#f5f0ea";
const WHITE = "#ffffff";
const DARK_SURFACE_ISH = 0; // placeholder so the constant below reads clearly in failures
void DARK_SURFACE_ISH;

const hues = Array.from({ length: 24 }, (_, i) => {
  // evenly spaced hues at a vivid saturation, expressed as hex via the module's own converter path
  const h = i * 15;
  const c = (n: number) => Math.round(255 * (0.5 + 0.5 * Math.cos(((h + n) * Math.PI) / 180)));
  return `#${[0, 240, 120].map((n) => c(n).toString(16).padStart(2, "0")).join("")}`;
});
const SAMPLES = [...PRESETS.map((p) => p.hex), ...hues, "#ffffff", "#000000", "#808080", "#ffff00", "#00ffff", "#0000ff"];

afterEach(() => {
  localStorage.clear();
  document.getElementById("bil-accent-style")?.remove();
  document.documentElement.removeAttribute("data-accent");
});

describe("normalizeHex", () => {
  it("accepts 3 and 6 digit colours, with or without #, in any case", () => {
    expect(normalizeHex("#2F6FE0")).toBe("#2f6fe0");
    expect(normalizeHex("2f6fe0")).toBe("#2f6fe0");
    expect(normalizeHex(" #abc ")).toBe("#aabbcc");
  });
  it("rejects anything that is not a colour", () => {
    for (const bad of ["", "#12", "#12345", "#1234567", "blue", "#gggggg", "red; } body { display:none", "url(x)"]) {
      expect(normalizeHex(bad)).toBeNull();
    }
  });
});

describe("contrast", () => {
  it("matches the WCAG reference values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });
});

describe("accentTokens keeps the app readable whatever colour is chosen", () => {
  it.each(SAMPLES)("light and dark tokens for %s meet the contrast targets", (hex) => {
    const { light, dark } = accentTokens(hex);
    // light scheme
    expect(contrast(light["--primary-ink"], light["--primary"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light["--primary"], CREAM)).toBeGreaterThanOrEqual(3);
    expect(contrast(light["--primary-hover"], light["--primary-ink"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light["--heading"], CREAM)).toBeGreaterThanOrEqual(7);
    expect(contrast(light["--heading"], WHITE)).toBeGreaterThanOrEqual(7);
    expect(contrast(light["--link"], CREAM)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light["--link"], WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#e9ecf5", light["--rail"])).toBeGreaterThanOrEqual(9);
    expect(contrast(light["--rail-muted"], light["--rail"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light["--info"], light["--info-soft"])).toBeGreaterThanOrEqual(7);
    // dark scheme
    expect(contrast(dark["--primary-ink"], dark["--primary"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark["--primary"], dark["--surface"])).toBeGreaterThanOrEqual(3);
    expect(contrast(dark["--primary-hover"], dark["--primary-ink"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark["--heading"], dark["--bg"])).toBeGreaterThanOrEqual(7);
    expect(contrast(dark["--link"], dark["--surface"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark["--link"], dark["--bg"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#e9ecf5", dark["--rail"])).toBeGreaterThanOrEqual(9);
    expect(contrast(dark["--info"], dark["--info-soft"])).toBeGreaterThanOrEqual(7);
  });

  it("keeps Black neutral instead of tinting everything blue or brown", () => {
    const { light, dark } = accentTokens("#111111");
    const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    for (const value of [light["--rail"], dark["--bg"], dark["--surface"]]) {
      const [r, g, b] = channels(value);
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(6);
    }
  });
});

describe("accentCss", () => {
  const css = accentCss("#c0357f");
  it("covers light, automatic dark and forced dark, and is specific enough to beat the base theme", () => {
    expect(css).toContain("html:root[data-accent]{");
    expect(css).toContain('@media (prefers-color-scheme: dark){html:root[data-accent]:not([data-theme="light"]){');
    expect(css).toContain('html:root[data-accent][data-theme="dark"]{');
  });
  it("only ever contains plain custom-property declarations", () => {
    expect(safeAccentCss(css)).toBe(true);
    expect(css).not.toMatch(/url\(|@import|expression|javascript:/i);
  });
});

describe("safeAccentCss", () => {
  it("refuses stored CSS that could do more than set colours", () => {
    for (const bad of ["body{background:url(//evil/x)}", "@import 'x';", "a{b:expression(1)}", "</style><script>", "a{--x:\\75rl(1)}"]) {
      expect(safeAccentCss(bad)).toBe(false);
    }
  });
});

describe("setAccent and readAccent", () => {
  it("defaults to the BIL navy theme with nothing injected", () => {
    expect(readAccent()).toEqual(DEFAULT_ACCENT);
    expect(document.getElementById("bil-accent-style")).toBeNull();
  });

  it("applies a preset, remembers it, and can go back to the default", () => {
    const blue = PRESETS.find((p) => p.id === "blue")!;
    setAccent({ id: blue.id, hex: blue.hex });
    expect(document.documentElement.hasAttribute("data-accent")).toBe(true);
    expect(document.getElementById("bil-accent-style")?.textContent).toContain("--primary:");
    expect(readAccent()).toEqual({ id: "blue", hex: blue.hex });
    expect(localStorage.getItem(ACCENT_CSS_KEY)).toContain("html:root[data-accent]");

    setAccent(DEFAULT_ACCENT);
    expect(document.documentElement.hasAttribute("data-accent")).toBe(false);
    expect(document.getElementById("bil-accent-style")).toBeNull();
    expect(localStorage.getItem(ACCENT_KEY)).toBeNull();
    expect(localStorage.getItem(ACCENT_CSS_KEY)).toBeNull();
  });

  it("replaces, never stacks, the injected style when the colour changes", () => {
    setAccent({ id: "custom", hex: "#123456" });
    setAccent({ id: "custom", hex: "#654321" });
    expect(document.querySelectorAll("#bil-accent-style")).toHaveLength(1);
  });

  it("ignores a corrupt stored choice", () => {
    localStorage.setItem(ACCENT_KEY, '{"id":"custom","hex":"not a colour"}');
    expect(readAccent()).toEqual(DEFAULT_ACCENT);
    localStorage.setItem(ACCENT_KEY, "{broken json");
    expect(readAccent()).toEqual(DEFAULT_ACCENT);
  });
});
