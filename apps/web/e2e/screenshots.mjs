// Captures screenshots of the main screens at 360, 768 and 1280 px against the live stack.
// Usage: node e2e/screenshots.mjs  (web on :3470, API on :8000)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.WEB_URL ?? "http://localhost:3470";
const OUT = process.env.SHOT_DIR ?? new URL("../../../docs/screenshots/", import.meta.url).pathname;
const WIDTHS = (process.env.WIDTHS ?? "360,768,1280").split(",").map(Number);
const HEIGHTS = { 360: 800, 768: 1024, 1280: 860 };
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const scheme = process.env.SCHEME ?? "light";
for (const width of WIDTHS) {
  const context = await browser.newContext({ viewport: { width, height: HEIGHTS[width] }, colorScheme: scheme, reducedMotion: "reduce" });
  const page = await context.newPage();
  const suffix = scheme === "dark" ? "-dark" : "";
  // Fixed rails and tab bars only look right when the viewport is as tall as the page, so size it to the content.
  const shot = async (name, full = false) => {
    if (full) {
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width, height: Math.min(Math.max(height, HEIGHTS[width]), 2600) });
      await page.waitForTimeout(150);
    }
    await page.screenshot({ path: `${OUT}/${name}-${width}${suffix}.png` });
  };

  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").waitFor();
  await page.waitForTimeout(500);
  await shot("login", true);

  await page.getByLabel("Email").fill("admin@demo.bil.test");
  await page.getByLabel("Password").fill("Demo-Pass-2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/ask", { waitUntil: "commit" });
  await page.waitForTimeout(800);
  await shot("ask", true);

  await page.goto(`${BASE}/documents`);
  await page.getByRole("link", { name: /BIL website/ }).first().waitFor();
  await page.waitForTimeout(400);
  await shot("documents", true);
  await page.setViewportSize({ width, height: HEIGHTS[width] });
  await page.goto(`${BASE}/documents?q=BIL%20Insurance%20Handbook`);
  await page.getByRole("link", { name: /BIL Insurance Handbook/ }).first().waitFor();

  await page.getByRole("link", { name: /BIL Insurance Handbook/ }).first().click();
  await page.waitForURL(/\/documents\/[0-9a-f-]+/, { waitUntil: "commit" });
  await page.getByRole("heading", { name: "Versions" }).waitFor();
  await page.waitForTimeout(800);
  await shot("document-detail", true);
  await context.close();
}
await browser.close();
console.log("screenshots saved to", OUT);
