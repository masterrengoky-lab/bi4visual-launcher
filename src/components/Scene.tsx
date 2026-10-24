import { useMemo } from "react";

/**
 * Our own night landscape for the home page: purple sky with stars, a square
 * moon, blocky mountains, pine forest and a lake with the reflection. Drawn in
 * SVG so it scales to any window. A picture from the settings replaces it.
 */
type Props = { image: string | null; dim: number; blur: number; particles: boolean };

function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

/** A mountain ridge with a few big peaks, stepped like Minecraft terrain. */
function ridge(seed: number, base: number, amp: number, step: number) {
  const r = rng(seed);
  const waves = Array.from({ length: 3 }, (_, i) => ({ f: (0.004 + r() * 0.004) * (i + 1), p: r() * 6.3, a: 1 / (i + 1) }));
  let d = `M0 600 L0 ${base}`;
  for (let x = 0; x <= 1600; x += step) {
    const h = waves.reduce((sum, w) => sum + w.a * (0.5 + 0.5 * Math.sin(x * w.f + w.p)), 0) / 1.83;
    const y = Math.round((base - amp * h) / 8) * 8;
    d += ` L${x} ${y} L${x + step} ${y}`;
  }
  return d + " L1600 600 Z";
}

/** Pine trees: three stacked triangles on a short trunk. */
function pines(seed: number, count: number, ground: number, h: number) {
  const r = rng(seed);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = r() * 1600;
    const s = h * (0.55 + r() * 0.6);
    const w = s * 0.22;
    for (const [top, bottom, width] of [[0, 0.45, 0.6], [0.2, 0.7, 0.8], [0.42, 0.95, 1]]) {
      out.push(`M${x} ${ground - s * (1 - top)} L${x + w * width} ${ground - s * (1 - bottom)} L${x - w * width} ${ground - s * (1 - bottom)} Z`);
    }
    out.push(`M${x - w * 0.12} ${ground} L${x + w * 0.12} ${ground} L${x + w * 0.12} ${ground - s * 0.08} L${x - w * 0.12} ${ground - s * 0.08} Z`);
  }
  return out.join(" ");
}

export default function Scene({ image, dim, blur, particles }: Props) {
  const stars = useMemo(() => {
    const r = rng(42);
    return Array.from({ length: 140 }, () => ({ x: r() * 1600, y: r() * 300, s: r() < 0.15 ? 3 : 2, d: (r() * 5).toFixed(1) }));
  }, []);
  const shapes = useMemo(
    () => ({
      far: ridge(5, 330, 190, 16),
      mid: ridge(9, 390, 120, 16),
      forestBack: pines(13, 110, 432, 80),
      forestFront: pines(17, 70, 474, 130),
    }),
    [],
  );
  const motes = useMemo(() => {
    const r = rng(77);
    return Array.from({ length: 28 }, () => ({ left: `${r() * 100}%`, size: 2 + Math.round(r() * 3), delay: `${-(r() * 16)}s`, dur: `${12 + r() * 12}s` }));
  }, []);

  return (
    <div className="scene" aria-hidden>
      {image ? (
        <div className="scene-image" style={{ backgroundImage: `url("${image}")`, filter: blur ? `blur(${blur}px)` : undefined }} />
      ) : (
        <svg className="scene-svg" viewBox="0 0 1600 600" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0b0820" />
              <stop offset="0.45" stopColor="#24164a" />
              <stop offset="0.75" stopColor="#4a2a7c" />
              <stop offset="1" stopColor="#6b3fa0" />
            </linearGradient>
            <linearGradient id="lake" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3d2470" />
              <stop offset="1" stopColor="#0d0820" />
            </linearGradient>
            <radialGradient id="moonGlow">
              <stop offset="0" stopColor="#efe7ff" stopOpacity="0.55" />
              <stop offset="1" stopColor="#efe7ff" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#b9a2f0" stopOpacity="0" />
              <stop offset="0.5" stopColor="#b9a2f0" stopOpacity="0.28" />
              <stop offset="1" stopColor="#b9a2f0" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="1600" height="600" fill="url(#sky)" />
          {stars.map((s, i) => (
            <rect key={i} className="star" x={s.x} y={s.y} width={s.s} height={s.s} fill="#f3eaff" style={{ animationDelay: `${s.d}s` }} />
          ))}
          <circle cx="1000" cy="110" r="130" fill="url(#moonGlow)" />
          <rect x="970" y="80" width="60" height="60" fill="#f4efff" />
          <rect x="982" y="92" width="12" height="12" fill="#ddd2f5" />
          <rect x="1006" y="112" width="16" height="10" fill="#ddd2f5" />
          <path d={shapes.far} fill="#3b2566" />
          <rect y="300" width="1600" height="80" fill="url(#mist)" />
          <path d={shapes.mid} fill="#2a1a4d" />
          <path d={shapes.forestBack} fill="#1c1238" />
          <rect y="380" width="1600" height="70" fill="url(#mist)" opacity="0.7" />
          <path d={shapes.forestFront} fill="#120b26" />
          <rect y="470" width="1600" height="130" fill="url(#lake)" />
          <g opacity="0.35">
            <rect x="970" y="490" width="60" height="6" fill="#f4efff" />
            <rect x="980" y="505" width="40" height="4" fill="#f4efff" />
            <rect x="990" y="518" width="20" height="3" fill="#f4efff" />
          </g>
        </svg>
      )}
      <div className="scene-dim" style={{ opacity: image ? dim / 100 : 0.15 }} />
      {particles &&
        motes.map((m, i) => (
          <span key={i} className="mote" style={{ left: m.left, width: m.size, height: m.size, animationDelay: m.delay, animationDuration: m.dur }} />
        ))}
      <div className="scene-fade" />
    </div>
  );
}
