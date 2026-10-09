import assert from "node:assert/strict";
import { GRID_FIELDS, addressOf, buildGrid, cellOf, colourOf, cssRgb, hAlign, paint, rgbOf, shadowsFor, stickyOffsets, themeMapOf } from "./src/lib/grid.js";
import { gridRange, parseRowText } from "./src/lib/sheet.js";
let n = 0;
const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error("FAIL:", name); throw e; } };

// helpers to write API-shaped cells the way Google returns them: a missing colour channel is 0
const fmt = (bg, extra = {}) => ({ backgroundColor: bg, backgroundColorStyle: { rgbColor: bg }, textFormat: {}, ...extra });
const val = (text, e = {}, u = undefined, more = {}) => ({ formattedValue: text, effectiveFormat: { ...fmt({ red: 1, green: 1, blue: 1 }), ...e }, ...(u ? { userEnteredFormat: u } : {}), ...more });
const BLACK = { backgroundColor: {}, backgroundColorStyle: { rgbColor: {} } };
const BLUE = { red: 0.26, green: 0.52, blue: 0.96 };

t("colours: missing channels are 0, theme colours resolve, the old field is the fallback", () => {
  assert.deepEqual(rgbOf({}), { r: 0, g: 0, b: 0 }); assert.deepEqual(rgbOf({ red: 1 }), { r: 255, g: 0, b: 0 });
  assert.equal(cssRgb(rgbOf(BLUE)), "rgb(66, 133, 245)");
  assert.equal(rgbOf(undefined), null);
  const theme = themeMapOf([{ colorType: "ACCENT1", color: { rgbColor: { red: 1, green: 0.5 } } }]);
  assert.deepEqual(colourOf({ themeColor: "ACCENT1" }, undefined, theme), { r: 255, g: 128, b: 0 });
  assert.deepEqual(colourOf(undefined, { blue: 1 }), { r: 0, g: 0, b: 255 });
  assert.equal(colourOf(undefined, undefined), null);
});

t("a plain empty cell costs nothing; a black filler cell is kept", () => {
  assert.equal(cellOf(undefined), null);
  assert.equal(cellOf({ effectiveFormat: fmt({ red: 1, green: 1, blue: 1 }) }), null);
  const filler = cellOf({ effectiveFormat: { ...BLACK, textFormat: {} } });
  assert.deepEqual(filler.bg, { r: 0, g: 0, b: 0 }); assert.equal(filler.v, "");
});

t("default white is 'no colour' (so dark mode can darken it), a chosen white is kept", () => {
  const plain = cellOf(val("hi")); assert.equal(plain.bg, null);
  const chosen = cellOf(val("hi", {}, fmt({ red: 1, green: 1, blue: 1 }))); assert.deepEqual(chosen.bg, { r: 255, g: 255, b: 255 });
  assert.deepEqual(paint(plain, true).bg, { r: 32, g: 33, b: 36 }); assert.deepEqual(paint(plain, false).bg, { r: 255, g: 255, b: 255 });
  assert.deepEqual(paint(chosen, true).bg, { r: 255, g: 255, b: 255 });      // stays white on the dark sheet, like the app
});

t("text colour: automatic follows the sheet, or contrast on a coloured cell; a chosen colour is kept", () => {
  assert.deepEqual(paint(cellOf(val("a")), true).fg, { r: 232, g: 234, b: 237 });
  assert.deepEqual(paint(cellOf(val("a")), false).fg, { r: 32, g: 33, b: 36 });
  const onBlue = cellOf(val("11", { backgroundColor: BLUE, backgroundColorStyle: { rgbColor: BLUE } }, fmt(BLUE)));
  assert.deepEqual(paint(onBlue, false).fg, { r: 255, g: 255, b: 255 });       // dark blue: white text
  const onRed = cellOf(val("5", fmt({ red: 0.9, green: 0.4, blue: 0.4 }), fmt({ red: 0.9, green: 0.4, blue: 0.4 })));
  assert.ok(paint(onRed, false).fg.r === 0 || paint(onRed, false).fg.r === 255);
  const white = cellOf(val("OFF", { textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 } } }, { textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 } } }));
  assert.deepEqual(white.fg, { r: 255, g: 255, b: 255 });
  const chosenBlack = cellOf(val("x", { textFormat: { foregroundColor: {} } }, { textFormat: { foregroundColor: {} } }));
  assert.deepEqual(chosenBlack.fg, { r: 0, g: 0, b: 0 });
});

t("alignment, wrapping, font", () => {
  assert.equal(hAlign(undefined, true, false), "right"); assert.equal(hAlign(undefined, false, false), "left"); assert.equal(hAlign(undefined, false, true), "center");
  assert.equal(hAlign("CENTER", true, false), "center");
  const c = cellOf(val("1:30 PM", { horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", wrapStrategy: "WRAP", textFormat: { bold: true, fontSize: 9 } }));
  assert.deepEqual([c.ha, c.va, c.wrap, c.bold, c.size], ["center", "middle", "wrap", true, 9]);
  assert.equal(cellOf(val("x", { wrapStrategy: "CLIP" })).wrap, "clip");
  assert.equal(cellOf(val("x")).wrap, "overflow");
});

t("borders become inset shadows, the freeze line first, the gridline last", () => {
  const c = cellOf(val("x", { borders: { bottom: { style: "SOLID_MEDIUM", color: {} }, top: { style: "NONE" } } }));
  assert.deepEqual(c.borders, [{ side: "bottom", w: 2, rgb: { r: 0, g: 0, b: 0 } }]);
  assert.equal(shadowsFor(c, { grid: true, gridline: "#ddd", freezeRight: "#999" }), "inset -2px 0 0 0 #999, inset 0 -2px 0 0 rgb(0, 0, 0), inset -1px -1px 0 0 #ddd");
  assert.equal(shadowsFor(null, { grid: false }), "");
});

// a roster like the screenshot: 2 title rows + a date header, names in column B, 1 hidden helper column, a merged banner
function roster() {
  const rowData = [
    { values: [{}, val("October 2026", { textFormat: { bold: true, fontSize: 14 } }, undefined, {}), val("", BLACK)] },
    { values: [{}, val("Name", { ...BLACK, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true } }, { ...BLACK, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 } } }), val("Mon")] },
    { values: [{}, val("Raziq"), val("9.30AM", fmt({ red: 0.8, green: 0.88, blue: 0.92 }), fmt({ red: 0.8, green: 0.88, blue: 0.92 }), { note: "swap with Jay" })] },
    { values: [{}, val("Bernard (Tier 3)"), val("8.5", { horizontalAlignment: "CENTER" }, undefined, { effectiveValue: { numberValue: 8.5 } })] },
    { values: [] }, { values: [] }, { values: [] }, { values: [] }, { values: [] }, { values: [] },
  ];
  return {
    properties: { sheetId: 7, title: "Oct", gridProperties: { rowCount: 1000, columnCount: 26, frozenRowCount: 2, frozenColumnCount: 2 } },
    merges: [{ startRowIndex: 0, endRowIndex: 1, startColumnIndex: 1, endColumnIndex: 3 }],
    data: [{ startRow: 0, startColumn: 0, rowData,
      rowMetadata: [{ pixelSize: 30 }, { pixelSize: 24 }, { pixelSize: 40, hiddenByUser: true }, { pixelSize: 35 }],
      columnMetadata: [{ pixelSize: 10, hiddenByUser: true }, { pixelSize: 120 }, { pixelSize: 60 }] }],
  };
}
t("buildGrid: hidden rows and columns drop out, sizes come from the sheet, the used area is trimmed", () => {
  const g = buildGrid(roster(), [], { rows: 150, cols: 60 });
  assert.deepEqual(g.colIdx, [1, 2]); assert.deepEqual(g.colW, [120, 60]);                  // column A (hidden) is gone
  assert.ok(!g.rowIdx.includes(2)); assert.deepEqual(g.rowH.slice(0, 2), [30, 24]);        // row 3 (hidden) is gone, 30 then 24 px
  assert.ok(g.rowIdx.length <= 7 && g.colIdx.length === 2);                                // not 10 empty rows, not 26 columns
  assert.equal(g.frozenRows, 2); assert.equal(g.frozenCols, 1);                            // frozen counts only what is visible
  assert.equal(g.hideGridlines, false); assert.equal(g.more, false);
  assert.equal(g.cell(3, 1).v, "Bernard (Tier 3)"); assert.equal(g.cell(3, 2).ha, "center");
  assert.equal(g.cell(2, 2).v, "9.30AM");                                                   // the hidden row's cell is still in the matrix, just not drawn
});

t("buildGrid: a merge becomes one spanning cell and the cells under it are skipped", () => {
  const g = buildGrid(roster(), []);
  assert.deepEqual(g.span.get("0,1"), { rs: 1, cs: 2 });
  assert.ok(g.covered.has("0,2") && !g.covered.has("0,1"));
  const hiddenAnchor = roster(); hiddenAnchor.merges = [{ startRowIndex: 2, endRowIndex: 3, startColumnIndex: 1, endColumnIndex: 3 }];
  assert.equal(buildGrid(hiddenAnchor, []).span.size, 0);                                   // an anchor on a hidden row is ignored, not crashed on
});

t("buildGrid: 'more' says the window came back full, a note is kept, frozen counts are capped", () => {
  const full = roster(); full.data[0].rowData = Array.from({ length: 150 }, (_, i) => ({ values: [{}, val(`r${i}`)] }));
  assert.equal(buildGrid(full, [], { rows: 150, cols: 60 }).more, true);
  assert.equal(buildGrid(full, [], { rows: 150, cols: 60, total: 150 }).more, false);          // the tab has exactly 150 rows: nothing more to load
  assert.equal(buildGrid(roster(), []).cell(2, 2).note, "swap with Jay");
  const tiny = { properties: { gridProperties: { frozenRowCount: 5, frozenColumnCount: 5 } }, data: [{ rowData: [{ values: [val("a")] }] }] };
  const g = buildGrid(tiny, []); assert.deepEqual([g.frozenRows, g.frozenCols], [1, 1]);
  const empty = buildGrid({}, []); assert.deepEqual([empty.rowIdx.length, empty.colIdx.length], [0, 0]);
});

t("sticky offsets add up behind the row numbers and the column letters, scaled by zoom", () => {
  const g = buildGrid(roster(), []);
  const o = stickyOffsets(g, 34, 22, 1); assert.deepEqual(o.left, [34]); assert.deepEqual(o.top, [22, 52]);
  assert.deepEqual(stickyOffsets(g, 34, 22, 2).left, [68]);
  const z = stickyOffsets(g, 34, 22, 0.8); assert.deepEqual([z.left, z.top], [[27], [18, 42]]);   // 17.6 and 24 px round to whole pixels, as drawn
});

t("ranges and typed rows", () => {
  assert.equal(gridRange("Oct", 150, 60), "Oct!A1:BH150"); assert.equal(gridRange("Summary 2", 10, 3), "'Summary 2'!A1:C10"); assert.equal(gridRange("It's", 0, 0), "'It''s'!A1:A1");
  assert.deepEqual(parseRowText("Jay, Tier 3, 8.5"), ["Jay", "Tier 3", "8.5"]);
  assert.deepEqual(parseRowText('"Lee, Ann",5'), ["Lee, Ann", "5"]);
  assert.deepEqual(parseRowText("a\tb\t\tc"), ["a", "b", "", "c"]);
  assert.deepEqual(parseRowText("first\nsecond"), ["first"]); assert.deepEqual(parseRowText("   "), []);
  assert.equal(addressOf(9, 1), "B10"); assert.equal(addressOf(0, 26), "AA1");
  assert.ok(GRID_FIELDS.startsWith("properties(title,spreadsheetTheme(themeColors)),sheets(properties(sheetId,title,gridProperties),merges,data("));
  assert.equal((GRID_FIELDS.match(/\(/g) || []).length, (GRID_FIELDS.match(/\)/g) || []).length);   // brackets balance: Google rejects a broken mask
});

console.log(`grid.test.mjs: ${n} groups OK`);
