import * as THREE from 'three';
import { BAL } from '../config/balance';
import { ENEMY_BY_ID, type BossDef } from '../config/sectors';
import type { Game } from '../game';
import { Rng, turnToward } from '../logic/math';
import { leadAim } from '../logic/targeting';
import { glass } from '../render/materials';
import { makeBoss, type Rig } from '../render/models';
import type { Hittable } from './types';
import type { Ship } from './ship';

const rng = new Rng(666);

/** A destructible part (Xenarch's turret pods). */
export class BossPod implements Hittable {
  x = 0;
  z = 0;
  vx = 0;
  vz = 0;
  r = 1.35;
  hp: number;
  maxHp: number;
  alive = true;
  readonly team = 'enemy' as const;
  cd = rng.range(0.5, 1.5);
  constructor(readonly boss: Boss, readonly obj: THREE.Object3D, hp: number) {
    this.hp = this.maxHp = hp;
  }
  onHit(dmg: number, game: Game): void {
    if (!this.alive) return;
    this.hp -= dmg;
    this.boss.flash = 0.06;
    game.addNova((dmg / this.boss.maxHp) * 0.5);
    if (this.hp <= 0) {
      this.alive = false;
      this.obj.visible = false;
      game.fx.explosion(this.x, this.z, 2.4, 0xffb030, 0x6a463a);
      game.stage.shake(0.6);
      game.audio.play('bigBoom');
      game.crystals.spawn(this.x, this.z, 10, 1.5, game);
      this.boss.podDown(game);
    }
  }
}

/** Sovereign's illusions: look real, pop in one hit. */
export class Decoy implements Hittable {
  x: number;
  z: number;
  vx = 0;
  vz = 0;
  r = 2.4;
  alive = true;
  readonly team = 'enemy' as const;
  hp = 1;
  cd = rng.range(1, 2);
  a = rng.range(0, Math.PI * 2);
  constructor(readonly mesh: THREE.Object3D, x: number, z: number) {
    this.x = x;
    this.z = z;
  }
  onHit(_dmg: number, game: Game): void {
    if (!this.alive) return;
    this.alive = false;
    this.mesh.visible = false;
    game.fx.flash(this.x, this.z, 8, 0xff4aff, 0.35);
    game.fx.sparks(this.x, this.z, 0xff9aff, 30, 10);
    game.fx.text(this.x, this.z, 'FAKE!', 'fx-warn');
    game.audio.play('blink');
  }
}

export class Boss implements Hittable {
  x: number;
  z: number;
  vx = 0;
  vz = 0;
  r: number;
  hp: number;
  maxHp: number;
  alive = true;
  readonly team = 'enemy' as const;
  immune = false;
  heading: number;
  t = 0;
  flash = 0;
  readonly rig: Rig;
  pods: BossPod[] = [];
  decoys: Decoy[] = [];
  private state = 'enter';
  private st = 0;
  private cd: Record<string, number> = { ring: 3, aim: 2, spawn: 6, orb: 3, tele: 6, broad: 2, laser: 6, cycle: 5 };
  private orbitA: number;
  private ringOff = 0;
  private dashX = 0;
  private dashZ = 0;
  private laserA = 0;
  private laserDir = 1;
  private decoyStage = 0;
  private immuneMsg = 0;
  private dashes = 0;
  private enraged = false;
  private halfSaid = false;
  readonly id: BossDef['id'];

  constructor(readonly def: BossDef, x: number, z: number, hpScale: number, private scene: THREE.Scene) {
    this.id = def.id;
    this.x = x;
    this.z = z;
    this.heading = Math.atan2(-z, -x);
    this.orbitA = Math.atan2(z, x);
    this.r = def.id === 'xenarch' ? 5.0 : def.id === 'marauder' ? 3.3 : def.id === 'sovereign' ? 2.9 : 3.4;
    this.hp = this.maxHp = def.hp * hpScale;
    this.rig = makeBoss(def.id, def.color, def.glow);
    if (def.id === 'xenarch') {
      // pods carry 60% of the total health; the core gets the rest once they're gone
      for (let k = 0; k < 4; k++) this.pods.push(new BossPod(this, this.rig.parts['pod' + k], this.maxHp * 0.15));
      this.hp = this.maxHp * 0.4;
      this.immune = true;
    }
    this.rig.root.position.set(x, 0, z);
    scene.add(this.rig.root);
  }

  /** Total remaining health 0..1 (for the boss bar). */
  get frac(): number {
    let hp = Math.max(0, this.hp);
    for (const p of this.pods) hp += Math.max(0, p.hp);
    return hp / this.maxHp;
  }

  onHit(dmg: number, game: Game, hx: number, hz: number): void {
    if (!this.alive) return;
    if (this.immune) {
      game.fx.sparks(hx, hz, 0xffe08a, 3, 5, 0.4);
      if (this.immuneMsg <= 0) {
        this.immuneMsg = 1.6;
        game.fx.text(hx, hz, 'IMMUNE: hit the pods!', 'fx-warn');
        game.audio.play('clink');
      }
      return;
    }
    this.hp -= dmg;
    this.flash = 0.06;
    game.addNova((dmg / this.maxHp) * 0.5);
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      game.bossDefeated(this);
    }
  }

  podDown(game: Game): void {
    if (this.pods.every((p) => !p.alive)) {
      this.immune = false;
      game.ui.banner('THE CORE IS EXPOSED!', 'Hit the glowing core!', 'gold', 2.4);
      game.audio.play('bossRoar');
      this.rig.parts.core.scale.setScalar(1.4);
    }
  }

  dispose(): void {
    this.scene.remove(this.rig.root);
    for (const d of this.decoys) this.scene.remove(d.mesh);
  }

  /** Aim point: the nearest ship if one is close, else the station. */
  private target(game: Game): { x: number; z: number; ship: boolean } {
    const s = game.nearestShip(this.x, this.z, 48);
    if (s) {
      this.prey = s;
      return { x: s.x, z: s.z, ship: true };
    }
    return { x: game.station.x, z: game.station.z, ship: false };
  }

  private prey: Ship | null = null;

  private bolt(game: Game, x: number, z: number, angle: number, speed = 16, size = 1.4, homing = 0, life?: number): void {
    game.bolts.fire({ x, z, angle, speed, dmg: this.def.dmg, team: 'enemy', color: this.def.glow, range: 60, size, homing, life });
  }

  private ring(game: Game, n: number, speed = 15): void {
    this.ringOff += 0.21;
    for (let i = 0; i < n; i++) this.bolt(game, this.x, this.z, this.ringOff + (i / n) * Math.PI * 2, speed);
    game.audio.play('bossShot');
  }

  private moveOrbit(dt: number, radius: number, angSpeed: number, speed: number): void {
    this.orbitA += angSpeed * dt;
    const tx = Math.cos(this.orbitA) * radius, tz = Math.sin(this.orbitA) * radius;
    const dx = tx - this.x, dz = tz - this.z;
    const d = Math.hypot(dx, dz) || 1;
    const k = 1 - Math.exp(-1.5 * dt);
    this.vx += ((dx / d) * Math.min(speed, d * 1.5) - this.vx) * k;
    this.vz += ((dz / d) * Math.min(speed, d * 1.5) - this.vz) * k;
  }

  update(dt: number, game: Game): void {
    this.t += dt;
    this.st += dt;
    this.immuneMsg -= dt;
    for (const k in this.cd) this.cd[k] -= dt;
    const tg = this.target(game);
    const cease = game.ceaseFire;

    if (this.state === 'enter') {
      // fly in toward the station
      const d = Math.hypot(this.x, this.z);
      const want = this.id === 'xenarch' ? 30 : 32;
      const k = 1 - Math.exp(-1.2 * dt);
      const sp = d > want + 2 ? 10 : 0;
      this.vx += ((-this.x / d) * sp - this.vx) * k;
      this.vz += ((-this.z / d) * sp - this.vz) * k;
      if (d < want + 3 || this.st > 9) {
        this.state = this.id === 'marauder' ? 'cruise' : 'fight';
        this.st = 0;
        this.orbitA = Math.atan2(this.z, this.x);
      }
    } else if (this.id === 'override') this.override(dt, game, tg, cease);
    else if (this.id === 'marauder') this.marauder(dt, game, tg, cease);
    else if (this.id === 'sovereign') this.sovereign(dt, game, tg, cease);
    else this.xenarch(dt, game, tg, cease);

    this.x += this.vx * dt;
    this.z += this.vz * dt;
    // keep out of the station
    const d = Math.hypot(this.x, this.z) || 1;
    const minD = game.station.radius + this.r + 2;
    if (d < minD) {
      this.x = (this.x / d) * minD;
      this.z = (this.z / d) * minD;
    }

    // visuals
    this.flash = Math.max(0, this.flash - dt);
    const f = this.flash > 0 ? 1 : 0;
    for (const m of this.rig.mats) m.emissive.setRGB(f, f * 0.9, f * 0.9);
    const root = this.rig.root;
    root.position.set(this.x, 0.2, this.z);
    if (this.state !== 'dash') this.heading = turnToward(this.heading, Math.atan2(tg.z - this.z, tg.x - this.x), (this.id === 'xenarch' ? 0.4 : 1.8) * dt);
    root.rotation.y = this.id === 'xenarch' ? this.t * 0.15 : -this.heading;
    this.rig.body.position.y = Math.sin(this.t * 1.5) * 0.25;
    if (this.rig.parts.ring) this.rig.parts.ring.rotation.y += dt * (this.hp < this.maxHp * 0.5 ? 2.2 : 0.9);
    if (this.rig.parts.crown) this.rig.parts.crown.rotation.y += dt * 0.8;
    if (this.rig.parts.core) {
      const c = this.rig.parts.core;
      const s = (this.immune ? 1 : 1.35) * (1 + Math.sin(this.t * 6) * 0.08);
      c.scale.setScalar(s);
    }
    if (!this.halfSaid && this.frac < 0.5) {
      this.halfSaid = true;
      game.onBossHalf(this);
    }
    if (this.frac < 0.5 && Math.random() < 0.6) {
      const a = Math.random() * Math.PI * 2, rr = Math.random() * this.r;
      game.fx.particle(this.x + Math.cos(a) * rr, 1, this.z + Math.sin(a) * rr, 0, 2.5, 0, 0x55555e, 2.2, 1.2, 0.7, 0.8);
      if (Math.random() < 0.15) game.fx.sparks(this.x + Math.cos(a) * rr, this.z + Math.sin(a) * rr, 0xffa040, 4, 6, 0.4, 0.8);
    }
    // engine glow particles
    if (Math.random() < 0.6) {
      const a = this.heading + Math.PI + rng.range(-0.4, 0.4);
      game.fx.particle(this.x + Math.cos(a) * this.r, 0.3, this.z + Math.sin(a) * this.r, Math.cos(a) * 3, 0, Math.sin(a) * 3, this.def.glow, 1.2, 0.5, 1.8, 1);
    }
    // pods follow the (rotating) body
    for (const p of this.pods) {
      p.obj.getWorldPosition(this.tmp);
      p.x = this.tmp.x;
      p.z = this.tmp.z;
    }
    for (const dcy of this.decoys) {
      if (!dcy.alive) continue;
      dcy.a += dt * 0.5;
      const tx = tg.x + Math.cos(dcy.a) * 22, tz = tg.z + Math.sin(dcy.a) * 22;
      dcy.x += (tx - dcy.x) * (1 - Math.exp(-0.8 * dt));
      dcy.z += (tz - dcy.z) * (1 - Math.exp(-0.8 * dt));
      dcy.mesh.position.set(dcy.x, 0.2 + Math.sin(this.t * 1.5 + dcy.a) * 0.25, dcy.z);
      dcy.mesh.rotation.y = -Math.atan2(tg.z - dcy.z, tg.x - dcy.x);
      dcy.cd -= dt;
      if (dcy.cd <= 0 && !cease) {
        dcy.cd = rng.range(1.6, 2.6);
        this.bolt(game, dcy.x, dcy.z, Math.atan2(tg.z - dcy.z, tg.x - dcy.x), 14, 1.2);
      }
    }
  }

  private tmp = new THREE.Vector3();

  // ---------------------------------------------------------------- Protocol Override
  private override(dt: number, game: Game, tg: { x: number; z: number; ship: boolean }, cease: boolean): void {
    this.moveOrbit(dt, 30, 0.16, 7);
    const half = this.hp < this.maxHp * 0.5;
    if (half && !this.enraged) {
      this.enraged = true;
      game.ui.toast('Protocol Override is deploying drones!', 'bad');
      game.audio.play('bossRoar');
    }
    if (cease) return;
    if (this.cd.ring <= 0) {
      this.cd.ring = half ? 2.0 : 2.6;
      this.ring(game, half ? 22 : 16);
    }
    if (this.cd.aim <= 0 && tg.ship) {
      this.cd.aim = 1.3;
      const p = leadAim(this, this.prey ?? game.ship, 18);
      const a = Math.atan2(p.z - this.z, p.x - this.x);
      for (const o of [-0.15, 0, 0.15]) this.bolt(game, this.x + Math.cos(this.heading) * 2, this.z + Math.sin(this.heading) * 2, a + o, 18, 1.2);
    }
    if (half && this.cd.spawn <= 0) {
      this.cd.spawn = 8;
      const def = ENEMY_BY_ID['training_drone'];
      for (let i = 0; i < 3; i++) {
        const a = rng.range(0, Math.PI * 2);
        game.spawnEnemy(def, this.x + Math.cos(a) * 4, this.z + Math.sin(a) * 4, a, 1);
      }
      game.fx.ring(this.x, this.z, 6, 0xff4040, 0.5);
    }
  }

  // ---------------------------------------------------------------- Crimson Marauder
  private marauder(dt: number, game: Game, tg: { x: number; z: number; ship: boolean }, cease: boolean): void {
    const low = this.hp < this.maxHp * 0.4;
    if (this.state === 'cruise') {
      this.moveOrbit(dt, 34, 0.2, 9);
      if (this.cd.broad <= 0 && !cease) {
        this.cd.broad = low ? 1.2 : 1.6;
        for (const s of [1, -1]) {
          const a = this.heading + (s * Math.PI) / 2;
          for (let k = 0; k < 4; k++) {
            const ox = Math.cos(this.heading) * (1.2 - k * 1.0), oz = Math.sin(this.heading) * (1.2 - k * 1.0);
            this.bolt(game, this.x + ox + Math.cos(a) * 1.2, this.z + oz + Math.sin(a) * 1.2, a + rng.range(-0.05, 0.05), 15, 1.3);
          }
        }
        game.audio.play('bossShot');
      }
      if (this.st > (low ? 3.5 : 5)) {
        this.state = 'aim';
        this.st = 0;
        this.dashes = low ? 2 : 1;
      }
    } else if (this.state === 'aim') {
      const k = Math.exp(-3 * dt);
      this.vx *= k;
      this.vz *= k;
      this.heading = turnToward(this.heading, Math.atan2(tg.z - this.z, tg.x - this.x), 3 * dt);
      const len = 70;
      this.dashX = this.x + Math.cos(this.heading) * len;
      this.dashZ = this.z + Math.sin(this.heading) * len;
      const pulse = 0.15 + 0.25 * Math.abs(Math.sin(this.st * 14));
      game.fx.segment(this.x, 0.3, this.z, this.dashX, 0.3, this.dashZ, pulse, new THREE.Color(3, 0.3, 0.2));
      if (this.st > 1.1) {
        this.state = 'dash';
        this.st = 0;
        game.audio.play('dashBoss');
        game.stage.shake(0.3);
      }
    } else if (this.state === 'dash') {
      const sp = 46;
      this.vx = Math.cos(this.heading) * sp;
      this.vz = Math.sin(this.heading) * sp;
      game.fx.particle(this.x, 0.3, this.z, 0, 0, 0, 0xff4a2a, 3, 0.4, 2, 0);
      for (const s of game.ships) if (s.alive && Math.hypot(s.x - this.x, s.z - this.z) < this.r + s.r + 0.5) s.hurt(25, game);
      const st = game.station;
      // (update() keeps bosses at station.radius + r + 2, so "touching" means within that ring)
      if (st.alive && Math.hypot(this.x, this.z) < st.radius + this.r + 2.5 && !cease) {
        st.hurt(60, game, this.x, this.z);
        game.fx.explosion(this.x, this.z, 2.5, 0xff6a3a);
        game.stage.shake(0.8);
        this.vx = -this.vx * 0.3;
        this.vz = -this.vz * 0.3;
        this.state = 'recover';
        this.st = 0;
      }
      const r = Math.hypot(this.x, this.z);
      if (this.st > 1.0 || r > BAL.arenaRadius - 4) {
        this.state = 'recover';
        this.st = 0;
      }
    } else {
      const k = Math.exp(-2 * dt);
      this.vx *= k;
      this.vz *= k;
      if (this.st > 0.9) {
        this.dashes--;
        this.state = this.dashes > 0 ? 'aim' : 'cruise';
        this.st = 0;
        this.orbitA = Math.atan2(this.z, this.x);
      }
    }
  }

  // ---------------------------------------------------------------- Nebula Sovereign
  private sovereign(dt: number, game: Game, tg: { x: number; z: number; ship: boolean }, cease: boolean): void {
    // hover at a distance from the target
    const dx = this.x - tg.x, dz = this.z - tg.z;
    const d = Math.hypot(dx, dz) || 1;
    const want = 22;
    const k = 1 - Math.exp(-1.2 * dt);
    const tx = tg.x + (dx / d) * want + Math.cos(this.t * 0.6) * 4;
    const tz = tg.z + (dz / d) * want + Math.sin(this.t * 0.6) * 4;
    this.vx += ((tx - this.x) * 1.2 - this.vx) * k;
    this.vz += ((tz - this.z) * 1.2 - this.vz) * k;
    const frac = this.hp / this.maxHp;
    if ((frac < 0.66 && this.decoyStage === 0) || (frac < 0.33 && this.decoyStage === 1)) {
      this.decoyStage++;
      this.spawnDecoys(game);
    }
    if (cease) return;
    if (this.cd.orb <= 0) {
      this.cd.orb = frac < 0.5 ? 2.4 : 3;
      for (let i = 0; i < 4; i++) {
        const a = this.heading + (i - 1.5) * 0.5;
        this.bolt(game, this.x + Math.cos(a) * 2, this.z + Math.sin(a) * 2, a, 11, 1.7, 1.4, 5.5);
      }
      game.audio.play('bossShot');
    }
    if (this.cd.tele <= 0) {
      this.cd.tele = 6;
      game.fx.flash(this.x, this.z, 12, 0xff4aff, 0.4);
      game.fx.sparks(this.x, this.z, 0xff9aff, 30, 12);
      const a = rng.range(0, Math.PI * 2);
      const rad = rng.range(18, 26);
      this.x = tg.x + Math.cos(a) * rad;
      this.z = tg.z + Math.sin(a) * rad;
      const r = Math.hypot(this.x, this.z);
      if (r > BAL.arenaRadius - 8) {
        this.x *= (BAL.arenaRadius - 8) / r;
        this.z *= (BAL.arenaRadius - 8) / r;
      }
      this.vx = this.vz = 0;
      game.fx.flash(this.x, this.z, 12, 0xff4aff, 0.4);
      game.audio.play('blink');
      this.ring(game, 14, 13);
    }
  }

  private spawnDecoys(game: Game): void {
    game.ui.toast('Nebula Sovereign splits! Which one is real?', 'bad');
    game.audio.play('bossRoar');
    for (let i = 0; i < 2; i++) {
      const mesh = makeBoss('sovereign', this.def.color, this.def.glow).root;
      mesh.traverse((o) => {
        if (o instanceof THREE.Mesh) o.material = glass(0xff7aff, 1.1);
      });
      const a = rng.range(0, Math.PI * 2);
      const dcy = new Decoy(mesh, this.x + Math.cos(a) * 8, this.z + Math.sin(a) * 8);
      dcy.a = a;
      this.scene.add(mesh);
      this.decoys.push(dcy);
      game.fx.flash(dcy.x, dcy.z, 10, 0xff4aff, 0.4);
    }
  }

  // ---------------------------------------------------------------- Xenarch Prime
  private xenarch(dt: number, game: Game, tg: { x: number; z: number; ship: boolean }, cease: boolean): void {
    this.moveOrbit(dt, 30, 0.07, 4);
    if (cease) return;
    const phase2 = !this.immune;
    for (const p of this.pods) {
      if (!p.alive) continue;
      p.cd -= dt;
      const head = p.obj.userData.head as THREE.Object3D;
      const a = Math.atan2(tg.z - p.z, tg.x - p.x);
      // pods live in the rotating body: convert world angle to local
      head.rotation.y = -a - this.rig.root.rotation.y;
      if (p.cd <= 0) {
        p.cd = 1.5;
        for (const o of [-0.08, 0.08]) this.bolt(game, p.x + Math.cos(a) * 1.4, p.z + Math.sin(a) * 1.4, a + o, 17, 1.3);
        game.audio.play('enemyShot');
      }
    }
    if (!phase2) return;
    if (this.cd.ring <= 0) {
      this.cd.ring = 3.2;
      this.ring(game, 20, 14);
    }
    if (this.cd.spawn <= 0) {
      this.cd.spawn = 12;
      const def = ENEMY_BY_ID['alien_scout'];
      for (let i = 0; i < 4; i++) {
        const a = rng.range(0, Math.PI * 2);
        game.spawnEnemy(def, this.x + Math.cos(a) * 7, this.z + Math.sin(a) * 7, a, 1);
      }
    }
    // sweeping laser: telegraph, then sweep
    if (this.state === 'fight' && this.cd.laser <= 0) {
      this.state = 'laserAim';
      this.st = 0;
      this.laserDir = rng.chance(0.5) ? 1 : -1;
      this.laserA = Math.atan2(tg.z - this.z, tg.x - this.x) - this.laserDir * 1.2;
      game.audio.play('charge');
    }
    const len = 52;
    if (this.state === 'laserAim') {
      const w = 0.1 + 0.15 * Math.abs(Math.sin(this.st * 16));
      game.fx.segment(this.x, 1.6, this.z, this.x + Math.cos(this.laserA) * len, 0.6, this.z + Math.sin(this.laserA) * len, w, new THREE.Color(3, 0.6, 0.1));
      if (this.st > 1.2) {
        this.state = 'laser';
        this.st = 0;
        game.audio.play('laserBeam');
      }
    } else if (this.state === 'laser') {
      this.laserA += this.laserDir * (2.4 / 2.4) * dt;
      const ex = this.x + Math.cos(this.laserA) * len, ez = this.z + Math.sin(this.laserA) * len;
      game.fx.segment(this.x, 1.6, this.z, ex, 0.6, ez, 1.1, new THREE.Color(4, 1.4, 0.3));
      game.fx.segment(this.x, 1.6, this.z, ex, 0.6, ez, 0.4, new THREE.Color(5, 5, 4));
      for (const s of game.ships) if (s.alive && segDist(s.x, s.z, this.x, this.z, ex, ez) < 1.4 + s.r) s.hurt(22, game);
      const st = game.station;
      if (st.alive && segDist(st.x, st.z, this.x, this.z, ex, ez) < st.radius) st.hurt(45 * dt, game, st.x, st.z);
      if (Math.random() < 0.5) game.fx.sparks(ex, ez, 0xffb030, 3, 6, 0.5);
      if (this.st > 2.4) {
        this.state = 'fight';
        this.cd.laser = 7;
      }
    }
  }
}

function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax, vz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}
