"use client";

/**
 * User-chosen theme colour.
 *
 * Given any colour, `accentTokens` derives the app's design tokens for the light and dark schemes and nudges
 * shades until text and controls meet the WCAG contrast targets, so a poor choice (pure white, bright yellow)
 * can never make the interface unreadable. The result is injected as a small <style> element; the saved CSS is
 * also applied before first paint by the boot script (lib/boot-script.ts) so there is no flash of the old colour.
 */

import { useSyncExternalStore } from "react";
import { ACCENT_CSS_KEY, ACCENT_KEY, ACCENT_STYLE_ID } from "./boot-script";

export { ACCENT_CSS_KEY, ACCENT_KEY };

export type AccentChoice = { id: string; hex: string };
export const DEFAULT_ACCENT: AccentChoice = { id: "default", hex: "#1b2a4e" };
export const PRESETS: { id: string; name: string; hex: string }[] = [
  { id: "orange", name: "Orange", hex: "#e8702a" },
  { id: "magenta", name: "Magenta", hex: "#c0357f" },
  { id: "purple", name: "Purple", hex: "#8e5bc4" },
  { id: "indigo", name: "Indigo", hex: "#4b2a9a" },
  { id: "blue", name: "Blue", hex: "#2f6fe0" },
  { id: "green", name: "Green", hex: "#2f9e5a" },
  { id: "black", name: "Black", hex: "#161616" },
];

// ---------------------------------------------------------------- colour maths

type RGB = [number, number, number];

export function normalizeHex(input: string): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
  if (!match) return null;
  let digits = match[1].toLowerCase();
  if (digits.length === 3) digits = digits.split("").map((c) => c + c).join("");
  return `#${digits}`;
}

const toRgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
const toHex = ([r, g, b]: RGB) => `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

const hsl = (h: number, s: number, l: number) => toHex(hslToRgb(h, s, Math.min(1, Math.max(0, l))));

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colours (1 to 21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Step the lightness (dir +1 lighter, -1 darker) until the colour has `min` contrast against every background. */
function ensure(h: number, s: number, l: number, against: string[], min: number, dir: 1 | -1): string {
  let lightness = l;
  let colour = hsl(h, s, lightness);
  while (!against.every((bg) => contrast(colour, bg) >= min)) {
    const next = lightness + dir * 0.01;
    if (next < 0 || next > 1) break;
    lightness = next;
    colour = hsl(h, s, lightness);
  }
  return colour;
}

const INK_LIGHT = "#ffffff";
const INK_DARK = "#14181f";
const bestInk = (bg: string) => (contrast(INK_LIGHT, bg) >= contrast(INK_DARK, bg) ? INK_LIGHT : INK_DARK);

/** Nudge a button colour (darker for light-scheme pages, lighter for dark) until its best text colour reads at 4.5:1. */
function settleButton(h: number, s: number, colour: string, dir: 1 | -1): string {
  let [, , lightness] = rgbToHsl(toRgb(colour));
  let current = colour;
  while (contrast(bestInk(current), current) < 4.5) {
    const next = lightness + dir * 0.01;
    if (next < 0 || next > 1) break;
    lightness = next;
    current = hsl(h, s, lightness);
  }
  return current;
}

// ---------------------------------------------------------------- tokens

const CREAM = "#f5f0ea";
const WHITE = "#ffffff";

export type AccentTokens = { light: Record<string, string>; dark: Record<string, string> };

export function accentTokens(hex: string): AccentTokens {
  const [h, s0, l0] = rgbToHsl(toRgb(hex));
  const s = Math.min(s0, 0.85);

  // Light scheme: the app keeps its cream page; the colour drives buttons, the side rail, headings and links.
  const primary = settleButton(h, s, ensure(h, s, l0, [CREAM], 3, -1), -1); // the button edge must be visible against the page
  const primaryInk = bestInk(primary);
  const [, , primaryL] = rgbToHsl(toRgb(primary));
  const primaryHover = hsl(h, s, primaryInk === INK_LIGHT ? primaryL - 0.08 : primaryL + 0.07);
  const rail = hsl(h, Math.min(s, 0.55), 0.14);
  const infoSoft = hsl(h, Math.min(s * 0.8, 0.6), 0.93);
  const light = {
    "--primary": primary,
    "--primary-hover": primaryHover,
    "--primary-ink": primaryInk,
    "--navy": rail,
    "--navy-soft": hsl(h, Math.min(s, 0.6), 0.24),
    "--rail": rail,
    "--rail-muted": ensure(h, s * 0.45, 0.74, [rail], 4.5, 1),
    "--heading": ensure(h, s, 0.2, [CREAM, WHITE], 7, -1),
    "--link": ensure(h, s, 0.36, [CREAM, WHITE], 4.5, -1),
    "--info": ensure(h, s, 0.3, [infoSoft], 7, -1),
    "--info-soft": infoSoft,
  };

  // Dark scheme: surfaces take a faint tint of the hue (none for neutral colours such as Black).
  const tint = Math.min(s * 0.5, 0.32);
  const bg = hsl(h, tint, 0.08);
  const surface = hsl(h, tint, 0.115);
  const darkPrimary = settleButton(h, Math.min(s, 0.75), ensure(h, Math.min(s, 0.75), 0.62, [surface], 3, 1), 1);
  const darkInk = bestInk(darkPrimary);
  const [, , darkPrimaryL] = rgbToHsl(toRgb(darkPrimary));
  const darkRail = hsl(h, tint, 0.055);
  const darkInfoSoft = hsl(h, Math.min(s * 0.5, 0.4), 0.18);
  const dark = {
    "--bg": bg,
    "--surface": surface,
    "--surface-2": hsl(h, tint, 0.14),
    "--surface-3": hsl(h, tint, 0.18),
    "--line": hsl(h, tint * 0.9, 0.23),
    "--line-strong": hsl(h, tint * 0.9, 0.32),
    "--primary": darkPrimary,
    "--primary-hover": hsl(h, Math.min(s, 0.75), darkInk === INK_LIGHT ? darkPrimaryL - 0.06 : darkPrimaryL + 0.06),
    "--primary-ink": darkInk,
    "--navy": darkRail,
    "--navy-soft": hsl(h, tint, 0.16),
    "--rail": darkRail,
    "--rail-muted": ensure(h, tint, 0.7, [darkRail], 4.5, 1),
    "--heading": ensure(h, Math.min(tint, 0.25), 0.94, [bg], 7, 1),
    "--link": ensure(h, Math.min(s, 0.85), 0.78, [surface, bg], 4.5, 1),
    "--info": ensure(h, Math.min(s, 0.85), 0.8, [darkInfoSoft], 7, 1),
    "--info-soft": darkInfoSoft,
  };
  return { light, dark };
}

const declarations = (tokens: Record<string, string>) => Object.entries(tokens).map(([name, value]) => `${name}:${value}`).join(";");

/**
 * Selectors are one step more specific than the base theme (html:root[data-accent]...), so they win regardless of
 * stylesheet order, and they mirror its structure: light, automatic dark, and forced dark.
 */
export function accentCss(hex: string): string {
  const { light, dark } = accentTokens(hex);
  return (
    `html:root[data-accent]{${declarations(light)}}` +
    `@media (prefers-color-scheme: dark){html:root[data-accent]:not([data-theme="light"]){${declarations(dark)}}}` +
    `html:root[data-accent][data-theme="dark"]{${declarations(dark)}}`
  );
}

/** Stored CSS is re-checked before it is injected: only our own selectors and #rrggbb custom properties are allowed. */
export function safeAccentCss(css: string): boolean {
  if (css.length > 6000 || /url\(|@import|expression|javascript:|<|\\/i.test(css)) return false;
  const rest = css
    .replace(/--[a-z0-9-]+:#[0-9a-f]{6}/gi, "")
    .replace(/html:root\[data-accent\](\[data-theme="dark"\]|:not\(\[data-theme="light"\]\))?/g, "")
    .replace(/@media \(prefers-color-scheme: dark\)/g, "");
  return /^[\s{};]*$/.test(rest);
}

// ---------------------------------------------------------------- storage and application

const listeners = new Set<() => void>();
let cached: { raw: string | null; value: AccentChoice } = { raw: null, value: DEFAULT_ACCENT };

function parse(raw: string | null): AccentChoice {
  if (!raw) return DEFAULT_ACCENT;
  try {
    const data = JSON.parse(raw) as Partial<AccentChoice>;
    const hex = typeof data.hex === "string" ? normalizeHex(data.hex) : null;
    if (hex && typeof data.id === "string" && /^[a-z]{3,12}$/.test(data.id) && data.id !== "default") return { id: data.id, hex };
  } catch {
    /* corrupt value: fall through to the default */
  }
  return DEFAULT_ACCENT;
}

export function readAccent(): AccentChoice {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(ACCENT_KEY);
  } catch {
    /* storage blocked */
  }
  if (raw !== cached.raw) cached = { raw, value: parse(raw) };
  return cached.value;
}

function removeStyle() {
  document.getElementById(ACCENT_STYLE_ID)?.remove();
  document.documentElement.removeAttribute("data-accent");
}

function injectStyle(css: string) {
  let element = document.getElementById(ACCENT_STYLE_ID);
  if (!element) {
    element = document.createElement("style");
    element.id = ACCENT_STYLE_ID;
    document.head.appendChild(element);
  }
  element.textContent = css;
  document.documentElement.setAttribute("data-accent", "1");
}

export function setAccent(choice: AccentChoice) {
  const hex = normalizeHex(choice.hex);
  try {
    if (choice.id === "default" || !hex) {
      localStorage.removeItem(ACCENT_KEY);
      localStorage.removeItem(ACCENT_CSS_KEY);
    } else {
      localStorage.setItem(ACCENT_KEY, JSON.stringify({ id: choice.id, hex }));
      localStorage.setItem(ACCENT_CSS_KEY, accentCss(hex));
    }
  } catch {
    /* storage can be blocked; the colour then lasts for this page only */
  }
  if (choice.id === "default" || !hex) removeStyle();
  else injectStyle(accentCss(hex));
  listeners.forEach((listener) => listener());
}

/** Make sure the page matches the saved choice (covers a cleared style cache or a stale tab). */
export function syncAccent() {
  const choice = readAccent();
  if (choice.id === "default") removeStyle();
  else injectStyle(accentCss(choice.hex));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useAccent(): AccentChoice {
  return useSyncExternalStore(subscribe, readAccent, () => DEFAULT_ACCENT);
}
