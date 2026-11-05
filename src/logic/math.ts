/** Small 2D (XZ-plane) math helpers. Heading θ points along (cos θ, sin θ). */
export interface V2 {
  x: number;
  z: number;
}

export const TAU = Math.PI * 2;

export function dist2(a: V2, b: V2): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

export function dist(a: V2, b: V2): number {
  return Math.sqrt(dist2(a, b));
}

export function angleTo(from: V2, to: V2): number {
  return Math.atan2(to.z - from.z, to.x - from.x);
}

/** Wrap an angle into [-π, π]. */
export function wrapAngle(a: number): number {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

/** Rotate `cur` toward `target` by at most `maxStep` radians (shortest way). */
export function turnToward(cur: number, target: number, maxStep: number): number {
  const d = wrapAngle(target - cur);
  if (Math.abs(d) <= maxStep) return wrapAngle(target);
  return wrapAngle(cur + Math.sign(d) * maxStep);
}

/** Frame-rate independent exponential smoothing toward a target. */
export function damp(cur: number, target: number, lambda: number, dt: number): number {
  return target + (cur - target) * Math.exp(-lambda * dt);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Small deterministic PRNG (mulberry32). */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 0x9e3779b9;
  }
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }
  /** Integer in [lo, hi] inclusive. */
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
}
