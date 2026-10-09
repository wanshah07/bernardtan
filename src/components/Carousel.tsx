import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { Pic } from "../lib/gallery";

/* A card carousel: one row of picture cards that snap into place, arrows on wide screens, dots underneath, tap to open
   the picture large. Used on Home (a strip) and on the Gallery page (bigger cards). */
export default function Carousel({ pics, size = "md", onRemove }: { pics: Pic[]; size?: "sm" | "md"; onRemove?: (p: Pic) => void }) {
  const rail = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const [open, setOpen] = useState<Pic | null>(null);
  const w = size === "sm" ? "w-[42vw] max-w-[220px]" : "w-[78vw] max-w-[420px]";
  const h = size === "sm" ? "h-[42vw] max-h-[220px]" : "h-[78vw] max-h-[420px]";
  useEffect(() => {
    const el = rail.current; if (!el) return;
    const on = () => { const kids = Array.from(el.children) as HTMLElement[]; const mid = el.scrollLeft + el.clientWidth / 2; let best = 0, d = 1e9; kids.forEach((k, n) => { const c = k.offsetLeft + k.offsetWidth / 2; if (Math.abs(c - mid) < d) { d = Math.abs(c - mid); best = n; } }); setI(best); };
    el.addEventListener("scroll", on, { passive: true }); return () => el.removeEventListener("scroll", on);
  }, [pics.length]);
  const go = (n: number) => { const el = rail.current; const k = el?.children[Math.max(0, Math.min(pics.length - 1, n))] as HTMLElement | undefined; k?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }); };
  if (!pics.length) return null;
  return (
    <div className="relative">
      <div ref={rail} className="rail">
        {pics.map((p) => (
          <figure key={p.id} className={`card relative overflow-hidden ${w}`}>
            <button type="button" className={`block ${w} ${h}`} onClick={() => setOpen(p)} aria-label={`Open ${p.name}`}>
              <img src={p.src} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
            </button>
            <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
              <span className="truncate font-semibold">{p.name}</span>
              <span className="shrink-0 text-muted">{p.from === "drive" ? "Drive" : "Phone"}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      {pics.length > 1 && (
        <>
          <button type="button" aria-label="Previous" onClick={() => go(i - 1)} className="btn btn-plain absolute left-1 top-1/2 hidden !h-11 !min-h-0 !w-11 -translate-y-1/2 !p-0 sm:inline-flex"><ChevronLeft size={20} /></button>
          <button type="button" aria-label="Next" onClick={() => go(i + 1)} className="btn btn-plain absolute right-1 top-1/2 hidden !h-11 !min-h-0 !w-11 -translate-y-1/2 !p-0 sm:inline-flex"><ChevronRight size={20} /></button>
          <div className="mt-1 flex justify-center gap-1.5">{pics.map((p, n) => <button key={p.id} type="button" aria-label={`Picture ${n + 1}`} onClick={() => go(n)} className={`h-2.5 w-2.5 rounded-full border-2 border-line ${n === i ? "bg-glow" : "bg-surface"}`} />)}</div>
        </>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4" onClick={() => setOpen(null)} role="dialog" aria-label={open.name}>
          <img src={open.src} alt={open.name} className="max-h-[80vh] max-w-full rounded-card border-[3px] border-line object-contain" />
          <div className="mt-3 flex items-center gap-2 text-sm text-white">
            <span className="max-w-[60vw] truncate">{open.name}</span>
            {open.link && <a href={open.link} target="_blank" rel="noreferrer" className="btn btn-mustard px-3 py-1 text-xs" onClick={(e) => e.stopPropagation()}>Open in Drive</a>}
            {onRemove && open.from === "phone" && <button type="button" className="btn btn-ketchup px-3 py-1 text-xs" onClick={(e) => { e.stopPropagation(); onRemove(open); setOpen(null); }}>Remove</button>}
            <button type="button" className="btn btn-plain px-3 py-1 text-xs" aria-label="Close"><X size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
