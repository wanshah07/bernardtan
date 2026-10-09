import { useState } from "react";
import { LogIn } from "lucide-react";
import { type Token, clientId, signIn } from "../lib/google";

/* The one Connect button every Google page shows until there is a token. It explains itself when there is no client id yet. */
export default function Connect({ setToken, what, compact = false, label = "Connect Google", pick = false, onDone }: { setToken: (t: Token) => void; what: string; compact?: boolean; label?: string; pick?: boolean; onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const noId = !clientId();
  return (
    <div className={compact ? "" : "card mx-auto max-w-md p-6 text-center"}>
      {!compact && <p className="font-display text-xl font-semibold">Connect your Google account</p>}
      <p className={`text-sm text-muted ${compact ? "" : "mt-1"}`}>{what} stays in your own account; this app only gets a one-hour key, in this browser, and nothing is stored anywhere else.</p>
      <button type="button" className={`btn btn-ketchup ${compact ? "mt-2" : "mt-4"}`} disabled={busy} onClick={async () => {
        setBusy(true); setErr("");
        try { setToken(await signIn({ pick })); onDone?.(); } catch (e: any) { setErr(e.message || String(e)); } finally { setBusy(false); }
      }}><LogIn size={16} /> {busy ? "Opening Google…" : label}</button>
      {noId && <p className="mt-3 text-xs text-warn">No client id yet: paste it under <a href="#settings" className="underline">Settings</a> first.</p>}
      {err && <p className="mt-3 text-xs text-danger">{err}</p>}
    </div>
  );
}
