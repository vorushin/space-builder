import * as THREE from 'three';
import type { Game } from '../game';
import { turnToward } from '../logic/math';
import { makeMiningDrone, makeSparky, makeWingman, type Rig } from '../render/models';
import type { Magnet } from './crystals';
import type { Asteroid } from './asteroids';
import type { ModuleInst } from './station';
import type { Hittable } from './types';

class Miner {
  x: number;
  z: number;
  vx = 0;
  vz = 0;
  heading = 0;
  state: 'home' | 'seek' | 'mine' | 'return' = 'home';
  target: Asteroid | null = null;
  cargo = 0;
  mesh = makeMiningDrone();
  magnet: Magnet;
  t = Math.random() * 10;

  constructor(readonly home: ModuleInst, readonly slot: number) {
    this.x = home.x;
    this.z = home.z;
    this.magnet = { x: 0, z: 0, r: 4, k: 1.4, onCollect: (v) => (this.cargo += v) };
  }
}

class Wingman {
  x: number;
  z: number;
  vx = 0;
  vz = 0;
  heading = -Math.PI / 2;
  cd = Math.random();
  rig: Rig = makeWingman();
  constructor(readonly home: ModuleInst, readonly slot: number) {
    this.x = home.x;
    this.z = home.z;
  }
}

const SLOTS = [
  [-2.2, 2.6],
  [-2.2, -2.6],
  [-3.8, 0],
];

/** Mining drones, wingmen and Sparky. */
export class Drones {
  miners: Miner[] = [];
  wingmen: Wingman[] = [];
  sparky: { x: number; z: number; mesh: THREE.Group; a: number; cd: number } | null = null;

  constructor(private scene: THREE.Scene) {}

  ensureMiners(m: ModuleInst, count: number, game: Game): void {
    const mine = this.miners.filter((d) => d.home === m);
    for (let i = mine.length; i < count; i++) {
      const d = new Miner(m, i);
      this.scene.add(d.mesh);
      this.miners.push(d);
      game.fx.sparks(m.x, m.z, 0xffd25a, 6, 5);
    }
  }

  ensureWingmen(m: ModuleInst, count: number, game: Game): void {
    const mine = this.wingmen.filter((d) => d.home === m);
    for (let i = mine.length; i < count; i++) {
      const w = new Wingman(m, this.wingmen.length);
      this.scene.add(w.rig.root);
      this.wingmen.push(w);
      game.fx.sparks(m.x, m.z, 0x7dffb0, 8, 6);
    }
  }

  /** Drop drones whose module was sold or upgraded away. */
  prune(game: Game): void {
    const alive = new Set(game.station.modules.values());
    this.miners = this.miners.filter((d) => {
      if (alive.has(d.home) && d.home.kind === 'mining') return true;
      this.scene.remove(d.mesh);
      return false;
    });
    this.wingmen = this.wingmen.filter((w) => {
      if (alive.has(w.home) && w.home.kind === 'dock') return true;
      this.scene.remove(w.rig.root);
      return false;
    });
  }

  addSparky(game: Game): void {
    if (this.sparky) return;
    const mesh = makeSparky();
    this.scene.add(mesh);
    this.sparky = { x: game.ship.x, z: game.ship.z, mesh, a: 0, cd: 1 };
  }

  clear(): void {
    for (const d of this.miners) this.scene.remove(d.mesh);
    for (const w of this.wingmen) this.scene.remove(w.rig.root);
    this.miners = [];
    this.wingmen = [];
    if (this.sparky) this.scene.remove(this.sparky.mesh);
    this.sparky = null;
  }

  /** Magnets the crystal system should know about. */
  magnets(out: Magnet[]): void {
    for (const d of this.miners) {
      if (d.state === 'mine' || d.state === 'seek') {
        d.magnet.x = d.x;
        d.magnet.z = d.z;
        out.push(d.magnet);
      }
    }
  }

  update(dt: number, game: Game): void {
    this.prune(game);
    for (const d of this.miners) this.updateMiner(d, dt, game);
    for (const w of this.wingmen) this.updateWingman(w, dt, game);
    if (this.sparky) this.updateSparky(dt, game);
  }

  private steer(o: { x: number; z: number; vx: number; vz: number }, tx: number, tz: number, speed: number, dt: number, arrive = 3): number {
    const dx = tx - o.x, dz = tz - o.z;
    const d = Math.hypot(dx, dz) || 0.001;
    const s = d < arrive ? speed * (d / arrive) : speed;
    const k = 1 - Math.exp(-4 * dt);
    o.vx += ((dx / d) * s - o.vx) * k;
    o.vz += ((dz / d) * s - o.vz) * k;
    o.x += o.vx * dt;
    o.z += o.vz * dt;
    return d;
  }

  private updateMiner(d: Miner, dt: number, game: Game): void {
    d.t += dt;
    const t = game.station.tierStats(d.home);
    const range = t.range ?? 42;
    const danger = !game.isCalm;
    if (danger && d.state !== 'home') d.state = 'return';
    switch (d.state) {
      case 'home': {
        const a = d.t * 0.8 + d.slot * 2.1;
        this.steer(d, d.home.x + Math.cos(a) * 1.4, d.home.z + Math.sin(a) * 1.4, 6, dt);
        if (!danger && d.t > 1.2 && game.station.alive) {
          d.target = this.pickRock(game, d, range);
          if (d.target) d.state = 'seek';
          else d.t = 0;
        }
        break;
      }
      case 'seek': {
        if (!d.target || !d.target.alive) {
          d.target = this.pickRock(game, d, range);
          if (!d.target) {
            d.state = 'return';
            break;
          }
        }
        const dist = this.steer(d, d.target.x, d.target.z, 13, dt, 1);
        if (dist < d.target.r + 2.4) d.state = 'mine';
        break;
      }
      case 'mine': {
        const r = d.target;
        if (!r || !r.alive) {
          if (d.cargo >= 8) d.state = 'return';
          else {
            d.target = this.pickRock(game, d, range);
            d.state = d.target ? 'seek' : 'return';
          }
          break;
        }
        const a = Math.atan2(d.z - r.z, d.x - r.x);
        this.steer(d, r.x + Math.cos(a) * (r.r + 2), r.z + Math.sin(a) * (r.r + 2), 6, dt);
        r.onHit((t.dmg ?? 26) * (1 + game.sector * 0.6) * dt, game, d.x, d.z);
        const col = new THREE.Color(0xffd25a).multiplyScalar(2.2 + Math.random());
        game.fx.segment(d.x, 0.6, d.z, r.x + Math.cos(a) * r.r * 0.7, 0.4, r.z + Math.sin(a) * r.r * 0.7, 0.09, col);
        if (Math.random() < 0.3) game.fx.sparks(r.x + Math.cos(a) * r.r * 0.8, r.z + Math.sin(a) * r.r * 0.8, 0xffd25a, 1, 4, 0.35);
        break;
      }
      case 'return': {
        const dist = this.steer(d, d.home.x, d.home.z, 14, dt, 2);
        if (dist < 1.5) {
          if (d.cargo > 0) {
            game.addCrystals(d.cargo, d.x, d.z);
            d.cargo = 0;
          }
          d.state = 'home';
          d.t = 0;
        }
        break;
      }
    }
    d.heading = turnToward(d.heading, Math.atan2(d.vz, d.vx), 6 * dt);
    d.mesh.position.set(d.x, 1.2 + Math.sin(d.t * 3) * 0.15, d.z);
    d.mesh.rotation.y = -d.heading;
  }

  private pickRock(game: Game, d: Miner, range: number): Asteroid | null {
    let best: Asteroid | null = null;
    let bd = Infinity;
    for (const a of game.asteroids.list) {
      if (!a.alive || a.meteor) continue;
      const hx = a.x - d.home.x, hz = a.z - d.home.z;
      const fromHome = hx * hx + hz * hz;
      if (fromHome > range * range) continue;
      // spread drones out: avoid rocks another drone is on
      const busy = this.miners.some((o) => o !== d && o.target === a);
      const score = fromHome * (busy ? 3 : 1) * (a.kind === 'rich' ? 0.5 : 1);
      if (score < bd) {
        bd = score;
        best = a;
      }
    }
    return best;
  }

  private updateWingman(w: Wingman, dt: number, game: Game): void {
    const ship = game.ship;
    const t = game.station.tierStats(w.home);
    let target: Hittable | null = null;
    if (ship.alive) {
      const s = SLOTS[w.slot % SLOTS.length];
      const c = Math.cos(ship.heading), sn = Math.sin(ship.heading);
      const sx = ship.x + c * s[0] - sn * s[1];
      const sz = ship.z + sn * s[0] + c * s[1];
      this.steer(w, sx, sz, 30, dt, 4);
      target = game.nearestTarget(ship.x, ship.z, 26);
    } else {
      const a = game.time * 0.5 + w.slot * 2;
      this.steer(w, Math.cos(a) * 9, Math.sin(a) * 9, 12, dt);
      target = game.nearestTarget(w.x, w.z, 22);
    }
    const want = target ? Math.atan2(target.z - w.z, target.x - w.x) : ship.alive ? ship.heading : Math.atan2(w.vz, w.vx);
    w.heading = turnToward(w.heading, want, 8 * dt);
    w.cd -= dt;
    if (target && w.cd <= 0 && Math.abs(want - w.heading) < 0.3) {
      w.cd = 1 / (t.rate ?? 4);
      game.bolts.fire({
        x: w.x + Math.cos(w.heading) * 0.9,
        z: w.z + Math.sin(w.heading) * 0.9,
        angle: w.heading,
        speed: 64,
        dmg: (t.dmg ?? 20) * (1 + game.sector * 0.4),
        team: 'player',
        color: 0x7dffb0,
        range: 30,
      });
    }
    w.rig.root.position.set(w.x, 0.3, w.z);
    w.rig.root.rotation.y = -w.heading;
    const lateral = -Math.sin(w.heading) * w.vx + Math.cos(w.heading) * w.vz;
    w.rig.body.rotation.x = Math.max(-0.6, Math.min(0.6, -lateral * 0.05));
  }

  private updateSparky(dt: number, game: Game): void {
    const s = this.sparky!;
    const ship = game.ship;
    s.a += dt * 1.7;
    const cx = ship.alive ? ship.x : game.station.x;
    const cz = ship.alive ? ship.z : game.station.z + 9;
    const tx = cx + Math.cos(s.a) * 2.8, tz = cz + Math.sin(s.a) * 2.8;
    const k = 1 - Math.exp(-6 * dt);
    s.x += (tx - s.x) * k;
    s.z += (tz - s.z) * k;
    s.cd -= dt;
    const target = game.nearestTarget(s.x, s.z, 12);
    if (target && s.cd <= 0) {
      s.cd = 1.1;
      game.fx.zap(s.x, s.z, target.x, target.z, 0x6ff6ff, 0.14, 0.09, 1.2);
      target.onHit(8 + 5 * ship.gunTier * (1 + game.sector * 0.3), game, s.x, s.z);
      game.audio.play('zap', 2);
    }
    s.mesh.position.set(s.x, 1.3 + Math.sin(game.time * 4) * 0.2, s.z);
    const look = target ? Math.atan2(target.z - s.z, target.x - s.x) : Math.atan2(game.aim.z - s.z, game.aim.x - s.x);
    s.mesh.rotation.y = -look;
    const tip = s.mesh.userData.tip as THREE.Mesh;
    const glowK = 2 + Math.sin(game.time * 8) * 1.2;
    (tip.material as THREE.MeshBasicMaterial).color.setRGB(1 * glowK, 0.82 * glowK, 0.35 * glowK);
  }
}
