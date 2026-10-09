import { useCallback, useEffect, useRef, useState } from "react";
import { Delete, ScanFace } from "lucide-react";
import Koko from "./Koko";
import { checkPin, hasFace, pinLength, unlockWithFace, waitSeconds } from "../lib/lock";

/* The lock screen: a keypad, Face ID when enrolled, and Koko keeping watch. The PIN is checked ONCE, the moment its last
   digit is typed (its length is stored with it), so typing a long PIN never counts as wrong tries on the way; an older PIN
   with no stored length gets an Open button instead. */
export default function Lock({ onOpen }: { onOpen: () => void }) {
  const len = pinLength();
  const [pin, setPin] = useState("");
  const pinRef = useRef("");                       // the live value, so two quick taps never lose a digit
  const checking = useRef(false);
  const [shake, setShake] = useState(false);
  const [wait, setWait] = useState(waitSeconds());
  const tried = useRef(false);
  useEffect(() => { const i = setInterval(() => setWait(waitSeconds()), 1000); return () => clearInterval(i); }, []);
  useEffect(() => { if (hasFace() && !tried.current) { tried.current = true; unlockWithFace().then((ok) => ok && onOpen()); } }, [onOpen]);

  const set = (v: string) => { pinRef.current = v; setPin(v); };
  const submit = useCallback(async () => {
    if (checking.current || pinRef.current.length < 4) return;
    checking.current = true;
    try {
      if (await checkPin(pinRef.current)) { onOpen(); return; }
      setShake(true); setWait(waitSeconds());
      setTimeout(() => { setShake(false); pinRef.current = ""; setPin(""); }, 400);
    } finally { checking.current = false; }
  }, [onOpen]);
  const press = (d: string) => {
    if (wait > 0 || checking.current || pinRef.current.length >= (len || 8)) return;
    set(pinRef.current + d);
    if (len && pinRef.current.length === len) void submit();
  };
  const dots = len || Math.max(4, pin.length);
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 py-10 text-center">
      <Koko size={120} mood={wait > 0 ? "sleepy" : "happy"} />
      <h1 className="mt-4 font-display text-3xl font-bold">Hi Bernard</h1>
      <p className="mt-1 text-sm text-muted" role="status">{wait > 0 ? `Too many tries. Wait ${wait}s.` : "Your PIN, please."}</p>
      <div className={`mt-5 flex gap-3 ${shake ? "animate-[wobble_.4s_ease]" : ""}`} aria-label={`${pin.length} of ${dots} digits entered`}>
        {Array.from({ length: dots }, (_, i) => <span key={i} className={`h-4 w-4 rounded-full border-[3px] border-line ${i < pin.length ? "bg-glow" : ""}`} />)}
      </div>
      <div className="mt-6 grid w-full grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => <button key={d} type="button" className="btn btn-plain key !px-0" onClick={() => press(d)} disabled={wait > 0}>{d}</button>)}
        <button type="button" className="btn btn-plain key !px-0" aria-label="Face ID" onClick={() => unlockWithFace().then((ok) => ok && onOpen())} disabled={!hasFace()}><ScanFace size={24} /></button>
        <button type="button" className="btn btn-plain key !px-0" onClick={() => press("0")} disabled={wait > 0}>0</button>
        <button type="button" className="btn btn-plain key !px-0" aria-label="Delete" onClick={() => set(pinRef.current.slice(0, -1))}><Delete size={22} /></button>
      </div>
      {!len && <button type="button" className="btn btn-glow mt-4 w-full" onClick={() => void submit()} disabled={pin.length < 4 || wait > 0}>Open</button>}
      <p className="mt-6 text-xs text-muted">Forgot it? Clear this site's data in Safari, then set a new PIN. Your Google files are not touched.</p>
    </div>
  );
}
