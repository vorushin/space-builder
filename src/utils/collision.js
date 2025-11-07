/**
 * Collision Detection Utilities
 * Simple circle-circle collision detection
 */

/**
 * Check collision between two circular objects
 * @param {Object} obj1 - First object with x, y properties
 * @param {Object} obj2 - Second object with x, y properties
 * @param {number} radius1 - Radius of first object
 * @param {number} radius2 - Radius of second object
 * @returns {boolean} True if collision detected
 */
export function checkCollision(obj1, obj2, radius1, radius2) {
    const dx = obj1.x - obj2.x;
    const dy = obj1.y - obj2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (radius1 + radius2);
}

/**
 * Calculate distance between two objects
 * @param {Object} obj1 - First object with x, y properties
 * @param {Object} obj2 - Second object with x, y properties
 * @returns {number} Distance between objects
 */
export function getDistance(obj1, obj2) {
    const dx = obj1.x - obj2.x;
    const dy = obj1.y - obj2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if object is off screen with margin
 * @param {Object} obj - Object with x, y properties
 * @param {Object} screen - Screen dimensions {width, height}
 * @param {number} margin - Margin around screen
 * @returns {boolean} True if off screen
 */
export function isOffScreen(obj, screen, margin) {
    return obj.x < -margin ||
           obj.x > screen.width + margin ||
           obj.y < -margin ||
           obj.y > screen.height + margin;
}

/**
 * Clamp position to screen bounds
 * @param {Object} obj - Object with x, y properties
 * @param {Object} screen - Screen dimensions {width, height}
 * @param {number} margin - Margin from screen edge
 */
export function clampToScreen(obj, screen, margin = 0) {
    obj.x = Math.max(margin, Math.min(screen.width - margin, obj.x));
    obj.y = Math.max(margin, Math.min(screen.height - margin, obj.y));
}
