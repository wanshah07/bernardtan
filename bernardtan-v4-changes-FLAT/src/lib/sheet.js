/* Google Sheets arithmetic with no imports, so sheet.test.mjs runs it under Node: A1 ranges, values → rows with a header,
   a row → the values API wants. The network half is in google.ts. */

/** Column number (1-based) → letters: 1 → A, 27 → AA. */
export function colLetter(n) {
  let s = "";
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/** The A1 range of a whole tab, quoted when the name needs it: `'My Tab'!A1:Z`. */
export function tabRange(tab, cols = 26) {
  const name = /^[A-Za-z0-9_]+$/.test(tab) ? tab : `'${String(tab).replace(/'/g, "''")}'`;
  return `${name}!A1:${colLetter(Math.max(1, cols))}`;
}

/** values (as the API returns, first row the header) → { headers, rows: [{...}] }; short rows are padded with "". */
export function toObjects(values) {
  const v = Array.isArray(values) ? values : [];
  if (!v.length) return { headers: [], rows: [] };
  const headers = v[0].map((h, i) => String(h ?? "").trim() || colLetter(i + 1));
  const rows = v.slice(1).map((r, i) => {
    const o = { __row: i + 2 };
    headers.forEach((h, j) => { o[h] = r?.[j] ?? ""; });
    return o;
  });
  return { headers, rows };
}

/** An object keyed by header → the values row in header order (missing keys are ""). */
export function toRow(headers, obj) {
  return headers.map((h) => { const v = obj?.[h]; return v == null ? "" : String(v); });
}

/** A spreadsheet id out of whatever was pasted: a bare id, or a docs.google.com link. */
export function sheetIdOf(text) {
  const s = String(text || "").trim();
  const m = /\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/.exec(s);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(s) ? s : "";
}

/** Numbers in the values as numbers, for a quick sum column: "RM 1,200.50" → 1200.5; else null. */
export function num(v) {
  if (typeof v === "number") return v;
  const m = /-?\d[\d,]*(?:\.\d+)?/.exec(String(v ?? ""));
  return m ? Number(m[0].replace(/,/g, "")) : null;
}

/** The exact A1 range for a window of a tab, quoted when the name needs it: `'Oct'!A1:BH150`. */
export function gridRange(tab, rows, cols) {
  const name = /^[A-Za-z0-9_]+$/.test(tab) ? tab : `'${String(tab).replace(/'/g, "''")}'`;
  return `${name}!A1:${colLetter(Math.max(1, cols))}${Math.max(1, rows)}`;
}

/** One typed or pasted row → its cell values. A row copied from a sheet arrives tab-separated; otherwise commas, with "double
    quotes" keeping a comma inside a value. Empty input → []. */
export function parseRowText(text) {
  const t = String(text ?? "").replace(/\r?\n.*$/s, "");          // one row only: the first line
  if (!t.trim()) return [];
  if (t.includes("\t")) return t.split("\t").map((v) => v.trim());
  const out = []; let cur = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === '"') { if (q && t[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (ch === "," && !q) { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}
