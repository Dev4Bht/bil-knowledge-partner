// Saved chats in a real browser against the live stack and the real local model (one question, ~15-90 s).
// Usage: node e2e/chat-history.mjs  (web on :3470, API on :8000)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.WEB_URL ?? "http://localhost:3470";
const OUT = process.env.SHOT_DIR ?? new URL("../../../docs/screenshots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const QUESTION = "Does BIL's comprehensive motor insurance cover flood damage?";
// The list also shows the question as the chat title, so look for the question only inside the conversation itself.
const inConversation = () => page.locator('section[aria-label^="Question"]').getByText(QUESTION, { exact: true });
let failed = false;
const check = (ok, message) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
  if (!ok) failed = true;
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
const page = await context.newPage();
page.setDefaultTimeout(60_000);

await page.goto(`${BASE}/login`);
await page.getByLabel("Email").fill("staff@demo.bil.test");
await page.getByLabel("Password").fill("Demo-Pass-2026");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL("**/ask", { waitUntil: "commit" });

const composer = page.getByLabel("Your question");
await composer.waitFor();
await page.waitForFunction(() => !document.querySelector("#question")?.disabled);
check((await page.getByText(/No saved chats yet/).count()) + (await page.getByRole("navigation", { name: "Saved chats" }).count()) > 0, "the Chats panel is shown");

const countChats = () => page.locator('nav[aria-label="Saved chats"] li').count();
const before = await countChats(); // chats that already exist must be left exactly as they are
await composer.fill(QUESTION);
await page.getByRole("button", { name: "Ask", exact: true }).click();
await page.getByRole("heading", { name: "Answer" }).waitFor({ timeout: 240_000 });
check(true, "the real model answered");
await page.waitForFunction(() => location.search.includes("chat="));
const chatUrl = page.url();
check(chatUrl.includes("chat="), `the chat id is in the URL`);

const list = page.getByRole("navigation", { name: "Saved chats" });
await list.waitFor();
await list.getByRole("button", { name: /^Does BIL's comprehensive motor insurance/ }).first().waitFor(); // the list refreshes after the answer
check(true, "the new chat appears in the list with a title taken from the question");
await page.screenshot({ path: `${OUT}/chat-history-1280.png` });

await page.reload();
await inConversation().waitFor();
await page.getByRole("heading", { name: "Answer" }).waitFor();
check(true, "after a reload the same chat, question and full answer are back");

await page.getByRole("button", { name: "New chat", exact: true }).click();
await page.waitForFunction(() => !location.search.includes("chat="));
check((await inConversation().count()) === 0, "New chat clears the conversation and the URL");

await list.getByRole("button", { name: /^Does BIL/ }).first().click();
await inConversation().waitFor();
await page.getByRole("heading", { name: "Answer" }).waitFor();
check(true, "clicking the chat in the list re-opens it with its answer");

await page.getByRole("button", { name: /^Rename chat:/ }).first().focus();
await page.getByRole("button", { name: /^Rename chat:/ }).first().click();
const title = page.getByRole("textbox", { name: "Chat title" });
await title.fill("Flood cover, comprehensive motor");
await title.press("Enter");
await list.getByRole("button", { name: /^Flood cover, comprehensive motor/ }).waitFor();
check(true, "renaming changes the title in the list");

await page.getByRole("button", { name: /^Delete chat: Flood cover/ }).click();
const dialog = page.getByRole("dialog");
await dialog.waitFor();
check((await dialog.textContent()).includes("Flood cover, comprehensive motor"), "the delete dialog names the chat and asks first");
await page.screenshot({ path: `${OUT}/chat-delete-confirm-1280.png` });
await dialog.getByRole("button", { name: "Delete chat" }).click();
await page.getByText(/No saved chats yet|Chat deleted/).first().waitFor();
await page.waitForFunction(() => !location.search.includes("chat="));
check((await inConversation().count()) === 0, "after deleting, the open chat is closed and gone from the page");

await page.reload();
await page.getByLabel("Your question").waitFor();
await page.waitForTimeout(500);
check((await countChats()) === before, `it is still gone after a reload and the ${before} existing chat(s) were not touched`);
await browser.close();
process.exit(failed ? 1 : 0);
