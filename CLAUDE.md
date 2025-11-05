# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Space Builder is a 2D space survival and base-building game built with vanilla JavaScript and Pixi.js v8.1.0. The entire game logic (~1600 lines) is contained in a single `main.js` file, with a minimal HTML entry point and CSS for UI overlays.

The game features a **4-level progression system** where players advance through different space environments (Training Zone → Asteroid Belt → Nebula Field → Alien Territory) by upgrading their ship and station to meet specific requirements.

### Controls

**Mouse Controls**:
- **Click to Lock**: Click on the game canvas to enable pointer lock mode
- **Mouse Movement**: Ship rotates to face cursor position
- **Left Mouse Button (Hold)**: Fire weapons continuously
- **ESC Key**: Unlock mouse cursor to interact with UI elements

**Keyboard Controls**:
- **Space or Backspace**: Thrust forward (ship accelerates in the direction it's facing)
- **Release thrust keys**: Ship slows down with increased damping
- **1**: Upgrade Ship Weapons
- **2**: Upgrade Station Level
- **3**: Upgrade Station Defense Guns

The ship uses manual thrust controls that:
- Rotates smoothly towards the cursor position
- Accelerates only when Space or Backspace is held
- Slows down faster when thrust is not applied (0.96 damping vs 0.99 when thrusting)
- Allows precise positioning for stationary firing

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
- `style.css` - UI overlay styles for HUD (resource counter, health bars, action list, goal progress)

### Core Architecture Pattern

The game uses a **single-file, entity-component pattern** with Pixi.js containers and graphics objects. All game logic is in `main.js`:

**Game State Structure** (lines 21-34):
```javascript
gameState = {
    currentLevel: 0-3,  // 0=Training Zone, 1=Asteroid Belt, 2=Nebula Field, 3=Alien Territory
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

**Level Configuration** (lines 37-62):
```javascript
LEVEL_CONFIG = {
    0: { name: 'Training Zone', bgColor: 0x001010, starColors: [cyan/teal],
         requirements: { stationLevel: 0, stationGunLevel: 0, shipGunLevel: 2 } },
    1: { name: 'Asteroid Belt', bgColor: 0x000000, starColors: [white/gray],
         requirements: { stationLevel: 3, stationGunLevel: 3, shipGunLevel: 3 } },
    2: { name: 'Nebula Field', bgColor: 0x0a0520, starColors: [purple/blue/pink],
         requirements: { stationLevel: 6, stationGunLevel: 6, shipGunLevel: 6 } },
    3: { name: 'Alien Territory', bgColor: 0x200a00, starColors: [orange/red/yellow],
         requirements: { stationLevel: 10, stationGunLevel: 10, shipGunLevel: 10 } }
}
```

**Entity Systems** (arrays of Pixi.Graphics objects):
- `asteroids[]` - Always 20 active asteroids with physics and collision
- `bullets[]` - Player-fired projectiles
- `stationBullets[]` - Auto-targeting station defense turrets
- `enemies[]` - Enemy ships that spawn and attack (cleared on level transitions)
- `enemyGroups[]` - Swarm coordination data (id, state, centerX/Y, targetX/Y, retreatX/Y, memberIds)
- `enemyBullets[]` - Projectiles fired by enemy ships (cleared on level transitions)
- `resourcePieces[]` - Collectible resources dropped from destroyed asteroids
- `floatingTexts[]` - Visual feedback for resource collection
- `explosions[]` - Particle effects for collisions and destruction

**Containers** (lines 133-149):
- `backgroundContainer` - Holds star field (regenerated per level)
- `gameContainer` - Holds all game entities (ship, station, asteroids, bullets, etc.)
- `cursorContainer` - Holds custom cursor crosshair visual (rendered on top)
- Layering: `backgroundContainer` → `gameContainer` → `cursorContainer`

**Custom Cursor** (lines 140-149):
- Cyan crosshair with circle and perpendicular lines
- Only visible when pointer is locked
- Position updated every frame to follow mouse movement
- Rendered in separate container to ensure it's always on top

### Game Loop Flow (main ticker, lines 1233-1966)

1. **Ship Manual Controls**: Rotation towards cursor, manual thrust with Space/Backspace keys (lines 1470-1500)
2. **Mouse-Based Shooting**: Continuous fire when left mouse button is held (lines 1502-1504)
3. **Ship Physics**: Velocity damping (0.99 when thrusting, 0.96 when coasting), screen boundary clamping
3. **Station Systems**: Rotation, auto-targeting guns, passive abilities (health regen, resource production)
4. **Bullet Updates**: Movement, lifetime, collision with asteroids/enemies, splash damage
5. **Station Bullet Updates**: Movement, collision with asteroids/enemies
6. **Asteroid Updates**: Movement, rotation, collision with ship/station/enemies, off-screen respawn
7. **Enemy Spawning**: Dynamic spawn rate based on defensive strength
8. **Enemy Updates**: AI targeting (ship priority), movement, weapon firing
9. **Enemy Bullet Updates**: Movement, collision with ship/station
10. **Collision Processing**: Player bullets vs enemies, station bullets vs enemies
11. **Resource Updates**: Magnetic pull mechanics (ship: 80px, station: 100-340px based on level)
12. **Visual Effects**: Floating text, explosion particles
13. **Health Checks**: Ship/station destruction and respawn
14. **UI Updates**: Health bars, resource count, action list, goal progress (dirty flag optimization)
15. **Level Progression**: Check requirements, boss defeat, trigger resource collection phase
16. **Resource Collection Phase**: 10-second enhanced collection with pulsing visual effects and countdown
17. **Cursor Update**: Update custom cursor position and visibility (lines 1962-1965)

### Key Code Locations

- **Input Handling**: `main.js:1142-1228` - Pointer lock, mouse tracking, keyboard shortcuts
- **Ship Manual Controls**: `main.js:1470-1500` - Rotation towards cursor, manual thrust control
- **Custom Cursor**: `main.js:140-149, 1962-1965` - Visual crosshair that follows mouse
- **Ship Weapon System**: `main.js:638-718` - `shoot()` function with multi-shot, fire rate, splash damage
- **Station Auto-Targeting**: `main.js:571-637` - Finds nearest enemy/asteroid, fires station guns with spread
- **Upgrade Actions**: `main.js:578-665` - `getActions()` generates available upgrades with costs
- **Ship Graphics**: `main.js:231-303` - `updateShipStats()` draws ship based on gun upgrade levels
- **Station Graphics**: `main.js:97-214` - `updateStationGraphics()` progressive visual upgrades per level
- **Bullet-Asteroid Collision**: `main.js:346-408` - Includes splash damage processing
- **Station Bullet Collision**: `main.js:424-481` - Auto-targeting bullets vs asteroids
- **Asteroid Physics & Collisions**: `main.js:484-563` - Movement, collisions with ship/station/enemies
- **Enemy Group System**: `main.js:1225-1301` - `createEnemyGroup()` spawns 3-7 ships in formation
- **Group AI**: `main.js:1303-1386` - `updateGroupAI()` manages swarm state machine (approach/attack/retreat/regroup)
- **Enemy Swarm Movement**: `main.js:2141-2223` - Group-based movement with formation maintenance
- **Enemy Health Bars**: `main.js:1162-1185, 1211-1227` - Health bars for bosses and large enemies (size > 25)
- **Boss Defeat Handler**: `main.js:1229-1254` - `handleBossDefeat()` destroys all enemies and drops resources
- **Boss Creation**: `main.js:1027-1061` - Adaptive HP calculation based on player weapon power
- **Player Bullets vs Enemies**: `main.js:684-709` - Collision and damage processing
- **Station Bullets vs Enemies**: `main.js:712-736` - Collision and damage processing
- **Resource Pull Mechanics**: `main.js:739-798` - Magnetic pull from ship and station
- **Resource Lifetime**: `main.js:2539-2553` - 60-second lifetime with 30-second fade-out
- **Collision Detection**: `main.js:846-851` - Simple circle-circle distance check
- **Level Progression Check**: `main.js:668-687` - `checkLevelProgression()` validates requirements (special handling for Level 0)
- **Resource Collection Phase**: `main.js:2669-2764` - 10-second phase with enhanced pull radii, visual effects, countdown, and final level handling
- **Level Transition**: `main.js:717-879` - `transitionToNextLevel()` with teleportation effects, entity cleanup, repositioning
- **Teleportation Effects**: `main.js:690-714` - `createTeleportEffect()` creates expanding ring visuals
- **Dynamic Background**: `main.js:71-88` - `createStars()` generates level-specific star fields
- **Goal Tracking UI**: `main.js:908-954` - `updateGoalProgress()` displays requirements and completion

### Level Transition System

**Resource Collection Phase** (10 seconds before transition):
- Triggered when all mission objectives are met and boss is defeated (all levels including final)
- **Enhanced Pull Radii**:
  - Ship: **3× normal radius** (80px → 240px)
  - Station: **2× normal radius** (100-340px → 200-680px based on level)
- **Enhanced Pull Strength**: Resources pulled faster (1.5-2× normal strength)
- **Visual Effects**:
  - Pulsing cyan/green/yellow circles show collection radius
  - Alternating pulse between ship and station
  - "COLLECTING RESOURCES..." message (or "VICTORY! COLLECTING RESOURCES..." on final level)
  - Countdown timer in final 10 seconds
- Resources visibly stream towards ship and station
- **After 10 seconds**:
  - Levels 0-2: Automatic transition to next level
  - Level 3 (Final): "GAME COMPLETE! All sectors conquered!" message displayed

**Teleportation Visual Effect** (lines 690-714):
- Creates 5 expanding rings for ship and station
- Rings use level-specific colors from `LEVEL_CONFIG.starColors`
- Rings scale and fade over 60 frames
- Returns array of ring graphics for lifecycle tracking

**Transition Animation** (lines 717-879):
- **Phase 1 (frames 0-30)**: Fade out ship/station (alpha 1→0), animate old teleport rings
- **Phase 2 (frame 30)**: Cleanup old rings with thorough destruction (`.clear()`, `.destroy()`), update background, reposition entities to center, clear enemies/bullets, respawn asteroids, create new teleport rings, show level announcement
- **Phase 3 (frames 30-60)**: Fade in ship/station (alpha 0→1), animate new teleport rings
- **Cleanup**: All rings destroyed thoroughly using `.clear()` and `.destroy({ children: true, texture: true, baseTexture: true })`

**Critical Cleanup Pattern** (lines 759-777, 853-871):
```javascript
// Thorough ring cleanup to prevent visual artifacts
ring.clear();  // Clear graphics data
ring.parent.removeChild(ring);  // Remove from display tree
ring.destroy({ children: true, texture: true, baseTexture: true });  // Complete destruction
```

### Physics System

**Ship Manual Controls** (lines 1470-1500):
- **Rotation Tracking**: Calculates angle to cursor and rotates smoothly towards it
- **Smooth Rotation**: Rotates towards cursor with normalized angle difference
- **Manual Thrust**: Applies thrust only when Space or Backspace is pressed
- **Variable Damping**: 0.99 damping when thrusting, 0.96 when coasting for faster stops
- **Engine Visual**: Shows engine flame only when thrust keys are pressed

**General Movement**:
- Momentum-based with velocity damping (0.99 when thrusting, 0.96 when coasting)
- Screen boundary clamping for ship (stops at edges)
- Screen wrapping for asteroids (teleport to opposite edge when off-screen)
- Delta time correction for frame rate independence (`time.deltaTime`)

**Collision Detection** (lines 846-851):
- Circle-circle distance checks only
- Collision radii stored as `obj.r` property
- Used for: ship-asteroid, station-asteroid, bullet-asteroid, bullet-enemy, resource collection

### Upgrade Systems

**Three Independent Upgrade Paths**:

1. **Ship Weapons** (1-10 levels):
   - Cost formula: `150 × 1.4^(level-1)` (starts at 0 for level 1)
   - Progressive features: fire rate ↑, multi-shot (1→3→5→7), splash damage (level 7+), resource multipliers
   - Visual progression in ship graphics (lines 245-298)
   - Gun level names: Basic Gun, Rapid Fire, Heavy Cannons, Triple Shot, Plasma Weapons, Laser Barrage, Ion Pulse, Quantum Cannons, Antimatter Guns, Singularity Weapon

2. **Station Construction** (1-10 levels):
   - Cost formula: `100 × 1.5^(level-1)`
   - Each level adds: HP (+200), visual elements, special abilities
   - Level 2: Solar Array (resource pull starts)
   - Level 4: Defense Grid (70% damage reduction)
   - Level 6: Research Lab (ship health regen)
   - Level 9+: Production Facility (passive resource generation)
   - Pull radius formula: `100 + min(level-2, 8) × 30` (100-340px)
   - Module names: Core Module, Solar Array, Docking Bay, Defense Grid, Mining Hub, Research Lab, Command Center, Shield Generator, Production Facility, Mega Station

3. **Station Guns** (0-10 levels, requires Station Level 1+):
   - Cost formula: `200 × 1.5^level`
   - Auto-targeting system prioritizes enemies over asteroids
   - Progressive: fire rate ↑ (1000ms→300ms), bullet count ↑ (1-6), range ↑ (220-400px), splash damage (level 6+)
   - Completely automated - no player input required
   - Gun names: Defense Turret, Twin Cannons, Missile Battery, Flak Array, Beam Weapons, Point Defense, Railguns, Particle Beams, Nova Cannons, Titan Weapon Array

### Resource System

**Resource Flow**:
1. **Asteroids** contain resources (`radius × 2`)
2. Shooting asteroids drops green resource pieces
3. **Enemy ships** drop resources on destruction (`size × 3`, 3-5 pieces)
4. **Boss ships** drop **10× resources** (`size × 30`, 15+ pieces)
5. When boss is defeated, all remaining enemies destroyed and drop resources
6. **Resource Lifetime**:
   - 0-30 seconds: Full brightness (alpha 1.0)
   - 30-60 seconds: Gradually fades out (alpha 1.0 → 0.0)
   - 60+ seconds: Disappears completely if not collected
7. Pieces are magnetically pulled by ship (80px) or station (100-340px based on level)
8. Collection grants resources with floating text feedback
9. Resources purchase upgrades via action list

**Resource Multipliers**:
- Ship weapons: 1× (basic) → 1.5× (level 4) → 2× (level 8) → 3× (level 10)
- Station guns: 1× (basic) → 1.5× (level 4) → 2× (level 7) → 2.5× (level 10)
- Higher weapon levels can instantly destroy large asteroids (level 3+)

### Level Progression System

**Four Progressive Levels** with distinct visual environments and increasing challenges:

**Level 0: Training Zone** (Tutorial level)
- Background: Dark cyan space (0x001010)
- Stars: Cyan and teal tones
- Requirement to advance: Ship Guns level 2 only (no station required)
- Gameplay: Learn shooting mechanics, get comfortable with controls
- Special handling: `checkLevelProgression()` and `updateGoalProgress()` have Level 0 specific logic

**Level 1: Asteroid Belt**
- Background: Black space (0x000000)
- Stars: White and gray tones
- Requirements to advance: Station Level 3, Station Guns 3, Ship Guns 3
- Gameplay: Establish station, learn base building

**Level 2: Nebula Field**
- Background: Dark purple space (0x0a0520)
- Stars: Purple, blue, pink nebula colors
- Requirements to advance: Station Level 6, Station Guns 6, Ship Guns 6
- Gameplay: Increased enemy difficulty, more complex combat

**Level 3: Alien Territory** (Final level)
- Background: Dark red space (0x200a00)
- Stars: Orange, red, yellow alien colors
- Victory condition: Station Level 10, Station Guns 10, Ship Guns 10
- Gameplay: Maximum difficulty, ultimate upgrades

**Goal Tracking UI** (lines 908-954):
- Displays current level requirements dynamically
- Shows checkmarks (✓) for completed requirements, circles (○) for incomplete
- Level 0: Shows only Ship Guns requirement
- Levels 1-2: Shows "Advance to [Next Level]" with 3 requirements
- Level 3: Shows "Complete all goals to win!" with victory condition
- CSS classes `.goal-item.completed` turn green and bold
- Victory message appears when all Level 3 goals achieved

### Special Mechanics

**Splash Damage**:
- Ship weapons: Level 7+ with radius 20-50px (calculated in `shoot()`)
- Station guns: Level 6+ with radius 15-35px
- Processes all asteroids within splash radius on bullet hit
- Used in both bullet-asteroid and station bullet-asteroid collision handlers

**Auto-Targeting AI** (lines 254-330):
- Prioritizes enemies over asteroids (checks enemies first)
- Finds nearest target within range (220-400px based on gun level)
- Calculates angle to target with `Math.atan2()`
- Fires spread of bullets (1-6 based on gun level) with spread angle
- Independent cooldown system (930-300ms based on gun level)

**Enemy System**:
- **Swarm Behavior**: Enemies spawn in coordinated groups of 3-7 ships
- **Formation Types**: V-formation, line formation, or diamond formation (randomly selected)
- **Group AI States**:
  - **Approaching**: Move towards player/station area in formation
  - **Attacking**: Engage for 5-8 seconds while maintaining loose formation
  - **Retreating**: Pull back to safe distance at increased speed (1.3× normal)
  - **Regrouping**: Reform at retreat point for 2-3 seconds at reduced speed (0.7× normal)
- **Individual Behavior**: Each ship maintains formation offset while group moves
- **Combat Targeting**: Ships rotate to face nearest threat (ship/station) for firing
- **Fire Discipline**: Only fire during 'attacking' or 'approaching' states
- **Boss Behavior**:
  - Bosses operate independently without group coordination
  - Larger size with distinctive visuals (glowing cores, multiple weapon arrays, name labels)
  - Use burst-fire patterns (2-5 shots per burst with 3-bullet spreads)
  - **Adaptive HP**: Scales with player's weapon power (30-50 volleys to defeat)
    - Calculation: `(gunLevel × 5) × (bullets × 0.7) × (30-50)`
    - Example: gunLevel 2 = 500 HP, gunLevel 6 = ~4200 HP, gunLevel 10 = ~10000 HP
    - Minimum 500 HP to ensure challenge
  - Health bars always visible with color-coded status
  - Drop **10× resources** on defeat (15+ pieces vs 3+ for regular enemies)
  - **Upon defeat**: All remaining enemy ships destroyed instantly and drop resources
  - Victory messages: "[Boss Name] DEFEATED!" and "ALL ENEMIES DESTROYED!"
- **Dynamic Spawning**: Faster spawn rate with higher defensive strength
- **Enemy Diversity**: Multiple enemy types per sector with different stats (speed, health, damage)

**Damage System**:
- Asteroids damage on collision: `radius × 0.5 × defenseMultiplier`
- Ship health: 100 HP, respawns at center when destroyed (resources preserved)
- Station health: `level × 200`, destroyed station must be rebuilt from level 0
- Defense Grid (level 4+): Reduces station damage to 30% (0.3 multiplier)
- Enemy damage: Size-based, 5-12 damage per bullet

### Performance Optimizations

**Dirty Flag System** (lines 826-831):
- UI only rebuilds when resources change or upgrades occur (`actionsNeedUpdate` flag)
- Prevents unnecessary DOM manipulation every frame
- Set when: upgrades purchased, station destroyed

**Fixed Entity Count**:
- Always 20 asteroids (constant spawning via `createAsteroid({ offscreen: true })`)
- Asteroids spawn outside screen edges (100px margin)
- Efficient circle-circle collision only

**Memory Management**:
- Thorough cleanup of teleportation ring graphics (prevents visual artifacts)
- Explosion particles removed after lifetime expires
- Bullets removed when off-screen or lifetime expires
- Enemies removed when far off-screen (200px margin)

**Hot Path Optimization**:
- No garbage creation in game loop where possible
- Efficient splice operations for entity removal (iterate backwards)
- Hardware-accelerated rendering via Pixi.js WebGL
- Delta time correction prevents frame rate dependency

## Common Development Patterns

### Adding New Upgrade Tiers
1. Extend arrays in `getActions()` (lines 578-665)
2. Update cost formulas (exponential scaling: 1.4× for ship, 1.5× for station)
3. Add visual elements in `updateShipStats()` or `updateStationGraphics()`
4. Add gameplay effects in game loop (weapon fire, collision, abilities)
5. Update line number references in CLAUDE.md

### Adding New Levels
1. Add entry to `LEVEL_CONFIG` with `name`, `bgColor`, `starColors[]`, `requirements{}`
2. Update `checkLevelProgression()` max level check (currently 3)
3. Add special case to `updateGoalProgress()` if needed
4. Consider adding special mechanics or enemy types for the level

### Adding New Entity Types
1. Create array to hold entities (e.g., `const powerups = []`)
2. Create factory function (follow `createAsteroid()` pattern, lines 442-492)
3. Add update loop in game ticker
4. Add collision detection with existing entities
5. Add to `gameContainer` for rendering
6. Add cleanup logic for level transitions if needed

### Modifying Weapon Behavior
- **Fire Rate**: Adjust cooldown in `shoot()` (line 314) or station guns (line 256)
- **Bullet Properties**: Modify speed, size, damage, color (lines 320-339 for ship, 297-306 for station)
- **Multi-Shot**: Change bullet count and spread angle (lines 325-328, 294)
- **Splash Damage**: Adjust `splashRadius` calculation (lines 360-362 for ship, 321-323 for station)

### Adding Visual Feedback
Use `createFloatingText()` (lines 391-408) for any game event that should show player feedback. Already used for:
- Resource collection (on piece pickup)
- Ship destruction
- Station destruction
- Passive resource generation (Production Facility)
- Level transition announcements

### Debugging Visual Artifacts
When adding new graphics that animate or transition:
1. Track graphics objects in arrays for lifecycle management
2. Use thorough cleanup pattern: `.clear()`, `.parent.removeChild()`, `.destroy({ children: true, texture: true, baseTexture: true })`
3. Check for graphics objects still in display tree after they should be removed
4. Use try-catch during cleanup to prevent errors from blocking other cleanup
5. Reference teleportation ring cleanup (lines 759-777, 853-871) as example

## Important Constants

- **Asteroid Count**: 20 (constant, line 440)
- **Ship Pull Radius**: 80px (constant, line 382)
- **Station Pull Radius**: 100-340px (dynamic, formula at lines 112, 757)
- **Velocity Damping**: 0.99 when thrusting, 0.96 when coasting
- **Frame Target**: 60 FPS with delta time correction
- **Transition Duration**: 60 frames (1 second at 60fps, line 733)
- **Teleport Rings**: 5 rings per effect (line 691)
- **Spawn Margins**: 100px for asteroids (line 463), 50px for enemies (line 543)
- **Resource Lifetime**: 3600 frames (60 seconds at 60fps)
- **Resource Fade Start**: 1800 frames (30 seconds at 60fps)

### Input System

**Pointer Lock** (lines 1148-1164):
- Click canvas to request pointer lock
- ESC key to exit pointer lock
- Canvas cursor hidden when locked, default cursor shown when unlocked
- Pointer lock state tracked via `pointerlockchange` event

**Mouse Tracking** (lines 1167-1182):
- **Locked Mode**: Uses `movementX/Y` deltas, cursor clamped to screen bounds
- **Unlocked Mode**: Uses absolute `clientX/Y` position relative to canvas
- Cursor position stored in `cursorX` and `cursorY` variables
- Updated continuously via `mousemove` event

**Mouse Button Handling** (lines 1184-1195):
- Left mouse button tracked in `mousePressed` boolean
- Enables continuous shooting in game loop (lines 1279-1282)

**Keyboard Shortcuts** (lines 1197-1228):
- **ESC**: Exit pointer lock
- **1 / Numpad1**: Trigger ship weapon upgrade (simulates button click)
- **2 / Numpad2**: Trigger station level upgrade (simulates button click)
- **3 / Numpad3**: Trigger station gun upgrade (simulates button click)

## Testing the Game

**Testing Controls**:
1. Start game and click canvas to lock cursor
2. Move mouse around - ship should rotate to face cursor
3. Hold Space or Backspace - ship should accelerate forward and show engine flames
4. Release thrust keys - ship should slow down gradually (faster than when thrusting)
5. Hold left mouse button - ship should fire continuously
6. Press ESC to unlock cursor
7. Press 1, 2, 3 keys to test upgrade shortcuts (when resources available)

**Testing Level Progression**:
1. Start game in Training Zone (Level 0)
2. Upgrade ship guns to level 2 and defeat Protocol Override boss
3. Verify boss defeat effects:
   - "[Boss Name] DEFEATED!" message appears
   - All remaining enemy ships explode instantly
   - "ALL ENEMIES DESTROYED!" message appears
   - Large amount of resources (10× normal) drop from boss location
   - Resources drop from destroyed enemy ships as well
4. Observe 10-second resource collection phase:
   - "COLLECTING RESOURCES..." message appears
   - Pulsing cyan/green circles appear around ship and station
   - Resources visibly stream towards ship (3× range) and station (2× range)
   - Countdown timer shows remaining seconds
5. After 10 seconds, verify teleportation effects: rings appear, ship/station fade out/in, background changes
6. Check that no ring artifacts remain after transition
7. Continue through levels 1-2 testing transitions and resource collection phases
8. On final level (Level 3 - Alien Territory):
   - Defeat Xenarch Prime boss with all objectives complete
   - Verify "VICTORY! COLLECTING RESOURCES..." message
   - After 10-second collection phase, see "GAME COMPLETE! All sectors conquered!" message
   - Game continues (no transition to non-existent level 4)

**Testing Ship Weapons**:
1. Start game, lock cursor, collect initial resources by shooting asteroids
2. Purchase gun upgrades sequentially using [1] key or clicking [1] button (watch for visual changes)
3. Verify: fire rate ↑, bullet count (1/3/5/7), bullet color progression, splash damage (level 7+)
4. Test continuous shooting by holding left mouse button

**Testing Station Systems**:
1. Build station to level 1 (after Level 0)
2. Purchase station gun upgrades
3. Verify auto-targeting is working (watch for red/orange/yellow bullets)
4. Test resource pull (should see pieces attracted from further away)
5. Test passive abilities: Defense Grid (level 4), Research Lab (level 6), Production Facility (level 9)

**Testing Enemy Swarm System**:
1. Wait for enemy group spawns (3-7 ships in formation)
2. Observe group formations: V-formation, line, or diamond
3. Watch swarm behavior cycle:
   - Approaching: Group moves together towards combat area
   - Attacking: Ships engage while maintaining loose formation
   - Retreating: Group pulls back at higher speed
   - Regrouping: Formation reforms before next approach
4. Verify ships only fire during attacking/approaching states
5. Test that killing some ships doesn't break group coordination
6. Check that bosses operate independently without formations
7. Verify station guns prioritize enemies over asteroids

**Testing Collisions**:
1. Let asteroids hit ship (verify damage)
2. Let asteroids hit station (verify damage and Defense Grid reduction)
3. Test resource collection (ship and station pull)
4. Let enemy bullets hit ship/station

**Testing Resource Lifetime**:
1. Shoot asteroids to create resource pieces
2. Observe resources remain at full brightness for 30 seconds
3. After 30 seconds, watch resources gradually fade out
4. At 60 seconds, verify resources disappear completely if not collected
5. Test that collecting fading resources still works normally

## Extension Points

The codebase is designed for easy extension:
- **Save System**: Add localStorage for `gameState` and `resources`
- **Sound Effects**: Web Audio API integration points at collision/shooting events
- **More Levels**: Extend `LEVEL_CONFIG`, add victory screen after level 3
- **Additional Boss Mechanics**: Special abilities, multi-phase fights, different attack patterns
- **Power-ups**: Use resource piece template with special effects
- **Asteroid Variants**: Different colors/sizes with special properties
- **Multiple Stations**: Array of stations with different specializations
- **Achievements**: Track stats and unlock rewards
