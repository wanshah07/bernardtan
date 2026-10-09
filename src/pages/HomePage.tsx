import { useEffect, useState } from "react";
import { Bell, Download, FolderOpen, Gamepad2, Images, Table2 } from "lucide-react";
import { type Token } from "../lib/google";
import { type Pic, drivePictures, phonePictures } from "../lib/gallery";
import { loadReminders, upcoming, when } from "../lib/reminders.js";
import Connect from "../components/Connect";
import Koko from "../components/Koko";
import Carousel from "../components/Carousel";

/* Home: Koko says hello the way a person would, the next reminder, a strip of pictures, and the doors. */
const LINES = {
  morning: ["Morning, {n}. Tea first, then Drive?", "Good morning, {n}. Slept well?", "Morning, {n}! Anything to remember today?"],
  afternoon: ["Afternoon, {n}. How's it going?", "Hey {n}. Lunch was good, I hope.", "Afternoon, {n}. Your pictures are right here."],
  evening: ["Evening, {n}. Winding down?", "Good evening, {n}. Lights low, Koko on.", "Evening, {n}. Fancy a quick game?"],
};
export default function HomePage({ token, setToken, go, installEvt, onInstalled }: { token: Token | null; setToken: (t: Token) => void; go: (id: any) => void; installEvt: any; onInstalled: () => void }) {
  const hour = new Date().getHours();
  const slot = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const name = token?.name?.split(" ")[0] || "Bernard";
  const [line] = useState(() => LINES[slot][Math.floor(Math.random() * LINES[slot].length)].replace("{n}", name));
  const [pics, setPics] = useState<Pic[]>([]);
  const standalone = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone);
  const next = upcoming(loadReminders())[0];
  useEffect(() => {
    let alive = true;
    (async () => {
      const phone = await phonePictures();
      if (alive) setPics(phone.slice(0, 8));
      if (token) { try { const d = await drivePictures(token, 8); if (alive) setPics((p) => [...p, ...d].slice(0, 12)); } catch { /* the strip just stays shorter */ } }
    })();
    return () => { alive = false; };
  }, [token]);
  return (
    <div className="space-y-6 pt-2">
      <section className="card overflow-hidden">
        <div className="stripe h-2" aria-hidden />
        <div className="flex items-center gap-4 p-5 sm:p-8">
          <Koko size={96} mood={slot === "evening" ? "sleepy" : "wave"} className="shrink-0" />
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold sm:text-4xl">{line}</h1>
            <p className="mt-1 text-sm text-muted">Your pictures, your Drive, your Sheets, your reminders and a game or two. Everything Google stays in your own account.</p>
            {!token && <div className="mt-3"><Connect setToken={setToken} what="Your Drive and Sheets" compact /></div>}
            {token && <p className="mt-2 flex items-center gap-2 text-sm">{token.picture && <img src={token.picture} alt="" className="h-7 w-7 rounded-full border-2 border-line" />}Connected as <b>{token.email}</b></p>}
          </div>
        </div>
      </section>
      <button type="button" onClick={() => go("reminders")} className="card flex w-full items-center gap-3 p-4 text-left">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-tile border-[3px] border-line bg-glow text-ink"><Bell size={20} /></span>
        {next ? <span className="min-w-0"><span className="block truncate font-display text-lg font-semibold">{next.r.title}</span><span className="block text-xs text-muted">{when(next.at)} · tap to see all</span></span>
          : <span><span className="block font-display text-lg font-semibold">No reminders yet</span><span className="block text-xs text-muted">Tap to add one; it can ring on your iPhone.</span></span>}
      </button>
      {pics.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between"><h2 className="font-display text-xl font-semibold">Your pictures</h2><button type="button" className="text-sm font-semibold text-ketchup underline" onClick={() => go("gallery")}>See all</button></div>
          <Carousel pics={pics} size="sm" />
        </section>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[{ id: "gallery", icon: Images, title: "Gallery", text: "Pictures from your phone and your Drive.", tone: "bg-glow" },
          { id: "drive", icon: FolderOpen, title: "Drive", text: "Your latest files, a search, open in one tap.", tone: "bg-sky" },
          { id: "sheet", icon: Table2, title: "Sheet", text: "Open a spreadsheet, read a tab, add a row.", tone: "bg-lettuce" },
          { id: "games", icon: Gamepad2, title: "Games", text: "Burger Tap is in; more to come.", tone: "bg-mustard" }].map((c) => (
          <button key={c.id} type="button" onClick={() => go(c.id)} className="card wobble min-h-[96px] p-4 text-left">
            <span className={`inline-flex h-11 w-11 items-center justify-center rounded-tile border-[3px] border-line ${c.tone} text-ink`}><c.icon size={22} /></span>
            <p className="mt-2 font-display text-xl font-semibold">{c.title}</p>
            <p className="text-sm text-muted">{c.text}</p>
          </button>
        ))}
      </div>
      {!standalone && (
        <section className="card p-5">
          <p className="font-display text-lg font-semibold">Put it on your home screen</p>
          {installEvt ? <button type="button" className="btn btn-mustard mt-2" onClick={async () => { installEvt.prompt(); await installEvt.userChoice; onInstalled(); }}><Download size={16} /> Install app</button>
            : <p className="mt-1 text-sm text-muted">iPhone/iPad: Share → <b>Add to Home Screen</b>. Then it opens like any other app, full screen, with Koko on the icon.</p>}
        </section>
      )}
    </div>
  );
}
