/* The three looks, and the colour of the phone's status bar to match (index.html sets the same table before first paint). */
export const THEMES = ["day", "night", "glow"] as const;
export type Theme = (typeof THEMES)[number];
const BAR: Record<string, string> = { day: "#E8452C", night: "#201816", glow: "#0E1626" };

export function currentTheme(): Theme { const t = document.documentElement.getAttribute("data-theme") || "day"; return (THEMES as readonly string[]).includes(t) ? (t as Theme) : "day"; }
export function applyTheme(name: Theme) {
  document.documentElement.setAttribute("data-theme", name);
  try { localStorage.setItem("bernard.theme", name); } catch { /* private window */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BAR[name] || BAR.day);
}
