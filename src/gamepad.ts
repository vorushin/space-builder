import type { V2 } from './logic/math';

/** One controller's state this frame (standard mapping: Xbox / PlayStation layout). */
export interface PadState {
  /** Gamepad API index: stable for as long as the controller stays connected */
  index: number;
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
  /** the A button was just pressed (menus) */
  confirm: boolean;
  /** any stick or button in use this frame */
  any: boolean;
}

const DEAD = 0.2;
const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, START: 9 } as const;

const empty = (index = -1): PadState => ({
  index, connected: false, move: { x: 0, z: 0 }, look: { x: 0, z: 0 }, fire: false, dash: false, missile: false,
  nova: false, build: false, pause: false, confirm: false, any: false,
});

function stick(x: number, y: number): V2 {
  const l = Math.hypot(x, y);
  if (l < DEAD) return { x: 0, z: 0 };
  const k = Math.min(1, (l - DEAD) / (1 - DEAD)) / l;
  return { x: x * k, z: y * k };
}

/** Polls the Gamepad API every frame and turns button presses into one-frame edges. */
export class Gamepads {
  private prev = new Map<number, boolean[]>();
  /** connected controllers this frame, by Gamepad API index */
  list: PadState[] = [];
  /** fires when a controller is plugged in (+1) or out (−1) */
  onChange: ((count: number, delta: number) => void) | null = null;
  private lastCount = 0;

  poll(): void {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()].filter((p): p is Gamepad => !!p && p.connected) : [];
    if (pads.length !== this.lastCount) {
      const delta = pads.length - this.lastCount;
      this.lastCount = pads.length;
      this.onChange?.(pads.length, delta);
    }
    const seen = new Set<number>();
    this.list = pads.map((gp) => {
      seen.add(gp.index);
      const down = gp.buttons.map((b) => b.pressed || b.value > 0.5);
      const prev = this.prev.get(gp.index) ?? [];
      const edge = (b: number) => !!down[b] && !prev[b];
      const move = stick(gp.axes[0] ?? 0, gp.axes[1] ?? 0);
      const look = stick(gp.axes[2] ?? 0, gp.axes[3] ?? 0);
      this.prev.set(gp.index, down);
      return {
        index: gp.index,
        connected: true,
        move,
        look,
        fire: (gp.buttons[BTN.RT]?.value ?? 0) > 0.3 || Math.hypot(look.x, look.z) > 0.35,
        dash: edge(BTN.A) || edge(BTN.LB),
        missile: edge(BTN.B) || edge(BTN.RB),
        nova: edge(BTN.Y),
        build: edge(BTN.X),
        pause: edge(BTN.START),
        confirm: edge(BTN.A),
        any: down.some(Boolean) || move.x !== 0 || move.z !== 0 || look.x !== 0 || look.z !== 0,
      };
    });
    for (const k of [...this.prev.keys()]) if (!seen.has(k)) this.prev.delete(k);
  }

  get count(): number {
    return this.lastCount;
  }

  /** A blank state (nothing pressed). */
  static none(): PadState {
    return empty();
  }
}
