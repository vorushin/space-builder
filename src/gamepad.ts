import type { V2 } from './logic/math';

/** One controller's state this frame (standard mapping: Xbox / PlayStation layout). */
export interface PadState {
  connected: boolean;
  /** left stick, screen-relative (up = −z) */
  move: V2;
  /** right stick; length 0 when centred */
  look: V2;
  /** trigger / right stick pushed: shoot */
  fire: boolean;
  dash: boolean;
  missile: boolean;
  nova: boolean;
  build: boolean;
  pause: boolean;
}

const DEAD = 0.2;
const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, START: 9 } as const;

const empty = (): PadState => ({ connected: false, move: { x: 0, z: 0 }, look: { x: 0, z: 0 }, fire: false, dash: false, missile: false, nova: false, build: false, pause: false });

function stick(x: number, y: number): V2 {
  const l = Math.hypot(x, y);
  if (l < DEAD) return { x: 0, z: 0 };
  const k = Math.min(1, (l - DEAD) / (1 - DEAD)) / l;
  return { x: x * k, z: y * k };
}

/** Polls the Gamepad API every frame and turns button presses into one-frame edges. */
export class Gamepads {
  private prev: boolean[][] = [];
  pads: PadState[] = [empty(), empty()];
  /** fires once when a controller is plugged in / out */
  onChange: ((count: number) => void) | null = null;
  private lastCount = 0;

  poll(): void {
    const list = typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()].filter((p): p is Gamepad => !!p && p.connected) : [];
    if (list.length !== this.lastCount) {
      this.lastCount = list.length;
      this.onChange?.(list.length);
    }
    for (let i = 0; i < 2; i++) {
      const gp = list[i];
      if (!gp) {
        this.pads[i] = empty();
        this.prev[i] = [];
        continue;
      }
      const down = gp.buttons.map((b) => b.pressed || b.value > 0.5);
      const prev = this.prev[i] ?? [];
      const edge = (b: number) => !!down[b] && !prev[b];
      const look = stick(gp.axes[2] ?? 0, gp.axes[3] ?? 0);
      this.pads[i] = {
        connected: true,
        move: stick(gp.axes[0] ?? 0, gp.axes[1] ?? 0),
        look,
        fire: (gp.buttons[BTN.RT]?.value ?? 0) > 0.3 || Math.hypot(look.x, look.z) > 0.35,
        dash: edge(BTN.A) || edge(BTN.LB),
        missile: edge(BTN.B) || edge(BTN.RB),
        nova: edge(BTN.Y),
        build: edge(BTN.X),
        pause: edge(BTN.START),
      };
      this.prev[i] = down;
    }
  }

  get count(): number {
    return this.lastCount;
  }
}
