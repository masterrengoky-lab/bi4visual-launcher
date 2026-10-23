/**
 * Our own voxel cosmetics for the 3D model in the launcher: halo, horns,
 * crown, angel and demon wings, and a brand cape. They are drawn only here,
 * not in the game.
 */
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, type Object3D } from "three";
import type { SkinViewer } from "skinview3d";

export type CosmeticId = "halo" | "horns" | "crown" | "wings_angel" | "wings_demon" | "cape";

export const COSMETICS: { id: CosmeticId; name: string; icon: string; slot: "head" | "back" | "cape" }[] = [
  { id: "halo", name: "Нимб", icon: "😇", slot: "head" },
  { id: "horns", name: "Рога", icon: "😈", slot: "head" },
  { id: "crown", name: "Корона", icon: "👑", slot: "head" },
  { id: "wings_angel", name: "Крылья ангела", icon: "🕊️", slot: "back" },
  { id: "wings_demon", name: "Крылья демона", icon: "🦇", slot: "back" },
  { id: "cape", name: "Плащ bi4visual", icon: "🧣", slot: "cape" },
];

/** Picking an item replaces another one in the same slot. */
export function toggleCosmetic(current: string[], id: CosmeticId): string[] {
  if (current.includes(id)) return current.filter((c) => c !== id);
  const slot = COSMETICS.find((c) => c.id === id)!.slot;
  const sameSlot = new Set(COSMETICS.filter((c) => c.slot === slot).map((c) => c.id as string));
  return [...current.filter((c) => !sameSlot.has(c)), id];
}

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

function wing(side: 1 | -1, colors: string[], glow: number): Group {
  const pivot = new Group();
  const px = 1.15;
  WING.forEach((row, r) => {
    // merge runs of '#' into one box per run
    let start = -1;
    for (let i = 0; i <= row.length; i++) {
      const on = row[i] === "#";
      if (on && start < 0) start = i;
      if (!on && start >= 0) {
        const len = i - start;
        const mat = material(colors[Math.min(colors.length - 1, Math.floor((r / WING.length) * colors.length))], glow);
        vox(pivot, side * (start + len / 2) * px, (WING.length / 2 - r) * px, 0, len * px, px, 0.8, mat);
        start = -1;
      }
    }
  });
  return pivot;
}

function wings(kind: "angel" | "demon"): Group {
  const g = new Group();
  const colors = kind === "angel" ? ["#ffffff", "#f1f0ff", "#ddd6fe", "#c4b5fd"] : ["#1f1b2e", "#2e1065", "#3b0764", "#581c87"];
  const glow = kind === "angel" ? 0.25 : 0.15;
  for (const side of [-1, 1] as const) {
    const w = wing(side, colors, glow);
    w.position.set(side * 1.5, 3, -2.8);
    w.userData.side = side;
    g.add(w);
  }
  g.userData.kind = "wings";
  return g;
}

/** Cape texture in the standard 64×32 layout. */
function capeTexture(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 32;
  const g = c.getContext("2d")!;
  g.fillStyle = "#4c1d95";
  g.fillRect(0, 0, 64, 32);
  // the face seen from behind is at (1,1)-(11,17)
  g.fillStyle = "#6d28d9";
  g.fillRect(1, 1, 10, 16);
  g.fillStyle = "#facc15";
  g.fillRect(1, 1, 10, 1);
  g.fillRect(1, 16, 10, 1);
  g.fillRect(1, 1, 1, 16);
  g.fillRect(10, 1, 1, 16);
  // "b4"
  g.fillStyle = "#ffffff";
  for (const [x, y] of [[3, 5], [3, 6], [3, 7], [3, 8], [3, 9], [4, 7], [5, 7], [5, 8], [5, 9], [4, 9], [7, 5], [7, 6], [7, 7], [8, 7], [9, 5], [9, 6], [9, 7], [9, 8], [9, 9]]) {
    g.fillRect(x, y, 1, 1);
  }
  g.fillStyle = "#22c55e";
  g.fillRect(3, 12, 7, 1);
  return c;
}

const TAG = "bi4visual-cosmetic";

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
  if (ids.includes("halo")) add(head, halo());
  if (ids.includes("horns")) add(head, horns());
  if (ids.includes("crown")) add(head, crown());
  if (ids.includes("wings_angel")) add(body, wings("angel"));
  if (ids.includes("wings_demon")) add(body, wings("demon"));
  if (ids.includes("cape")) viewer.loadCape(capeTexture());
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
