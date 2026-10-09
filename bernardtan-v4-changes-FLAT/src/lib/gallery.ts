/* The gallery: pictures from Bernard's Drive (read with his token) and pictures he picks from his phone (kept in this
   browser's IndexedDB, never uploaded anywhere). Both feed the same carousel. */
import { type Token, forget } from "./google";

export type Pic = { id: string; name: string; src: string; at?: string; from: "drive" | "phone"; link?: string };

/** Newest image files in Drive, with a thumbnail fetched through the token so it can be shown without a cookie. */
export async function drivePictures(token: Token, n = 24): Promise<Pic[]> {
  const url = `https://www.googleapis.com/drive/v3/files?${new URLSearchParams({
    q: "mimeType contains 'image/' and trashed = false", pageSize: String(n), orderBy: "modifiedTime desc",
    fields: "files(id,name,modifiedTime,webViewLink,thumbnailLink,size)" })}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token.access_token}` } });
  if (r.status === 401) { forget(); throw new Error("Google signed you out (the hour is up). Press Connect again."); }
  if (!r.ok) throw new Error(`Drive said ${r.status}`);
  const files: any[] = (await r.json()).files || [];
  const out: Pic[] = [];
  await Promise.all(files.map(async (f) => {
    const src = await thumb(token, f);
    if (src) out.push({ id: `d_${f.id}`, name: f.name, src, at: f.modifiedTime, from: "drive", link: f.webViewLink });
  }));
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

async function thumb(token: Token, f: any): Promise<string | null> {
  // the original is only a fallback for a small file: a 12 MB photo is not worth downloading to draw a card
  const tries = [f.thumbnailLink ? String(f.thumbnailLink).replace(/=s\d+$/, "=s800") : "",
    Number(f.size) > 0 && Number(f.size) <= 4_000_000 ? `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media` : ""];
  for (const u of tries) {
    if (!u) continue;
    try {
      const r = await fetch(u, { headers: { Authorization: `Bearer ${token.access_token}` } });
      if (r.ok) return URL.createObjectURL(await r.blob());
    } catch { /* next */ }
  }
  return null;
}

/* phone pictures in IndexedDB */
const DB = "bernard", STORE = "photos";
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const q = indexedDB.open(DB, 1);
    q.onupgradeneeded = () => q.result.createObjectStore(STORE, { keyPath: "id" });
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
  });
}
export async function addPhonePictures(files: FileList | File[]): Promise<number> {
  // Shrink first, store after: an IndexedDB transaction closes itself while we wait for a canvas, so a put after
  // `await shrink()` inside it throws and the picture is never kept.
  const ready: { name: string; blob: Blob }[] = [];
  for (const f of Array.from(files)) { if (f.type.startsWith("image/")) ready.push({ name: f.name, blob: await shrink(f) }); }
  if (!ready.length) return 0;
  const db = await open();
  const tx = db.transaction(STORE, "readwrite");
  const stamp = Date.now().toString(36), rnd = Math.random().toString(36).slice(2, 6);
  ready.forEach((r, i) => tx.objectStore(STORE).put({ id: `p_${stamp}${rnd}_${i}`, name: r.name, blob: r.blob, at: new Date().toISOString() }));
  await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
  return ready.length;
}
export async function phonePictures(): Promise<Pic[]> {
  try {
    const db = await open();
    const rows: any[] = await new Promise((res, rej) => { const q = db.transaction(STORE).objectStore(STORE).getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    return rows.sort((a, b) => String(b.at).localeCompare(String(a.at))).map((r) => ({ id: r.id, name: r.name, src: URL.createObjectURL(r.blob), at: r.at, from: "phone" as const }));
  } catch { return []; }
}
export async function removePhonePicture(id: string) {
  const db = await open();
  const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(id);
  await new Promise((res) => { tx.oncomplete = res; });
}
/** A phone photo is 3–8 MB; the carousel needs 1200px. Resize on a canvas so the database stays small. */
async function shrink(f: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
    if (k === 1 && f.size < 600_000) return f;
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob((b) => res(b || f), "image/jpeg", 0.85));
  } catch { return f; }
}

/** Give back the memory behind the picture addresses made for a list (call it when the list is replaced or the page closes). */
export function revokePics(pics: Pic[]) { for (const p of pics) { try { if (p.src.startsWith("blob:")) URL.revokeObjectURL(p.src); } catch { /* ignore */ } } }
