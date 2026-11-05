import { describe, expect, it } from 'vitest';
import { SpatialGrid } from '../src/logic/grid';
import { Rng, turnToward, wrapAngle } from '../src/logic/math';
import { leadAim, nearest } from '../src/logic/targeting';

describe('math', () => {
  it('wraps and turns angles the short way', () => {
    expect(Math.abs(wrapAngle(3 * Math.PI))).toBeCloseTo(Math.PI, 9);
    expect(wrapAngle(-3 * Math.PI / 2)).toBeCloseTo(Math.PI / 2, 9);
    expect(turnToward(3, -3, 0.1)).toBeCloseTo(3.1, 9); // crosses ±π instead of going the long way
    expect(turnToward(0, 0.05, 0.1)).toBeCloseTo(0.05, 9);
  });

  it('rng is deterministic and in range', () => {
    const a = new Rng(42), b = new Rng(42);
    for (let i = 0; i < 100; i++) {
      const x = a.int(3, 7);
      expect(x).toBe(b.int(3, 7));
      expect(x).toBeGreaterThanOrEqual(3);
      expect(x).toBeLessThanOrEqual(7);
    }
  });
});

describe('spatial grid', () => {
  it('finds nearby circles once and skips far ones', () => {
    const g = new SpatialGrid<{ x: number; z: number; r: number; id: number }>(8);
    const big = { x: 0, z: 0, r: 20, id: 1 };
    const near = { x: 3, z: 1, r: 1, id: 2 };
    const far = { x: 60, z: 60, r: 1, id: 3 };
    [big, near, far].forEach((c) => g.insert(c));
    const out = g.query(2, 2, 2, []);
    expect(out.map((c) => c.id).sort()).toEqual([1, 2]);
    expect(g.query(60, 60, 1, []).map((c) => c.id)).toEqual([3]);
    g.clear();
    expect(g.query(2, 2, 2, [])).toEqual([]);
  });
});

describe('targeting', () => {
  it('nearest respects range and filter', () => {
    const items = [{ x: 5, z: 0, ok: false }, { x: 8, z: 0, ok: true }, { x: 30, z: 0, ok: true }];
    expect(nearest(items, 0, 0, 10)).toBe(items[0]);
    expect(nearest(items, 0, 0, 10, (i) => i.ok)).toBe(items[1]);
    expect(nearest(items, 0, 0, 4)).toBeNull();
  });

  it('leadAim meets a constant-velocity target', () => {
    const from = { x: 0, z: 0 };
    const target = { x: 20, z: 0, vx: 0, vz: 6 };
    const speed = 30;
    const p = leadAim(from, target, speed);
    const t = Math.hypot(p.x, p.z) / speed;
    expect(p.x).toBeCloseTo(target.x + target.vx * t, 6);
    expect(p.z).toBeCloseTo(target.z + target.vz * t, 6);
    // impossible intercept falls back to the current position
    expect(leadAim(from, { x: 10, z: 0, vx: 100, vz: 0 }, 5)).toEqual({ x: 10, z: 0 });
  });
});
