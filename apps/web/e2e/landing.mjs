// The landing page in a real browser: content, links, keyboard use of the agent explorer, themes and phone width.
// Usage: node e2e/landing.mjs  (web on :3470)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.WEB_URL ?? "http://localhost:3470";
const OUT = process.env.SHOT_DIR ?? new URL("../../../docs/screenshots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const check = (ok, message) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
  if (!ok) process.exitCode = 1;
};
const browser = await chromium.launch();

const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "light", reducedMotion: "reduce" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
// An anonymous visitor's sign-in check (/auth/me) answers 401, which the browser logs; that is expected, anything else is not.
page.on("console", (m) => m.type() === "error" && !/status of 401/.test(m.text()) && errors.push(m.text()));
await page.goto(`${BASE}/`);
await page.getByRole("heading", { level: 1 }).waitFor();
check(/draft reply/i.test(await page.getByRole("heading", { level: 1 }).innerText()), "the landing page is served at / without a redirect");
check(new URL(page.url()).pathname === "/", "a visitor stays on / (no bounce to /login)");
const img = page.getByRole("img", { name: /ask screen/i });
check(await img.evaluate((el) => el.complete && el.naturalWidth > 0), "the hero image loads");

const cta = page.getByRole("link", { name: "Try the demo" }).first();
check((await cta.getAttribute("href")) === "/login", "'Try the demo' goes to sign in");
await page.screenshot({ path: `${OUT}/landing-1280.png`, fullPage: true });

// Agent explorer by keyboard.
const tabs = page.getByRole("tab");
check((await tabs.count()) === 6, "six agents are listed");
await tabs.first().focus();
await page.keyboard.press("ArrowDown");
check((await tabs.nth(1).getAttribute("aria-selected")) === "true", "ArrowDown selects the next agent");
check(/never retrieved/.test(await page.getByRole("tabpanel").innerText()), "the panel shows Retrieval's details");
await page.getByRole("link", { name: "How it works" }).first().click();
await page.waitForFunction(() => location.hash === "#how");
check(true, "the in-page link jumps to the section");

// Signed in: the same page offers the app.
await page.goto(`${BASE}/login`);
await page.getByLabel("Email").fill("staff@demo.bil.test");
await page.getByLabel("Password").fill("Demo-Pass-2026");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL("**/ask", { waitUntil: "commit" });
await page.goto(`${BASE}/`);
await page.getByRole("link", { name: "Open the app" }).first().waitFor();
check(new URL(page.url()).pathname === "/", "a signed-in user can still read the landing page");
check((await page.getByRole("link", { name: "Open the app" }).first().getAttribute("href")) === "/ask", "'Open the app' goes to Ask");

// Dark and a custom colour via the real Appearance menu.
await page.getByRole("button", { name: "Appearance" }).click();
await page.getByRole("radio", { name: "Dark" }).click();
await page.keyboard.press("Escape");
await page.screenshot({ path: `${OUT}/landing-1280-dark.png`, fullPage: true });
await page.getByRole("button", { name: "Appearance" }).click();
await page.getByRole("radio", { name: "Magenta" }).click();
await page.keyboard.press("Escape");
await page.screenshot({ path: `${OUT}/landing-1280-dark-magenta.png`, clip: { x: 0, y: 0, width: 1280, height: 800 } });

await page.setViewportSize({ width: 360, height: 800 });
check(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), "no horizontal scrolling at 360 px");
await page.screenshot({ path: `${OUT}/landing-360-dark.png`, fullPage: true });
check(errors.length === 0, `no console errors${errors.length ? `: ${errors[0]}` : ""}`);
await browser.close();
