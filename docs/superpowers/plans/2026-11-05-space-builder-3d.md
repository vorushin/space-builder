# SPACE BUILDER 3D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 2D Pixi game with a 2.5D Three.js twin-stick shooter and station builder (4 sectors, waves, bosses, modules), keeping the old game at `/classic/`.

**Architecture:** Gameplay runs on the XZ plane with a tilted perspective camera. Pure, tested logic lives in `src/logic` (economy, layout, waves, director, save, grid, targeting) and is driven by data in `src/config`. Entities in `src/world` own their meshes and behaviours. `src/render` holds the stage, procedural models and FX. `src/ui` is a DOM overlay. `src/game.ts` wires the systems together in one update loop.

**Tech Stack:** three ^0.187, TypeScript ~5.9, Vite ^7.3, Vitest ^4.1, with WebAudio for sound and no external assets.

**Spec:** `docs/superpowers/specs/2026-11-05-space-builder-3d-design.md`

## Global Constraints

- The game is a static build. `vercel.json` sets `{"framework":"vite","buildCommand":"npm run build","outputDirectory":"dist"}`.
- The old game is served unchanged from `public/classic/` at `/classic/`.
- Keep Robert's names verbatim: sectors, enemies, bosses, the 10 gun tiers, and module/tier names from the spec tables.
- The play plane is XZ (y up). Heading θ means the direction `(cos θ, sin θ)`. Models point their nose along +X. Mesh yaw is `rotation.y = -θ`.
- Camera sits south of the target looking north. Screen up is −Z and screen right is +X. WASD is screen-relative.
- Frame `dt` is clamped to 0.05 s. All gameplay uses `dt * timeScale` (slow-mo, hit-stop and build mode use `timeScale`).
- No `alert`/`confirm`. DOM buttons must not keep focus (Space must never re-trigger a button).
- Dev hooks are only active with `?dev`. `window.__game` is always exposed (read-only use in tests).

## Review Focus

1. **Window resize or odd aspect ratios** (small laptop, ultra-wide, iPad portrait). The camera zoom adapts so the ship's surroundings stay visible, and the HUD and build bar never overlap or overflow. Check in Task 12 at 1512×791, 1024×768 and 820×1180.
2. **Tab hidden or alt-tab mid-wave.** `dt` is clamped, the game auto-pauses on `visibilitychange`/`blur`, and music stops. Check in Task 8 by hiding the tab for 10 s with no deaths.
3. **Clicking a DOM button and then pressing Space.** That must dash and not press the button again. Buttons use `pointerdown` + `preventDefault` and `tabindex=-1`. Check in Task 6.
4. **A corrupt or foreign localStorage save** (including keys from the classic game). The title screen still works and the bad save is ignored. Test: `decodeCheckpoint` garbage cases in Task 2.
5. **Endless runs.** Entity counts stay bounded (crystals ≤ 400 with merging, particles ≤ 4000, debris ≤ 600, bolts ≤ 1500) and fps stays stable. Check in Task 12 with `__game.stats()` after dev skip to endless.

---

### Task 1: Scaffold, classic move, stage that renders

**Files:**
- Move: `index.html main.js style.css src/` → `public/classic/` (the old game's `src/` imports are relative, so it works there unchanged)
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vercel.json`, `index.html`, `src/main.ts`, `src/render/stage.ts`, `src/render/background.ts`, `src/ui/style.css`
- Modify: `.gitignore` (add `node_modules`, `dist`)

**Interfaces:**
- Produces: `class Stage { renderer; scene; camera; target: Vector3; zoom: number; constructor(container: HTMLElement); setAtmosphere(look: SectorLook): void; screenToWorld(px: number, py: number): {x:number; z:number}; shake(amount: number): void; update(dt: number): void; render(): void; resize(): void }`
- Produces: `class Background { constructor(scene: Scene); setLook(look: SectorLook): void; update(dt: number, camTarget: Vector3): void }`, covering 3 star layers, nebula sprites, the planet below the plane and the sun glow.

- [ ] Step 1: `git mv` the old game into `public/classic/` and confirm `npx vite` serves `/classic/` with the Pixi game.
- [ ] Step 2: Set up the stage with ACES tone mapping, UnrealBloom (strength ~0.9, threshold ~0.6), hemisphere + key + rim lights, and pixel ratio `min(dpr, 2, sqrt(7.5e6/(w*h)))`.
- [ ] Step 3: Verify that `npm run build` passes and that the dev server shows a planet and stars in Chrome.
- [ ] Step 4: Commit.

### Task 2: Pure logic with tests

**Files:** `src/logic/{math,grid,economy,layout,waves,director,save,targeting}.ts`, `src/config/{balance,guns,modules,sectors}.ts`, `tests/*.test.ts`

**Interfaces (produced):**
- `math.ts`: `type V2={x:number;z:number}`, `dist`, `dist2`, `angleTo(from,to)`, `wrapAngle`, `turnToward(cur,target,maxStep)`, `damp(cur,target,lambda,dt)`, `clamp`, `lerp`, `class Rng(seed){next();range(a,b);int(a,b);pick(arr);chance(p)}`
- `grid.ts`: `class SpatialGrid<T extends {x:number;z:number;r:number}>(cell) { clear(); insert(t); query(x,z,r,out:T[]):T[] }`
- `economy.ts`: `gunUpgradeCost(tier): number|null`, `moduleCost(kind, tier): number|null` (tier 0 = build), `sellValue(kind, tier): number` (half of everything spent), `expansionCost(ring): number|null`, `difficultyMods(d): {enemyHp; enemyDmg; crystals}`
- `layout.ts`: `RING_RADII=[5.5,10.5,15.5]`, `RING_SOCKETS=[4,6,8]`, `socketsFor(rings): Socket[]` (stable ids 0–3, 4–9, 10–17), `nearestFreeSocket(sockets, occupied:Set<number>, x, z, maxDist)`, `moduleUnlocked(kind, sector)`, `ringUnlocked(ring, sector)`
- `waves.ts`: `buildWave(sector: SectorDef, wave: number, rng: Rng, d: Difficulty): SpawnOrder[]` with `SpawnOrder={at:number; enemy:string; count:number; dir:number; boss?:boolean}`, plus `buildEndlessWave(level, rng, d)`
- `director.ts`: `class Director(waveCount, timings) { phase:'calm'|'warning'|'wave'|'cleared'|'sectorClear'; wave; timer; update(dt, enemiesAlive): DirectorEvent[]; callEarly(): boolean; load(orders: SpawnOrder[]) }`. Events are `calm|warning|waveStart|spawn|waveCleared|sectorClear`.
- `save.ts`: `Checkpoint {v:1; sector; crystals; gunTier; rings; modules:{socket;kind;tier}[]; sparky; difficulty; endless}`, `encodeCheckpoint`, `decodeCheckpoint(s): Checkpoint|null`
- `targeting.ts`: `nearest(items, x, z, range, filter?)`, `leadAim(from, target:{x,z,vx,vz}, speed): V2`

Tests that must exist:
- [ ] `economy`: tier-10 gun upgrade is `null`; costs strictly increase; `sellValue('turret',1)` = ½(build + tier-1 upgrade).
- [ ] `layout`: 4/10/18 sockets for 1/2/3 rings, every socket at its ring radius ±1e-9, ids unique and stable across expansions; Tesla locked in sector 0 and unlocked in sector 2.
- [ ] `waves`: per-wave enemy totals match config × difficulty, `at` non-decreasing, distinct directions ≥ 80° apart, and the last wave of each sector contains exactly one `boss: true` order.
- [ ] `director`: calm counts down to warning to waveStart; spawn events fire at `at`; cleared only when orders are empty and `enemiesAlive==0`; `callEarly` works only in calm; after the last wave clears comes `sectorClear`.
- [ ] `save`: round trip; `null`/`"{"`/`"[]"`/classic-game-shaped JSON give `null`; negative crystals clamp to 0; gun tier clamps to 1..10; modules on missing sockets or duplicate sockets are dropped.
- [ ] `grid`/`targeting`: the query finds near items and excludes far ones; `nearest` respects range and filter; `leadAim` hits a constant-velocity target.
- [ ] Run `npx vitest run`: all pass. Commit.

### Task 3: Procedural models and FX

**Files:** `src/render/models.ts`, `src/render/fx.ts`, `src/render/materials.ts`

**Interfaces (produced):**
- `models.ts`: `makeShip(tier): Group`, `makeAsteroid(size, kind, look, rng): Mesh`, `makeCrystalGeometry()`, `makeEnemy(def: EnemyDef): Group`, `makeBoss(id): BossRig` (parts by name), `makeStationCore()`, `makeRing(ring)`, `makeModule(kind, tier): Group` (`userData.head` = the part that aims), `makeDrone(kind)`, `makePickup(kind)`
- `fx.ts`: `class Fx(scene, stage) { sparks(x,y,z,color,n,speed); debris(x,z,color,n); explosion(x,z,size,color); ring(x,z,radius,color); lightning(a:Vector3,b:Vector3,color); beam(...); text(x,z,str,cls); trail(id, pos, color); update(dt) }`. It uses one `Points` (additive) for sparks, an `InstancedMesh` for debris and a pool for rings. Floating text is DOM projected each frame.

- [ ] Add a dev-only `?models` gallery scene that shows every model in a grid (for a visual check in Chrome). Screenshot it and check that silhouettes read at gameplay zoom. Commit.

### Task 4: Ship, input, bolts, asteroids, crystals (the playable core)

**Files:** `src/input.ts`, `src/world/{ship,projectiles,asteroids,crystals}.ts`, `src/game.ts`

**Interfaces:**
- `Input { move: V2; aim: V2 (world); fire: boolean; missile: boolean (edge); dash (edge); build (edge); hotkey: number|null (edge); callWave (edge); pause (edge); mute (edge); touch: boolean }`
- `Ship { x,z,vx,vz,heading,hp,maxHp,gunTier, missiles, missilesMax, alive; update(dt, input, game) }`
- `Bolts`: instanced, `fire(x,z,angle,speed,dmg,team:'player'|'enemy',style, opts{pierce, splash, life})`, `update(dt, game)` → collisions through the grid against asteroids/enemies/boss parts (player team) or the ship/station/shield (enemy team)
- `Asteroids { list; spawnField(look, rng); hit(a, dmg, source): void` (split, crystals, explosive chain) `}`
- `Crystals { spawn(x,z,value,n); update(dt, magnets: {x,z,r,strength}[]); vacuumTo(x,z) }`. It's instanced, merges when > 400, and collection fires the `onCollect(value)` callback.

- [ ] Verify in Chrome: fly with WASD, aim with the mouse, hold-fire splits asteroids, crystals fly to the ship and the counter rises, explosive asteroids chain. Use `__game.stats()` for counts. Commit.

### Task 5: Station, build mode, modules, build bar, HUD

**Files:** `src/world/station.ts`, `src/world/modules.ts`, `src/world/drones.ts`, `src/ui/{hud,buildbar,popups}.ts`

**Interfaces:**
- `Station { hp,maxHp, shield, shieldMax, rings, modules: Map<socketId, ModuleInst>; place(kind, socket): boolean; upgrade(socket): boolean; sell(socket): void; expand(): boolean; magnet(); update(dt, game) }`
- Module behaviours, one function each: `turret`, `missileBattery`, `tesla`, `shieldGen` (passive), `miningHub` (spawns/maintains drones), `dockingBay` (wingmen).
- `BuildBar`: card per action (1 Guns, 2–7 modules, X Expand) with cost and lock/afford state. Clicking or hotkey selects. Build mode is entered with B, runs at `timeScale` 0.25 and pulls the camera back. Clicking a free socket places; clicking a module opens a popup (Upgrade / Sell).

- [ ] Verify in Chrome (with `?dev` F1 crystals): place each module; turrets track and shoot asteroids; drones mine and return; expansion adds a ring; upgrade and sell update crystals correctly; clicking a card and then pressing Space dashes (Review Focus 3). Commit.

### Task 6: Enemies, director, waves, indicators, banners

**Files:** `src/world/enemies.ts`, `src/world/director-run.ts` (glue that maps director events onto spawns, banners and audio), `src/ui/{indicators,banners}.ts`

**Interfaces:** `Enemy { def, x,z,vx,vz,hp,maxHp, role:'swarmer'|'gunship'|'raider'|'tank'|'blinker'|'splitter'; update(dt, game) }`, `spawnGroup(order, game)` (formation at the arena edge in `order.dir`)

- [ ] Verify in Chrome: calm countdown → siren banner + red edge arrows → wave arrives from the shown direction → "WAVE CLEARED +N" → crystals vacuum to the station → next calm; N calls the wave early with a bonus. Commit.

### Task 7: Bosses, sector flow, hyperspace, saves, screens

**Files:** `src/world/bosses.ts`, `src/ui/screens.ts`, plus changes to `src/game.ts`

- Bosses: Protocol Override (rings + drone spawns <50%), Crimson Marauder (telegraph line, then dash + broadsides), Nebula Sovereign (teleport, 2 decoys, homing orbs), Xenarch Prime (4 pods, core immune until the pods are dead, then a sweeping laser with a telegraph).
- Boss intro card + boss bar; slow-mo + big shockwave on death.
- Sector clear → hyperspace (streaking stars, flash, atmosphere swap, field respawn) → "NEW MODULES" card → checkpoint save.
- Screens: title (Play/Continue/Easy toggle/How to play/Classic link), pause (auto on blur), game over (Retry sector), victory (stats + Endless).

- [ ] Verify in Chrome with `?dev` F4/F5: each boss fight works and can be won; hyperspace transitions between all 4 sectors; reloading shows Continue at the right sector; game over → Retry restores the checkpoint build. Commit.

### Task 8: Missiles, dash, pickups, events, Sparky

**Files:** `src/world/{missiles,pickups,events}.ts`, `src/world/drones.ts` (Sparky)

- [ ] Verify in Chrome: right-click homing missiles (3 + sector charges, 5 s recharge); dash i-frames; each event (`__game.dev.event(name)`) plays out; the Sparky SOS in sector 1 wave 2 calm → rescue → buddy orbits and collects. Hiding the tab mid-wave auto-pauses (Review Focus 2). Commit.

### Task 9: Audio

**Files:** `src/audio/{sfx,music}.ts`

- [ ] Procedural SFX for every event in the spec list; music with calm, battle and boss grooves crossfading on director events; M mutes; the audio context resumes on first input. Verify there are no console errors and the mute state persists in localStorage. Commit.

### Task 10: Touch controls

**Files:** `src/input.ts`, `src/ui/touch.ts`

- [ ] Left-half drag = stick; auto-aim at the nearest enemy (asteroid if none) within 30 and auto-fire; buttons for 🚀 missile, ⚡ dash, 🔧 build. Verify with `?touch` in Chrome. Commit.

### Task 11: Balance and polish pass

- [ ] Play sector 1 fully by hand in Chrome; use dev skips for 2–4. Tune `src/config/balance.ts` so wave 1 is beatable without building, the station needs about 3 modules by the sector 1 boss, and a sector takes about 6–8 minutes.
- [ ] Juice check: hit-stop on large kills, shake capped, bank angles, no z-fighting, readable colours per sector. Commit.

### Task 12: Docs, final review, push

- [ ] Rewrite `README.md` and `CLAUDE.md` for the new architecture (keep the classic notes short).
- [ ] Review Focus checks 1 and 5 in Chrome; `npx vitest run`; `npm run build`.
- [ ] Have a fresh reviewer read the whole diff; fix what it finds.
- [ ] Push to `master`; confirm the Vercel deployment status on GitHub and that the live URL serves the new build and `/classic/`.
