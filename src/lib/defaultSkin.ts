/**
 * Our own default skin (a hoodie character in the brand colours), painted
 * into a standard 64×64 skin texture. Used until the account's real skin loads.
 */

type Rgb = [number, number, number];

const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// Small deterministic noise so surfaces look like Minecraft textures, not flat fills.
function noise(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

export function defaultSkin(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;

  const px = (x: number, y: number, color: string, amount = 0.08) => {
    const [r, gg, b] = hex(color);
    const k = 1 + (noise(x, y) - 0.5) * 2 * amount;
    g.fillStyle = `rgb(${Math.min(255, r * k)},${Math.min(255, gg * k)},${Math.min(255, b * k)})`;
    g.fillRect(x, y, 1, 1);
  };
  const fill = (x: number, y: number, w: number, h: number, color: string, amount?: number) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, color, amount);
  };

  /** Face rectangles of a box in the skin layout. */
  const box = (ox: number, oy: number, w: number, h: number, d: number) => ({
    top: [ox + d, oy, w, d],
    bottom: [ox + d + w, oy, w, d],
    right: [ox, oy + d, d, h],
    front: [ox + d, oy + d, w, h],
    left: [ox + d + w, oy + d, d, h],
    back: [ox + 2 * d + w, oy + d, w, h],
  });
  type Face = number[];
  const all = (b: ReturnType<typeof box>) => Object.values(b) as Face[];

  const SKIN = "#e2a986", SKIN_D = "#c98b69", HAIR = "#3a2618", HAIR_L = "#4f3522";
  const HOOD = "#7c4dff", HOOD_D = "#5b33c9", HOOD_L = "#9874ff";
  const JEANS = "#2e4a7d", JEANS_D = "#223862", SHOE = "#eef0f4", SOLE = "#3a3f4b";

  // ---- head ----
  const head = box(0, 0, 8, 8, 8);
  for (const f of all(head)) fill(f[0], f[1], f[2], f[3], SKIN, 0.05);
  fill(...(head.top as [number, number, number, number]), HAIR, 0.15);
  fill(...(head.back as [number, number, number, number]), HAIR, 0.15);
  fill(head.back[0], head.back[1] + 7, 8, 1, SKIN_D);
  for (const side of [head.right, head.left]) {
    fill(side[0], side[1], 8, 3, HAIR, 0.15);
    fill(side[0] + (side === head.right ? 6 : 0), side[1] + 3, 2, 2, HAIR, 0.15);
  }
  const [fx, fy] = head.front;
  fill(fx, fy, 8, 2, HAIR, 0.15);
  for (const i of [0, 1, 4, 5, 6, 7]) px(fx + i, fy + 2, HAIR_L);
  fill(fx + 1, fy + 3, 2, 1, HAIR_L); // eyebrows
  fill(fx + 5, fy + 3, 2, 1, HAIR_L);
  px(fx + 1, fy + 4, "#ffffff", 0); px(fx + 2, fy + 4, "#3b2a8f", 0); // eyes
  px(fx + 5, fy + 4, "#3b2a8f", 0); px(fx + 6, fy + 4, "#ffffff", 0);
  px(fx + 3, fy + 5, SKIN_D); px(fx + 4, fy + 5, SKIN_D); // nose shade
  fill(fx + 3, fy + 6, 2, 1, "#9b5a48", 0); // mouth
  fill(head.bottom[0], head.bottom[1], 8, 8, SKIN_D);

  // ---- body (hoodie) ----
  const body = box(16, 16, 8, 12, 4);
  for (const f of all(body)) fill(f[0], f[1], f[2], f[3], HOOD, 0.07);
  for (const s of [body.right, body.left]) fill(s[0], s[1], s[2], s[3], HOOD_D, 0.07);
  const [bx, by] = body.front;
  fill(bx, by, 8, 1, HOOD_D); // collar
  px(bx + 3, by + 1, "#f5f3ff", 0); px(bx + 3, by + 2, "#f5f3ff", 0); px(bx + 3, by + 3, "#c4b5fd", 0); // strings
  px(bx + 4, by + 1, "#f5f3ff", 0); px(bx + 4, by + 2, "#f5f3ff", 0); px(bx + 4, by + 3, "#c4b5fd", 0);
  fill(bx + 1, by + 7, 6, 3, HOOD_D, 0.05); // pocket
  fill(bx + 1, by + 7, 6, 1, HOOD_L, 0.05);
  fill(bx, by + 11, 8, 1, HOOD_D); // waistband
  // small "b4" mark on the chest
  for (const [x, y] of [[1, 3], [1, 4], [1, 5], [2, 4], [2, 5]]) px(bx + x, by + y, "#22c55e", 0);
  const [kx, ky] = body.back;
  fill(kx + 1, ky, 6, 3, HOOD_D, 0.06); // hood on the back
  fill(kx + 2, ky + 3, 4, 1, HOOD_D, 0.06);
  fill(kx, ky + 11, 8, 1, HOOD_D);
  fill(body.top[0], body.top[1], 8, 4, HOOD_D);

  // ---- arms ----
  for (const [ox, oy] of [[40, 16], [32, 48]]) {
    const arm = box(ox, oy, 4, 12, 4);
    for (const f of all(arm)) {
      fill(f[0], f[1], f[2], f[3], HOOD, 0.07);
      if (f[3] === 12) {
        fill(f[0], f[1] + 8, f[2], 1, HOOD_D); // cuff
        fill(f[0], f[1] + 9, f[2], 3, SKIN, 0.05); // hand
      }
    }
    fill(arm.top[0], arm.top[1], 4, 4, HOOD_L);
    fill(arm.bottom[0], arm.bottom[1], 4, 4, SKIN_D);
  }

  // ---- legs ----
  for (const [ox, oy] of [[0, 16], [16, 48]]) {
    const leg = box(ox, oy, 4, 12, 4);
    for (const f of all(leg)) {
      fill(f[0], f[1], f[2], f[3], JEANS, 0.1);
      if (f[3] === 12) {
        fill(f[0], f[1] + 9, f[2], 2, SHOE, 0.04);
        fill(f[0], f[1] + 11, f[2], 1, SOLE, 0.04);
      }
    }
    fill(leg.front[0] + 1, leg.front[1] + 4, 1, 3, JEANS_D); // seam
    fill(leg.bottom[0], leg.bottom[1], 4, 4, SOLE);
  }
  return c;
}
