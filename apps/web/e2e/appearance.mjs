// Exercises the Appearance menu in a real browser: open it, pick colours, switch to dark, reload and check it persisted.
// Usage: node e2e/appearance.mjs  (web on :3470, API on :8000)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.WEB_URL ?? "http://localhost:3470";
const OUT = process.env.SHOT_DIR ?? new URL("../../../docs/screenshots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "light", reducedMotion: "reduce" });
const page = await context.newPage();
const check = (ok, message) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
  if (!ok) process.exitCode = 1;
};
const primary = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary").trim());

await page.goto(`${BASE}/login`);
await page.getByLabel("Email").fill("staff@demo.bil.test");
await page.getByLabel("Password").fill("Demo-Pass-2026");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL("**/ask", { waitUntil: "commit" });
await page.goto(`${BASE}/documents`);
await page.getByRole("heading", { name: "Documents" }).waitFor();

const before = await primary();
await page.getByRole("button", { name: "Appearance" }).click();
await page.getByRole("dialog", { name: "Appearance" }).waitFor();
await page.screenshot({ path: `${OUT}/appearance-menu-1280.png` });

await page.getByRole("radio", { name: "Magenta" }).click();
const magenta = await primary();
check(magenta !== before && magenta.startsWith("#"), `choosing Magenta changes --primary (${before} -> ${magenta})`);
await page.screenshot({ path: `${OUT}/theme-magenta-1280.png` });

await page.getByRole("radio", { name: "Dark" }).click();
check((await page.evaluate(() => document.documentElement.getAttribute("data-theme"))) === "dark", "Dark sets data-theme=dark");
await page.screenshot({ path: `${OUT}/theme-magenta-dark-1280.png` });

await page.getByRole("radio", { name: "Custom" }).click();
await page.getByLabel("Hex colour").fill("#2a9d8f");
const custom = await primary();
check(custom !== magenta, `a custom hex changes --primary (${custom})`);
await page.screenshot({ path: `${OUT}/theme-custom-dark-1280.png` });

await page.reload();
await page.getByRole("heading", { name: "Documents" }).waitFor();
check((await primary()) === custom, "the colour survives a reload");
check((await page.evaluate(() => document.documentElement.getAttribute("data-theme"))) === "dark", "dark mode survives a reload");

await page.getByRole("button", { name: "Appearance" }).click();
await page.getByRole("radio", { name: /Default/ }).click();
await page.getByRole("radio", { name: "Light" }).click();
check((await primary()) === before, "Default restores the BIL colour");
await browser.close();
