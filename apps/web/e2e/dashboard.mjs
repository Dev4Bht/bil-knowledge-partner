// The Dashboard in a real browser against the live stack: role gate, real numbers, URL period, dark mode, phone width.
// Usage: node e2e/dashboard.mjs  (web on :3470, API on :8000)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.WEB_URL ?? "http://localhost:3470";
const OUT = process.env.SHOT_DIR ?? new URL("../../../docs/screenshots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const check = (ok, message) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
  if (!ok) process.exitCode = 1;
};

async function signIn(context, email) {
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Demo-Pass-2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/ask", { waitUntil: "commit" });
  return page;
}

// Staff: no menu entry, and the page itself is refused with neutral wording.
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await signIn(context, "staff@demo.bil.test");
  check((await page.getByRole("link", { name: "Dashboard" }).count()) === 0, "staff do not see a Dashboard link");
  await page.goto(`${BASE}/dashboard`);
  await page.getByTestId("admin-only").waitFor();
  check(true, "staff opening /dashboard get the neutral 'not available' page");
  const direct = await page.evaluate(async () => (await fetch("http://localhost:8000/dashboard", { credentials: "include" })).status);
  check(direct === 403 || direct === 0, `the API refuses staff directly (status ${direct})`);
  await context.close();
}

// Manager: sees real numbers.
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "light", reducedMotion: "reduce" });
const page = await signIn(context, "manager@demo.bil.test");
await page.getByRole("link", { name: "Dashboard" }).first().click();
await page.getByRole("heading", { name: "Dashboard", level: 1 }).waitFor();
await page.getByRole("region", { name: "Key numbers" }).waitFor();
const docs = await page.getByRole("region", { name: "Key numbers" }).innerText();
check(/DOCUMENTS\s*\n?\s*\d+/i.test(docs) && /SEARCHABLE PASSAGES/i.test(docs), "key numbers are shown");
check((await page.getByRole("list", { name: "Question outcomes" }).count()) + (await page.getByText("No questions in this period yet.").count()) > 0, "outcomes show bars or an honest empty message");
const body = await page.getByRole("main").innerText();
check(!/Does BIL|comprehensive motor insurance cover/i.test(body), "no question text appears on the page");
check(!/@demo\.bil\.test/.test(body), "no email addresses appear on the page");
await page.screenshot({ path: `${OUT}/dashboard-1280.png`, fullPage: true });

await page.getByLabel("Period").selectOption("30");
await page.waitForFunction(() => location.search.includes("days=30"));
check(true, "choosing a period puts it in the URL");
await page.reload();
check((await page.getByLabel("Period").inputValue()) === "30", "the period survives a reload");

await page.getByRole("button", { name: "Appearance" }).click();
await page.getByRole("radio", { name: "Dark" }).click();
await page.keyboard.press("Escape");
await page.screenshot({ path: `${OUT}/dashboard-1280-dark.png`, fullPage: true });

await page.setViewportSize({ width: 360, height: 800 });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
check(!overflow, "no horizontal scrolling at 360 px");
await page.screenshot({ path: `${OUT}/dashboard-360-dark.png`, fullPage: true });
await browser.close();
