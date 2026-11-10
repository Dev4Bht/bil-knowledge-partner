// Live Ask check as staff against the real API and local model (30 to 90 s per answer).
// One browser, one question at a time, each asked exactly once. Usage: node e2e/ask-live.mjs
import { chromium } from "playwright";

const BASE = process.env.WEB_URL ?? "http://localhost:3470";
const OUT = new URL("../../../docs/screenshots/", import.meta.url).pathname;
const QUESTIONS = [
  { name: "answered", q: "A customer's car was damaged in a flood. Is it covered under a comprehensive motor policy, and what does she need to submit?" },
  { name: "conflict", q: "How many days do we have to report a motor claim after the loss?" },
  { name: "no-evidence", q: "What is the premium for a third-party policy for a school bus?" },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
const page = await context.newPage();
await page.goto(`${BASE}/login`);
await page.getByLabel("Email").fill("staff@demo.bil.test");
await page.getByLabel("Password").fill("Demo-Pass-2026");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL("**/ask", { waitUntil: "commit" });

const report = [];
for (const { name, q } of QUESTIONS) {
  await page.getByLabel("Your question").fill(q);
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  const started = Date.now();
  await page.getByRole("button", { name: "Cancel" }).waitFor();
  const stages = await page.getByText("Bilingual Response").count();
  await page.getByRole("button", { name: "Cancel" }).waitFor({ state: "detached", timeout: 420000 });
  await page.waitForTimeout(600);
  const seconds = Math.round((Date.now() - started) / 1000);
  const section = page.locator("section[aria-label^='Question']").last();
  const text = (await section.innerText()).replace(/\s+/g, " ");
  const info = {
    name, seconds, stagesShownWhileWaiting: stages > 0,
    heading: await section.locator("h3").first().innerText().catch(() => null),
    chips: await section.getByRole("button", { name: /Open source/ }).count(),
    versionNotices: await section.getByRole("region", { name: "Version notices" }).count(),
    draftCard: await section.getByRole("heading", { name: /Draft reply/ }).count(),
    conflictBlock: await section.getByTestId("conflict").count(),
    noEvidenceBlock: await section.getByTestId("no-evidence").count(),
    text: text.slice(0, 700),
  };
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: 1280, height: Math.min(height, 2400) });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/ask-${name}-1280.png` });
  await page.setViewportSize({ width: 1280, height: 900 });

  if (name === "answered" && info.chips > 0) {
    await section.getByRole("button", { name: /Open source 1/ }).first().click();
    await page.getByRole("dialog").waitFor();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/ask-citation-drawer-1280.png` });
    info.drawerOpened = true;
    await page.keyboard.press("Escape");
    const copy = section.getByRole("button", { name: "Copy English draft" });
    if (await copy.count()) {
      await copy.click();
      await section.getByRole("button", { name: "Copied" }).waitFor();
      info.copiedChars = (await page.evaluate(() => navigator.clipboard.readText())).length;
    }
    await page.setViewportSize({ width: 360, height: 800 });
    await page.waitForTimeout(250);
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: 360, height: Math.min(h, 3400) });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/ask-answered-360.png` });
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  report.push(info);
  console.log(JSON.stringify(info, null, 1));
}
await browser.close();
