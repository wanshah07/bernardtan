import { useEffect, useRef, useState } from "react";
import { Bell, BellRing, CalendarPlus, Check, Download, Trash2 } from "lucide-react";
import { REPEATS, buildIcs, buildIcsAll, dueNow, fromLocalInput, loadReminders, newReminder, occurrenceKey, saveReminders, toLocalInput, upcoming, when } from "../lib/reminders.js";
import Koko from "../components/Koko";

/* Reminders. No server, so the iPhone route is Apple's own: "Add to iPhone" hands Safari a calendar event with an alert,
   and Calendar rings at the time whether or not this app is open. The list lives in this browser; when the app IS open it
   also nudges here (and with a notification, if allowed). */
type R = ReturnType<typeof newReminder>;
const REPEAT_WORDS: Record<string, string> = { none: "Once", daily: "Every day", weekly: "Every week", monthly: "Every month" };

export default function RemindersPage() {
  const [list, setList] = useState<R[]>(() => loadReminders());
  const [title, setTitle] = useState("");
  const [at, setAt] = useState(() => toLocalInput(new Date(Date.now() + 3600_000)));
  const [repeat, setRepeat] = useState("none");
  const [lead, setLead] = useState(0);
  const [note, setNote] = useState("");
  const [perm, setPerm] = useState<string>(() => (typeof Notification !== "undefined" ? Notification.permission : "unsupported"));
  const [ring, setRing] = useState<{ r: R; at: Date }[]>([]);
  const alerted = useRef(new Set<string>()), dismissed = useRef(new Set<string>());     // per occurrence, for this visit
  const persist = (next: R[]) => { setList(next); saveReminders(next); };
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const d = fromLocalInput(at);
    if (!title.trim() || !d) return;
    persist([...list, newReminder({ title, at: d.toISOString(), repeat, lead, note })]);
    setTitle(""); setNote(""); setAt(toLocalInput(new Date(Date.now() + 3600_000)));      // the next one starts an hour from now, not at the old time
  };
  useEffect(() => {
    const tick = () => {
      const due = dueNow(list, new Date()).filter((x: { r: R; at: Date }) => !dismissed.current.has(occurrenceKey(x)));
      setRing(due);
      // a notification and a buzz once per occurrence, not every 20 seconds while an overdue one waits
      const fresh = due.filter((x: { r: R; at: Date }) => !alerted.current.has(occurrenceKey(x)));
      if (!fresh.length) return;
      fresh.forEach((x: { r: R; at: Date }) => alerted.current.add(occurrenceKey(x)));
      if (typeof Notification !== "undefined" && Notification.permission === "granted") fresh.forEach(({ r }: { r: R }) => { try { new Notification(r.title, { body: r.note || "Reminder", tag: r.id }); } catch { /* ignore */ } });
      if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
    };
    tick(); const i = setInterval(tick, 20_000); return () => clearInterval(i);
  }, [list]);
  // On an iPhone the share sheet is the route that offers "Add to Calendar" for a calendar file; elsewhere it downloads.
  const deliver = async (text: string, name: string) => {
    const file = new File([text], name, { type: "text/calendar" });
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
    } catch (e: any) { if (e?.name === "AbortError") return; /* refused: fall back to a download */ }
    const url = URL.createObjectURL(file); const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const ics = (r: R) => deliver(buildIcs(r), `${r.title.replace(/[^\w]+/g, "-").slice(0, 40) || "reminder"}.ics`);
  const icsAll = () => {
    void deliver(buildIcsAll(list.filter((r) => !r.done)), "bernard-reminders.ics");
  };
  const up = upcoming(list);
  const done = list.filter((r) => r.done);
  return (
    <div className="space-y-5 pt-2">
      <div><h1 className="font-display text-3xl font-bold">Reminders</h1><p className="text-sm text-muted">Write it here, then <b>Add to iPhone</b> so your phone rings even when this app is closed.</p></div>
      {ring.length > 0 && (
        <div className="card flex items-center gap-3 border-glow p-4">
          <BellRing size={22} className="shrink-0 text-glow" />
          <div className="flex-1 text-sm">{ring.map((x) => <p key={occurrenceKey(x)}><b>{x.r.title}</b>{x.r.note ? ` · ${x.r.note}` : ""}</p>)}</div>
          <button type="button" className="btn btn-glow px-3 py-1 text-xs" onClick={() => {
            ring.forEach((x) => dismissed.current.add(occurrenceKey(x)));                    // this occurrence only: tomorrow's still rings
            persist(list.map((r) => (ring.some((x) => x.r.id === r.id) && r.repeat === "none" ? { ...r, done: true } : r))); setRing([]);
          }}>Got it</button>
        </div>
      )}
      <form onSubmit={add} className="card space-y-3 p-5">
        <p className="font-display text-lg font-semibold">New reminder</p>
        <input className="field" placeholder="What? (e.g. Take the pills)" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold text-muted">When<input type="datetime-local" className="field mt-1" value={at} onChange={(e) => setAt(e.target.value)} required /></label>
          <label className="text-xs font-semibold text-muted">Repeat<select className="field mt-1" value={repeat} onChange={(e) => setRepeat(e.target.value)}>{REPEATS.map((r: string) => <option key={r} value={r}>{REPEAT_WORDS[r]}</option>)}</select></label>
          <label className="text-xs font-semibold text-muted">Heads-up before<select className="field mt-1" value={lead} onChange={(e) => setLead(Number(e.target.value))}>{[0, 10, 30, 60].map((m) => <option key={m} value={m}>{m ? `${m} min before` : "At the time only"}</option>)}</select></label>
        </div>
        <input className="field" placeholder="A note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button type="submit" className="btn btn-glow"><Bell size={16} /> Save reminder</button>
      </form>
      {perm === "default" && <button type="button" className="btn btn-plain text-sm" onClick={() => Notification.requestPermission().then(setPerm)}><Bell size={16} /> Also allow notifications while the app is open</button>}
      <section>
        <div className="mb-2 flex items-center justify-between"><h2 className="font-display text-xl font-semibold">Coming up</h2>
          {up.length > 1 && <button type="button" className="btn btn-plain px-3 py-1 text-xs" onClick={icsAll}><Download size={14} /> All to iPhone</button>}</div>
        {up.length ? (
          <ul className="grid gap-3">
            {up.map(({ r, at: d }: { r: R; at: Date }) => (
              <li key={r.id} className="card flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
                  <p className="font-display text-lg font-semibold">{r.title}</p>
                  <p className={`text-sm ${d < new Date() ? "text-danger" : "text-muted"}`}>{when(d)}{r.repeat !== "none" ? ` · ${REPEAT_WORDS[r.repeat].toLowerCase()}` : ""}{r.note ? ` · ${r.note}` : ""}</p>
                </div>
                <button type="button" className="btn btn-mustard px-3 py-1 text-xs" onClick={() => ics(r)}><CalendarPlus size={14} /> Add to iPhone</button>
                {r.repeat === "none" && <button type="button" className="btn btn-plain px-3 py-1 text-xs" aria-label="Done" onClick={() => persist(list.map((x) => (x.id === r.id ? { ...x, done: true } : x)))}><Check size={14} /></button>}
                <button type="button" className="btn btn-plain px-3 py-1 text-xs" aria-label="Delete" onClick={() => persist(list.filter((x) => x.id !== r.id))}><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        ) : <div className="card flex items-center gap-4 p-5"><Koko size={72} mood="sleepy" className="shrink-0" /><p className="text-sm text-muted">Nothing coming up. Add one above; Koko will keep an eye on it.</p></div>}
      </section>
      {done.length > 0 && (
        <details className="text-sm text-muted"><summary className="cursor-pointer font-semibold">Done ({done.length})</summary>
          <ul className="mt-2 space-y-1">{done.map((r) => <li key={r.id} className="flex items-center justify-between"><span className="line-through">{r.title}</span><button type="button" className="text-xs underline" onClick={() => persist(list.filter((x) => x.id !== r.id))}>remove</button></li>)}</ul></details>
      )}
      <section className="card p-5 text-sm text-muted">
        <p className="font-display text-lg font-semibold text-ink">How the iPhone part works</p>
        <p className="mt-1"><b>Add to iPhone</b> downloads a tiny calendar file; Safari shows <i>Add to Calendar</i>, and from then on the iPhone itself rings at the time, with the heads-up before it if you chose one. Repeating reminders repeat there too. This app has no server, so that is the honest, no-account way; while the app is open it also nudges you here.</p>
      </section>
    </div>
  );
}
