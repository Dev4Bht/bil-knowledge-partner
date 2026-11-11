// Checks the static public build (dist-landing) as a real host would serve it. No API, no database, no models.
// Usage: node e2e/static-landing.mjs http://localhost:3481/   (serve dist-landing first, e.g. python3 -m http.server)
import { chromium } from "playwright";

const url = process.argv[2];
if (!url) throw new Error("Pass the URL the static site is served at");
const check = (ok, message) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
  if (!ok) process.exitCode = 1;
};
const origin = new URL(url).origin;
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" })).newPage();
const foreign = [];
const failed = [];
const errors = [];
page.on("request", (r) => !r.url().startsWith(origin) && !r.url().startsWith("data:") && foreign.push(r.url()));
page.on("response", (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(url);
await page.getByRole("heading", { level: 1 }).waitFor();
check(true, "the page loads");
check(/Every answer comes with the page it came from/.test(await page.getByRole("heading", { level: 1 }).innerText()), "the new headline is shown");
check((await page.getByRole("figure", { name: /claim tied to its source/i }).count()) === 1, "the source specimen is shown");
check((await page.getByRole("link", { name: /try the demo|open the app|sign in/i }).count()) === 0, "no demo or sign-in links");
check((await page.getByRole("link", { name: "See how it works" }).count()) >= 1, "the call to action is 'See how it works'");
check((await page.locator('meta[name="robots"]').getAttribute("content"))?.includes("noindex"), "search engines are asked not to index it");
await page.getByRole("tab").nth(1).click();
await page.getByText("0 claims · 0 sources · 0 drafts").waitFor();
check(true, "the recorded run replays (declined example)");
await page.getByRole("button", { name: "Appearance" }).click();
await page.getByRole("radio", { name: "Dark" }).click();
check((await page.evaluate(() => document.documentElement.getAttribute("data-theme"))) === "dark", "the theme menu works");
await page.keyboard.press("Escape");
await page.setViewportSize({ width: 360, height: 800 });
check(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), "no horizontal scrolling at 360 px");
await page.waitForTimeout(400);
check(foreign.length === 0, `no request leaves the site${foreign.length ? `: ${foreign[0]}` : ""}`);
check(failed.length === 0, `no failed requests${failed.length ? `: ${failed[0]}` : ""}`);
check(!foreign.concat(failed).some((u) => u.includes(":8000")), "nothing tries to reach the API");
check(errors.length === 0, `no console errors${errors.length ? `: ${errors[0]}` : ""}`);
const notFound = await page.goto(new URL("/definitely-missing/", origin).toString());
check(notFound?.status() === 404, "unknown paths answer 404");
await browser.close();
