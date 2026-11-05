/**
 * Game Constants
 * All constant values used throughout the game
 */

// Asteroid constants
export const NUM_ASTEROIDS = 20;
export const ASTEROID_SPAWN_MARGIN = 100;

// Ship constants
export const SHIP_PULL_RADIUS = 80;
export const SHIP_MAX_HEALTH = 100;

// Resource constants
export const RESOURCE_MAX_LIFETIME = 3600; // 60 seconds at 60fps
export const RESOURCE_FADE_START_TIME = 1800; // 30 seconds at 60fps

// Level transition constants
export const COLLECTION_PHASE_DURATION = 600; // 10 seconds at 60fps
export const TRANSITION_DURATION = 60; // 1 second at 60fps
export const TELEPORT_RINGS_COUNT = 5;

// Missile constants
export const MISSILE_START_AMMO = 5;
export const MISSILE_MAX_AMMO = 20;
export const MISSILE_REGEN_TIME = 5000; // 5 seconds in ms
export const MISSILE_FIRE_COOLDOWN = 500; // ms
export const MISSILE_PROXIMITY_RADIUS = 30;
export const MISSILE_RESOURCE_BONUS = 2.0;

// Physics constants
export const VELOCITY_DAMPING_THRUSTING = 0.99;
export const VELOCITY_DAMPING_COASTING = 0.96;
export const EXPLOSION_VELOCITY_DAMPING = 0.95;

// Enemy spawn constants
export const ENEMY_SPAWN_MARGIN = 50;
export const ENEMY_DESPAWN_MARGIN = 200;

// Upgrade cost formulas (base costs)
export const SHIP_GUN_BASE_COST = 150;
export const SHIP_GUN_COST_MULTIPLIER = 1.4;
export const STATION_BASE_COST = 100;
export const STATION_COST_MULTIPLIER = 1.5;
export const STATION_GUN_BASE_COST = 200;
export const STATION_GUN_COST_MULTIPLIER = 1.5;

// Names for upgrades
export const SHIP_GUN_NAMES = [
    'Basic Gun',           // Level 1
    'Rapid Fire',          // Level 2
    'Heavy Cannons',       // Level 3
    'Triple Shot',         // Level 4
    'Plasma Weapons',      // Level 5
    'Laser Barrage',       // Level 6
    'Ion Pulse',           // Level 7
    'Quantum Cannons',     // Level 8
    'Antimatter Guns',     // Level 9
    'Singularity Weapon'   // Level 10
];

export const STATION_NAMES = [
    'Core Module',         // Level 1
    'Solar Array',         // Level 2
    'Docking Bay',         // Level 3
    'Defense Grid',        // Level 4
    'Mining Hub',          // Level 5
    'Research Lab',        // Level 6
    'Command Center',      // Level 7
    'Shield Generator',    // Level 8
    'Production Facility', // Level 9
    'Mega Station'         // Level 10
];

export const STATION_GUN_NAMES = [
    'Defense Turret',      // Level 1
    'Twin Cannons',        // Level 2
    'Missile Battery',     // Level 3
    'Flak Array',          // Level 4
    'Beam Weapons',        // Level 5
    'Point Defense',       // Level 6
    'Railguns',            // Level 7
    'Particle Beams',      // Level 8
    'Nova Cannons',        // Level 9
    'Titan Weapon Array'   // Level 10
];
