import { PlayerAnimation, type PlayerObject } from "skinview3d";

export type EmoteKind = "wave" | "jump" | "spin" | "dance" | "dab" | "sit" | "bow" | "cheer";
type Action = { kind: EmoteKind; start: number };

export const EMOTES: { kind: EmoteKind; name: string; icon: string }[] = [
  { kind: "wave", name: "Привет", icon: "👋" },
  { kind: "dance", name: "Танец", icon: "🕺" },
  { kind: "dab", name: "Дэб", icon: "😎" },
  { kind: "cheer", name: "Ура", icon: "🙌" },
  { kind: "bow", name: "Поклон", icon: "🙇" },
  { kind: "sit", name: "Сесть", icon: "🪑" },
  { kind: "jump", name: "Прыжок", icon: "⬆️" },
  { kind: "spin", name: "Кружиться", icon: "🌀" },
];

const LENGTH: Record<EmoteKind, number> = { wave: 2.2, jump: 0.8, spin: 1.0, dance: 4.2, dab: 2.0, sit: 4.5, bow: 2.0, cheer: 2.6 };

/**
 * Idle animation that feels alive: breathing, swaying arms, head that follows
 * the mouse, glances around when the mouse is still, and a wave, jump or spin
 * on click. Switches to walking while the game is being downloaded.
 */
export class LivelyAnimation extends PlayerAnimation {
  /** Where the mouse is, -1…1 on each axis relative to the model. */
  target = { x: 0, y: 0 };
  walking = false;
  /** Called every frame with the animation time, for cosmetics. */
  onFrame?: (t: number) => void;
  private look = { x: 0, y: 0 };
  private lastMouse = 0;
  private action: Action | null = null;
  private nextIdleAction = 9;

  pointAt(x: number, y: number) {
    this.target = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
    this.lastMouse = this.progress;
  }

  play(kind?: EmoteKind) {
    const kinds: EmoteKind[] = ["wave", "jump", "spin"];
    this.action = { kind: kind ?? kinds[Math.floor(Math.random() * kinds.length)], start: this.progress };
  }

  protected animate(player: PlayerObject): void {
    const t = this.progress;
    const s = player.skin;

    // Mouse idle for a while: glance around on its own.
    let tx = this.target.x;
    let ty = this.target.y;
    if (t - this.lastMouse > 4) {
      tx = Math.sin(t * 0.45) * 0.7;
      ty = Math.sin(t * 0.3) * 0.2 - 0.1;
    }
    // Smooth the head towards the target.
    this.look.x += (tx - this.look.x) * 0.08;
    this.look.y += (ty - this.look.y) * 0.08;

    s.head.rotation.y = this.look.x * 0.75;
    s.head.rotation.x = this.look.y * 0.45;
    player.rotation.y = 0.35 + this.look.x * 0.25;

    // Breathing and arm sway.
    const breath = Math.sin(t * 1.6);
    s.body.scale.set(1, 1, 1 + breath * 0.012);
    player.position.y = breath * 0.12;
    s.leftArm.rotation.z = 0.06 + Math.cos(t * 1.6) * 0.04;
    s.rightArm.rotation.z = -0.06 - Math.cos(t * 1.6) * 0.04;
    s.leftArm.rotation.x = Math.sin(t * 0.8) * 0.06;
    s.rightArm.rotation.x = -Math.sin(t * 0.8) * 0.06;
    s.leftLeg.rotation.x = 0;
    s.rightLeg.rotation.x = 0;

    if (this.walking) {
      const w = t * 7;
      s.leftLeg.rotation.x = Math.sin(w) * 0.55;
      s.rightLeg.rotation.x = -Math.sin(w) * 0.55;
      s.leftArm.rotation.x = -Math.sin(w) * 0.55;
      s.rightArm.rotation.x = Math.sin(w) * 0.55;
      player.position.y = Math.abs(Math.cos(w)) * 0.4;
    }

    // Something on its own now and then.
    if (!this.action && !this.walking && t > this.nextIdleAction) {
      this.play(Math.random() < 0.6 ? "wave" : "jump");
      this.nextIdleAction = t + 10 + Math.random() * 8;
    }

    if (this.action) {
      const a = t - this.action.start;
      const len = LENGTH[this.action.kind];
      // ease in and out of the pose
      const k = Math.max(0, Math.min(1, a * 4, (len - a) * 4));
      const mix = (from: number, to: number) => from + (to - from) * k;
      switch (this.action.kind) {
        case "wave":
          s.rightArm.rotation.z = mix(s.rightArm.rotation.z, -2.6 - Math.sin(a * 14) * 0.25);
          s.rightArm.rotation.x = mix(s.rightArm.rotation.x, 0);
          s.head.rotation.z = Math.sin(a * 7) * 0.06 * k;
          break;
        case "jump": {
          const p = Math.min(1, a / len);
          const tuck = Math.sin(p * Math.PI);
          player.position.y += tuck * 4;
          s.leftArm.rotation.z = 0.06 + tuck * 0.9;
          s.rightArm.rotation.z = -0.06 - tuck * 0.9;
          s.leftLeg.rotation.x = tuck * 0.3;
          s.rightLeg.rotation.x = -tuck * 0.3;
          break;
        }
        case "spin": {
          const p = Math.min(1, a / len);
          player.rotation.y += (1 - Math.pow(1 - p, 3)) * Math.PI * 2;
          player.position.y += Math.sin(p * Math.PI) * 1.5;
          break;
        }
        case "dance": {
          const b = a * 9;
          const beat = Math.sin(b);
          player.position.y += Math.abs(Math.sin(b)) * 1.2 * k;
          player.rotation.y = mix(player.rotation.y, 0.35 + Math.sin(a * 2.2) * 0.6);
          s.body.rotation.z = beat * 0.08 * k;
          s.head.rotation.z = -beat * 0.15 * k;
          s.rightArm.rotation.z = mix(s.rightArm.rotation.z, beat > 0 ? -2.5 : -0.4);
          s.leftArm.rotation.z = mix(s.leftArm.rotation.z, beat > 0 ? 0.4 : 2.5);
          s.rightLeg.rotation.x = Math.sin(b) * 0.35 * k;
          s.leftLeg.rotation.x = -Math.sin(b) * 0.35 * k;
          break;
        }
        case "dab":
          s.rightArm.rotation.z = mix(s.rightArm.rotation.z, -2.3);
          s.rightArm.rotation.x = mix(s.rightArm.rotation.x, -0.2);
          s.leftArm.rotation.x = mix(s.leftArm.rotation.x, -1.6);
          s.leftArm.rotation.z = mix(s.leftArm.rotation.z, -0.9);
          s.head.rotation.x = mix(s.head.rotation.x, 0.55);
          s.head.rotation.y = mix(s.head.rotation.y, 0.6);
          break;
        case "cheer": {
          const shake = Math.sin(a * 16) * 0.2;
          s.rightArm.rotation.z = mix(s.rightArm.rotation.z, -2.9 + shake);
          s.leftArm.rotation.z = mix(s.leftArm.rotation.z, 2.9 - shake);
          player.position.y += Math.abs(Math.sin(a * 5)) * 2 * k;
          s.head.rotation.x = mix(s.head.rotation.x, -0.3);
          break;
        }
        case "bow":
          player.rotation.x = mix(0, 0.45);
          s.head.rotation.x = mix(s.head.rotation.x, 0.3);
          s.rightArm.rotation.x = mix(s.rightArm.rotation.x, 0.25);
          s.leftArm.rotation.x = mix(s.leftArm.rotation.x, -0.6);
          s.leftArm.rotation.z = mix(s.leftArm.rotation.z, -0.5);
          break;
        case "sit":
          s.rightLeg.rotation.x = mix(0, -1.5);
          s.leftLeg.rotation.x = mix(0, -1.5);
          s.rightArm.rotation.x = mix(s.rightArm.rotation.x, -0.5);
          s.leftArm.rotation.x = mix(s.leftArm.rotation.x, -0.5);
          player.position.y -= 6 * k;
          break;
      }
      if (a > len) {
        this.action = null;
        player.rotation.x = 0;
        s.body.rotation.z = 0;
        s.head.rotation.z = 0;
      }
    }
    this.onFrame?.(t);
  }
}
