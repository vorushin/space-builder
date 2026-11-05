import { GUNS, MAX_GUN_TIER } from '../config/guns';
import { EXPANSIONS, MODULE_BY_KIND, type ModuleKind } from '../config/modules';

export type Difficulty = 'normal' | 'easy';

/** Price to go from `tier` to `tier + 1` (tiers are 1-based); null when maxed. */
export function gunUpgradeCost(tier: number): number | null {
  if (tier >= MAX_GUN_TIER || tier < 1) return null;
  return GUNS[tier].cost;
}

/** Price of module tier `tier` (1 = build, 2..3 = upgrades); null if no such tier. */
export function moduleCost(kind: ModuleKind, tier: number): number | null {
  const t = MODULE_BY_KIND[kind].tiers[tier - 1];
  return t ? t.cost : null;
}

/** Half of everything spent on a module that is at `tier`. */
export function sellValue(kind: ModuleKind, tier: number): number {
  let spent = 0;
  for (let t = 1; t <= tier; t++) spent += moduleCost(kind, t) ?? 0;
  return Math.floor(spent / 2);
}

/** Price to unlock ring `ring` (1 or 2); null for ring 0 or beyond the last. */
export function expansionCost(ring: number): number | null {
  if (ring < 1 || ring >= EXPANSIONS.length) return null;
  return EXPANSIONS[ring].cost;
}

export function difficultyMods(d: Difficulty): { enemyHp: number; enemyDmg: number; crystals: number; count: number } {
  return d === 'easy'
    ? { enemyHp: 0.7, enemyDmg: 0.6, crystals: 1.3, count: 0.75 }
    : { enemyHp: 1, enemyDmg: 1, crystals: 1, count: 1 };
}
