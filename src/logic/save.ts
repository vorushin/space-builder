import { MAX_GUN_TIER } from '../config/guns';
import { MODULE_KINDS, type ModuleKind } from '../config/modules';
import { SECTORS } from '../config/sectors';
import type { Difficulty } from './economy';
import { socketsFor } from './layout';
import { clamp } from './math';

export interface SavedModule {
  socket: number;
  kind: ModuleKind;
  tier: number;
}

/** Saved at the start of every sector; "Continue" and "Retry sector" load it. */
export interface Checkpoint {
  v: 1;
  sector: number;
  crystals: number;
  gunTier: number;
  rings: number;
  modules: SavedModule[];
  sparky: boolean;
  difficulty: Difficulty;
  endless: boolean;
  endlessLevel: number;
}

export const SAVE_KEY = 'space-builder-3d.checkpoint';

export function encodeCheckpoint(c: Checkpoint): string {
  return JSON.stringify(c);
}

const int = (v: unknown, lo: number, hi: number, dflt: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? clamp(Math.floor(v), lo, hi) : dflt;

/** Parse and sanitise a checkpoint. Anything unrecognisable gives null. */
export function decodeCheckpoint(s: string | null | undefined): Checkpoint | null {
  if (!s) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(s);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1 || typeof o.sector !== 'number') return null;

  const rings = int(o.rings, 1, 3, 1);
  const valid = new Set(socketsFor(rings).map((sk) => sk.id));
  const used = new Set<number>();
  const modules: SavedModule[] = [];
  if (Array.isArray(o.modules)) {
    for (const m of o.modules) {
      if (!m || typeof m !== 'object') continue;
      const mm = m as Record<string, unknown>;
      const socket = typeof mm.socket === 'number' ? mm.socket : -1;
      const kind = mm.kind as ModuleKind;
      if (!valid.has(socket) || used.has(socket) || !MODULE_KINDS.includes(kind)) continue;
      used.add(socket);
      modules.push({ socket, kind, tier: int(mm.tier, 1, 3, 1) });
    }
  }

  return {
    v: 1,
    sector: int(o.sector, 0, SECTORS.length - 1, 0),
    crystals: int(o.crystals, 0, 1e9, 0),
    gunTier: int(o.gunTier, 1, MAX_GUN_TIER, 1),
    rings,
    modules,
    sparky: o.sparky === true,
    difficulty: o.difficulty === 'easy' ? 'easy' : 'normal',
    endless: o.endless === true,
    endlessLevel: int(o.endlessLevel, 0, 1e6, 0),
  };
}
