import assert from "node:assert/strict";
import { buildIcs, buildIcsAll, dueNow, fold, fromLocalInput, nextAt, newReminder, normalise, occurrenceKey, toLocalInput, upcoming, when } from "./src/lib/reminders.js";
let n = 0;
const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error("FAIL:", name); throw e; } };
const NOW = new Date(2026, 9, 9, 10, 0);   // 9 Oct 2026 10:00 local

t("normalise drops junk and fills defaults", () => {
  const list = normalise([{ id: "a", title: " Pills ", at: "2026-10-09T08:00", repeat: "hourly" }, { title: "no id" }, null]);
  assert.deepEqual(list, [{ id: "a", title: "Pills", note: "", at: "2026-10-09T08:00", repeat: "none", done: false, lead: 0 }]);
  assert.match(newReminder({ title: "x", at: "2026-10-09T08:00" }).id, /^r/);
});
t("nextAt: one-off, repeating, done", () => {
  assert.equal(nextAt({ at: "2026-10-09T08:00", repeat: "none", done: false }, NOW).getHours(), 8);       // past but not done: overdue, still shown
  assert.equal(nextAt({ at: "2026-10-09T08:00", repeat: "none", done: true }, NOW), null);
  assert.equal(nextAt({ at: "2026-10-09T08:00", repeat: "daily" }, NOW).getDate(), 10);                    // rolls to tomorrow 08:00
  const w = nextAt({ at: "2026-10-02T08:00", repeat: "weekly" }, NOW); assert.equal(w.getDate(), 16);
  const m = nextAt({ at: "2026-08-31T09:00", repeat: "monthly" }, NOW); assert.equal(m.getMonth(), 9); assert.equal(m.getDate(), 31);   // 30 Sep was past, so 31 Oct
  assert.equal(nextAt({ at: "garbage" }, NOW), null);
});
t("upcoming sorts, dueNow catches the last minute", () => {
  const list = normalise([{ id: "1", title: "later", at: "2026-10-09T12:00" }, { id: "2", title: "soon", at: "2026-10-09T10:00:30" }, { id: "3", title: "done", at: "2026-10-09T09:00", done: true }]);
  assert.deepEqual(upcoming(list, NOW).map((x) => x.r.id), ["2", "1"]);
  assert.deepEqual(dueNow(list, new Date(2026, 9, 9, 10, 1)).map((x) => x.r.id), ["2"]);
  assert.deepEqual(dueNow(list, NOW).map((x) => x.r.id), []);
  // a repeating reminder is due once a day, and each day is its own occurrence (dismissing today's does not silence tomorrow's)
  const daily = normalise([{ id: "d", title: "Pills", at: "2026-10-09T17:00", repeat: "daily" }]);
  const a = dueNow(daily, new Date(2026, 9, 9, 17, 0, 30)), b = dueNow(daily, new Date(2026, 9, 10, 17, 0, 30));
  assert.equal(a.length, 1); assert.equal(b.length, 1); assert.notEqual(occurrenceKey(a[0]), occurrenceKey(b[0]));
  assert.equal(dueNow(daily, new Date(2026, 9, 9, 17, 5)).length, 0);
});
t("ics carries the alarm, the repeat and escapes commas", () => {
  const ics = buildIcs({ id: "abc", title: "Call Wan, 3pm", note: "Bring\nthe file", at: "2026-10-09T07:00:00.000Z", repeat: "weekly", lead: 10 }, { now: NOW });
  assert.match(ics, /BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART:20261009T070000Z\r\n/);                                  // an instant, so a phone in another zone is not relabelled
  assert.doesNotMatch(ics, /TZID/);
  assert.match(ics, /SUMMARY:Call Wan\\, 3pm/);
  assert.match(ics, /DESCRIPTION:Bring\\nthe file/);
  assert.match(ics, /RRULE:FREQ=WEEKLY/);
  assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 2);
  assert.match(ics, /TRIGGER:-PT10M/);
  assert.match(ics, /UID:abc@bernardtan/);
  const one = buildIcs({ id: "x", title: "T", at: "2026-10-09T07:00:00.000Z", repeat: "none", lead: 0 }, { now: NOW });
  assert.equal((one.match(/BEGIN:VALARM/g) || []).length, 1); assert.doesNotMatch(one, /RRULE/);
  const all = buildIcsAll(normalise([{ id: "1", title: "a", at: "2026-10-09T15:00" }, { id: "2", title: "b", at: "2026-10-10T15:00" }]), { now: NOW });
  assert.equal((all.match(/BEGIN:VEVENT/g) || []).length, 2); assert.equal((all.match(/BEGIN:VCALENDAR/g) || []).length, 1);
});
t("long lines fold at 75 octets and unfold to the original, multibyte included", () => {
  const long = "SUMMARY:" + "Makan malam bersama keluarga besar di rumah nenek, selepas solat Maghrib ".repeat(3);
  const f = fold(long);
  assert.ok(f.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75));
  assert.equal(f.replace(/\r\n /g, ""), long);
  const emoji = "SUMMARY:" + "🎂".repeat(30); const g = fold(emoji);
  assert.ok(g.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)); assert.equal(g.replace(/\r\n /g, ""), emoji);
  assert.equal(fold("short"), "short");
  const ics = buildIcs({ id: "z", title: "x".repeat(200), at: "2026-10-09T07:00:00.000Z", repeat: "none", lead: 0 }, { now: NOW });
  assert.ok(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75));
});
t("datetime-local round trip and friendly words", () => {
  assert.equal(toLocalInput(new Date(2026, 9, 9, 7, 5)), "2026-10-09T07:05");
  assert.equal(fromLocalInput("2026-10-09T07:05").getMinutes(), 5); assert.equal(fromLocalInput("nope"), null);
  assert.match(when(new Date(2026, 9, 9, 15, 0), NOW), /^today/);
  assert.match(when(new Date(2026, 9, 10, 15, 0), NOW), /^tomorrow/);
  assert.match(when(new Date(2026, 9, 9, 8, 0), NOW), /^overdue/);
  assert.match(when(new Date(2026, 9, 12, 8, 0), NOW), /^Monday/);
  assert.match(when(new Date(2026, 10, 1, 8, 0), NOW), /Nov/);
});
console.log(`reminders.test.mjs: ${n} groups OK`);
