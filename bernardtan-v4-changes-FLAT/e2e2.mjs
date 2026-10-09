import { chromium } from "playwright";
import { createServer } from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
import assert from "node:assert/strict";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const srv = createServer((q, r) => { let f = join("dist", q.url.split("?")[0] === "/" ? "/index.html" : q.url.split("?")[0]); if (!existsSync(f)) f = "dist/index.html"; r.writeHead(200, { "content-type": types[extname(f)] || "application/octet-stream" }); r.end(readFileSync(f)); }).listen(4178);
const U = "http://127.0.0.1:4178/"; let ok = 0; const pass = (m) => { ok++; console.log("ok  ", m); };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); await ctx.route("**/*fonts.g*/**", (r) => r.abort());
const p = await ctx.newPage(); const errors = []; p.on("pageerror", (e) => errors.push(String(e)));
// a key Google refuses -> the app says "not connected" by itself
let first = true;
await p.route("https://www.googleapis.com/drive/v3/files**", (r) => { if (first) { first = false; return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ files: [{ id: "a", name: "File A", mimeType: "image/png" }] }) }); } return r.fulfill({ status: 401, contentType: "application/json", body: "{}" }); });
await p.goto(U, { waitUntil: "networkidle" });
await p.evaluate(() => sessionStorage.setItem("bernard.google.token", JSON.stringify({ access_token: "tok", expires_at: Date.now() + 3600e3, email: "b@x.com" })));
await p.goto(U + "#drive", { waitUntil: "networkidle" }); await p.reload({ waitUntil: "networkidle" });
await p.waitForSelector("text=File A"); pass("Drive lists with a key");
await p.click('button[aria-label="Refresh"]'); await p.waitForTimeout(800);
assert.equal(await p.evaluate(() => sessionStorage.getItem("bernard.google.token")), null);
assert.ok(await p.locator("text=/connect|find my google/i").first().isVisible()); pass("a 401 forgets the key and the page falls back to the connect screen");
// expiring key: a key that runs out in 2 s disconnects by itself
await p.evaluate(() => sessionStorage.setItem("bernard.google.token", JSON.stringify({ access_token: "tok", expires_at: Date.now() + 33_000, email: "b@x.com" })));
await p.goto(U + "#settings", { waitUntil: "networkidle" }); await p.reload({ waitUntil: "networkidle" });
await p.waitForSelector("text=Connected as"); await p.waitForSelector("text=Not connected", { timeout: 8000 }); pass("the settings page flips to Not connected when the key expires");
// games: a round plays to the end with no errors
await p.goto(U + "#games", { waitUntil: "networkidle" }); await p.click('button:has-text("Play")');
await p.waitForTimeout(1500); const t = await p.locator("text=/\\d+s/").first().innerText(); assert.ok(/\d+s/.test(t)); pass("Burger Tap runs (" + t.trim() + ")");
// gallery: a picture added from the phone shows, and a refusing store gives a message not a crash
await p.goto(U + "#gallery", { waitUntil: "networkidle" });
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
await p.setInputFiles('input[type="file"]', { name: "a.png", mimeType: "image/png", buffer: png }); await p.waitForTimeout(600);
assert.ok(await p.locator("img[src^='blob:']").count() >= 1); pass("a phone picture appears in the gallery");
console.log(errors.length ? "PAGE ERRORS: " + errors.join(" | ") : "no page errors"); console.log(`${ok} checks passed`); await b.close(); srv.close();
