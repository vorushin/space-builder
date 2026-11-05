/**
 * Dev-only autopilot (?dev&bot): flies, mines, fights and buys like a reasonable kid would.
 * Used for balance runs (add &speed=3 to fast-forward).
 */
import { MODULE_BY_KIND, type ModuleKind } from '../config/modules';
import type { Game } from '../game';
import { expansionCost, gunUpgradeCost, moduleCost } from '../logic/economy';
import { moduleUnlocked, ringUnlocked } from '../logic/layout';

const BUILD_ORDER: ModuleKind[] = ['turret', 'mining', 'turret', 'shield', 'missile', 'turret', 'tesla', 'dock', 'turret', 'missile', 'shield', 'tesla'];

export class Bot {
  private buyT = 0;
  log: string[] = [];

  tick(g: Game, dt: number): void {
    if (g.mode !== 'play' || g.paused) return;
    const s = g.ship;
    const input = g.input;
    if (!s.alive) {
      input.fireHeld = false;
      return;
    }
    let tgt = g.nearestTarget(s.x, s.z, 42);
    let mv = { x: 0, z: 0 };
    if (tgt) {
      const dx = tgt.x - s.x, dz = tgt.z - s.z, d = Math.hypot(dx, dz) || 1;
      const k = (d - 13) / 10;
      mv = { x: (dx / d) * k - (dz / d) * 0.6, z: (dz / d) * k + (dx / d) * 0.6 };
    } else {
      tgt = g.nearestRock(s.x, s.z, 70);
      const c = g.crystals as unknown as { x: Float32Array; z: Float32Array; count: number };
      let best: { x: number; z: number } | null = null;
      let bd = 30 * 30;
      for (let i = 0; i < c.count; i++) {
        const d = (c.x[i] - s.x) ** 2 + (c.z[i] - s.z) ** 2;
        if (d < bd) {
          bd = d;
          best = { x: c.x[i], z: c.z[i] };
        }
      }
      const goal = best ?? tgt;
      if (goal) {
        const dx = goal.x - s.x, dz = goal.z - s.z, d = Math.hypot(dx, dz) || 1;
        const stop = goal === tgt ? 9 : 0;
        const k = Math.max(-1, Math.min(1, (d - stop) / 6));
        mv = { x: (dx / d) * k, z: (dz / d) * k };
      }
    }
    const r = Math.hypot(s.x, s.z);
    if (r > 45) {
      mv.x -= s.x / r;
      mv.z -= s.z / r;
    }
    const l = Math.hypot(mv.x, mv.z);
    input.stick = l > 1 ? { x: mv.x / l, z: mv.z / l } : mv;
    if (tgt) {
      const p = g.project(tgt.x, tgt.z);
      input.mouseX = p.x;
      input.mouseY = p.y;
      input.hasMouse = true;
      input.fireHeld = true;
    } else input.fireHeld = false;
    if (tgt && tgt.team === 'enemy' && s.missiles > 1 && Math.random() < 0.02) input.press('KeyQ');
    const ev = g.events.beacon();
    if (ev && g.events.pod) {
      const dx = ev.x - s.x, dz = ev.z - s.z, d = Math.hypot(dx, dz) || 1;
      input.stick = { x: dx / d, z: dz / d };
    }

    this.buyT -= dt;
    if (this.buyT > 0 || g.buildMode) return;
    this.buyT = 0.5;
    this.buy(g);
  }

  private buy(g: Game): void {
    const st = g.station;
    const free = st.sockets.filter((q) => !st.modules.has(q.id));
    const gc = gunUpgradeCost(g.ship.gunTier);
    const mods = st.modules.size;
    if (gc !== null && g.bank >= gc && g.ship.gunTier <= mods + 1) {
      g.upgradeGuns();
      this.note(g, `guns → ${g.ship.gunTier}`);
      return;
    }
    if (!free.length && st.rings < 3 && ringUnlocked(st.rings, g.sector)) {
      const c = expansionCost(st.rings)!;
      if (g.bank >= c) {
        g.expandStation();
        this.note(g, `expand → ${st.rings}`);
      }
      return;
    }
    if (free.length) {
      const order = BUILD_ORDER.filter((k) => moduleUnlocked(k, g.sector));
      const kind = order[mods % order.length];
      const c = moduleCost(kind, 1)!;
      if (g.bank >= c) {
        g.placing = kind;
        g.placeAt(free[0].id);
        g.placing = null;
        this.note(g, `build ${kind}`);
        return;
      }
      if (g.bank < c * 0.8) return;
    }
    for (const m of st.modules.values()) {
      const c = moduleCost(m.kind, m.tier + 1);
      if (c !== null && g.bank >= c + 40) {
        g.upgradeModule(m.socket.id);
        this.note(g, `upgrade ${MODULE_BY_KIND[m.kind].title} → ${m.tier}`);
        return;
      }
    }
  }

  private note(g: Game, what: string): void {
    const line = `[${Math.round(g.stats.time)}s s${g.sector + 1} w${(g.director?.wave ?? 0) + 1}] ${what} (bank ${Math.floor(g.bank)})`;
    this.log.push(line);
  }
}
