import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, List, Minus, Moon, Plus, RefreshCw, Sun } from "lucide-react";
import { type DriveFile, type SheetTab, type Token, appendRow, readGrid, sheetMeta } from "../lib/google";
import { WINDOW_ROWS, addressOf } from "../lib/grid.js";
import { KINDS, newest } from "../lib/mygoogle.js";
import { parseRowText, sheetIdOf } from "../lib/sheet.js";
import Connect from "../components/Connect";
import Koko from "../components/Koko";
import SheetGrid from "../components/SheetGrid";

/* Sheet: one of your own spreadsheets drawn the way the Google Sheets app draws it (see components/SheetGrid.tsx), with the
   sheet's tabs along the bottom, a bar that shows the tapped cell, a zoom, and a way to add a row at the bottom. Read-mostly:
   the only write is the added row. */
const KEY = "bernard.sheet.last", KEY_ZOOM = "bernard.sheet.zoom", KEY_DARK = "bernard.sheet.dark";
const keyTab = (id: string) => `bernard.sheet.tab.${id}`;
const ZOOMS = [0.6, 0.8, 1, 1.25, 1.5, 2];
const store = {
  get: (k: string) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private window */ } },
};

export default function SheetPage({ token, setToken }: { token: Token | null; setToken: (t: Token) => void }) {
  const [sheets, setSheets] = useState<DriveFile[]>([]);
  const [pasted, setPasted] = useState("");
  const [id, setId] = useState<string>(() => store.get(KEY));
  const [meta, setMeta] = useState<{ title: string; tabs: SheetTab[] } | null>(null);
  const [tabId, setTabId] = useState<number | null>(null);
  const [rowsLimit, setRowsLimit] = useState(WINDOW_ROWS);
  const [model, setModel] = useState<any>(null);
  const [zoom, setZoom] = useState<number>(() => (ZOOMS.includes(Number(store.get(KEY_ZOOM))) ? Number(store.get(KEY_ZOOM)) : 1));
  const [sel, setSel] = useState<{ r: number; c: number } | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [menu, setMenu] = useState(false);
  const [rowText, setRowText] = useState("");
  const [tick, setTick] = useState(0);
  const metaReq = useRef(0), gridReq = useRef(0);
  // the sheet follows the app (dark by night) until Bernard flips it; the choice is remembered
  const appDark = typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") !== "day";
  const [darkPref, setDarkPref] = useState<string>(() => store.get(KEY_DARK));
  const dark = darkPref === "1" ? true : darkPref === "0" ? false : appDark;
  const tab = useMemo(() => meta?.tabs.find((t) => t.sheetId === tabId) || null, [meta, tabId]);
  const fail = (e: any) => setErr(e?.message || String(e));

  // your own spreadsheets, for the picker
  useEffect(() => {
    if (!token) return;
    let alive = true;
    setBusy((b) => b || "list");
    newest(token, KINDS[0].q, 100).then((f: DriveFile[]) => alive && setSheets(f)).catch((e: any) => alive && fail(e)).finally(() => alive && setBusy((b) => (b === "list" ? "" : b)));
    return () => { alive = false; };
  }, [token]);

  // the spreadsheet's tabs, and which one to open: the one used last time, else the first that is not hidden
  useEffect(() => {
    if (!token || !id) { setMeta(null); setModel(null); return; }
    const mine = ++metaReq.current;
    setMeta(null); setModel(null); setSel(null); setErr(""); setBusy("open");
    sheetMeta(token, id).then((m) => {
      if (mine !== metaReq.current) return;
      setMeta(m);
      const wanted = Number(store.get(keyTab(id)));
      const pick = m.tabs.find((t) => t.sheetId === wanted) || m.tabs.find((t) => !t.hidden) || m.tabs[0] || null;
      setTabId(pick ? pick.sheetId : null); setRowsLimit(WINDOW_ROWS);
      store.set(KEY, id);
    }).catch((e) => { if (mine === metaReq.current) fail(e); }).finally(() => { if (mine === metaReq.current) setBusy(""); });
  }, [token, id]);

  // the cells of the open tab; a slower answer for an earlier tab is thrown away
  useEffect(() => {
    if (!token || !id || !tab) return;
    if (!tab.isGrid) { setModel(null); return; }
    const mine = ++gridReq.current;
    setBusy("read"); setErr("");
    readGrid(token, id, tab, rowsLimit).then((m) => { if (mine === gridReq.current) setModel(m); })
      .catch((e) => { if (mine === gridReq.current) fail(e); }).finally(() => { if (mine === gridReq.current) setBusy(""); });
  }, [token, id, tab?.sheetId, rowsLimit, tick]);   // eslint-disable-line react-hooks/exhaustive-deps

  const pickTab = (t: SheetTab) => { setMenu(false); if (t.sheetId === tabId) return; store.set(keyTab(id), String(t.sheetId)); setModel(null); setSel(null); setRowsLimit(WINDOW_ROWS); setTabId(t.sheetId); };
  const zoomBy = (d: number) => { const i = Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + d)); setZoom(ZOOMS[i]); store.set(KEY_ZOOM, String(ZOOMS[i])); };
  const onSelect = useCallback((r: number, c: number) => setSel({ r, c }), []);
  const picked = sel && model ? model.cell(sel.r, sel.c) : null;
  const visibleTabs = meta?.tabs.filter((t) => !t.hidden) || [];

  if (!token) return <div className="pt-6"><Connect setToken={setToken} what="Your own Sheets" label="Find my Google" pick /></div>;
  return (
    <div className="space-y-4 pt-2">
      <div><h1 className="font-display text-3xl font-bold">Sheet</h1><p className="text-sm text-muted">One of your own spreadsheets, drawn like the Google Sheets app. Or paste a link to any sheet your account can open.</p></div>
      <div className="card p-4">
        <div className="flex flex-wrap gap-2">
          <select value={id} onChange={(e) => setId(e.target.value)} aria-label="Your spreadsheets" className="field min-w-0 flex-1 !rounded-pill !py-2 text-sm">
            <option value="">{busy === "list" ? "Loading your sheets…" : "Choose one of your spreadsheets…"}</option>
            {id && !sheets.some((s) => s.id === id) && <option value={id}>{meta?.title || "The sheet you opened"}</option>}
            {sheets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = sheetIdOf(pasted); if (v) { setId(v); setPasted(""); setErr(""); } else setErr("That is not a Google Sheets link or id."); }}>
            <input value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="…or paste a Sheets link" aria-label="Sheets link" className="field !rounded-pill !py-2 text-sm" />
            <button type="submit" className="btn btn-plain px-3 text-sm">Open</button>
          </form>
        </div>
      </div>
      {err && <p className="rounded-tile border-[3px] border-danger bg-surface p-3 text-sm text-danger" role="alert">{err}</p>}

      {id && !meta && !err && <div className="card flex items-center gap-4 p-5"><Koko size={64} mood="happy" className="shrink-0" /><p className="text-sm text-muted">Opening your sheet…</p></div>}

      {meta && tab && (
        <section className="card overflow-hidden">
          <div className="gs" data-dark={dark ? "1" : "0"}>
            <div className="flex flex-wrap items-center justify-end gap-2 px-3 py-2" style={{ background: "var(--gs-bar)", color: "var(--gs-text)" }}>
              <span className="w-full truncate font-display text-lg font-semibold" title={meta.title}>{meta.title}</span>
              <button type="button" className="btn btn-plain !min-h-0 !p-2" aria-label={dark ? "Show the sheet in light" : "Show the sheet in dark"} aria-pressed={dark} onClick={() => { const next = dark ? "0" : "1"; setDarkPref(next); store.set(KEY_DARK, next); }}>{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
              <button type="button" className="btn btn-plain !min-h-0 !p-2" aria-label="Zoom out" onClick={() => zoomBy(-1)} disabled={zoom === ZOOMS[0]}><Minus size={16} /></button>
              <span className="w-10 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
              <button type="button" className="btn btn-plain !min-h-0 !p-2" aria-label="Zoom in" onClick={() => zoomBy(1)} disabled={zoom === ZOOMS[ZOOMS.length - 1]}><Plus size={16} /></button>
              <button type="button" className="btn btn-plain !min-h-0 !p-2" aria-label="Refresh the sheet" onClick={() => setTick((t) => t + 1)}><RefreshCw size={16} className={busy === "read" ? "animate-spin" : ""} /></button>
              <a href={`https://docs.google.com/spreadsheets/d/${id}/edit#gid=${tab.sheetId}`} target="_blank" rel="noreferrer" className="btn btn-plain !min-h-0 !p-2" aria-label="Open in Google Sheets"><ExternalLink size={16} /></a>
            </div>
            <div className="gs-fbar" aria-live="polite">
              <span className="gs-addr">{sel ? addressOf(sel.r, sel.c) : "—"}</span><span className="gs-fx">fx</span>
              <span className="gs-val">{picked ? picked.v : sel ? "" : "Tap a cell to read it here"}</span>
              {picked?.link && <a href={picked.link} target="_blank" rel="noreferrer" className="shrink-0 underline">link</a>}
            </div>
            {picked?.note && <p className="px-3 py-1 text-xs" style={{ background: "var(--gs-bar)", color: "var(--gs-barfg)" }}>Note: {picked.note}</p>}

            {!tab.isGrid ? (
              <p className="p-6 text-sm" style={{ background: "var(--gs-bg)", color: "var(--gs-text)" }}>This tab is a chart or another kind of page, not a grid of cells. <a className="underline" href={`https://docs.google.com/spreadsheets/d/${id}/edit#gid=${tab.sheetId}`} target="_blank" rel="noreferrer">Open it in Google Sheets</a>.</p>
            ) : model ? (
              model.rowIdx.length ? <SheetGrid model={model} zoom={zoom} dark={dark} height="min(66dvh, 640px)" onSelect={onSelect} />
                : <p className="p-6 text-sm" style={{ background: "var(--gs-bg)", color: "var(--gs-text)" }}>This tab is empty.</p>
            ) : <div className="grid place-items-center p-10" style={{ background: "var(--gs-bg)", height: 240 }}><Koko size={72} mood="happy" /></div>}

            {model?.more && <button type="button" className="w-full py-2 text-sm font-semibold" style={{ background: "var(--gs-bar)", color: "var(--gs-active)" }} onClick={() => setRowsLimit((n) => n + WINDOW_ROWS)} disabled={busy === "read"}>{busy === "read" ? "Loading…" : `Load ${WINDOW_ROWS} more rows`}</button>}

            <div className="gs-tabs">
              <button type="button" className="gs-tab !px-4" aria-label="All sheets" aria-expanded={menu} onClick={() => setMenu((m) => !m)} style={{ color: "var(--gs-active)" }}><List size={22} /></button>
              <div className="gs-scrollx" role="tablist" aria-label="Sheets in this spreadsheet">
                {visibleTabs.map((t) => (
                  <button key={t.sheetId} type="button" role="tab" aria-selected={t.sheetId === tabId} className="gs-tab" onClick={() => pickTab(t)} style={t.color && t.sheetId === tabId ? { borderBottomColor: t.color } : undefined}>{t.title}</button>
                ))}
              </div>
              {menu && (
                <div className="gs-menu" role="menu">
                  {meta.tabs.map((t) => <button key={t.sheetId} type="button" role="menuitem" aria-selected={t.sheetId === tabId} onClick={() => pickTab(t)}>{t.color && <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: t.color }} />}<span className="truncate">{t.title}</span>{t.hidden && <span className="ml-auto text-xs opacity-70">hidden</span>}</button>)}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {meta && tab?.isGrid && (
        <details className="card p-4">
          <summary className="cursor-pointer font-display text-lg font-semibold">Add a row at the bottom of “{tab.title}”</summary>
          <form className="mt-3 space-y-2" onSubmit={async (e) => {
            e.preventDefault();
            const values = parseRowText(rowText);
            if (!values.length) { setErr("Type the values for the new row first."); return; }
            setBusy("add"); setErr("");
            try { await appendRow(token, id, tab.title, values); setRowText(""); setTick((t) => t + 1); } catch (er: any) { fail(er); } finally { setBusy(""); }
          }}>
            <input value={rowText} onChange={(e) => setRowText(e.target.value)} className="field" aria-label="New row values" placeholder="Jay, Tier 3, 8.5   (commas, or paste a row copied from a sheet)" />
            <button type="submit" className="btn btn-ketchup" disabled={busy === "add" || !rowText.trim()}><Plus size={16} /> {busy === "add" ? "Adding…" : "Add row"}</button>
            <p className="text-xs text-muted">The row goes under the last row of the table, starting in the first column. It is the only thing this page ever writes.</p>
          </form>
        </details>
      )}
    </div>
  );
}
