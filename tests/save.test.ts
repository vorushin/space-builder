import { describe, expect, it } from 'vitest';
import { decodeCheckpoint, encodeCheckpoint, type Checkpoint } from '../src/logic/save';

const good: Checkpoint = {
  v: 1, sector: 2, crystals: 345, gunTier: 6, rings: 2,
  modules: [{ socket: 0, kind: 'turret', tier: 2 }, { socket: 5, kind: 'shield', tier: 1 }],
  sparky: true, difficulty: 'easy', endless: false, endlessLevel: 0,
};

describe('checkpoint save', () => {
  it('round-trips', () => {
    expect(decodeCheckpoint(encodeCheckpoint(good))).toEqual(good);
  });

  it('ignores garbage and foreign saves', () => {
    for (const s of [null, undefined, '', '{', '[]', 'null', '42', '"x"', '{"v":2,"sector":1}', '{"resources":500,"stationLevel":3}'])
      expect(decodeCheckpoint(s as string)).toBeNull();
  });

  it('clamps numbers into range', () => {
    const c = decodeCheckpoint(JSON.stringify({ ...good, crystals: -50, gunTier: 99, sector: 17, rings: 0 }))!;
    expect(c.crystals).toBe(0);
    expect(c.gunTier).toBe(10);
    expect(c.sector).toBe(3);
    expect(c.rings).toBe(1);
  });

  it('drops modules on missing or duplicate sockets and unknown kinds', () => {
    const c = decodeCheckpoint(JSON.stringify({
      ...good,
      rings: 1,
      modules: [
        { socket: 0, kind: 'turret', tier: 9 },
        { socket: 0, kind: 'mining', tier: 1 },
        { socket: 7, kind: 'turret', tier: 1 },
        { socket: 1, kind: 'laser-shark', tier: 1 },
        { socket: 2, kind: 'mining' },
        'junk',
      ],
    }))!;
    expect(c.modules).toEqual([
      { socket: 0, kind: 'turret', tier: 3 },
      { socket: 2, kind: 'mining', tier: 1 },
    ]);
  });
});
