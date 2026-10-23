import { useEffect, useRef } from "react";
import { IdleAnimation, NameTagObject, SkinViewer as Viewer, WalkingAnimation } from "skinview3d";

type Props = { skin: string | null; slim: boolean; name?: string; width: number; height: number; walking?: boolean };

/** Rotating 3D player model. Drag to turn it. */
export default function SkinViewer({ skin, slim, name, width, height, walking }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewer = useRef<Viewer | null>(null);

  useEffect(() => {
    const v = new Viewer({ canvas: canvas.current!, width, height, zoom: 0.8, fov: 40 });
    v.autoRotate = true;
    v.autoRotateSpeed = 0.6;
    v.controls.enableZoom = false;
    v.globalLight.intensity = 2.6;
    v.cameraLight.intensity = 0.7;
    viewer.current = v;
    return () => {
      v.dispose();
      viewer.current = null;
    };
  }, []);

  useEffect(() => viewer.current?.setSize(width, height), [width, height]);

  useEffect(() => {
    const v = viewer.current;
    if (!v) return;
    v.loadSkin(skin ?? placeholderSkin(), { model: slim ? "slim" : "default" });
  }, [skin, slim]);

  useEffect(() => {
    const v = viewer.current;
    if (!v) return;
    v.animation = walking ? new WalkingAnimation() : new IdleAnimation();
    if (v.animation) v.animation.speed = walking ? 0.7 : 1;
  }, [walking]);

  useEffect(() => {
    const v = viewer.current;
    if (v) {
      v.nameTag = name
        ? new NameTagObject(name, { font: "bold 44px 'Segoe UI', system-ui, sans-serif", backgroundStyle: "rgba(0,0,0,0.35)" })
        : null;
    }
  }, [name]);

  return <canvas ref={canvas} className="skin-canvas" />;
}

/** Our own simple default skin, used until the real one loads. */
export function placeholderSkin(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const box = (x: number, y: number, w: number, h: number, color: string) => {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
  };
  const skinTone = "#e0ac82";
  box(0, 0, 32, 16, skinTone); // head
  box(8, 0, 8, 8, "#3b2a20"); // hair top
  box(8, 8, 8, 2, "#3b2a20"); // fringe
  box(0, 8, 8, 3, "#3b2a20");
  box(16, 8, 8, 3, "#3b2a20");
  box(24, 8, 8, 8, "#3b2a20"); // back of head
  box(9, 12, 2, 1, "#fff");
  box(10, 12, 1, 1, "#4c2fb0");
  box(13, 12, 2, 1, "#fff");
  box(13, 12, 1, 1, "#4c2fb0");
  box(11, 14, 2, 1, "#a8735a");
  box(16, 16, 24, 16, "#7c4dff"); // body
  box(40, 16, 16, 16, "#7c4dff"); // right arm
  box(32, 48, 16, 16, "#7c4dff"); // left arm
  box(44, 28, 8, 4, skinTone); // hands
  box(36, 60, 8, 4, skinTone);
  box(0, 16, 16, 16, "#23324d"); // right leg
  box(16, 48, 16, 16, "#23324d"); // left leg
  box(0, 28, 16, 4, "#1a1a22"); // shoes
  box(16, 60, 16, 4, "#1a1a22");
  return c;
}
