import { useCallback, useEffect, useState } from "react";
import { Bell, FolderOpen, Gamepad2, Home, Images, Settings, Table2 } from "lucide-react";
import { type Token, savedToken } from "./lib/google";
import { AUTO_LOCK_MS, isLocked, lockNow } from "./lib/lock";
import HomePage from "./pages/HomePage";
import GalleryPage from "./pages/GalleryPage";
import DrivePage from "./pages/DrivePage";
import SheetPage from "./pages/SheetPage";
import RemindersPage from "./pages/RemindersPage";
import GamesPage from "./pages/GamesPage";
import SettingsPage from "./pages/SettingsPage";
import Lock from "./components/Lock";

export const TABS = [
  { id: "home", label: "Home", icon: Home },
  { id: "gallery", label: "Gallery", icon: Images },
  { id: "drive", label: "Drive", icon: FolderOpen },
  { id: "sheet", label: "Sheet", icon: Table2 },
  { id: "reminders", label: "Remind", icon: Bell },
  { id: "games", label: "Games", icon: Gamepad2 },
] as const;
type TabId = (typeof TABS)[number]["id"] | "settings";
const ids = [...TABS.map((t) => t.id), "settings"] as string[];

export default function App() {
  const [tab, setTab] = useState<TabId>(() => { const h = location.hash.replace("#", ""); return (ids.includes(h) ? h : "home") as TabId; });
  const [token, setToken] = useState<Token | null>(() => savedToken());
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [locked, setLocked] = useState<boolean>(() => isLocked());
  useEffect(() => {
    const onHash = () => { const h = location.hash.replace("#", ""); setTab((ids.includes(h) ? h : "home") as TabId); };
    window.addEventListener("hashchange", onHash);
    const onInstall = (e: Event) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener("beforeinstallprompt", onInstall);
    // the lock comes back after a while in the background
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > AUTO_LOCK_MS) { lockNow(); setLocked(isLocked()); }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => { window.removeEventListener("hashchange", onHash); window.removeEventListener("beforeinstallprompt", onInstall); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  const go = (id: TabId) => { setTab(id); location.hash = id === "home" ? "" : id; };
  const open = useCallback(() => setLocked(false), []);
  if (locked) return <Lock onOpen={open} />;
  const page = tab === "gallery" ? <GalleryPage token={token} setToken={setToken} />
    : tab === "drive" ? <DrivePage token={token} setToken={setToken} />
    : tab === "sheet" ? <SheetPage token={token} setToken={setToken} />
    : tab === "reminders" ? <RemindersPage />
    : tab === "games" ? <GamesPage />
    : tab === "settings" ? <SettingsPage token={token} setToken={setToken} onLock={() => setLocked(true)} />
    : <HomePage token={token} setToken={setToken} go={go} installEvt={installEvt} onInstalled={() => setInstallEvt(null)} />;
  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col">
      <div className="stripe h-3 w-full" aria-hidden />
      <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <button type="button" onClick={() => go("home")} className="flex items-center gap-2 wobble">
          <img src="./koko.svg" alt="" className="h-10 w-10" />
          <span className="font-display text-2xl font-bold tracking-tight">Bernard Tan</span>
        </button>
        <nav className="hidden gap-1 sm:flex" aria-label="Main">
          {TABS.map((t) => <button key={t.id} type="button" onClick={() => go(t.id)} aria-current={tab === t.id ? "page" : undefined}
            className={`btn ${tab === t.id ? "btn-mustard" : "btn-plain"} px-3 py-1.5 text-sm`}><t.icon size={16} /> {t.label}</button>)}
        </nav>
        <button type="button" onClick={() => go("settings")} aria-label="Settings" aria-current={tab === "settings" ? "page" : undefined}
          className={`btn ${tab === "settings" ? "btn-mustard" : "btn-plain"} !h-12 !min-h-0 !w-12 !p-0`}><Settings size={20} /></button>
      </header>
      <main className="flex-1 px-4 pb-28 sm:px-6 sm:pb-10">{page}</main>
      {/* the phone's tab bar, thumb-reach; hidden on wide screens where the header nav shows */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t-[3px] border-line bg-surface sm:hidden" aria-label="Main (mobile)" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <ul className="grid grid-cols-6">
          {TABS.map((t) => <li key={t.id}><button type="button" onClick={() => go(t.id)} aria-current={tab === t.id ? "page" : undefined}
            className={`flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${tab === t.id ? "text-ketchup" : "text-muted"}`}><t.icon size={22} />{t.label}</button></li>)}
        </ul>
      </nav>
    </div>
  );
}
