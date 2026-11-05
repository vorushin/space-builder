# SPACE BUILDER 3D: Design Spec

**Date:** 2026-11-05
**Status:** Approved (autonomous build: Roman asked Claude to brainstorm, design, build,
test in Chrome and push to master)
**Replaces as main game:** the 2025 Pixi.js game, which stays playable at `/classic/`

## Why a new version

Space Builder was made a year ago by Roman and his son Robert, iterating on ideas
together: mining, a station that grows, upgrades with epic names (*Singularity
Weapon*, *Titan Weapon Array*, *Mega Station*), swarms, missiles, a boss per sector.
The ideas are good, but the game is hard to love:

- **Flat and tiny.** Small 2D polygons on a dark screen with tiny HUD text.
- **Abstract building.** "Space Builder" never really lets you build. You press
  "2" and a number goes up.
- **Grindy, no rhythm.** Enemies trickle in non-stop, and every sector asks you to
  grind three upgrade tracks to a set level (10/10/10 by the end) with costs that
  grow exponentially.
- **Fiddly controls.** Pointer lock, rotate-to-cursor plus Space to thrust, B for
  missiles, and Esc to get your mouse back.
- **Silent.** There's no sound at all.

MINE3D showed the formula that works for Robert: keep the core loop, cut the
clutter, and put the effort into **feel** (3D, light, juice), **rhythm** (calm and
then danger), **surprises**, and **a goal you can reach**.

## Pillars

1. **Fly, blast, collect.** Twin-stick controls anyone gets in 5 seconds.
   Asteroids crack apart into glowing crystals that fly to you.
2. **You really build the station.** Modules snap onto sockets around the core.
   The station grows ring by ring into a *Mega Station*. Turrets track enemies,
   drones fly out to mine, and a shield bubble ripples when hit.
3. **Calm, then the wave.** Mine and build in peace, then a siren sounds and red
   arrows show where the wave comes from. Every sector ends in a boss.
4. **A goal you can reach.** There are 4 sectors with 5 waves each, and wave 5
   is the boss. A run takes about 25–35 minutes, with a checkpoint at every
   sector. Beat *Xenarch Prime* to win, then Endless mode continues.
5. **Surprises and new toys.** Each sector unlocks new modules. Calm phases bring
   random events: Golden Comet, Meteor Shower, Supply Drop, Crystal Giant. There's
   also a small story beat: rescue *Sparky*, a lost robot who becomes your buddy.
6. **Juice.** Bloom-lit lasers, debris, shockwaves, a little screen shake, hit-stop
   on big kills, slow-mo on boss death, chime pickups, and synth music.

Robert's names stay: sectors (*Training Zone → Asteroid Belt → Nebula Field → Alien
Territory*), enemies (*Training Drone … Alien Dreadnought*), bosses (*Protocol Override,
Crimson Marauder, Nebula Sovereign, Xenarch Prime*), the 10 ship gun names, and the
station and gun names, now used as module and tier names.

## Look: "pseudo-3D" (2.5D)

- Gameplay lives on a flat plane (XZ). The view comes from a **tilted perspective
  camera** (about 55° down) that follows the ship smoothly and leans toward where
  you aim. The camera pulls back in build mode and for bosses.
- Everything is **procedural low-poly, flat-shaded 3D** built from Three.js
  primitives, with no external art files: the ship, enemies with distinct
  silhouettes per role, bosses made of several parts, asteroids (displaced
  icosahedra) and station modules.
- Light: a sector-coloured sun key light, a cool rim light, hemisphere fill,
  emissive engines and bolts, UnrealBloom, and ACES tone mapping.
- Background with depth: 3 parallax star layers, additive nebula clouds, and a
  **large planet below the play plane** that differs per sector (teal ocean world,
  grey cratered moon, ringed purple gas giant, red lava world).
- FX: additive spark particles (one draw call), instanced debris chunks, fireballs,
  shockwave rings, engine trails, lightning arcs, and floating "+5" texts.
- Ships bank into turns, asteroids tumble, crystals spin and bob, and radar dishes
  and station rings rotate.

## Controls

| Desktop | Action |
|---|---|
| WASD / arrows | fly (screen-relative) |
| mouse | aim |
| hold left button | fire |
| right button / Q | missile (homing, big boom) |
| Space / Shift | dash (short burst, brief invulnerability) |
| B / Tab | build mode (slow-motion, camera shows the station) |
| 1 | upgrade ship guns |
| 2–7 | pick a module, then click a socket |
| N | call the next wave early (+bonus crystals) |
| P / Esc | pause · M mute |

There is no pointer lock: the crosshair is the cursor. **Touch** gets a left
virtual stick, auto-aim and auto-fire at the nearest target, plus missile, dash
and build buttons. The bottom bar is tappable.

## Core loop

`Calm (~45 s: mine, build, events)` → `Siren + arrows (5 s)` → `Wave (until cleared)` →
`WAVE CLEARED: bonus + every crystal on the field streams home + station repaired` → repeat.
Wave 5 is the **boss**. After it come `SECTOR CLEAR` → **hyperspace jump** (the station
jumps with you, stars streak) → the next sector with a new look, new enemies and new
modules unlocked.

- **Ship:** hull HP regenerates after 4 s without being hit, and quickly inside the
  station's dock ring. If destroyed, it respawns at the station after 3 s, losing
  nothing.
- **Station:** if destroyed, it's **game over**. You can retry the sector from its
  checkpoint with the build you had there.
- **Economy:** one currency, **crystals**. Sources are asteroids (each
  break), enemies, wave-clear bonus, events and bosses. Crystals don't time out;
  everything left on the field is vacuumed home when a wave is cleared.

## Ship guns (one button, 10 tiers, Robert's names)

Basic Gun → Rapid Fire → Heavy Cannons → Triple Shot → Plasma Weapons → Laser Barrage →
Ion Pulse → Quantum Cannons → Antimatter Guns → Singularity Weapon. Each tier
visibly changes the ship (more gun pods, bolt colour) and the bolt pattern (more
bolts, then piercing, then splash). Singularity fires a mini black hole every few
shots that drags enemies and crystals in.

Missiles: 3 charges, +1 per sector, recharge 1 per 5 s. Damage scales with gun tier.

## Station modules

The station starts as the **Core Module** with 4 sockets.
**Expand → Command Center** adds a ring of 6 more sockets.
**Expand → Mega Station** adds 8 more.
Every module has 3 tiers. You place a module by clicking a socket (in build mode), and click
a module to upgrade it (or sell it back for half).

| Module | Does | Tiers | Unlocks |
|---|---|---|---|
| Defense Turret | auto-shoots nearest enemy (asteroids when calm) | Defense Turret → Twin Cannons → Railguns | Sector 1 |
| Mining Hub | launches mining drones that bring crystals home | 1 → 2 → 3 drones | Sector 1 |
| Shield Generator | bubble shield over the station; stacks | Shield → Defense Grid → Shield Generator Mk III | Sector 2 |
| Missile Battery | long-range homing missiles with splash | Missile Battery → Flak Array → Nova Cannons | Sector 2 |
| Tesla Coil | chain lightning, short range | 3 → 5 → 7 chains | Sector 3 |
| Docking Bay | wingman fighters escort your ship | 1 → 2 → 3 wingmen | Sector 3 |

Expansions unlock in Sector 2 (Command Center) and Sector 3 (Mega Station).

## Sectors, enemies, bosses

| Sector | Look | Enemies (role) | Boss |
|---|---|---|---|
| Training Zone | teal, ocean planet, ice rocks | Training Drone (swarmer), Advanced Drone (gunship) | **Protocol Override**: bullet rings, spawns drones at half HP |
| Asteroid Belt | grey/amber, cratered moon | Pirate Scout (swarmer), Mining Raider (goes for the station), Scavenger Cruiser (tank) | **Crimson Marauder**: telegraphed ram dashes + broadsides |
| Nebula Field | purple/pink, ringed gas giant | Nebula Wraith (blinks), Energy Stalker (gunship), Void Hunter (tank) | **Nebula Sovereign**: teleports, decoy clones, homing orbs |
| Alien Territory | red/orange, lava world | Alien Scout (swarmer), Xenomorph Warrior (splits in two), Alien Dreadnought (tank) | **Xenarch Prime**: 4 turret pods shield the core, then a sweeping laser |

Roles stay readable. Swarmers rush in groups, gunships keep their distance and
fire bursts, raiders fly at the station, tanks are slow and fire spreads, and
blinkers teleport. Each enemy gets a colour and silhouette per sector. Bosses
get an intro title card, a health bar, and their own patterns.

Asteroids come in 3 sizes that split (large → 2–3 medium → 2–3 small → crystals),
in 3 kinds: rock, **crystal-rich** (glowing veins, 3× crystals) and **explosive**
(red core, blast damages enemies and other rocks, so chain reactions happen). The
field orbits slowly in a belt around the station and refills over time.

## Calm-phase events (one random per calm, from wave 2 on)

- **Golden Comet:** streaks across; shoot it before it escapes for a crystal fountain.
- **Meteor Shower:** many fast small meteors cross; dodge them or shoot them.
- **Supply Drop:** a crate warps in; touch it for a power-up.
- **Crystal Giant:** a huge crystal-rich asteroid appears.
- **Story beat:** an SOS signal in Sector 1 leads to **Sparky**, a little stranded
  robot. Rescue it and it orbits your ship from then on, pulling in crystals and
  zapping enemies.

Power-ups (from supply drops and the occasional enemy): **Overdrive** (rapid fire,
10 s), **Bubble** (invulnerable, 8 s), **Mega Magnet**, **Nuke**.

## HUD and screens

- **Top-left:** hull bar, gun name and tier stars, missile pips, dash ready.
- **Top-centre:** sector name, wave pips, calm countdown with "N: call wave
  early".
- **Top-right:** big crystal counter, plus station HP and shield bars.
- **Bottom:** a build bar of chunky cards with icon, cost and hotkey. Locked cards
  show "Sector 2". Unaffordable cards are dimmed.
- **Centre banners:** wave incoming, wave cleared, new module, boss intro, sector
  clear.
- **Edge arrows:** station (blue), enemies (red), boss (big), events (gold).
- **Screens:** title (3D station slowly orbiting, with Play / Continue /
  difficulty / How to play / Classic version), pause, game over (retry sector),
  and victory (stats, then Endless).
- **Difficulty:** *Normal* or *Easy* (weaker enemies, more crystals), chosen at
  New Game.

## Sound

Procedural WebAudio only, with no audio files. SFX: lasers (pitch per tier),
missile whoosh, explosions, crystal chimes that rise in pitch during a pickup
streak, build clank, siren, wave cleared jingle, boss roar, hyperspace sweep.
Music: a small synth sequencer with a calm groove and a battle groove (adds
drums), and a boss variant. M mutes.

## Tech and architecture

- **Stack:** Three.js + TypeScript + Vite (same as MINE3D), with Vitest for pure
  logic. `vercel.json` pins the Vite build (`dist/`) for the existing Vercel
  project.
- `src/config/`: data Robert and Roman can tweak (sectors, enemies, waves,
  bosses, guns, modules, balance numbers).
- `src/logic/`: pure and tested (economy, wave schedules, station sockets,
  save/load, targeting, math).
- `src/world/`: entities and systems (ship, station, asteroids, enemies,
  bosses, projectiles, crystals, drones, pickups, events).
- `src/render/`: stage (renderer, camera, lights, bloom, background), procedural
  models, FX.
- `src/ui/`: DOM HUD, build bar, screens, indicators. `src/audio/`: SFX and music.
- **Performance:** instanced meshes for bolts and debris, one Points system for
  sparks, a spatial grid for collisions, and pixel ratio capped by screen size. The
  target is 60 fps on a MacBook.
- **Saves:** a sector checkpoint in localStorage (sector, crystals, gun tier,
  station layout, Sparky).
- **Dev mode** (`?dev`): 8 +crystals, 9 clear wave, 0 next sector, - boss, = god
  mode, plus an FPS and state overlay. (F-keys collide with browser shortcuts.)
  `?dev&bot[=weak]&speed=N` runs an autopilot for balance. `window.__game` is
  exposed for browser tests.
- **Classic:** the old Pixi game moves to `public/classic/` and is served at
  `/classic/`.

## Non-goals

These are out of scope: full 6-DOF flight (that's space-3d), multiplayer,
leaderboards and backends, crafting or inventory, external art or audio assets,
and long story cutscenes.

## Anti-goals (a failure even if it "works")

- Robert can't tell what's attacking him or what to do next.
- Long stretches of nothing, or a wall of costs (grind).
- Losing a lot of progress to one mistake.
- Stutter on a laptop.
- Controls that need more than one help screen.
