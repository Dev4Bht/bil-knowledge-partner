// View-only documents in a real browser against the live stack: no original file for anyone, watermarked page images,
// copy / drag / context menu / print switched off, and the same in the citation drawer.
// Usage: node e2e/view-only.mjs  (web on :3470, API on :8000)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.WEB_URL ?? "http://localhost:3470";
const API = process.env.API_URL ?? "http://localhost:8000";
const OUT = process.env.SHOT_DIR ?? new URL("../../../docs/screenshots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const check = (ok, message) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
  if (!ok) process.exitCode = 1;
};
const browser = await chromium.launch();

async function signIn(email) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "light", reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Demo-Pass-2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/ask", { waitUntil: "commit" });
  return page;
}
const status = (page, path) => page.evaluate(async ([api, path]) => (await fetch(`${api}${path}`, { credentials: "include" })).status, [API, path]);

const staff = await signIn("staff@demo.bil.test");
const images = [];
staff.on("response", (r) => /\/pages\/\d+$/.test(r.url()) && images.push(`${r.status()} ${r.headers()["content-type"]} ${r.headers()["cache-control"]}`));

// Find the Handbook and open it on page 32.
await staff.goto(`${BASE}/documents?q=${encodeURIComponent("BIL Insurance Handbook")}`);
await staff.getByRole("link", { name: "BIL Insurance Handbook", exact: true }).first().click();
await staff.waitForURL(/\/documents\/[0-9a-f-]+/);
const docPath = new URL(staff.url()).pathname;
await staff.goto(`${BASE}${docPath}?page=32`);
const picture = staff.getByRole("img", { name: /Page 32 of \d+ of /i });
await picture.waitFor({ timeout: 30000 });
check(await picture.evaluate((el) => el.complete && el.naturalWidth > 300), "page 32 shows as an image");
check(images.some((i) => i.startsWith("200 image/jpeg") && /no-store/.test(i)), "the page arrives as a no-store JPEG");
check((await staff.locator("iframe, embed, object").count()) === 0, "no embedded file viewer on the page");
check((await staff.getByRole("link", { name: /download|open in a new tab|open file/i }).count()) === 0, "no download or open-file link");
check(await staff.getByText(/View-only\./).isVisible(), "the view-only notice is shown");
await staff.screenshot({ path: `${OUT}/view-only-1280.png` });

// Copying and saving routes.
const holder = staff.getByLabel(/^Page 32 of/).first();
const guards = await holder.evaluate((el) => {
  const fire = (type) => { const e = new Event(type, { bubbles: true, cancelable: true }); el.dispatchEvent(e); return e.defaultPrevented; };
  return { contextmenu: fire("contextmenu"), copy: fire("copy"), cut: fire("cut"), dragstart: fire("dragstart"), userSelect: getComputedStyle(el).userSelect, imgDrag: el.querySelector("img").draggable };
});
check(guards.contextmenu && guards.copy && guards.cut && guards.dragstart, "right-click, copy, cut and drag are all blocked");
check(guards.userSelect === "none" && guards.imgDrag === false, "the page cannot be selected or dragged");
await staff.keyboard.press("Meta+a");
await staff.keyboard.press("Control+a");
check(((await staff.evaluate(() => String(window.getSelection())).catch(() => "")).includes("Fire")) === false, "select-all does not pick up any page text");

// Printing: the viewer is hidden and a note takes its place.
await staff.emulateMedia({ media: "print" });
check(!(await staff.locator(".protected-view").first().isVisible()), "when printed, the viewer is hidden");
check(await staff.locator(".protected-print-note").first().isVisible(), "when printed, a note says the document is view-only");
await staff.emulateMedia({ media: "screen" });

// Navigation inside the viewer.
await staff.getByRole("button", { name: "Next page" }).click();
await staff.getByRole("img", { name: /Page 33 of/i }).waitFor();
check(true, "next page works");

// The original file is refused, for staff and for a manager.
const hbVersion = await staff.evaluate(async ([api, path]) => {
  const id = path.split("/").pop();
  const d = await (await fetch(`${api}/documents/${id}`, { credentials: "include" })).json();
  return d.current_version.id;
}, [API, docPath]);
const filePath = `${docPath}/versions/${hbVersion}/file`;
check((await status(staff, filePath)) === 403, "staff get 403 for the original file");
const manager = await signIn("manager@demo.bil.test");
check((await status(manager, filePath)) === 403, "managers get 403 too (downloads are off by default)");
await manager.goto(`${BASE}${docPath}?page=1`);
await manager.getByRole("img", { name: /Page 1 of/i }).waitFor({ timeout: 30000 });
check((await manager.getByRole("link", { name: /download/i }).count()) === 0, "a manager sees no download button either");

// The same viewer inside a source drawer (search needs no language model).
await staff.goto(`${BASE}/ask`);
await staff.getByRole("tab", { name: "Search passages" }).click();
await staff.getByLabel("Search the approved documents").fill("flood damage");
await staff.getByRole("button", { name: "Search", exact: true }).click();
const first = staff.getByRole("button", { name: "BIL Insurance Handbook", exact: true }).first();
await first.waitFor({ timeout: 30000 });
await first.click();
const drawer = staff.getByRole("dialog");
await drawer.getByRole("img", { name: /Page \d+ of \d+ of /i }).waitFor({ timeout: 30000 });
check((await drawer.locator("iframe").count()) === 0 && (await drawer.getByRole("link", { name: /open file|download|new tab/i }).count()) === 0, "the source drawer uses the same viewer, with no file link");
await staff.screenshot({ path: `${OUT}/view-only-drawer-1280.png` });
await browser.close();
