# CLAUDE.md

Guidance for Claude Code (and humans) working on this repo.

## What this is

**Space Builder 3D** is a 2.5D twin-stick space shooter and station builder made for
Robert (Roman's son). Roman and Robert iterate on it together, and Robert's ideas live in
the config files. It replaced the 2025 Pixi.js game, which is kept verbatim in
`public/classic/` and served at `/classic/`.

- Design spec: `docs/superpowers/specs/2026-11-05-space-builder-3d-design.md`
- Implementation plan: `docs/superpowers/plans/2026-11-05-space-builder-3d.md`

The core loop:
calm (mine and build, ~40 s) → siren and red arrows → wave → *wave cleared* (bonus, crystals
vacuumed home, station repaired) → … Wave 5 of each sector is the boss. Then comes a
hyperspace jump to the next sector. After the 4th boss you get victory and then Endless mode.
There is a checkpoint at every sector start (localStorage), so "Retry sector" never
loses more than one sector.

## Commands

```bash
npm run dev     # vite on :5180
npm test        # vitest: pure logic in tests/
npm run build   # tsc --noEmit && vite build → dist/
```

Vercel builds with `vercel.json` (framework vite, output `dist/`). Pushing to `main` deploys.

## Stack and conventions

- Three.js + TypeScript + Vite. There are no external art or audio assets: every model is
  procedural (`render/models.ts`) and every sound is synthesised (`audio/sfx.ts`).
- Gameplay is on the **XZ plane** (y is up). Heading θ points along `(cos θ, sin θ)`.
  Models point their nose along **+X**, and mesh yaw is `rotation.y = -θ`.
- The camera sits south of its target looking north at ~56° down. **Screen up is −Z** and
  screen right is +X. WASD is screen-relative.
- Glow is HDR colour (above 1.0) plus UnrealBloom. Use `glow()` and `additive()` from
  `render/materials.ts` for things that should shine.
- **Never scale a lit mesh to exactly 0.** A singular normal matrix gives NaN pixels,
  which bloom smears into big black blocks. `Stage` has a NaN-sanitize pass and a safe
  flat-shading normal patch as safety nets, but don't rely on them.
- Frame `dt` is clamped to 0.05. Gameplay uses `dt * timeScale` (hit-stop, slow-mo, and
  build mode at 0.22×). UI timers use real time.
- DOM buttons in the HUD use `tap()` (pointerdown, `tabindex=-1`) so Space never re-presses
  a button. Menu buttons use normal clicks.

## Layout

```
src/
  main.ts            boot: Stage, Background, UI, Audio, Input, Game; dev bot / speed
  game.ts            Game: modes (title/play/hyperspace/over/victory), main update loop,
                     director glue, building actions, saves, dev helpers
  input.ts           keyboard/mouse/touch-stick state; edge-triggered presses
  config/            ← tweak the game here
    balance.ts       arena size, ship physics, phases, camera, crystal rules
    guns.ts          the 10 ship gun tiers (Robert's names) and their prices
    modules.ts       the 6 station modules × 3 tiers, prices, unlock sectors; expansions
    sectors.ts       4 sectors: look (colours, planet), enemies, waves, boss
  logic/             pure and unit-tested
    director.ts      calm → warning → wave → cleared → … → sectorClear
    waves.ts         wave config → timed spawn orders (directions, counts, endless)
    economy.ts       costs, sell value, difficulty modifiers
    layout.ts        station sockets per ring, unlock rules
    save.ts          checkpoint encode/decode with validation
    grid.ts, targeting.ts, math.ts
  world/             entities (each owns its meshes)
    ship.ts, station.ts (+ module behaviours), enemies.ts, bosses.ts, asteroids.ts,
    crystals.ts (instanced, magnets, home drift), projectiles.ts (instanced bolts),
    missiles.ts, drones.ts (miners, wingmen, Sparky), pickups.ts, events.ts
  render/            stage.ts (renderer, bloom, camera rig), background.ts (stars,
                     nebula, planet, hyperspace streaks), models.ts, fx.ts (particles,
                     debris, rings, lightning/beam segments, floating text), materials.ts
  ui/                ui.ts (HUD, build cards, popups, banners, hints, indicators,
                     screens, touch) + style.css
  audio/sfx.ts       procedural SFX + tiny music sequencer (calm/battle/boss)
  dev/bot.ts         autopilot for balance runs (?dev&bot&speed=N)
public/classic/      the original 2D game, untouched
```

## Common changes

- **New enemy:** add an `EnemyDef` to a sector in `config/sectors.ts` and pick a `role`
  (swarmer, gunship, raider, tank, blinker, splitter) and a `shape`. To give it a new look,
  add a `case` in `makeEnemy` (`render/models.ts`). Then add it to that sector's waves.
- **New module:** add it to `MODULES` in `config/modules.ts` (kind, icon, hotkey, unlock
  sector, 3 tiers), give it a look in `makeModule`, and give it a behaviour in
  `Station.runModule`. The build bar picks it up automatically.
- **Balance:** most numbers live in `config/`. Crystal value per sector is
  `SECTOR_VALUE`. Station weapons scale with the sector inside `Station.runModule`. Run
  `?dev&bot&speed=8` and read `window.__bot.log` to see the pacing.
- **New calm-phase event:** add it in `world/events.ts` (`EventKind`, `EVENT_TEXT`,
  `start`, `update`).

## Testing

- `npm test` covers the rules: economy, layout, waves, director rhythm, saves, grid and
  targeting.
- In the browser, `window.__game` is exposed. `__game.counts()` returns a quick state
  snapshot. `__game.devEvent('comet')`, `__game.devBoss()`, `__game.devNextSector()` and
  `__game.devClearWave()` jump straight to the interesting parts.
