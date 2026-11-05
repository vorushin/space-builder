import * as THREE from 'three';
import { BAL } from '../config/balance';
import type { Game } from '../game';
import { turnToward } from '../logic/math';
import { glow, hull } from '../render/materials';
import type { Hittable } from './types';

export interface LaunchOpts {
  x: number;
  z: number;
  angle: number;
  team: 'player';
  dmg: number;
  radius: number;
  /** preferred aim point (player: the cursor) */
  aimX?: number;
  aimZ?: number;
  target?: Hittable | null;
  color?: number;
}

interface Missile {
  x: number;
  z: number;
  heading: number;
  speed: number;
  life: number;
  dmg: number;
  radius: number;
  target: Hittable | null;
  aimX: number;
  aimZ: number;
  mesh: THREE.Group;
  color: number;
  alive: boolean;
}

/** Homing missiles (yours and the station's Missile Batteries). */
export class Missiles {
  private list: Missile[] = [];
  private pool: THREE.Group[] = [];
  private geo = new THREE.ConeGeometry(0.16, 0.9, 6).rotateZ(-Math.PI / 2);
  private finGeo = new THREE.BoxGeometry(0.3, 0.05, 0.42);

  constructor(private scene: THREE.Scene) {}

  private tailGeo = new THREE.SphereGeometry(0.16, 6, 4);

  private makeMesh(color: number): THREE.Group {
    let g = this.pool.pop();
    if (!g) {
      g = new THREE.Group();
      g.add(new THREE.Mesh(this.geo, hull(0xe8e8e8, { metal: 0.5, rough: 0.4 })));
      const fin = new THREE.Mesh(this.finGeo, hull(color));
      fin.position.x = -0.3;
      g.add(fin);
      const tail = new THREE.Mesh(this.tailGeo, glow(0xffc070, 3));
      tail.position.x = -0.5;
      g.add(tail);
    }
    this.scene.add(g);
    return g;
  }

  launch(game: Game, o: LaunchOpts): void {
    const target = o.target ?? this.pickTarget(game, o.aimX ?? o.x, o.aimZ ?? o.z, o.x, o.z);
    const color = o.color ?? 0xff8a3d;
    this.list.push({
      x: o.x,
      z: o.z,
      heading: o.angle,
      speed: BAL.missiles.speed,
      life: BAL.missiles.life,
      dmg: o.dmg,
      radius: o.radius,
      target,
      aimX: o.aimX ?? o.x + Math.cos(o.angle) * 30,
      aimZ: o.aimZ ?? o.z + Math.sin(o.angle) * 30,
      mesh: this.makeMesh(color),
      color,
      alive: true,
    });
  }

  /** Enemy closest to the aim point, else closest to the shooter. */
  private pickTarget(game: Game, ax: number, az: number, sx: number, sz: number): Hittable | null {
    let best: Hittable | null = null;
    let bd = 14 * 14;
    for (const t of game.targets()) {
      const d = (t.x - ax) ** 2 + (t.z - az) ** 2;
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    if (best) return best;
    bd = 45 * 45;
    for (const t of game.targets()) {
      const d = (t.x - sx) ** 2 + (t.z - sz) ** 2;
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  }

  clear(): void {
    for (const m of this.list) {
      this.scene.remove(m.mesh);
      this.pool.push(m.mesh);
    }
    this.list.length = 0;
  }

  update(dt: number, game: Game): void {
    const mb = BAL.missiles;
    for (const m of this.list) {
      if (!m.alive) continue;
      m.life -= dt;
      if (m.target && !m.target.alive) m.target = this.pickTarget(game, m.x, m.z, m.x, m.z);
      const tx = m.target ? m.target.x : m.aimX;
      const tz = m.target ? m.target.z : m.aimZ;
      const want = Math.atan2(tz - m.z, tx - m.x);
      const age = mb.life - m.life;
      m.heading = turnToward(m.heading, want, mb.turnRate * dt * Math.min(1, age * 4));
      m.speed = Math.min(mb.maxSpeed, m.speed + 30 * dt);
      m.x += Math.cos(m.heading) * m.speed * dt;
      m.z += Math.sin(m.heading) * m.speed * dt;
      // smoke + flame
      game.fx.particle(m.x - Math.cos(m.heading) * 0.6, 0.45, m.z - Math.sin(m.heading) * 0.6, 0, 0.4, 0, 0xffa050, 0.7, 0.25, 2.2, 2);
      if (Math.random() < 0.5) game.fx.particle(m.x, 0.45, m.z, 0, 0.2, 0, 0x8a8a90, 0.9, 0.6, 0.6, 1);
      let boom = m.life <= 0;
      if (m.target) {
        const rr = m.target.r + 1.2;
        if ((m.target.x - m.x) ** 2 + (m.target.z - m.z) ** 2 < rr * rr) boom = true;
      } else if ((tx - m.x) ** 2 + (tz - m.z) ** 2 < 1.5) boom = true;
      if (!boom) {
        // proximity fuse on anything hostile
        for (const t of game.grid.query(m.x, m.z, 1.5, [])) {
          if (t.alive && (t.x - m.x) ** 2 + (t.z - m.z) ** 2 < (t.r + 0.9) ** 2) {
            boom = true;
            break;
          }
        }
      }
      if (boom) {
        m.alive = false;
        game.explode(m.x, m.z, m.radius, m.dmg, 'player', m.color);
      }
      m.mesh.position.set(m.x, 0.45, m.z);
      m.mesh.rotation.y = -m.heading;
      m.mesh.rotation.x += dt * 9;
    }
    let j = 0;
    for (const m of this.list) {
      if (m.alive) this.list[j++] = m;
      else {
        this.scene.remove(m.mesh);
        this.pool.push(m.mesh);
      }
    }
    this.list.length = j;
  }
}
