// End-to-end walkthrough against the live stack (web :3470, API :8000).
// admin: sign in, browse, upload .txt, open, approve, upload v2, compare, approve v2, upload draft v3.
// staff: draft and restricted document are not visible. Cleanup: archives what this run uploaded.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.WEB_URL ?? "http://localhost:3470";
const OUT = new URL("../../../docs/screenshots/", import.meta.url).pathname;
const PASSWORD = "Demo-Pass-2026";
const stamp = Date.now();
const TITLE = `E2E Walkthrough Note ${stamp}`;
const dir = mkdtempSync(join(tmpdir(), "bil-e2e-"));
const file = (name, body) => {
  const p = join(dir, name);
  writeFileSync(p, body);
  return p;
};
const step = (msg) => console.log("ok -", msg);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

async function signIn(email) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/ask", { waitUntil: "commit" });
  await page.getByRole("heading", { name: /Ask BIL/ }).waitFor();
}
async function signOut() {
  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login", { waitUntil: "commit" });
}

// ---- admin
await signIn("admin@demo.bil.test");
step("admin signed in, landed on /ask");

await page.goto(`${BASE}/documents?q=Management%20Briefing`);
const restrictedHref = await page.getByRole("link", { name: /Management Briefing/ }).getAttribute("href");
assert.ok(restrictedHref, "admin sees the restricted document");
await page.goto(`${BASE}/documents`);
await page.getByLabel("Search document titles").waitFor();
await page.getByRole("tab", { name: "General Insurance" }).click();
await page.getByRole("treeitem", { name: /Handbooks/ }).click();
await page.waitForURL(/folder=/);
assert.ok((await page.url()).includes("businessLine=general_insurance"), "filters live in the URL");
await page.getByRole("button", { name: "Clear filters" }).first().click();
step("browsed, filtered by line and folder (URL synced), cleared");

await page.getByRole("button", { name: "Upload", exact: true }).click();
const dialog = page.getByRole("dialog", { name: "Upload a document" });
await dialog.getByLabel(/browse files/i).setInputFiles(file(`e2e_note_${stamp}.txt`, "FICTIONAL E2E TEST NOTE\nCover limit is 5 units.\nReport within 7 days.\n"));
await dialog.getByLabel("Title").fill(TITLE);
await dialog.getByLabel("Business line").selectOption("general_insurance");
await dialog.getByLabel("Folder").selectOption({ label: "Handbooks" });
await dialog.getByRole("button", { name: "Upload as draft" }).click();
await page.waitForURL(/\/documents\/[0-9a-f-]{36}/, { waitUntil: "commit", timeout: 30000 }).catch(async (e) => {
  console.log("upload dialog says:", (await dialog.innerText().catch(() => "(no dialog)")).slice(0, 600));
  throw e;
});
await page.getByRole("heading", { level: 1, name: TITLE }).waitFor();
const docUrl = page.url().split("?")[0];
step(`uploaded .txt, opened ${docUrl}`);
await page.getByText("FICTIONAL E2E TEST NOTE").waitFor();
assert.equal(await page.getByLabel(/Version .*, draft/).count(), 1);

// approve v1 with confirm
await page.getByRole("button", { name: "Approve as current" }).click();
const confirm = page.getByRole("dialog", { name: /Approve .* as current\?/ });
await confirm.getByText(/nothing is superseded/).waitFor();
await confirm.getByRole("button", { name: /^Approve / }).click();
await page.getByLabel(/Version .*, approved current/).waitFor();
step("approved v1 (confirm dialog explained the change)");

// second version
await page.getByRole("button", { name: "Upload new version" }).click();
const vdialog = page.getByRole("dialog", { name: "Upload a new version" });
await vdialog.getByLabel(/browse files/i).setInputFiles(file(`e2e_note_${stamp}_v2.txt`, "FICTIONAL E2E TEST NOTE\nCover limit is 9 units.\nReport within 14 days.\n"));
await vdialog.getByRole("button", { name: "Upload as draft" }).click();
await page.getByLabel(/Version .*, draft/).waitFor();
step("uploaded second version as draft");

await page.getByRole("tab", { name: "Compare" }).click();
await page.getByText(/\d+ added/).waitFor();
assert.ok(await page.locator("tr[data-kind='add']").count() >= 1);
assert.ok(await page.locator("tr[data-kind='del']").count() >= 1);
await page.screenshot({ path: `${OUT}/document-compare-1280.png` });
step("compare shows additions and deletions");

await page.getByRole("button", { name: "Approve as current" }).click();
const c2 = page.getByRole("dialog", { name: /Approve .* as current\?/ });
await c2.getByText(/becomes superseded/).waitFor();
await c2.getByRole("button", { name: /^Approve / }).click();
await page.getByLabel(/Version .*, superseded/).waitFor();
step("approved v2, v1 became superseded");

// draft v3 for the staff check
await page.getByRole("button", { name: "Upload new version" }).click();
await page.getByRole("dialog", { name: "Upload a new version" }).getByLabel(/browse files/i).setInputFiles(file(`e2e_note_${stamp}_v3.txt`, "FICTIONAL E2E TEST NOTE\nDRAFT ONLY. Cover limit is 20 units.\n"));
await page.getByRole("dialog").getByRole("button", { name: "Upload as draft" }).click();
await page.waitForFunction(() => document.querySelectorAll("[data-version-status='draft']").length === 1);
const versionCount = await page.getByRole("list", { name: /Version history/ }).getByRole("article").count();
assert.equal(versionCount, 3);
await page.reload();
await page.getByRole("heading", { level: 1, name: TITLE }).waitFor();
await page.getByRole("tab", { name: "Preview" }).waitFor();
await page.getByRole("button", { name: /Preview|Selected/ }).first().waitFor();
const draftCardLabel = await page.getByLabel(/Version .*, draft/).first().getAttribute("aria-label");
step(`admin sees 3 versions incl. draft (${draftCardLabel})`);

// audit
await page.goto(`${BASE}/admin/audit`);
await page.getByRole("heading", { name: "Audit log" }).waitFor();
await page.locator("code", { hasText: "version.approve" }).first().waitFor();
step("audit log visible to admin");
await signOut();
step("admin signed out");

// ---- staff
await page.goto(`${BASE}/documents`);
await page.waitForURL(/\/login\?next=/, { waitUntil: "commit" });
step("signed-out visit to /documents redirected to login with next=");
await signIn("staff@demo.bil.test");
await page.goto(`${BASE}/documents?q=Management%20Briefing`);
await page.getByRole("heading", { name: "No documents match these filters" }).waitFor();
assert.equal(await page.getByRole("link", { name: /Management Briefing/ }).count(), 0, "restricted document hidden from staff");
await page.goto(`${BASE}/documents?q=${encodeURIComponent(TITLE)}`);
await page.getByRole("link", { name: TITLE }).waitFor();
assert.equal(await page.getByRole("button", { name: "Upload", exact: true }).count(), 0, "no upload for staff");
assert.equal(await page.getByRole("link", { name: "Audit" }).count(), 0, "no Audit nav for staff");
step("staff list: restricted document absent, no upload, no audit link");

await page.getByRole("link", { name: TITLE }).click();
await page.getByRole("heading", { level: 1, name: TITLE }).waitFor();
await page.getByRole("list", { name: /Version history/ }).waitFor();
assert.equal(await page.locator("[data-version-status='draft']").count(), 0, "draft invisible to staff");
assert.equal(await page.getByRole("button", { name: /Approve|Archive|Upload new version/ }).count(), 0, "no write actions for staff");
step("staff detail: draft v3 invisible, no approve/archive/upload buttons");
await page.screenshot({ path: `${OUT}/document-detail-staff-1280.png` });

await page.goto(`${BASE}${restrictedHref}`);
await page.getByTestId("not-available").waitFor();
const msg = await page.getByTestId("not-available").innerText();
assert.match(msg, /may not have access to this document, or it does not exist/);
await page.screenshot({ path: `${OUT}/denied-1280.png` });
await page.goto(`${BASE}/documents/00000000-0000-0000-0000-000000000000`);
await page.getByTestId("not-available").waitFor();
assert.equal(await page.getByTestId("not-available").innerText(), msg, "missing and forbidden look identical");
step("restricted and nonexistent documents give the identical not-available page");

await page.goto(`${BASE}/admin/audit`);
await page.getByTestId("admin-only").waitFor();
step("staff cannot open the audit page");
await signOut();

// ---- cleanup: archive what this run uploaded (the API has no delete)
await signIn("admin@demo.bil.test");
await page.goto(docUrl);
await page.getByRole("heading", { level: 1, name: TITLE }).waitFor();
for (let i = 0; i < 3; i++) {
  const btn = page.getByRole("button", { name: /^Archive$/ }).first();
  if ((await btn.count()) === 0) break;
  await btn.click();
  await page.getByRole("dialog").getByRole("button", { name: /^Archive / }).click();
  await page.waitForTimeout(900);
}
step("cleanup: archived the uploaded versions (API has no delete)");
await signOut();

await browser.close();
assert.deepEqual(errors, [], "no uncaught page errors");
console.log("WALKTHROUGH OK");
