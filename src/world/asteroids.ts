import * as THREE from 'three';
import { BAL } from '../config/balance';
import type { SectorDef } from '../config/sectors';
import type { Game } from '../game';
import { Rng, TAU } from '../logic/math';
import { AsteroidKit, ROCK_RADIUS, type RockKind, type RockSize } from '../render/models';
import type { Hittable } from './types';

const BASE_HP: Record<RockSize, number> = { G: 520, L: 70, M: 32, S: 14 };
/** crystals dropped when this piece breaks (before multipliers) */
const DROPS: Record<RockSize, number> = { G: 14, L: 1, M: 1, S: 1 };

export class Asteroid implements Hittable {
  x = 0;
  z = 0;
  vx = 0;
  vz = 0;
  r: number;
  hp: number;
  maxHp: number;
  alive = true;
  readonly team = 'neutral' as const;
  spinAxis = new THREE.Vector3();
  spin = 0;
  bump = 0;
  grow = 1;
  /** meteors fly straight through and leave */
  meteor = false;

  constructor(
    readonly size: RockSize,
    readonly kind: RockKind,
    readonly mesh: THREE.Group,
    hp: number,
  ) {
    this.r = ROCK_RADIUS[size] * 0.92;
    this.hp = this.maxHp = hp;
  }

  onHit(dmg: number, game: Game, hx: number, hz: number): void {
    if (!this.alive) return;
    this.hp -= dmg;
    this.bump = 0.12;
    const a = Math.atan2(hz - this.z, hx - this.x);
    if (Math.random() < 0.35) game.fx.debrisBurst(this.x + Math.cos(a) * this.r, this.z + Math.sin(a) * this.r, game.look.rock, 1, 4, 0.5);
    if (this.hp <= 0) game.asteroids.shatter(this, game);
  }
}

/** The asteroid belt around the station: drifting, splitting, refilling. */
export class AsteroidField {
  list: Asteroid[] = [];
  private kit: AsteroidKit | null = null;
  private rng = new Rng(777);
  private refillT = 0;
  private def!: SectorDef;
  private hpScale = 1;

  constructor(private scene: THREE.Scene) {}

  setSector(def: SectorDef, sectorIndex: number): void {
    this.clear();
    this.kit?.dispose();
    this.kit = new AsteroidKit(def.look, 31 + sectorIndex * 17);
    this.def = def;
    this.hpScale = def.rockHp;
    for (let i = 0; i < def.asteroids; i++) this.spawnInBelt(false);
  }

  clear(): void {
    for (const a of this.list) this.scene.remove(a.mesh);
    this.list.length = 0;
  }

  private pickKind(): RockKind {
    const r = this.rng.next();
    if (r < this.def.explosiveChance) return 'explosive';
    if (r < this.def.explosiveChance + this.def.richChance) return 'rich';
    return 'rock';
  }

  /** A fresh large rock somewhere in the belt (or at its outer edge when refilling). */
  spawnInBelt(edge: boolean): Asteroid {
    const a = this.rng.range(0, TAU);
    const rad = edge ? BAL.beltOuter - this.rng.range(0, 6) : this.rng.range(BAL.beltInner + 4, BAL.beltOuter - 2);
    const size: RockSize = this.rng.chance(0.25) ? 'M' : 'L';
    const ast = this.spawn(size, this.pickKind(), Math.cos(a) * rad, Math.sin(a) * rad);
    if (edge) ast.grow = 0;
    return ast;
  }

  spawn(size: RockSize, kind: RockKind, x: number, z: number, vx?: number, vz?: number): Asteroid {
    const mesh = this.kit!.make(size, kind, this.rng);
    const hp = BASE_HP[size] * this.hpScale * (kind === 'explosive' ? 0.6 : 1);
    const a = new Asteroid(size, kind, mesh, hp);
    a.x = x;
    a.z = z;
    if (vx === undefined || vz === undefined) {
      // gentle orbit around the station
      const r = Math.hypot(x, z) || 1;
      const s = this.rng.range(0.5, 1.6) * (this.rng.chance(0.5) ? 1 : -1);
      a.vx = (-z / r) * s + this.rng.range(-0.3, 0.3);
      a.vz = (x / r) * s + this.rng.range(-0.3, 0.3);
    } else {
      a.vx = vx;
      a.vz = vz;
    }
    a.spinAxis.set(this.rng.range(-1, 1), this.rng.range(-1, 1), this.rng.range(-1, 1)).normalize();
    a.spin = this.rng.range(0.2, 1.1) / (size === 'G' ? 3 : 1);
    mesh.rotation.set(this.rng.range(0, 6), this.rng.range(0, 6), this.rng.range(0, 6));
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.list.push(a);
    return a;
  }

  /** Break apart: children, crystals, debris; explosive ones go boom. */
  shatter(a: Asteroid, game: Game): void {
    if (!a.alive) return;
    a.alive = false;
    const col = game.look.rock;
    game.fx.debrisBurst(a.x, a.z, col, a.size === 'S' ? 5 : a.size === 'M' ? 8 : 14, 6, a.size === 'S' ? 0.7 : 1.1);
    game.fx.sparks(a.x, a.z, a.kind === 'rich' ? game.look.vein : 0xd8d0c0, a.size === 'S' ? 8 : 14, 8, 0.5);
    game.audio.play(a.size === 'S' ? 'crack' : 'rockBreak');
    let drops = DROPS[a.size];
    if (a.kind === 'rich') drops *= 3;
    game.crystals.spawn(a.x, a.z, drops, a.r);
    game.stats.rocks++;
    if (a.kind === 'explosive') {
      game.explode(a.x, a.z, 7 + a.r, 90 * this.hpScale, 'neutral', 0xff6a2a);
    }
    if (a.meteor) return;
    const child: RockSize | null = a.size === 'G' ? 'L' : a.size === 'L' ? 'M' : a.size === 'M' ? 'S' : null;
    if (!child) return;
    const n = a.size === 'G' ? 5 : this.rng.int(2, 3);
    const childKind: RockKind = a.kind === 'explosive' ? 'rock' : a.size === 'G' ? 'rich' : a.kind;
    for (let i = 0; i < n; i++) {
      const ang = this.rng.range(0, TAU);
      const sp = this.rng.range(2, 5);
      const off = a.r * 0.5;
      this.spawn(child, childKind, a.x + Math.cos(ang) * off, a.z + Math.sin(ang) * off, a.vx * 0.5 + Math.cos(ang) * sp, a.vz * 0.5 + Math.sin(ang) * sp);
    }
  }

  get bigCount(): number {
    let n = 0;
    for (const a of this.list) if (a.alive && !a.meteor && (a.size === 'L' || a.size === 'G')) n++;
    return n;
  }

  update(dt: number, game: Game): void {
    const ship = game.ship;
    const st = game.station;
    for (const a of this.list) {
      if (!a.alive) continue;
      a.x += a.vx * dt;
      a.z += a.vz * dt;
      const r = Math.hypot(a.x, a.z) || 1;
      if (a.meteor) {
        if (r > BAL.arenaRadius + 30) a.alive = false;
      } else {
        // keep in the belt; slow down fast pieces
        const damp = Math.exp(-0.25 * dt);
        const sp = Math.hypot(a.vx, a.vz);
        if (sp > 2.2) {
          a.vx *= damp;
          a.vz *= damp;
        }
        const minR = Math.max(BAL.beltInner - 6, st.radius + a.r + 3);
        if (r < minR) {
          a.vx += (a.x / r) * 6 * dt;
          a.vz += (a.z / r) * 6 * dt;
        } else if (r > BAL.beltOuter + 4) {
          a.vx -= (a.x / r) * 3 * dt;
          a.vz -= (a.z / r) * 3 * dt;
        }
      }
      // ship bumps
      if (ship.alive) {
        const dx = ship.x - a.x, dz = ship.z - a.z;
        const d = Math.hypot(dx, dz);
        const rr = a.r + ship.r;
        if (d < rr && d > 0.001) {
          const nx = dx / d, nz = dz / d;
          ship.x = a.x + nx * rr;
          ship.z = a.z + nz * rr;
          const rel = (ship.vx - a.vx) * nx + (ship.vz - a.vz) * nz;
          if (rel < 0) {
            ship.vx -= rel * nx * 1.5;
            ship.vz -= rel * nz * 1.5;
            const mass = a.size === 'S' ? 0.5 : a.size === 'M' ? 0.25 : 0.08;
            a.vx += rel * nx * mass;
            a.vz += rel * nz * mass;
            if (rel < -9 || a.meteor) {
              ship.hurt(a.meteor ? 10 : 5, game);
              game.fx.debrisBurst(ship.x - nx * ship.r, ship.z - nz * ship.r, game.look.rock, 3, 4, 0.6);
            }
          }
        }
      }
      // visuals
      a.bump = Math.max(0, a.bump - dt);
      a.grow = Math.min(1, a.grow + dt * 0.8);
      a.mesh.position.set(a.x, 0, a.z);
      a.mesh.rotateOnAxis(a.spinAxis, a.spin * dt);
      // never scale to exactly 0: a singular normal matrix makes NaN pixels (black bloom blocks)
      a.mesh.scale.setScalar(Math.max(0.05, a.grow) * (1 + a.bump * 0.6));
    }
    // separate overlapping rocks (cheap: few dozen rocks)
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        if (!b.alive) continue;
        const dx = b.x - a.x, dz = b.z - a.z;
        const rr = a.r + b.r;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = (rr - d) * 0.5;
        const nx = dx / d, nz = dz / d;
        a.x -= nx * push;
        a.z -= nz * push;
        b.x += nx * push;
        b.z += nz * push;
        const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (rel < 0) {
          a.vx += rel * nx * 0.5;
          a.vz += rel * nz * 0.5;
          b.vx -= rel * nx * 0.5;
          b.vz -= rel * nz * 0.5;
        }
      }
    }
    // remove dead
    let j = 0;
    for (const a of L) {
      if (a.alive) L[j++] = a;
      else this.scene.remove(a.mesh);
    }
    L.length = j;
    // refill the belt slowly
    this.refillT -= dt;
    if (this.refillT <= 0) {
      this.refillT = 3.5;
      if (this.bigCount < this.def.asteroids * 0.7) this.spawnInBelt(true);
    }
  }
}
