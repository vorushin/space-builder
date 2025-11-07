/**
 * Helper Utility Functions
 * Common utility functions used throughout the game
 */

/**
 * Generate random position offscreen for spawning
 * @param {Object} screen - Screen dimensions {width, height}
 * @param {number} margin - Distance from screen edge
 * @returns {Object} {x, y} position
 */
export function getOffscreenPosition(screen, margin = 100) {
    const side = Math.floor(Math.random() * 4);
    let x, y;

    switch (side) {
        case 0: // Top
            x = Math.random() * screen.width;
            y = -margin;
            break;
        case 1: // Right
            x = screen.width + margin;
            y = Math.random() * screen.height;
            break;
        case 2: // Bottom
            x = Math.random() * screen.width;
            y = screen.height + margin;
            break;
        case 3: // Left
            x = -margin;
            y = Math.random() * screen.height;
            break;
    }

    return { x, y };
}

/**
 * Normalize angle to [-PI, PI] range
 * @param {number} angle - Angle in radians
 * @returns {number} Normalized angle
 */
export function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
}

/**
 * Calculate angle between two points
 * @param {Object} from - Source point {x, y}
 * @param {Object} to - Target point {x, y}
 * @returns {number} Angle in radians
 */
export function angleBetween(from, to) {
    return Math.atan2(to.y - from.y, to.x - from.x);
}

/**
 * Random number between min and max
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random number
 */
export function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * Random integer between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer
 */
export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Select random weighted item from array
 * @param {Array} items - Array of items with weight property
 * @returns {Object} Selected item
 */
export function randomWeighted(items) {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    for (const item of items) {
        random -= item.weight;
        if (random <= 0) return item;
    }

    return items[items.length - 1];
}
