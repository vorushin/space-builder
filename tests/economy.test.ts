import { describe, expect, it } from 'vitest';
import { GUNS } from '../src/config/guns';
import { MODULES } from '../src/config/modules';
import { difficultyMods, expansionCost, gunUpgradeCost, moduleCost, sellValue } from '../src/logic/economy';

describe('economy', () => {
  it('gun upgrades cost more each tier and stop at tier 10', () => {
    expect(gunUpgradeCost(10)).toBeNull();
    expect(gunUpgradeCost(0)).toBeNull();
    let prev = 0;
    for (let t = 1; t < 10; t++) {
      const c = gunUpgradeCost(t)!;
      expect(c).toBeGreaterThan(prev);
      prev = c;
    }
    expect(gunUpgradeCost(1)).toBe(GUNS[1].cost);
  });

  it('module tiers cost more as they go up; tier 4 does not exist', () => {
    for (const m of MODULES) {
      expect(moduleCost(m.kind, 1)! < moduleCost(m.kind, 2)!).toBe(true);
      expect(moduleCost(m.kind, 2)! < moduleCost(m.kind, 3)!).toBe(true);
      expect(moduleCost(m.kind, 4)).toBeNull();
    }
  });

  it('selling gives back half of everything spent', () => {
    expect(sellValue('turret', 1)).toBe(Math.floor(moduleCost('turret', 1)! / 2));
    expect(sellValue('turret', 2)).toBe(Math.floor((moduleCost('turret', 1)! + moduleCost('turret', 2)!) / 2));
  });

  it('expansions: rings 1 and 2 cost something, ring 0 and 3 do not exist', () => {
    expect(expansionCost(0)).toBeNull();
    expect(expansionCost(1)).toBeGreaterThan(0);
    expect(expansionCost(2)).toBeGreaterThan(expansionCost(1)!);
    expect(expansionCost(3)).toBeNull();
  });

  it('easy mode makes enemies weaker and crystals richer', () => {
    const e = difficultyMods('easy');
    expect(e.enemyHp).toBeLessThan(1);
    expect(e.enemyDmg).toBeLessThan(1);
    expect(e.crystals).toBeGreaterThan(1);
    expect(difficultyMods('normal')).toEqual({ enemyHp: 1, enemyDmg: 1, crystals: 1, count: 1 });
  });
});
