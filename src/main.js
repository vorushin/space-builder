/**
 * Space Builder - Modular Main File
 * Imports configuration and utilities as ES6 modules
 */

import { LEVEL_CONFIG } from './config/levels.js';
import * as CONSTANTS from './config/constants.js';
import { checkCollision, getDistance, isOffScreen, clampToScreen } from './utils/collision.js';
import { getOffscreenPosition, normalizeAngle, angleBetween, randomRange, randomInt, randomWeighted } from './utils/helpers.js';

// Note: The main game logic remains here for now, but uses imported modules
// This can be further refactored into smaller modules incrementally

// Re-export the init function as the main entry point
export { init } from '../main.js';
