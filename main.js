// Initialize PixiJS
const app = new PIXI.Application();

async function init() {
    await app.init({ background: '#000', resizeTo: window });
    document.body.appendChild(app.canvas);

    // UI Elements
    const levelNameSpan = document.getElementById('level-name');
    const goalProgressDiv = document.getElementById('goal-progress');
    const resourceCountSpan = document.getElementById('resource-count');
    const shipHealthSpan = document.getElementById('ship-health-value');
    const stationHealthSpan = document.getElementById('station-health-value');
    const shipHealthBar = document.getElementById('ship-health-bar');
    const stationHealthBar = document.getElementById('station-health-bar');
    const shipWeaponLabel = document.getElementById('ship-weapon-label');
    const shipWeaponLevel = document.getElementById('ship-weapon-level');
    const shipWeaponProgress = document.getElementById('ship-weapon-progress');
    const shipWeaponCost = document.getElementById('ship-weapon-cost');
    const shipUpgradeBtn = document.getElementById('ship-upgrade-btn');
    const stationLevelLabel = document.getElementById('station-level-label');
    const stationLevelDisplay = document.getElementById('station-level-display');
    const stationLevelProgress = document.getElementById('station-level-progress');
    const stationLevelCost = document.getElementById('station-level-cost');
    const stationLevelBtn = document.getElementById('station-level-btn');
    const stationGunLabel = document.getElementById('station-gun-label');
    const stationGunLevelDisplay = document.getElementById('station-gun-level-display');
    const stationGunProgress = document.getElementById('station-gun-progress');
    const stationGunCost = document.getElementById('station-gun-cost');
    const stationGunBtn = document.getElementById('station-gun-btn');
    const missileAmmoValue = document.getElementById('missile-ammo-value');
    const missileAmmoMax = document.getElementById('missile-ammo-max');

    // Game State
    let resources = 0;
    let upgradeUIUpdate = true; // Flag to track when upgrade UI needs refresh
    let lastProductionTime = Date.now();
    let lastStationShotTime = 0;
    let bossSpawned = false;
    let bossDefeated = false;
    let bossAnnouncementShown = false;
    let resourceCollectionPhase = false;
    let resourceCollectionTimer = 0;
    const COLLECTION_PHASE_DURATION = 600; // 10 seconds at 60fps
    const gameState = {
        currentLevel: 0, // 0 = Training Zone, 1 = Asteroid Belt, 2 = Nebula Field, 3 = Alien Territory
        stationLevel: 0,
        stationHealth: 0,
        stationMaxHealth: 0,
        stationGunLevel: 0, // Station guns (0-10)
        ship: {
            speedLevel: 1,
            sizeLevel: 1,
            gunLevel: 1, // Start with gun
            health: 100,
            maxHealth: 100,
            missiles: 5, // Missile ammo
            maxMissiles: 20 // Max missile capacity
        }
    };

    let lastMissileRegenTime = Date.now(); // Track missile regeneration

    // Level configuration
    const LEVEL_CONFIG = {
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
                    name: 'Alien Warrior',
                    weight: 0.35,
                    fillColor: 0xff6600,
                    strokeColor: 0xaa4400,
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
                    fillColor: 0xaa2200,
                    strokeColor: 0x881100,
                    size: { min: 32, max: 42 },
                    healthMultiplier: 2.8,
                    speedMultiplier: 0.8,
                    fireRate: 2000,
                    accuracy: 0.15,
                    damage: 20
                }
            ],
            boss: {
                name: 'Xenarch Prime',
                fillColor: 0x660000,
                strokeColor: 0x440000,
                size: 75,
                health: 3000,
                speed: 1.4,
                fireRate: 400,
                accuracy: 0.1,
                damage: 20,
                burstCount: 5
            }
        }
    };

    // Containers
    const backgroundContainer = new PIXI.Container();
    const gameContainer = new PIXI.Container();
    const cursorContainer = new PIXI.Container();
    app.stage.addChild(backgroundContainer);
    app.stage.addChild(gameContainer);
    app.stage.addChild(cursorContainer);

    // Custom cursor visual
    const cursor = new PIXI.Graphics();
    cursor.circle(0, 0, 8);
    cursor.stroke({ color: 0x00ffff, width: 2 });
    cursor.moveTo(-12, 0);
    cursor.lineTo(12, 0);
    cursor.moveTo(0, -12);
    cursor.lineTo(0, 12);
    cursor.stroke({ color: 0x00ffff, width: 1 });
    cursorContainer.addChild(cursor);

    // Starry Background
    function createStars() {
        backgroundContainer.removeChildren(); // Clear existing stars
        const config = LEVEL_CONFIG[gameState.currentLevel];
        const numStars = 200;
        for (let i = 0; i < numStars; i++) {
            const star = new PIXI.Graphics();
            star.circle(0, 0, Math.random() * 2);
            // Pick random color from level's star colors
            const colorIndex = Math.floor(Math.random() * config.starColors.length);
            star.fill({ color: config.starColors[colorIndex], alpha: Math.random() });
            star.x = Math.random() * app.screen.width;
            star.y = Math.random() * app.screen.height;
            backgroundContainer.addChild(star);
        }
        // Update background color
        app.renderer.background.color = config.bgColor;
    }
    createStars();

    // Station
    const station = new PIXI.Container();
    station.x = app.screen.width / 2;
    station.y = app.screen.height / 2;
    station.visible = false;
    gameContainer.addChild(station);

    function updateStationGraphics() {
        station.removeChildren();
        station.visible = true;
        const g = new PIXI.Graphics();

        if (gameState.stationLevel >= 1) {
            // Core Module
            g.circle(0, 0, 20).fill(0x8888ff).stroke({ width: 2, color: 0xffffff });
        }
        if (gameState.stationLevel >= 2) {
            // Solar Array
            g.rect(-40, -5, 30, 10).fill(0x3333cc);
            g.rect(10, -5, 30, 10).fill(0x3333cc);

            // Resource pull radius indicator
            const pullRadius = 100 + Math.min(gameState.stationLevel - 2, 8) * 30;
            g.circle(0, 0, pullRadius).stroke({ width: 1, color: 0x00ff00, alpha: 0.2 });
        }
        if (gameState.stationLevel >= 3) {
            // Docking Bay
            g.circle(0, 0, 35).stroke({ width: 4, color: 0x666666 });
        }
        if (gameState.stationLevel >= 4) {
            // Defense Grid - turret nodes
            g.circle(-30, -30, 5).fill(0xff0000);
            g.circle(30, -30, 5).fill(0xff0000);
            g.circle(-30, 30, 5).fill(0xff0000);
            g.circle(30, 30, 5).fill(0xff0000);
        }
        if (gameState.stationLevel >= 5) {
            // Mining Hub - resource collectors
            g.rect(-45, -2, 10, 4).fill(0x00ff00);
            g.rect(35, -2, 10, 4).fill(0x00ff00);
            g.rect(-2, -45, 4, 10).fill(0x00ff00);
            g.rect(-2, 35, 4, 10).fill(0x00ff00);
        }
        if (gameState.stationLevel >= 6) {
            // Research Lab - antenna arrays
            g.moveTo(0, -40).lineTo(0, -55).stroke({ width: 2, color: 0xffff00 });
            g.circle(0, -55, 3).fill(0xffff00);
            g.moveTo(-5, -42).lineTo(-8, -50).stroke({ width: 1, color: 0xffff00 });
            g.moveTo(5, -42).lineTo(8, -50).stroke({ width: 1, color: 0xffff00 });
        }
        if (gameState.stationLevel >= 7) {
            // Command Center - command bridge
            g.rect(-15, -8, 30, 16).fill(0x4444ff).stroke({ width: 2, color: 0x6666ff });
            g.circle(-10, -3, 2).fill(0x00ffff);
            g.circle(0, -3, 2).fill(0x00ffff);
            g.circle(10, -3, 2).fill(0x00ffff);
        }
        if (gameState.stationLevel >= 8) {
            // Shield Generator - energy field
            g.circle(0, 0, 50).stroke({ width: 3, color: 0x00ffff, alpha: 0.5 });
            g.circle(0, 0, 45).stroke({ width: 1, color: 0x00ffff, alpha: 0.3 });
        }
        if (gameState.stationLevel >= 9) {
            // Production Facility - factory modules
            g.rect(-25, 40, 15, 12).fill(0x888888).stroke({ width: 1, color: 0xaaaaaa });
            g.rect(10, 40, 15, 12).fill(0x888888).stroke({ width: 1, color: 0xaaaaaa });
            // Smoke stacks
            g.rect(-20, 52, 3, 8).fill(0x666666);
            g.rect(15, 52, 3, 8).fill(0x666666);
        }
        if (gameState.stationLevel >= 10) {
            // Mega Station - outer ring and glow
            g.circle(0, 0, 65).stroke({ width: 5, color: 0xffaa00 });
            g.circle(0, 0, 70).stroke({ width: 2, color: 0xffaa00, alpha: 0.3 });
            // Power nodes
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const x = Math.cos(angle) * 65;
                const y = Math.sin(angle) * 65;
                g.circle(x, y, 4).fill(0xffff00);
            }
        }

        // Station Gun visuals
        if (gameState.stationGunLevel >= 1) {
            // Basic turrets on cardinal points
            const turretSize = 5 + gameState.stationGunLevel * 0.5;
            g.circle(0, -40, turretSize).fill(0xff0000);
            g.circle(0, 40, turretSize).fill(0xff0000);
            g.circle(-40, 0, turretSize).fill(0xff0000);
            g.circle(40, 0, turretSize).fill(0xff0000);
        }
        if (gameState.stationGunLevel >= 3) {
            // Diagonal turrets
            g.circle(-30, -30, 4).fill(0xff8800);
            g.circle(30, -30, 4).fill(0xff8800);
            g.circle(-30, 30, 4).fill(0xff8800);
            g.circle(30, 30, 4).fill(0xff8800);
        }
        if (gameState.stationGunLevel >= 5) {
            // Beam emitters
            g.rect(-2, -45, 4, 8).fill(0xffff00);
            g.rect(-2, 37, 4, 8).fill(0xffff00);
            g.rect(-45, -2, 8, 4).fill(0xffff00);
            g.rect(37, -2, 8, 4).fill(0xffff00);
        }
        if (gameState.stationGunLevel >= 7) {
            // Advanced weapon pods
            g.rect(-50, -10, 10, 20).fill(0x00ff00).stroke({ width: 1, color: 0x00ff00 });
            g.rect(40, -10, 10, 20).fill(0x00ff00).stroke({ width: 1, color: 0x00ff00 });
        }
        if (gameState.stationGunLevel >= 9) {
            // Heavy weapon arrays
            g.circle(0, 0, 10).stroke({ width: 2, color: 0x00ffff });
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const x = Math.cos(angle) * 55;
                const y = Math.sin(angle) * 55;
                g.circle(x, y, 3).fill(0x00ffff);
            }
        }

        station.addChild(g);
        station.r = 30 + gameState.stationLevel * 5; // Growing collision radius
    }

    // Rocket
    const rocket = new PIXI.Container();
    rocket.x = app.screen.width / 2;
    rocket.y = app.screen.height / 2 + 100; // Start away from station
    rocket.vx = 0;
    rocket.vy = 0;
    rocket.rotation = 0;

    const rocketBody = new PIXI.Graphics();
    const rocketEngine = new PIXI.Graphics();
    rocketEngine.visible = false;
    rocket.addChild(rocketBody);
    rocket.addChild(rocketEngine);
    gameContainer.addChild(rocket);

    function updateShipStats() {
        // Base stats
        rocket.thrust = 0.1 * gameState.ship.speedLevel;
        rocket.rotationSpeed = 0.05 * gameState.ship.speedLevel;

        // Progressive size scaling based on weapon level - ship grows with power!
        const weaponScale = 1 + (gameState.ship.gunLevel * 0.08); // +8% per level
        const sizeScale = 1 + (gameState.ship.sizeLevel - 1) * 0.2;
        const scale = sizeScale * weaponScale;
        rocket.scale.set(scale);
        rocket.r = 15 * scale; // Collision radius

        // Redraw graphics based on gun level
        rocketBody.clear();

        const level = gameState.ship.gunLevel;

        // Main hull - gets more elaborate with levels
        if (level >= 1) {
            // Core body - aggressive angular fighter shape
            rocketBody.moveTo(22, 0) // Sharp nose
                .lineTo(15, -4)
                .lineTo(8, -7)
                .lineTo(-6, -10)
                .lineTo(-10, -8)
                .lineTo(-12, -6)
                .lineTo(-13, 0)
                .lineTo(-12, 6)
                .lineTo(-10, 8)
                .lineTo(-6, 10)
                .lineTo(8, 7)
                .lineTo(15, 4)
                .closePath()
                .fill(0x2266ff);

            // Speed lines on hull
            rocketBody.rect(4, -2, 8, 0.5).fill(0x4488ff);
            rocketBody.rect(4, 1.5, 8, 0.5).fill(0x4488ff);

            // Cockpit with gradient effect - more angular
            rocketBody.moveTo(12, -2)
                .lineTo(10, -3)
                .lineTo(6, -3)
                .lineTo(4, 0)
                .lineTo(6, 3)
                .lineTo(10, 3)
                .lineTo(12, 2)
                .closePath()
                .fill(0x00ccff);
            rocketBody.circle(8, 0, 2).fill(0xaaffff);

            // Engine intakes - larger and more prominent
            rocketBody.rect(-13, -6, 4, 12).fill(0x1144aa);
            rocketBody.circle(-11, -6, 1.5).fill(0x0088ff);
            rocketBody.circle(-11, 6, 1.5).fill(0x0088ff);

            // Wing blades - sharp and dangerous
            rocketBody.moveTo(12, -8)
                .lineTo(18, -9)
                .lineTo(19, -8)
                .lineTo(13, -7)
                .closePath()
                .fill(0x4488ff);
            rocketBody.moveTo(12, 8)
                .lineTo(18, 9)
                .lineTo(19, 8)
                .lineTo(13, 7)
                .closePath()
                .fill(0x4488ff);

            // Basic wing guns
            rocketBody.rect(14, -10, 7, 2.5).fill(0x5599ff);
            rocketBody.rect(14, 7.5, 7, 2.5).fill(0x5599ff);
            rocketBody.circle(21, -8.5, 1.8).fill(0xffaa00);
            rocketBody.circle(21, 8.5, 1.8).fill(0xffaa00);
        }

        if (level >= 2) {
            // Rapid Fire - extended barrels with heat vents
            rocketBody.rect(18, -10, 8, 3).fill(0xff8800);
            rocketBody.rect(18, 7, 8, 3).fill(0xff8800);
            // Heat vents - more aggressive
            rocketBody.rect(20, -8, 1.5, 0.8).fill(0xff3300);
            rocketBody.rect(23, -8, 1.5, 0.8).fill(0xff3300);
            rocketBody.rect(20, 7.2, 1.5, 0.8).fill(0xff3300);
            rocketBody.rect(23, 7.2, 1.5, 0.8).fill(0xff3300);
            // Glowing tips - larger and more dangerous
            rocketBody.circle(26, -8.5, 2.2).fill(0xffcc00);
            rocketBody.circle(26, 8.5, 2.2).fill(0xffcc00);
            rocketBody.circle(26, -8.5, 1.2).fill(0xffff00);
            rocketBody.circle(26, 8.5, 1.2).fill(0xffff00);
            // Speed stripes
            rocketBody.rect(0, -3, 10, 0.8).fill(0xff8800);
            rocketBody.rect(0, 2.2, 10, 0.8).fill(0xff8800);
        }

        if (level >= 3) {
            // Heavy Cannons - reinforced hull sections and wing extensions
            rocketBody.rect(-10, -12, 6, 3).fill(0x3377ff);
            rocketBody.rect(-10, 9, 6, 3).fill(0x3377ff);
            // Extended wing blades
            rocketBody.moveTo(10, -11)
                .lineTo(18, -13)
                .lineTo(20, -12)
                .lineTo(12, -10)
                .closePath()
                .fill(0x5599ff);
            rocketBody.moveTo(10, 11)
                .lineTo(18, 13)
                .lineTo(20, 12)
                .lineTo(12, 10)
                .closePath()
                .fill(0x5599ff);
            // Armor plating - angular and aggressive
            rocketBody.moveTo(2, -8)
                .lineTo(12, -8)
                .lineTo(11, -6.5)
                .lineTo(2, -6.5)
                .closePath()
                .fill(0x1155cc);
            rocketBody.moveTo(2, 8)
                .lineTo(12, 8)
                .lineTo(11, 6.5)
                .lineTo(2, 6.5)
                .closePath()
                .fill(0x1155cc);
            // Heavy gun mounts - larger
            rocketBody.circle(-7, -10.5, 2.5).fill(0x8888ff);
            rocketBody.circle(-7, 10.5, 2.5).fill(0x8888ff);
            rocketBody.circle(-7, -10.5, 1.2).fill(0xaaaaff);
            rocketBody.circle(-7, 10.5, 1.2).fill(0xaaaaff);
        }

        if (level >= 4) {
            // Triple Shot - power cores visible with energy network
            rocketBody.circle(-5, -13, 3).fill(0xff0000);
            rocketBody.circle(-5, -13, 2).fill(0xff6600);
            rocketBody.circle(-5, -13, 1).fill(0xffaa00);
            rocketBody.circle(-5, 13, 3).fill(0xff0000);
            rocketBody.circle(-5, 13, 2).fill(0xff6600);
            rocketBody.circle(-5, 13, 1).fill(0xffaa00);
            // Energy conduits - thicker and more visible
            rocketBody.rect(8, -12, 12, 1).fill(0xff6600);
            rocketBody.rect(8, 11, 12, 1).fill(0xff6600);
            // Additional conduit lines
            rocketBody.rect(-5, -13, 15, 0.6).fill(0xff8800);
            rocketBody.rect(-5, 12.4, 15, 0.6).fill(0xff8800);
            // Pulsing central core - larger
            rocketBody.circle(3, 0, 2.8).fill(0xff3300);
            rocketBody.circle(3, 0, 1.8).fill(0xff6600);
            // Power distribution nodes
            rocketBody.circle(10, -11, 1.2).fill(0xff6600);
            rocketBody.circle(10, 11, 1.2).fill(0xff6600);
        }

        if (level >= 5) {
            // Plasma Weapons - massive glowing plasma chambers
            rocketBody.circle(16, -9, 3.5).fill(0xffff00);
            rocketBody.circle(16, 9, 3.5).fill(0xffff00);
            rocketBody.circle(16, -9, 2.2).fill(0xffffaa);
            rocketBody.circle(16, 9, 2.2).fill(0xffffaa);
            rocketBody.circle(16, -9, 1).fill(0xffffff);
            rocketBody.circle(16, 9, 1).fill(0xffffff);
            // Plasma coils network
            rocketBody.circle(-2, -8, 2).fill(0xffff00);
            rocketBody.circle(-2, 8, 2).fill(0xffff00);
            rocketBody.circle(6, -9, 1.8).fill(0xffff00);
            rocketBody.circle(6, 9, 1.8).fill(0xffff00);
            // Central plasma reactor core
            rocketBody.circle(6, 0, 4).fill(0xffff00);
            rocketBody.circle(6, 0, 2.8).fill(0xffffaa);
            rocketBody.circle(6, 0, 1.5).fill(0xffffff);
            // Plasma energy glow around ship
            rocketBody.circle(6, 0, 6).stroke({ width: 1, color: 0xffff00, alpha: 0.4 });
        }

        if (level >= 6) {
            // Laser Barrage - massive turret arrays
            rocketBody.rect(-12, -15, 6, 3.5).fill(0x00ffff);
            rocketBody.rect(-12, 11.5, 6, 3.5).fill(0x00ffff);
            // Laser focusing crystal arrays - bigger and brighter
            rocketBody.circle(-9, -13, 2.5).fill(0x00ffff);
            rocketBody.circle(-9, 13, 2.5).fill(0x00ffff);
            rocketBody.circle(-9, -13, 1.5).fill(0xaaffff);
            rocketBody.circle(-9, 13, 1.5).fill(0xaaffff);
            rocketBody.circle(-9, -13, 0.8).fill(0xffffff);
            rocketBody.circle(-9, 13, 0.8).fill(0xffffff);
            // Extended wing laser arrays
            rocketBody.rect(4, -14, 10, 1.5).fill(0x00cccc);
            rocketBody.rect(4, 12.5, 10, 1.5).fill(0x00cccc);
            // Laser emitter nodes
            rocketBody.circle(6, -13, 1.5).fill(0x00ffff);
            rocketBody.circle(10, -13, 1.5).fill(0x00ffff);
            rocketBody.circle(6, 13, 1.5).fill(0x00ffff);
            rocketBody.circle(10, 13, 1.5).fill(0x00ffff);
        }

        if (level >= 7) {
            // Ion Pulse - massive energy field generators
            rocketBody.circle(-8, 0, 5).stroke({ width: 2.5, color: 0x0088ff, alpha: 0.7 });
            rocketBody.circle(-8, 0, 4).fill(0x0088ff);
            rocketBody.circle(-8, 0, 2.5).fill(0x00ccff);
            rocketBody.circle(-8, 0, 1.2).fill(0xaaffff);
            // Ion emitters on wings - larger
            rocketBody.circle(10, -11, 2.8).fill(0x00aaff);
            rocketBody.circle(10, 11, 2.8).fill(0x00aaff);
            rocketBody.circle(10, -11, 1.5).fill(0xaaffff);
            rocketBody.circle(10, 11, 1.5).fill(0xaaffff);
            // Energy field effect - multiple layers
            rocketBody.circle(0, 0, 8).stroke({ width: 1.5, color: 0x00ccff, alpha: 0.4 });
            rocketBody.circle(0, 0, 10).stroke({ width: 1, color: 0x00aaff, alpha: 0.3 });
            // Ion field projectors
            rocketBody.circle(0, -10, 1.8).fill(0x00ccff);
            rocketBody.circle(0, 10, 1.8).fill(0x00ccff);
        }

        if (level >= 8) {
            // Quantum Cannons - massive reality-bending weapons
            rocketBody.circle(18, -10, 4).fill(0xff00ff);
            rocketBody.circle(18, 10, 4).fill(0xff00ff);
            rocketBody.circle(18, -10, 2.5).fill(0xff88ff);
            rocketBody.circle(18, 10, 2.5).fill(0xff88ff);
            rocketBody.circle(18, -10, 1.2).fill(0xffaaff);
            rocketBody.circle(18, 10, 1.2).fill(0xffaaff);
            // Quantum field projectors - larger arrays
            rocketBody.rect(12, -13, 6, 2).fill(0xff00ff);
            rocketBody.rect(12, 11, 6, 2).fill(0xff00ff);
            // Reality warping rings around ship
            rocketBody.circle(0, 0, 10).stroke({ width: 2, color: 0xff00ff, alpha: 0.5 });
            rocketBody.circle(0, 0, 12).stroke({ width: 1.5, color: 0xff88ff, alpha: 0.35 });
            rocketBody.circle(0, 0, 14).stroke({ width: 1, color: 0xffaaff, alpha: 0.25 });
            // Quantum distortion nodes
            rocketBody.circle(5, -12, 2).fill(0xff00ff);
            rocketBody.circle(5, 12, 2).fill(0xff00ff);
            rocketBody.circle(12, -8, 1.5).fill(0xff88ff);
            rocketBody.circle(12, 8, 1.5).fill(0xff88ff);
        }

        if (level >= 9) {
            // Antimatter Guns - DANGER! Massive containment system
            rocketBody.circle(12, 0, 6).stroke({ width: 3, color: 0xff0000, alpha: 0.8 });
            rocketBody.circle(12, 0, 5).fill(0xff0000);
            rocketBody.circle(12, 0, 3.5).fill(0xff6666);
            rocketBody.circle(12, 0, 2).fill(0xffaaaa);
            // Antimatter containment pods - larger
            rocketBody.circle(5, -11, 3.5).fill(0xff0000);
            rocketBody.circle(5, 11, 3.5).fill(0xff0000);
            rocketBody.circle(5, -11, 2.2).fill(0xff6666);
            rocketBody.circle(5, 11, 2.2).fill(0xff6666);
            rocketBody.circle(5, -11, 1).fill(0xffaaaa);
            rocketBody.circle(5, 11, 1).fill(0xffaaaa);
            // Warning stripes - more prominent
            rocketBody.rect(-6, -5, 10, 1.5).fill(0xffff00);
            rocketBody.rect(-6, 3.5, 10, 1.5).fill(0xffff00);
            rocketBody.rect(-6, -2, 10, 1.5).fill(0xff0000);
            // Hazard symbols
            rocketBody.moveTo(-3, -4)
                .lineTo(-1, -4)
                .lineTo(-2, -2)
                .closePath()
                .fill(0xff0000);
            rocketBody.moveTo(-3, 4)
                .lineTo(-1, 4)
                .lineTo(-2, 6)
                .closePath()
                .fill(0xff0000);
        }

        if (level >= 10) {
            // Singularity Weapon - ULTIMATE POWER! Black hole at the core
            // The singularity core
            rocketBody.circle(8, 0, 7).fill(0x000000);
            rocketBody.circle(8, 0, 8.5).stroke({ width: 3, color: 0xffffff });
            rocketBody.circle(8, 0, 10.5).stroke({ width: 2, color: 0xffffff, alpha: 0.7 });
            rocketBody.circle(8, 0, 13).stroke({ width: 2, color: 0x8888ff, alpha: 0.5 });
            // Event horizon rings - multiple layers
            rocketBody.circle(8, 0, 16).stroke({ width: 2, color: 0xff00ff, alpha: 0.4 });
            rocketBody.circle(8, 0, 18).stroke({ width: 1.5, color: 0x00ffff, alpha: 0.35 });
            rocketBody.circle(8, 0, 20).stroke({ width: 1, color: 0xffff00, alpha: 0.25 });
            // Reality distortion lines - more dramatic
            for (let i = 0; i < 12; i++) {
                const angle = (i / 12) * Math.PI * 2;
                const x1 = 8 + Math.cos(angle) * 10;
                const y1 = Math.sin(angle) * 10;
                const x2 = 8 + Math.cos(angle) * 16;
                const y2 = Math.sin(angle) * 16;
                rocketBody.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: 1.5, color: 0xffffff, alpha: 0.5 });
            }
            // Accretion disk effect
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                const x = 8 + Math.cos(angle) * 14;
                const y = Math.sin(angle) * 14;
                rocketBody.circle(x, y, 2).fill(0xff00ff);
                rocketBody.circle(x, y, 1).fill(0xffffff);
            }
            // Ultimate power glow - massive
            rocketBody.circle(0, 0, 18).stroke({ width: 3, color: 0xffffff, alpha: 0.4 });
            rocketBody.circle(0, 0, 22).stroke({ width: 2, color: 0xaaaaff, alpha: 0.3 });
            // Gravitational lens effects
            rocketBody.circle(-5, -16, 2.5).fill(0xffffff);
            rocketBody.circle(-5, 16, 2.5).fill(0xffffff);
            rocketBody.circle(15, -12, 2.5).fill(0xffffff);
            rocketBody.circle(15, 12, 2.5).fill(0xffffff);
        }

        // Engine flames (enhanced with level)
        rocketEngine.clear();
        const engineWidth = 4 + level * 0.3;
        const engineLength = 12 + level * 1.5;
        rocketEngine.moveTo(-10, -engineWidth)
            .lineTo(-10 - engineLength * scale, 0)
            .lineTo(-10, engineWidth)
            .closePath()
            .fill(0xff3300);

        // Inner bright flame
        rocketEngine.moveTo(-10, -engineWidth * 0.6)
            .lineTo(-10 - engineLength * 0.7 * scale, 0)
            .lineTo(-10, engineWidth * 0.6)
            .closePath()
            .fill(0xffaa00);

        // Level 5+ plasma trail
        if (level >= 5) {
            rocketEngine.moveTo(-10, -engineWidth * 0.3)
                .lineTo(-10 - engineLength * 0.5 * scale, 0)
                .lineTo(-10, engineWidth * 0.3)
                .closePath()
                .fill(0xffff00);
        }
    }
    updateShipStats();

    // Bullets
    const bullets = [];
    const stationBullets = [];
    let lastShotTime = 0;

    // Missiles
    const missiles = [];
    let lastMissileShotTime = 0;

    function fireMissile() {
        // Check if we have ammo
        if (gameState.ship.missiles <= 0) return;

        // Fire rate cooldown (prevent spam)
        const now = Date.now();
        if (now - lastMissileShotTime < 500) return; // 500ms cooldown between missiles
        lastMissileShotTime = now;

        // Consume ammo
        gameState.ship.missiles--;
        upgradeUIUpdate = true;

        // Missile properties
        const missileSpeed = 4; // Slower than bullets for tracking
        const missileSize = 4;
        const missileRange = (60 + gameState.ship.gunLevel * 10) * 2; // 2x bullet range

        // Create missile visual
        const missile = new PIXI.Graphics();
        // Missile body (elongated)
        missile.rect(-2, -missileSize/2, 8, missileSize).fill(0xff4400);
        // Missile nose cone
        missile.moveTo(6, -missileSize/2)
            .lineTo(8, 0)
            .lineTo(6, missileSize/2)
            .closePath()
            .fill(0xff6600);
        // Fins
        missile.moveTo(-2, -missileSize/2)
            .lineTo(-4, -missileSize)
            .lineTo(-2, -missileSize)
            .closePath()
            .fill(0xcc3300);
        missile.moveTo(-2, missileSize/2)
            .lineTo(-4, missileSize)
            .lineTo(-2, missileSize)
            .closePath()
            .fill(0xcc3300);

        // Position at ship
        missile.x = rocket.x;
        missile.y = rocket.y;
        missile.rotation = rocket.rotation;

        // Velocity
        missile.vx = Math.cos(rocket.rotation) * missileSpeed + rocket.vx;
        missile.vy = Math.sin(rocket.rotation) * missileSpeed + rocket.vy;

        // Missile properties
        missile.life = missileRange; // Range in frames
        missile.damage = gameState.ship.gunLevel * (2.5 + Math.random()); // 2-3x weapon damage
        missile.r = 5; // Collision radius
        missile.explosionRadius = 40 + gameState.ship.gunLevel * 5; // Large explosion radius
        missile.proximityRadius = 30; // Explode when this close to target

        gameContainer.addChild(missile);
        missiles.push(missile);

        // Visual feedback
        createFloatingText(rocket.x, rocket.y - 30, 'MISSILE!', 0xff4400, 14);
    }

    function shoot() {
        if (gameState.ship.gunLevel === 0) return;

        // Fire rate based on gun level (lower = faster)
        const fireRateCooldown = Math.max(5, 20 - gameState.ship.gunLevel * 1.5); // Level 1: 18.5, Level 10: 5 frames
        const now = Date.now();
        if (now - lastShotTime < fireRateCooldown * 16.67) return; // Convert frames to ms
        lastShotTime = now;

        // Bullet properties based on gun level
        const bulletSpeed = 5 + gameState.ship.gunLevel * 0.5; // Level 1: 5.5, Level 10: 10
        const bulletSize = 2 + gameState.ship.gunLevel * 0.4; // Larger bullets at higher levels
        const bulletDamage = gameState.ship.gunLevel; // Used for splitting asteroids

        // Multi-shot progression
        let numBullets = 1;
        if (gameState.ship.gunLevel >= 4) numBullets = 3;
        if (gameState.ship.gunLevel >= 6) numBullets = 5; // Laser barrage
        if (gameState.ship.gunLevel >= 8) numBullets = 7; // Quantum cannons

        const spreadAngle = 0.15; // Angle between bullets

        // Bullet color based on level
        let bulletColor = 0xffff00; // Yellow
        if (gameState.ship.gunLevel >= 5) bulletColor = 0xff00ff; // Magenta plasma
        if (gameState.ship.gunLevel >= 6) bulletColor = 0x00ffff; // Cyan laser
        if (gameState.ship.gunLevel >= 7) bulletColor = 0x0088ff; // Blue ion
        if (gameState.ship.gunLevel >= 8) bulletColor = 0xff00ff; // Purple quantum
        if (gameState.ship.gunLevel >= 9) bulletColor = 0xff0000; // Red antimatter
        if (gameState.ship.gunLevel >= 10) bulletColor = 0xffffff; // White singularity

        for (let i = 0; i < numBullets; i++) {
            const angleOffset = (i - (numBullets - 1) / 2) * spreadAngle;
            const finalAngle = rocket.rotation + angleOffset;

            const b = new PIXI.Graphics().circle(0, 0, bulletSize).fill(bulletColor);

            // Level 10: Add glow effect
            if (gameState.ship.gunLevel >= 10) {
                b.circle(0, 0, bulletSize + 2).stroke({ width: 1, color: 0x8888ff, alpha: 0.5 });
            }

            b.x = rocket.x + Math.cos(finalAngle) * 15 * rocket.scale.x;
            b.y = rocket.y + Math.sin(finalAngle) * 15 * rocket.scale.y;
            b.vx = Math.cos(finalAngle) * bulletSpeed + rocket.vx;
            b.vy = Math.sin(finalAngle) * bulletSpeed + rocket.vy;
            b.life = 60 + gameState.ship.gunLevel * 10; // Longer range at higher levels
            b.damage = bulletDamage;

            // Level 7+: Ion pulse - bullets have splash damage radius
            if (gameState.ship.gunLevel >= 7) {
                b.splashRadius = 20 + (gameState.ship.gunLevel - 7) * 10; // 20-50px
            }

            gameContainer.addChild(b);
            bullets.push(b);
        }
    }

    // Resource Pieces (dropped from shot asteroids)
    const resourcePieces = [];

    function createResourcePiece(x, y, value) {
        const piece = new PIXI.Graphics();
        piece.circle(0, 0, 3).fill(0x00ff00);
        piece.x = x;
        piece.y = y;
        // Slower, constant velocity for realistic space physics
        piece.vx = (Math.random() - 0.5) * 0.5;
        piece.vy = (Math.random() - 0.5) * 0.5;
        piece.value = value;
        piece.r = 3;
        piece.pullRadius = 80; // Distance at which ship starts pulling this in
        piece.lifetime = 0; // Track how long resource has existed (in frames at 60fps)
        piece.maxLifetime = 3600; // 60 seconds at 60fps
        piece.fadeStartTime = 1800; // Start fading after 30 seconds

        gameContainer.addChild(piece);
        resourcePieces.push(piece);
    }

    // Floating text for resource collection
    const floatingTexts = [];

    function createFloatingText(x, y, text, color = 0x00ff00, fontSize = 16) {
        const textObj = new PIXI.Text({
            text: text,
            style: {
                fontSize: fontSize,
                fill: color,
                fontWeight: 'bold',
                stroke: { color: 0x000000, width: 3 }
            }
        });
        textObj.x = x;
        textObj.y = y;
        textObj.anchor = 0.5;
        textObj.vy = -1; // Float upward
        textObj.life = 60; // frames

        gameContainer.addChild(textObj);
        floatingTexts.push(textObj);
    }

    // Explosions
    const explosions = [];

    function createExplosion(x, y, size) {
        const numParticles = 8 + Math.floor(size / 5); // More particles for larger explosions
        const particles = [];

        for (let i = 0; i < numParticles; i++) {
            const angle = (Math.PI * 2 * i) / numParticles + (Math.random() - 0.5) * 0.5;
            const speed = 2 + Math.random() * 3;
            const particleSize = 2 + Math.random() * 3;

            const particle = new PIXI.Graphics();
            particle.circle(0, 0, particleSize).fill(0xff6600);
            particle.x = x;
            particle.y = y;
            particle.vx = Math.cos(angle) * speed;
            particle.vy = Math.sin(angle) * speed;
            particle.life = 30 + Math.random() * 30; // 30-60 frames
            particle.maxLife = particle.life;

            gameContainer.addChild(particle);
            particles.push(particle);
        }

        explosions.push(...particles);
    }

    // Missile explosion - larger and more impressive
    function createMissileExplosion(x, y, radius) {
        const numParticles = 30 + Math.floor(radius / 3); // Many more particles
        const particles = [];

        // Multiple rings of particles for layered effect
        for (let ring = 0; ring < 3; ring++) {
            const ringParticles = Math.floor(numParticles / 3);
            const ringDelay = ring * 3; // Stagger the rings
            const ringSpeed = 3 + ring * 1.5;

            for (let i = 0; i < ringParticles; i++) {
                const angle = (Math.PI * 2 * i) / ringParticles + (Math.random() - 0.5) * 0.3;
                const speed = ringSpeed + Math.random() * 2;
                const particleSize = 3 + Math.random() * 4;

                const particle = new PIXI.Graphics();
                // Color gradient from white-hot to red-orange
                const colors = [0xffffff, 0xffff00, 0xff8800, 0xff4400, 0xff0000];
                const colorIndex = Math.floor(Math.random() * colors.length);
                particle.circle(0, 0, particleSize).fill(colors[colorIndex]);

                particle.x = x;
                particle.y = y;
                particle.vx = Math.cos(angle) * speed;
                particle.vy = Math.sin(angle) * speed;
                particle.life = 40 + Math.random() * 40 - ringDelay; // 40-80 frames, staggered
                particle.maxLife = particle.life;

                gameContainer.addChild(particle);
                particles.push(particle);
            }
        }

        // Add a shockwave ring effect
        const shockwave = new PIXI.Graphics();
        shockwave.circle(0, 0, 5).stroke({ width: 3, color: 0xff8800, alpha: 0.8 });
        shockwave.x = x;
        shockwave.y = y;
        shockwave.life = 30;
        shockwave.maxLife = 30;
        shockwave.maxScale = radius / 5; // Scale based on explosion radius

        gameContainer.addChild(shockwave);
        particles.push(shockwave);

        explosions.push(...particles);

        // Visual feedback text
        createFloatingText(x, y, 'BOOM!', 0xff4400, 24);
    }

    // Asteroids
    const asteroids = [];
    const numAsteroids = 20;

    function createAsteroid(options = {}) {
        const { x, y, r, offscreen = false } = options;
        const radius = r || Math.random() * 20 + 15;
        const asteroid = new PIXI.Graphics();

        // Get level-specific asteroid colors
        const levelConfig = LEVEL_CONFIG[gameState.currentLevel];
        const fillColor = levelConfig.asteroid.fillColor;
        const strokeColor = levelConfig.asteroid.strokeColor;

        // Draw irregular shape
        asteroid.moveTo(radius, 0);
        for (let i = 1; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const dist = radius * (0.8 + Math.random() * 0.4);
            asteroid.lineTo(Math.cos(angle) * dist, Math.sin(angle) * dist);
        }
        asteroid.closePath();
        asteroid.fill(fillColor).stroke({ width: 2, color: strokeColor });

        // Position: if x,y provided, use them; if offscreen, spawn outside; otherwise spawn on screen
        if (x !== undefined && y !== undefined) {
            asteroid.x = x;
            asteroid.y = y;
        } else if (offscreen) {
            // Spawn outside the visible screen
            const spawnMargin = 100; // Distance outside screen
            const side = Math.floor(Math.random() * 4);
            if (side === 0) { // Top
                asteroid.x = Math.random() * app.screen.width;
                asteroid.y = -spawnMargin;
            } else if (side === 1) { // Right
                asteroid.x = app.screen.width + spawnMargin;
                asteroid.y = Math.random() * app.screen.height;
            } else if (side === 2) { // Bottom
                asteroid.x = Math.random() * app.screen.width;
                asteroid.y = app.screen.height + spawnMargin;
            } else { // Left
                asteroid.x = -spawnMargin;
                asteroid.y = Math.random() * app.screen.height;
            }
        } else {
            // Spawn anywhere on screen (for initial asteroids)
            asteroid.x = Math.random() * app.screen.width;
            asteroid.y = Math.random() * app.screen.height;
        }

        asteroid.r = radius;
        // Apply level-specific speed multiplier
        const speedMult = levelConfig.asteroid.speedMultiplier;
        asteroid.vx = (Math.random() - 0.5) * 2 * speedMult;
        asteroid.vy = (Math.random() - 0.5) * 2 * speedMult;
        asteroid.rotationSpeed = (Math.random() - 0.5) * 0.05;
        // Apply level-specific health multiplier
        asteroid.resources = Math.floor(radius * 2 * levelConfig.asteroid.healthMultiplier);

        gameContainer.addChild(asteroid);
        asteroids.push(asteroid);
    }

    for (let i = 0; i < numAsteroids; i++) {
        createAsteroid();
    }

    // Enemy Ships
    const enemies = [];
    const enemyBullets = [];
    const enemyGroups = [];
    let lastEnemySpawnTime = Date.now();
    let nextGroupId = 0;

    function createEnemyShip(isBoss = false, groupData = null) {
        const enemy = new PIXI.Container();
        const levelConfig = LEVEL_CONFIG[gameState.currentLevel];

        let enemyType, size, health, speed, fireRate, accuracy, fillColor, strokeColor, damage;

        if (isBoss) {
            // Create boss enemy
            const boss = levelConfig.boss;
            enemyType = boss.name;
            size = boss.size;

            // Adaptive HP based on player's current weapon damage
            // Calculate damage per hit: gunLevel * 5 (player bullets do damage * 5)
            const baseDamagePerHit = gameState.ship.gunLevel * 5;

            // Account for multi-shot (not all bullets hit, so use 70% effectiveness)
            let numBullets = 1;
            if (gameState.ship.gunLevel >= 4) numBullets = 3;
            if (gameState.ship.gunLevel >= 6) numBullets = 5;
            if (gameState.ship.gunLevel >= 8) numBullets = 7;
            const effectiveBulletsHit = numBullets * 0.7; // 70% hit rate
            const damagePerVolley = baseDamagePerHit * effectiveBulletsHit;

            // Boss should take 30-50 volleys to defeat (randomized for variety)
            const volleysToDefeat = 30 + Math.random() * 20; // 30-50
            health = Math.floor(damagePerVolley * volleysToDefeat);

            // Minimum HP to ensure boss isn't too easy
            health = Math.max(health, 500);

            speed = boss.speed;
            fireRate = boss.fireRate;
            accuracy = boss.accuracy;
            fillColor = boss.fillColor;
            strokeColor = boss.strokeColor;
            damage = boss.damage;
            enemy.isBoss = true;
            enemy.burstCount = boss.burstCount;
            enemy.burstShotsFired = 0;
            enemy.burstCooldown = 0;
        } else {
            // Weighted random selection of enemy type
            const enemyTypes = levelConfig.enemyTypes;
            const totalWeight = enemyTypes.reduce((sum, type) => sum + type.weight, 0);
            let random = Math.random() * totalWeight;

            let selectedType = enemyTypes[0];
            for (const type of enemyTypes) {
                random -= type.weight;
                if (random <= 0) {
                    selectedType = type;
                    break;
                }
            }

            enemyType = selectedType.name;
            size = selectedType.size.min + Math.random() * (selectedType.size.max - selectedType.size.min);
            const baseHealth = 30 + size * 3;
            health = baseHealth * selectedType.healthMultiplier;
            speed = (0.8 + Math.random() * 0.4) * selectedType.speedMultiplier;
            fireRate = selectedType.fireRate;
            accuracy = selectedType.accuracy;
            fillColor = selectedType.fillColor;
            strokeColor = selectedType.strokeColor;
            damage = selectedType.damage;
            enemy.isBoss = false;
        }

        enemy.enemyType = enemyType;
        enemy.maxHealth = health;
        enemy.health = health;
        enemy.size = size;
        enemy.speed = speed;
        enemy.fireRate = fireRate;
        enemy.accuracy = accuracy;
        enemy.damage = damage;
        enemy.lastShotTime = Date.now();
        enemy.r = size; // Collision radius

        // Assign group data
        if (groupData) {
            enemy.groupId = groupData.groupId;
            enemy.groupRole = groupData.role; // 'leader' or 'follower'
            enemy.formationOffset = groupData.formationOffset || { x: 0, y: 0 };
        }

        // Spawn position
        if (groupData && groupData.spawnPos) {
            // Use group spawn position with formation offset
            enemy.x = groupData.spawnPos.x + groupData.formationOffset.x;
            enemy.y = groupData.spawnPos.y + groupData.formationOffset.y;
        } else {
            // Spawn outside screen (for bosses and solo enemies)
            const side = Math.floor(Math.random() * 4);
            if (side === 0) { // Top
                enemy.x = Math.random() * app.screen.width;
                enemy.y = -50;
            } else if (side === 1) { // Right
                enemy.x = app.screen.width + 50;
                enemy.y = Math.random() * app.screen.height;
            } else if (side === 2) { // Bottom
                enemy.x = Math.random() * app.screen.width;
                enemy.y = app.screen.height + 50;
            } else { // Left
                enemy.x = -50;
                enemy.y = Math.random() * app.screen.height;
            }
        }

        // Draw enemy ship
        const g = new PIXI.Graphics();

        if (isBoss) {
            // Boss visual - larger and more intimidating
            // Main body
            g.moveTo(size, 0)
                .lineTo(-size * 0.8, -size * 0.8)
                .lineTo(-size * 0.5, 0)
                .lineTo(-size * 0.8, size * 0.8)
                .closePath()
                .fill(fillColor)
                .stroke({ width: 4, color: strokeColor });

            // Boss core
            g.circle(0, 0, size * 0.3).fill(strokeColor);
            g.circle(0, 0, size * 0.15).fill(0xffffff);

            // Multiple weapon arrays
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
                const wx = Math.cos(angle) * size * 0.6;
                const wy = Math.sin(angle) * size * 0.6;
                g.rect(wx - size * 0.15, wy - size * 0.08, size * 0.5, size * 0.16).fill(strokeColor);
            }

            // Boss glow effect
            g.circle(0, 0, size * 0.9).stroke({ width: 3, color: strokeColor, alpha: 0.5 });
            g.circle(0, 0, size * 1.1).stroke({ width: 2, color: strokeColor, alpha: 0.3 });

            // Boss name label
            const nameText = new PIXI.Text({
                text: enemyType,
                style: {
                    fill: 0xffffff,
                    fontSize: 12,
                    fontWeight: 'bold',
                    stroke: { color: 0x000000, width: 3 }
                }
            });
            nameText.anchor.set(0.5);
            nameText.y = -size - 15;
            enemy.addChild(nameText);
        } else {
            // Regular enemy visual
            g.moveTo(size, 0)
                .lineTo(-size * 0.7, -size * 0.7)
                .lineTo(-size * 0.4, 0)
                .lineTo(-size * 0.7, size * 0.7)
                .closePath()
                .fill(fillColor)
                .stroke({ width: 2, color: strokeColor });

            // Weapons
            g.rect(size * 0.5, -size * 0.3, size * 0.4, size * 0.15).fill(strokeColor);
            g.rect(size * 0.5, size * 0.15, size * 0.4, size * 0.15).fill(strokeColor);

            // Add type-specific visual details
            if (size > 25) {
                // Large enemy - add engine glow
                g.circle(-size * 0.4, 0, size * 0.15).fill(0xff6600);
            } else if (size < 18) {
                // Small enemy - add speed lines
                g.moveTo(-size * 0.4, -size * 0.2).lineTo(-size * 0.8, -size * 0.3).stroke({ width: 1, color: strokeColor });
                g.moveTo(-size * 0.4, size * 0.2).lineTo(-size * 0.8, size * 0.3).stroke({ width: 1, color: strokeColor });
            }
        }

        enemy.addChild(g);

        // Add health bar for bosses and large enemies
        if (isBoss || size > 25) {
            const healthBarContainer = new PIXI.Container();
            healthBarContainer.y = -size - (isBoss ? 30 : 20);

            // Health bar background (red)
            const healthBarBg = new PIXI.Graphics();
            const barWidth = size * 1.5;
            const barHeight = isBoss ? 6 : 4;
            healthBarBg.rect(-barWidth / 2, 0, barWidth, barHeight).fill(0x440000);
            healthBarContainer.addChild(healthBarBg);

            // Health bar foreground (green)
            const healthBarFg = new PIXI.Graphics();
            healthBarFg.rect(-barWidth / 2, 0, barWidth, barHeight).fill(0x00ff00);
            healthBarContainer.addChild(healthBarFg);

            // Store references for updating
            enemy.healthBarContainer = healthBarContainer;
            enemy.healthBarFg = healthBarFg;
            enemy.healthBarWidth = barWidth;

            enemy.addChild(healthBarContainer);
        }

        gameContainer.addChild(enemy);
        enemies.push(enemy);
    }

    // Update enemy health bar
    function updateEnemyHealthBar(enemy) {
        if (enemy.healthBarFg) {
            const healthPercent = Math.max(0, enemy.health / enemy.maxHealth);
            enemy.healthBarFg.clear();
            enemy.healthBarFg.rect(-enemy.healthBarWidth / 2, 0, enemy.healthBarWidth * healthPercent, enemy.isBoss ? 6 : 4);

            // Color changes based on health
            if (healthPercent > 0.6) {
                enemy.healthBarFg.fill(0x00ff00); // Green
            } else if (healthPercent > 0.3) {
                enemy.healthBarFg.fill(0xffff00); // Yellow
            } else {
                enemy.healthBarFg.fill(0xff0000); // Red
            }
        }
    }

    // Handle boss defeat - destroy all remaining enemies
    function handleBossDefeat(bossX, bossY, bossName) {
        bossDefeated = true;
        createFloatingText(bossX, bossY, `${bossName} DEFEATED!`, 0xffff00, 24);

        // Destroy all remaining enemies and make them drop resources
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (!enemy.isBoss) { // Don't process the boss again
                createExplosion(enemy.x, enemy.y, enemy.size);

                // Drop resources from destroyed enemies
                const resourceDrop = Math.floor(enemy.size * 3);
                const numPieces = 3 + Math.floor(enemy.size / 10);
                for (let k = 0; k < numPieces; k++) {
                    createResourcePiece(enemy.x, enemy.y, Math.floor(resourceDrop / numPieces));
                }

                gameContainer.removeChild(enemy);
                enemies.splice(i, 1);
            }
        }

        // Show dramatic message
        createFloatingText(app.screen.width / 2, app.screen.height / 2 + 50, 'ALL ENEMIES DESTROYED!', 0xff0000, 20);
    }

    // Create enemy group with coordinated behavior
    function createEnemyGroup() {
        const groupSize = 3 + Math.floor(Math.random() * 5); // 3-7 ships
        const groupId = nextGroupId++;

        // Determine spawn side and position
        const side = Math.floor(Math.random() * 4);
        let spawnX, spawnY;
        if (side === 0) { // Top
            spawnX = Math.random() * app.screen.width;
            spawnY = -100;
        } else if (side === 1) { // Right
            spawnX = app.screen.width + 100;
            spawnY = Math.random() * app.screen.height;
        } else if (side === 2) { // Bottom
            spawnX = Math.random() * app.screen.width;
            spawnY = app.screen.height + 100;
        } else { // Left
            spawnX = -100;
            spawnY = Math.random() * app.screen.height;
        }

        // Create group state
        const group = {
            id: groupId,
            state: 'approaching', // approaching, attacking, retreating, regrouping
            stateTimer: 0,
            centerX: spawnX,
            centerY: spawnY,
            targetX: app.screen.width / 2,
            targetY: app.screen.height / 2,
            retreatX: spawnX,
            retreatY: spawnY,
            memberIds: []
        };

        // Formation patterns (V-formation or line)
        const formations = [
            // V-formation
            (i, total) => ({
                x: (i - (total - 1) / 2) * 40,
                y: Math.abs(i - (total - 1) / 2) * 25
            }),
            // Line formation
            (i, total) => ({
                x: (i - (total - 1) / 2) * 50,
                y: 0
            }),
            // Diamond formation
            (i, total) => {
                const half = Math.floor(total / 2);
                if (i < half) {
                    return { x: (i - half / 2) * 40, y: i * 30 };
                } else {
                    return { x: ((total - i - 1) - half / 2) * 40, y: i * 30 };
                }
            }
        ];

        const formation = formations[Math.floor(Math.random() * formations.length)];

        // Create ships in formation
        for (let i = 0; i < groupSize; i++) {
            const offset = formation(i, groupSize);
            const groupData = {
                groupId: groupId,
                role: i === 0 ? 'leader' : 'follower',
                formationOffset: offset,
                spawnPos: { x: spawnX, y: spawnY }
            };

            const enemy = createEnemyShip(false, groupData);
            group.memberIds.push(enemies.length - 1); // Track enemy array index
        }

        enemyGroups.push(group);
    }

    // Update group AI
    function updateGroupAI(group, time) {
        // Find all living members
        const members = group.memberIds
            .map(id => enemies[id])
            .filter(e => e && e.groupId === group.id);

        if (members.length === 0) {
            // Group wiped out
            return false;
        }

        // Update group center based on members
        let avgX = 0, avgY = 0;
        members.forEach(m => {
            avgX += m.x;
            avgY += m.y;
        });
        group.centerX = avgX / members.length;
        group.centerY = avgY / members.length;

        // State machine
        group.stateTimer += time.deltaTime;

        switch (group.state) {
            case 'approaching':
                // Set target to player/station area
                if (gameState.stationLevel > 0) {
                    group.targetX = station.x + (Math.random() - 0.5) * 200;
                    group.targetY = station.y + (Math.random() - 0.5) * 200;
                } else {
                    group.targetX = rocket.x + (Math.random() - 0.5) * 200;
                    group.targetY = rocket.y + (Math.random() - 0.5) * 200;
                }

                // Check if reached target area
                const distToTarget = Math.sqrt(
                    (group.centerX - group.targetX) ** 2 +
                    (group.centerY - group.targetY) ** 2
                );

                if (distToTarget < 250 || group.stateTimer > 180) {
                    group.state = 'attacking';
                    group.stateTimer = 0;
                }
                break;

            case 'attacking':
                // Attack for 5-8 seconds
                if (group.stateTimer > 300 + Math.random() * 180) {
                    group.state = 'retreating';
                    group.stateTimer = 0;

                    // Set retreat point away from combat
                    const angle = Math.atan2(group.centerY - app.screen.height / 2, group.centerX - app.screen.width / 2);
                    group.retreatX = app.screen.width / 2 + Math.cos(angle) * 400;
                    group.retreatY = app.screen.height / 2 + Math.sin(angle) * 400;
                }
                break;

            case 'retreating':
                // Check if reached retreat point
                const distToRetreat = Math.sqrt(
                    (group.centerX - group.retreatX) ** 2 +
                    (group.centerY - group.retreatY) ** 2
                );

                if (distToRetreat < 100 || group.stateTimer > 180) {
                    group.state = 'regrouping';
                    group.stateTimer = 0;
                }
                break;

            case 'regrouping':
                // Regroup for 2-3 seconds then approach again
                if (group.stateTimer > 120 + Math.random() * 60) {
                    group.state = 'approaching';
                    group.stateTimer = 0;
                }
                break;
        }

        return true; // Group still active
    }

    // Actions
    // Check for level progression
    function checkLevelProgression() {
        const nextLevel = gameState.currentLevel + 1;
        if (nextLevel > 3) return false; // Max level reached

        const requirements = LEVEL_CONFIG[gameState.currentLevel].requirements;

        // Check if all requirements are met
        // For Level 0, only check ship gun level (no station required)
        if (gameState.currentLevel === 0) {
            return gameState.ship.gunLevel >= requirements.shipGunLevel;
        }

        // For other levels, check all requirements
        if (gameState.stationLevel >= requirements.stationLevel &&
            gameState.stationGunLevel >= requirements.stationGunLevel &&
            gameState.ship.gunLevel >= requirements.shipGunLevel) {
            return true;
        }
        return false;
    }

    // Create teleportation visual effect
    function createTeleportEffect(x, y, radius) {
        const numRings = 5;
        const rings = [];

        for (let i = 0; i < numRings; i++) {
            const ring = new PIXI.Graphics();
            ring.x = x;
            ring.y = y;
            ring.alpha = 1.0;
            ring.scale.set(0.1);
            ring.targetScale = 1 + i * 0.5;
            ring.life = 60; // frames
            ring.maxLife = 60;

            // Draw ring based on current level
            const config = LEVEL_CONFIG[gameState.currentLevel];
            const ringColor = config.starColors[i % config.starColors.length];
            ring.circle(0, 0, radius + i * 10).stroke({ width: 3, color: ringColor, alpha: 0.8 });

            gameContainer.addChild(ring);
            rings.push(ring);
        }

        return rings;
    }

    // Transition to next level
    function transitionToNextLevel() {
        gameState.currentLevel++;

        // Reset boss state immediately for new level
        bossSpawned = false;
        bossDefeated = false;
        bossAnnouncementShown = false;

        // Reset resource collection phase
        resourceCollectionPhase = false;
        resourceCollectionTimer = 0;

        // Create teleportation effects for ship and station
        const shipTeleportRings = createTeleportEffect(rocket.x, rocket.y, 40);
        let stationTeleportRings = [];
        if (gameState.stationLevel > 0) {
            stationTeleportRings = createTeleportEffect(station.x, station.y, 80);
        }

        // Track all rings for cleanup
        let allRings = [...shipTeleportRings, ...stationTeleportRings];
        let newRings = [];

        // Animate teleportation
        let transitionFrames = 0;
        const transitionDuration = 60; // 1 second at 60fps

        const transitionTicker = (time) => {
            transitionFrames += time.deltaTime;

            // Fade out ship and station
            if (transitionFrames < transitionDuration / 2) {
                const fadeProgress = transitionFrames / (transitionDuration / 2);
                rocket.alpha = 1 - fadeProgress;
                if (station.visible) station.alpha = 1 - fadeProgress;

                // Animate teleport rings
                allRings.forEach(ring => {
                    if (ring.parent) {
                        ring.life -= time.deltaTime;
                        ring.scale.set(ring.scale.x + 0.05 * time.deltaTime);
                        ring.alpha = ring.life / ring.maxLife;
                        if (ring.life <= 0) {
                            gameContainer.removeChild(ring);
                        }
                    }
                });
            }

            // Halfway through: update background and reposition
            if (transitionFrames >= transitionDuration / 2 && transitionFrames < transitionDuration / 2 + 1) {
                // Clean up any remaining old rings thoroughly
                allRings.forEach(ring => {
                    try {
                        if (ring) {
                            // Clear graphics before destroying
                            if (ring.clear) ring.clear();
                            // Remove from parent if still attached
                            if (ring.parent) {
                                ring.parent.removeChild(ring);
                            }
                            // Destroy the object completely
                            if (ring.destroy) {
                                ring.destroy({ children: true, texture: true, baseTexture: true });
                            }
                        }
                    } catch (e) {
                        // Ignore errors during cleanup
                    }
                });

                // Update background
                const config = LEVEL_CONFIG[gameState.currentLevel];
                createStars();

                // Reposition ship and station to center
                rocket.x = app.screen.width / 2;
                rocket.y = app.screen.height / 2 + 100;
                rocket.vx = 0;
                rocket.vy = 0;

                if (gameState.stationLevel > 0) {
                    station.x = app.screen.width / 2;
                    station.y = app.screen.height / 2;
                }

                // Clear all enemies and their bullets
                for (const enemy of enemies) {
                    gameContainer.removeChild(enemy);
                }
                enemies.length = 0;

                for (const eb of enemyBullets) {
                    gameContainer.removeChild(eb);
                }
                enemyBullets.length = 0;

                // Clear enemy groups
                enemyGroups.length = 0;

                // Clear all resource pieces (prevent carrying over between levels)
                for (const piece of resourcePieces) {
                    gameContainer.removeChild(piece);
                }
                resourcePieces.length = 0;

                // Clear all asteroids
                for (const a of asteroids) {
                    gameContainer.removeChild(a);
                }
                asteroids.length = 0;

                // Respawn asteroids
                for (let i = 0; i < numAsteroids; i++) {
                    createAsteroid({ offscreen: true });
                }

                // Create new teleport effects at new positions
                const newShipRings = createTeleportEffect(rocket.x, rocket.y, 40);
                let newStationRings = [];
                if (gameState.stationLevel > 0) {
                    newStationRings = createTeleportEffect(station.x, station.y, 80);
                }
                newRings = [...newShipRings, ...newStationRings];

                // Create transition message
                createFloatingText(app.screen.width / 2, app.screen.height / 2 - 100,
                    `Entering ${config.name}!`);
            }

            // Fade in ship and station
            if (transitionFrames >= transitionDuration / 2) {
                const fadeProgress = (transitionFrames - transitionDuration / 2) / (transitionDuration / 2);
                rocket.alpha = fadeProgress;
                if (station.visible) station.alpha = fadeProgress;

                // Animate new rings during fade in
                newRings.forEach(ring => {
                    if (ring.parent) {
                        ring.life -= time.deltaTime;
                        ring.scale.set(ring.scale.x + 0.05 * time.deltaTime);
                        ring.alpha = ring.life / ring.maxLife;
                        if (ring.life <= 0) {
                            gameContainer.removeChild(ring);
                        }
                    }
                });
            }

            // End transition
            if (transitionFrames >= transitionDuration) {
                rocket.alpha = 1;
                if (station.visible) station.alpha = 1;

                // Clean up any remaining rings thoroughly
                newRings.forEach(ring => {
                    try {
                        if (ring) {
                            // Clear graphics before destroying
                            if (ring.clear) ring.clear();
                            // Remove from parent if still attached
                            if (ring.parent) {
                                ring.parent.removeChild(ring);
                            }
                            // Destroy the object completely
                            if (ring.destroy) {
                                ring.destroy({ children: true, texture: true, baseTexture: true });
                            }
                        }
                    } catch (e) {
                        // Ignore errors during cleanup
                    }
                });

                app.ticker.remove(transitionTicker);
                updateGoalProgress();
            }
        };

        app.ticker.add(transitionTicker);
    }

    // Input handling
    const keys = {};
    let mousePressed = false;
    let cursorX = app.screen.width / 2;
    let cursorY = app.screen.height / 2;

    // Request pointer lock on click
    app.canvas.addEventListener('click', () => {
        if (!document.pointerLockElement) {
            app.canvas.requestPointerLock();
        }
    });

    // Track pointer lock state
    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement === app.canvas) {
            // Pointer is locked
            app.canvas.style.cursor = 'none';
        } else {
            // Pointer is unlocked
            app.canvas.style.cursor = 'default';
        }
    });

    // Handle mouse movement (both locked and unlocked)
    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === app.canvas) {
            // Locked mode: use movement deltas
            cursorX += e.movementX;
            cursorY += e.movementY;

            // Clamp cursor to screen bounds
            cursorX = Math.max(0, Math.min(app.screen.width, cursorX));
            cursorY = Math.max(0, Math.min(app.screen.height, cursorY));
        } else {
            // Unlocked mode: use absolute position
            const rect = app.canvas.getBoundingClientRect();
            cursorX = e.clientX - rect.left;
            cursorY = e.clientY - rect.top;
        }
    });

    // Handle mouse button for shooting
    document.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // Left mouse button
            mousePressed = true;
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (e.button === 0) { // Left mouse button
            mousePressed = false;
        }
    });

    document.addEventListener('keydown', (e) => {
        keys[e.key] = true;

        // ESC to unlock pointer
        if (e.code === 'Escape' && document.pointerLockElement) {
            document.exitPointerLock();
        }

        // Missile firing with DELETE or B key
        if (e.code === 'Delete' || e.code === 'KeyB') {
            fireMissile();
        }

        // Keyboard shortcuts for upgrades
        if (e.code === 'Digit1' || e.code === 'Numpad1') {
            shipUpgradeBtn.click();
        }
        if (e.code === 'Digit2' || e.code === 'Numpad2') {
            stationLevelBtn.click();
        }
        if (e.code === 'Digit3' || e.code === 'Numpad3') {
            stationGunBtn.click();
        }
    });
    document.addEventListener('keyup', (e) => keys[e.key] = false);

    // Game loop
    let lastResources = resources; // Track resource changes
    app.ticker.add((time) => {
        // Ship rotation - Face cursor
        const dx = cursorX - rocket.x;
        const dy = cursorY - rocket.y;
        const distanceToCursor = Math.sqrt(dx * dx + dy * dy);
        const angleToTarget = Math.atan2(dy, dx);

        // Rotate ship towards cursor
        let angleDiff = angleToTarget - rocket.rotation;
        // Normalize angle difference to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // Smooth rotation
        const rotationAmount = Math.min(Math.abs(angleDiff), rocket.rotationSpeed * time.deltaTime);
        if (angleDiff > 0) {
            rocket.rotation += rotationAmount;
        } else {
            rocket.rotation -= rotationAmount;
        }

        // Manual thrust control with Space or Backspace
        const thrustPressed = keys[' '] || keys['Backspace'];

        if (thrustPressed) {
            // Apply thrust in the direction ship is facing
            rocket.vx += Math.cos(rocket.rotation) * rocket.thrust * time.deltaTime;
            rocket.vy += Math.sin(rocket.rotation) * rocket.thrust * time.deltaTime;
            rocketEngine.visible = true;
        } else {
            rocketEngine.visible = false;
        }

        // Continuous shooting while mouse is pressed
        if (mousePressed) {
            shoot();
        }

        // Rocket physics
        const newX = rocket.x + rocket.vx * time.deltaTime;
        const newY = rocket.y + rocket.vy * time.deltaTime;

        // Clamp to screen boundaries
        if (newX < 0) {
            rocket.x = 0;
            rocket.vx = 0; // Stop horizontal movement
        } else if (newX > app.screen.width) {
            rocket.x = app.screen.width;
            rocket.vx = 0; // Stop horizontal movement
        } else {
            rocket.x = newX;
        }

        if (newY < 0) {
            rocket.y = 0;
            rocket.vy = 0; // Stop vertical movement
        } else if (newY > app.screen.height) {
            rocket.y = app.screen.height;
            rocket.vy = 0; // Stop vertical movement
        } else {
            rocket.y = newY;
        }

        // Apply damping only if not at boundary
        // Stronger damping when not thrusting for quicker stops
        const dampingFactor = thrustPressed ? 0.99 : 0.96;
        if (rocket.x > 0 && rocket.x < app.screen.width) {
            rocket.vx *= dampingFactor;
        }
        if (rocket.y > 0 && rocket.y < app.screen.height) {
            rocket.vy *= dampingFactor;
        }

        // Station rotation
        if (station.visible) station.rotation += 0.005 * time.deltaTime;

        // Station special abilities
        if (gameState.stationLevel >= 4) {
            // Level 4+: Defense Grid - reduces asteroid damage to station
            // (handled in collision damage calculation)
        }

        if (gameState.stationLevel >= 6) {
            // Level 6+: Research Lab - slowly regenerates ship health
            if (gameState.ship.health < gameState.ship.maxHealth) {
                gameState.ship.health = Math.min(
                    gameState.ship.maxHealth,
                    gameState.ship.health + 0.1 * time.deltaTime
                );
            }
        }

        if (gameState.stationLevel >= 9) {
            // Level 9+: Production Facility - passive resource generation
            const now = Date.now();
            if (now - lastProductionTime > 2000) { // Every 2 seconds
                const production = gameState.stationLevel - 8; // 1 resource/2sec at level 9, 2 at level 10
                resources += production;
                createFloatingText(station.x, station.y + 40, `+${production}`);
                lastProductionTime = now;
            }
        }

        // Missile ammo regeneration (1 missile every 5 seconds)
        const missileRegenTime = Date.now();
        if (missileRegenTime - lastMissileRegenTime > 5000 && gameState.ship.missiles < gameState.ship.maxMissiles) {
            gameState.ship.missiles++;
            upgradeUIUpdate = true;
            lastMissileRegenTime = missileRegenTime;
        }

        // Station guns - auto-target and shoot (prioritize enemies over asteroids)
        if (gameState.stationGunLevel > 0 && gameState.stationLevel >= 1) {
            const now = Date.now();
            const stationFireRate = Math.max(300, 1000 - gameState.stationGunLevel * 70); // Level 1: 930ms, Level 10: 300ms

            if (now - lastStationShotTime > stationFireRate) {
                const stationRange = 200 + gameState.stationGunLevel * 20; // Level 1: 220px, Level 10: 400px
                let target = null;
                let nearestDistance = stationRange;

                // First priority: Find nearest enemy ship within range
                for (const enemy of enemies) {
                    const dx = enemy.x - station.x;
                    const dy = enemy.y - station.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < nearestDistance) {
                        nearestDistance = dist;
                        target = enemy;
                    }
                }

                // Second priority: If no enemies, target nearest asteroid
                if (!target) {
                    for (const a of asteroids) {
                        const dx = a.x - station.x;
                        const dy = a.y - station.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < nearestDistance) {
                            nearestDistance = dist;
                            target = a;
                        }
                    }
                }

                if (target) {
                    lastStationShotTime = now;

                    // Calculate angle to target
                    const angle = Math.atan2(target.y - station.y, target.x - station.x);

                    // Number of bullets based on gun level
                    const numStationBullets = Math.min(1 + Math.floor(gameState.stationGunLevel / 2), 6); // 1-6 bullets

                    // Bullet properties based on station gun level
                    const stationBulletSpeed = 6 + gameState.stationGunLevel * 0.4;
                    const stationBulletSize = 3 + gameState.stationGunLevel * 0.3;
                    const stationBulletDamage = gameState.stationGunLevel;

                    // Bullet color progression
                    let stationBulletColor = 0xff0000; // Red
                    if (gameState.stationGunLevel >= 3) stationBulletColor = 0xff8800; // Orange
                    if (gameState.stationGunLevel >= 5) stationBulletColor = 0xffff00; // Yellow
                    if (gameState.stationGunLevel >= 7) stationBulletColor = 0x00ff00; // Green
                    if (gameState.stationGunLevel >= 9) stationBulletColor = 0x00ffff; // Cyan

                    for (let i = 0; i < numStationBullets; i++) {
                        const spreadAngle = (i - (numStationBullets - 1) / 2) * 0.1;
                        const finalAngle = angle + spreadAngle;

                        const sb = new PIXI.Graphics().circle(0, 0, stationBulletSize).fill(stationBulletColor);
                        sb.x = station.x + Math.cos(finalAngle) * 40;
                        sb.y = station.y + Math.sin(finalAngle) * 40;
                        sb.vx = Math.cos(finalAngle) * stationBulletSpeed;
                        sb.vy = Math.sin(finalAngle) * stationBulletSpeed;
                        sb.life = 120; // Longer lifetime
                        sb.damage = stationBulletDamage;

                        // Level 6+: Splash damage
                        if (gameState.stationGunLevel >= 6) {
                            sb.splashRadius = 15 + (gameState.stationGunLevel - 6) * 5; // 15-35px
                        }

                        gameContainer.addChild(sb);
                        stationBullets.push(sb);
                    }
                }
            }
        }

        // Update bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.x += b.vx * time.deltaTime;
            b.y += b.vy * time.deltaTime;
            b.life -= time.deltaTime;

            // Remove if off-screen or lifetime expired
            if (b.life <= 0 || b.x < -50 || b.x > app.screen.width + 50 || b.y < -50 || b.y > app.screen.height + 50) {
                gameContainer.removeChild(b);
                bullets.splice(i, 1);
                continue;
            }

            // Bullet-Asteroid Collision
            for (let j = asteroids.length - 1; j >= 0; j--) {
                const a = asteroids[j];
                const bulletRadius = 2 + (b.damage || 1) * 0.4;
                if (checkCollision(b, a, bulletRadius, a.r)) {
                    // Hit!
                    const hitX = b.x;
                    const hitY = b.y;
                    const hasSplash = b.splashRadius && b.splashRadius > 0;

                    gameContainer.removeChild(b);
                    bullets.splice(i, 1);

                    // Process hit asteroid
                    const processAsteroid = (asteroid, index) => {
                        // Higher gun levels can instantly destroy larger asteroids
                        const canDestroy = b.damage >= 3 || asteroid.r <= 15;

                        // Split or destroy asteroid and drop resources
                        if (!canDestroy && asteroid.r > 15) {
                            // Split into smaller asteroids
                            const newSize = asteroid.r / 2;
                            createAsteroid({ x: asteroid.x, y: asteroid.y, r: newSize });
                            createAsteroid({ x: asteroid.x, y: asteroid.y, r: newSize });
                        } else {
                            // Destroy and drop resource pieces
                            let resourceBonus = 1;
                            if (b.damage >= 4) resourceBonus = 1.5;
                            if (b.damage >= 8) resourceBonus = 2.0; // Quantum and above
                            if (b.damage >= 10) resourceBonus = 3.0; // Singularity

                            const numPieces = Math.floor((asteroid.resources * resourceBonus) / 3) + 1;
                            for (let k = 0; k < numPieces; k++) {
                                createResourcePiece(asteroid.x, asteroid.y, Math.floor((asteroid.resources * resourceBonus) / numPieces));
                            }
                        }

                        gameContainer.removeChild(asteroid);
                        asteroids.splice(index, 1);
                    };

                    processAsteroid(a, j);

                    // Splash damage for level 7+ (Ion Pulse and higher)
                    if (hasSplash) {
                        for (let k = asteroids.length - 1; k >= 0; k--) {
                            const otherAsteroid = asteroids[k];
                            const dx = hitX - otherAsteroid.x;
                            const dy = hitY - otherAsteroid.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);

                            if (dist < b.splashRadius) {
                                processAsteroid(otherAsteroid, k);
                            }
                        }
                    }

                    // Keep total asteroids constant
                    while (asteroids.length < numAsteroids) createAsteroid({ offscreen: true });
                    break; // Bullet gone
                }
            }
        }

        // Update station bullets
        for (let i = stationBullets.length - 1; i >= 0; i--) {
            const sb = stationBullets[i];
            sb.x += sb.vx * time.deltaTime;
            sb.y += sb.vy * time.deltaTime;
            sb.life -= time.deltaTime;

            // Remove if off-screen or lifetime expired
            if (sb.life <= 0 || sb.x < -50 || sb.x > app.screen.width + 50 || sb.y < -50 || sb.y > app.screen.height + 50) {
                gameContainer.removeChild(sb);
                stationBullets.splice(i, 1);
                continue;
            }

            // Station Bullet-Asteroid Collision
            for (let j = asteroids.length - 1; j >= 0; j--) {
                const a = asteroids[j];
                const stationBulletRadius = 3 + (sb.damage || 1) * 0.3;
                if (checkCollision(sb, a, stationBulletRadius, a.r)) {
                    // Hit!
                    const hitX = sb.x;
                    const hitY = sb.y;
                    const hasSplash = sb.splashRadius && sb.splashRadius > 0;

                    gameContainer.removeChild(sb);
                    stationBullets.splice(i, 1);

                    // Process hit asteroid
                    const processAsteroid = (asteroid, index) => {
                        const canDestroy = sb.damage >= 3 || asteroid.r <= 15;

                        if (!canDestroy && asteroid.r > 15) {
                            const newSize = asteroid.r / 2;
                            createAsteroid({ x: asteroid.x, y: asteroid.y, r: newSize });
                            createAsteroid({ x: asteroid.x, y: asteroid.y, r: newSize });
                        } else {
                            let resourceBonus = 1;
                            if (sb.damage >= 4) resourceBonus = 1.5;
                            if (sb.damage >= 7) resourceBonus = 2.0;
                            if (sb.damage >= 10) resourceBonus = 2.5;

                            const numPieces = Math.floor((asteroid.resources * resourceBonus) / 3) + 1;
                            for (let k = 0; k < numPieces; k++) {
                                createResourcePiece(asteroid.x, asteroid.y, Math.floor((asteroid.resources * resourceBonus) / numPieces));
                            }
                        }

                        gameContainer.removeChild(asteroid);
                        asteroids.splice(index, 1);
                    };

                    processAsteroid(a, j);

                    // Splash damage for level 6+ station guns
                    if (hasSplash) {
                        for (let k = asteroids.length - 1; k >= 0; k--) {
                            const otherAsteroid = asteroids[k];
                            const dx = hitX - otherAsteroid.x;
                            const dy = hitY - otherAsteroid.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);

                            if (dist < sb.splashRadius) {
                                processAsteroid(otherAsteroid, k);
                            }
                        }
                    }

                    while (asteroids.length < numAsteroids) createAsteroid({ offscreen: true });
                    break;
                }
            }
        }

        // Update missiles
        for (let i = missiles.length - 1; i >= 0; i--) {
            const m = missiles[i];
            m.x += m.vx * time.deltaTime;
            m.y += m.vy * time.deltaTime;
            m.life -= time.deltaTime;

            // Remove if off-screen or lifetime expired
            if (m.life <= 0 || m.x < -100 || m.x > app.screen.width + 100 || m.y < -100 || m.y > app.screen.height + 100) {
                gameContainer.removeChild(m);
                missiles.splice(i, 1);
                continue;
            }

            // Check proximity to enemies
            let shouldExplode = false;
            let explodeX = m.x;
            let explodeY = m.y;

            for (let j = 0; j < enemies.length; j++) {
                const e = enemies[j];
                const dx = m.x - e.x;
                const dy = m.y - e.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < m.proximityRadius) {
                    shouldExplode = true;
                    explodeX = m.x;
                    explodeY = m.y;
                    break;
                }
            }

            // Check proximity to asteroids if no enemy found
            if (!shouldExplode) {
                for (let j = 0; j < asteroids.length; j++) {
                    const a = asteroids[j];
                    const dx = m.x - a.x;
                    const dy = m.y - a.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < m.proximityRadius) {
                        shouldExplode = true;
                        explodeX = m.x;
                        explodeY = m.y;
                        break;
                    }
                }
            }

            if (shouldExplode) {
                // Create large explosion
                createMissileExplosion(explodeX, explodeY, m.explosionRadius);

                // Apply damage to all enemies in explosion radius
                for (let j = enemies.length - 1; j >= 0; j--) {
                    const e = enemies[j];
                    if (!e) continue; // Skip if enemy was removed

                    const dx = explodeX - e.x;
                    const dy = explodeY - e.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < m.explosionRadius) {
                        e.health -= m.damage;
                        updateEnemyHealthBar(e);

                        if (e.health <= 0) {
                            // Boss defeated?
                            if (e.isBoss) {
                                handleBossDefeat(e);
                                // handleBossDefeat removes all enemies, so break out of loop
                                break;
                            } else {
                                // Drop resources from enemy
                                const numPieces = Math.floor(Math.random() * 3) + 3;
                                const totalResources = e.size * 3;
                                for (let k = 0; k < numPieces; k++) {
                                    createResourcePiece(e.x, e.y, Math.floor(totalResources / numPieces));
                                }
                                createExplosion(e.x, e.y, e.size);
                            }

                            gameContainer.removeChild(e);
                            enemies.splice(j, 1);
                        }
                    }
                }

                // Apply damage to all asteroids in explosion radius
                for (let j = asteroids.length - 1; j >= 0; j--) {
                    const a = asteroids[j];
                    if (!a) continue; // Skip if asteroid was removed

                    const dx = explodeX - a.x;
                    const dy = explodeY - a.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < m.explosionRadius) {
                        // Missiles always destroy asteroids completely
                        const resourceBonus = 2.0; // Missiles give 2x resources
                        const numPieces = Math.floor((a.resources * resourceBonus) / 3) + 1;
                        for (let k = 0; k < numPieces; k++) {
                            createResourcePiece(a.x, a.y, Math.floor((a.resources * resourceBonus) / numPieces));
                        }

                        gameContainer.removeChild(a);
                        asteroids.splice(j, 1);
                    }
                }

                // Keep total asteroids constant
                while (asteroids.length < numAsteroids) createAsteroid({ offscreen: true });

                // Remove missile
                gameContainer.removeChild(m);
                missiles.splice(i, 1);
            }
        }

        // Update asteroids
        for (let i = asteroids.length - 1; i >= 0; i--) {
            const a = asteroids[i];
            a.x += a.vx * time.deltaTime;
            a.y += a.vy * time.deltaTime;
            a.rotation += a.rotationSpeed * time.deltaTime;

            // Remove if far off-screen and spawn a new one
            const margin = 100;
            if (a.x < -margin || a.x > app.screen.width + margin || a.y < -margin || a.y > app.screen.height + margin) {
                gameContainer.removeChild(a);
                asteroids.splice(i, 1);
                createAsteroid({ offscreen: true }); // Spawn new asteroid offscreen
                continue;
            }

            let hitSomething = false;
            let hitPosition = null;

            // Ship-Asteroid Collision - Causes Damage
            if (checkCollision(rocket, a, rocket.r, a.r)) {
                gameState.ship.health -= a.r * 0.5; // Damage based on asteroid size
                hitSomething = true;
                hitPosition = { x: a.x, y: a.y };
            }

            // Station-Asteroid Collision - Causes Damage
            if (!hitSomething && gameState.stationLevel >= 1) {
                if (checkCollision(station, a, station.r, a.r)) {
                    // Defense Grid reduces damage (Level 4+)
                    const defenseMultiplier = gameState.stationLevel >= 4 ? 0.3 : 1.0;
                    gameState.stationHealth -= a.r * 0.5 * defenseMultiplier;
                    hitSomething = true;
                    hitPosition = { x: a.x, y: a.y };
                }
            }

            // Enemy-Asteroid Collision - Causes Damage
            if (!hitSomething) {
                for (let j = enemies.length - 1; j >= 0; j--) {
                    const enemy = enemies[j];
                    if (checkCollision(enemy, a, enemy.r, a.r)) {
                        enemy.health -= a.r * 0.5; // Damage based on asteroid size
                        updateEnemyHealthBar(enemy);
                        hitSomething = true;
                        hitPosition = { x: a.x, y: a.y };

                        // Check if enemy destroyed
                        if (enemy.health <= 0) {
                            createExplosion(enemy.x, enemy.y, enemy.size);

                            // Check if this was a boss
                            if (enemy.isBoss) {
                                // Boss drops 10x resources
                                const bossResourceDrop = Math.floor(enemy.size * 30);
                                const numPieces = 15 + Math.floor(enemy.size / 5);
                                for (let k = 0; k < numPieces; k++) {
                                    createResourcePiece(enemy.x, enemy.y, Math.floor(bossResourceDrop / numPieces));
                                }
                                gameContainer.removeChild(enemy);
                                enemies.splice(j, 1);

                                // Handle boss defeat - destroy all enemies
                                handleBossDefeat(enemy.x, enemy.y, enemy.enemyType);
                            } else {
                                // Regular enemy drop
                                const resourceDrop = Math.floor(enemy.size * 3);
                                const numPieces = 3 + Math.floor(enemy.size / 10);
                                for (let k = 0; k < numPieces; k++) {
                                    createResourcePiece(enemy.x, enemy.y, Math.floor(resourceDrop / numPieces));
                                }
                                gameContainer.removeChild(enemy);
                                enemies.splice(j, 1);
                            }
                        }
                        break;
                    }
                }
            }

            if (hitSomething) {
                // Create explosion effect
                createExplosion(hitPosition.x, hitPosition.y, a.r);

                // Drop small amount of resources (5x less than shooting)
                const collisionResources = Math.floor(a.resources / 5);
                if (collisionResources > 0) {
                    const numPieces = Math.max(1, Math.floor(collisionResources / 2));
                    for (let k = 0; k < numPieces; k++) {
                        createResourcePiece(hitPosition.x, hitPosition.y, Math.floor(collisionResources / numPieces));
                    }
                }

                gameContainer.removeChild(a);
                asteroids.splice(i, 1);
                createAsteroid({ offscreen: true }); // Spawn new offscreen
            }
        }

        // Spawn enemies periodically - scale based on defensive strength
        const now = Date.now();
        // Calculate defensive strength: ship guns + station guns
        const defensiveStrength = gameState.ship.gunLevel + gameState.stationGunLevel;

        // Base spawn interval: 20s when weak (gun levels 0-2), decreasing to 3s when very strong (combined level 20)
        // Weak defenses (0-2): 20s-16s per enemy
        // Medium defenses (3-10): 16s-8s per enemy
        // Strong defenses (11-20): 8s-3s per enemy
        const baseInterval = 20000; // 20 seconds
        const minInterval = 3000; // 3 seconds
        const reductionPerLevel = 850; // ms reduced per combined gun level

        const enemySpawnInterval = Math.max(minInterval, baseInterval - defensiveStrength * reductionPerLevel);

        if (now - lastEnemySpawnTime > enemySpawnInterval) {
            createEnemyGroup();
            lastEnemySpawnTime = now;
        }

        // Update enemy groups
        for (let i = enemyGroups.length - 1; i >= 0; i--) {
            const active = updateGroupAI(enemyGroups[i], time);
            if (!active) {
                enemyGroups.splice(i, 1);
            }
        }

        // Update enemies with group behavior
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];

            // Find enemy's group
            const group = enemyGroups.find(g => g.id === enemy.groupId);

            // Determine target and movement based on group state or individual behavior (bosses)
            let target = null;
            let targetX, targetY;

            if (enemy.isBoss || !group) {
                // Bosses and solo enemies use old behavior
                const distToShip = Math.sqrt((enemy.x - rocket.x) ** 2 + (enemy.y - rocket.y) ** 2);
                const distToStation = gameState.stationLevel > 0 ?
                    Math.sqrt((enemy.x - station.x) ** 2 + (enemy.y - station.y) ** 2) : Infinity;

                if (distToShip < 400 || distToStation === Infinity) {
                    target = rocket;
                } else {
                    target = station;
                }
                targetX = target.x;
                targetY = target.y;
            } else {
                // Group members follow group behavior
                switch (group.state) {
                    case 'approaching':
                    case 'attacking':
                        // Move towards group target while maintaining formation
                        targetX = group.targetX + enemy.formationOffset.x;
                        targetY = group.targetY + enemy.formationOffset.y;
                        break;

                    case 'retreating':
                        // Move towards retreat point
                        targetX = group.retreatX + enemy.formationOffset.x;
                        targetY = group.retreatY + enemy.formationOffset.y;
                        break;

                    case 'regrouping':
                        // Move to formation position around group center
                        targetX = group.centerX + enemy.formationOffset.x;
                        targetY = group.centerY + enemy.formationOffset.y;
                        break;
                }
            }

            // Move towards target
            const dx = targetX - enemy.x;
            const dy = targetY - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Movement speed varies by group state
            let moveSpeed = enemy.speed;
            if (group) {
                if (group.state === 'retreating') {
                    moveSpeed *= 1.3; // Faster retreat
                } else if (group.state === 'regrouping') {
                    moveSpeed *= 0.7; // Slower regrouping
                }
            }

            if (dist > 50) { // Move towards target
                enemy.x += (dx / dist) * moveSpeed * time.deltaTime;
                enemy.y += (dy / dist) * moveSpeed * time.deltaTime;
            }

            // Determine actual combat target for rotation and firing
            const distToShip = Math.sqrt((enemy.x - rocket.x) ** 2 + (enemy.y - rocket.y) ** 2);
            const distToStation = gameState.stationLevel > 0 ?
                Math.sqrt((enemy.x - station.x) ** 2 + (enemy.y - station.y) ** 2) : Infinity;

            if (distToShip < 400 || distToStation === Infinity) {
                target = rocket;
            } else {
                target = station;
            }

            // Rotate to face combat target
            const targetDx = target.x - enemy.x;
            const targetDy = target.y - enemy.y;
            enemy.rotation = Math.atan2(targetDy, targetDx);

            // Fire at target if in range and in attacking state (or boss/solo)
            const fireRange = 350;
            const distToCombatTarget = Math.sqrt(targetDx * targetDx + targetDy * targetDy);
            const canFire = enemy.isBoss || !group || group.state === 'attacking' || group.state === 'approaching';

            if (distToCombatTarget < fireRange && canFire) {
                const now = Date.now();

                // Boss burst firing logic
                if (enemy.isBoss) {
                    if (enemy.burstCooldown > 0) {
                        enemy.burstCooldown -= time.deltaTime * 16.67; // Convert to ms
                    } else if (enemy.burstShotsFired < enemy.burstCount) {
                        if (now - enemy.lastShotTime > 100) { // Rapid burst shots
                            enemy.lastShotTime = now;
                            enemy.burstShotsFired++;

                            // Boss fires multiple bullets in a spread
                            for (let b = 0; b < 3; b++) {
                                const angleToTarget = Math.atan2(targetDy, targetDx);
                                const spreadAngle = (b - 1) * 0.15;
                                const inaccuracy = (Math.random() - 0.5) * enemy.accuracy;
                                const finalAngle = angleToTarget + spreadAngle + inaccuracy;

                                const eb = new PIXI.Graphics().circle(0, 0, 5).fill(0xff0000);
                                eb.x = enemy.x + Math.cos(enemy.rotation) * enemy.size;
                                eb.y = enemy.y + Math.sin(enemy.rotation) * enemy.size;
                                eb.vx = Math.cos(finalAngle) * 5;
                                eb.vy = Math.sin(finalAngle) * 5;
                                eb.life = 150;
                                eb.damage = enemy.damage;
                                eb.r = 5;

                                gameContainer.addChild(eb);
                                enemyBullets.push(eb);
                            }

                            // Check if burst is complete
                            if (enemy.burstShotsFired >= enemy.burstCount) {
                                enemy.burstShotsFired = 0;
                                enemy.burstCooldown = enemy.fireRate;
                            }
                        }
                    }
                } else {
                    // Regular enemy firing
                    if (now - enemy.lastShotTime > enemy.fireRate) {
                        enemy.lastShotTime = now;

                        // Calculate angle with inaccuracy
                        const angleToTarget = Math.atan2(targetDy, targetDx);
                        const inaccuracy = (Math.random() - 0.5) * enemy.accuracy;
                        const finalAngle = angleToTarget + inaccuracy;

                        // Create enemy bullet with type-specific damage
                        const eb = new PIXI.Graphics().circle(0, 0, 3).fill(0xff4444);
                        eb.x = enemy.x + Math.cos(enemy.rotation) * enemy.size;
                        eb.y = enemy.y + Math.sin(enemy.rotation) * enemy.size;
                        eb.vx = Math.cos(finalAngle) * 4;
                        eb.vy = Math.sin(finalAngle) * 4;
                        eb.life = 120;
                        eb.damage = enemy.damage;
                        eb.r = 3;

                        gameContainer.addChild(eb);
                        enemyBullets.push(eb);
                    }
                }
            }

            // Remove if too far off-screen (except bosses - they should stay in play)
            const margin = 200;
            if (!enemy.isBoss && (enemy.x < -margin || enemy.x > app.screen.width + margin ||
                enemy.y < -margin || enemy.y > app.screen.height + margin)) {
                gameContainer.removeChild(enemy);
                enemies.splice(i, 1);
            }
        }

        // Update enemy bullets
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            const eb = enemyBullets[i];
            eb.x += eb.vx * time.deltaTime;
            eb.y += eb.vy * time.deltaTime;
            eb.life -= time.deltaTime;

            // Remove if off-screen or expired
            if (eb.life <= 0 || eb.x < -50 || eb.x > app.screen.width + 50 ||
                eb.y < -50 || eb.y > app.screen.height + 50) {
                gameContainer.removeChild(eb);
                enemyBullets.splice(i, 1);
                continue;
            }

            // Check collision with player ship
            if (checkCollision(eb, rocket, eb.r, rocket.r)) {
                gameState.ship.health -= eb.damage;
                createExplosion(eb.x, eb.y, 5);
                gameContainer.removeChild(eb);
                enemyBullets.splice(i, 1);
                continue;
            }

            // Check collision with station
            if (gameState.stationLevel > 0 && checkCollision(eb, station, eb.r, station.r)) {
                gameState.stationHealth -= eb.damage;
                createExplosion(eb.x, eb.y, 5);
                gameContainer.removeChild(eb);
                enemyBullets.splice(i, 1);
            }
        }

        // Check player/station bullets hitting enemies
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            for (let j = enemies.length - 1; j >= 0; j--) {
                const enemy = enemies[j];
                if (checkCollision(b, enemy, 2, enemy.r)) {
                    enemy.health -= b.damage * 5; // Player bullets more effective
                    updateEnemyHealthBar(enemy);
                    createExplosion(b.x, b.y, 5);

                    gameContainer.removeChild(b);
                    bullets.splice(i, 1);

                    if (enemy.health <= 0) {
                        createExplosion(enemy.x, enemy.y, enemy.size);

                        // Check if this was a boss
                        if (enemy.isBoss) {
                            // Boss drops 10x resources
                            const bossResourceDrop = Math.floor(enemy.size * 30);
                            const numPieces = 15 + Math.floor(enemy.size / 5);
                            for (let k = 0; k < numPieces; k++) {
                                createResourcePiece(enemy.x, enemy.y, Math.floor(bossResourceDrop / numPieces));
                            }
                            gameContainer.removeChild(enemy);
                            enemies.splice(j, 1);

                            // Handle boss defeat - destroy all enemies
                            handleBossDefeat(enemy.x, enemy.y, enemy.enemyType);
                        } else {
                            // Regular enemy drop
                            const resourceDrop = Math.floor(enemy.size * 3);
                            const numPieces = 3 + Math.floor(enemy.size / 10);
                            for (let k = 0; k < numPieces; k++) {
                                createResourcePiece(enemy.x, enemy.y, Math.floor(resourceDrop / numPieces));
                            }
                            gameContainer.removeChild(enemy);
                            enemies.splice(j, 1);
                        }
                    }
                    break;
                }
            }
        }

        // Check station bullets hitting enemies
        for (let i = stationBullets.length - 1; i >= 0; i--) {
            const sb = stationBullets[i];
            for (let j = enemies.length - 1; j >= 0; j--) {
                const enemy = enemies[j];
                if (checkCollision(sb, enemy, 3, enemy.r)) {
                    enemy.health -= sb.damage * 3;
                    updateEnemyHealthBar(enemy);
                    createExplosion(sb.x, sb.y, 5);

                    gameContainer.removeChild(sb);
                    stationBullets.splice(i, 1);

                    if (enemy.health <= 0) {
                        createExplosion(enemy.x, enemy.y, enemy.size);

                        // Check if this was a boss
                        if (enemy.isBoss) {
                            // Boss drops 10x resources
                            const bossResourceDrop = Math.floor(enemy.size * 30);
                            const numPieces = 15 + Math.floor(enemy.size / 5);
                            for (let k = 0; k < numPieces; k++) {
                                createResourcePiece(enemy.x, enemy.y, Math.floor(bossResourceDrop / numPieces));
                            }
                            gameContainer.removeChild(enemy);
                            enemies.splice(j, 1);

                            // Handle boss defeat - destroy all enemies
                            handleBossDefeat(enemy.x, enemy.y, enemy.enemyType);
                        } else {
                            // Regular enemy drop
                            const resourceDrop = Math.floor(enemy.size * 3);
                            const numPieces = 3 + Math.floor(enemy.size / 10);
                            for (let k = 0; k < numPieces; k++) {
                                createResourcePiece(enemy.x, enemy.y, Math.floor(resourceDrop / numPieces));
                            }
                            gameContainer.removeChild(enemy);
                            enemies.splice(j, 1);
                        }
                    }
                    break;
                }
            }
        }

        // Update resource pieces
        for (let i = resourcePieces.length - 1; i >= 0; i--) {
            const piece = resourcePieces[i];

            // Check if ship is nearby to pull it in
            let dx = rocket.x - piece.x;
            let dy = rocket.y - piece.y;
            let distance = Math.sqrt(dx * dx + dy * dy);

            // Enhanced pull radius during resource collection phase
            const shipPullRadius = resourceCollectionPhase ? piece.pullRadius * 3 : piece.pullRadius;

            if (distance < shipPullRadius) {
                // Pull toward ship (stronger during collection phase)
                const pullStrength = resourceCollectionPhase ? 0.6 : 0.3;
                piece.vx += (dx / distance) * pullStrength * time.deltaTime;
                piece.vy += (dy / distance) * pullStrength * time.deltaTime;
            }

            // Check if station can pull it in (requires station level 2+)
            if (gameState.stationLevel >= 2) {
                // Pull radius: Level 2: 100px, Level 10: 340px
                const basePullRadius = 100 + Math.min(gameState.stationLevel - 2, 8) * 30;
                const stationPullRadius = resourceCollectionPhase ? basePullRadius * 2 : basePullRadius;
                const sdx = station.x - piece.x;
                const sdy = station.y - piece.y;
                const stationDistance = Math.sqrt(sdx * sdx + sdy * sdy);

                if (stationDistance < stationPullRadius) {
                    // Pull toward station (stronger than ship pull, increases with level)
                    const basePullStrength = 0.5 + (gameState.stationLevel - 2) * 0.05;
                    const stationPullStrength = resourceCollectionPhase ? basePullStrength * 1.5 : basePullStrength;
                    piece.vx += (sdx / stationDistance) * stationPullStrength * time.deltaTime;
                    piece.vy += (sdy / stationDistance) * stationPullStrength * time.deltaTime;
                }
            }

            // Realistic space physics - constant velocity drift (no damping)
            piece.x += piece.vx * time.deltaTime;
            piece.y += piece.vy * time.deltaTime;

            // Update lifetime and handle fading
            piece.lifetime += time.deltaTime;

            // Fade out after 30 seconds (1800 frames)
            if (piece.lifetime > piece.fadeStartTime) {
                const fadeProgress = (piece.lifetime - piece.fadeStartTime) / (piece.maxLifetime - piece.fadeStartTime);
                piece.alpha = 1 - fadeProgress; // Fade from 1.0 to 0.0
            }

            // Remove if lifetime exceeded (60 seconds)
            if (piece.lifetime >= piece.maxLifetime) {
                gameContainer.removeChild(piece);
                resourcePieces.splice(i, 1);
                continue;
            }

            // Remove if off-screen
            const margin = 50;
            if (piece.x < -margin || piece.x > app.screen.width + margin || piece.y < -margin || piece.y > app.screen.height + margin) {
                gameContainer.removeChild(piece);
                resourcePieces.splice(i, 1);
                continue;
            }

            // Check if collected by ship
            if (checkCollision(rocket, piece, rocket.r, piece.r)) {
                resources += piece.value;
                createFloatingText(piece.x, piece.y, `+${piece.value}`);
                gameContainer.removeChild(piece);
                resourcePieces.splice(i, 1);
                continue;
            }

            // Check if collected by station
            if (gameState.stationLevel >= 1 && checkCollision(station, piece, 30, piece.r)) {
                resources += piece.value;
                createFloatingText(piece.x, piece.y, `+${piece.value}`);
                gameContainer.removeChild(piece);
                resourcePieces.splice(i, 1);
            }
        }

        // Update floating texts
        for (let i = floatingTexts.length - 1; i >= 0; i--) {
            const txt = floatingTexts[i];
            txt.y += txt.vy * time.deltaTime;
            txt.life -= time.deltaTime;
            txt.alpha = txt.life / 60;

            if (txt.life <= 0) {
                gameContainer.removeChild(txt);
                floatingTexts.splice(i, 1);
            }
        }

        // Update explosions
        for (let i = explosions.length - 1; i >= 0; i--) {
            const particle = explosions[i];
            particle.x += particle.vx * time.deltaTime;
            particle.y += particle.vy * time.deltaTime;
            particle.life -= time.deltaTime;

            // Fade out and slow down
            particle.alpha = particle.life / particle.maxLife;
            particle.vx *= 0.95;
            particle.vy *= 0.95;

            // Scale shockwave rings (for missile explosions)
            if (particle.maxScale) {
                const progress = 1 - (particle.life / particle.maxLife);
                particle.scale.set(1 + progress * particle.maxScale);
            }

            if (particle.life <= 0) {
                gameContainer.removeChild(particle);
                explosions.splice(i, 1);
            }
        }

        // Check ship destruction
        if (gameState.ship.health <= 0) {
            gameState.ship.health = 0;
            // Ship destroyed - respawn at center
            rocket.x = app.screen.width / 2;
            rocket.y = app.screen.height / 2 + 100;
            rocket.vx = 0;
            rocket.vy = 0;
            gameState.ship.health = gameState.ship.maxHealth;
            createFloatingText(rocket.x, rocket.y, 'Ship Destroyed!');
        }

        // Check station destruction
        if (gameState.stationLevel > 0 && gameState.stationHealth <= 0) {
            gameState.stationHealth = 0;
            gameState.stationLevel = 0;
            station.visible = false;
            station.removeChildren();
            createFloatingText(station.x, station.y, 'Station Destroyed!');
            upgradeUIUpdate = true;
        }

        // Update UI
        levelNameSpan.textContent = LEVEL_CONFIG[gameState.currentLevel].name;
        resourceCountSpan.textContent = resources;

        // Update ship health
        const shipHealthPercent = (gameState.ship.health / gameState.ship.maxHealth) * 100;
        shipHealthSpan.textContent = `${Math.ceil(gameState.ship.health)}/${gameState.ship.maxHealth}`;
        shipHealthBar.style.width = `${Math.max(0, shipHealthPercent)}%`;

        // Update station health
        if (gameState.stationMaxHealth > 0) {
            const stationHealthPercent = (gameState.stationHealth / gameState.stationMaxHealth) * 100;
            stationHealthSpan.textContent = `${Math.ceil(gameState.stationHealth)}/${gameState.stationMaxHealth}`;
            stationHealthBar.style.width = `${Math.max(0, stationHealthPercent)}%`;
        } else {
            stationHealthSpan.textContent = `0/0`;
            stationHealthBar.style.width = `0%`;
        }

        // Only update upgrade UIs when resources change or flag is set
        if (resources !== lastResources || upgradeUIUpdate) {
            updateGoalProgress();
            updateShipWeaponUI();
            updateStationUpgradeUI();
            updateMissileUI();
            lastResources = resources;
            upgradeUIUpdate = false;
        }

        // Check if mission objectives met and spawn boss
        const requirements = LEVEL_CONFIG[gameState.currentLevel].requirements;
        let objectivesMet = false;

        if (gameState.currentLevel === 0) {
            // Level 0 - only ship gun requirement
            objectivesMet = gameState.ship.gunLevel >= requirements.shipGunLevel;
        } else {
            // Other levels - check all requirements
            objectivesMet = gameState.stationLevel >= requirements.stationLevel &&
                gameState.stationGunLevel >= requirements.stationGunLevel &&
                gameState.ship.gunLevel >= requirements.shipGunLevel;
        }

        if (objectivesMet && !bossSpawned && !bossDefeated) {
            // Spawn the boss
            bossSpawned = true;
            createEnemyShip(true); // true = boss

            if (!bossAnnouncementShown) {
                const bossName = LEVEL_CONFIG[gameState.currentLevel].boss.name;
                createFloatingText(app.screen.width / 2, app.screen.height / 2 - 100, `WARNING: ${bossName} APPROACHING!`, 0xff0000, 24);
                bossAnnouncementShown = true;
            }
        }

        // Check for level progression or final victory (only if boss defeated)
        const canProgress = checkLevelProgression();
        const isFinalLevel = gameState.currentLevel === 3;

        if (bossDefeated && !resourceCollectionPhase && (canProgress || isFinalLevel)) {
            // Start resource collection phase
            resourceCollectionPhase = true;
            resourceCollectionTimer = 0;

            if (isFinalLevel) {
                createFloatingText(app.screen.width / 2, app.screen.height / 2, 'VICTORY! COLLECTING RESOURCES...', 0xffff00, 24);
            } else {
                createFloatingText(app.screen.width / 2, app.screen.height / 2, 'COLLECTING RESOURCES...', 0xffff00, 20);
            }
        }

        // Update resource collection phase
        if (resourceCollectionPhase) {
            resourceCollectionTimer += time.deltaTime;

            // Visual effect: pulsing collection radius for ship
            const shipPulse = Math.sin(resourceCollectionTimer / 10) * 0.3 + 0.7;
            const shipCollectionRadius = 80 * 3; // 3x normal radius
            const shipGlow = new PIXI.Graphics();
            shipGlow.circle(0, 0, shipCollectionRadius).stroke({
                width: 3,
                color: 0x00ffff,
                alpha: shipPulse * 0.4
            });
            shipGlow.circle(0, 0, shipCollectionRadius * 0.8).stroke({
                width: 2,
                color: 0x00ff00,
                alpha: shipPulse * 0.3
            });
            rocket.addChild(shipGlow);

            // Visual effect: pulsing collection radius for station
            if (gameState.stationLevel >= 2) {
                const stationPulse = Math.sin(resourceCollectionTimer / 10 + Math.PI) * 0.3 + 0.7;
                const basePullRadius = 100 + Math.min(gameState.stationLevel - 2, 8) * 30;
                const stationCollectionRadius = basePullRadius * 2; // 2x normal radius
                const stationGlow = new PIXI.Graphics();
                stationGlow.circle(0, 0, stationCollectionRadius).stroke({
                    width: 4,
                    color: 0x00ffff,
                    alpha: stationPulse * 0.5
                });
                stationGlow.circle(0, 0, stationCollectionRadius * 0.9).stroke({
                    width: 3,
                    color: 0x00ff00,
                    alpha: stationPulse * 0.4
                });
                stationGlow.circle(0, 0, stationCollectionRadius * 0.8).stroke({
                    width: 2,
                    color: 0xffff00,
                    alpha: stationPulse * 0.3
                });
                station.addChild(stationGlow);

                // Clean up glow after rendering
                requestAnimationFrame(() => {
                    if (stationGlow.parent) {
                        station.removeChild(stationGlow);
                        stationGlow.destroy();
                    }
                });
            }

            // Clean up ship glow after rendering
            requestAnimationFrame(() => {
                if (shipGlow.parent) {
                    rocket.removeChild(shipGlow);
                    shipGlow.destroy();
                }
            });

            // Show countdown
            const timeRemaining = Math.ceil((COLLECTION_PHASE_DURATION - resourceCollectionTimer) / 60);
            if (Math.floor(resourceCollectionTimer) % 60 === 0 && timeRemaining > 0 && timeRemaining <= 10) {
                createFloatingText(app.screen.width / 2, 100, `${timeRemaining}s`, 0x00ffff, 18);
            }

            // Transition when time is up
            if (resourceCollectionTimer >= COLLECTION_PHASE_DURATION) {
                resourceCollectionPhase = false;
                resourceCollectionTimer = 0;

                if (isFinalLevel) {
                    // Final level - show victory message instead of transitioning
                    createFloatingText(app.screen.width / 2, app.screen.height / 2, 'GAME COMPLETE!', 0xffff00, 32);
                    createFloatingText(app.screen.width / 2, app.screen.height / 2 + 50, 'All sectors conquered!', 0x00ff00, 20);
                } else {
                    transitionToNextLevel();
                }
            }
        }

        // Update cursor position
        cursor.x = cursorX;
        cursor.y = cursorY;
        cursor.visible = document.pointerLockElement === app.canvas;
    });

    function wrapObject(obj, padding = 0) {
        if (obj.x < -padding) obj.x = app.screen.width + padding;
        if (obj.x > app.screen.width + padding) obj.x = -padding;
        if (obj.y < -padding) obj.y = app.screen.height + padding;
        if (obj.y > app.screen.height + padding) obj.y = -padding;
    }

    function checkCollision(obj1, obj2, r1, r2) {
        const dx = obj1.x - obj2.x;
        const dy = obj1.y - obj2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < r1 + r2;
    }

    function updateShipWeaponUI() {
        const gunLevel = gameState.ship.gunLevel;
        const gunNames = [
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

        // Update level and label
        shipWeaponLevel.textContent = gunLevel;

        if (gunLevel === 0) {
            shipWeaponLabel.textContent = 'No Weapon';
        } else if (gunLevel < 10) {
            shipWeaponLabel.textContent = gunNames[gunLevel - 1];
        } else {
            shipWeaponLabel.textContent = gunNames[9];
        }

        // Calculate cost for next level
        let nextCost = 0;
        if (gunLevel < 10) {
            nextCost = gunLevel === 0 ? 0 : Math.floor(150 * Math.pow(1.4, gunLevel - 1));
        }

        // Update progress bar and cost display
        if (gunLevel >= 10) {
            // Max level
            shipWeaponProgress.style.width = '100%';
            shipWeaponCost.textContent = 'MAX LEVEL';
            shipUpgradeBtn.disabled = true;
            shipUpgradeBtn.style.display = 'none';
        } else {
            // Show progress toward next level
            const progress = nextCost === 0 ? 100 : Math.min((resources / nextCost) * 100, 100);
            shipWeaponProgress.style.width = `${progress}%`;
            shipWeaponCost.textContent = `${resources} / ${nextCost}`;

            // Enable/disable upgrade button based on resources
            if (resources >= nextCost) {
                shipUpgradeBtn.disabled = false;
                shipUpgradeBtn.style.display = 'block';
            } else {
                shipUpgradeBtn.disabled = true;
                shipUpgradeBtn.style.display = 'none';
            }
        }
    }

    function updateMissileUI() {
        missileAmmoValue.textContent = gameState.ship.missiles;
        missileAmmoMax.textContent = gameState.ship.maxMissiles;
    }

    function updateStationUpgradeUI() {
        const stationLevel = gameState.stationLevel;
        const stationGunLevel = gameState.stationGunLevel;

        // Station Level Names
        const stationNames = [
            'Core Module',        // Level 1
            'Solar Array',        // Level 2
            'Docking Bay',        // Level 3
            'Defense Grid',       // Level 4
            'Mining Hub',         // Level 5
            'Research Lab',       // Level 6
            'Command Center',     // Level 7
            'Shield Generator',   // Level 8
            'Production Facility',// Level 9
            'Mega Station'        // Level 10
        ];

        // Station Gun Names
        const stationGunNames = [
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

        // Update Station Level UI
        stationLevelDisplay.textContent = stationLevel;

        if (stationLevel === 0) {
            stationLevelLabel.textContent = 'No Station';
        } else if (stationLevel < 10) {
            stationLevelLabel.textContent = stationNames[stationLevel - 1];
        } else {
            stationLevelLabel.textContent = stationNames[9];
        }

        // Calculate cost for next station level
        let nextStationCost = 0;
        if (stationLevel < 10) {
            const baseCost = 100;
            const nextLevel = stationLevel + 1;
            nextStationCost = Math.floor(baseCost * Math.pow(1.5, nextLevel - 1));
        }

        // Update station level progress bar and cost display
        if (stationLevel >= 10) {
            stationLevelProgress.style.width = '100%';
            stationLevelCost.textContent = 'MAX LEVEL';
            stationLevelBtn.disabled = true;
            stationLevelBtn.style.display = 'none';
        } else {
            const progress = Math.min((resources / nextStationCost) * 100, 100);
            stationLevelProgress.style.width = `${progress}%`;
            stationLevelCost.textContent = `${resources} / ${nextStationCost}`;

            if (resources >= nextStationCost) {
                stationLevelBtn.disabled = false;
                stationLevelBtn.style.display = 'block';
            } else {
                stationLevelBtn.disabled = true;
                stationLevelBtn.style.display = 'none';
            }
        }

        // Update Station Gun UI
        stationGunLevelDisplay.textContent = stationGunLevel;

        if (stationGunLevel === 0) {
            stationGunLabel.textContent = 'No Defense';
        } else if (stationGunLevel < 10) {
            stationGunLabel.textContent = stationGunNames[stationGunLevel - 1];
        } else {
            stationGunLabel.textContent = stationGunNames[9];
        }

        // Calculate cost for next station gun level
        let nextStationGunCost = 0;
        if (stationGunLevel < 10 && stationLevel >= 1) {
            nextStationGunCost = Math.floor(200 * Math.pow(1.5, stationGunLevel));
        }

        // Update station gun progress bar and cost display
        if (stationLevel === 0) {
            // No station - show disabled state
            stationGunProgress.style.width = '0%';
            stationGunCost.textContent = 'BUILD STATION FIRST';
            stationGunBtn.disabled = true;
            stationGunBtn.style.display = 'none';
        } else if (stationGunLevel >= 10) {
            stationGunProgress.style.width = '100%';
            stationGunCost.textContent = 'MAX LEVEL';
            stationGunBtn.disabled = true;
            stationGunBtn.style.display = 'none';
        } else {
            const progress = Math.min((resources / nextStationGunCost) * 100, 100);
            stationGunProgress.style.width = `${progress}%`;
            stationGunCost.textContent = `${resources} / ${nextStationGunCost}`;

            if (resources >= nextStationGunCost) {
                stationGunBtn.disabled = false;
                stationGunBtn.style.display = 'block';
            } else {
                stationGunBtn.disabled = true;
                stationGunBtn.style.display = 'none';
            }
        }
    }

    function updateGoalProgress() {
        const requirements = LEVEL_CONFIG[gameState.currentLevel].requirements;
        const bossName = LEVEL_CONFIG[gameState.currentLevel].boss.name;

        if (gameState.currentLevel === 0) {
            // Level 0 - Tutorial level (only ship gun requirement)
            const nextLevelName = LEVEL_CONFIG[gameState.currentLevel + 1].name;
            goalProgressDiv.innerHTML = `
                <div class="goal-description">Advance to ${nextLevelName}</div>
                <div class="goal-item ${gameState.ship.gunLevel >= requirements.shipGunLevel ? 'completed' : ''}">
                    ${gameState.ship.gunLevel >= requirements.shipGunLevel ? '✓' : '○'} Ship Guns: ${gameState.ship.gunLevel}/${requirements.shipGunLevel}
                </div>
                <div class="goal-item ${bossDefeated ? 'completed' : ''}">
                    ${bossDefeated ? '✓' : '○'} Defeat ${bossName}
                </div>
            `;
        } else if (gameState.currentLevel === 3) {
            // Max level - show victory condition
            const allObjectivesMet = gameState.stationLevel >= requirements.stationLevel &&
                gameState.stationGunLevel >= requirements.stationGunLevel &&
                gameState.ship.gunLevel >= requirements.shipGunLevel;

            goalProgressDiv.innerHTML = `
                <div class="goal-item ${gameState.stationLevel >= requirements.stationLevel ? 'completed' : ''}">
                    ${gameState.stationLevel >= requirements.stationLevel ? '✓' : '○'} Station Level: ${gameState.stationLevel}/${requirements.stationLevel}
                </div>
                <div class="goal-item ${gameState.stationGunLevel >= requirements.stationGunLevel ? 'completed' : ''}">
                    ${gameState.stationGunLevel >= requirements.stationGunLevel ? '✓' : '○'} Station Guns: ${gameState.stationGunLevel}/${requirements.stationGunLevel}
                </div>
                <div class="goal-item ${gameState.ship.gunLevel >= requirements.shipGunLevel ? 'completed' : ''}">
                    ${gameState.ship.gunLevel >= requirements.shipGunLevel ? '✓' : '○'} Ship Guns: ${gameState.ship.gunLevel}/${requirements.shipGunLevel}
                </div>
                <div class="goal-item ${bossDefeated ? 'completed' : ''}">
                    ${bossDefeated ? '✓' : '○'} Defeat ${bossName}
                </div>
                ${allObjectivesMet && bossDefeated ?
                  '<div class="goal-complete">🎉 VICTORY! All goals achieved!</div>' :
                  '<div class="goal-incomplete">Complete all goals to win!</div>'}
            `;
        } else {
            // Show requirements for next level
            const nextLevelName = LEVEL_CONFIG[gameState.currentLevel + 1].name;
            goalProgressDiv.innerHTML = `
                <div class="goal-description">Advance to ${nextLevelName}</div>
                <div class="goal-item ${gameState.stationLevel >= requirements.stationLevel ? 'completed' : ''}">
                    ${gameState.stationLevel >= requirements.stationLevel ? '✓' : '○'} Station Level: ${gameState.stationLevel}/${requirements.stationLevel}
                </div>
                <div class="goal-item ${gameState.stationGunLevel >= requirements.stationGunLevel ? 'completed' : ''}">
                    ${gameState.stationGunLevel >= requirements.stationGunLevel ? '✓' : '○'} Station Guns: ${gameState.stationGunLevel}/${requirements.stationGunLevel}
                </div>
                <div class="goal-item ${gameState.ship.gunLevel >= requirements.shipGunLevel ? 'completed' : ''}">
                    ${gameState.ship.gunLevel >= requirements.shipGunLevel ? '✓' : '○'} Ship Guns: ${gameState.ship.gunLevel}/${requirements.shipGunLevel}
                </div>
                <div class="goal-item ${bossDefeated ? 'completed' : ''}">
                    ${bossDefeated ? '✓' : '○'} Defeat ${bossName}
                </div>
            `;
        }
    }

    // Handle window resize
    window.addEventListener('resize', () => {
        station.x = app.screen.width / 2;
        station.y = app.screen.height / 2;
    });

    // Ship upgrade button handler
    shipUpgradeBtn.addEventListener('click', () => {
        const gunLevel = gameState.ship.gunLevel;
        if (gunLevel < 10) {
            const cost = gunLevel === 0 ? 0 : Math.floor(150 * Math.pow(1.4, gunLevel - 1));
            if (resources >= cost) {
                resources -= cost;
                gameState.ship.gunLevel++;
                updateShipStats();
                upgradeUIUpdate = true;
            }
        }
    });

    // Station level upgrade button handler
    stationLevelBtn.addEventListener('click', () => {
        const stationLevel = gameState.stationLevel;
        if (stationLevel < 10) {
            const baseCost = 100;
            const nextLevel = stationLevel + 1;
            const cost = Math.floor(baseCost * Math.pow(1.5, nextLevel - 1));
            if (resources >= cost) {
                resources -= cost;
                gameState.stationLevel++;
                gameState.stationMaxHealth = gameState.stationLevel * 200;
                gameState.stationHealth = gameState.stationMaxHealth;
                updateStationGraphics();
                upgradeUIUpdate = true;
            }
        }
    });

    // Station gun upgrade button handler
    stationGunBtn.addEventListener('click', () => {
        const stationGunLevel = gameState.stationGunLevel;
        if (stationGunLevel < 10 && gameState.stationLevel >= 1) {
            const cost = Math.floor(200 * Math.pow(1.5, stationGunLevel));
            if (resources >= cost) {
                resources -= cost;
                gameState.stationGunLevel++;
                updateStationGraphics();
                upgradeUIUpdate = true;
            }
        }
    });

    // Initialize upgrade UIs
    updateShipWeaponUI();
    updateStationUpgradeUI();
}

init();
