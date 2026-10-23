import { useEffect, useRef } from "react";
import { NameTagObject, SkinViewer as Viewer } from "skinview3d";
import { defaultSkin } from "../lib/defaultSkin";
import { LivelyAnimation, type EmoteKind } from "../lib/livelyAnimation";
import { animateCosmetics, applyCosmetics } from "../lib/cosmetics";

type Props = {
  skin: string | null;
  slim: boolean;
  name?: string;
  width: number;
  height: number;
  walking?: boolean;
  cosmetics?: string[];
  /** Change `n` to play the emote again. */
  emote?: { kind: EmoteKind; n: number } | null;
};

/** Animated 3D player model. Follows the mouse; click to make it wave, jump or spin. Drag to turn it. */
export default function SkinViewer({ skin, slim, name, width, height, walking, cosmetics, emote }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const anim = useRef(new LivelyAnimation());

  useEffect(() => {
    const el = canvas.current!;
    const v = new Viewer({ canvas: el, width, height, zoom: 0.8, fov: 38 });
    v.autoRotate = false;
    v.controls.enableZoom = false;
    v.controls.enablePan = false;
    v.globalLight.intensity = 2.4;
    v.cameraLight.intensity = 0.9;
    v.animation = anim.current;
    anim.current.onFrame = (t) => animateCosmetics(v, t);
    viewer.current = v;

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.3; // roughly where the head is
      anim.current.pointAt((e.clientX - cx) / (window.innerWidth / 2), (e.clientY - cy) / (window.innerHeight / 2));
    };
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      // A click (not a drag) plays a little action.
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) anim.current.play();
      down = null;
    };
    window.addEventListener("mousemove", onMove);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      v.dispose();
      viewer.current = null;
    };
  }, []);

  useEffect(() => viewer.current?.setSize(width, height), [width, height]);

  useEffect(() => {
    viewer.current?.loadSkin(skin ?? defaultSkin(), { model: skin ? (slim ? "slim" : "default") : "default" });
  }, [skin, slim]);

  useEffect(() => {
    anim.current.walking = !!walking;
  }, [walking]);

  const cosmeticsKey = (cosmetics ?? []).join(",");
  useEffect(() => {
    if (viewer.current) applyCosmetics(viewer.current, cosmetics ?? []);
  }, [cosmeticsKey]);

  useEffect(() => {
    if (emote) anim.current.play(emote.kind);
  }, [emote?.n]);

  useEffect(() => {
    const v = viewer.current;
    if (!v) return;
    v.nameTag = name
      ? new NameTagObject(name, { font: "bold 44px 'Unbounded', 'Segoe UI', sans-serif", backgroundStyle: "rgba(0,0,0,0.35)" })
      : null;
  }, [name]);

  return <canvas ref={canvas} className="skin-canvas" />;
}
