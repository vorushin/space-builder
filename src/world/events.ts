import * as THREE from 'three';
import { BAL } from '../config/balance';
import type { Game } from '../game';
import { Rng, TAU } from '../logic/math';
import { makeComet, makePod } from '../render/models';
import type { Hittable } from './types';

export type EventKind = 'comet' | 'meteors' | 'supply' | 'giant' | 'sos';

export const EVENT_TEXT: Record<EventKind, [string, string]> = {
  comet: ['GOLDEN COMET!', 'Shoot it before it escapes: it is full of crystals!'],
  meteors: ['METEOR SHOWER!', 'Dodge the fast rocks, or blast them for crystals'],
  supply: ['SUPPLY DROP!', 'A crate warped in. Grab it for a power-up!'],
  giant: ['CRYSTAL GIANT!', 'A huge crystal asteroid appeared'],
  sos: ['SOS SIGNAL!', 'Someone is stranded out there. Follow the gold arrow!'],
};

const rng = new Rng(5150);

class Comet implements Hittable {
  x: number;
  z: number;
  vx: number;
  vz: number;
  r = 1.5;
  hp: number;
  alive = true;
  readonly team = 'neutral' as const;
  mesh = makeComet();
  constructor(x: number, z: number, vx: number, vz: number, hp: number) {
    this.x = x;
    this.z = z;
    this.vx = vx;
    this.vz = vz;
    this.hp = hp;
  }
  onHit(dmg: number, game: Game): void {
    if (!this.alive) return;
    this.hp -= dmg;
    game.fx.sparks(this.x, this.z, 0xffe08a, 3, 6, 0.5);
    if (this.hp <= 0) {
      this.alive = false;
      game.fx.explosion(this.x, this.z, 2.4, 0xffd25a, 0xffd25a);
      game.crystals.spawn(this.x, this.z, 45, 2, game);
      game.ui.toast('Golden comet smashed! Crystals everywhere!', 'gold');
      game.audio.play('jackpot');
      game.stats.comets++;
      game.medal('comet');
    }
  }
}

/** Random calm-phase surprises (and Sparky's rescue). */
export class Events {
  comet: Comet | null = null;
  pod: { x: number; z: number; mesh: THREE.Group } | null = null;
  private meteorsLeft = 0;
  private meteorT = 0;
  private meteorDir = 0;
  last: EventKind | null = null;

  constructor(private scene: THREE.Scene) {}

  clear(): void {
    if (this.comet) this.scene.remove(this.comet.mesh);
    if (this.pod) this.scene.remove(this.pod.mesh);
    this.comet = null;
    this.pod = null;
    this.meteorsLeft = 0;
  }

  /** Hittables this system owns (for the collision grid). */
  hittables(out: Hittable[]): void {
    if (this.comet?.alive) out.push(this.comet);
  }

  pickRandom(): EventKind {
    const pool: EventKind[] = ['comet', 'meteors', 'supply', 'giant'].filter((k) => k !== this.last) as EventKind[];
    return rng.pick(pool);
  }

  start(kind: EventKind, game: Game): void {
    this.last = kind;
    const [title, sub] = EVENT_TEXT[kind];
    game.ui.banner(title, sub, 'gold', 2.6);
    game.audio.play('event');
    const a = rng.range(0, TAU);
    switch (kind) {
      case 'comet': {
        // fly a chord across the arena, passing near the middle
        const sx = Math.cos(a) * (BAL.arenaRadius + 8), sz = Math.sin(a) * (BAL.arenaRadius + 8);
        const ta = a + Math.PI + rng.range(-0.5, 0.5);
        const tx = Math.cos(ta) * 30, tz = Math.sin(ta) * 30;
        const d = Math.hypot(tx - sx, tz - sz);
        const sp = 12;
        if (this.comet) this.scene.remove(this.comet.mesh);
        this.comet = new Comet(sx, sz, ((tx - sx) / d) * sp, ((tz - sz) / d) * sp, 140 * game.def.rockHp);
        this.scene.add(this.comet.mesh);
        break;
      }
      case 'meteors':
        this.meteorsLeft = 22;
        this.meteorT = 1;
        this.meteorDir = a;
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
        c.x += c.vx * dt;
        c.z += c.vz * dt;
        c.mesh.position.set(c.x, 0.6, c.z);
        c.mesh.rotation.x += dt * 1.3;
        c.mesh.rotation.z += dt * 0.9;
        for (let i = 0; i < 3; i++) {
          game.fx.particle(c.x - c.vx * 0.05 + rng.range(-0.6, 0.6), 0.6, c.z - c.vz * 0.05 + rng.range(-0.6, 0.6), -c.vx * 0.4, rng.range(-0.5, 0.5), -c.vz * 0.4, i ? 0xffd25a : 0xffffff, rng.range(0.6, 1.4), 0.9, 2.4, 0.8);
        }
        if (c.x * c.x + c.z * c.z > (BAL.arenaRadius + 14) ** 2 && (c.x * c.vx + c.z * c.vz) > 0) {
          c.alive = false;
          game.ui.toast('The comet got away…', 'info');
        }
      }
      if (!c.alive) {
        this.scene.remove(c.mesh);
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
        const m = game.asteroids.spawn('S', rng.chance(0.3) ? 'rich' : 'rock', sx, sz, Math.cos(ang) * sp, Math.sin(ang) * sp);
        m.meteor = true;
      }
    }
    for (const a of game.asteroids.list) {
      if (a.meteor && a.alive && Math.random() < 0.5) {
        game.fx.particle(a.x, 0.3, a.z, -a.vx * 0.2, 0, -a.vz * 0.2, 0xffa050, 0.9, 0.4, 2, 1);
      }
    }
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

  /** Where the gold arrow should point. */
  beacon(): { x: number; z: number } | null {
    if (this.pod) return this.pod;
    if (this.comet?.alive) return this.comet;
    return null;
  }
}
