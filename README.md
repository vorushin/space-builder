# Space Builder

A 2D space survival and base-building game built with JavaScript and Pixi.js. Mine asteroids, build a massive space station, and upgrade your ship's weapons to survive in the cosmos.

## Game Overview

Space Builder is a resource management and combat game where you pilot a ship to mine asteroids, collect resources, and build an increasingly powerful space station. Asteroids are dangerous - they damage your ship and station on contact. You must shoot them to break them down into collectible resource pieces.

## Core Mechanics

### **Resource Mining System**
- **Shooting Asteroids**: Large asteroids split into smaller pieces when shot
- **Resource Drops**: Small asteroids drop green resource pieces when destroyed
- **Magnetic Pull**: Ship pulls in resources within 80px radius
- **Station Collection**: Station automatically collects resources within range (100-340px based on level)
- **Floating Text**: Visual feedback shows +X resources when collected

### **Damage & Survival**
- **Asteroid Collisions**: Asteroids damage ship and station on contact (damage = radius × 0.5)
- **Ship Health**: 100 HP base, respawns at center when destroyed
- **Station Health**: 200-2000 HP based on level, destroyed station must be rebuilt
- **Health Regeneration**: Level 6+ stations slowly regenerate ship health

### **Physics & Movement**
- **Realistic Physics**: Momentum-based movement with velocity damping (0.99/frame)
- **Thrust System**: Forward/reverse thrust affects velocity
- **Rotation**: Smooth rotation controls
- **Screen Wrapping**: All objects wrap around screen edges

## Upgrade Systems

### **Ship Weapons (10 Levels)**
Progressive weapon upgrades with exponential cost scaling (150 × 1.4^level):

| Level | Name | Cost | Fire Rate | Bullets | Features |
|-------|------|------|-----------|---------|----------|
| 1 | Basic Gun | FREE | 18.5 frames | 1 | Yellow bullets, starts equipped |
| 2 | Rapid Fire | 150 | 17 frames | 1 | Faster firing |
| 3 | Heavy Cannons | 210 | 15.5 frames | 1 | Instantly destroys large asteroids |
| 4 | Triple Shot | 294 | 14 frames | 3 | Spread shot, 1.5× resources |
| 5 | Plasma Weapons | 412 | 12.5 frames | 3 | Magenta plasma |
| 6 | Laser Barrage | 576 | 11 frames | 5 | Cyan lasers |
| 7 | Ion Pulse | 807 | 9.5 frames | 5 | 20px splash damage |
| 8 | Quantum Cannons | 1130 | 8 frames | 7 | 30px splash, 2× resources |
| 9 | Antimatter Guns | 1582 | 6.5 frames | 7 | 40px splash |
| 10 | Singularity Weapon | 2214 | 5 frames | 7 | 50px splash, 3× resources |

**Special Features:**
- Multi-shot progression: 1 → 3 → 5 → 7 bullets
- Splash damage at level 7+ destroys multiple asteroids
- Resource multipliers increase with level
- Bullet colors: Yellow → Magenta → Cyan → Blue → Purple → Red → White

### **Station Levels (10 Levels)**
Base construction with exponential cost scaling (100 × 1.5^level):

| Level | Name | Cost | HP | Pull Radius | Special Abilities |
|-------|------|------|-----|-------------|-------------------|
| 1 | Core Module | 100 | 200 | - | Basic structure |
| 2 | Solar Array | 150 | 400 | 100px | Resource pull begins |
| 3 | Docking Bay | 225 | 600 | 130px | - |
| 4 | Defense Grid | 338 | 800 | 160px | 70% damage reduction |
| 5 | Mining Hub | 506 | 1000 | 190px | Enhanced collectors |
| 6 | Research Lab | 759 | 1200 | 220px | Ship health regen (0.1/frame) |
| 7 | Command Center | 1139 | 1400 | 250px | Command bridge |
| 8 | Shield Generator | 1708 | 1600 | 280px | Energy shields |
| 9 | Production Facility | 2562 | 1800 | 310px | +1 resource/2 sec |
| 10 | Mega Station | 3844 | 2000 | 340px | +2 resource/2 sec |

**Special Features:**
- Growing pull radius (100-340px)
- Pull strength increases with level
- Defense Grid reduces asteroid damage by 70%
- Research Lab provides passive ship healing
- Production Facility generates passive income

### **Station Guns (10 Levels)**
Automated defense turrets with exponential cost scaling (200 × 1.5^level):

| Level | Name | Cost | Fire Rate | Bullets | Range | Features |
|-------|------|------|-----------|---------|-------|----------|
| 1 | Defense Turret | 200 | 930ms | 1 | 220px | Red bullets |
| 2 | Twin Cannons | 300 | 860ms | 1 | 240px | - |
| 3 | Missile Battery | 450 | 790ms | 2 | 260px | Orange bullets |
| 4 | Flak Array | 675 | 720ms | 2 | 280px | 1.5× resources |
| 5 | Beam Weapons | 1013 | 650ms | 3 | 300px | Yellow bullets |
| 6 | Point Defense | 1519 | 580ms | 3 | 320px | 15px splash |
| 7 | Railguns | 2279 | 510ms | 4 | 340px | Green bullets, 20px splash, 2× resources |
| 8 | Particle Beams | 3418 | 440ms | 4 | 360px | 25px splash |
| 9 | Nova Cannons | 5127 | 370ms | 5 | 380px | Cyan bullets, 30px splash |
| 10 | Titan Weapon Array | 7691 | 300ms | 6 | 400px | 35px splash, 2.5× resources |

**Special Features:**
- Fully automated targeting and firing
- Auto-targets nearest asteroid within range
- Independent upgrade path from ship guns
- Requires Station Level 1+
- Visual turret indicators on station

### **Ship Upgrades**
- **Speed**: Increases thrust and rotation (cost: level × 50)
- **Size**: Increases ship scale and collision radius (cost: level × 100)

## Controls

*   **Up Arrow / W:** Thrust forward
*   **Down Arrow / S:** Reverse thrust
*   **Left Arrow / A:** Rotate left
*   **Right Arrow / D:** Rotate right
*   **Spacebar:** Shoot

## Technical Architecture

### **Project Structure**
*   `index.html`: Entry point, loads Pixi.js v8.1.0 and game scripts
*   `style.css`: UI overlay styles for HUD elements
*   `main.js`: All game logic (~850 lines)
    - Game state management
    - Physics simulation
    - Collision detection (circle-circle)
    - Entity systems (ship, station, asteroids, bullets, resource pieces)
    - Upgrade system
    - Auto-targeting AI for station guns

### **Game State Structure**
```javascript
gameState = {
    stationLevel: 0-10,        // Station construction level
    stationHealth: number,      // Current HP
    stationMaxHealth: number,   // Max HP (level × 200)
    stationGunLevel: 0-10,     // Station weapon level
    ship: {
        speedLevel: number,     // Speed upgrade level
        sizeLevel: number,      // Size upgrade level
        gunLevel: 1-10,        // Weapon level (starts at 1)
        health: number,         // Current HP
        maxHealth: 100          // Max HP
    }
}
resources: number              // Player's resource count
```

### **Entity Systems**

**Asteroids (20 constant)**
- Irregular 8-sided polygons
- Radius: 15-35px
- Resources: radius × 2
- Velocity: -1 to +1 px/frame in x/y
- Rotation: -0.025 to +0.025 rad/frame
- Wrap around screen edges

**Bullets (Ship & Station)**
- Ship bullets: Player-controlled firing
- Station bullets: Auto-targeting system
- Collision detection with asteroids
- Lifetime-based (60-150 frames)
- Splash damage at higher levels

**Resource Pieces**
- Dropped when asteroids destroyed
- 3px green circles
- Pulled by ship (80px) and station (100-340px)
- Velocity damping (0.98/frame)
- Collectible on contact

**Floating Text**
- Shows resource gain (+X)
- Floats upward
- Fades over 60 frames
- Spawns at collection point

### **Performance Optimizations**
- UI updates only when resources change (dirty flag system)
- Fixed asteroid count (20) with efficient spawning
- Screen wrapping instead of infinite world
- Hardware-accelerated rendering via Pixi.js
- Efficient collision detection (circle-circle only)

### **Visual Feedback**
- Ship health/station health display
- Resource counter
- Progressive visual upgrades for ship weapons
- Progressive visual upgrades for station (structure + guns)
- Pull radius indicators (green circles)
- Floating text for resource collection
- Color-coded bullets by weapon level

## Extension Points for AI

### **Easy to Add:**
1. **New Upgrade Tiers**: Add levels 11-20 by extending arrays and formulas
2. **New Station Modules**: Add specialized buildings (shield generators, refineries)
3. **Enemy Ships**: Use existing bullet/collision systems
4. **Power-ups**: Temporary boosts using resource piece template
5. **Asteroid Variants**: Different colors/sizes with special properties
6. **Sound Effects**: Web Audio API integration points already structured
7. **Particle Effects**: Pixi.js particle system for explosions/trails
8. **Save System**: localStorage for gameState persistence

### **Key Code Locations:**
- Ship weapons: `main.js:234-288` (shoot function)
- Station guns: `main.js:544-608` (auto-targeting)
- Upgrade actions: `main.js:370-475` (getActions)
- Ship graphics: `main.js:162-220` (updateShipStats)
- Station graphics: `main.js:57-177` (updateStationGraphics)
- Collision detection: `main.js:529-759` (bullet/asteroid/resource)
- Game loop: `main.js:486-900` (ticker callback)

### **Formula Reference:**
- Ship gun cost: `150 × 1.4^(level-1)`
- Station level cost: `100 × 1.5^(level-1)`
- Station gun cost: `200 × 1.5^level`
- Station health: `level × 200`
- Ship pull radius: `80px` (constant)
- Station pull radius: `100 + min(level-2, 8) × 30`
- Asteroid damage: `radius × 0.5 × defenseMultiplier`

## Game Loop Flow

1. **Input Processing**: Read keyboard state, fire weapons
2. **Station Systems**: Auto-targeting, shooting, passive abilities
3. **Bullet Updates**: Movement, lifetime, collision detection
4. **Asteroid Updates**: Movement, rotation, collision with ship/station
5. **Resource Updates**: Movement, pull mechanics, collection
6. **Health Checks**: Ship/station destruction and respawn
7. **UI Updates**: Health bars, resource count, action list

## Performance Characteristics

- **60 FPS target** with delta time correction
- **~20 asteroids** maximum at any time
- **Variable bullet count** based on weapon levels (1-7 per shot)
- **Efficient collision**: Circle-circle distance checks only
- **Dirty flag system**: UI rebuilds only when needed
- **No garbage creation** in hot paths (game loop optimized)

## Future Enhancement Ideas

- Multiplayer (WebSocket sync)
- Procedural missions/objectives
- Tech tree system
- Multiple station locations
- Asteroid belts/zones
- Boss encounters
- Achievement system
- Leaderboards
- Mobile touch controls
- Gamepad support
