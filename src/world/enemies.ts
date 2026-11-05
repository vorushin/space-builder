import * as THREE from 'three';
import { BAL } from '../config/balance';
import { ENEMY_BY_ID, type EnemyDef } from '../config/sectors';
import type { Game } from '../game';
import { Rng, turnToward, wrapAngle } from '../logic/math';
import { leadAim } from '../logic/targeting';
import type { SpawnOrder } from '../logic/waves';
import { disposeRig, makeEnemy, type Rig } from '../render/models';
import type { Hittable } from './types';

const rng = new Rng(2024);
const barGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const barBg = new THREE.MeshBasicMaterial({ color: 0x220a0a, transparent: true, opacity: 0.75, depthWrite: false });
const barFg = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff4a4a).multiplyScalar(1.6), depthWrite: false });

let nextId = 1;

export class Enemy implements Hittable {
  x: number;
  z: number;
  vx = 0;
  vz = 0;
  heading: number;
  r: number;
  hp: number;
  maxHp: number;
  alive = true;
  readonly team = 'enemy' as const;
  readonly id = nextId++;
  readonly rig: Rig;
  private t = 0;
  private fireCd: number;
  private burstLeft = 0;
  private burstCd = 0;
  private blinkCd = rng.range(2.5, 4);
  private flashT = 0;
  private orbitDir = rng.chance(0.5) ? 1 : -1;
  private bar: THREE.Group | null = null;
  private fg: THREE.Mesh | null = null;
  private aimJitter = rng.range(-0.06, 0.06);

  constructor(
    readonly def: EnemyDef,
    x: number,
    z: number,
    heading: number,
    hpScale: number,
    private scene: THREE.Scene,
  ) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.r = def.radius;
    this.hp = this.maxHp = def.hp * hpScale;
    this.fireCd = rng.range(1.2, 2.5);
    this.rig = makeEnemy(def);
    this.rig.root.position.set(x, 0, z);
    scene.add(this.rig.root);
    if (def.hp >= 250) {
      this.bar = new THREE.Group();
      const bg = new THREE.Mesh(barGeo, barBg);
      bg.scale.set(2.4, 1, 0.32);
      this.fg = new THREE.Mesh(barGeo, barFg);
      this.fg.position.y = 0.01;
      this.fg.scale.set(2.3, 1, 0.22);
      this.bar.add(bg, this.fg);
      scene.add(this.bar);
    }
  }

  onHit(dmg: number, game: Game, hx: number, hz: number): void {
    if (!this.alive) return;
    this.hp -= dmg;
    this.flashT = 0.07;
    const k = Math.min(1.5, dmg / this.maxHp) * 6 / this.r;
    const a = Math.atan2(this.z - hz, this.x - hx);
    this.vx += Math.cos(a) * k;
    this.vz += Math.sin(a) * k;
    if (this.hp <= 0) this.die(game);
  }

  die(game: Game, silent = false): void {
    if (!this.alive) return;
    this.alive = false;
    const big = this.r > 2;
    game.fx.explosion(this.x, this.z, this.r * (big ? 1.4 : 1.1), this.def.glow, this.def.color);
    game.stage.shake(big ? 0.5 : 0.18);
    if (!silent) game.audio.play(big ? 'bigBoom' : 'boom');
    if (big) game.hitStop(0.05);
    game.crystals.spawn(this.x, this.z, Math.round(this.def.crystals * game.mods.crystals), this.r, game);
    game.stats.kills++;
    game.addNova(this.def.crystals * 0.011);
    const chance = this.def.role === 'tank' ? BAL.powerupChanceTank : BAL.powerupChance;
    if (rng.chance(chance)) game.pickups.drop(game, this.x, this.z);
    if (this.def.role === 'splitter' && !silent) {
      const spawn = ENEMY_BY_ID['xeno_spawn'];
      for (const s of [-1, 1]) {
        const e = game.spawnEnemy(spawn, this.x + Math.cos(this.heading + s * 1.6) * 1.2, this.z + Math.sin(this.heading + s * 1.6) * 1.2, this.heading + s * 0.8, 1);
        e.vx = Math.cos(this.heading + s * 1.2) * 10;
        e.vz = Math.sin(this.heading + s * 1.2) * 10;
      }
    }
  }

  dispose(): void {
    this.scene.remove(this.rig.root);
    disposeRig(this.rig);
    if (this.bar) this.scene.remove(this.bar);
  }

  update(dt: number, game: Game): void {
    this.t += dt;
    const def = this.def;
    const ship = game.ship;
    const st = game.station;
    const dShip = ship.alive ? Math.hypot(ship.x - this.x, ship.z - this.z) : Infinity;
    const dSt = Math.hypot(st.x - this.x, st.z - this.z) - st.radius;

    // who are we after?
    let useShip: boolean;
    if (def.role === 'raider') useShip = dShip < 9;
    else if (def.role === 'tank') useShip = false;
    else useShip = dShip < 34 || dShip < dSt;
    const tx = useShip ? ship.x : st.x;
    const tz = useShip ? ship.z : st.z;
    const tr = useShip ? 0 : st.radius;
    const standoff =
      def.role === 'swarmer' ? (useShip ? 5 : 3) :
      def.role === 'gunship' ? (useShip ? 15 : 11) :
      def.role === 'raider' ? (useShip ? 6 : 3.5) :
      def.role === 'tank' ? 10 :
      def.role === 'blinker' ? (useShip ? 8 : 5) : 12;

    const dx = tx - this.x, dz = tz - this.z;
    const d = Math.hypot(dx, dz) || 0.01;
    const nx = dx / d, nz = dz / d;
    const gap = d - tr - standoff;
    const sp = def.speed;
    let wx: number, wz: number;
    if (gap > 2) {
      wx = nx * sp;
      wz = nz * sp;
    } else {
      // orbit around the target, holding the standoff distance
      const tang = def.role === 'tank' ? 0.25 : def.role === 'raider' ? 0.7 : 0.85;
      wx = -nz * this.orbitDir * sp * tang + nx * gap * 1.2;
      wz = nx * this.orbitDir * sp * tang + nz * gap * 1.2;
    }
    // separation from other enemies and from rocks
    for (const o of game.grid.query(this.x, this.z, this.r + 3, game.scratch)) {
      if (o === this || !o.alive) continue;
      const ox = this.x - o.x, oz = this.z - o.z;
      const od = Math.hypot(ox, oz) || 0.01;
      const min = this.r + o.r + (o.team === 'neutral' ? 1.2 : 0.6);
      if (od < min) {
        const push = ((min - od) / min) * (o.team === 'neutral' ? 14 : 8);
        wx += (ox / od) * push;
        wz += (oz / od) * push;
      }
    }
    const k = 1 - Math.exp(-2.6 * dt);
    this.vx += (wx - this.vx) * k;
    this.vz += (wz - this.vz) * k;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // facing: gunships and tanks face their target, others face where they fly
    const faceTarget = def.role === 'gunship' || def.role === 'tank' || def.role === 'splitter' || gap < 4;
    const want = faceTarget ? Math.atan2(dz, dx) : Math.atan2(this.vz, this.vx);
    this.heading = turnToward(this.heading, want, (def.role === 'tank' ? 1.6 : 5) * dt);

    // blink (Nebula Wraith)
    if (def.role === 'blinker' && this.t > 3) {
      this.blinkCd -= dt;
      if (this.blinkCd <= 0 && d < 40) {
        this.blinkCd = rng.range(2.8, 4.2);
        game.fx.flash(this.x, this.z, 5, def.glow, 0.3);
        game.fx.sparks(this.x, this.z, def.glow, 12, 7);
        const a = rng.range(0, Math.PI * 2);
        const rad = tr + rng.range(7, 11);
        this.x = tx + Math.cos(a) * rad;
        this.z = tz + Math.sin(a) * rad;
        this.vx = this.vz = 0;
        game.fx.flash(this.x, this.z, 5, def.glow, 0.3);
        game.audio.play('blink');
        this.burstLeft = 3;
        this.burstCd = 0.25;
      }
    }

    // contact damage
    if (ship.alive && dShip < this.r + ship.r) {
      if (ship.hurt(def.dmg + 6, game)) {
        this.onHit(12, game, ship.x, ship.z);
        const a = Math.atan2(this.z - ship.z, this.x - ship.x);
        this.vx += Math.cos(a) * 14;
        this.vz += Math.sin(a) * 14;
      }
    }

    // weapons
    const inArena = this.x * this.x + this.z * this.z < (BAL.arenaRadius - 2) ** 2;
    const range = useShip ? 24 : tr + 22;
    this.fireCd -= dt;
    if (inArena && d < range && this.fireCd <= 0 && !game.ceaseFire) {
      this.fireCd = 1 / def.fireRate * rng.range(0.85, 1.15);
      if (def.role === 'tank') this.spreadShot(game, tx, tz, useShip);
      else this.burstLeft = def.burst;
    }
    this.burstCd -= dt;
    if (this.burstLeft > 0 && this.burstCd <= 0 && !game.ceaseFire) {
      this.burstLeft--;
      this.burstCd = 0.12;
      this.shoot(game, tx, tz, useShip);
    }

    // visuals
    this.flashT = Math.max(0, this.flashT - dt);
    const f = this.flashT > 0 ? 1.2 : 0;
    for (const m of this.rig.mats) m.emissive.setRGB(f, f, f);
    const root = this.rig.root;
    root.position.set(this.x, 0, this.z);
    root.rotation.y = -this.heading;
    const lateral = -Math.sin(this.heading) * this.vx + Math.cos(this.heading) * this.vz;
    this.rig.body.rotation.x = Math.max(-0.6, Math.min(0.6, -lateral * 0.06));
    this.rig.body.position.y = Math.sin(this.t * 3 + this.id) * 0.12;
    if (this.rig.parts.spin) this.rig.parts.spin.rotation.y += dt * 4;
    if (this.bar && this.fg) {
      this.bar.position.set(this.x, 2.2, this.z - this.r - 0.9);
      const hpK = Math.max(0, this.hp / this.maxHp);
      this.fg.scale.x = 2.3 * hpK;
      this.fg.position.x = -1.15 * (1 - hpK);
      this.bar.visible = hpK < 0.999;
    }
    if (Math.random() < 0.4) {
      game.fx.particle(this.x - Math.cos(this.heading) * this.r, 0.2, this.z - Math.sin(this.heading) * this.r, 0, 0, 0, def.glow, 0.45 * this.r, 0.25, 1.6, 0);
    }
    // badly damaged: smoke and the odd spark
    if (this.hp < this.maxHp * 0.5 && Math.random() < (this.r > 2 ? 0.5 : 0.22)) {
      game.fx.particle(this.x + (Math.random() - 0.5) * this.r, 0.5, this.z + (Math.random() - 0.5) * this.r, 0, 2, 0, 0x5a5a62, 0.9 * this.r, 0.9, 0.7, 1);
      if (Math.random() < 0.1) game.fx.sparks(this.x, this.z, 0xffa040, 2, 4, 0.35, 0.5);
    }
  }

  private shoot(game: Game, tx: number, tz: number, atShip: boolean): void {
    const def = this.def;
    let ax = tx, az = tz;
    if (atShip) {
      const p = leadAim(this, game.ship, BAL.enemyBoltSpeed);
      ax = p.x;
      az = p.z;
    }
    const ang = wrapAngle(Math.atan2(az - this.z, ax - this.x) + this.aimJitter + rng.range(-0.07, 0.07));
    game.bolts.fire({
      x: this.x + Math.cos(this.heading) * this.r,
      z: this.z + Math.sin(this.heading) * this.r,
      angle: ang,
      speed: BAL.enemyBoltSpeed,
      dmg: def.dmg,
      team: 'enemy',
      color: def.glow,
      range: 34,
    });
    game.audio.play('enemyShot');
  }

  private spreadShot(game: Game, tx: number, tz: number, atShip: boolean): void {
    const def = this.def;
    const base = Math.atan2(tz - this.z, tx - this.x);
    void atShip;
    for (let i = 0; i < def.burst; i++) {
      const t = def.burst === 1 ? 0 : i / (def.burst - 1) - 0.5;
      game.bolts.fire({
        x: this.x + Math.cos(this.heading) * this.r,
        z: this.z + Math.sin(this.heading) * this.r,
        angle: base + t * def.spread,
        speed: BAL.enemyBoltSpeed * 0.85,
        dmg: def.dmg,
        team: 'enemy',
        color: def.glow,
        range: 36,
        size: 1.3,
      });
    }
    game.audio.play('enemyShot');
  }
}

/** Formation offsets for a group arriving along `dir`. */
export function formation(order: SpawnOrder): { x: number; z: number; heading: number }[] {
  const out: { x: number; z: number; heading: number }[] = [];
  const cx = Math.cos(order.dir) * BAL.spawnRadius;
  const cz = Math.sin(order.dir) * BAL.spawnRadius;
  const inward = order.dir + Math.PI;
  const px = -Math.sin(order.dir), pz = Math.cos(order.dir);
  for (let i = 0; i < order.count; i++) {
    const side = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2);
    const back = Math.abs(side) * 1.6;
    out.push({
      x: cx + px * side * 3.2 + Math.cos(order.dir) * back,
      z: cz + pz * side * 3.2 + Math.sin(order.dir) * back,
      heading: inward,
    });
  }
  return out;
}
