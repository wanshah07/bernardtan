import { chromium } from "playwright";
import { createServer } from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
import assert from "node:assert/strict";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const srv = createServer((q, r) => { let f = join("dist", q.url.split("?")[0] === "/" ? "/index.html" : q.url.split("?")[0]); if (!existsSync(f)) f = "dist/index.html"; r.writeHead(200, { "content-type": types[extname(f)] || "application/octet-stream" }); r.end(readFileSync(f)); }).listen(4177);
const U = "http://127.0.0.1:4177/";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const errors = []; let ok = 0; const pass = (m) => { ok++; console.log("ok  ", m); };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route("**/*fonts.g*/**", (r) => r.abort());
const p = await ctx.newPage(); p.on("pageerror", (e) => errors.push(String(e)));
const type = async (digits) => { for (const d of digits) await p.click(`button:has-text("${d}")`, { timeout: 2000 }).catch(async () => { await p.keyboard.type(d); }); };

// ---- theme colour follows the theme, before first paint ---------------------------------------------------------------
await p.addInitScript(() => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("bernard.theme", "night"); } });
await p.goto(U + "#settings", { waitUntil: "networkidle" });
assert.equal(await p.evaluate(() => document.querySelector('meta[name="theme-color"]').content), "#201816"); pass("theme-color is the night colour at load");
await p.click('button:has-text("Night-light")');
assert.equal(await p.evaluate(() => document.querySelector('meta[name="theme-color"]').content), "#0E1626");
assert.equal(await p.evaluate(() => localStorage.getItem("bernard.theme")), "glow"); pass("choosing a theme moves the status-bar colour and is remembered");

// ---- lock: set a 6-digit PIN --------------------------------------------------------------------------------------------
await p.fill('input[placeholder^="PIN"]', "123456"); await p.fill('input[placeholder="Again"]', "123456");
await p.click('button:has-text("Set PIN")'); await p.waitForSelector("text=PIN set");
pass("6-digit PIN set");
// changing it needs the current PIN
await p.fill('input[placeholder="New PIN"]', "654321"); await p.fill('input[placeholder="Again"]', "654321");
await p.click('button:has-text("Change PIN")'); await p.waitForSelector("text=not right");
pass("change refused without the current PIN");
await p.click('button:has-text("Remove the lock")'); await p.waitForSelector("text=not right");
assert.ok(await p.evaluate(() => !!localStorage.getItem("bernard.lock.pin"))); pass("remove refused without the current PIN, lock still there");
await p.fill('input[aria-label="Current PIN"]', "123456"); await p.fill('input[placeholder="New PIN"]', "654321"); await p.fill('input[placeholder="Again"]', "654321");
await p.click('button:has-text("Change PIN")'); await p.waitForSelector("text=PIN set");
pass("change works with the current PIN");
// wrong tries: after locking, a 6-digit wrong PIN counts ONE failure, not one per digit
await p.click('button:has-text("Lock now")'); await p.waitForTimeout(300);
await type("111111"); await p.waitForTimeout(600);
const tries = await p.evaluate(() => JSON.parse(localStorage.getItem("bernard.lock.tries") || "{}").n || 0);
assert.equal(tries, 1, "tries=" + tries); pass("a wrong 6-digit PIN counts exactly one failure");
await type("654321"); await p.waitForTimeout(600);
assert.ok(await p.locator("text=Settings").first().isVisible()); pass("the right PIN opens the app");

// ---- reminders ----------------------------------------------------------------------------------------------------------
await p.goto(U + "#reminders", { waitUntil: "networkidle" });
await p.evaluate(() => localStorage.removeItem("bernard.lock.pin"));
await p.reload({ waitUntil: "networkidle" });
const put = (list) => p.evaluate((l) => localStorage.setItem("bernard.reminders", JSON.stringify(l)), list);
const mk = (id, title, ms, repeat) => ({ id, title, note: "", at: new Date(Date.now() - ms).toISOString(), repeat, done: false, lead: 0 });
// a one-off that is overdue still rings, and Got it marks it done
await put([mk("r1", "Pay supplier", 5 * 60_000, "none")]); await p.reload({ waitUntil: "networkidle" }); await p.waitForTimeout(400);
assert.equal(await p.locator('button:has-text("Got it")').count(), 1); pass("an overdue one-off rings");
await p.click('button:has-text("Got it")'); await p.waitForTimeout(300);
assert.equal(await p.locator('button:has-text("Got it")').count(), 0);
assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem("bernard.reminders"))[0].done), true); pass("Got it clears it and marks the one-off done");
// a daily one that just came due rings once, is dismissed for this occurrence, and stays in the list for tomorrow
await put([mk("r2", "Open the shop", 10_000, "daily")]); await p.reload({ waitUntil: "networkidle" }); await p.waitForTimeout(400);
assert.equal(await p.locator('button:has-text("Got it")').count(), 1); pass("a daily reminder that just came due rings");
await p.click('button:has-text("Got it")'); await p.waitForTimeout(300);
const kept = await p.evaluate(() => JSON.parse(localStorage.getItem("bernard.reminders"))[0]);
assert.equal(kept.done, false); pass("Got it on a daily one does not finish it");
await p.waitForTimeout(21_000);
assert.equal(await p.locator('button:has-text("Got it")').count(), 0); pass("it does not ring again on the next 20 s check");
// the form: after saving, the time moves to an hour from now instead of staying on the old one
await p.fill('input[placeholder^="What"]', "Test one");
await p.fill('input[type="datetime-local"]', "2026-12-01T09:00");
await p.click('button[type="submit"]'); await p.waitForTimeout(300);
const after = await p.inputValue('input[type="datetime-local"]');
assert.notEqual(after, "2026-12-01T09:00"); pass("the form's time resets after saving (" + after + ")");
console.log(errors.length ? "PAGE ERRORS: " + errors.join(" | ") : "no page errors");
console.log(`${ok} checks passed`); await b.close(); srv.close();
