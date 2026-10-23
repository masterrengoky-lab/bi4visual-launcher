import { useMemo } from "react";

/** Animated background: drifting colour glows, a faint block grid and floating pixels. */
export default function Backdrop() {
  const pixels = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        size: 3 + ((i * 7) % 4) * 2,
        delay: `${-((i * 1.7) % 18)}s`,
        duration: `${14 + ((i * 5) % 10)}s`,
        color: ["#f97316", "#fbbf24", "#ef4444", "#fb923c", "#a78bfa"][i % 5],
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
