// The landing page in a real browser against the live stack: content, the recorded run, links both ways, themes, phone.
// Usage: node e2e/landing.mjs  (web on :3470, API on :8000)
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
check(/Every answer comes with the page it came from/.test(await page.getByRole("heading", { level: 1 }).innerText()), "the landing page is served at / without a redirect");
check(new URL(page.url()).pathname === "/", "a visitor stays on / (no bounce to /login)");
const cta = page.getByRole("link", { name: "Try the demo" }).first();
check((await cta.getAttribute("href")) === "/login", "'Try the demo' goes to sign in");
await page.screenshot({ path: `${OUT}/landing-1280.png`, fullPage: true });

// The recorded run.
const tabs = page.getByRole("tab");
check((await tabs.count()) === 3, "three recorded runs are offered");
await tabs.nth(1).click();
await page.getByText("0 claims · 0 sources · 0 drafts").waitFor();
check(/searched 2 times/.test(await page.getByRole("tabpanel").innerText()), "the declined run shows it searched twice before stopping");
await tabs.nth(2).click();
await page.getByText("Fictional test documents, not BIL policy").waitFor();
check(/10 working days/.test(await page.getByRole("tabpanel").innerText()) && /20 working days/.test(await page.getByRole("tabpanel").innerText()), "the conflict run quotes both documents");
await tabs.nth(0).focus();
await page.keyboard.press("ArrowRight");
check((await tabs.nth(1).getAttribute("aria-selected")) === "true", "arrow keys move between the runs");

// Structure and in-page links.
check((await page.getByRole("table", { name: /six roles/i }).getByRole("row").count()) === 7, "the roles table has a header and six rows");
await page.getByRole("link", { name: "Six roles" }).first().click();
await page.waitForFunction(() => location.hash === "#roles");
check(true, "the in-page link jumps to the section");

// Landing -> app and app -> landing.
await page.goto(`${BASE}/login`);
await page.getByRole("link", { name: /about this prototype/i }).click();
await page.waitForURL(`${BASE}/`);
check(true, "the sign-in screen links back to the landing page");
await page.getByRole("link", { name: "Try the demo" }).first().click();
await page.waitForURL("**/login");
await page.getByLabel("Email").fill("staff@demo.bil.test");
await page.getByLabel("Password").fill("Demo-Pass-2026");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL("**/ask", { waitUntil: "commit" });
await page.getByRole("link", { name: /about this prototype/i }).first().click();
await page.waitForURL(`${BASE}/`);
check(true, "inside the app, the logo leads to the landing page");
await page.getByRole("link", { name: "Open the app" }).first().waitFor();
check((await page.getByRole("link", { name: "Open the app" }).first().getAttribute("href")) === "/ask", "signed in, the landing page offers 'Open the app'");
await page.getByRole("link", { name: "Open the app" }).first().click();
await page.waitForURL("**/ask", { waitUntil: "commit" });
check(true, "'Open the app' goes to Ask");
await page.goto(`${BASE}/`);

// Dark and a custom colour through the real Appearance menu.
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
