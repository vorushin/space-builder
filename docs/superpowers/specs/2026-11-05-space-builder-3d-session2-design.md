# Space Builder 3D, session 2: characters, a super, medals

**Date:** 2026-11-05 (evening)
**Status:** Approved (autonomous: Roman said "improve the game as you see fit")
**Builds on:** `2026-11-05-space-builder-3d-design.md`

## Why

The first build has the loop, the looks and the content. What it lacks for a kid are:

- **Characters and story.** Right now nobody talks to you. A voice that knows your name
  makes a game feel like *yours*.
- **A power fantasy you control.** Turrets do a lot of the fighting. A big
  button that you charge up and fire yourself is the most fun thing a kid can press.
- **Epic boss moments.** Bosses arrive with just a banner.
- **Reasons to come back.** Medals to collect and a best score to beat.
- **Clarity.** It's hard to see the whole arena at once; there's no radar.

## Features

1. **Comms (talking characters).** A panel at the top left shows a portrait, the
   speaker's name and short typed-out lines, queued so lines never overlap.
   - **ARIA, the station computer:** greets you, briefs each sector, cheers wave clears,
     warns about danger, and announces NOVA and new modules.
   - **Sparky** (after his rescue): little beeps and cheers.
   - **Bosses:** a taunt on arrival and a line at half health.

   ARIA uses the commander's name. All lines live in `src/config/lines.ts` (easy for
   Robert to edit).
2. **Hangar on the title screen.** Robert enters a commander name (default
   "Commander") and picks one of 6 paint jobs, which recolour the ship's hull, stripes and
   canopy. The ship is shown parked by the station so the choice is visible.
   Saved in localStorage.
3. **Boss entrance cinematic.** For about 2.4 s the screen gets letterbox bars, time
   slows to 25%, the camera swings to the boss, and the boss name, title and taunt
   appear. Controls and enemy fire pause for that moment, so it is never unfair.
4. **NOVA super.** A meter fills from kills (anyone's) and from damage to bosses. When
   it's full, ARIA calls it out and the HUD button glows. **F** (or the button, or the
   touch button) releases an expanding shockwave (radius ~34). It hits every enemy once,
   deletes enemy bullets, and bosses take a capped chunk. It comes with slow-mo, a
   flash and shake, and its own sound.
5. **Radar.** A round minimap under the crystal counter showing the arena edge,
   the station, your ship (arrow), enemies, the boss, big rocks, events, and the incoming
   wave directions. It's hidden on narrow screens.
6. **More feedback.**
   - **Critical hits:** about 8% of ship bolts do 2× damage and show "CRIT!".
   - **Damaged things smoke:** enemies below half health smoke and spark.
   - **Low ship health** (under 35%): a pulsing red vignette, a soft alarm and a smoke
     trail.
7. **Medals.** 15 medals with toasts, a Medals screen on the title (earned medals in
   colour, locked ones as "?"), and lifetime counters. The medals are: First Build, Sharp
   Shooter (Triple Shot), Singularity (gun 10), one for each boss, Robot Rescue, Mega
   Builder, Full House (all 18 sockets), Comet Hunter, Untouchable (a wave with no hits),
   Nova!, Rock Smasher (1500 rocks, lifetime), Endless 10.
8. **Best Endless wave** is shown on the title and on the Endless game-over screen.

## Constraints

- No new dependencies and no asset files.
- The new logic (medals, profile) is pure and unit-tested.
- Text inputs must not trigger game keys: typing a space in the name field mustn't be
  eaten by the game.
- Keep the HUD readable. Comms shouldn't cover the ship panel or the build bar, and the
  radar mustn't overlap the top-right panel.

## Out of scope

Voice audio, online leaderboards, more sectors, and two-player mode.
