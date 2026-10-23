/** Our own pixel-art pictures for the home tiles. */

type Px = [number, number, number, number, string];

function Sprite({ w, h, px, className }: { w: number; h: number; px: Px[]; className?: string }) {
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" aria-hidden>
      {px.map(([x, y, pw, ph, c], i) => (
        <rect key={i} x={x} y={y} width={pw} height={ph} fill={c} />
      ))}
    </svg>
  );
}

export function ChestArt({ className }: { className?: string }) {
  const o = "#2a1708", wood = "#a8642a", dark = "#7b4518", light = "#cf8a45", metal = "#cfd3da", metalD = "#7d828c";
  return (
    <Sprite
      className={className}
      w={18}
      h={16}
      px={[
        [1, 1, 16, 14, o],
        [2, 2, 14, 5, light],
        [2, 6, 14, 1, dark],
        [2, 7, 14, 1, o],
        [2, 8, 14, 6, wood],
        [2, 13, 14, 1, dark],
        [3, 3, 12, 1, "#e0a364"],
        [4, 10, 3, 1, dark],
        [11, 11, 3, 1, dark],
        [8, 5, 2, 5, metalD],
        [8, 5, 2, 4, metal],
        [8, 7, 2, 1, o],
      ]}
    />
  );
}

export function BookArt({ className }: { className?: string }) {
  const o = "#1b1030", cover = "#7c3aed", coverD = "#5b21b6", page = "#f3ead7", gold = "#facc15";
  return (
    <Sprite
      className={className}
      w={18}
      h={16}
      px={[
        [2, 1, 13, 14, o],
        [3, 2, 11, 12, cover],
        [3, 2, 2, 12, coverD],
        [14, 3, 2, 11, page],
        [15, 2, 1, 12, o],
        [6, 4, 6, 1, gold],
        [6, 6, 4, 1, gold],
        [7, 9, 3, 3, "#a78bfa"],
        [8, 8, 1, 5, "#ede9fe"],
        [6, 10, 5, 1, "#ede9fe"],
        [0, 3, 1, 1, "#e9d5ff"],
        [16, 0, 1, 1, "#e9d5ff"],
        [17, 8, 1, 1, "#c4b5fd"],
      ]}
    />
  );
}

export function GrassBlockArt({ className }: { className?: string }) {
  // Isometric grass block drawn with polygons, pixel-shaded.
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden shapeRendering="crispEdges">
      <polygon points="16,3 29,10 16,17 3,10" fill="#5fbf3a" />
      <polygon points="3,10 16,17 16,30 3,23" fill="#8a5a33" />
      <polygon points="29,10 16,17 16,30 29,23" fill="#6b4425" />
      <polygon points="3,10 16,17 16,20 3,13" fill="#4a9a2b" />
      <polygon points="29,10 16,17 16,20 29,13" fill="#3b7d22" />
      <rect x="7" y="16" width="2" height="2" fill="#6e4628" />
      <rect x="11" y="21" width="2" height="2" fill="#a26c3f" />
      <rect x="21" y="18" width="2" height="2" fill="#57381e" />
      <rect x="24" y="22" width="2" height="2" fill="#7b4f2b" />
      <rect x="13" y="8" width="2" height="2" fill="#7fd957" />
      <rect x="19" y="10" width="2" height="2" fill="#4fa82f" />
      <polygon points="16,3 29,10 16,17 3,10" fill="none" stroke="#2b1a0c" strokeWidth="0.8" />
      <polyline points="3,10 3,23 16,30 29,23 29,10" fill="none" stroke="#2b1a0c" strokeWidth="0.8" />
      <line x1="16" y1="17" x2="16" y2="30" stroke="#2b1a0c" strokeWidth="0.6" />
    </svg>
  );
}
