# Space Builder 3D

A 3D space shooter and station builder, made for (and with) Robert.

Fly your ship, blast asteroids into glowing crystals, and turn a tiny Core Module into a
giant **Mega Station** with turrets, mining drones, shields, missile batteries, Tesla coils
and wingmen. Waves of enemies come at your station. Every sector ends with a boss:
*Protocol Override, Crimson Marauder, Nebula Sovereign* and finally *Xenarch Prime*.

Play it: https://space-builder-one.vercel.app. The original 2D game is still there at
[/classic/](https://space-builder-one.vercel.app/classic/).

## Controls

| Key | What it does |
|---|---|
| W A S D / arrows | fly |
| Mouse | aim |
| Hold left button | shoot |
| Right-click or Q | homing missile |
| Space | dash (dodges bullets) |
| 1 | upgrade ship guns |
| 2–7 | pick a station module, then click a glowing socket |
| B | build mode: click a module to upgrade or sell it |
| X | make the station bigger |
| N | call the next wave early (bonus crystals) |
| P / Esc | pause |
| M | sound on/off |

On a tablet you get a touch stick on the left. The ship aims and fires by itself, and
the build cards are tappable.

## Running it

```bash
npm install
npm run dev      # http://localhost:5180
npm test         # game-rule tests
npm run build    # static build in dist/ (what Vercel serves)
```

For developers, add `?dev` to the URL. It shows the FPS and turns on cheat keys:
**8** gives crystals, **9** clears the wave, **0** jumps to the next sector, **-**
brings the boss, and **=** toggles god mode. `?dev&bot&speed=6` lets an autopilot play
at 6× speed, which is handy for balancing.

See [CLAUDE.md](CLAUDE.md) for how the code is organised and where to change things.
