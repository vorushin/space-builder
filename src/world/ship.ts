import * as THREE from 'three';
import { BAL } from '../config/balance';
import { GUNS } from '../config/guns';
import type { Game } from '../game';
import { clamp, turnToward, wrapAngle } from '../logic/math';
import { makeShip, setShipGuns, type ShipRig } from '../render/models';

/** The player's ship: twin-stick flight, guns, dash, missiles. */
export class Ship {
  x = 0;
  z = 12;
  vx = 0;
  vz = 0;
  heading = -Math.PI / 2;
  readonly r = BAL.ship.radius;
  hp: number = BAL.ship.hp;
  maxHp: number = BAL.ship.hp;
  alive = true;
  respawnT = 0;
  gunTier = 1;
  missiles: number = BAL.missiles.start;
  missilesMax: number = BAL.missiles.start;
  private missileRegen = 0;
  private missileCd = 0;
  private fireCd = 0;
  private volleys = 0;
  dashT = 0;
  dashCd = 0;
  iframes = 0;
  lastHit = 99;
  overdrive = 0;
  bubble = 0;
  private bank = 0;
  private flashT = 0;
  readonly rig: ShipRig;
  private laserSfxCd = 0;

  constructor(scene: THREE.Scene) {
    this.rig = makeShip();
    setShipGuns(this.rig, 1, GUNS[0].color);
    scene.add(this.rig.root);
  }

  setGunTier(tier: number): void {
    this.gunTier = tier;
    setShipGuns(this.rig, tier, GUNS[tier - 1].color);
  }

  get gun() {
    return GUNS[this.gunTier - 1];
  }

  /** Damage; returns true if it landed. */
  hurt(dmg: number, game: Game): boolean {
    if (!this.alive || this.iframes > 0 || this.bubble > 0 || this.dashT > 0 || game.god) return false;
    this.hp -= dmg * game.mods.enemyDmg;
    this.iframes = BAL.ship.hitIframes;
    this.lastHit = 0;
    this.flashT = 0.1;
    game.stage.shake(0.35);
    game.fx.screen('rgba(255,40,40,1)', 0.18);
    game.audio.play('hurt');
    if (this.hp <= 0) this.die(game);
    return true;
  }

  private die(game: Game): void {
    this.alive = false;
    this.hp = 0;
    this.respawnT = BAL.ship.respawnTime;
    this.rig.root.visible = false;
    game.fx.explosion(this.x, this.z, 2.2, 0x6fe0ff, 0xc8d2dc);
    game.stage.shake(0.9);
    game.audio.play('bigBoom');
    game.ui.banner('Ship destroyed!', 'Respawning at the station…', 'bad', 2.2);
  }

  respawn(game: Game): void {
    const s = game.station;
    this.alive = true;
    this.hp = this.maxHp;
    this.x = s.x;
    this.z = s.z + s.radius + 3;
    this.vx = this.vz = 0;
    this.iframes = 2;
    this.rig.root.visible = true;
    game.fx.ring(this.x, this.z, 5, 0x6fe0ff, 0.6);
    game.fx.sparks(this.x, this.z, 0x6fe0ff, 30, 10);
  }

  update(dt: number, game: Game): void {
    const input = game.input;
    if (!this.alive) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) this.respawn(game);
      return;
    }
    const sb = BAL.ship;
    this.iframes = Math.max(0, this.iframes - dt);
    this.overdrive = Math.max(0, this.overdrive - dt);
    this.bubble = Math.max(0, this.bubble - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.lastHit += dt;

    // --- movement ---
    const mv = game.controlsLocked ? { x: 0, z: 0 } : input.move();
    const moving = mv.x !== 0 || mv.z !== 0;
    if (this.dashT > 0) {
      this.dashT -= dt;
      game.fx.particle(this.x, 0.2, this.z, 0, 0, 0, 0x8fe8ff, 1.2, 0.3, 1.6, 0);
    } else {
      const k = 1 - Math.exp(-(moving ? sb.accelK : sb.decelK) * dt);
      this.vx += (mv.x * sb.maxSpeed - this.vx) * k;
      this.vz += (mv.z * sb.maxSpeed - this.vz) * k;
    }
    if (!game.controlsLocked && input.pressed('Space', 'ShiftLeft', 'ShiftRight') && this.dashCd <= 0) {
      const dir = moving ? Math.atan2(mv.z, mv.x) : this.heading;
      this.vx = Math.cos(dir) * sb.dashSpeed;
      this.vz = Math.sin(dir) * sb.dashSpeed;
      this.dashT = sb.dashTime;
      this.dashCd = sb.dashCooldown;
      this.iframes = Math.max(this.iframes, sb.dashIframes);
      game.audio.play('dash');
      game.fx.ring(this.x, this.z, 3, 0x8fe8ff, 0.3);
    }
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    const r = Math.hypot(this.x, this.z);
    if (r > BAL.arenaRadius) {
      const push = (r - BAL.arenaRadius) * 6;
      this.vx -= (this.x / r) * push * dt * 10;
      this.vz -= (this.z / r) * push * dt * 10;
      if (r > BAL.arenaRadius + 6) {
        this.x *= (BAL.arenaRadius + 6) / r;
        this.z *= (BAL.arenaRadius + 6) / r;
      }
    }

    // --- aim ---
    const aim = game.aim;
    const want = Math.atan2(aim.z - this.z, aim.x - this.x);
    this.heading = turnToward(this.heading, want, sb.turnRate * dt);

    // --- regen ---
    const dock = game.station.alive && Math.hypot(this.x - game.station.x, this.z - game.station.z) < game.station.dockRadius;
    if (this.hp < this.maxHp) {
      let rate = this.lastHit > sb.regenDelay ? sb.regenRate : 0;
      if (dock) rate += sb.dockRegen;
      this.hp = Math.min(this.maxHp, this.hp + rate * dt);
    }

    // --- guns ---
    this.fireCd -= dt;
    this.laserSfxCd -= dt;
    const firing = !game.controlsLocked && !game.buildMode && (input.fireHeld || game.autoFire);
    if (firing && this.fireCd <= 0) {
      const g = this.gun;
      const rate = g.rate * (this.overdrive > 0 ? 2.2 : 1);
      this.fireVolley(game);
      this.fireCd = Math.max(this.fireCd, -0.05) + 1 / rate;
    }
    if (this.fireCd < -1) this.fireCd = 0;

    // --- missiles ---
    this.missileCd -= dt;
    if (this.missiles < this.missilesMax) {
      this.missileRegen += dt;
      if (this.missileRegen >= BAL.missiles.recharge) {
        this.missileRegen = 0;
        this.missiles++;
      }
    } else this.missileRegen = 0;
    if (!game.controlsLocked && input.pressed('Mouse2', 'KeyQ', 'KeyE') && this.missileCd <= 0) {
      if (this.missiles > 0) {
        this.missiles--;
        this.missileCd = 0.22;
        const mb = BAL.missiles;
        game.missiles.launch(game, {
          x: this.x + Math.cos(this.heading) * 1.2,
          z: this.z + Math.sin(this.heading) * 1.2,
          angle: this.heading,
          team: 'player',
          dmg: (mb.baseDmg + mb.dmgPerTier * this.gunTier) * (1 + game.sector),
          radius: mb.radius,
          aimX: aim.x,
          aimZ: aim.z,
        });
        game.audio.play('missile');
      } else {
        game.audio.play('denied');
      }
    }

    // --- visuals ---
    const speed = Math.hypot(this.vx, this.vz);
    const lateral = -Math.sin(this.heading) * this.vx + Math.cos(this.heading) * this.vz;
    this.bank += (clamp(-lateral * 0.045, -0.7, 0.7) - this.bank) * (1 - Math.exp(-8 * dt));
    const root = this.rig.root;
    root.position.set(this.x, 0, this.z);
    root.rotation.y = -this.heading;
    this.rig.body.rotation.x = this.bank;
    this.rig.body.position.y = Math.sin(game.time * 2.2) * 0.08;
    const thrust = this.dashT > 0 ? 2.6 : 0.45 + (speed / sb.maxSpeed) * 1.1;
    for (const f of this.rig.flames) f.scale.set(thrust * (0.85 + Math.random() * 0.3), 1, 1);
    if (speed > 3 && Math.random() < 0.7) {
      const bx = this.x - Math.cos(this.heading) * 1.5, bz = this.z - Math.sin(this.heading) * 1.5;
      game.fx.particle(bx, 0.05, bz, -this.vx * 0.15, 0, -this.vz * 0.15, 0x59d8ff, 0.5, 0.35, 1.8, 1.5);
    }
    this.rig.bubble.visible = this.bubble > 0 || (this.iframes > 0.4 && Math.floor(game.time * 12) % 2 === 0);
    this.rig.bubble.scale.setScalar(1 + Math.sin(game.time * 8) * 0.04);
    this.flashT = Math.max(0, this.flashT - dt);
    const hm = this.rig.mats[0];
    hm.emissive.setRGB(this.flashT > 0 ? 1 : 0, this.flashT > 0 ? 0.3 : 0, this.flashT > 0 ? 0.3 : 0);
    root.visible = this.alive && !(this.iframes > 0 && this.iframes < 1.9 && this.bubble <= 0 && Math.floor(game.time * 20) % 2 === 0 && this.lastHit > 0.3);
  }

  private fireVolley(game: Game): void {
    const g = this.gun;
    const n = g.bolts;
    const h = this.heading;
    const px = -Math.sin(h), pz = Math.cos(h);
    this.volleys++;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5;
      const ang = wrapAngle(h + t * g.spread);
      const off = g.gap > 0 ? t * g.gap * (n - 1) : 0;
      const nose = 1.3 - Math.abs(t) * 0.8;
      game.bolts.fire({
        x: this.x + Math.cos(h) * nose + px * off,
        z: this.z + Math.sin(h) * nose + pz * off,
        angle: ang,
        speed: g.speed,
        dmg: g.dmg,
        team: 'player',
        color: g.color,
        pierce: g.pierce,
        splash: g.splash,
        size: g.size,
      });
    }
    if (g.singularityEvery && this.volleys % g.singularityEvery === 0) {
      game.bolts.fire({ x: this.x + Math.cos(h) * 1.6, z: this.z + Math.sin(h) * 1.6, angle: h, speed: 24, dmg: g.dmg * 3, team: 'player', color: 0xc77dff, range: 26, kind: 'sing', r: 0.9, size: 2 });
    }
    game.fx.particle(this.x + Math.cos(h) * 1.5, 0.4, this.z + Math.sin(h) * 1.5, this.vx, 0, this.vz, g.color, 1.3, 0.06, 2.2, 0);
    if (this.laserSfxCd <= 0) {
      game.audio.play('laser', this.gunTier);
      this.laserSfxCd = 0.06;
    }
  }
}
