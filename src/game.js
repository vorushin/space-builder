/**
 * Space Builder - Main Game Entry Point
 * Modular ES6 version
 */

import { LEVEL_CONFIG } from './config/levels.js';
import * as CONSTANTS from './config/constants.js';
import { gameState, stateTracking, resetLevelState, resetStationState } from './state/gameState.js';
import { checkCollision, getDistance, isOffScreen, clampToScreen } from './utils/collision.js';
import { getOffscreenPosition, normalizeAngle, angleBetween, randomRange, randomInt, randomWeighted } from './utils/helpers.js';

// Initialize PixiJS
const app = new PIXI.Application();

export async function init() {
    await app.init({ background: '#000', resizeTo: window });
    document.body.appendChild(app.canvas);

    // Import and initialize game systems
    const { initializeUI } from await import('./ui/hud.js');
    const { setupInputHandlers } = await import('./input/controls.js');
    const { createShip, updateShipGraphics } = await import('./graphics/ship.js');
    const { createStation, updateStationGraphics } = await import('./graphics/station.js');
    const { createStars } = await import('./graphics/background.js');

    // Initialize UI
    const uiElements = initializeUI();

    // Initialize containers
    const backgroundContainer = new PIXI.Container();
    const gameContainer = new PIXI.Container();
    const cursorContainer = new PIXI.Container();

    app.stage.addChild(backgroundContainer);
    app.stage.addChild(gameContainer);
    app.stage.addChild(cursorContainer);

    // Create custom cursor
    const cursor = new PIXI.Graphics();
    cursor.circle(0, 0, 8).stroke({ width: 2, color: 0x00ffff });
    cursor.moveTo(-12, 0).lineTo(-4, 0).stroke({ width: 2, color: 0x00ffff });
    cursor.moveTo(12, 0).lineTo(4, 0).stroke({ width: 2, color: 0x00ffff });
    cursor.moveTo(0, -12).lineTo(0, -4).stroke({ width: 2, color: 0x00ffff });
    cursor.moveTo(0, 12).lineTo(0, 4).stroke({ width: 2, color: 0x00ffff });
    cursor.visible = false;
    cursorContainer.addChild(cursor);

    // Create stars background
    createStars(backgroundContainer, app.screen, gameState.currentLevel);

    // Create ship
    const ship = createShip(gameContainer, app.screen.width / 2, app.screen.height / 2 + 200);

    // Create station (initially)
    const station = createStation(gameContainer, app.screen.width / 2, app.screen.height / 2);

    // Setup input handlers
    const inputState = setupInputHandlers(app.canvas, cursor, uiElements, { ship, station, gameState, stateTracking });

    // Game arrays for entities
    const entities = {
        bullets: [],
        stationBullets: [],
        missiles: [],
        asteroids: [],
        enemies: [],
        enemyBullets: [],
        enemyGroups: [],
        resourcePieces: [],
        floatingTexts: [],
        explosions: [],
        teleportRings: []
    };

    // Start game loop
    startGameLoop(app, gameContainer, ship, station, entities, inputState, uiElements, { cursor, backgroundContainer });
}

/**
 * Main game loop
 */
function startGameLoop(app, gameContainer, ship, station, entities, inputState, uiElements, graphics) {
    // Import game loop modules
    import('./core/gameLoop.js').then(({ runGameLoop }) => {
        app.ticker.add((time) => {
            runGameLoop(time, app, gameContainer, ship, station, entities, inputState, uiElements, graphics);
        });
    });
}

// Start the game
init();
