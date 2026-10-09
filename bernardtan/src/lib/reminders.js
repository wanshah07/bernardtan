/* Reminders that reach Bernard's iPhone. There is no server, so the reliable route is Apple's own: a calendar event with
   an alert (.ics with a VALARM) that Safari hands to the Calendar app, and a Reminders-app link for the ones he prefers
   there. The list itself lives in this browser (localStorage). Pure helpers, tested in reminders.test.mjs. */

export const REPEATS = ["none", "daily", "weekly", "monthly"];
export const KEY = "bernard.reminders";

export function loadReminders() {
  try { return normalise(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { return []; }
}
export function saveReminders(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* private window */ }
}
export function normalise(list) {
  return (Array.isArray(list) ? list : []).filter((r) => r && r.id && r.title && r.at).map((r) => ({
    id: String(r.id), title: String(r.title).trim(), note: String(r.note || ""), at: String(r.at),
    repeat: REPEATS.includes(r.repeat) ? r.repeat : "none", done: !!r.done, lead: Number(r.lead) || 0,
  }));
}
export function newReminder(fields) {
  return normalise([{ id: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ...fields }])[0];
}

/** The next time this reminder fires at or after `now`, honouring the repeat; null when it is done and does not repeat. */
export function nextAt(r, now = new Date()) {
  let d = new Date(r.at);
  if (Number.isNaN(d.getTime())) return null;
  if (r.repeat === "none") return r.done || d < now ? (r.done ? null : d) : d;
  const base = d;
  let k = 0;
  while (d < now && k++ < 10000) {
    if (r.repeat === "daily") d = new Date(d.getTime() + 86_400_000);
    else if (r.repeat === "weekly") d = new Date(d.getTime() + 7 * 86_400_000);
    else d = addMonths(base, k);
  }
  return d;
}

/** The same day k months on, clamped to the month's last day (31 Aug + 1 → 30 Sep, not 1 Oct). */
export function addMonths(d, k) {
  const y = d.getFullYear(), m = d.getMonth() + k;
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(d.getDate(), last), d.getHours(), d.getMinutes(), d.getSeconds());
}

/** Reminders sorted by when they next fire; overdue (unrepeating, past, not done) first. */
export function upcoming(list, now = new Date()) {
  return list.map((r) => ({ r, at: nextAt(r, now) })).filter((x) => x.at).sort((a, b) => a.at - b.at);
}

/** Those due in the last `windowMs` and not yet marked, for the in-app nudge. */
export function dueNow(list, now = new Date(), windowMs = 60_000) {
  return list.filter((r) => { const d = nextAt(r, new Date(now.getTime() - windowMs)); return d && d <= now && !r.done; });
}

const pad = (n) => String(n).padStart(2, "0");
/** A local wall-clock stamp for an .ics DTSTART with TZID. */
export function icsLocal(d) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}
export function icsUtc(d) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => `\\${m}`);
const RRULE = { daily: "FREQ=DAILY", weekly: "FREQ=WEEKLY", monthly: "FREQ=MONTHLY" };

/** One VEVENT with an alert at the time (and one `lead` minutes before, when set). Opened on an iPhone it offers "Add to Calendar". */
export function buildIcs(r, { tz = "Asia/Kuala_Lumpur", now = new Date() } = {}) {
  const start = new Date(r.at);
  const end = new Date(start.getTime() + 15 * 60_000);
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Bernard Tan//Reminders//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${r.id}@bernardtan.kkmhalalconsultant.com`,
    `DTSTAMP:${icsUtc(now)}`,
    `DTSTART;TZID=${tz}:${icsLocal(start)}`,
    `DTEND;TZID=${tz}:${icsLocal(end)}`,
    `SUMMARY:${esc(r.title)}`,
  ];
  if (r.note) lines.push(`DESCRIPTION:${esc(r.note)}`);
  if (RRULE[r.repeat]) lines.push(`RRULE:${RRULE[r.repeat]}`);
  lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(r.title)}`, "TRIGGER:-PT0M", "END:VALARM");
  if (r.lead > 0) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(r.title)} (soon)`, `TRIGGER:-PT${r.lead}M`, "END:VALARM");
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

/** The whole list as one calendar file, so Bernard can add everything in one go. */
export function buildIcsAll(list, opts) {
  const parts = list.map((r) => buildIcs(r, opts).split("\r\n").filter((l) => l && !/^(BEGIN:VCALENDAR|END:VCALENDAR|VERSION|PRODID|CALSCALE|METHOD)/.test(l)));
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Bernard Tan//Reminders//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", ...parts.flat(), "END:VCALENDAR"].join("\r\n") + "\r\n";
}

/** The value for a <input type="datetime-local"> from a Date, and back. */
export function toLocalInput(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fromLocalInput(s) {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
export function when(d, now = new Date()) {
  const diff = d - now, day = 86_400_000;
  const time = d.toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" });
  if (diff < 0) return `overdue · ${time}`;
  if (d.toDateString() === now.toDateString()) return `today · ${time}`;
  if (d.toDateString() === new Date(now.getTime() + day).toDateString()) return `tomorrow · ${time}`;
  if (diff < 6 * day) return `${d.toLocaleDateString("en-MY", { weekday: "long" })} · ${time}`;
  return `${d.toLocaleDateString("en-MY", { day: "numeric", month: "short" })} · ${time}`;
}
