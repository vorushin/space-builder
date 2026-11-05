import { SECTORS, type BossId, type SectorDef } from '../config/sectors';
import { difficultyMods, type Difficulty } from './economy';
import { Rng, TAU } from './math';

export interface SpawnOrder {
  /** seconds after the wave starts */
  at: number;
  /** enemy id, or boss id when `boss` is set */
  enemy: string;
  count: number;
  /** arrival direction (heading from the station) */
  dir: number;
  boss?: boolean;
  /** extra HP multiplier (endless mode) */
  hpScale?: number;
}

/** `n` arrival directions spread around the circle, never closer than ~90°. */
export function pickDirections(n: number, rng: Rng): number[] {
  const base = rng.range(0, TAU);
  const out: number[] = [];
  for (let k = 0; k < n; k++) out.push(base + (k * TAU) / n + (n > 1 ? rng.range(-0.25, 0.25) : 0));
  return out;
}

export function buildWave(sector: SectorDef, wave: number, rng: Rng, d: Difficulty): SpawnOrder[] {
  const def = sector.waves[wave];
  if (!def) return [];
  const mods = difficultyMods(d);
  const dirs = pickDirections(def.dirs, rng);
  const orders: SpawnOrder[] = def.groups.map((g, i) => ({
    at: g.delay,
    enemy: g.enemy,
    count: Math.max(1, Math.round(g.count * mods.count)),
    dir: dirs[i % dirs.length],
  }));
  if (def.boss) orders.push({ at: 2, enemy: sector.boss.id, count: 1, dir: dirs[0], boss: true });
  return orders.sort((a, b) => a.at - b.at);
}

const ENDLESS_POOL = SECTORS.slice(1).flatMap((s) => s.enemies.filter((e) => !e.hidden).map((e) => e.id));
const BOSS_IDS: BossId[] = SECTORS.map((s) => s.boss.id);

/** Endless mode wave `level` (1, 2, 3...): mixed enemies that get tougher; a boss every 5th wave. */
export function buildEndlessWave(level: number, rng: Rng, d: Difficulty): SpawnOrder[] {
  const mods = difficultyMods(d);
  const dirs = pickDirections(level % 3 === 0 ? 3 : 2, rng);
  const hpScale = 1 + 0.12 * level;
  const groups = 3 + Math.min(4, Math.floor(level / 3));
  const orders: SpawnOrder[] = [];
  for (let i = 0; i < groups; i++) {
    orders.push({
      at: i * 5,
      enemy: rng.pick(ENDLESS_POOL),
      count: Math.max(1, Math.round((3 + rng.int(0, 2) + Math.floor(level / 4)) * mods.count)),
      dir: dirs[i % dirs.length],
      hpScale,
    });
  }
  if (level % 5 === 0) orders.push({ at: 2, enemy: rng.pick(BOSS_IDS), count: 1, dir: dirs[0], boss: true, hpScale: 1 + 0.08 * level });
  return orders.sort((a, b) => a.at - b.at);
}
