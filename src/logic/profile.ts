import { MEDAL_IDS } from '../config/medals';
import { PAINT_BY_ID } from '../config/paints';

/** Things that belong to the player, not to one run: name, paint, medals, records. */
export interface Profile {
  v: 1;
  name: string;
  paint: string;
  medals: string[];
  bestEndless: number;
  rocks: number;
  /** 1 = solo, 2 = co-op on one computer */
  players: 1 | 2;
}

export const PROFILE_KEY = 'space-builder-3d.profile';
export const NAME_MAX = 16;

export const defaultProfile = (): Profile => ({ v: 1, name: '', paint: 'arctic', medals: [], bestEndless: 0, rocks: 0, players: 1 });

/** Trim, drop control characters and cap the length. */
export function cleanName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
}

/** How ARIA addresses the player. */
export function commanderTitle(p: Profile): string {
  return p.name ? `Commander ${p.name}` : 'Commander';
}

const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

export function decodeProfile(s: string | null | undefined): Profile {
  const p = defaultProfile();
  if (!s) return p;
  let raw: unknown;
  try {
    raw = JSON.parse(s);
  } catch {
    return p;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return p;
  const o = raw as Record<string, unknown>;
  p.name = cleanName(o.name);
  p.paint = typeof o.paint === 'string' && PAINT_BY_ID[o.paint] ? o.paint : 'arctic';
  p.medals = Array.isArray(o.medals) ? [...new Set(o.medals.filter((m): m is string => typeof m === 'string' && MEDAL_IDS.includes(m)))] : [];
  p.bestEndless = count(o.bestEndless);
  p.rocks = count(o.rocks);
  p.players = o.players === 2 ? 2 : 1;
  return p;
}

export function encodeProfile(p: Profile): string {
  return JSON.stringify(p);
}

/** Adds a medal; true only the first time. */
export function awardMedal(p: Profile, id: string): boolean {
  if (!MEDAL_IDS.includes(id) || p.medals.includes(id)) return false;
  p.medals.push(id);
  return true;
}
