/**
 * The four sectors: look, enemies (Robert's names), waves, boss.
 * Waves: 4 regular waves + 1 boss wave. `delay` = seconds after the wave starts.
 */
export type Role = 'swarmer' | 'gunship' | 'raider' | 'tank' | 'blinker' | 'splitter';
export type Shape = 'drone' | 'dart' | 'raider' | 'cruiser' | 'wraith' | 'stalker' | 'hunter' | 'scout' | 'beetle' | 'dread';
export type BossId = 'override' | 'marauder' | 'sovereign' | 'xenarch';
export type PlanetKind = 'ocean' | 'moon' | 'gas' | 'lava';

export interface SectorLook {
  bg: number;
  stars: number[];
  nebula: number[];
  planet: { kind: PlanetKind; a: number; b: number; c: number; atmosphere: number; rings: boolean };
  sun: number;
  sunIntensity: number;
  rim: number;
  hemiSky: number;
  hemiGround: number;
  rock: number;
  rockDark: number;
  vein: number;
  accent: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  role: Role;
  shape: Shape;
  hp: number;
  speed: number;
  radius: number;
  /** bolt damage */
  dmg: number;
  /** volleys per second */
  fireRate: number;
  /** bolts per volley */
  burst: number;
  /** fan angle for tanks' spread shots */
  spread: number;
  color: number;
  glow: number;
  crystals: number;
  hidden?: boolean;
}

export interface WaveGroup {
  enemy: string;
  count: number;
  delay: number;
}

export interface WaveDef {
  groups: WaveGroup[];
  /** how many directions the groups arrive from */
  dirs: number;
  boss?: boolean;
}

export interface BossDef {
  id: BossId;
  name: string;
  title: string;
  hp: number;
  radius: number;
  color: number;
  glow: number;
  dmg: number;
  crystals: number;
}

export interface SectorDef {
  name: string;
  tagline: string;
  look: SectorLook;
  enemies: EnemyDef[];
  waves: WaveDef[];
  boss: BossDef;
  asteroids: number;
  rockHp: number;
  richChance: number;
  explosiveChance: number;
}

const e = (d: Partial<EnemyDef> & Pick<EnemyDef, 'id' | 'name' | 'role' | 'shape' | 'hp' | 'speed' | 'color' | 'glow' | 'crystals'>): EnemyDef => ({
  radius: 1.1,
  dmg: 5,
  fireRate: 0.5,
  burst: 1,
  spread: 0,
  ...d,
});

export const SECTORS: SectorDef[] = [
  {
    name: 'Training Zone',
    tagline: 'Learn to fly, mine and build',
    look: {
      bg: 0x021018,
      stars: [0xb8f0ff, 0x8fe3e0, 0xffffff],
      nebula: [0x0d6e7a, 0x163f8f, 0x0a8f86],
      planet: { kind: 'ocean', a: 0x1c6fa6, b: 0x3fae7a, c: 0xe8f6ff, atmosphere: 0x6fe8ff, rings: false },
      sun: 0xfff1d6,
      sunIntensity: 2.6,
      rim: 0x58e0ff,
      hemiSky: 0x9fd8ff,
      hemiGround: 0x0a2830,
      rock: 0x9cc6cc,
      rockDark: 0x56767e,
      vein: 0x6ffcff,
      accent: 0x4dfcff,
    },
    enemies: [
      e({ id: 'training_drone', name: 'Training Drone', role: 'swarmer', shape: 'drone', hp: 30, speed: 8.5, radius: 1.0, dmg: 5, fireRate: 0.45, color: 0xff5a5a, glow: 0xff3030, crystals: 3 }),
      e({ id: 'advanced_drone', name: 'Advanced Drone', role: 'gunship', shape: 'stalker', hp: 70, speed: 8, radius: 1.2, dmg: 6, fireRate: 0.5, burst: 3, color: 0xff8f6a, glow: 0xff5a20, crystals: 5 }),
    ],
    waves: [
      { dirs: 1, groups: [{ enemy: 'training_drone', count: 4, delay: 0 }] },
      { dirs: 1, groups: [{ enemy: 'training_drone', count: 4, delay: 0 }, { enemy: 'training_drone', count: 3, delay: 7 }] },
      { dirs: 2, groups: [{ enemy: 'training_drone', count: 5, delay: 0 }, { enemy: 'advanced_drone', count: 2, delay: 4 }] },
      { dirs: 2, groups: [{ enemy: 'advanced_drone', count: 3, delay: 0 }, { enemy: 'training_drone', count: 6, delay: 3 }, { enemy: 'advanced_drone', count: 2, delay: 11 }] },
      { dirs: 1, boss: true, groups: [{ enemy: 'training_drone', count: 4, delay: 10 }, { enemy: 'training_drone', count: 4, delay: 25 }] },
    ],
    boss: { id: 'override', name: 'Protocol Override', title: 'The rogue training computer', hp: 6000, radius: 3.6, color: 0xff4040, glow: 0xff2020, dmg: 6, crystals: 70 },
    asteroids: 30,
    rockHp: 1,
    richChance: 0.16,
    explosiveChance: 0.08,
  },
  {
    name: 'Asteroid Belt',
    tagline: 'Pirates want your crystals',
    look: {
      bg: 0x06060a,
      stars: [0xffffff, 0xd8d8e0, 0xfff0d0],
      nebula: [0x3a2814, 0x1d2c48, 0x2a1a10],
      planet: { kind: 'moon', a: 0x8f8a80, b: 0x58544c, c: 0xc8c0b0, atmosphere: 0xd8c8a8, rings: false },
      sun: 0xffe2b0,
      sunIntensity: 2.8,
      rim: 0xffb36b,
      hemiSky: 0xd8d0c0,
      hemiGround: 0x1a1612,
      rock: 0x8e8070,
      rockDark: 0x4a4038,
      vein: 0xffb347,
      accent: 0xffb347,
    },
    enemies: [
      e({ id: 'pirate_scout', name: 'Pirate Scout', role: 'swarmer', shape: 'dart', hp: 300, speed: 11.5, radius: 1.0, dmg: 9, fireRate: 0.5, color: 0xff4a4a, glow: 0xff2a2a, crystals: 3 }),
      e({ id: 'mining_raider', name: 'Mining Raider', role: 'raider', shape: 'raider', hp: 600, speed: 7.5, radius: 1.4, dmg: 10, fireRate: 0.7, color: 0xffaa33, glow: 0xff7a00, crystals: 6 }),
      e({ id: 'scavenger_cruiser', name: 'Scavenger Cruiser', role: 'tank', shape: 'cruiser', hp: 2400, speed: 4.2, radius: 2.4, dmg: 10, fireRate: 0.4, burst: 5, spread: 0.7, color: 0x9aa3b0, glow: 0xff5a3a, crystals: 16 }),
    ],
    waves: [
      { dirs: 1, groups: [{ enemy: 'pirate_scout', count: 7, delay: 0 }, { enemy: 'mining_raider', count: 3, delay: 5 }] },
      { dirs: 2, groups: [{ enemy: 'pirate_scout', count: 8, delay: 0 }, { enemy: 'mining_raider', count: 4, delay: 4 }] },
      { dirs: 2, groups: [{ enemy: 'scavenger_cruiser', count: 1, delay: 0 }, { enemy: 'pirate_scout', count: 8, delay: 3 }, { enemy: 'mining_raider', count: 4, delay: 9 }] },
      { dirs: 3, groups: [{ enemy: 'pirate_scout', count: 11, delay: 0 }, { enemy: 'scavenger_cruiser', count: 3, delay: 5 }, { enemy: 'mining_raider', count: 6, delay: 11 }] },
      { dirs: 2, boss: true, groups: [{ enemy: 'pirate_scout', count: 8, delay: 10 }, { enemy: 'mining_raider', count: 4, delay: 22 }] },
    ],
    boss: { id: 'marauder', name: 'Crimson Marauder', title: 'Pirate king of the belt', hp: 36000, radius: 4.2, color: 0xc0182a, glow: 0xff3a2a, dmg: 12, crystals: 90 },
    asteroids: 34,
    rockHp: 1.8,
    richChance: 0.18,
    explosiveChance: 0.1,
  },
  {
    name: 'Nebula Field',
    tagline: 'Ghost ships hide in the clouds',
    look: {
      bg: 0x0c0520,
      stars: [0xd2b0ff, 0xa8bcff, 0xffb8f2],
      nebula: [0x7a2fb8, 0xd0409a, 0x3a48c8],
      planet: { kind: 'gas', a: 0x8a5ad8, b: 0xe0a0e8, c: 0x4a2a8a, atmosphere: 0xd890ff, rings: true },
      sun: 0xffd6f4,
      sunIntensity: 2.6,
      rim: 0xff6fd8,
      hemiSky: 0xc8a8ff,
      hemiGround: 0x180a30,
      rock: 0x7462b0,
      rockDark: 0x30264f,
      vein: 0xff66ff,
      accent: 0xff7af0,
    },
    enemies: [
      e({ id: 'nebula_wraith', name: 'Nebula Wraith', role: 'blinker', shape: 'wraith', hp: 700, speed: 10.5, radius: 1.1, dmg: 15, fireRate: 0.5, color: 0xff4aff, glow: 0xff00ff, crystals: 4 }),
      e({ id: 'energy_stalker', name: 'Energy Stalker', role: 'gunship', shape: 'stalker', hp: 1300, speed: 8.5, radius: 1.5, dmg: 15, fireRate: 0.5, burst: 3, color: 0xb59bff, glow: 0x8a5cff, crystals: 7 }),
      e({ id: 'void_hunter', name: 'Void Hunter', role: 'tank', shape: 'hunter', hp: 5000, speed: 4.6, radius: 2.6, dmg: 17, fireRate: 0.45, burst: 6, spread: 0.8, color: 0x5a2ccc, glow: 0xc040ff, crystals: 18 }),
    ],
    waves: [
      { dirs: 1, groups: [{ enemy: 'nebula_wraith', count: 8, delay: 0 }, { enemy: 'energy_stalker', count: 3, delay: 4 }] },
      { dirs: 2, groups: [{ enemy: 'nebula_wraith', count: 8, delay: 0 }, { enemy: 'energy_stalker', count: 6, delay: 5 }] },
      { dirs: 2, groups: [{ enemy: 'void_hunter', count: 1, delay: 0 }, { enemy: 'nebula_wraith', count: 11, delay: 3 }, { enemy: 'energy_stalker', count: 4, delay: 9 }] },
      { dirs: 3, groups: [{ enemy: 'energy_stalker', count: 7, delay: 0 }, { enemy: 'void_hunter', count: 3, delay: 4 }, { enemy: 'nebula_wraith', count: 14, delay: 10 }] },
      { dirs: 2, boss: true, groups: [{ enemy: 'nebula_wraith', count: 8, delay: 10 }, { enemy: 'energy_stalker', count: 4, delay: 22 }] },
    ],
    boss: { id: 'sovereign', name: 'Nebula Sovereign', title: 'Queen of the purple clouds', hp: 90000, radius: 4.4, color: 0x7a2cff, glow: 0xff4aff, dmg: 14, crystals: 100 },
    asteroids: 34,
    rockHp: 3,
    richChance: 0.2,
    explosiveChance: 0.12,
  },
  {
    name: 'Alien Territory',
    tagline: 'The final battle',
    look: {
      bg: 0x150503,
      stars: [0xffc27a, 0xff9a5a, 0xffe2a8],
      nebula: [0xa8300f, 0xff6a1a, 0x5a1030],
      planet: { kind: 'lava', a: 0x2a1410, b: 0xff5a10, c: 0x5a2a1a, atmosphere: 0xff6a2a, rings: false },
      sun: 0xffb070,
      sunIntensity: 3,
      rim: 0xff4a1a,
      hemiSky: 0xffa070,
      hemiGround: 0x200806,
      rock: 0x6a463a,
      rockDark: 0x2a1612,
      vein: 0xff6a1a,
      accent: 0xff7a2a,
    },
    enemies: [
      e({ id: 'alien_scout', name: 'Alien Scout', role: 'swarmer', shape: 'scout', hp: 1500, speed: 13, radius: 1.1, dmg: 19, fireRate: 0.55, color: 0xff5a00, glow: 0xff3a00, crystals: 4 }),
      e({ id: 'xenomorph_warrior', name: 'Xenomorph Warrior', role: 'splitter', shape: 'beetle', hp: 4000, speed: 7.5, radius: 1.8, dmg: 20, fireRate: 0.5, burst: 3, color: 0xffb000, glow: 0x9aff2a, crystals: 8 }),
      e({ id: 'xeno_spawn', name: 'Xeno Spawn', role: 'swarmer', shape: 'beetle', hp: 800, speed: 12, radius: 0.9, dmg: 14, fireRate: 0.4, color: 0xffd040, glow: 0x9aff2a, crystals: 2, hidden: true }),
      e({ id: 'alien_dreadnought', name: 'Alien Dreadnought', role: 'tank', shape: 'dread', hp: 15000, speed: 3.6, radius: 3.0, dmg: 21, fireRate: 0.5, burst: 7, spread: 0.9, color: 0xff6a10, glow: 0xff2a00, crystals: 22 }),
    ],
    waves: [
      { dirs: 2, groups: [{ enemy: 'alien_scout', count: 11, delay: 0 }, { enemy: 'xenomorph_warrior', count: 3, delay: 5 }] },
      { dirs: 2, groups: [{ enemy: 'alien_scout', count: 11, delay: 0 }, { enemy: 'xenomorph_warrior', count: 6, delay: 5 }] },
      { dirs: 3, groups: [{ enemy: 'alien_dreadnought', count: 1, delay: 0 }, { enemy: 'alien_scout', count: 14, delay: 3 }, { enemy: 'xenomorph_warrior', count: 4, delay: 9 }] },
      { dirs: 3, groups: [{ enemy: 'alien_dreadnought', count: 3, delay: 0 }, { enemy: 'xenomorph_warrior', count: 7, delay: 4 }, { enemy: 'alien_scout', count: 17, delay: 10 }] },
      { dirs: 2, boss: true, groups: [{ enemy: 'alien_scout', count: 11, delay: 12 }, { enemy: 'xenomorph_warrior', count: 4, delay: 26 }] },
    ],
    boss: { id: 'xenarch', name: 'Xenarch Prime', title: 'Mothership of the alien fleet', hp: 220000, radius: 6.5, color: 0xff3a10, glow: 0xffd000, dmg: 17, crystals: 140 },
    asteroids: 36,
    rockHp: 4.5,
    richChance: 0.22,
    explosiveChance: 0.14,
  },
];

export const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(
  SECTORS.flatMap((s) => s.enemies).map((d) => [d.id, d]),
);

export const LAST_SECTOR = SECTORS.length - 1;
