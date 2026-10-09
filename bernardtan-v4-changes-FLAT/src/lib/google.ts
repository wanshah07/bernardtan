/* Google sign-in and the two APIs Bernard uses, in his OWN account: Google Identity Services gives the page a short-lived
   access token in the browser (no server, no secret), and the page calls Drive and Sheets with it. The OAuth client id
   is public by design; it is read from the Settings page (localStorage) or VITE_GOOGLE_CLIENT_ID at build time. */
import { tabRange, toObjects } from "./sheet.js";
import { WINDOW_COLS, WINDOW_ROWS, GRID_FIELDS, buildGrid, colourOf, cssRgb } from "./grid.js";
import { explain } from "./mygoogle.js";
import { gridRange } from "./sheet.js";

export const SCOPES = ["https://www.googleapis.com/auth/drive.readonly", "https://www.googleapis.com/auth/spreadsheets"].join(" ");
const KEY_CLIENT = "bernard.google.client_id";
const KEY_TOKEN = "bernard.google.token";

declare global { interface Window { google?: any } }

export type Token = { access_token: string; expires_at: number; email?: string; name?: string; picture?: string };
export type DriveFile = { id: string; name: string; mimeType: string; modifiedTime?: string; webViewLink?: string; iconLink?: string; size?: string };

export function clientId(): string {
  try { return localStorage.getItem(KEY_CLIENT) || (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || ""; } catch { return ""; }
}
export function setClientId(id: string) { try { localStorage.setItem(KEY_CLIENT, id.trim()); } catch { /* private window */ } }

export function savedToken(): Token | null {
  try {
    const t = JSON.parse(sessionStorage.getItem(KEY_TOKEN) || "null") as Token | null;
    return t && t.expires_at > Date.now() + 30_000 ? t : null;
  } catch { return null; }
}
/** Drop the saved key and tell the app, so every page goes back to "Find my Google" instead of showing a dead connection. */
export function forget() {
  try { sessionStorage.removeItem(KEY_TOKEN); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event("bernard:signedout")); } catch { /* ignore */ }
}

let gisReady: Promise<void> | null = null;
export function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisReady) return gisReady;
  gisReady = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.defer = true;
    s.onload = () => res(); s.onerror = () => rej(new Error("Google's sign-in script did not load (offline, or blocked)."));
    document.head.appendChild(s);
  });
  return gisReady;
}

/** Ask Google for a token (opens the account chooser the first time, silent after that while the session lasts). */
export async function signIn(opts: { pick?: boolean } = {}): Promise<Token> {
  const id = clientId();
  if (!id) throw new Error("No Google client id yet: paste it under Settings (see the README for the 5-minute setup).");
  await loadGis();
  const token = await new Promise<Token>((res, rej) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: id, scope: SCOPES,
      callback: (r: any) => {
        if (r?.error) return rej(new Error(`Google refused: ${r.error}${r.error_description ? ` (${r.error_description})` : ""}`));
        res({ access_token: r.access_token, expires_at: Date.now() + (Number(r.expires_in) || 3600) * 1000 });
      },
      error_callback: (e: any) => rej(new Error(e?.type === "popup_closed" ? "The sign-in window was closed." : `Sign-in failed: ${e?.type || "unknown"}`)),
    });
    // pick: always show Google's own account chooser, so the person chooses which of their accounts to use
    client.requestAccessToken({ prompt: opts.pick || !savedToken() ? "select_account" : "" });
  });
  try {
    const me = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } }).then((r) => r.json());
    token.email = me.email; token.name = me.name; token.picture = me.picture;
  } catch { /* the token still works without the name */ }
  if (!token.email) await fillIdentity(token);
  saveToken(token);
  return token;
}

/** The userinfo call needs the email/profile scopes this app does not ask for; Drive itself says who the account is. */
export async function fillIdentity(token: Token): Promise<Token> {
  try {
    const r = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,photoLink)", { headers: { Authorization: `Bearer ${token.access_token}` } });
    if (r.ok) { const u = (await r.json()).user || {}; token.email = u.emailAddress || token.email; token.name = u.displayName || token.name; token.picture = u.photoLink || token.picture; }
  } catch { /* offline: the name just stays empty */ }
  return token;
}
export function saveToken(token: Token) { try { sessionStorage.setItem(KEY_TOKEN, JSON.stringify(token)); } catch { /* ignore */ } }

export function signOut(token: Token | null) {
  if (token && window.google?.accounts?.oauth2) try { window.google.accounts.oauth2.revoke(token.access_token, () => {}); } catch { /* ignore */ }
  forget();
}

async function api<T>(token: Token, url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json", ...(init?.headers || {}) } });
  if (r.status === 401) { forget(); throw Object.assign(new Error(explain(401, "")), { status: 401 }); }
  if (!r.ok) {
    let body = "";
    try { body = await r.text(); } catch { /* keep empty */ }
    throw Object.assign(new Error(explain(r.status, body, url.includes("sheets.googleapis.com") ? "Google Sheets API" : "Google Drive API")), { status: r.status });
  }
  return r.json() as Promise<T>;
}

/** Recent files, or a name search, in Bernard's Drive (read only). `mine` is what his account owns; `shared` is what other people shared with him. */
export async function listFiles(token: Token, q = "", pageSize = 40, scope: "mine" | "shared" = "mine"): Promise<DriveFile[]> {
  const query = [`trashed = false`, scope === "mine" ? `'me' in owners` : `sharedWithMe = true`, q ? `name contains '${q.replace(/'/g, "\\'")}'` : ""].filter(Boolean).join(" and ");
  const url = `https://www.googleapis.com/drive/v3/files?${new URLSearchParams({ q: query, pageSize: String(pageSize), orderBy: "modifiedTime desc",
    fields: "files(id,name,mimeType,modifiedTime,webViewLink,iconLink,size)" })}`;
  const j = await api<{ files: DriveFile[] }>(token, url);
  return j.files || [];
}

export type SheetTab = { sheetId: number; title: string; index: number; hidden: boolean; color: string; rows: number; cols: number; isGrid: boolean };

/** The tabs of a spreadsheet, in their own order, with colour, hidden flag and size. */
export async function sheetMeta(token: Token, spreadsheetId: string): Promise<{ title: string; tabs: SheetTab[] }> {
  const fields = "properties.title,sheets.properties(sheetId,title,index,sheetType,hidden,tabColor,tabColorStyle,gridProperties(rowCount,columnCount))";
  const j = await api<any>(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?${new URLSearchParams({ fields })}`);
  const tabs: SheetTab[] = (j?.sheets || []).map((s: any) => {
    const p = s.properties || {};
    return { sheetId: p.sheetId, title: p.title || "", index: p.index ?? 0, hidden: !!p.hidden, color: cssRgb(colourOf(p.tabColorStyle, p.tabColor)),
      rows: p.gridProperties?.rowCount || 0, cols: p.gridProperties?.columnCount || 0, isGrid: (p.sheetType || "GRID") === "GRID" };
  }).filter((t: SheetTab) => t.title).sort((a: SheetTab, b: SheetTab) => a.index - b.index);
  return { title: j?.properties?.title || "", tabs };
}

/** One tab drawn from its real cells: values, colours, merges, frozen panes, sizes. The window is clamped to the tab. */
export async function readGrid(token: Token, spreadsheetId: string, tab: SheetTab, rows = WINDOW_ROWS) {
  const askRows = Math.max(1, Math.min(rows, tab.rows || rows)), askCols = Math.max(1, Math.min(WINDOW_COLS, tab.cols || WINDOW_COLS));
  const params = new URLSearchParams({ ranges: gridRange(tab.title, askRows, askCols), includeGridData: "true", fields: GRID_FIELDS });
  const j = await api<any>(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?${params}`);
  return buildGrid(j?.sheets?.[0], j?.properties?.spreadsheetTheme?.themeColors || [], { rows: askRows, cols: askCols, total: tab.rows || askRows });
}

/** A tab as objects keyed by its header row. */
export async function readTab(token: Token, spreadsheetId: string, tab: string) {
  const range = encodeURIComponent(tabRange(tab, 40));
  const j = await api<{ values?: string[][] }>(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`);
  return toObjects(j.values || []);
}

/** Append one row under the header. */
export async function appendRow(token: Token, spreadsheetId: string, tab: string, values: string[]) {
  const range = encodeURIComponent(tabRange(tab, 40));
  return api<any>(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values: [values] }) });
}
