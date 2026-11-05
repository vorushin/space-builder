/** Global tuning numbers. Units: world units (ship ≈ 2 long), seconds. */
export const BAL = {
  arenaRadius: 72,
  spawnRadius: 80,
  beltInner: 16,
  beltOuter: 64,

  ship: {
    radius: 1.0,
    hp: 100,
    maxSpeed: 19,
    accelK: 7, // how fast velocity reaches the stick target (1/s)
    decelK: 3.2,
    turnRate: 16, // rad/s toward the cursor
    regenDelay: 4,
    regenRate: 9,
    dockRegen: 45,
    dashSpeed: 50,
    dashTime: 0.17,
    dashCooldown: 1.1,
    dashIframes: 0.35,
    hitIframes: 0.25,
    respawnTime: 3,
    magnetRadius: 9,
    collectRadius: 1.5,
    boltRange: 36,
  },

  missiles: {
    start: 3,
    perSector: 1,
    recharge: 5,
    speed: 24,
    maxSpeed: 36,
    turnRate: 4.6,
    life: 3.2,
    radius: 6,
    baseDmg: 60,
    dmgPerTier: 28,
  },

  station: {
    coreRadius: 3.2,
    coreHp: 600,
    hpPerModule: 80,
    magnetRadius: [10, 15, 20],
    dockRadius: [8, 13, 18],
    shieldRegenDelay: 3,
  },

  phases: {
    firstCalm: 50,
    calm: 38,
    endlessCalm: 22,
    warning: 5,
    bossWarning: 6,
    cleared: 4,
  },

  crystals: {
    max: 400,
    earlyCallBonus: 12, // × sector value multiplier
    waveBonus: 20, // × (wave+1) × sector value multiplier
  },

  camera: {
    pitch: 0.98, // radians down from horizontal (~56°)
    fov: 45,
    dist: 38,
    buildDist: 56,
    bossDist: 46,
    lookAhead: 0.22,
  },

  enemyBoltSpeed: 22,
  powerupChance: 0.03,
  powerupChanceTank: 0.18,
} as const;

/** Sector index → crystal value multiplier (prices are tuned against this). */
export const SECTOR_VALUE = [1, 2, 3, 4];
