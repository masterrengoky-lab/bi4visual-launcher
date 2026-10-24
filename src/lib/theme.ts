/** Button colours, background presets and interface size. */
import type { Settings } from "./api";

export const ACCENTS = [
  "#3fbf5f", "#7ccf2e", "#14b8a6", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899",
  "#f43f5e", "#f97316", "#eab308", "#10b981", "#2dd4bf", "#38bdf8", "#2563eb",
  "#a78bfa", "#e11d48", "#fb7185", "#f59e0b", "#c8a36b", "#cbd5e1",
];

export const BG_PRESETS: { id: string; name: string; css: string }[] = [
  { id: "scene", name: "Сцена", css: "radial-gradient(circle at 30% 20%, #4c1d95, transparent 60%), radial-gradient(circle at 80% 90%, #9a3412, transparent 55%), #0b0a12" },
  { id: "sunset", name: "Закат", css: "linear-gradient(180deg, #1e1b4b 0%, #7c2d12 55%, #f59e0b 100%)" },
  { id: "night", name: "Ночь", css: "radial-gradient(ellipse at 50% 120%, #1e3a8a, transparent 60%), linear-gradient(180deg, #020617, #0f172a)" },
  { id: "ocean", name: "Океан", css: "radial-gradient(circle at 70% 30%, #0e7490, transparent 55%), linear-gradient(180deg, #082f49, #020617)" },
  { id: "forest", name: "Лес", css: "radial-gradient(circle at 20% 80%, #166534, transparent 55%), radial-gradient(circle at 80% 20%, #365314, transparent 50%), #052e16" },
  { id: "nether", name: "Незер", css: "radial-gradient(circle at 50% 100%, #b91c1c, transparent 60%), radial-gradient(circle at 10% 10%, #7f1d1d, transparent 45%), #1c0606" },
  { id: "end", name: "Энд", css: "radial-gradient(circle at 60% 40%, #6b21a8, transparent 55%), radial-gradient(circle at 20% 90%, #1e1b4b, transparent 50%), #07040f" },
  { id: "graphite", name: "Графит", css: "linear-gradient(180deg, #1c1c1f, #0c0c0d)" },
];

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Dark text on light colours, white on the rest. */
function ink(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const l = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return l > 170 ? "#111" : "#fff";
}

export function applyTheme(s: Pick<Settings, "accent" | "ui_scale">) {
  const accent = /^#[0-9a-fA-F]{6}$/.test(s.accent) ? s.accent : ACCENTS[0];
  const root = document.documentElement.style;
  root.setProperty("--accent", accent);
  root.setProperty("--accent-light", shade(accent, 0.25));
  root.setProperty("--accent-dark", shade(accent, -0.35));
  root.setProperty("--accent-ink", ink(accent));
  (document.body.style as CSSStyleDeclaration & { zoom: string }).zoom = String((s.ui_scale || 100) / 100);
}
