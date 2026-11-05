import type { V2 } from './math';

/** Closest item within `range` of (x, z) that passes `filter`. */
export function nearest<T extends V2>(items: Iterable<T>, x: number, z: number, range: number, filter?: (t: T) => boolean): T | null {
  let best: T | null = null;
  let bestD = range * range;
  for (const it of items) {
    if (filter && !filter(it)) continue;
    const d = (it.x - x) ** 2 + (it.z - z) ** 2;
    if (d <= bestD) {
      bestD = d;
      best = it;
    }
  }
  return best;
}

/** Where to aim so a projectile of `speed` meets a target moving at constant velocity. Falls back to the target's position. */
export function leadAim(from: V2, target: V2 & { vx: number; vz: number }, speed: number): V2 {
  const dx = target.x - from.x;
  const dz = target.z - from.z;
  const a = target.vx * target.vx + target.vz * target.vz - speed * speed;
  const b = 2 * (dx * target.vx + dz * target.vz);
  const c = dx * dx + dz * dz;
  let t = -1;
  if (Math.abs(a) < 1e-9) {
    if (Math.abs(b) > 1e-9) t = -c / b;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      const t1 = (-b - sq) / (2 * a);
      const t2 = (-b + sq) / (2 * a);
      t = Math.min(t1, t2) > 0 ? Math.min(t1, t2) : Math.max(t1, t2);
    }
  }
  if (!(t > 0) || t > 5) return { x: target.x, z: target.z };
  return { x: target.x + target.vx * t, z: target.z + target.vz * t };
}
