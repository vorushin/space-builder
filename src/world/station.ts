import * as THREE from 'three';
import { BAL } from '../config/balance';
import { MODULE_BY_KIND, type ModuleKind, type ModuleTier } from '../config/modules';
import type { Game } from '../game';
import { socketsFor, type Socket } from '../logic/layout';
import { turnToward } from '../logic/math';
import type { SavedModule } from '../logic/save';
import { leadAim } from '../logic/targeting';
import { makeModule, makeRing, makeSocketPad, makeStationCore, type ModuleRig, type PadRig, type StationRig } from '../render/models';
import { hexTexture } from '../render/textures';
import type { Bolt } from './projectiles';
import type { Hittable } from './types';

export interface ModuleInst {
  kind: ModuleKind;
  tier: number;
  socket: Socket;
  rig: ModuleRig;
  cd: number;
  aim: number;
  build: number;
  x: number;
  z: number;
}

const SHIELD_VS = `
varying vec3 vN; varying vec3 vV; varying vec2 vUv;
void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const SHIELD_FS = `
uniform vec3 uColor; uniform float uHit; uniform float uTime; uniform float uLevel; uniform sampler2D uHex;
varying vec3 vN; varying vec3 vV; varying vec2 vUv;
void main(){
  float f = pow(1.0 - abs(dot(vN, vV)), 2.2);
  float hex = texture2D(uHex, vUv * vec2(5.0, 2.5) + vec2(uTime * 0.01, 0.0)).a;
  float a = (f * 0.55 + hex * 0.10 * (0.5 + f)) * (0.35 + 0.65 * uLevel) + uHit * (0.18 + hex * 0.6);
  gl_FragColor = vec4(uColor * a * 1.6, a);
}`;

/** Your home: core + rings of sockets with modules on them, a shield bubble, the dock and the magnet. */
export class Station {
  readonly x = 0;
  readonly z = 0;
  rings = 1;
  hp: number = BAL.station.coreHp;
  maxHp: number = BAL.station.coreHp;
  shield = 0;
  shieldMax = 0;
  shieldRegen = 0;
  private lastHit = 99;
  alive = true;
  modules = new Map<number, ModuleInst>();
  sockets: Socket[] = socketsFor(1);
  private rig: StationRig;
  private group = new THREE.Group();
  private pads = new Map<number, PadRig>();
  private ringMeshes: THREE.Group[] = [];
  private bubble: THREE.Mesh;
  private bubbleMat: THREE.ShaderMaterial;
  private hitGlow = 0;
  private buildOn = false;
  private time = 0;
  private cands: Hittable[] = [];

  constructor(private scene: THREE.Scene) {
    this.rig = makeStationCore();
    this.group.add(this.rig.root);
    scene.add(this.group);
    this.bubbleMat = new THREE.ShaderMaterial({
      vertexShader: SHIELD_VS,
      fragmentShader: SHIELD_FS,
      uniforms: {
        uColor: { value: new THREE.Color(0x6fb7ff) },
        uHit: { value: 0 },
        uTime: { value: 0 },
        uLevel: { value: 1 },
        uHex: { value: hexTexture() },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2), this.bubbleMat);
    this.bubble.visible = false;
    this.bubble.renderOrder = 5;
    scene.add(this.bubble);
    this.rebuildPads();
  }

  get radius(): number {
    return this.rings === 1 ? 7.2 : this.rings === 2 ? 12 : 17;
  }
  get shieldRadius(): number {
    return this.radius + 2.4;
  }
  get dockRadius(): number {
    return BAL.station.dockRadius[this.rings - 1] + 2;
  }
  get magnetRadius(): number {
    return BAL.station.magnetRadius[this.rings - 1] + 3;
  }
  get occupied(): Set<number> {
    return new Set(this.modules.keys());
  }

  private rebuildPads(): void {
    for (const s of this.sockets) {
      if (this.pads.has(s.id)) continue;
      const pad = makeSocketPad();
      pad.root.position.set(s.x, 0, s.z);
      pad.root.rotation.y = -s.angle;
      this.group.add(pad.root);
      this.pads.set(s.id, pad);
    }
  }

  /** Adds the next ring (Command Center, then Mega Station). */
  expand(): boolean {
    if (this.rings >= 3) return false;
    this.rings++;
    const ring = makeRing((this.rings - 1) as 1 | 2);
    this.group.add(ring);
    this.ringMeshes.push(ring);
    ring.scale.setScalar(0.01);
    ring.userData.grow = 0;
    this.sockets = socketsFor(this.rings);
    this.rebuildPads();
    this.recompute(true);
    return true;
  }

  canPlace(socketId: number): boolean {
    return this.sockets.some((s) => s.id === socketId) && !this.modules.has(socketId);
  }

  place(kind: ModuleKind, socketId: number): ModuleInst | null {
    const socket = this.sockets.find((s) => s.id === socketId);
    if (!socket || this.modules.has(socketId)) return null;
    const m: ModuleInst = { kind, tier: 1, socket, rig: makeModule(kind, 1), cd: 0.5, aim: socket.angle, build: 0, x: socket.x, z: socket.z };
    m.rig.root.position.set(socket.x, 0, socket.z);
    this.group.add(m.rig.root);
    this.modules.set(socketId, m);
    this.recompute(true);
    return m;
  }

  upgrade(socketId: number): ModuleInst | null {
    const m = this.modules.get(socketId);
    if (!m || m.tier >= 3) return null;
    m.tier++;
    this.group.remove(m.rig.root);
    m.rig = makeModule(m.kind, m.tier);
    m.rig.root.position.set(m.x, 0, m.z);
    m.build = 0.3;
    this.group.add(m.rig.root);
    this.recompute(true);
    return m;
  }

  remove(socketId: number): ModuleInst | null {
    const m = this.modules.get(socketId);
    if (!m) return null;
    this.group.remove(m.rig.root);
    this.modules.delete(socketId);
    this.recompute(false);
    return m;
  }

  tierStats(m: ModuleInst): ModuleTier {
    return MODULE_BY_KIND[m.kind].tiers[m.tier - 1];
  }

  /** Max HP and shield from the modules. Building or upgrading heals by the added amount. */
  private recompute(heal: boolean): void {
    const oldMax = this.maxHp;
    let tiers = 0;
    let cap = 0;
    let regen = 0;
    for (const m of this.modules.values()) {
      tiers += m.tier;
      if (m.kind === 'shield') {
        const t = this.tierStats(m);
        cap += t.capacity ?? 0;
        regen += t.regen ?? 0;
      }
    }
    this.maxHp = BAL.station.coreHp + BAL.station.hpPerModule * tiers + (this.rings - 1) * 250;
    if (heal) this.hp = Math.min(this.maxHp, this.hp + Math.max(0, this.maxHp - oldMax));
    this.hp = Math.min(this.hp, this.maxHp);
    const hadShield = this.shieldMax;
    this.shieldMax = cap;
    this.shieldRegen = regen;
    if (cap > hadShield) this.shield = Math.min(cap, this.shield + (cap - hadShield));
    this.shield = Math.min(this.shield, cap);
  }

  repairFull(): void {
    this.hp = this.maxHp;
    this.shield = this.shieldMax;
  }

  setBuildMode(on: boolean): void {
    this.buildOn = on;
  }

  /** Enemy bolt vs shield / hull. True if absorbed. */
  absorbBolt(b: Bolt, game: Game): boolean {
    if (!this.alive) return false;
    const d2 = (b.x - this.x) ** 2 + (b.z - this.z) ** 2;
    if (this.shield > 0 && d2 < this.shieldRadius ** 2) {
      this.hurt(b.dmg, game, b.x, b.z);
      return true;
    }
    if (d2 < this.radius ** 2) {
      // only solid parts: core, ring tubes, modules
      const d = Math.sqrt(d2);
      const onRing = [5.5, 10.5, 15.5].slice(0, this.rings).some((rr) => Math.abs(d - rr) < 1.6);
      if (d < 3.4 || onRing) {
        this.hurt(b.dmg, game, b.x, b.z);
        return true;
      }
    }
    return false;
  }

  hurt(dmg: number, game: Game, x: number, z: number): void {
    if (!this.alive || game.god) return;
    dmg *= game.mods.enemyDmg;
    this.lastHit = 0;
    if (this.shield > 0) {
      this.shield -= dmg;
      this.hitGlow = Math.min(1, this.hitGlow + 0.5);
      game.fx.sparks(x, z, 0x8fc8ff, 5, 6, 0.45, 0.8);
      if (this.shield <= 0) {
        this.shield = 0;
        game.audio.play('shieldDown');
        game.ui.toast('Shield down!', 'bad');
      } else game.audio.play('shieldHit');
      return;
    }
    this.hp -= dmg;
    game.fx.sparks(x, z, 0xffb070, 6, 7, 0.5, 0.6);
    game.audio.play('stationHit');
    game.ui.stationHurt();
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      game.stationDestroyed();
    }
  }

  update(dt: number, game: Game): void {
    this.time += dt;
    this.lastHit += dt;
    this.rig.spinner.rotation.y += dt * 0.35;
    const blink = Math.sin(this.time * 4) > 0.6;
    (this.rig.beacon.material as THREE.MeshBasicMaterial).color.setRGB(blink ? 4 : 0.6, blink ? 0.4 : 0.05, blink ? 0.4 : 0.05);
    for (const r of this.ringMeshes) {
      if (r.userData.grow < 1) {
        r.userData.grow = Math.min(1, r.userData.grow + dt * 1.2);
        const g = r.userData.grow;
        r.scale.setScalar(0.6 + 0.4 * (1 - (1 - g) ** 3));
        if (Math.random() < 0.5) {
          const a = Math.random() * Math.PI * 2;
          const rr = this.rings === 2 ? 10.5 : 15.5;
          game.fx.sparks(Math.cos(a) * rr, Math.sin(a) * rr, 0xffe08a, 2, 5, 0.4, 0.5);
        }
      }
    }
    // shield
    if (this.shieldMax > 0 && this.lastHit > BAL.station.shieldRegenDelay) this.shield = Math.min(this.shieldMax, this.shield + this.shieldRegen * dt);
    this.hitGlow = Math.max(0, this.hitGlow - dt * 2.5);
    this.bubble.visible = this.alive && this.shield > 0.5;
    this.bubble.scale.setScalar(this.shieldRadius);
    this.bubble.scale.y = this.shieldRadius * 0.45;
    this.bubbleMat.uniforms.uHit.value = this.hitGlow;
    this.bubbleMat.uniforms.uTime.value = this.time;
    this.bubbleMat.uniforms.uLevel.value = this.shieldMax > 0 ? this.shield / this.shieldMax : 0;
    // pads glow in build mode
    for (const [id, pad] of this.pads) {
      pad.rim.visible = this.buildOn && !this.modules.has(id);
      if (pad.rim.visible) {
        const k = 1.4 + Math.sin(this.time * 6 + id) * 0.8;
        (pad.rim.material as THREE.MeshBasicMaterial).color.setRGB(0.43 * k, 1 * k, 0.85 * k);
      }
    }
    // modules
    for (const m of this.modules.values()) {
      if (m.build < 1) {
        m.build = Math.min(1, m.build + dt * 1.8);
        const b = m.build;
        m.rig.root.scale.setScalar(0.2 + 0.8 * (1 - (1 - b) ** 3));
        if (Math.random() < 0.6) game.fx.sparks(m.x, m.z, 0xffe08a, 2, 6, 0.4, 1);
      }
      if (!this.alive) continue;
      this.runModule(m, dt, game);
    }
  }

  private runModule(m: ModuleInst, dt: number, game: Game): void {
    const t = this.tierStats(m);
    m.cd -= dt;
    switch (m.kind) {
      case 'turret': {
        const range = t.range ?? 26;
        let target: Hittable | null = game.nearestTarget(m.x, m.z, range);
        let rock = false;
        if (!target && game.isCalm) {
          target = game.nearestRock(m.x, m.z, range * 0.8);
          rock = true;
        }
        if (target && m.rig.head) {
          const p = leadAim(m, target, t.boltSpeed ?? 60);
          const want = Math.atan2(p.z - m.z, p.x - m.x);
          m.aim = turnToward(m.aim, want, 7 * dt);
          m.rig.head.rotation.y = -m.aim;
          if (m.cd <= 0 && Math.abs(want - m.aim) < 0.2) {
            m.cd = (1 / (t.rate ?? 2)) * (rock ? 2 : 1);
            const n = t.bolts ?? 1;
            for (let i = 0; i < n; i++) {
              const off = n === 1 ? 0 : (i - (n - 1) / 2) * 0.32;
              const px = -Math.sin(m.aim) * off, pz = Math.cos(m.aim) * off;
              game.bolts.fire({
                x: m.x + Math.cos(m.aim) * 1.2 + px,
                z: m.z + Math.sin(m.aim) * 1.2 + pz,
                angle: m.aim,
                speed: t.boltSpeed ?? 60,
                dmg: (t.dmg ?? 10) * (1 + game.sector * 0.4),
                team: 'player',
                color: m.tier === 3 ? 0x8ff6ff : 0x59f3ff,
                range: range + 6,
                pierce: t.pierce ?? 0,
                kind: m.tier === 3 ? 'rail' : 'laser',
                size: m.tier === 3 ? 1.4 : 1,
              });
            }
            game.audio.play(m.tier === 3 ? 'rail' : 'turret');
          }
        }
        break;
      }
      case 'missile': {
        if (m.cd > 0) break;
        const range = t.range ?? 44;
        const target = game.toughestTarget(m.x, m.z, range);
        if (!target) break;
        m.cd = 1 / (t.rate ?? 0.5);
        const want = Math.atan2(target.z - m.z, target.x - m.x);
        m.aim = want;
        if (m.rig.head) m.rig.head.rotation.y = -want;
        for (let i = 0; i < (t.bolts ?? 1); i++) {
          game.missiles.launch(game, {
            x: m.x + Math.cos(want) * 0.8,
            z: m.z + Math.sin(want) * 0.8,
            angle: want + (i - 0.5) * 0.7,
            team: 'player',
            dmg: (t.dmg ?? 60) * (1 + game.sector * 0.4),
            radius: t.splash ?? 4.5,
            target,
            color: 0xff8a3d,
          });
        }
        game.audio.play('missile');
        break;
      }
      case 'tesla': {
        if (m.cd > 0) break;
        const range = t.range ?? 16;
        let cur = game.nearestTarget(m.x, m.z, range);
        if (!cur) break;
        m.cd = 1 / (t.rate ?? 1.4);
        const hit = new Set<Hittable>();
        let fx = m.x, fz = m.z, fy = 2.4;
        const dmg = (t.dmg ?? 50) * (1 + game.sector * 0.35);
        for (let i = 0; i < (t.chains ?? 3) && cur; i++) {
          game.fx.zap(fx, fz, cur.x, cur.z, 0xb49dff, 0.18, 0.14, fy);
          game.fx.sparks(cur.x, cur.z, 0xc8b8ff, 6, 6, 0.5);
          hit.add(cur);
          cur.onHit(dmg, game, fx, fz);
          fx = cur.x;
          fz = cur.z;
          fy = 0.8;
          let next: Hittable | null = null;
          let bd = 11 * 11;
          for (const o of game.grid.query(fx, fz, 11, this.cands)) {
            if (o.team !== 'enemy' || !o.alive || hit.has(o)) continue;
            const d = (o.x - fx) ** 2 + (o.z - fz) ** 2;
            if (d < bd) {
              bd = d;
              next = o;
            }
          }
          cur = next;
        }
        game.audio.play('zap');
        break;
      }
      case 'mining':
        game.drones.ensureMiners(m, t.count ?? 1, game);
        if (m.rig.fx) m.rig.fx.rotation.y += dt * 2;
        break;
      case 'dock':
        game.drones.ensureWingmen(m, t.count ?? 1, game);
        break;
      case 'shield':
        if (m.rig.fx) m.rig.fx.scale.setScalar(1 + Math.sin(this.time * 3 + m.socket.id) * 0.12);
        break;
    }
    if (m.kind === 'tesla' && m.rig.fx) m.rig.fx.scale.setScalar(1 + Math.max(0, m.cd) * 0.3 + Math.sin(this.time * 9) * 0.05);
  }

  serialize(): SavedModule[] {
    return [...this.modules.values()].map((m) => ({ socket: m.socket.id, kind: m.kind, tier: m.tier }));
  }

  /** Rebuild from a checkpoint. */
  load(rings: number, modules: SavedModule[]): void {
    for (const id of [...this.modules.keys()]) this.remove(id);
    for (const r of this.ringMeshes) this.group.remove(r);
    this.ringMeshes = [];
    for (const p of this.pads.values()) this.group.remove(p.root);
    this.pads.clear();
    this.rings = 1;
    this.sockets = socketsFor(1);
    this.rebuildPads();
    this.recompute(false);
    while (this.rings < rings) this.expand();
    for (const r of this.ringMeshes) {
      r.userData.grow = 1;
      r.scale.setScalar(1);
    }
    for (const sm of modules) {
      const m = this.place(sm.kind, sm.socket);
      if (!m) continue;
      while (m.tier < sm.tier) this.upgrade(sm.socket);
      const mm = this.modules.get(sm.socket);
      if (mm) {
        mm.build = 1;
        mm.rig.root.scale.setScalar(1);
      }
    }
    this.alive = true;
    this.setVisible(true);
    this.recompute(false);
    this.repairFull();
  }

  /** World position of a socket (for UI popups). */
  socketAt(x: number, z: number, maxDist = 2.2): Socket | null {
    let best: Socket | null = null;
    let bd = maxDist * maxDist;
    for (const s of this.sockets) {
      const d = (s.x - x) ** 2 + (s.z - z) ** 2;
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  setVisible(v: boolean): void {
    this.group.visible = v;
    if (!v) this.bubble.visible = false;
  }

  get root(): THREE.Group {
    return this.group;
  }

  dispose(): void {
    this.scene.remove(this.group, this.bubble);
  }
}
