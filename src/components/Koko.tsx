/* Koko, Bernard's night-light. OUR OWN character, drawn here from scratch: a soft green glowing blob with stubby arms, two
   round eyes and a lopsided grin. It is inspired only by the general idea of a friendly glowing bedside toy; nothing is
   traced or copied from any show, and the name is ours. Moods: happy (default), wave, sleepy. */
import { useId } from "react";

export default function Koko({ size = 120, mood = "happy", className = "" }: { size?: number; mood?: "happy" | "wave" | "sleepy"; className?: string }) {
  const eyes = mood === "sleepy";
  const gid = `koko-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;     // one id per drawing: duplicates break when the first is hidden
  return (
    <svg className={`koko ${mood} ${className}`} width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <radialGradient id={gid} cx="45%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#D6FFB0" /><stop offset="55%" stopColor="#9EE860" /><stop offset="100%" stopColor="#5FB33C" />
        </radialGradient>
      </defs>
      {/* the halo */}
      <circle cx="60" cy="62" r="54" fill="#9EE860" opacity=".18" className="glow-pulse" />
      {/* arms */}
      <path className="arm-l" d="M22 70 q-12 2 -10 12 q4 8 14 2" fill={`url(#${gid})`} stroke="#2B4A1F" strokeWidth="3.5" strokeLinecap="round" />
      <path className="arm-r" d="M98 70 q12 2 10 12 q-4 8 -14 2" fill={`url(#${gid})`} stroke="#2B4A1F" strokeWidth="3.5" strokeLinecap="round" />
      {/* body: a squat rounded blob with a flat bottom, like something that sits on a shelf */}
      <path d="M30 30 q30 -22 60 0 q12 12 10 40 q-2 30 -40 32 q-38 -2 -40 -32 q-2 -28 10 -40 z" fill={`url(#${gid})`} stroke="#2B4A1F" strokeWidth="4" strokeLinejoin="round" />
      {/* the little tuft */}
      <path d="M60 18 q4 -10 10 -8" fill="none" stroke="#2B4A1F" strokeWidth="3.5" strokeLinecap="round" />
      {/* eyes */}
      {eyes ? (
        <>
          <path d="M40 56 q7 6 14 0" fill="none" stroke="#2B4A1F" strokeWidth="4" strokeLinecap="round" />
          <path d="M66 56 q7 6 14 0" fill="none" stroke="#2B4A1F" strokeWidth="4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <g className="eye"><circle cx="47" cy="56" r="9" fill="#FFFFFF" stroke="#2B4A1F" strokeWidth="3" /><circle cx="49" cy="58" r="4" fill="#2B4A1F" /></g>
          <g className="eye"><circle cx="73" cy="56" r="9" fill="#FFFFFF" stroke="#2B4A1F" strokeWidth="3" /><circle cx="75" cy="58" r="4" fill="#2B4A1F" /></g>
        </>
      )}
      {/* a lopsided grin with two little teeth */}
      <path d="M44 76 q16 14 34 -2" fill="none" stroke="#2B4A1F" strokeWidth="4" strokeLinecap="round" />
      <rect x="56" y="76" width="5" height="6" rx="1.5" fill="#FFFFFF" stroke="#2B4A1F" strokeWidth="2" />
      <rect x="63" y="75" width="5" height="6" rx="1.5" fill="#FFFFFF" stroke="#2B4A1F" strokeWidth="2" />
      {/* cheeks */}
      <circle cx="36" cy="68" r="4" fill="#FFB38A" opacity=".8" /><circle cx="84" cy="68" r="4" fill="#FFB38A" opacity=".8" />
    </svg>
  );
}
