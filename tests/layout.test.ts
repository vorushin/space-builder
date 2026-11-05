import { describe, expect, it } from 'vitest';
import { RING_RADII, moduleUnlocked, nearestFreeSocket, ringUnlocked, socketsFor } from '../src/logic/layout';

describe('station layout', () => {
  it('has 4 / 10 / 18 sockets for 1 / 2 / 3 rings', () => {
    expect(socketsFor(1)).toHaveLength(4);
    expect(socketsFor(2)).toHaveLength(10);
    expect(socketsFor(3)).toHaveLength(18);
  });

  it('puts every socket on its ring radius with unique, stable ids', () => {
    const all = socketsFor(3);
    for (const s of all) expect(Math.hypot(s.x, s.z)).toBeCloseTo(RING_RADII[s.ring], 9);
    expect(new Set(all.map((s) => s.id)).size).toBe(18);
    const one = socketsFor(1).map((s) => s.id);
    expect(one).toEqual([0, 1, 2, 3]);
    expect(socketsFor(2).map((s) => s.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    // ring-0 sockets keep their position when the station expands
    expect(socketsFor(3).slice(0, 4)).toEqual(socketsFor(1));
  });

  it('finds the nearest free socket within reach', () => {
    const s = socketsFor(1);
    const target = s[2];
    expect(nearestFreeSocket(s, new Set(), target.x + 0.3, target.z, 3)?.id).toBe(target.id);
    expect(nearestFreeSocket(s, new Set([target.id]), target.x, target.z, 1)).toBeNull();
    expect(nearestFreeSocket(s, new Set(), 100, 100, 3)).toBeNull();
  });

  it('unlocks modules and rings sector by sector', () => {
    expect(moduleUnlocked('turret', 0)).toBe(true);
    expect(moduleUnlocked('shield', 0)).toBe(false);
    expect(moduleUnlocked('shield', 1)).toBe(true);
    expect(moduleUnlocked('tesla', 0)).toBe(false);
    expect(moduleUnlocked('tesla', 2)).toBe(true);
    expect(ringUnlocked(1, 0)).toBe(false);
    expect(ringUnlocked(1, 1)).toBe(true);
    expect(ringUnlocked(2, 1)).toBe(false);
    expect(ringUnlocked(2, 2)).toBe(true);
    expect(ringUnlocked(3, 3)).toBe(false);
  });
});
