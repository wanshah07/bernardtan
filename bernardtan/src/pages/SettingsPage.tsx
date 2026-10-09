import { useEffect, useState } from "react";
import { KeyRound, LogOut, Moon, ScanFace, ShieldOff, Sun, Lamp } from "lucide-react";
import { type Token, clientId, fillIdentity, setClientId, signIn, signOut } from "../lib/google";
import { clearLock, enrolFace, faceAvailable, forgetFace, hasFace, hasPin, lockNow, setPin } from "../lib/lock";
import Koko from "../components/Koko";

const THEMES = [{ id: "day", label: "Day", icon: Sun }, { id: "night", label: "Night", icon: Moon }, { id: "glow", label: "Night-light", icon: Lamp }];

export default function SettingsPage({ token, setToken, onLock }: { token: Token | null; setToken: (t: Token | null) => void; onLock: () => void }) {
  const [gErr, setGErr] = useState("");
  const [id, setId] = useState(clientId());
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute("data-theme") || "day");
  const [saved, setSaved] = useState(false);
  const [pin1, setPin1] = useState(""); const [pin2, setPin2] = useState("");
  const [lockMsg, setLockMsg] = useState("");
  const [face, setFace] = useState(hasFace());
  const [canFace, setCanFace] = useState(false);
  const [locked, setLocked] = useState(hasPin());
  useEffect(() => { faceAvailable().then(setCanFace); }, []);
  const pick = (next: string) => { setTheme(next); document.documentElement.setAttribute("data-theme", next); try { localStorage.setItem("bernard.theme", next); } catch { /* ignore */ } };
  const savePin = async () => {
    setLockMsg("");
    if (pin1 !== pin2) { setLockMsg("The two PINs do not match."); return; }
    try { await setPin(pin1); setLocked(true); setPin1(""); setPin2(""); setLockMsg("PIN set. The app asks for it when it opens."); } catch (e: any) { setLockMsg(e.message); }
  };
  return (
    <div className="space-y-4 pt-2">
      <h1 className="font-display text-3xl font-bold">Settings</h1>
      <section className="card p-5">
        <p className="font-display text-lg font-semibold">Look</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {THEMES.map((t) => <button key={t.id} type="button" className={`btn ${theme === t.id ? "btn-glow" : "btn-plain"} text-sm`} onClick={() => pick(t.id)} aria-pressed={theme === t.id}><t.icon size={16} /> {t.label}</button>)}
        </div>
        <div className="mt-3 flex items-center gap-3 text-sm text-muted"><Koko size={56} mood="wave" className="shrink-0" /><p><b>Night-light</b> is Koko's theme: deep navy with a soft green glow, easy on the eyes in the evening. Koko is our own character; nothing from any show is used.</p></div>
      </section>
      <section className="card p-5">
        <p className="font-display text-lg font-semibold">Lock</p>
        <p className="mt-1 text-sm text-muted">{locked ? "The app asks for your PIN when it opens, and again after 5 minutes in the background." : "No lock yet. Set a PIN so only you can open the app."}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input type="password" inputMode="numeric" pattern="\d*" maxLength={8} placeholder={locked ? "New PIN" : "PIN (4–8 digits)"} className="field" value={pin1} onChange={(e) => setPin1(e.target.value.replace(/\D/g, ""))} />
          <input type="password" inputMode="numeric" pattern="\d*" maxLength={8} placeholder="Again" className="field" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))} />
          <button type="button" className="btn btn-glow" onClick={savePin} disabled={pin1.length < 4}><KeyRound size={16} /> {locked ? "Change PIN" : "Set PIN"}</button>
        </div>
        {lockMsg && <p className="mt-2 text-sm">{lockMsg}</p>}
        {locked && (
          <div className="mt-3 flex flex-wrap gap-2">
            {canFace && !face && <button type="button" className="btn btn-plain text-sm" onClick={() => enrolFace().then(() => { setFace(true); setLockMsg("Face ID added. The lock opens with your face from now on."); }).catch((e) => setLockMsg(e.message))}><ScanFace size={16} /> Add Face ID / Touch ID</button>}
            {face && <button type="button" className="btn btn-plain text-sm" onClick={() => { forgetFace(); setFace(false); }}><ScanFace size={16} /> Remove Face ID</button>}
            <button type="button" className="btn btn-plain text-sm" onClick={() => { lockNow(); onLock(); }}><KeyRound size={16} /> Lock now</button>
            <button type="button" className="btn btn-plain text-sm" onClick={() => { clearLock(); setLocked(false); setFace(false); setLockMsg("Lock removed."); }}><ShieldOff size={16} /> Remove the lock</button>
          </div>
        )}
        {!canFace && <p className="mt-2 text-xs text-muted">Face ID / Touch ID appears here on a device that has it, once the app is opened over https.</p>}
      </section>
      <section className="card p-5">
        <p className="font-display text-lg font-semibold">Google</p>
        {token ? <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">Connected as <b>{token.email || token.name || "your account"}</b>
          <button type="button" className="btn btn-plain px-3 py-1 text-xs" onClick={async () => { setGErr(""); try { setToken(await fillIdentity(await signIn({ pick: true }))); } catch (e: any) { setGErr(e.message || String(e)); } }}>Use a different account</button>
          <button type="button" className="btn btn-plain px-3 py-1 text-xs" onClick={() => { signOut(token); setToken(null); }}><LogOut size={14} /> Disconnect</button></div>
          : <p className="mt-1 text-sm text-muted">Not connected. Press <b>Find my Google</b> on Home or in My Google (the person icon at the top).</p>}
        {gErr && <p className="mt-2 text-xs text-danger">{gErr}</p>}
        <label className="mt-4 block text-xs font-semibold text-muted">OAuth client id (public; from Google Cloud → Credentials, see README)
          <input value={id} onChange={(e) => { setId(e.target.value); setSaved(false); }} placeholder="1234567890-abc.apps.googleusercontent.com" className="field mt-1 text-sm" /></label>
        <button type="button" className="btn btn-mustard mt-2 text-sm" onClick={() => { setClientId(id); setSaved(true); }}>Save</button>
        {saved && <span className="ml-2 text-xs text-ok">Saved on this device.</span>}
      </section>
      <section className="card p-5 text-sm text-muted">
        <p className="font-display text-lg font-semibold text-ink">About</p>
        <p className="mt-1">bernardtan.kkmhalalconsultant.com · installable on phone, tablet and desktop. Google data stays in your account; the app keeps only a one-hour key in this browser tab, your reminders and phone pictures on this device, and your PIN as a hash.</p>
      </section>
    </div>
  );
}
