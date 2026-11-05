import * as THREE from 'three';
import { BAL } from '../config/balance';
import type { Game } from '../game';
import { turnToward } from '../logic/math';
import type { Hittable } from './types';

export type BoltKind = 'laser' | 'orb' | 'rail' | 'sing';

export interface Bolt {
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  dmg: number;
  team: 'player' | 'enemy';
  r: number;
  pierce: number;
  splash: number;
  color: THREE.Color;
  hex: number;
  len: number;
  width: number;
  kind: BoltKind;
  alive: boolean;
  last: Hittable | null;
  /** turn rate toward the ship (enemy homing orbs) */
  homing: number;
  /** chance of a double-damage critical hit */
  crit: number;
}

export interface FireOpts {
  x: number;
  z: number;
  angle: number;
  speed: number;
  dmg: number;
  team: 'player' | 'enemy';
  color: number;
  range?: number;
  life?: number;
  r?: number;
  pierce?: number;
  splash?: number;
  size?: number;
  kind?: BoltKind;
  homing?: number;
  crit?: number;
}

const MAX_P = 1400;
const MAX_E = 900;

export class Bolts {
  list: Bolt[] = [];
  private pool: Bolt[] = [];
  private pMesh: THREE.InstancedMesh;
  private eMesh: THREE.InstancedMesh;
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private yAxis = new THREE.Vector3(0, 1, 0);
  private cands: Hittable[] = [];

  constructor(scene: THREE.Scene) {
    const box = new THREE.CapsuleGeometry(0.5, 1, 2, 6).rotateZ(Math.PI / 2).scale(0.5, 1, 1);
    this.pMesh = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_P);
    this.pMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_P * 3), 3);
    this.pMesh.count = 0;
    this.pMesh.frustumCulled = false;
    this.eMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_E);
    this.eMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_E * 3), 3);
    this.eMesh.count = 0;
    this.eMesh.frustumCulled = false;
    scene.add(this.pMesh, this.eMesh);
  }

  fire(o: FireOpts): Bolt {
    const b = this.pool.pop() ?? ({ color: new THREE.Color() } as Bolt);
    const c = Math.cos(o.angle), s = Math.sin(o.angle);
    b.x = o.x;
    b.z = o.z;
    b.vx = c * o.speed;
    b.vz = s * o.speed;
    b.life = o.life ?? (o.range ?? BAL.ship.boltRange) / o.speed;
    b.dmg = o.dmg;
    b.team = o.team;
    const size = o.size ?? 1;
    b.r = o.r ?? (o.team === 'player' ? 0.35 * size : 0.38 * size);
    b.pierce = o.pierce ?? 0;
    b.splash = o.splash ?? 0;
    b.hex = o.color;
    b.color.set(o.color).multiplyScalar(o.team === 'player' ? 1.7 : 2.1);
    b.kind = o.kind ?? (o.team === 'player' ? 'laser' : 'orb');
    b.len = b.kind === 'rail' ? 3.2 : b.kind === 'sing' ? 1.2 : 1.25 + o.speed * 0.012;
    b.width = b.kind === 'sing' ? 1.2 : 0.22 * size;
    b.alive = true;
    b.last = null;
    b.homing = o.homing ?? 0;
    b.crit = o.crit ?? 0;
    this.list.push(b);
    return b;
  }

  clear(): void {
    for (const b of this.list) this.pool.push(b);
    this.list.length = 0;
  }

  /** Remove enemy bolts (boss death, sector clear). */
  clearEnemy(game: Game): void {
    for (const b of this.list) {
      if (b.team === 'enemy' && b.alive) {
        b.alive = false;
        game.fx.sparks(b.x, b.z, b.hex, 3, 4, 0.4);
      }
    }
  }

  update(dt: number, game: Game): void {
    const arena = BAL.arenaRadius + 25;
    for (const b of this.list) {
      if (!b.alive) continue;
      const prey = b.homing > 0 ? game.nearestShip(b.x, b.z) : null;
      if (prey) {
        const sp = Math.hypot(b.vx, b.vz);
        const a = turnToward(Math.atan2(b.vz, b.vx), Math.atan2(prey.z - b.z, prey.x - b.x), b.homing * dt);
        b.vx = Math.cos(a) * sp;
        b.vz = Math.sin(a) * sp;
      }
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x * b.x + b.z * b.z > arena * arena) {
        b.alive = false;
        if (b.kind === 'sing') game.vortex(b.x, b.z);
        continue;
      }
      if (b.team === 'player') this.hitPlayerBolt(b, game);
      else this.hitEnemyBolt(b, game);
    }
    // compact
    let j = 0;
    for (let i = 0; i < this.list.length; i++) {
      const b = this.list[i];
      if (b.alive) this.list[j++] = b;
      else this.pool.push(b);
    }
    this.list.length = j;
  }

  private hitPlayerBolt(b: Bolt, game: Game): void {
    const cands = game.grid.query(b.x, b.z, b.r + 1, this.cands);
    for (const t of cands) {
      if (!t.alive || t === b.last) continue;
      const rr = t.r + b.r;
      if ((t.x - b.x) ** 2 + (t.z - b.z) ** 2 > rr * rr) continue;
      const ang = Math.atan2(b.vz, b.vx);
      let dmg = b.dmg;
      if (b.crit > 0 && t.team === 'enemy' && Math.random() < b.crit) {
        dmg *= 2;
        game.fx.text(b.x, b.z, 'CRIT!', 'fx-crit', 0.6, 1.2);
        game.fx.sparks(b.x, b.z, 0xffd25a, 8, 9, 0.45);
      }
      t.onHit(dmg, game, b.x - b.vx * 0.02, b.z - b.vz * 0.02);
      game.fx.spray(b.x, b.z, ang + Math.PI, b.hex, b.kind === 'rail' ? 8 : 4, 9, 0.9);
      if (b.splash > 0) game.splash(b.x, b.z, b.splash, b.dmg * 0.5, t, b.hex);
      if (b.kind === 'sing') {
        b.alive = false;
        game.vortex(b.x, b.z);
        return;
      }
      b.last = t;
      if (b.pierce-- <= 0) {
        b.alive = false;
        return;
      }
    }
  }

  private hitEnemyBolt(b: Bolt, game: Game): void {
    for (const ship of game.ships) {
      if (!ship.alive) continue;
      const rr = ship.r + b.r;
      if ((ship.x - b.x) ** 2 + (ship.z - b.z) ** 2 < rr * rr) {
        if (ship.hurt(b.dmg, game)) game.fx.sparks(b.x, b.z, 0xffd0a0, 8, 7, 0.45);
        b.alive = false;
        return;
      }
    }
    if (game.station.absorbBolt(b, game)) {
      b.alive = false;
      return;
    }
    // asteroids are cover
    const cands = game.grid.query(b.x, b.z, b.r + 0.5, this.cands);
    for (const t of cands) {
      if (t.team !== 'neutral' || !t.alive) continue;
      const rr = t.r + b.r;
      if ((t.x - b.x) ** 2 + (t.z - b.z) ** 2 < rr * rr) {
        game.fx.sparks(b.x, b.z, b.hex, 4, 5, 0.4);
        b.alive = false;
        return;
      }
    }
  }

  render(): void {
    let pc = 0, ec = 0;
    for (const b of this.list) {
      const ang = Math.atan2(b.vz, b.vx);
      if (b.team === 'player' && pc < MAX_P) {
        this.q.setFromAxisAngle(this.yAxis, -ang);
        this.p.set(b.x, 0.45, b.z);
        this.s.set(b.len, b.width, b.width);
        this.m4.compose(this.p, this.q, this.s);
        this.pMesh.setMatrixAt(pc, this.m4);
        this.pMesh.setColorAt(pc, b.color);
        pc++;
      } else if (b.team === 'enemy' && ec < MAX_E) {
        this.q.identity();
        this.p.set(b.x, 0.45, b.z);
        this.s.setScalar(b.r * 1.15);
        this.m4.compose(this.p, this.q, this.s);
        this.eMesh.setMatrixAt(ec, this.m4);
        this.eMesh.setColorAt(ec, b.color);
        ec++;
      }
    }
    this.pMesh.count = pc;
    this.eMesh.count = ec;
    this.pMesh.instanceMatrix.needsUpdate = true;
    this.eMesh.instanceMatrix.needsUpdate = true;
    if (this.pMesh.instanceColor) this.pMesh.instanceColor.needsUpdate = true;
    if (this.eMesh.instanceColor) this.eMesh.instanceColor.needsUpdate = true;
  }
}
