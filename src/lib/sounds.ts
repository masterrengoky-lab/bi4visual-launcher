/** A short soft click for buttons, made on the fly so no sound files are needed. */
let ctx: AudioContext | null = null;
let enabled = false;

function click() {
  if (!enabled) return;
  ctx ??= new AudioContext();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.exponentialRampToValueAtTime(420, t + 0.06);
  gain.gain.setValueAtTime(0.06, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.09);
}

let installed = false;

export function setUiSounds(on: boolean) {
  enabled = on;
  if (installed) return;
  installed = true;
  window.addEventListener(
    "pointerdown",
    (e) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("button:not(:disabled)")) click();
    },
    true,
  );
}
