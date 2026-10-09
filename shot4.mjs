import { chromium } from "playwright";
import { createServer } from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const srv = createServer((q, r) => { let f = join("dist", q.url.split("?")[0] === "/" ? "/index.html" : q.url.split("?")[0]); if (!existsSync(f)) f = "dist/index.html"; r.writeHead(200, { "content-type": types[extname(f)] || "application/octet-stream" }); r.end(readFileSync(f)); }).listen(4176);
const out = "/tmp/claude-0/-home-user-argus/d8921184-642c-5a37-b275-e53fec93bb35/scratchpad/";

// ---- a roster shaped like the screenshot ------------------------------------------------------------------------------
const C = { white: { red: 1, green: 1, blue: 1 }, black: {}, lblue: { red: 0.81, green: 0.89, blue: 0.95 }, purple: { red: 0.6, green: 0.5, blue: 0.82 }, blue: { red: 0.26, green: 0.52, blue: 0.96 },
  red: { red: 0.9, green: 0.4, blue: 0.4 }, green: { red: 0.58, green: 0.77, blue: 0.49 }, grey: { red: 0.62, green: 0.62, blue: 0.62 }, dgrey: { red: 0.4, green: 0.4, blue: 0.4 }, banner: { red: 1, green: 0, blue: 0 } };
const cell = (text, bg = C.white, o = {}) => ({ formattedValue: text, ...(o.num !== undefined ? { effectiveValue: { numberValue: o.num } } : {}), ...(o.note ? { note: o.note } : {}),
  effectiveFormat: { backgroundColor: bg, backgroundColorStyle: { rgbColor: bg }, horizontalAlignment: o.ha || "CENTER", verticalAlignment: "MIDDLE", wrapStrategy: o.wrap || "WRAP",
    textFormat: { ...(o.fg ? { foregroundColor: o.fg, foregroundColorStyle: { rgbColor: o.fg } } : {}), bold: !!o.bold, fontSize: o.size || 9 } },
  userEnteredFormat: bg === C.white && !o.userWhite ? {} : { backgroundColor: bg, backgroundColorStyle: { rgbColor: bg }, ...(o.fg ? { textFormat: { foregroundColor: o.fg } } : {}) } });
const DAYS = 31, names = ["Raziq", "Jay (Tier 3)", "Zainatun (Tier 3)", "Adib (Intern)", "", "Bernard (Tier 3)", "Isya (Tier 3)", "Jazmine (Tier 3)", "Keeyan (Tier 2)", "Ryan", "Sophia (Tier 0)", "Saiful (Tier 0)", "Alissa (Tier 0)", "", "Syah", "", "Khirtena (Tier 1)", "Saiful (Tier 2)", "Mai (Tier 1)", "Karina (Tier 1)", "Zafar (Tier 0)", "Nadia (Tier 0)"];
const shiftFor = (n, d) => { const k = (n * 7 + d * 3) % 11; return k === 0 ? ["OFF", C.dgrey, { fg: C.white }] : k === 1 ? ["5.5", C.purple, { fg: C.white }] : k === 2 ? ["11", C.blue, { fg: C.white }] : k === 3 ? ["5", C.red, { fg: C.white }] : k === 4 ? ["10.5", C.green, {}] : k === 5 ? ["", C.black, {}] : ["8.5", C.white, { num: 8.5 }]; };
const dayName = (d) => ["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed"][d % 7];
const rowData = [];
rowData.push({ values: [] });                                                                                                          // row 1
rowData.push({ values: [cell("", C.black), cell("October 2026", C.black, { fg: C.white, bold: true, size: 14, ha: "LEFT" }), ...Array.from({ length: DAYS }, (_, d) => cell(dayName(d), C.black, { fg: C.white, bold: true }))] });
rowData.push({ values: [cell("", C.black), cell("", C.black), ...Array.from({ length: DAYS }, (_, d) => cell(String(d + 1), C.white, { userWhite: true, bold: true }))] });
rowData.push({ values: [cell("", C.black), cell("Name", C.black, { fg: C.white, bold: true }), ...Array.from({ length: DAYS }, () => cell("", C.black))] });
names.forEach((nm, n) => {
  if (!nm) { rowData.push({ values: [cell("", C.black), cell("", C.black), ...Array.from({ length: DAYS }, () => cell("", C.black))] }); return; }
  rowData.push({ values: [cell("", C.black), cell(nm, C.white, { userWhite: true, bold: true }), ...Array.from({ length: DAYS }, (_, d) => { const [t, bg, o] = shiftFor(n, d); return cell(t, bg, { ...o, ...(n === 0 && d === 3 ? { note: "Opening with Jay" } : {}) }); })] });
});
rowData.splice(19, 0, { values: [cell("", C.black), ...Array.from({ length: DAYS + 1 }, () => cell("", C.banner))] });                        // the red divider row, row 20
const gridResp = (title) => ({ properties: { title: "Rota 2026" }, sheets: [{ properties: { sheetId: title === "Oct" ? 11 : 12, title, gridProperties: { rowCount: 1000, columnCount: 40, frozenRowCount: 4, frozenColumnCount: 2 } },
  merges: [], data: [{ startRow: 0, startColumn: 0, rowData: title === "Oct" ? rowData : rowData.slice(0, 8),
    rowMetadata: rowData.map((_, i) => ({ pixelSize: i === 0 ? 8 : i === 1 ? 30 : i === 2 ? 26 : i === 3 ? 28 : i === 19 ? 18 : 36 })),
    columnMetadata: [{ pixelSize: 4, hiddenByUser: true }, { pixelSize: 130 }, ...Array.from({ length: DAYS }, () => ({ pixelSize: 44 }))] }] }] });
const metaResp = { properties: { title: "Rota 2026" }, sheets: [{ properties: { sheetId: 11, title: "Oct", index: 0, sheetType: "GRID", gridProperties: { rowCount: 1000, columnCount: 40 } } }, { properties: { sheetId: 12, title: "Sep", index: 1, sheetType: "GRID", gridProperties: { rowCount: 500, columnCount: 40 } } },
  { properties: { sheetId: 13, title: "Summary", index: 2, sheetType: "GRID", gridProperties: { rowCount: 100, columnCount: 12 } } }, { properties: { sheetId: 14, title: "Old", index: 3, hidden: true, sheetType: "GRID", gridProperties: { rowCount: 10, columnCount: 5 } } }] };

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const errors = [], gridCalls = [];
for (const [name, vp] of [["phone", { width: 390, height: 844 }], ["desktop", { width: 1280, height: 900 }]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errors.push(`${name}: ${e}`)); p.on("console", (m) => { if (m.type() === "error") errors.push(`${name} console: ${m.text()}`); });
  await p.route("https://sheets.googleapis.com/v4/spreadsheets/**", (route) => {
    const u = new URL(route.request().url()); const j = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (u.searchParams.get("includeGridData") === "true") { const r = u.searchParams.get("ranges"); if (name === "phone") gridCalls.push({ ranges: r, fields: u.searchParams.get("fields") }); return j(gridResp(r.startsWith("Sep") ? "Sep" : "Oct")); }
    return j(metaResp);
  });
  await p.route("https://www.googleapis.com/drive/v3/files**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ files: [{ id: "rota1234567890abcdefghij", name: "Rota 2026", mimeType: "application/vnd.google-apps.spreadsheet", modifiedTime: "2026-10-09T08:00:00Z" }] }) }));
  await p.goto("http://127.0.0.1:4176/", { waitUntil: "networkidle" });
  await p.evaluate(() => { localStorage.setItem("bernard.theme", "glow"); localStorage.setItem("bernard.sheet.last", "rota1234567890abcdefghij"); sessionStorage.setItem("bernard.google.token", JSON.stringify({ access_token: "tok", expires_at: Date.now() + 3600e3, email: "b@x.com" })); });
  await p.goto("http://127.0.0.1:4176/#sheet", { waitUntil: "networkidle" }); await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector(".gs-table td", { timeout: 8000 }); await p.waitForTimeout(400);
  if (name === "phone") {
    // the freeze: the Name column and the header rows must not move when the grid is scrolled
    const pos = () => p.evaluate(() => { const nm = [...document.querySelectorAll(".gs-table td")].find((t) => t.textContent === "Raziq"); const hd = [...document.querySelectorAll(".gs-table td")].find((t) => t.textContent === "Name"); const sc = document.querySelector(".gs-scroll"); const r = (e) => { const x = e.getBoundingClientRect(); return [Math.round(x.left), Math.round(x.top)]; }; return { raziq: r(nm), nameHead: r(hd), sl: sc.scrollLeft, st: sc.scrollTop }; });
    const before = await pos();
    await p.evaluate(() => { const sc = document.querySelector(".gs-scroll"); sc.scrollLeft = 500; sc.scrollTop = 200; }); await p.waitForTimeout(200);
    const after = await pos();
    console.log("freeze: Name column left before/after scroll:", before.raziq[0], after.raziq[0], "| header row top before/after:", before.nameHead[1], after.nameHead[1], "| scrolled to", after.sl, after.st);
    await p.screenshot({ path: `${out}bernard4-phone-scrolled.png` });
    await p.evaluate(() => { const sc = document.querySelector(".gs-scroll"); sc.scrollLeft = 0; sc.scrollTop = 0; }); await p.waitForTimeout(100);
    await p.click(".gs-table td[data-r='5'][data-c='4']"); await p.waitForTimeout(150);
    console.log("formula bar:", JSON.stringify(await p.locator(".gs-fbar").innerText()));
    await p.click(".gs-table td[data-r='4'][data-c='5']"); await p.waitForTimeout(150);
    console.log("note shown:", await p.locator("text=/Note: /").count() > 0, "| tabs:", JSON.stringify(await p.locator("[role=tab]").allInnerTexts()));
    await p.click("[role=tab]:has-text('Sep')"); await p.waitForTimeout(500);
    console.log("tab switched; Sep selected:", await p.locator("[role=tab][aria-selected=true]").innerText(), "| grid requests so far:", gridCalls.length);
    await p.click("button[aria-label='All sheets']"); await p.waitForTimeout(150);
    console.log("menu lists hidden tab:", await p.locator(".gs-menu >> text=Old").count() > 0);
    await p.screenshot({ path: `${out}bernard4-phone-menu.png` }); await p.keyboard.press("Escape"); await p.click("button[aria-label='All sheets']");
    await p.click("[role=tab]:has-text('Oct')"); await p.waitForTimeout(400);
    await p.click("button[aria-label='Zoom out']"); await p.waitForTimeout(200);
  }
  await p.screenshot({ path: `${out}bernard4-${name}.png` }); await p.locator("section.card:has(.gs)").screenshot({ path: `${out}bernard4-${name}-card.png` });
  await ctx.close();
}
const c0 = gridCalls[0];
console.log("first grid request ranges:", c0.ranges, "| asks for formatting:", /effectiveFormat/.test(c0.fields), "| brackets balance:", (c0.fields.match(/\(/g) || []).length === (c0.fields.match(/\)/g) || []).length);
console.log("ranges asked:", gridCalls.map((g) => g.ranges).join("  |  "));
console.log("errors:", errors.length ? errors : "none");
await b.close(); srv.close();
