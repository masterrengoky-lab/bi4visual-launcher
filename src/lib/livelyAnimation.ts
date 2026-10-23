import { PlayerAnimation, type PlayerObject } from "skinview3d";

type Action = { kind: "wave" | "jump" | "spin"; start: number };

/**
 * Idle animation that feels alive: breathing, swaying arms, head that follows
 * the mouse, glances around when the mouse is still, and a wave, jump or spin
 * on click. Switches to walking while the game is being downloaded.
 */
export class LivelyAnimation extends PlayerAnimation {
  /** Where the mouse is, -1…1 on each axis relative to the model. */
  target = { x: 0, y: 0 };
  walking = false;
  private look = { x: 0, y: 0 };
  private lastMouse = 0;
  private action: Action | null = null;
  private nextIdleAction = 9;

  pointAt(x: number, y: number) {
    this.target = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
    this.lastMouse = this.progress;
  }

  play(kind?: Action["kind"]) {
    const kinds: Action["kind"][] = ["wave", "jump", "spin"];
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
      const a = (t - this.action.start) / 1.0; // in seconds of animation time
      switch (this.action.kind) {
        case "wave": {
          if (a > 2.2) break;
          const up = Math.min(1, a * 4, (2.2 - a) * 4);
          s.rightArm.rotation.z = -0.06 - up * 2.5 - Math.sin(a * 14) * 0.25 * up;
          s.rightArm.rotation.x = 0;
          s.head.rotation.z = Math.sin(a * 7) * 0.06 * up;
          break;
        }
        case "jump": {
          if (a > 0.8) break;
          const k = a / 0.8;
          player.position.y += Math.sin(k * Math.PI) * 4;
          const tuck = Math.sin(k * Math.PI);
          s.leftArm.rotation.z = 0.06 + tuck * 0.9;
          s.rightArm.rotation.z = -0.06 - tuck * 0.9;
          s.leftLeg.rotation.x = tuck * 0.3;
          s.rightLeg.rotation.x = -tuck * 0.3;
          break;
        }
        case "spin": {
          if (a > 1.0) break;
          const e = 1 - Math.pow(1 - a, 3);
          player.rotation.y += e * Math.PI * 2;
          player.position.y += Math.sin(a * Math.PI) * 1.5;
          break;
        }
      }
      const length = { wave: 2.2, jump: 0.8, spin: 1.0 }[this.action.kind];
      if (a > length) this.action = null;
    }
  }
}
