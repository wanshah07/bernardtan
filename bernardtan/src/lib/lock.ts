/* The app lock. Bernard's phone is already his, so this is a lock on the APP, not a server login: a 6-digit PIN kept as a
   salted SHA-256 hash in this browser, and Face ID / Touch ID through WebAuthn's platform authenticator when the device
   has one (the credential is created and later asked for locally; the OS does the face check and the app only learns
   that it passed). Google sign-in is separate and stays as it was. Honest limits: clearing site data clears the lock; a
   PIN is a six-digit PIN. */

const KEY_PIN = "bernard.lock.pin";          // {salt, hash}
const KEY_FACE = "bernard.lock.face";        // the credential id, base64url
const KEY_TRIES = "bernard.lock.tries";      // {n, until}
const SESSION = "bernard.lock.open";         // "1" while unlocked in this tab
export const AUTO_LOCK_MS = 5 * 60_000;      // lock again after this long in the background

const enc = new TextEncoder();
const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string | null) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ignore */ } };

export function hasPin() { return !!get(KEY_PIN); }
export function hasFace() { return !!get(KEY_FACE); }
export function isLocked() { return hasPin() && sessionStorage.getItem(SESSION) !== "1"; }
export function markOpen() { try { sessionStorage.setItem(SESSION, "1"); } catch { /* ignore */ } }
export function lockNow() { try { sessionStorage.removeItem(SESSION); } catch { /* ignore */ } }

async function hash(salt: string, pin: string) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(`${salt}:${pin}`));
  return b64(d);
}
export async function setPin(pin: string) {
  if (!/^\d{4,8}$/.test(pin)) throw new Error("A PIN is 4 to 8 digits.");
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)).buffer);
  set(KEY_PIN, JSON.stringify({ salt, hash: await hash(salt, pin) }));
  set(KEY_TRIES, null);
  markOpen();
}
export function clearLock() { set(KEY_PIN, null); set(KEY_FACE, null); set(KEY_TRIES, null); markOpen(); }

/** How long until another try is allowed, in seconds (0 = now). Five wrong PINs in a row wait 30 s, then 60, 120… */
export function waitSeconds() {
  try { const t = JSON.parse(get(KEY_TRIES) || "{}"); return t.until ? Math.max(0, Math.ceil((t.until - Date.now()) / 1000)) : 0; } catch { return 0; }
}
export async function checkPin(pin: string): Promise<boolean> {
  if (waitSeconds() > 0) return false;
  const rec = JSON.parse(get(KEY_PIN) || "null");
  if (!rec) return true;
  const ok = (await hash(rec.salt, pin)) === rec.hash;
  let t = { n: 0, until: 0 };
  try { t = { n: 0, until: 0, ...JSON.parse(get(KEY_TRIES) || "{}") }; } catch { /* fresh */ }
  if (ok) { set(KEY_TRIES, null); markOpen(); return true; }
  t.n = (t.n || 0) + 1;
  if (t.n >= 5) t.until = Date.now() + 30_000 * 2 ** (t.n - 5);
  set(KEY_TRIES, JSON.stringify(t));
  return false;
}

export async function faceAvailable(): Promise<boolean> {
  try { return !!(window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())); } catch { return false; }
}
/** Register this device's Face ID / Touch ID as a way in. Needs HTTPS (or localhost). */
export async function enrolFace(): Promise<void> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Bernard Tan", id: location.hostname },
      user: { id: enc.encode("bernard"), name: "bernard", displayName: "Bernard Tan" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
      timeout: 60_000, attestation: "none",
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Face ID was not set up.");
  set(KEY_FACE, b64(cred.rawId));
}
export async function unlockWithFace(): Promise<boolean> {
  const id = get(KEY_FACE);
  if (!id) return false;
  try {
    const got = await navigator.credentials.get({
      publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: "public-key", id: unb64(id) }], userVerification: "required", timeout: 60_000 },
    });
    if (got) { set(KEY_TRIES, null); markOpen(); return true; }
  } catch { /* cancelled or refused */ }
  return false;
}
export function forgetFace() { set(KEY_FACE, null); }
