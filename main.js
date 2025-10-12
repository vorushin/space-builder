// Initialize PixiJS
const app = new PIXI.Application();

async function init() {
    await app.init({ background: '#000', resizeTo: window });
    document.body.appendChild(app.canvas);

    // UI Elements
    const resourceCountSpan = document.getElementById('resource-count');
    const actionList = document.getElementById('action-list');
    const shipHealthSpan = document.getElementById('ship-health-value');
    const stationHealthSpan = document.getElementById('station-health-value');

    // Game State
    let resources = 0;
    let actionsNeedUpdate = true; // Flag to track when UI needs refresh
    let lastProductionTime = Date.now();
    let lastStationShotTime = 0;
    const gameState = {
        stationLevel: 0,
        stationHealth: 0,
        stationMaxHealth: 0,
        stationGunLevel: 0, // Station guns (0-10)
        ship: {
            speedLevel: 1,
            sizeLevel: 1,
            gunLevel: 1, // Start with gun
            health: 100,
            maxHealth: 100
        }
    };

    // Containers
    const backgroundContainer = new PIXI.Container();
    const gameContainer = new PIXI.Container();
    app.stage.addChild(backgroundContainer);
    app.stage.addChild(gameContainer);

    // Starry Background
    function createStars() {
        const numStars = 200;
        for (let i = 0; i < numStars; i++) {
            const star = new PIXI.Graphics();
            star.circle(0, 0, Math.random() * 2);
            star.fill({ color: 0xffffff, alpha: Math.random() });
            star.x = Math.random() * app.screen.width;
            star.y = Math.random() * app.screen.height;
            backgroundContainer.addChild(star);
        }
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
        const scale = 1 + (gameState.ship.sizeLevel - 1) * 0.2;
        rocket.scale.set(scale);
        rocket.r = 15 * scale; // Collision radius

        // Redraw graphics based on gun level
        rocketBody.clear();
        rocketBody.moveTo(15, 0).lineTo(-10, -10).lineTo(-5, 0).lineTo(-10, 10).closePath()
            .fill(0x3399ff).stroke({ width: 2, color: 0xffffff });

        // Gun visuals based on level
        if (gameState.ship.gunLevel >= 1) {
            // Basic guns
            rocketBody.rect(0, -12, 5, 2).fill(0xaaaaaa);
            rocketBody.rect(0, 10, 5, 2).fill(0xaaaaaa);
        }
        if (gameState.ship.gunLevel >= 2) {
            // Longer barrels
            rocketBody.rect(5, -12, 3, 2).fill(0xff8800);
            rocketBody.rect(5, 10, 3, 2).fill(0xff8800);
        }
        if (gameState.ship.gunLevel >= 3) {
            // Additional side guns
            rocketBody.rect(-5, -8, 4, 1.5).fill(0xaaaaaa);
            rocketBody.rect(-5, 6.5, 4, 1.5).fill(0xaaaaaa);
        }
        if (gameState.ship.gunLevel >= 4) {
            // Power cores (multi-shot)
            rocketBody.circle(-3, -10, 1.5).fill(0xff0000);
            rocketBody.circle(-3, 10, 1.5).fill(0xff0000);
        }
        if (gameState.ship.gunLevel >= 5) {
            // Plasma weapon tips
            rocketBody.rect(8, -11, 2, 1).fill(0xffff00);
            rocketBody.rect(8, 10, 2, 1).fill(0xffff00);
            rocketBody.circle(0, 0, 2).fill(0xffff00);
        }
        if (gameState.ship.gunLevel >= 6) {
            // Laser barrage - additional turrets
            rocketBody.rect(-8, -14, 3, 1.5).fill(0x00ffff);
            rocketBody.rect(-8, 12.5, 3, 1.5).fill(0x00ffff);
        }
        if (gameState.ship.gunLevel >= 7) {
            // Ion pulse - energy capacitors
            rocketBody.circle(-6, 0, 2.5).fill(0x0088ff);
            rocketBody.circle(-6, 0, 1.5).fill(0x00ccff);
        }
        if (gameState.ship.gunLevel >= 8) {
            // Quantum cannons - quantum cores
            rocketBody.circle(5, -12, 2).fill(0xff00ff);
            rocketBody.circle(5, 10, 2).fill(0xff00ff);
            rocketBody.rect(10, -12, 3, 1).fill(0xff00ff);
            rocketBody.rect(10, 10, 3, 1).fill(0xff00ff);
        }
        if (gameState.ship.gunLevel >= 9) {
            // Antimatter guns - containment fields
            rocketBody.circle(3, 0, 4).stroke({ width: 1, color: 0xff0000, alpha: 0.5 });
            rocketBody.circle(3, 0, 3).fill(0xff0000);
        }
        if (gameState.ship.gunLevel >= 10) {
            // Singularity weapon - black hole core
            rocketBody.circle(0, 0, 5).fill(0x000000);
            rocketBody.circle(0, 0, 6).stroke({ width: 2, color: 0xffffff });
            rocketBody.circle(0, 0, 8).stroke({ width: 1, color: 0xffffff, alpha: 0.3 });
        }

        rocketEngine.clear();
        rocketEngine.moveTo(-10, -5).lineTo(-20 * scale, 0).lineTo(-10, 5).closePath().fill(0xff3300);
    }
    updateShipStats();

    // Bullets
    const bullets = [];
    const stationBullets = [];
    let lastShotTime = 0;

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

        gameContainer.addChild(piece);
        resourcePieces.push(piece);
    }

    // Floating text for resource collection
    const floatingTexts = [];

    function createFloatingText(x, y, text) {
        const textObj = new PIXI.Text({
            text: text,
            style: {
                fontSize: 16,
                fill: 0x00ff00,
                fontWeight: 'bold'
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

    // Asteroids
    const asteroids = [];
    const numAsteroids = 20;

    function createAsteroid(options = {}) {
        const { x, y, r, offscreen = false } = options;
        const radius = r || Math.random() * 20 + 15;
        const asteroid = new PIXI.Graphics();

        // Draw irregular shape
        asteroid.moveTo(radius, 0);
        for (let i = 1; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const dist = radius * (0.8 + Math.random() * 0.4);
            asteroid.lineTo(Math.cos(angle) * dist, Math.sin(angle) * dist);
        }
        asteroid.closePath();
        asteroid.fill(0x888888).stroke({ width: 2, color: 0xaaaaaa });

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
        asteroid.vx = (Math.random() - 0.5) * 2;
        asteroid.vy = (Math.random() - 0.5) * 2;
        asteroid.rotationSpeed = (Math.random() - 0.5) * 0.05;
        asteroid.resources = Math.floor(radius * 2);

        gameContainer.addChild(asteroid);
        asteroids.push(asteroid);
    }

    for (let i = 0; i < numAsteroids; i++) {
        createAsteroid();
    }

    // Enemy Ships
    const enemies = [];
    const enemyBullets = [];
    let lastEnemySpawnTime = Date.now();

    function createEnemyShip() {
        const enemy = new PIXI.Container();

        // Random size: small (10-15), medium (15-25), large (25-35)
        const sizeType = Math.random();
        let size, health, speed, fireRate, accuracy;

        if (sizeType < 0.5) {
            // Small - fast, low HP
            size = 10 + Math.random() * 5;
            health = 20 + size * 2;
            speed = 1.5 + Math.random() * 0.5;
            fireRate = 1500; // ms
            accuracy = 0.3; // Lower = less accurate
        } else if (sizeType < 0.85) {
            // Medium - balanced
            size = 15 + Math.random() * 10;
            health = 40 + size * 3;
            speed = 1 + Math.random() * 0.5;
            fireRate = 2000;
            accuracy = 0.25;
        } else {
            // Large - slow, high HP
            size = 25 + Math.random() * 10;
            health = 80 + size * 4;
            speed = 0.5 + Math.random() * 0.3;
            fireRate = 2500;
            accuracy = 0.2;
        }

        enemy.maxHealth = health;
        enemy.health = health;
        enemy.size = size;
        enemy.speed = speed;
        enemy.fireRate = fireRate;
        enemy.accuracy = accuracy;
        enemy.lastShotTime = Date.now();
        enemy.r = size; // Collision radius

        // Spawn outside screen
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

        // Draw enemy ship (red/hostile appearance)
        const g = new PIXI.Graphics();
        g.moveTo(size, 0)
            .lineTo(-size * 0.7, -size * 0.7)
            .lineTo(-size * 0.4, 0)
            .lineTo(-size * 0.7, size * 0.7)
            .closePath()
            .fill(0xff0000)
            .stroke({ width: 2, color: 0xaa0000 });

        // Weapons
        g.rect(size * 0.5, -size * 0.3, size * 0.4, size * 0.15).fill(0xaa0000);
        g.rect(size * 0.5, size * 0.15, size * 0.4, size * 0.15).fill(0xaa0000);

        enemy.addChild(g);
        gameContainer.addChild(enemy);
        enemies.push(enemy);
    }

    // Actions
    function getActions() {
        const acts = [];

        // Station Actions
        const nextStationLevel = gameState.stationLevel + 1;
        if (nextStationLevel <= 10) {
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
            const baseCost = 100;
            const cost = Math.floor(baseCost * Math.pow(1.5, nextStationLevel - 1)); // Exponential cost scaling

            acts.push({
                name: `Build Station Lvl ${nextStationLevel}: ${stationNames[nextStationLevel - 1]}`,
                cost: cost,
                perform: () => {
                    gameState.stationLevel++;
                    gameState.stationMaxHealth = gameState.stationLevel * 200; // 200 HP per level
                    gameState.stationHealth = gameState.stationMaxHealth;
                    updateStationGraphics();
                    actionsNeedUpdate = true;
                }
            });
        }

        // Gun upgrades (up to level 10)
        if (gameState.ship.gunLevel < 10) {
            const gunCost = gameState.ship.gunLevel === 0 ? 0 : Math.floor(150 * Math.pow(1.4, gameState.ship.gunLevel - 1));
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
            acts.push({
                name: `Upgrade Gun Lvl ${gameState.ship.gunLevel + 1}: ${gunNames[gameState.ship.gunLevel]}`,
                cost: gunCost,
                perform: () => {
                    gameState.ship.gunLevel++;
                    updateShipStats();
                    actionsNeedUpdate = true;
                }
            });
        }

        // Station Gun upgrades (up to level 10, requires Station Level 1+)
        if (gameState.stationLevel >= 1 && gameState.stationGunLevel < 10) {
            const stationGunCost = Math.floor(200 * Math.pow(1.5, gameState.stationGunLevel));
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
            acts.push({
                name: `Station Gun Lvl ${gameState.stationGunLevel + 1}: ${stationGunNames[gameState.stationGunLevel]}`,
                cost: stationGunCost,
                perform: () => {
                    gameState.stationGunLevel++;
                    updateStationGraphics();
                    actionsNeedUpdate = true;
                }
            });
        }

        return acts;
    }

    // Input handling
    const keys = {};
    document.addEventListener('keydown', (e) => {
        keys[e.key] = true;
        if (e.code === 'Space') shoot();
    });
    document.addEventListener('keyup', (e) => keys[e.key] = false);

    // Game loop
    let lastResources = resources; // Track resource changes
    app.ticker.add((time) => {
        // Rocket controls
        // A/D or Left/Right Arrow - Rotation
        if (keys['a'] || keys['ArrowLeft']) rocket.rotation -= rocket.rotationSpeed * time.deltaTime;
        if (keys['d'] || keys['ArrowRight']) rocket.rotation += rocket.rotationSpeed * time.deltaTime;

        // W or Up Arrow - Forward thrust
        if (keys['w'] || keys['ArrowUp']) {
            rocket.vx += Math.cos(rocket.rotation) * rocket.thrust * time.deltaTime;
            rocket.vy += Math.sin(rocket.rotation) * rocket.thrust * time.deltaTime;
            rocketEngine.visible = true;
        } else {
            rocketEngine.visible = false;
        }

        // S or Down Arrow - Backward thrust
        if (keys['s'] || keys['ArrowDown']) {
            rocket.vx -= Math.cos(rocket.rotation) * rocket.thrust * 0.5 * time.deltaTime;
            rocket.vy -= Math.sin(rocket.rotation) * rocket.thrust * 0.5 * time.deltaTime;
        }

        // Q - Strafe left (perpendicular to ship direction)
        if (keys['q']) {
            rocket.vx += Math.cos(rocket.rotation - Math.PI / 2) * rocket.thrust * time.deltaTime;
            rocket.vy += Math.sin(rocket.rotation - Math.PI / 2) * rocket.thrust * time.deltaTime;
        }

        // E - Strafe right (perpendicular to ship direction)
        if (keys['e']) {
            rocket.vx += Math.cos(rocket.rotation + Math.PI / 2) * rocket.thrust * time.deltaTime;
            rocket.vy += Math.sin(rocket.rotation + Math.PI / 2) * rocket.thrust * time.deltaTime;
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
        if (rocket.x > 0 && rocket.x < app.screen.width) {
            rocket.vx *= 0.99;
        }
        if (rocket.y > 0 && rocket.y < app.screen.height) {
            rocket.vy *= 0.99;
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
                        hitSomething = true;
                        hitPosition = { x: a.x, y: a.y };

                        // Check if enemy destroyed
                        if (enemy.health <= 0) {
                            createExplosion(enemy.x, enemy.y, enemy.size);
                            // Drop resources based on size
                            const resourceDrop = Math.floor(enemy.size * 3);
                            const numPieces = 3 + Math.floor(enemy.size / 10);
                            for (let k = 0; k < numPieces; k++) {
                                createResourcePiece(enemy.x, enemy.y, Math.floor(resourceDrop / numPieces));
                            }
                            gameContainer.removeChild(enemy);
                            enemies.splice(j, 1);
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
            createEnemyShip();
            lastEnemySpawnTime = now;
        }

        // Update enemies
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];

            // Determine target (prioritize ship if close, otherwise station)
            let target = null;
            const distToShip = Math.sqrt((enemy.x - rocket.x) ** 2 + (enemy.y - rocket.y) ** 2);
            const distToStation = gameState.stationLevel > 0 ?
                Math.sqrt((enemy.x - station.x) ** 2 + (enemy.y - station.y) ** 2) : Infinity;

            if (distToShip < 400 || distToStation === Infinity) {
                target = rocket;
            } else {
                target = station;
            }

            // Move towards target
            const dx = target.x - enemy.x;
            const dy = target.y - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 200) { // Keep distance
                enemy.x += (dx / dist) * enemy.speed * time.deltaTime;
                enemy.y += (dy / dist) * enemy.speed * time.deltaTime;
            }

            // Rotate to face target
            enemy.rotation = Math.atan2(dy, dx);

            // Fire at target if in range
            const fireRange = 350;
            if (dist < fireRange) {
                const now = Date.now();
                if (now - enemy.lastShotTime > enemy.fireRate) {
                    enemy.lastShotTime = now;

                    // Calculate angle with inaccuracy
                    const angleToTarget = Math.atan2(dy, dx);
                    const inaccuracy = (Math.random() - 0.5) * enemy.accuracy;
                    const finalAngle = angleToTarget + inaccuracy;

                    // Create enemy bullet
                    const eb = new PIXI.Graphics().circle(0, 0, 3).fill(0xff4444);
                    eb.x = enemy.x + Math.cos(enemy.rotation) * enemy.size;
                    eb.y = enemy.y + Math.sin(enemy.rotation) * enemy.size;
                    eb.vx = Math.cos(finalAngle) * 4;
                    eb.vy = Math.sin(finalAngle) * 4;
                    eb.life = 120;
                    eb.damage = Math.floor(enemy.size / 5) + 5; // 5-12 damage
                    eb.r = 3;

                    gameContainer.addChild(eb);
                    enemyBullets.push(eb);
                }
            }

            // Remove if too far off-screen
            const margin = 200;
            if (enemy.x < -margin || enemy.x > app.screen.width + margin ||
                enemy.y < -margin || enemy.y > app.screen.height + margin) {
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
                    createExplosion(b.x, b.y, 5);

                    gameContainer.removeChild(b);
                    bullets.splice(i, 1);

                    if (enemy.health <= 0) {
                        createExplosion(enemy.x, enemy.y, enemy.size);
                        // Drop resources based on size
                        const resourceDrop = Math.floor(enemy.size * 3);
                        const numPieces = 3 + Math.floor(enemy.size / 10);
                        for (let k = 0; k < numPieces; k++) {
                            createResourcePiece(enemy.x, enemy.y, Math.floor(resourceDrop / numPieces));
                        }
                        gameContainer.removeChild(enemy);
                        enemies.splice(j, 1);
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
                    createExplosion(sb.x, sb.y, 5);

                    gameContainer.removeChild(sb);
                    stationBullets.splice(i, 1);

                    if (enemy.health <= 0) {
                        createExplosion(enemy.x, enemy.y, enemy.size);
                        const resourceDrop = Math.floor(enemy.size * 3);
                        const numPieces = 3 + Math.floor(enemy.size / 10);
                        for (let k = 0; k < numPieces; k++) {
                            createResourcePiece(enemy.x, enemy.y, Math.floor(resourceDrop / numPieces));
                        }
                        gameContainer.removeChild(enemy);
                        enemies.splice(j, 1);
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

            if (distance < piece.pullRadius) {
                // Pull toward ship
                const pullStrength = 0.3;
                piece.vx += (dx / distance) * pullStrength * time.deltaTime;
                piece.vy += (dy / distance) * pullStrength * time.deltaTime;
            }

            // Check if station can pull it in (requires station level 2+)
            if (gameState.stationLevel >= 2) {
                // Pull radius: Level 2: 100px, Level 10: 340px
                const stationPullRadius = 100 + Math.min(gameState.stationLevel - 2, 8) * 30;
                const sdx = station.x - piece.x;
                const sdy = station.y - piece.y;
                const stationDistance = Math.sqrt(sdx * sdx + sdy * sdy);

                if (stationDistance < stationPullRadius) {
                    // Pull toward station (stronger than ship pull, increases with level)
                    const stationPullStrength = 0.5 + (gameState.stationLevel - 2) * 0.05;
                    piece.vx += (sdx / stationDistance) * stationPullStrength * time.deltaTime;
                    piece.vy += (sdy / stationDistance) * stationPullStrength * time.deltaTime;
                }
            }

            // Realistic space physics - constant velocity drift (no damping)
            piece.x += piece.vx * time.deltaTime;
            piece.y += piece.vy * time.deltaTime;

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
            actionsNeedUpdate = true;
        }

        // Update UI
        resourceCountSpan.textContent = resources;
        shipHealthSpan.textContent = `${Math.ceil(gameState.ship.health)}/${gameState.ship.maxHealth}`;
        stationHealthSpan.textContent = `${Math.ceil(gameState.stationHealth)}/${gameState.stationMaxHealth}`;

        // Only update actions when resources change or flag is set
        if (resources !== lastResources || actionsNeedUpdate) {
            updateActions();
            lastResources = resources;
            actionsNeedUpdate = false;
        }
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

    function updateActions() {
        const currentActions = getActions();
        actionList.innerHTML = '';
        for (const action of currentActions) {
            const li = document.createElement('li');
            li.textContent = `${action.name} (${action.cost})`;
            if (resources < action.cost) {
                li.classList.add('disabled');
            } else {
                li.onclick = () => {
                    if (resources >= action.cost) {
                        resources -= action.cost;
                        action.perform();
                        // Flag will trigger update on next frame
                    }
                };
            }
            actionList.appendChild(li);
        }
    }

    // Handle window resize
    window.addEventListener('resize', () => {
        station.x = app.screen.width / 2;
        station.y = app.screen.height / 2;
    });
}

init();
