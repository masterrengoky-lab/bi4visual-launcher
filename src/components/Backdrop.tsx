import { useMemo } from "react";

/** Animated background: drifting colour glows, a faint block grid and floating pixels. */
export default function Backdrop() {
  const pixels = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        size: 4 + ((i * 7) % 4) * 3,
        delay: `${-((i * 1.7) % 18)}s`,
        duration: `${14 + ((i * 5) % 10)}s`,
        color: ["#8b5cf6", "#22c55e", "#f59e0b", "#38bdf8"][i % 4],
      })),
    [],
  );
  return (
    <div className="backdrop" aria-hidden>
      <div className="glow glow-a" />
      <div className="glow glow-b" />
      <div className="glow glow-c" />
      <div className="grid" />
      <div className="horizon" />
      {pixels.map((p, i) => (
        <span
          key={i}
          className="pixel"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
      <div className="vignette" />
    </div>
  );
}
