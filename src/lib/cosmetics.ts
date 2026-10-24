/**
 * KissLauncherVis cosmetics: our own capes, wings and headwear for the 3D
 * model in the launcher. Everything is free and drawn here in code.
 */
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, type Object3D } from "three";
import type { SkinViewer } from "skinview3d";
import type { Lang } from "./api";

export type Category = "cape" | "wings" | "hat";
export type Cosmetic = { id: string; category: Category; name: Record<Lang, string> };

const n = (ru: string, en: string, uk: string) => ({ ru, en, uk });

export const COSMETICS: Cosmetic[] = [
  { id: "cape_kiss", category: "cape", name: n("Kiss", "Kiss", "Kiss") },
  { id: "cape_midnight", category: "cape", name: n("Полночь", "Midnight", "Північ") },
  { id: "cape_sunset", category: "cape", name: n("Закат", "Sunset", "Захід сонця") },
  { id: "cape_neon", category: "cape", name: n("Неон", "Neon", "Неон") },
  { id: "cape_sakura", category: "cape", name: n("Сакура", "Sakura", "Сакура") },
  { id: "cape_galaxy", category: "cape", name: n("Галактика", "Galaxy", "Галактика") },
  { id: "cape_ember", category: "cape", name: n("Пламя", "Ember", "Полум'я") },
  { id: "cape_smile", category: "cape", name: n("Улыбка", "Smile", "Посмішка") },
  { id: "wings_angel", category: "wings", name: n("Крылья ангела", "Angel wings", "Крила ангела") },
  { id: "wings_demon", category: "wings", name: n("Крылья демона", "Demon wings", "Крила демона") },
  { id: "wings_neon", category: "wings", name: n("Неоновые крылья", "Neon wings", "Неонові крила") },
  { id: "wings_ember", category: "wings", name: n("Огненные крылья", "Ember wings", "Вогняні крила") },
  { id: "halo", category: "hat", name: n("Нимб", "Halo", "Німб") },
  { id: "horns", category: "hat", name: n("Рога", "Horns", "Роги") },
  { id: "crown", category: "hat", name: n("Корона", "Crown", "Корона") },
  { id: "cat_ears", category: "hat", name: n("Кошачьи ушки", "Cat ears", "Котячі вушка") },
  { id: "top_hat", category: "hat", name: n("Цилиндр", "Top hat", "Циліндр") },
];

/** Picking an item replaces another one of the same category. */
export function toggleCosmetic(current: string[], id: string): string[] {
  if (current.includes(id)) return current.filter((c) => c !== id);
  const cat = COSMETICS.find((c) => c.id === id)?.category;
  const same = new Set(COSMETICS.filter((c) => c.category === cat).map((c) => c.id));
  return [...current.filter((c) => !same.has(c)), id];
}

/* ---------- capes ---------- */

type Painter = (g: CanvasRenderingContext2D) => void;

/** Seeded random so the stars stay in place between renders. */
function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

// The face seen from behind the player is the 10×16 area at (1,1).
const FACE = { x: 1, y: 1, w: 10, h: 16 };

function px(g: CanvasRenderingContext2D, color: string, pts: number[][]) {
  g.fillStyle = color;
  for (const [x, y] of pts) g.fillRect(FACE.x + x, FACE.y + y, 1, 1);
}

function vertical(g: CanvasRenderingContext2D, colors: string[]) {
  for (let y = 0; y < FACE.h; y++) {
    g.fillStyle = colors[Math.min(colors.length - 1, Math.floor((y / FACE.h) * colors.length))];
    g.fillRect(FACE.x, FACE.y + y, FACE.w, 1);
  }
}

const HEART = [[3, 5], [4, 5], [6, 5], [7, 5], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [4, 9], [5, 9], [6, 9], [5, 10]];

const CAPES: Record<string, { base: string; paint: Painter }> = {
  cape_kiss: {
    base: "#3b0764",
    paint: (g) => {
      vertical(g, ["#581c87", "#6b21a8", "#7e22ce", "#9333ea"]);
      px(g, "#f472b6", HEART);
      px(g, "#fbcfe8", [[3, 6], [4, 6], [3, 7]]);
      g.fillStyle = "#f0abfc";
      g.fillRect(FACE.x, FACE.y, FACE.w, 1);
      g.fillRect(FACE.x, FACE.y + FACE.h - 1, FACE.w, 1);
    },
  },
  cape_midnight: {
    base: "#0b1026",
    paint: (g) => {
      vertical(g, ["#020617", "#0b1026", "#111a3d", "#1e1b4b"]);
      const r = rng(7);
      for (let i = 0; i < 14; i++) px(g, r() > 0.7 ? "#c4b5fd" : "#e2e8f0", [[Math.floor(r() * 10), Math.floor(r() * 16)]]);
      px(g, "#fde68a", [[6, 2], [7, 2], [7, 3], [7, 4], [6, 4], [8, 3]]);
    },
  },
  cape_sunset: {
    base: "#7c2d12",
    paint: (g) => {
      vertical(g, ["#fde68a", "#fdba74", "#fb923c", "#f97316", "#e11d48", "#9d174d", "#581c87", "#312e81"]);
      px(g, "#fff7ed", [[4, 5], [5, 5], [3, 6], [4, 6], [5, 6], [6, 6], [4, 7], [5, 7]]);
      g.fillStyle = "#1e1b4b";
      g.fillRect(FACE.x, FACE.y + 13, FACE.w, 3);
    },
  },
  cape_neon: {
    base: "#09090b",
    paint: (g) => {
      vertical(g, ["#09090b"]);
      for (let y = 1; y < 16; y += 4) {
        g.fillStyle = "#22d3ee";
        g.fillRect(FACE.x, FACE.y + y, FACE.w, 1);
        g.fillStyle = "#f472b6";
        g.fillRect(FACE.x, FACE.y + y + 2, FACE.w, 1);
      }
    },
  },
  cape_sakura: {
    base: "#fbcfe8",
    paint: (g) => {
      vertical(g, ["#fdf2f8", "#fce7f3", "#fbcfe8", "#f9a8d4"]);
      const r = rng(21);
      for (let i = 0; i < 9; i++) {
        const x = 1 + Math.floor(r() * 8), y = 1 + Math.floor(r() * 14);
        px(g, "#ec4899", [[x, y]]);
        px(g, "#f472b6", [[x + 1, y], [x, y + 1]]);
      }
      px(g, "#78350f", [[0, 3], [1, 4], [2, 4], [3, 5]]);
    },
  },
  cape_galaxy: {
    base: "#1e1b4b",
    paint: (g) => {
      vertical(g, ["#0f0a2e", "#2e1065", "#4c1d95", "#2e1065", "#0f0a2e"]);
      const r = rng(3);
      for (let i = 0; i < 18; i++) px(g, ["#e9d5ff", "#a5f3fc", "#ffffff", "#f0abfc"][i % 4], [[Math.floor(r() * 10), Math.floor(r() * 16)]]);
      px(g, "#c084fc", [[4, 7], [5, 7], [5, 8], [4, 8], [3, 6], [6, 9], [2, 6], [7, 9]]);
    },
  },
  cape_ember: {
    base: "#450a0a",
    paint: (g) => {
      vertical(g, ["#1c0a0a", "#450a0a", "#7f1d1d", "#b91c1c", "#ea580c", "#f59e0b"]);
      const r = rng(11);
      for (let x = 0; x < 10; x++) {
        const h = 3 + Math.floor(r() * 5);
        g.fillStyle = "#fbbf24";
        g.fillRect(FACE.x + x, FACE.y + 16 - h, 1, 1);
      }
    },
  },
  cape_smile: {
    base: "#050505",
    paint: (g) => {
      vertical(g, ["#050505"]);
      px(g, "#ffffff", [[3, 5], [6, 5], [2, 8], [7, 8], [3, 9], [4, 9], [5, 9], [6, 9]]);
    },
  },
};

/** Cape texture in the standard 64×32 layout. */
function capeTexture(id: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 32;
  const g = c.getContext("2d")!;
  const cape = CAPES[id] ?? CAPES.cape_kiss;
  g.fillStyle = cape.base;
  g.fillRect(0, 0, 64, 32);
  cape.paint(g);
  return c;
}

/* ---------- previews ---------- */

// Pixel-art icons for wings and headwear, 12×12, one letter per palette colour.
const ICONS: Record<string, { rows: string[]; pal: Record<string, string> }> = {
  wings_angel: { pal: { a: "#ffffff", b: "#ddd6fe", c: "#a78bfa" }, rows: ["............", "aa........aa", "aaa......aaa", "abaa....aaba", "abba....abba", "abbaa..aabba", ".abbaaaabba.", ".abbcaacbba.", "..abccccba..", "...abccba...", "....abba....", "............"] },
  wings_demon: { pal: { a: "#1f1b2e", b: "#3b0764", c: "#7c3aed" }, rows: ["............", "a..........a", "aa........aa", "aba......aba", "abba....abba", "abbba..abbba", ".abbbaabbba.", ".abcbaabcba.", "..abccccba..", "...abccba...", "....abba....", "............"] },
  wings_neon: { pal: { a: "#67e8f9", b: "#22d3ee", c: "#f472b6" }, rows: ["............", "aa........aa", "aba......aba", "abba....abba", "abcba..abcba", ".abcbaabcba.", ".abccbbccba.", "..abccccba..", "...abccba...", "....abba....", "............", "............"] },
  wings_ember: { pal: { a: "#fde047", b: "#f97316", c: "#b91c1c" }, rows: ["............", "a..........a", "aa........aa", "aba......aba", "abba....abba", "abcba..abcba", ".abcbaabcba.", ".abccbbccba.", "..abccccba..", "...abccba...", "....abba....", "............"] },
  halo: { pal: { a: "#fcd34d", b: "#fef3c7" }, rows: ["............", "............", "............", "...aaaaaa...", "..abbbbbba..", ".ab......ba.", ".ab......ba.", "..abbbbbba..", "...aaaaaa...", "............", "............", "............"] },
  horns: { pal: { a: "#f87171", b: "#b91c1c", c: "#7f1d1d" }, rows: ["............", ".a........a.", ".a........a.", ".ba......ab.", "..b......b..", "..bb....bb..", "..cb....bc..", "...cc..cc...", "...cc..cc...", "............", "............", "............"] },
  crown: { pal: { a: "#facc15", b: "#ef4444", c: "#3b82f6" }, rows: ["............", "............", ".a...aa...a.", ".aa..aa..aa.", ".aaa.aa.aaa.", ".aaaaaaaaaa.", ".aacaabaaca.", ".aaaaaaaaaa.", ".aaaaaaaaaa.", "............", "............", "............"] },
  cat_ears: { pal: { a: "#27272a", b: "#f9a8d4" }, rows: ["............", "............", ".a........a.", ".aa......aa.", ".aba....aba.", ".abba..abba.", ".abbaaaabba.", ".aaaaaaaaaa.", "............", "............", "............", "............"] },
  top_hat: { pal: { a: "#18181b", b: "#7c3aed", c: "#3f3f46" }, rows: ["............", "...aaaaaa...", "...acaaaaa..", "...aaaaaa...", "...aaaaaa...", "...aaaaaa...", "...bbbbbb...", "...aaaaaa...", ".aaaaaaaaaa.", ".aaaaaaaaaa.", "............", "............"] },
};

const previewCache = new Map<string, string>();

/** A small picture of the item for the cosmetics grid. */
export function preview(id: string): string {
  const hit = previewCache.get(id);
  if (hit) return hit;
  const c = document.createElement("canvas");
  const g = c.getContext("2d")!;
  if (CAPES[id]) {
    const tex = capeTexture(id);
    c.width = FACE.w;
    c.height = FACE.h;
    g.drawImage(tex, FACE.x, FACE.y, FACE.w, FACE.h, 0, 0, FACE.w, FACE.h);
  } else {
    const icon = ICONS[id];
    c.width = 12;
    c.height = 12;
    icon?.rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const col = icon.pal[ch];
        if (col) {
          g.fillStyle = col;
          g.fillRect(x, y, 1, 1);
        }
      }),
    );
  }
  const url = c.toDataURL();
  previewCache.set(id, url);
  return url;
}

/* ---------- 3D models ---------- */

function material(color: string, glow = 0) {
  return new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: glow, roughness: 0.8, metalness: 0.1 });
}

function vox(parent: Object3D, x: number, y: number, z: number, w: number, h: number, d: number, mat: MeshStandardMaterial) {
  const m = new Mesh(new BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function halo(): Group {
  const g = new Group();
  const gold = material("#fcd34d", 0.6);
  vox(g, 0, 0, 4.5, 10, 1, 1, gold);
  vox(g, 0, 0, -4.5, 10, 1, 1, gold);
  vox(g, 4.5, 0, 0, 1, 1, 8, gold);
  vox(g, -4.5, 0, 0, 1, 1, 8, gold);
  g.position.y = 11.5;
  g.rotation.x = 0.15;
  g.userData.kind = "halo";
  return g;
}

function horns(): Group {
  const g = new Group();
  const dark = material("#7f1d1d", 0.1);
  const mid = material("#b91c1c", 0.15);
  const tip = material("#f87171", 0.3);
  for (const s of [-1, 1]) {
    vox(g, s * 2.6, 8.8, 1, 2, 2, 2, dark);
    vox(g, s * 3.3, 10.4, 0.6, 1.6, 1.8, 1.6, mid);
    vox(g, s * 4.0, 11.8, 0.1, 1.1, 1.6, 1.1, tip);
  }
  return g;
}

function crown(): Group {
  const g = new Group();
  const gold = material("#facc15", 0.35);
  const ruby = material("#ef4444", 0.6);
  const sapphire = material("#3b82f6", 0.6);
  vox(g, 0, 8.6, 4.4, 9, 1.6, 0.8, gold);
  vox(g, 0, 8.6, -4.4, 9, 1.6, 0.8, gold);
  vox(g, 4.4, 8.6, 0, 0.8, 1.6, 8, gold);
  vox(g, -4.4, 8.6, 0, 0.8, 1.6, 8, gold);
  for (const [x, z] of [[-4.4, 4.4], [0, 4.4], [4.4, 4.4], [-4.4, -4.4], [0, -4.4], [4.4, -4.4], [4.4, 0], [-4.4, 0]]) {
    vox(g, x, 10.1, z, 1, 1.4, 1, gold);
  }
  vox(g, 0, 8.6, 4.9, 1.2, 1, 0.4, ruby);
  vox(g, -2.4, 8.6, 4.9, 0.9, 0.8, 0.4, sapphire);
  vox(g, 2.4, 8.6, 4.9, 0.9, 0.8, 0.4, sapphire);
  return g;
}

function catEars(): Group {
  const g = new Group();
  const fur = material("#27272a", 0.05);
  const inner = material("#f9a8d4", 0.25);
  for (const s of [-1, 1]) {
    vox(g, s * 2.8, 8.8, 0, 2.6, 1.6, 1.2, fur);
    vox(g, s * 2.8, 10.2, 0, 1.8, 1.4, 1.2, fur);
    vox(g, s * 2.8, 11.3, 0, 0.9, 1, 1.2, fur);
    vox(g, s * 2.8, 9.6, 0.65, 1.2, 1.6, 0.2, inner);
  }
  return g;
}

function topHat(): Group {
  const g = new Group();
  const black = material("#18181b", 0.02);
  const band = material("#7c3aed", 0.4);
  vox(g, 0, 8.4, 0, 11, 0.8, 11, black);
  vox(g, 0, 11, 0, 7, 4.6, 7, black);
  vox(g, 0, 9.4, 0, 7.2, 1, 7.2, band);
  return g;
}

// Wing feather layout, outward to the right, top row first.
const WING = [
  "..........#####",
  "........#######",
  "......#########",
  "....##########.",
  "..###########..",
  ".##########....",
  "#########......",
  "#######........",
  "#####..........",
  "####...........",
  "###............",
  "##.............",
];

const WING_COLORS: Record<string, { colors: string[]; glow: number }> = {
  wings_angel: { colors: ["#ffffff", "#f1f0ff", "#ddd6fe", "#c4b5fd"], glow: 0.25 },
  wings_demon: { colors: ["#1f1b2e", "#2e1065", "#3b0764", "#581c87"], glow: 0.15 },
  wings_neon: { colors: ["#a5f3fc", "#22d3ee", "#e879f9", "#f472b6"], glow: 0.9 },
  wings_ember: { colors: ["#fde047", "#f59e0b", "#f97316", "#b91c1c"], glow: 0.7 },
};

function wing(side: 1 | -1, colors: string[], glow: number): Group {
  const pivot = new Group();
  const size = 1.15;
  WING.forEach((row, r) => {
    // merge runs of '#' into one box per run
    let start = -1;
    for (let i = 0; i <= row.length; i++) {
      const on = row[i] === "#";
      if (on && start < 0) start = i;
      if (!on && start >= 0) {
        const len = i - start;
        const mat = material(colors[Math.min(colors.length - 1, Math.floor((r / WING.length) * colors.length))], glow);
        vox(pivot, side * (start + len / 2) * size, (WING.length / 2 - r) * size, 0, len * size, size, 0.8, mat);
        start = -1;
      }
    }
  });
  return pivot;
}

function wings(id: string): Group {
  const g = new Group();
  const { colors, glow } = WING_COLORS[id] ?? WING_COLORS.wings_angel;
  for (const side of [-1, 1] as const) {
    const w = wing(side, colors, glow);
    w.position.set(side * 1.5, 3, -2.8);
    w.userData.side = side;
    g.add(w);
  }
  g.userData.kind = "wings";
  return g;
}

const TAG = "kissvis-cosmetic";
const HATS: Record<string, () => Group> = { halo, horns, crown, cat_ears: catEars, top_hat: topHat };

/** Puts the chosen cosmetics on the model, removing the old ones. */
export function applyCosmetics(viewer: SkinViewer, ids: string[]) {
  const { head, body } = viewer.playerObject.skin;
  for (const part of [head, body]) {
    for (const child of [...part.children]) if (child.userData.tag === TAG) part.remove(child);
  }
  const add = (part: Object3D, g: Group) => {
    g.userData.tag = TAG;
    part.add(g);
  };
  for (const id of ids) {
    if (HATS[id]) add(head, HATS[id]());
    if (WING_COLORS[id]) add(body, wings(id));
  }
  const cape = ids.find((id) => CAPES[id]);
  if (cape) viewer.loadCape(capeTexture(cape));
  else viewer.loadCape(null);
}

/** Small idle motion for cosmetics: the halo floats, wings flap. */
export function animateCosmetics(viewer: SkinViewer, t: number) {
  const { head, body } = viewer.playerObject.skin;
  for (const g of head.children) {
    if (g.userData.tag === TAG && g.userData.kind === "halo") {
      g.position.y = 11.5 + Math.sin(t * 2) * 0.4;
      g.rotation.y = Math.sin(t * 0.7) * 0.2;
    }
  }
  for (const g of body.children) {
    if (g.userData.tag !== TAG || g.userData.kind !== "wings") continue;
    for (const w of g.children) {
      const side = w.userData.side as number;
      w.rotation.y = side * (0.55 + Math.sin(t * 2.2) * 0.22);
      w.rotation.z = side * 0.1;
    }
  }
}
