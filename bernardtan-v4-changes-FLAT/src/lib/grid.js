/* The sheet grid: the Google Sheets API's cell data (values, colours, merges, frozen panes, hidden rows and columns, borders)
   turned into a plain model the page can draw like the Sheets app does. No imports but sheet.js, so grid.test.mjs runs it
   under Node. The page draws; this decides what is drawn. */
import { colLetter } from "./sheet.js";

export const DEFAULT_COL = 100;     // the Sheets default column width, px
export const DEFAULT_ROW = 21;      // and row height
export const WINDOW_ROWS = 150;     // how many rows one request asks for
export const WINDOW_COLS = 60;      // and columns (A to BH)

/** The `fields` mask for spreadsheets.get with includeGridData: only what the grid draws. Brackets must balance or Google
    refuses the request (grid.test.mjs counts them). */
export const GRID_FIELDS =
  "properties(title,spreadsheetTheme(themeColors))," +
  "sheets(" +
    "properties(sheetId,title,gridProperties)," +
    "merges," +
    "data(" +
      "startRow,startColumn," +
      "rowMetadata(pixelSize,hiddenByUser,hiddenByFilter)," +
      "columnMetadata(pixelSize,hiddenByUser,hiddenByFilter)," +
      "rowData(values(" +
        "formattedValue,effectiveValue(numberValue,boolValue),hyperlink,note," +
        "userEnteredFormat(backgroundColor,backgroundColorStyle,textFormat(foregroundColor,foregroundColorStyle))," +
        "effectiveFormat(backgroundColor,backgroundColorStyle," +
          "textFormat(foregroundColor,foregroundColorStyle,fontSize,bold,italic,strikethrough,underline)," +
          "horizontalAlignment,verticalAlignment,wrapStrategy,borders)" +
      "))" +
    ")" +
  ")";

const ch = (v) => Math.round(Math.min(1, Math.max(0, Number(v) || 0)) * 255);
/** An API colour {red,green,blue} (0..1, a missing channel is 0) → {r,g,b}; null when there is no colour at all. */
export const rgbOf = (c) => (c && typeof c === "object" ? { r: ch(c.red), g: ch(c.green), b: ch(c.blue) } : null);
export const cssRgb = (o) => (o ? `rgb(${o.r}, ${o.g}, ${o.b})` : "");
export const isWhite = (o) => !!o && o.r === 255 && o.g === 255 && o.b === 255;
export const isBlack = (o) => !!o && o.r === 0 && o.g === 0 && o.b === 0;
/** Perceived brightness 0..1, to choose readable text on a coloured cell. */
export const luminance = (o) => (o ? (0.2126 * o.r + 0.7152 * o.g + 0.0722 * o.b) / 255 : 1);

/** {ACCENT1: {r,g,b}, …} out of the sheet's theme colours, for cells coloured with a theme colour. */
export function themeMapOf(themeColors) {
  const m = {};
  for (const t of themeColors || []) if (t?.colorType) m[t.colorType] = rgbOf(t.color?.rgbColor || t.color);
  return m;
}
/** A ColorStyle ({rgbColor} or {themeColor}) or the older plain colour → {r,g,b}, or null when neither is set. */
export function colourOf(style, legacy, theme = {}) {
  if (style?.rgbColor) return rgbOf(style.rgbColor);
  if (style?.themeColor && theme[style.themeColor]) return theme[style.themeColor];
  return legacy ? rgbOf(legacy) : null;
}

const BORDER_W = { SOLID: 1, DASHED: 1, DOTTED: 1, SOLID_MEDIUM: 2, SOLID_THICK: 3, DOUBLE: 3 };
/** Horizontal alignment: what the cell says, else the Sheets default (numbers right, true/false centred, text left). */
export function hAlign(explicit, isNum, isBool) {
  if (explicit === "CENTER") return "center";
  if (explicit === "RIGHT") return "right";
  if (explicit === "LEFT") return "left";
  return isNum ? "right" : isBool ? "center" : "left";
}
export const vAlign = (a) => (a === "TOP" ? "top" : a === "MIDDLE" ? "middle" : "bottom");

/** One API cell → what the page draws, or null when it is plain and empty (so a big empty sheet costs nothing).
    `bg: null` means the default background (which the dark theme turns dark); a set colour, even white, is kept as is. */
export function cellOf(v, theme = {}) {
  if (!v) return null;
  const e = v.effectiveFormat || {}, u = v.userEnteredFormat || {};
  const bgRgb = colourOf(e.backgroundColorStyle, e.backgroundColor, theme);
  const userBg = !!(u.backgroundColorStyle || u.backgroundColor);
  const bg = bgRgb && !(isWhite(bgRgb) && !userBg) ? bgRgb : null;
  const fgRgb = colourOf(e.textFormat?.foregroundColorStyle, e.textFormat?.foregroundColor, theme);
  const userFg = !!(u.textFormat?.foregroundColorStyle || u.textFormat?.foregroundColor);
  const fg = fgRgb && !(isBlack(fgRgb) && !userFg) ? fgRgb : null;
  const text = v.formattedValue == null ? "" : String(v.formattedValue);
  const isNum = v.effectiveValue?.numberValue !== undefined, isBool = v.effectiveValue?.boolValue !== undefined;
  const borders = [];
  for (const side of ["top", "bottom", "left", "right"]) {
    const b = e.borders?.[side];
    if (b && b.style && b.style !== "NONE") borders.push({ side, w: BORDER_W[b.style] || 1, rgb: colourOf(b.colorStyle, b.color, theme) || { r: 0, g: 0, b: 0 } });
  }
  const t = e.textFormat || {};
  if (!text && !bg && !borders.length && !v.note) return null;
  return {
    v: text, bg, fg, borders, note: v.note || "", link: v.hyperlink || "",
    bold: !!t.bold, italic: !!t.italic, strike: !!t.strikethrough, underline: !!t.underline, size: Number(t.fontSize) || 10,
    ha: hAlign(e.horizontalAlignment, isNum, isBool), va: vAlign(e.verticalAlignment),
    wrap: e.wrapStrategy === "WRAP" ? "wrap" : e.wrapStrategy === "CLIP" ? "clip" : "overflow",
  };
}

/** The whole model for one tab. `sheet` is `response.sheets[0]` of a spreadsheets.get with includeGridData, `asked` is the
    window that was requested ({rows, cols}). Rows and columns the user hid are left out; the used area is trimmed (plus a
    few spare rows) so an almost-empty 1000 x 26 sheet is not drawn in full; merged cells become one spanning cell. */
export function buildGrid(sheet, themeColors, asked = { rows: WINDOW_ROWS, cols: WINDOW_COLS, total: Infinity }) {
  const theme = Array.isArray(themeColors) ? themeMapOf(themeColors) : themeColors || {};
  const gp = sheet?.properties?.gridProperties || {};
  const data = sheet?.data?.[0] || {};
  const rowData = data.rowData || [], rowMeta = data.rowMetadata || [], colMeta = data.columnMetadata || [];
  const nRows = Math.max(rowData.length, rowMeta.length, 0);
  const nCols = Math.max(colMeta.length, ...rowData.map((r) => (r.values || []).length), 0);
  const matrix = [];
  let lastRow = -1, lastCol = -1;
  for (let r = 0; r < nRows; r++) {
    const row = [];
    const vals = rowData[r]?.values || [];
    for (let c = 0; c < nCols; c++) {
      const cell = cellOf(vals[c], theme);
      row.push(cell);
      if (cell) { if (r > lastRow) lastRow = r; if (c > lastCol) lastCol = c; }
    }
    matrix.push(row);
  }
  const fr = Math.min(gp.frozenRowCount || 0, nRows), fc = Math.min(gp.frozenColumnCount || 0, nCols);
  const rowsN = Math.min(nRows, Math.max(lastRow + 1 + 3, fr + 1, 1));
  const colsN = Math.min(nCols, Math.max(lastCol + 1 + 1, fc + 1, 1));
  const hidden = (m) => !!(m?.hiddenByUser || m?.hiddenByFilter);
  const rowIdx = [], colIdx = [];
  for (let r = 0; r < rowsN; r++) if (!hidden(rowMeta[r])) rowIdx.push(r);
  for (let c = 0; c < colsN; c++) if (!hidden(colMeta[c])) colIdx.push(c);
  const rowH = rowIdx.map((r) => rowMeta[r]?.pixelSize || DEFAULT_ROW);
  const colW = colIdx.map((c) => colMeta[c]?.pixelSize || DEFAULT_COL);
  const visRow = new Set(rowIdx), visCol = new Set(colIdx);
  const span = new Map(), covered = new Set();
  for (const m of sheet?.merges || []) {
    const r0 = m.startRowIndex ?? 0, r1 = m.endRowIndex ?? r0 + 1, c0 = m.startColumnIndex ?? 0, c1 = m.endColumnIndex ?? c0 + 1;
    if (!visRow.has(r0) || !visCol.has(c0)) continue;
    const rs = rowIdx.filter((r) => r >= r0 && r < r1).length, cs = colIdx.filter((c) => c >= c0 && c < c1).length;
    if (rs * cs <= 1) continue;
    span.set(`${r0},${c0}`, { rs, cs });
    for (const r of rowIdx) for (const c of colIdx) if (r >= r0 && r < r1 && c >= c0 && c < c1 && !(r === r0 && c === c0)) covered.add(`${r},${c}`);
  }
  return {
    rowIdx, colIdx, rowH, colW, matrix, span, covered,
    frozenRows: rowIdx.filter((r) => r < fr).length, frozenCols: colIdx.filter((c) => c < fc).length,
    hideGridlines: !!gp.hideGridlines,
    // the request came back full and the content runs to its end: there are probably more rows below
    more: nRows >= asked.rows && (asked.total ?? Infinity) > asked.rows && lastRow >= nRows - 3,
    cell: (r, c) => matrix[r]?.[c] || null,
  };
}

export const addressOf = (r, c) => `${colLetter(c + 1)}${r + 1}`;

/** Cumulative sticky offsets: the left edge of each frozen column and the top edge of each frozen row, after the row-number
    column (`headW`) and the column-letter row (`headH`). Everything scaled by `zoom` and rounded to whole pixels. */
export function stickyOffsets(model, headW, headH, zoom = 1) {
  const px = (n) => Math.max(1, Math.round(n * zoom));        // the same rounding the drawing uses, or the pinned rows drift
  const left = [], top = [];
  let x = px(headW), y = px(headH);
  for (let i = 0; i < model.frozenCols; i++) { left.push(x); x += px(model.colW[i]); }
  for (let i = 0; i < model.frozenRows; i++) { top.push(y); y += px(model.rowH[i]); }
  return { left, top, width: x, height: y };
}

/** The inset box-shadows that draw a cell's borders (top first = on top), then the thin gridline on its right and bottom. */
export function shadowsFor(cell, { grid, gridline = "#e1e3e6", freezeRight = "", freezeBottom = "" }) {
  const out = [];
  if (freezeRight) out.push(`inset -2px 0 0 0 ${freezeRight}`);
  if (freezeBottom) out.push(`inset 0 -2px 0 0 ${freezeBottom}`);
  for (const b of cell?.borders || []) {
    const c = cssRgb(b.rgb);
    out.push(b.side === "top" ? `inset 0 ${b.w}px 0 0 ${c}` : b.side === "bottom" ? `inset 0 -${b.w}px 0 0 ${c}`
      : b.side === "left" ? `inset ${b.w}px 0 0 0 ${c}` : `inset -${b.w}px 0 0 0 ${c}`);
  }
  if (grid) out.push(`inset -1px -1px 0 0 ${gridline}`);
  return out.join(", ");
}

/** Which colours a cell is drawn with, for the light or the dark Sheets look. An unset background is the sheet's own (white,
    or dark); an unset text colour is the sheet's text, or black/white chosen for contrast on a coloured cell. */
export function paint(cell, dark) {
  const bg = cell?.bg || (dark ? { r: 32, g: 33, b: 36 } : { r: 255, g: 255, b: 255 });
  const fg = cell?.fg || (cell?.bg ? (luminance(cell.bg) > 0.55 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 }) : dark ? { r: 232, g: 234, b: 237 } : { r: 32, g: 33, b: 36 });
  return { bg, fg };
}
