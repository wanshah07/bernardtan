import { useCallback, useEffect, useState } from "react";
import { ExternalLink, File as FileIcon, FileText, Folder, Image as ImageIcon, Presentation, RefreshCw, Search, Table2, UserRound } from "lucide-react";
import { type Token, fillIdentity, saveToken, signIn } from "../lib/google";
import { KINDS, discover, fmtCount, storageText, tileTarget } from "../lib/mygoogle.js";
import Koko from "../components/Koko";

/* My Google: find what the account you pick owns in Drive and Sheets, and only that. The account is chosen in Google's own
   chooser, everything is read here in the browser with that account's one-hour key, nothing goes through a workspace
   connection or a server, Drive is read only, and files other people shared are counted on a line of their own. */
const KEY_SHEET = "bernard.sheet.last";
const ICON: Record<string, any> = { sheets: Table2, docs: FileText, slides: Presentation, folders: Folder, pictures: ImageIcon, pdfs: FileIcon };
const TONE: Record<string, string> = { sheets: "bg-lettuce", docs: "bg-sky", slides: "bg-mustard", folders: "bg-bun", pictures: "bg-glow", pdfs: "bg-ketchup" };
type Count = { n: number; more: boolean };
type Found = { me: { name: string; email: string; picture: string; usage: number; limit: number }; counts: Record<string, Count>; shared: Count | null; recent: any[]; sheets: any[]; failed: string[] };
const when = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" }) : "");

export default function MyGooglePage({ token, setToken, go }: { token: Token | null; setToken: (t: Token | null) => void; go: (id: any) => void }) {
  const [found, setFound] = useState<Found | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const find = useCallback(async (t: Token) => {
    setBusy(true); setErr("");
    try {
      const f = (await discover(t)) as unknown as Found;
      setFound(f);
      if (f.me.email && f.me.email !== t.email) { const next = { ...t, email: f.me.email, name: f.me.name, picture: f.me.picture }; saveToken(next); setToken(next); }
    } catch (e: any) { setErr(e.message || String(e)); } finally { setBusy(false); }
  }, [setToken]);

  useEffect(() => { if (token && !found && !busy) find(token); }, [token]);   // eslint-disable-line react-hooks/exhaustive-deps

  const pickAccount = async () => {
    setBusy(true); setErr("");
    try { const t = await fillIdentity(await signIn({ pick: true })); setFound(null); setToken(t); await find(t); } catch (e: any) { setErr(e.message || String(e)); setBusy(false); }
  };
  const openSheet = (id: string) => { try { localStorage.setItem(KEY_SHEET, id); } catch { /* ignore */ } go("sheet"); };

  return (
    <div className="space-y-5 pt-2">
      <div><h1 className="font-display text-3xl font-bold">My Google</h1><p className="text-sm text-muted">What your own Google account holds in Drive and Sheets.</p></div>

      <section className="card p-5 sm:p-6">
        <h2 className="font-display text-2xl font-bold">Your own Google (Drive and Sheets)</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Your Drive and Sheets are read as the Google account you pick below, straight from your browser. Nothing goes through a workspace
          connection or a server. Drive is read only; in Sheets you can add a row. Only files that account owns or can open, and the ones
          other people shared are counted on a separate line, never mixed in with yours.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-glow" onClick={pickAccount} disabled={busy}>
            {token ? <UserRound size={16} /> : <Search size={16} />} {busy && !token ? "Opening Google…" : token ? "Use a different account" : "Find my Google"}
          </button>
          {token && <button type="button" className="btn btn-plain" onClick={() => find(token)} disabled={busy}><RefreshCw size={16} className={busy ? "animate-spin" : ""} /> {busy ? "Looking…" : "Look again"}</button>}
        </div>
        {!token && <p className="mt-3 text-xs text-muted">Google opens its own chooser, so you pick which of your accounts to use. No password is typed here.</p>}
        {err && <p className="mt-3 rounded-tile border-[3px] border-danger bg-surface p-3 text-sm text-danger">{err}</p>}
      </section>

      {token && (
        <section className="card flex items-center gap-3 p-4">
          {token.picture ? <img src={token.picture} alt="" className="h-12 w-12 rounded-full border-[3px] border-line" referrerPolicy="no-referrer" /> : <Koko size={48} mood={busy ? "happy" : "wave"} className="shrink-0" />}
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-semibold">{found?.me.name || token.name || "Your account"}</p>
            <p className="truncate text-sm text-muted">{found?.me.email || token.email || "Signed in"}</p>
          </div>
          {found && <p className="hidden text-right text-xs text-muted sm:block">{storageText(found.me)}</p>}
        </section>
      )}

      {token && !found && busy && !err && <div className="card flex items-center gap-4 p-5"><Koko size={64} mood="happy" className="shrink-0" /><p className="text-sm text-muted">Koko is looking through your Drive…</p></div>}

      {found && (
        <>
          <section>
            <div className="mb-2 flex items-baseline justify-between"><h2 className="font-display text-xl font-semibold">Owned by you</h2><span className="text-xs text-muted sm:hidden">{storageText(found.me)}</span></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {KINDS.map((k) => {
                const Icon = ICON[k.id];
                return (
                  <button key={k.id} type="button" className="card wobble p-4 text-left" onClick={() => go(tileTarget(k.id))} aria-label={`${k.label}: ${fmtCount(found.counts[k.id])}`}>
                    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-tile border-[3px] border-line ${TONE[k.id]} text-ink`}><Icon size={20} /></span>
                    <p className="mt-2 font-display text-2xl font-bold tabular-nums">{found.failed.includes(k.id) ? "?" : fmtCount(found.counts[k.id])}</p>
                    <p className="text-xs text-muted">{k.label}</p>
                  </button>
                );
              })}
            </div>
            {found.shared && <p className="mt-2 text-xs text-muted">{fmtCount(found.shared)} more {found.shared.n === 1 ? "file was" : "files were"} shared with you by other people. They are not counted above.</p>}
            {found.failed.length > 0 && <p className="mt-1 text-xs text-warn">Google did not answer for: {found.failed.join(", ")}. Press Look again.</p>}
          </section>

          <section>
            <h2 className="mb-2 font-display text-xl font-semibold">Your spreadsheets</h2>
            {found.sheets.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {found.sheets.map((s: any) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => openSheet(s.id)} className="card flex w-full items-center gap-3 p-3 text-left hover:shadow-lift">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-tile border-[3px] border-line bg-lettuce text-ink"><Table2 size={18} /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{s.name}</span><span className="block text-xs text-muted">{when(s.modifiedTime)} · tap to open and add a row</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <div className="card flex items-center gap-4 p-5"><Koko size={64} mood="sleepy" className="shrink-0" /><p className="text-sm text-muted">No spreadsheets in this account yet.</p></div>}
          </section>

          <section>
            <h2 className="mb-2 font-display text-xl font-semibold">Newest in your Drive</h2>
            {found.recent.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {found.recent.map((f: any) => (
                  <li key={f.id}>
                    <a href={f.webViewLink || `https://drive.google.com/open?id=${f.id}`} target="_blank" rel="noreferrer" className="card flex items-center gap-3 p-3 hover:shadow-lift">
                      {f.iconLink ? <img src={String(f.iconLink).replace("/16/", "/32/")} alt="" className="h-8 w-8 shrink-0" /> : <span className="h-8 w-8 shrink-0 rounded bg-surface-2" />}
                      <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{f.name}</span><span className="block text-xs text-muted">{when(f.modifiedTime)}</span></span>
                      <ExternalLink size={16} className="shrink-0 text-muted" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">Nothing in your own Drive yet.</p>}
          </section>
        </>
      )}
    </div>
  );
}
