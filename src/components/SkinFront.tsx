import { useEffect, useRef } from "react";
import { defaultSkin } from "../lib/defaultSkin";

/** Flat front view of a skin (like a paper doll), drawn from the texture. */
export default function SkinFront({ skin, slim, className }: { skin: string | null; slim: boolean; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const img = new Image();
    img.onload = () => {
      const g = c.getContext("2d")!;
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, c.width, c.height);
      const s = 8; // output pixels per skin pixel
      const arm = slim ? 3 : 4;
      const legacy = img.height === 32;
      const part = (sx: number, sy: number, w: number, h: number, dx: number, dy: number) =>
        g.drawImage(img, sx, sy, w, h, dx * s, dy * s, w * s, h * s);
      const ox = 4 - arm; // centre the body when arms are slim
      // base layers
      part(8, 8, 8, 8, ox + arm, 0); // head
      part(20, 20, 8, 12, ox + arm, 8); // body
      part(44, 20, arm, 12, ox, 8); // right arm
      if (legacy) part(44, 20, arm, 12, ox + arm + 8, 8);
      else part(36, 52, arm, 12, ox + arm + 8, 8); // left arm
      part(4, 20, 4, 12, ox + arm, 20); // right leg
      if (legacy) part(4, 20, 4, 12, ox + arm + 4, 20);
      else part(20, 52, 4, 12, ox + arm + 4, 20); // left leg
      // overlay layers
      part(40, 8, 8, 8, ox + arm, 0);
      if (!legacy) {
        part(20, 36, 8, 12, ox + arm, 8);
        part(44, 36, arm, 12, ox, 8);
        part(52, 52, arm, 12, ox + arm + 8, 8);
        part(4, 36, 4, 12, ox + arm, 20);
        part(4, 52, 4, 12, ox + arm + 4, 20);
      }
    };
    img.src = skin ?? defaultSkin().toDataURL();
  }, [skin, slim]);

  return <canvas ref={canvas} className={className} width={16 * 8} height={32 * 8} style={{ imageRendering: "pixelated" }} />;
}
