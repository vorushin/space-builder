import { EXPANSIONS, MODULE_BY_KIND, type ModuleKind } from '../config/modules';
import type { V2 } from './math';

export const RING_RADII = [5.5, 10.5, 15.5];
export const RING_SOCKETS = [4, 6, 8];
/** Per-ring angle offset so the rings' sockets interleave nicely. */
const RING_OFFSET = [Math.PI / 4, 0, Math.PI / 8];

export interface Socket extends V2 {
  id: number;
  ring: number;
  angle: number;
}

/** All sockets for `rings` unlocked rings (1..3). Ids are stable: ring 0 → 0..3, ring 1 → 4..9, ring 2 → 10..17. */
export function socketsFor(rings: number): Socket[] {
  const out: Socket[] = [];
  let id = 0;
  for (let ring = 0; ring < RING_RADII.length; ring++) {
    const n = RING_SOCKETS[ring];
    for (let i = 0; i < n; i++, id++) {
      if (ring >= rings) continue;
      const angle = RING_OFFSET[ring] + (i / n) * Math.PI * 2;
      out.push({ id, ring, angle, x: Math.cos(angle) * RING_RADII[ring], z: Math.sin(angle) * RING_RADII[ring] });
    }
  }
  return out;
}

export const ALL_SOCKETS = socketsFor(RING_RADII.length);

export function nearestFreeSocket(sockets: Socket[], occupied: Set<number>, x: number, z: number, maxDist: number): Socket | null {
  let best: Socket | null = null;
  let bestD = maxDist * maxDist;
  for (const s of sockets) {
    if (occupied.has(s.id)) continue;
    const d = (s.x - x) ** 2 + (s.z - z) ** 2;
    if (d <= bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

export function moduleUnlocked(kind: ModuleKind, sector: number): boolean {
  return sector >= MODULE_BY_KIND[kind].unlockSector;
}

/** Can ring `ring` (1 or 2) be bought in this sector? */
export function ringUnlocked(ring: number, sector: number): boolean {
  const ex = EXPANSIONS[ring];
  return !!ex && ring > 0 && sector >= ex.unlockSector;
}
