/**
 * Game State Management
 * Centralized game state and state management functions
 */

import { SHIP_MAX_HEALTH, MISSILE_START_AMMO, MISSILE_MAX_AMMO } from '../config/constants.js';

// Game state object
export const gameState = {
    currentLevel: 0, // 0 = Training Zone, 1 = Asteroid Belt, 2 = Nebula Field, 3 = Alien Territory
    stationLevel: 0,
    stationHealth: 0,
    stationMaxHealth: 0,
    stationGunLevel: 0, // Station guns (0-10)
    ship: {
        speedLevel: 1,
        sizeLevel: 1,
        gunLevel: 1, // Start with gun
        health: SHIP_MAX_HEALTH,
        maxHealth: SHIP_MAX_HEALTH,
        missiles: MISSILE_START_AMMO, // Missile ammo
        maxMissiles: MISSILE_MAX_AMMO // Max missile capacity
    }
};

// State tracking variables
export const stateTracking = {
    resources: 0,
    upgradeUIUpdate: true, // Flag to track when upgrade UI needs refresh
    lastProductionTime: Date.now(),
    lastStationShotTime: 0,
    lastMissileRegenTime: Date.now(),
    bossSpawned: false,
    bossDefeated: false,
    bossAnnouncementShown: false,
    resourceCollectionPhase: false,
    resourceCollectionTimer: 0
};

/**
 * Reset state for a new game or level transition
 */
export function resetLevelState() {
    stateTracking.bossSpawned = false;
    stateTracking.bossDefeated = false;
    stateTracking.bossAnnouncementShown = false;
    stateTracking.resourceCollectionPhase = false;
    stateTracking.resourceCollectionTimer = 0;
}

/**
 * Reset station state (when destroyed)
 */
export function resetStationState() {
    gameState.stationLevel = 0;
    gameState.stationHealth = 0;
    gameState.stationMaxHealth = 0;
    gameState.stationGunLevel = 0;
}

/**
 * Upgrade ship gun level
 */
export function upgradeShipGun() {
    if (gameState.ship.gunLevel < 10) {
        gameState.ship.gunLevel++;
        stateTracking.upgradeUIUpdate = true;
    }
}

/**
 * Upgrade station level
 */
export function upgradeStation() {
    gameState.stationLevel++;
    gameState.stationMaxHealth = gameState.stationLevel * 200;
    gameState.stationHealth = gameState.stationMaxHealth;
    stateTracking.upgradeUIUpdate = true;
}

/**
 * Upgrade station gun level
 */
export function upgradeStationGun() {
    if (gameState.stationGunLevel < 10) {
        gameState.stationGunLevel++;
        stateTracking.upgradeUIUpdate = true;
    }
}

/**
 * Add resources
 */
export function addResources(amount) {
    stateTracking.resources += amount;
}

/**
 * Deduct resources
 */
export function deductResources(amount) {
    stateTracking.resources -= amount;
}

/**
 * Get current resources
 */
export function getResources() {
    return stateTracking.resources;
}
