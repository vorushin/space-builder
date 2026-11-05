import * as THREE from 'three';
import { BAL } from '../config/balance';
import type { Game } from '../game';
import { Rng, TAU } from '../logic/math';
import { disposeRig, makeComet, makeEnemy, makePod, type Rig } from '../render/models';
import { ENEMY_BY_ID } from '../config/sectors';
import type { Hittable } from './types';

export type EventKind = 'comet' | 'meteors' | 'supply' | 'giant' | 'sos' | 'treasure' | 'storm' | 'lava';

export const EVENT_TEXT: Record<EventKind, [string, string]> = {
  comet: ['GOLDEN COMET!', 'Shoot it before it escapes: it is full of crystals!'],
  meteors: ['METEOR SHOWER!', 'Dodge the fast rocks, or blast them for crystals'],
  supply: ['SUPPLY DROP!', 'A crate warped in. Grab it for a power-up!'],
  giant: ['CRYSTAL GIANT!', 'A huge crystal asteroid appeared'],
  sos: ['SOS SIGNAL!', 'Someone is stranded out there. Follow the gold arrow!'],
  treasure: ['PIRATE TREASURE SHIP!', 'It stole crystals and is running away. Catch it!'],
  storm: ['ION STORM!', 'Lightning strikes the glowing circles. Stay out of them!'],
  lava: ['LAVA RAIN!', 'Burning rocks are falling. Blast them or dodge them!'],
};

/** Extra surprises that only happen in one sector (index → kinds). */
const SECTOR_EVENTS: EventKind[][] = [[], ['treasure'], ['storm'], ['lava']];

const rng = new Rng(5150);
const STRIKE_R = 4.5;

/** Something worth chasing that runs away: the golden comet or a pirate treasure ship. */
class Comet implements Hittable {
  x: number;
  z: number;
  vx: number;
  vz: number;
  r = 1.5;
  hp: number;
  alive = true;
  readonly team = 'neutral' as const;
  mesh: THREE.Object3D;
  rig: Rig | null = null;
  private t = 0;
  private bx: number;
  private bz: number;
  constructor(readonly kind: 'comet' | 'treasure', x: number, z: number, vx: number, vz: number, hp: number) {
    this.x = this.bx = x;
    this.z = this.bz = z;
    this.vx = vx;
    this.vz = vz;
    this.hp = hp;
    if (kind === 'treasure') {
      // a big gold-painted pirate dart
      this.rig = makeEnemy(ENEMY_BY_ID['pirate_scout']);
      for (const m of this.rig.mats) {
        m.color.set(0xffc83a);
        m.metalness = 0.85;
        m.roughness = 0.25;
      }
      this.rig.root.scale.setScalar(1.8);
      this.mesh = this.rig.root;
      this.r = 1.9;
    } else this.mesh = makeComet();
  }
  /** Straight line for the comet; the pirate zig-zags. */
  move(dt: number): void {
    this.t += dt;
    this.bx += this.vx * dt;
    this.bz += this.vz * dt;
    if (this.kind === 'treasure') {
      const sp = Math.hypot(this.vx, this.vz) || 1;
      const side = Math.sin(this.t * 1.6) * 9;
      this.x = this.bx + (-this.vz / sp) * side;
      this.z = this.bz + (this.vx / sp) * side;
    } else {
      this.x = this.bx;
      this.z = this.bz;
    }
  }
  onHit(dmg: number, game: Game): void {
    if (!this.alive) return;
    this.hp -= dmg;
    game.fx.sparks(this.x, this.z, 0xffe08a, 3, 6, 0.5);
    if (this.rig) for (const m of this.rig.mats) m.emissive.setRGB(0.8, 0.6, 0.2);
    if (this.hp <= 0) {
      this.alive = false;
      game.fx.explosion(this.x, this.z, 2.4, 0xffd25a, 0xffd25a);
      game.audio.play('jackpot');
      if (this.kind === 'treasure') {
        game.crystals.spawn(this.x, this.z, 55, 2.5, game);
        game.pickups.drop(game, this.x, this.z);
        game.ui.toast('Pirate treasure! The stolen crystals are yours!', 'gold');
        game.stats.comets++;
      } else {
        game.crystals.spawn(this.x, this.z, 45, 2, game);
        game.ui.toast('Golden comet smashed! Crystals everywhere!', 'gold');
        game.stats.comets++;
        game.medal('comet');
      }
    }
  }
  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    if (this.rig) disposeRig(this.rig);
  }
}

/** Random calm-phase surprises (and Sparky's rescue). */
export class Events {
  comet: Comet | null = null;
  pod: { x: number; z: number; mesh: THREE.Group } | null = null;
  private meteorsLeft = 0;
  private meteorT = 0;
  private meteorDir = 0;
  private meteorLava = false;
  private stormT = 0;
  private strikeT = 0;
  private strikes: { x: number; z: number; t: number }[] = [];
  last: EventKind | null = null;

  constructor(private scene: THREE.Scene) {}

  clear(): void {
    this.comet?.dispose(this.scene);
    if (this.pod) this.scene.remove(this.pod.mesh);
    this.comet = null;
    this.pod = null;
    this.meteorsLeft = 0;
    this.stormT = 0;
    this.strikes = [];
  }

  /** Hittables this system owns (for the collision grid). */
  hittables(out: Hittable[]): void {
    if (this.comet?.alive) out.push(this.comet);
  }

  /** A random surprise; this sector's special event is twice as likely. */
  pickRandom(sector = 0): EventKind {
    const special = SECTOR_EVENTS[sector] ?? [];
    const pool: EventKind[] = (['comet', 'meteors', 'supply', 'giant', ...special, ...special] as EventKind[]).filter((k) => k !== this.last);
    return rng.pick(pool);
  }

  /** Label for the gold edge arrow. */
  beaconLabel(): string {
    if (this.pod) return 'SOS';
    if (this.comet?.kind === 'treasure') return 'Treasure';
    return 'Comet';
  }

  start(kind: EventKind, game: Game): void {
    this.last = kind;
    const [title, sub] = EVENT_TEXT[kind];
    game.ui.banner(title, sub, 'gold', 2.6);
    game.audio.play('event');
    const a = rng.range(0, TAU);
    switch (kind) {
      case 'comet':
      case 'treasure': {
        // fly a chord across the arena, passing near the middle
        const sx = Math.cos(a) * (BAL.arenaRadius + 8), sz = Math.sin(a) * (BAL.arenaRadius + 8);
        const ta = a + Math.PI + rng.range(-0.5, 0.5);
        const tx = Math.cos(ta) * 30, tz = Math.sin(ta) * 30;
        const d = Math.hypot(tx - sx, tz - sz);
        const sp = kind === 'treasure' ? 13 : 12;
        const hp = kind === 'treasure' ? 900 * game.def.rockHp : 140 * game.def.rockHp;
        this.comet?.dispose(this.scene);
        this.comet = new Comet(kind, sx, sz, ((tx - sx) / d) * sp, ((tz - sz) / d) * sp, hp);
        this.scene.add(this.comet.mesh);
        break;
      }
      case 'meteors':
      case 'lava':
        this.meteorsLeft = kind === 'lava' ? 26 : 22;
        this.meteorT = 1;
        this.meteorDir = a;
        this.meteorLava = kind === 'lava';
        break;
      case 'storm':
        this.stormT = 20;
        this.strikeT = 1.5;
        break;
      case 'supply': {
        const r = rng.range(20, 50);
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        game.pickups.crate(game, x, z);
        game.fx.flash(x, z, 10, 0x7dffb0, 0.5);
        game.fx.ring(x, z, 8, 0x7dffb0, 0.7);
        break;
      }
      case 'giant': {
        const r = rng.range(40, 60);
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        const g = game.asteroids.spawn('G', 'rich', x, z, 0, 0);
        g.grow = 0;
        game.fx.flash(x, z, 18, game.look.vein, 0.6);
        game.fx.ring(x, z, 14, game.look.vein, 0.8);
        break;
      }
      case 'sos': {
        const r = rng.range(40, 62);
        if (this.pod) this.scene.remove(this.pod.mesh);
        this.pod = { x: Math.cos(a) * r, z: Math.sin(a) * r, mesh: makePod() };
        this.pod.mesh.position.set(this.pod.x, 0.6, this.pod.z);
        this.scene.add(this.pod.mesh);
        break;
      }
    }
  }

  update(dt: number, game: Game): void {
    if (this.comet) {
      const c = this.comet;
      if (c.alive) {
        const px = c.x, pz = c.z;
        c.move(dt);
        c.mesh.position.set(c.x, 0.6, c.z);
        if (c.kind === 'treasure') {
          // face where it is going; gold sparkles fall off it
          c.mesh.rotation.y = -Math.atan2(c.z - pz, c.x - px);
          if (c.rig) for (const m of c.rig.mats) m.emissive.multiplyScalar(Math.exp(-8 * dt));
          if (Math.random() < 0.5) game.fx.particle(c.x, 0.5, c.z, 0, 1, 0, 0xffd25a, 0.7, 0.8, 2.2, 1);
        } else {
          c.mesh.rotation.x += dt * 1.3;
          c.mesh.rotation.z += dt * 0.9;
          for (let i = 0; i < 3; i++) {
            game.fx.particle(c.x - c.vx * 0.05 + rng.range(-0.6, 0.6), 0.6, c.z - c.vz * 0.05 + rng.range(-0.6, 0.6), -c.vx * 0.4, rng.range(-0.5, 0.5), -c.vz * 0.4, i ? 0xffd25a : 0xffffff, rng.range(0.6, 1.4), 0.9, 2.4, 0.8);
          }
        }
        if (c.x * c.x + c.z * c.z > (BAL.arenaRadius + 14) ** 2 && (c.x * c.vx + c.z * c.vz) > 0) {
          c.alive = false;
          game.ui.toast(c.kind === 'treasure' ? 'The pirates got away…' : 'The comet got away…', 'info');
        }
      }
      if (!c.alive) {
        c.dispose(this.scene);
        this.comet = null;
      }
    }
    if (this.meteorsLeft > 0) {
      this.meteorT -= dt;
      if (this.meteorT <= 0) {
        this.meteorT = 0.38;
        this.meteorsLeft--;
        const side = rng.range(-1, 1) * 60;
        const px = -Math.sin(this.meteorDir), pz = Math.cos(this.meteorDir);
        const sx = Math.cos(this.meteorDir) * (BAL.arenaRadius + 10) + px * side;
        const sz = Math.sin(this.meteorDir) * (BAL.arenaRadius + 10) + pz * side;
        const sp = rng.range(16, 22);
        const ang = this.meteorDir + Math.PI + rng.range(-0.15, 0.15);
        const kind = this.meteorLava ? (rng.chance(0.6) ? 'explosive' : 'rock') : rng.chance(0.3) ? 'rich' : 'rock';
        const m = game.asteroids.spawn('S', kind, sx, sz, Math.cos(ang) * sp, Math.sin(ang) * sp);
        m.meteor = true;
      }
    }
    for (const a of game.asteroids.list) {
      if (a.meteor && a.alive && Math.random() < 0.5) {
        const hot = a.kind === 'explosive';
        game.fx.particle(a.x, 0.3, a.z, -a.vx * 0.2, 0, -a.vz * 0.2, hot ? 0xff4a1a : 0xffa050, hot ? 1.3 : 0.9, hot ? 0.6 : 0.4, 2.2, 1);
      }
    }
    this.updateStorm(dt, game);
    if (this.pod) {
      const p = this.pod;
      p.mesh.rotation.y += dt * 0.4;
      const beacon = p.mesh.userData.beacon as THREE.Mesh;
      const on = Math.sin(game.time * 6) > 0;
      (beacon.material as THREE.MeshBasicMaterial).color.setRGB(on ? 4 : 0.5, on ? 3.2 : 0.4, on ? 1 : 0.1);
      if (Math.random() < 0.1) game.fx.ring(p.x, p.z, 4, 0xffd25a, 0.8);
      if (game.nearestShip(p.x, p.z, 4)) {
        game.fx.explosion(p.x, p.z, 1.2, 0xffd25a, -1);
        this.scene.remove(p.mesh);
        this.pod = null;
        game.rescueSparky();
      }
    }
  }

  /** Ion storm: glowing circles, then lightning from the sky. */
  private updateStorm(dt: number, game: Game): void {
    if (this.stormT > 0) {
      this.stormT -= dt;
      this.strikeT -= dt;
      if (this.strikeT <= 0) {
        this.strikeT = rng.range(0.7, 1.2);
        // half the strikes land near a pilot (dodge!), the rest anywhere in the belt
        const ships = game.ships.filter((s) => s.alive);
        let x: number, z: number;
        if (ships.length && rng.chance(0.5)) {
          const s = rng.pick(ships);
          const a = rng.range(0, TAU), r = rng.range(3, 12);
          x = s.x + Math.cos(a) * r;
          z = s.z + Math.sin(a) * r;
        } else {
          const a = rng.range(0, TAU), r = rng.range(BAL.beltInner, BAL.beltOuter);
          x = Math.cos(a) * r;
          z = Math.sin(a) * r;
        }
        this.strikes.push({ x, z, t: 1.1 });
      }
    }
    for (const st of this.strikes) {
      st.t -= dt;
      if (st.t > 0) {
        // telegraph: a crisp circle that pulses faster as the strike comes, and a shrinking countdown ring
        const pulse = 1.1 + 0.9 * Math.sin((1.1 - st.t) * (10 + (1.1 - st.t) * 30));
        this.circle(game, st.x, st.z, STRIKE_R, 0.14, pulse);
        this.circle(game, st.x, st.z, STRIKE_R * (st.t / 1.1), 0.09, 0.9);
        continue;
      }
      game.fx.segment(st.x, 34, st.z, st.x, 0.2, st.z, 0.45, new THREE.Color(3, 2.6, 5));
      game.fx.zap(st.x + rng.range(-1, 1), st.z + rng.range(-1, 1), st.x, st.z, 0xc4b5fd, 0.25, 0.2, 0.5);
      game.fx.flash(st.x, st.z, 6, 0xc4b5fd, 0.25, 0.5, 1.6);
      game.fx.ring(st.x, st.z, STRIKE_R * 1.3, 0xe9d5ff, 0.35, 1.8);
      game.fx.sparks(st.x, st.z, 0xe9d5ff, 18, 10, 0.5);
      game.audio.play('zap');
      game.stage.shake(0.25);
      for (const t of game.grid.query(st.x, st.z, STRIKE_R, [])) {
        if (t.alive && Math.hypot(t.x - st.x, t.z - st.z) - t.r < STRIKE_R) t.onHit(t.team === 'enemy' ? 260 * (1 + game.sector) : 160 * game.def.rockHp, game, st.x, st.z);
      }
      for (const s of game.ships) if (s.alive && Math.hypot(s.x - st.x, s.z - st.z) < STRIKE_R * 0.8) s.hurt(12, game);
    }
    this.strikes = this.strikes.filter((s) => s.t > 0);
  }

  private col = new THREE.Color();

  /** A thin glowing circle on the plane, drawn this frame only. */
  private circle(game: Game, x: number, z: number, r: number, w: number, k: number): void {
    this.col.setRGB(0.75 * k, 0.55 * k, 1.2 * k);
    const n = 28;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU;
      game.fx.segment(x + Math.cos(a0) * r, 0.15, z + Math.sin(a0) * r, x + Math.cos(a1) * r, 0.15, z + Math.sin(a1) * r, w, this.col);
    }
  }

  /** Where the gold arrow should point. */
  beacon(): { x: number; z: number } | null {
    if (this.pod) return this.pod;
    if (this.comet?.alive) return this.comet;
    return null;
  }
}
