import { useEffect, useRef, useState } from "react";
import { ImagePlus, RefreshCw } from "lucide-react";
import { type Token } from "../lib/google";
import { type Pic, addPhonePictures, drivePictures, phonePictures, removePhonePicture, revokePics } from "../lib/gallery";
import Carousel from "../components/Carousel";
import Connect from "../components/Connect";
import Koko from "../components/Koko";

/* Gallery: the pictures in Bernard's Drive and the ones he picks from his phone, as one carousel each. Phone pictures stay
   on the phone (this browser's own storage); nothing is uploaded. */
export default function GalleryPage({ token, setToken }: { token: Token | null; setToken: (t: Token) => void }) {
  const [drive, setDrive] = useState<Pic[]>([]);
  const [phone, setPhone] = useState<Pic[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const driveRef = useRef<Pic[]>([]), phoneRef = useRef<Pic[]>([]);
  const loadDrive = async () => {
    if (!token) return;
    setBusy(true); setErr("");
    try { const next = await drivePictures(token); revokePics(driveRef.current); driveRef.current = next; setDrive(next); } catch (e: any) { setErr(e.message || String(e)); } finally { setBusy(false); }
  };
  const loadPhone = async () => { const next = await phonePictures(); revokePics(phoneRef.current); phoneRef.current = next; setPhone(next); };
  useEffect(() => { loadPhone(); return () => { revokePics(phoneRef.current); revokePics(driveRef.current); }; }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (token) loadDrive(); }, [token]);   // eslint-disable-line react-hooks/exhaustive-deps
  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const n = await addPhonePictures(files);
      setMsg(n ? `${n} picture${n > 1 ? "s" : ""} added. They stay on this phone.` : "That was not a picture.");
    } catch { setMsg("This browser would not keep the pictures (a private window blocks it). Open the app normally and try again."); }
    loadPhone();
  };
  return (
    <div className="space-y-6 pt-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-3xl font-bold">Gallery</h1><p className="text-sm text-muted">Swipe through your pictures. Tap one to see it big.</p></div>
        <label className="btn btn-glow cursor-pointer"><ImagePlus size={16} /> Add from phone<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => pick(e.target.files)} /></label>
      </div>
      {msg && <p className="rounded-tile border-[3px] border-line bg-surface p-3 text-sm">{msg}</p>}
      <section>
        <div className="mb-2 flex items-center justify-between"><h2 className="font-display text-xl font-semibold">From your phone</h2><span className="text-xs text-muted">{phone.length} picture{phone.length === 1 ? "" : "s"}</span></div>
        {phone.length ? <Carousel pics={phone} onRemove={async (p) => { await removePhonePicture(p.id); loadPhone(); }} />
          : <div className="card flex items-center gap-4 p-5"><Koko size={72} mood="wave" className="shrink-0" /><p className="text-sm text-muted">Nothing here yet. <b>Add from phone</b> opens your photo picker; the pictures you choose show up here and stay on this phone.</p></div>}
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between"><h2 className="font-display text-xl font-semibold">From your Drive</h2>
          {token && <button type="button" className="btn btn-plain px-3 py-1 text-xs" onClick={loadDrive}><RefreshCw size={14} className={busy ? "animate-spin" : ""} /> Refresh</button>}</div>
        {!token ? <Connect setToken={setToken} what="Your Drive pictures" />
          : err ? <p className="rounded-tile border-[3px] border-danger bg-surface p-3 text-sm text-danger">{err}</p>
          : drive.length ? <Carousel pics={drive} />
          : <div className="card flex items-center gap-4 p-5"><Koko size={72} mood={busy ? "happy" : "sleepy"} className="shrink-0" /><p className="text-sm text-muted">{busy ? "Looking in your Drive…" : "No pictures in your Drive yet."}</p></div>}
      </section>
    </div>
  );
}
