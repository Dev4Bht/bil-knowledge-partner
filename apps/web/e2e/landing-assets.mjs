// Captures the landing page hero image from the live demo: a real answered question, cropped to the thread.
// Usage: node e2e/landing-assets.mjs  (web on :3470, API on :8000, Ollama running; takes up to a couple of minutes)
// The chat it creates is deleted afterwards. Nothing else in the account is touched.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.WEB_URL ?? "http://localhost:3470";
const API = process.env.API_URL ?? "http://localhost:8000";
const OUT = new URL("../public/landing/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const QUESTION = "Does BIL's comprehensive motor insurance cover flood damage?";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 1100 }, deviceScaleFactor: 2, colorScheme: "light", reducedMotion: "reduce" });
const page = await context.newPage();
await page.goto(`${BASE}/login`);
await page.getByLabel("Email").fill("staff@demo.bil.test");
await page.getByLabel("Password").fill("Demo-Pass-2026");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL("**/ask", { waitUntil: "commit" });
const api = (method, path) => page.evaluate(async ([base, method, path]) => {
  const r = await fetch(`${base}${path}`, { method, credentials: "include", headers: { "X-Requested-With": "bil-web" } });
  return method === "GET" ? r.json() : r.status;
}, [API, method, path]);
const before = new Set((await api("GET", "/chat/conversations")).map((c) => c.id));
try {
await page.getByLabel("Your question").fill(QUESTION);
await page.getByRole("button", { name: "Ask", exact: true }).click();
const draft = page.locator("section", { hasText: "Draft reply for the customer" }).last();
await draft.waitFor({ timeout: 240_000 });
await page.getByRole("heading", { name: "Answer", exact: true }).first().waitFor();
await page.waitForTimeout(500);

const bubble = await page.locator('section[aria-label^="Question"]').last().boundingBox();
const card = await draft.boundingBox();
const clip = { x: card.x - 2, y: bubble.y - 10, width: card.width + 4, height: card.y + card.height - bubble.y + 20 };
await page.screenshot({ path: `${OUT}/answer.png`, clip, fullPage: true });
console.log(`captured ${Math.round(clip.width)} x ${Math.round(clip.height)} (css px)`);

} finally {
  for (const c of await api("GET", "/chat/conversations")) {
    if (!before.has(c.id)) console.log(`removed capture chat (status ${await api("DELETE", `/chat/conversations/${c.id}`)})`);
  }
}
await browser.close();
