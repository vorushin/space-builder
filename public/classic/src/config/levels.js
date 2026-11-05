/**
 * Level Configuration
 * Defines all game levels with their unique properties, enemy types, and bosses
 */

export const LEVEL_CONFIG = {
    0: {
        name: 'Training Zone',
        bgColor: 0x001010,
        starColors: [0xaadddd, 0x88cccc, 0x66aaaa],
        requirements: { stationLevel: 0, stationGunLevel: 0, shipGunLevel: 2, bossDefeated: false },
        asteroid: {
            fillColor: 0x88cccc,
            strokeColor: 0xaadddd,
            speedMultiplier: 1.0,
            healthMultiplier: 1.0
        },
        enemyTypes: [
            {
                name: 'Training Drone',
                weight: 0.7,
                fillColor: 0xff6666,
                strokeColor: 0xcc4444,
                size: { min: 10, max: 15 },
                healthMultiplier: 0.8,
                speedMultiplier: 0.9,
                fireRate: 2000,
                accuracy: 0.4,
                damage: 5
            },
            {
                name: 'Advanced Drone',
                weight: 0.3,
                fillColor: 0xff8888,
                strokeColor: 0xcc6666,
                size: { min: 12, max: 18 },
                healthMultiplier: 1.0,
                speedMultiplier: 1.1,
                fireRate: 1800,
                accuracy: 0.35,
                damage: 6
            }
        ],
        boss: {
            name: 'Protocol Override',
            fillColor: 0xff0000,
            strokeColor: 0xcc0000,
            size: 40,
            health: 300,
            speed: 0.8,
            fireRate: 800,
            accuracy: 0.2,
            damage: 8,
            burstCount: 2
        }
    },
    1: {
        name: 'Asteroid Belt',
        bgColor: 0x000000,
        starColors: [0xffffff, 0xcccccc, 0xaaaaaa],
        requirements: { stationLevel: 3, stationGunLevel: 3, shipGunLevel: 3, bossDefeated: false },
        asteroid: {
            fillColor: 0x888888,
            strokeColor: 0xaaaaaa,
            speedMultiplier: 1.2,
            healthMultiplier: 1.3
        },
        enemyTypes: [
            {
                name: 'Pirate Scout',
                weight: 0.5,
                fillColor: 0xff3333,
                strokeColor: 0xaa0000,
                size: { min: 12, max: 18 },
                healthMultiplier: 1.0,
                speedMultiplier: 1.4,
                fireRate: 1600,
                accuracy: 0.3,
                damage: 7
            },
            {
                name: 'Mining Raider',
                weight: 0.3,
                fillColor: 0xffaa33,
                strokeColor: 0xaa6600,
                size: { min: 18, max: 25 },
                healthMultiplier: 1.3,
                speedMultiplier: 1.0,
                fireRate: 2000,
                accuracy: 0.25,
                damage: 9
            },
            {
                name: 'Scavenger Cruiser',
                weight: 0.2,
                fillColor: 0x666666,
                strokeColor: 0x444444,
                size: { min: 25, max: 32 },
                healthMultiplier: 1.6,
                speedMultiplier: 0.7,
                fireRate: 2400,
                accuracy: 0.28,
                damage: 11
            }
        ],
        boss: {
            name: 'Crimson Marauder',
            fillColor: 0xaa0000,
            strokeColor: 0x880000,
            size: 50,
            health: 800,
            speed: 1.0,
            fireRate: 600,
            accuracy: 0.15,
            damage: 12,
            burstCount: 3
        }
    },
    2: {
        name: 'Nebula Field',
        bgColor: 0x0a0520,
        starColors: [0xaa88ff, 0x88aaff, 0xccaaff, 0xff88ff],
        requirements: { stationLevel: 6, stationGunLevel: 6, shipGunLevel: 6, bossDefeated: false },
        asteroid: {
            fillColor: 0x8866dd,
            strokeColor: 0xaa88ff,
            speedMultiplier: 1.4,
            healthMultiplier: 1.6
        },
        enemyTypes: [
            {
                name: 'Nebula Wraith',
                weight: 0.4,
                fillColor: 0xff00ff,
                strokeColor: 0xaa00aa,
                size: { min: 15, max: 20 },
                healthMultiplier: 1.2,
                speedMultiplier: 1.6,
                fireRate: 1400,
                accuracy: 0.25,
                damage: 10
            },
            {
                name: 'Energy Stalker',
                weight: 0.35,
                fillColor: 0xaa88ff,
                strokeColor: 0x8866dd,
                size: { min: 20, max: 28 },
                healthMultiplier: 1.5,
                speedMultiplier: 1.2,
                fireRate: 1800,
                accuracy: 0.22,
                damage: 13
            },
            {
                name: 'Void Hunter',
                weight: 0.25,
                fillColor: 0x4400aa,
                strokeColor: 0x220088,
                size: { min: 28, max: 36 },
                healthMultiplier: 2.0,
                speedMultiplier: 0.9,
                fireRate: 2200,
                accuracy: 0.2,
                damage: 15
            }
        ],
        boss: {
            name: 'Nebula Sovereign',
            fillColor: 0x6600ff,
            strokeColor: 0x4400aa,
            size: 60,
            health: 1500,
            speed: 1.2,
            fireRate: 500,
            accuracy: 0.12,
            damage: 15,
            burstCount: 4
        }
    },
    3: {
        name: 'Alien Territory',
        bgColor: 0x200a00,
        starColors: [0xffaa44, 0xff8844, 0xffcc44, 0xff6644],
        requirements: { stationLevel: 10, stationGunLevel: 10, shipGunLevel: 10, bossDefeated: false },
        asteroid: {
            fillColor: 0xcc6633,
            strokeColor: 0xff8844,
            speedMultiplier: 1.6,
            healthMultiplier: 2.0
        },
        enemyTypes: [
            {
                name: 'Alien Scout',
                weight: 0.35,
                fillColor: 0xff4400,
                strokeColor: 0xaa2200,
                size: { min: 18, max: 24 },
                healthMultiplier: 1.5,
                speedMultiplier: 1.8,
                fireRate: 1200,
                accuracy: 0.2,
                damage: 12
            },
            {
                name: 'Xenomorph Warrior',
                weight: 0.35,
                fillColor: 0xffaa00,
                strokeColor: 0xcc6600,
                size: { min: 24, max: 32 },
                healthMultiplier: 2.0,
                speedMultiplier: 1.3,
                fireRate: 1600,
                accuracy: 0.18,
                damage: 16
            },
            {
                name: 'Alien Dreadnought',
                weight: 0.3,
                fillColor: 0xff6600,
                strokeColor: 0xaa3300,
                size: { min: 32, max: 42 },
                healthMultiplier: 2.5,
                speedMultiplier: 0.8,
                fireRate: 2000,
                accuracy: 0.15,
                damage: 20
            }
        ],
        boss: {
            name: 'Xenarch Prime',
            fillColor: 0xff0000,
            strokeColor: 0xaa0000,
            size: 70,
            health: 3000,
            speed: 1.5,
            fireRate: 400,
            accuracy: 0.1,
            damage: 20,
            burstCount: 5
        }
    }
};
