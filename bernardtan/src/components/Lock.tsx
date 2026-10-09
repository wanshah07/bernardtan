import { useEffect, useState } from "react";
import { Delete, ScanFace } from "lucide-react";
import Koko from "./Koko";
import { checkPin, hasFace, unlockWithFace, waitSeconds } from "../lib/lock";

/* The lock screen: a keypad, Face ID when enrolled, and Koko keeping watch. Shown until the PIN (or the face) opens it. */
export default function Lock({ onOpen }: { onOpen: () => void }) {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [wait, setWait] = useState(waitSeconds());
  const [tried, setTried] = useState(false);
  useEffect(() => { const i = setInterval(() => setWait(waitSeconds()), 1000); return () => clearInterval(i); }, []);
  useEffect(() => { if (hasFace() && !tried) { setTried(true); unlockWithFace().then((ok) => ok && onOpen()); } }, [tried, onOpen]);
  const press = async (d: string) => {
    if (wait > 0) return;
    const next = pin + d;
    setPin(next);
    if (next.length >= 4 && next.length <= 8) {
      // try at every length from 4: the right PIN opens the moment it is complete
      if (await checkPin(next)) { onOpen(); return; }
      if (next.length === 8) { setShake(true); setTimeout(() => { setShake(false); setPin(""); }, 400); setWait(waitSeconds()); }
    }
  };
  const wrong = async () => {
    if (pin.length >= 4 && !(await checkPin(pin))) { setShake(true); setTimeout(() => { setShake(false); setPin(""); }, 400); setWait(waitSeconds()); }
    else if (pin.length >= 4) onOpen();
  };
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 py-10 text-center">
      <Koko size={120} mood={wait > 0 ? "sleepy" : "happy"} />
      <h1 className="mt-4 font-display text-3xl font-bold">Hi Bernard</h1>
      <p className="mt-1 text-sm text-muted">{wait > 0 ? `Too many tries. Wait ${wait}s.` : "Your PIN, please."}</p>
      <div className={`mt-5 flex gap-3 ${shake ? "animate-[wobble_.4s_ease]" : ""}`} aria-label="PIN entered">
        {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className={`h-4 w-4 rounded-full border-[3px] border-line ${i < pin.length ? "bg-glow" : ""} ${i >= 4 && pin.length <= 4 ? "opacity-30" : ""}`} />)}
      </div>
      <div className="mt-6 grid w-full grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => <button key={d} type="button" className="btn btn-plain key !px-0" onClick={() => press(d)} disabled={wait > 0}>{d}</button>)}
        <button type="button" className="btn btn-plain key !px-0" aria-label="Face ID" onClick={() => unlockWithFace().then((ok) => ok && onOpen())} disabled={!hasFace()}><ScanFace size={24} /></button>
        <button type="button" className="btn btn-plain key !px-0" onClick={() => press("0")} disabled={wait > 0}>0</button>
        <button type="button" className="btn btn-plain key !px-0" aria-label="Delete" onClick={() => setPin((p) => p.slice(0, -1))}><Delete size={22} /></button>
      </div>
      <button type="button" className="btn btn-glow mt-4 w-full" onClick={wrong} disabled={pin.length < 4 || wait > 0}>Open</button>
      <p className="mt-6 text-xs text-muted">Forgot it? Settings on another signed-in device can reset it, or clear this site's data in Safari and set a new one.</p>
    </div>
  );
}
