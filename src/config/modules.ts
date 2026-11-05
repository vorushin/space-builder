/** Station modules. Each has 3 tiers; tier 1 is what you get when you build it. */
export type ModuleKind = 'turret' | 'mining' | 'shield' | 'missile' | 'tesla' | 'dock';

export interface ModuleTier {
  name: string;
  /** price of this tier (tier 1 = build price) */
  cost: number;
  range?: number;
  rate?: number;
  dmg?: number;
  bolts?: number;
  pierce?: number;
  boltSpeed?: number;
  splash?: number;
  chains?: number;
  /** shield capacity / regen per second */
  capacity?: number;
  regen?: number;
  /** drones / wingmen count */
  count?: number;
}

export interface ModuleDef {
  kind: ModuleKind;
  title: string;
  icon: string;
  blurb: string;
  /** sector index (0-based) where this module becomes available */
  unlockSector: number;
  hotkey: number;
  color: number;
  tiers: [ModuleTier, ModuleTier, ModuleTier];
}

export const MODULES: ModuleDef[] = [
  {
    kind: 'turret', title: 'Defense Turret', icon: '🔫', hotkey: 2, unlockSector: 0, color: 0x59f3ff,
    blurb: 'Shoots the nearest enemy. Mines asteroids when it is calm.',
    tiers: [
      { name: 'Defense Turret', cost: 40, range: 26, rate: 2.4, dmg: 12, bolts: 1, boltSpeed: 58 },
      { name: 'Twin Cannons', cost: 160, range: 29, rate: 3.2, dmg: 18, bolts: 2, boltSpeed: 62 },
      { name: 'Railguns', cost: 480, range: 33, rate: 1.7, dmg: 120, bolts: 1, pierce: 4, boltSpeed: 130 },
    ],
  },
  {
    kind: 'mining', title: 'Mining Hub', icon: '⛏️', hotkey: 3, unlockSector: 0, color: 0xffd25a,
    blurb: 'Sends little drones to mine asteroids and bring crystals home.',
    tiers: [
      { name: 'Mining Hub', cost: 55, count: 1, dmg: 26, range: 42 },
      { name: 'Mining Hub II', cost: 180, count: 2, dmg: 34, range: 50 },
      { name: 'Mining Hub III', cost: 420, count: 3, dmg: 46, range: 60 },
    ],
  },
  {
    kind: 'shield', title: 'Shield Generator', icon: '🛡️', hotkey: 4, unlockSector: 1, color: 0x6fb7ff,
    blurb: 'A bubble shield around the station. More generators = stronger bubble.',
    tiers: [
      { name: 'Shield Generator', cost: 160, capacity: 220, regen: 5 },
      { name: 'Defense Grid', cost: 260, capacity: 420, regen: 9 },
      { name: 'Shield Generator Mk III', cost: 520, capacity: 700, regen: 14 },
    ],
  },
  {
    kind: 'missile', title: 'Missile Battery', icon: '🚀', hotkey: 5, unlockSector: 1, color: 0xff8a3d,
    blurb: 'Fires homing missiles at far-away enemies. Big booms!',
    tiers: [
      { name: 'Missile Battery', cost: 200, range: 30, rate: 0.45, dmg: 70, splash: 4.5, bolts: 1 },
      { name: 'Flak Array', cost: 360, range: 33, rate: 0.55, dmg: 95, splash: 5.5, bolts: 2 },
      { name: 'Nova Cannons', cost: 700, range: 36, rate: 0.7, dmg: 160, splash: 7, bolts: 2 },
    ],
  },
  {
    kind: 'tesla', title: 'Tesla Coil', icon: '⚡', hotkey: 6, unlockSector: 2, color: 0x9d7dff,
    blurb: 'Zaps lightning that jumps from enemy to enemy.',
    tiers: [
      { name: 'Tesla Coil', cost: 420, range: 16, rate: 1.4, dmg: 60, chains: 3 },
      { name: 'Storm Coil', cost: 650, range: 18, rate: 1.7, dmg: 85, chains: 5 },
      { name: 'Thunder Tower', cost: 1100, range: 21, rate: 2, dmg: 130, chains: 7 },
    ],
  },
  {
    kind: 'dock', title: 'Docking Bay', icon: '🛸', hotkey: 7, unlockSector: 2, color: 0x7dffb0,
    blurb: 'Launches wingman fighters that fly and shoot next to you.',
    tiers: [
      { name: 'Docking Bay', cost: 480, count: 1, dmg: 26, rate: 4 },
      { name: 'Fighter Hangar', cost: 720, count: 2, dmg: 34, rate: 4.5 },
      { name: 'Carrier Deck', cost: 1200, count: 3, dmg: 46, rate: 5 },
    ],
  },
];

export const MODULE_BY_KIND: Record<ModuleKind, ModuleDef> = Object.fromEntries(
  MODULES.map((m) => [m.kind, m]),
) as Record<ModuleKind, ModuleDef>;

export const MODULE_KINDS = MODULES.map((m) => m.kind);

/** Station expansions: ring index → name, price, sector where it unlocks. Ring 0 is the Core Module. */
export const EXPANSIONS = [
  { ring: 0, name: 'Core Module', cost: 0, unlockSector: 0 },
  { ring: 1, name: 'Command Center', cost: 300, unlockSector: 1 },
  { ring: 2, name: 'Mega Station', cost: 900, unlockSector: 2 },
] as const;
