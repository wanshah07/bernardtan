/* "My Google": find what the signed-in person's OWN Google account holds, nothing else. Everything runs in the browser with
   the one-hour token Google handed the page for the account the person picked; there is no workspace connection and no
   server. Files are counted as OWNED by that account (`'me' in owners`); what other people shared is counted apart, on its
   own line, so it never inflates "mine". Plain JavaScript with the fetch function injectable, tested in mygoogle.test.mjs. */

const API = "https://www.googleapis.com/drive/v3";
const G = "application/vnd.google-apps.";

export const KINDS = [
  { id: "sheets", label: "Spreadsheets", q: `mimeType = '${G}spreadsheet'` },
  { id: "docs", label: "Documents", q: `mimeType = '${G}document'` },
  { id: "slides", label: "Slides", q: `mimeType = '${G}presentation'` },
  { id: "folders", label: "Folders", q: `mimeType = '${G}folder'` },
  { id: "pictures", label: "Pictures", q: "mimeType contains 'image/'" },
  { id: "pdfs", label: "PDFs", q: "mimeType = 'application/pdf'" },
];

/** The query for "files this account owns" of one kind (or any kind when `kindQ` is empty). */
export const ownedQ = (kindQ = "") => ["trashed = false", "'me' in owners", kindQ].filter(Boolean).join(" and ");
export const SHARED_Q = "trashed = false and sharedWithMe = true";

/** A readable reason for a Google API failure, with the one fix that matters most. */
export function explain(status, body) {
  let msg = "";
  try { const j = typeof body === "string" ? JSON.parse(body) : body; msg = j?.error?.message || ""; } catch { msg = String(body || ""); }
  if (status === 401) return "Google signed you out (the hour is up). Press Find my Google again.";
  if (status === 403 && /has not been used|is disabled|accessNotConfigured|not enabled/i.test(`${msg} ${JSON.stringify(body)}`)) {
    return "The Google Drive API is not switched on in the Google Cloud project yet: open APIs & Services, Library, Google Drive API, Enable (README step 4).";
  }
  if (status === 403) return `Google would not let this account do that${msg ? `: ${msg}` : "."}`;
  if (status === 429) return "Google says slow down; wait a minute and try again.";
  return msg || `Google answered ${status}.`;
}

async function call(token, url, fetchFn) {
  const r = await fetchFn(url, { headers: { Authorization: `Bearer ${token.access_token}` } });
  if (!r.ok) {
    let body = "";
    try { body = await r.text(); } catch { /* keep empty */ }
    throw Object.assign(new Error(explain(r.status, body)), { status: r.status });
  }
  return r.json();
}

/** Who this is and how much of their Drive is used. Works with the read-only Drive scope alone. */
export async function aboutMe(token, fetchFn = fetch) {
  const j = await call(token, `${API}/about?${new URLSearchParams({ fields: "user(displayName,emailAddress,photoLink),storageQuota(limit,usage)" })}`, fetchFn);
  return { name: j.user?.displayName || "", email: j.user?.emailAddress || "", picture: j.user?.photoLink || "",
    usage: Number(j.storageQuota?.usage) || 0, limit: j.storageQuota?.limit ? Number(j.storageQuota.limit) : 0 };
}

/** How many files match `q`: pages of 1000, at most `maxPages`, and `more` says there were still more. */
export async function countFiles(token, q, fetchFn = fetch, maxPages = 3) {
  let n = 0, pageToken = "", more = false;
  for (let i = 0; i < maxPages; i++) {
    const params = new URLSearchParams({ q, pageSize: "1000", fields: "nextPageToken,files(id)", spaces: "drive" });
    if (pageToken) params.set("pageToken", pageToken);
    const j = await call(token, `${API}/files?${params}`, fetchFn);
    n += (j.files || []).length;
    pageToken = j.nextPageToken || "";
    if (!pageToken) return { n, more: false };
  }
  more = !!pageToken;
  return { n, more };
}

/** The newest `size` files this account owns, optionally of one kind. */
export async function newest(token, kindQ, size, fetchFn = fetch) {
  const params = new URLSearchParams({ q: ownedQ(kindQ), pageSize: String(size), orderBy: "modifiedTime desc",
    fields: "files(id,name,mimeType,modifiedTime,webViewLink,iconLink)" });
  return (await call(token, `${API}/files?${params}`, fetchFn)).files || [];
}

/** The whole find: identity, counts by kind, the shared-with-me count, the newest files and the newest spreadsheets.
    One slow or refused part never hides the rest: it is named in `failed`. A refused identity (401) fails the lot. */
export async function discover(token, fetchFn = fetch) {
  const me = await aboutMe(token, fetchFn);                                   // a 401 or a disabled API stops here, with its reason
  const jobs = [
    ...KINDS.map((k) => countFiles(token, ownedQ(k.q), fetchFn).then((v) => ["count", k.id, v])),
    countFiles(token, SHARED_Q, fetchFn).then((v) => ["shared", "shared", v]),
    newest(token, "", 8, fetchFn).then((v) => ["recent", "recent", v]),
    newest(token, KINDS[0].q, 12, fetchFn).then((v) => ["sheetlist", "sheetlist", v]),
  ];
  const settled = await Promise.allSettled(jobs);
  const out = { me, counts: {}, shared: null, recent: [], sheets: [], failed: [] };
  settled.forEach((s, i) => {
    if (s.status === "rejected") { out.failed.push(i < KINDS.length ? KINDS[i].id : ["shared", "recent", "sheets"][i - KINDS.length]); return; }
    const [kind, id, v] = s.value;
    if (kind === "count") out.counts[id] = v;
    else if (kind === "shared") out.shared = v;
    else if (kind === "recent") out.recent = v;
    else out.sheets = v;
  });
  return out;
}

export const fmtCount = (c) => (c ? `${c.n.toLocaleString("en-MY")}${c.more ? "+" : ""}` : "—");
export function fmtBytes(n) {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / 1024 ** i;
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${u[i]}`;
}
export function storageText(me) {
  if (!me) return "";
  return me.limit ? `${fmtBytes(me.usage)} of ${fmtBytes(me.limit)} used` : `${fmtBytes(me.usage)} used`;
}
/** Where a tile leads: spreadsheets to the Sheet page, pictures to the Gallery, the rest to Drive. */
export const tileTarget = (id) => (id === "sheets" ? "sheet" : id === "pictures" ? "gallery" : "drive");
