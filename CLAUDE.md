# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Space Builder is a 2D space survival and base-building game built with vanilla JavaScript and Pixi.js v8.1.0. The entire game logic (~980 lines) is contained in a single `main.js` file, with a minimal HTML entry point and CSS for UI overlays.

## Development Commands

### Running the Game
This is a static web project with no build process. To run:
```bash
# Serve the directory with any static file server, for example:
python -m http.server 8000
# or
npx serve .
```

Then open `http://localhost:8000` in a browser.

## Architecture

### File Structure
- `index.html` - Entry point, loads Pixi.js v8.1.0 CDN and game scripts
- `main.js` - All game logic (initialization, game loop, entity systems, physics, collision, upgrades)
- `style.css` - UI overlay styles for HUD (resource counter, health bars, action list)

### Core Architecture Pattern

The game uses a **single-file, entity-component pattern** with Pixi.js containers and graphics objects. All game logic is in `main.js`:

**Game State Structure** (lines 14-31):
```javascript
gameState = {
    stationLevel: 0-10,
    stationHealth: number,
    stationMaxHealth: number,
    stationGunLevel: 0-10,
    ship: {
        speedLevel: number,
        sizeLevel: number,
        gunLevel: 1-10,
        health: number,
        maxHealth: 100
    }
}
resources: number  // Player's resource count
```

**Entity Systems** (arrays of Pixi.Graphics objects):
- `asteroids[]` - Always 20 active asteroids with physics and collision
- `bullets[]` - Player-fired projectiles
- `stationBullets[]` - Auto-targeting station defense turrets
- `resourcePieces[]` - Collectible resources dropped from destroyed asteroids
- `floatingTexts[]` - Visual feedback for resource collection

### Game Loop Flow (lines 526-935)

1. **Input Processing**: Keyboard state, weapon firing
2. **Ship Physics**: Thrust, rotation, velocity damping (0.99), screen wrapping
3. **Station Systems**: Auto-targeting, passive abilities (health regen, resource production)
4. **Bullet Updates**: Movement, lifetime, collision with asteroids, splash damage
5. **Asteroid Updates**: Movement, rotation, collision with ship/station
6. **Resource Updates**: Magnetic pull mechanics (ship: 80px, station: 100-340px based on level)
7. **Health Checks**: Ship/station destruction and respawn
8. **UI Updates**: Health bars, resource count, action list (dirty flag optimization)

### Key Code Locations

- **Ship Weapon System**: `main.js:273-330` - `shoot()` function with multi-shot, fire rate, splash damage
- **Station Auto-Targeting**: `main.js:583-647` - Finds nearest asteroid, fires station guns
- **Upgrade Actions**: `main.js:407-514` - `getActions()` generates available upgrades with costs
- **Ship Graphics**: `main.js:194-266` - `updateShipStats()` draws ship based on upgrade levels
- **Station Graphics**: `main.js:60-177` - `updateStationGraphics()` progressive visual upgrades
- **Bullet-Asteroid Collision**: `main.js:663-724` - Includes splash damage processing
- **Station Bullet Collision**: `main.js:741-797` - Auto-targeting bullets
- **Resource Pull Mechanics**: `main.js:833-887` - Magnetic pull from ship and station
- **Collision Detection**: `main.js:944-949` - Simple circle-circle distance check

### Physics System

**Movement** (lines 544-548):
- Momentum-based with velocity damping (0.99 per frame)
- Screen wrapping at edges (`wrapObject()` function)
- Delta time correction for frame rate independence

**Collision Detection** (lines 944-949):
- Circle-circle distance checks only
- Collision radii stored as `obj.r` property
- Used for: ship-asteroid, station-asteroid, bullet-asteroid, resource collection

### Upgrade Systems

**Three Independent Upgrade Paths**:

1. **Ship Weapons** (1-10 levels):
   - Cost formula: `150 × 1.4^(level-1)`
   - Progressive features: fire rate ↑, multi-shot (1→3→5→7), splash damage (level 7+), resource multipliers
   - Visual progression in ship graphics (lines 208-261)

2. **Station Construction** (1-10 levels):
   - Cost formula: `100 × 1.5^(level-1)`
   - Each level adds: HP (+200), visual elements, special abilities
   - Level 4: Defense Grid (70% damage reduction)
   - Level 6: Research Lab (ship health regen)
   - Level 9+: Production Facility (passive resource generation)
   - Pull radius formula: `100 + min(level-2, 8) × 30` (100-340px)

3. **Station Guns** (0-10 levels, requires Station Level 1+):
   - Cost formula: `200 × 1.5^level`
   - Auto-targeting system (lines 583-647)
   - Progressive: fire rate ↑, bullet count ↑, range ↑, splash damage (level 6+)
   - Completely automated - no player input required

### Resource System

**Resource Flow**:
1. Asteroids contain resources (`radius × 2`)
2. Shooting asteroids drops green resource pieces
3. Pieces are magnetically pulled by ship (80px) or station (100-340px based on level)
4. Collection grants resources with floating text feedback
5. Resources purchase upgrades via action list

**Resource Multipliers**:
- Ship weapons: 1× (basic) → 1.5× (level 4) → 2× (level 8) → 3× (level 10)
- Station guns: 1× (basic) → 1.5× (level 4) → 2× (level 7) → 2.5× (level 10)
- Higher weapon levels can instantly destroy large asteroids (level 3+)

### Special Mechanics

**Splash Damage** (lines 706-718, 780-792):
- Ship weapons: Level 7+ with radius 20-50px
- Station guns: Level 6+ with radius 15-35px
- Processes all asteroids within splash radius on bullet hit

**Auto-Targeting AI** (lines 583-603):
- Finds nearest asteroid within range
- Calculates angle to target
- Fires spread of bullets toward target
- Independent cooldown system from player weapons

**Damage System**:
- Asteroids damage on collision: `radius × 0.5 × defenseMultiplier`
- Ship health: 100 HP, respawns at center when destroyed
- Station health: `level × 200`, destroyed station must be rebuilt from level 0
- Defense Grid (level 4+): Reduces station damage by 70%

### Performance Optimizations

**Dirty Flag System** (lines 929-934):
- UI only rebuilds when resources change or upgrades occur
- Prevents unnecessary DOM manipulation every frame

**Fixed Entity Count**:
- Always 20 asteroids (constant spawning)
- Screen wrapping instead of infinite world
- Efficient circle-circle collision only

**Hot Path Optimization**:
- No garbage creation in game loop
- Efficient splice operations for entity removal
- Hardware-accelerated rendering via Pixi.js WebGL

## Common Development Patterns

### Adding New Upgrade Tiers
1. Extend arrays in `getActions()` (lines 413-511)
2. Update cost formulas (exponential scaling)
3. Add visual elements in `updateShipStats()` or `updateStationGraphics()`
4. Add gameplay effects in game loop (weapon fire, collision, abilities)

### Adding New Entity Types
1. Create array to hold entities (e.g., `const enemies = []`)
2. Create factory function (follow `createAsteroid()` pattern, lines 376-400)
3. Add update loop in game ticker (lines 526-935)
4. Add collision detection with existing entities
5. Add to `gameContainer` for rendering

### Modifying Weapon Behavior
- **Fire Rate**: Adjust cooldown in `shoot()` (line 277) or station guns (line 586)
- **Bullet Properties**: Modify speed, size, damage, color (lines 282-302 for ship, 614-623 for station)
- **Multi-Shot**: Change bullet count and spread angle (lines 288-293)
- **Splash Damage**: Adjust `splashRadius` calculation (lines 323-325, 638-640)

### Adding Visual Feedback
Use `createFloatingText()` (lines 353-370) for any game event that should show player feedback. Already used for:
- Resource collection
- Ship destruction
- Station destruction
- Passive resource generation

## Important Constants

- **Asteroid Count**: 20 (constant, line 374)
- **Ship Pull Radius**: 80px (constant, line 344)
- **Station Pull Radius**: 100-340px (dynamic, lines 75, 852)
- **Velocity Damping**: 0.99 for ship (line 547), 0.98 for resources (line 867)
- **Frame Target**: 60 FPS with delta time correction
- **Screen Wrapping**: All entities wrap at screen edges

## Testing the Game

**Testing Ship Weapons**:
1. Start game, collect initial resources by shooting asteroids
2. Purchase gun upgrades sequentially
3. Verify: fire rate, bullet count, bullet color, splash damage

**Testing Station Systems**:
1. Build station to level 1
2. Purchase station gun upgrades
3. Verify auto-targeting is working (watch for red/orange/yellow bullets)
4. Test passive abilities: Defense Grid (level 4), Research Lab (level 6), Production Facility (level 9)

**Testing Collisions**:
1. Let asteroids hit ship (verify damage)
2. Let asteroids hit station (verify damage and Defense Grid reduction)
3. Test resource collection (ship and station pull)

## Extension Points

The codebase is designed for easy extension:
- **Save System**: Add localStorage for `gameState` and `resources`
- **Sound Effects**: Web Audio API integration points at collision/shooting events
- **Particle Effects**: Pixi.js particle system for explosions/trails
- **Enemy Ships**: Reuse bullet/collision systems
- **Power-ups**: Use resource piece template
- **Asteroid Variants**: Different colors/sizes with special properties
- **Multiple Stations**: Array of stations with different specializations
