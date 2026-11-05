/** Ship gun tiers: Robert's names, one button to upgrade. `cost` = price to reach this tier. */
export interface GunTier {
  name: string;
  cost: number;
  /** shots per second */
  rate: number;
  dmg: number;
  bolts: number;
  /** total fan angle in radians (0 = all bolts parallel) */
  spread: number;
  /** sideways gap between parallel bolts */
  gap: number;
  speed: number;
  color: number;
  /** visual thickness multiplier */
  size: number;
  /** extra targets a bolt passes through */
  pierce: number;
  /** splash radius on hit (0 = none) */
  splash: number;
  /** fire a mini black hole every N volleys */
  singularityEvery?: number;
}

export const GUNS: GunTier[] = [
  { name: 'Basic Gun', cost: 0, rate: 5, dmg: 10, bolts: 1, spread: 0, gap: 0, speed: 62, color: 0x59f3ff, size: 1, pierce: 0, splash: 0 },
  { name: 'Rapid Fire', cost: 80, rate: 8.5, dmg: 10, bolts: 1, spread: 0, gap: 0, speed: 66, color: 0x59f3ff, size: 1, pierce: 0, splash: 0 },
  { name: 'Heavy Cannons', cost: 180, rate: 6.5, dmg: 16, bolts: 2, spread: 0, gap: 0.9, speed: 62, color: 0x7dffb0, size: 1.35, pierce: 0, splash: 0 },
  { name: 'Triple Shot', cost: 340, rate: 7.5, dmg: 16, bolts: 3, spread: 0.22, gap: 0, speed: 64, color: 0x7dffb0, size: 1.3, pierce: 0, splash: 0 },
  { name: 'Plasma Weapons', cost: 560, rate: 7.5, dmg: 21, bolts: 3, spread: 0.22, gap: 0, speed: 60, color: 0xff5cf0, size: 1.6, pierce: 1, splash: 0 },
  { name: 'Laser Barrage', cost: 850, rate: 10, dmg: 19, bolts: 5, spread: 0.36, gap: 0, speed: 80, color: 0xff6a3d, size: 1.1, pierce: 1, splash: 0 },
  { name: 'Ion Pulse', cost: 1250, rate: 10, dmg: 24, bolts: 5, spread: 0.36, gap: 0, speed: 72, color: 0x5d8bff, size: 1.5, pierce: 1, splash: 2.4 },
  { name: 'Quantum Cannons', cost: 1750, rate: 11, dmg: 29, bolts: 5, spread: 0.36, gap: 0, speed: 76, color: 0x6dff6a, size: 1.6, pierce: 2, splash: 2.6 },
  { name: 'Antimatter Guns', cost: 2400, rate: 11, dmg: 34, bolts: 7, spread: 0.5, gap: 0, speed: 78, color: 0xfff1a0, size: 1.7, pierce: 2, splash: 3.2 },
  { name: 'Singularity Weapon', cost: 3200, rate: 12, dmg: 40, bolts: 7, spread: 0.5, gap: 0, speed: 80, color: 0xc77dff, size: 1.9, pierce: 3, splash: 3.4, singularityEvery: 6 },
];

export const MAX_GUN_TIER = GUNS.length; // tiers are 1-based in game state
