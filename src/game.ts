import * as THREE from 'three';
import { BAL, SECTOR_VALUE } from './config/balance';
import { GUNS, MAX_GUN_TIER } from './config/guns';
import { EXPANSIONS, MODULE_BY_KIND, MODULES, type ModuleKind } from './config/modules';
import { ENEMY_BY_ID, LAST_SECTOR, SECTORS, type EnemyDef, type SectorDef, type SectorLook } from './config/sectors';
import type { Audio } from './audio/sfx';
import type { Input } from './input';
import { Director, type DirectorEvent } from './logic/director';
import { difficultyMods, expansionCost, gunUpgradeCost, moduleCost, sellValue, type Difficulty } from './logic/economy';
import { SpatialGrid } from './logic/grid';
import { moduleUnlocked, ringUnlocked } from './logic/layout';
import { Rng, type V2 } from './logic/math';
import { decodeCheckpoint, encodeCheckpoint, SAVE_KEY, type Checkpoint } from './logic/save';
import { buildEndlessWave, buildWave, type SpawnOrder } from './logic/waves';
import type { Background } from './render/background';
import { Fx } from './render/fx';
import type { PickupKind } from './render/models';
import type { Stage } from './render/stage';
import type { UI } from './ui/ui';
import { AsteroidField } from './world/asteroids';
import { Boss } from './world/bosses';
import { Crystals, type Magnet } from './world/crystals';
import { Drones } from './world/drones';
import { Enemy, formation } from './world/enemies';
import { Events, type EventKind } from './world/events';
import { Missiles } from './world/missiles';
import { Pickups, POWERUP_NAMES } from './world/pickups';
import { Bolts } from './world/projectiles';
import { Ship } from './world/ship';
import { Station } from './world/station';
import type { Hittable } from './world/types';

export type Mode = 'title' | 'play' | 'hyperspace' | 'over' | 'victory';

interface Timer {
  t: number;
  fn: () => void;
}

interface Vortex {
  x: number;
  z: number;
  t: number;
  magnet: Magnet;
}

export interface Stats {
  kills: number;
  rocks: number;
  comets: number;
  crystals: number;
  modules: number;
  bosses: number;
  time: number;
}

const freshStats = (): Stats => ({ kills: 0, rocks: 0, comets: 0, crystals: 0, modules: 0, bosses: 0, time: 0 });

export class Game {
  readonly fx: Fx;
  readonly ship: Ship;
  readonly station: Station;
  readonly asteroids: AsteroidField;
  readonly crystals: Crystals;
  readonly bolts: Bolts;
  readonly missiles: Missiles;
  readonly drones: Drones;
  readonly pickups: Pickups;
  readonly events: Events;
  enemies: Enemy[] = [];
  boss: Boss | null = null;
  readonly grid = new SpatialGrid<Hittable>(8);
  /** reusable query buffer for entity code */
  readonly scratch: Hittable[] = [];

  mode: Mode = 'title';
  paused = false;
  sector = 0;
  def: SectorDef = SECTORS[0];
  look: SectorLook = SECTORS[0].look;
  difficulty: Difficulty = 'normal';
  mods = difficultyMods('normal');
  bank = 0;
  director: Director | null = null;
  time = 0;
  stats: Stats = freshStats();
  sparky = false;
  endless = false;
  endlessLevel = 0;
  aim: V2 = { x: 0, z: -10 };
  buildMode = false;
  placing: ModuleKind | null = null;
  god = false;
  readonly dev: boolean;
  autoFire = false;
  controlsLocked = false;
  ceaseFire = false;
  private hitStopT = 0;
  private slowMoT = 0;
  private timers: Timer[] = [];
  private vortexes: Vortex[] = [];
  private rng = new Rng(Date.now() & 0xffff);
  private hyperT = -1;
  private gainAccum = 0;
  private gainT = 0;
  private gainX = 0;
  private gainZ = 0;
  private magnetsBuf: Magnet[] = [];
  private shipMagnet: Magnet;
  private stationMagnet: Magnet;
  private calmEventDone = false;
  private calmT = 0;
  private titleT = 0;
  checkpoint: Checkpoint | null = null;
  /** seconds left on the current calm (HUD) */
  get calmLeft(): number {
    return this.director && this.director.phase === 'calm' ? Math.max(0, this.director.timer) : 0;
  }

  constructor(
    readonly stage: Stage,
    readonly bg: Background,
    readonly ui: UI,
    readonly audio: Audio,
    readonly input: Input,
    uiRoot: HTMLElement,
  ) {
    const scene = stage.scene;
    this.dev = new URLSearchParams(location.search).has('dev');
    this.fx = new Fx(scene, stage, uiRoot);
    this.station = new Station(scene);
    this.ship = new Ship(scene);
    this.asteroids = new AsteroidField(scene);
    this.crystals = new Crystals(scene);
    this.bolts = new Bolts(scene);
    this.missiles = new Missiles(scene);
    this.drones = new Drones(scene);
    this.pickups = new Pickups(scene);
    this.events = new Events(scene);
    this.shipMagnet = { x: 0, z: 0, r: BAL.ship.magnetRadius, k: 1, onCollect: (v, x, z) => this.addCrystals(v, x, z) };
    this.stationMagnet = { x: 0, z: 0, r: 10, k: 1, onCollect: (v, x, z) => this.addCrystals(v, x, z) };
    this.checkpoint = this.loadCheckpoint();
    this.applySector(0);
    this.asteroids.setSector(this.def, 0);
    this.ship.rig.root.visible = false;
  }

  // ================================================================ lifecycle

  private applySector(index: number): void {
    this.sector = index;
    this.def = SECTORS[index];
    this.look = this.def.look;
    this.stage.setLook(this.look);
    this.bg.setLook(this.look, index);
  }

  private resetWorld(): void {
    for (const e of this.enemies) e.dispose();
    this.enemies = [];
    this.boss?.dispose();
    this.boss = null;
    this.bolts.clear();
    this.missiles.clear();
    this.crystals.clear();
    this.pickups.clear();
    this.events.clear();
    this.fx.clear();
    this.vortexes = [];
    this.timers = [];
    this.ceaseFire = false;
    this.hitStopT = 0;
    this.slowMoT = 0;
    this.buildMode = false;
    this.placing = null;
    this.station.setBuildMode(false);
  }

  newGame(difficulty: Difficulty): void {
    this.difficulty = difficulty;
    this.mods = difficultyMods(difficulty);
    this.stats = freshStats();
    this.endless = false;
    this.endlessLevel = 0;
    const cp: Checkpoint = { v: 1, sector: 0, crystals: 0, gunTier: 1, rings: 1, modules: [], sparky: false, difficulty, endless: false, endlessLevel: 0 };
    this.startFromCheckpoint(cp, true);
    this.ui.sectorCard(this);
  }

  /** Continue / retry: rebuild everything from a checkpoint and start that sector. */
  startFromCheckpoint(cp: Checkpoint, fresh = false): void {
    this.resetWorld();
    this.difficulty = cp.difficulty;
    this.mods = difficultyMods(cp.difficulty);
    this.applySector(cp.sector);
    this.bank = cp.crystals;
    this.endless = cp.endless;
    this.endlessLevel = cp.endlessLevel;
    this.station.load(cp.rings, cp.modules);
    this.drones.clear();
    this.sparky = cp.sparky;
    if (this.sparky) this.drones.addSparky(this);
    this.ship.setGunTier(cp.gunTier);
    this.ship.missilesMax = BAL.missiles.start + cp.sector * BAL.missiles.perSector;
    this.ship.missiles = this.ship.missilesMax;
    this.ship.respawn(this);
    this.ship.iframes = 0;
    this.asteroids.setSector(this.def, cp.sector);
    this.makeDirector(fresh);
    this.mode = 'play';
    this.paused = false;
    this.controlsLocked = false;
    this.stage.follow(this.ship.x, this.ship.z, 0, true);
    this.saveCheckpoint();
    this.ui.enterPlay(this);
    this.audio.music(this.endless ? 'battle' : 'calm');
  }

  retrySector(): void {
    const cp = this.checkpoint ?? this.loadCheckpoint();
    if (cp) this.startFromCheckpoint(cp);
    else this.newGame(this.difficulty);
    this.ui.sectorCard(this);
  }

  private makeDirector(fresh: boolean): void {
    const p = BAL.phases;
    if (this.endless) {
      const d = new Director(Number.POSITIVE_INFINITY, { firstCalm: 20, calm: p.endlessCalm, warning: p.warning, bossWarning: p.bossWarning, cleared: p.cleared }, (w) => buildEndlessWave(this.endlessLevel + w + 1, this.rng, this.difficulty));
      this.director = d;
    } else {
      const sec = this.def;
      this.director = new Director(sec.waves.length, { firstCalm: fresh ? p.firstCalm : p.calm + 6, calm: p.calm, warning: p.warning, bossWarning: p.bossWarning, cleared: p.cleared }, (w) => buildWave(sec, w, this.rng, this.difficulty));
    }
    this.handleDirector(this.director.start());
  }

  saveCheckpoint(): void {
    const cp: Checkpoint = {
      v: 1,
      sector: this.sector,
      crystals: Math.floor(this.bank),
      gunTier: this.ship.gunTier,
      rings: this.station.rings,
      modules: this.station.serialize(),
      sparky: this.sparky,
      difficulty: this.difficulty,
      endless: this.endless,
      endlessLevel: this.endlessLevel,
    };
    this.checkpoint = cp;
    try {
      localStorage.setItem(SAVE_KEY, encodeCheckpoint(cp));
    } catch {
      /* private mode etc. */
    }
  }

  loadCheckpoint(): Checkpoint | null {
    try {
      return decodeCheckpoint(localStorage.getItem(SAVE_KEY));
    } catch {
      return null;
    }
  }

  toTitle(): void {
    this.resetWorld();
    this.mode = 'title';
    this.paused = false;
    this.checkpoint = this.loadCheckpoint();
    this.ship.rig.root.visible = false;
    this.drones.clear();
    this.station.load(this.checkpoint?.rings ?? 2, this.checkpoint?.modules ?? [
      { socket: 0, kind: 'turret', tier: 2 },
      { socket: 1, kind: 'mining', tier: 1 },
      { socket: 2, kind: 'turret', tier: 1 },
      { socket: 3, kind: 'shield', tier: 1 },
      { socket: 5, kind: 'missile', tier: 1 },
      { socket: 8, kind: 'tesla', tier: 2 },
    ]);
    this.applySector(this.checkpoint?.sector ?? 0);
    this.asteroids.setSector(this.def, this.sector);
    this.ui.showTitle(this);
    this.audio.music('title');
  }

  // ================================================================ queries

  *targets(): Iterable<Hittable> {
    for (const e of this.enemies) if (e.alive) yield e;
    if (this.boss?.alive) {
      if (!this.boss.immune) yield this.boss;
      for (const p of this.boss.pods) if (p.alive) yield p;
      for (const d of this.boss.decoys) if (d.alive) yield d;
    }
  }

  nearestTarget(x: number, z: number, range: number): Hittable | null {
    let best: Hittable | null = null;
    let bd = range * range;
    for (const t of this.targets()) {
      const d = (t.x - x) ** 2 + (t.z - z) ** 2 - t.r * t.r;
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  }

  toughestTarget(x: number, z: number, range: number): Hittable | null {
    let best: Hittable | null = null;
    let score = -1;
    for (const t of this.targets()) {
      const d2 = (t.x - x) ** 2 + (t.z - z) ** 2;
      if (d2 > range * range) continue;
      const s = t.r * 10 - Math.sqrt(d2) * 0.1;
      if (s > score) {
        score = s;
        best = t;
      }
    }
    return best;
  }

  nearestRock(x: number, z: number, range: number): Hittable | null {
    let best: Hittable | null = null;
    let bd = range * range;
    for (const a of this.asteroids.list) {
      if (!a.alive || a.grow < 1) continue;
      const d = (a.x - x) ** 2 + (a.z - z) ** 2;
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    return best;
  }

  get isCalm(): boolean {
    const p = this.director?.phase;
    return this.mode !== 'play' || p === 'calm' || p === 'cleared' || p === 'sectorClear';
  }

  get enemiesAlive(): number {
    let n = 0;
    for (const e of this.enemies) if (e.alive) n++;
    if (this.boss?.alive) n++;
    return n;
  }

  // ================================================================ spawning & effects

  spawnEnemy(def: EnemyDef, x: number, z: number, heading: number, hpScale: number): Enemy {
    const e = new Enemy(def, x, z, heading, hpScale * this.mods.enemyHp, this.stage.scene);
    e.vx = Math.cos(heading) * def.speed;
    e.vz = Math.sin(heading) * def.speed;
    this.enemies.push(e);
    return e;
  }

  private spawnOrder(o: SpawnOrder): void {
    if (o.boss) {
      const def = SECTORS.find((s) => s.boss.id === o.enemy)?.boss ?? this.def.boss;
      const x = Math.cos(o.dir) * BAL.spawnRadius, z = Math.sin(o.dir) * BAL.spawnRadius;
      this.boss?.dispose();
      this.boss = new Boss(def, x, z, (o.hpScale ?? 1) * this.mods.enemyHp, this.stage.scene);
      this.ui.bossIntro(def);
      this.audio.play('bossRoar');
      this.audio.music('boss');
      return;
    }
    const def = ENEMY_BY_ID[o.enemy];
    if (!def) return;
    for (const p of formation(o)) this.spawnEnemy(def, p.x, p.z, p.heading, o.hpScale ?? 1);
  }

  /** Area damage. Neutral explosions (red rocks) also hurt the ship a little. */
  explode(x: number, z: number, radius: number, dmg: number, team: 'player' | 'neutral', color: number): void {
    this.fx.explosion(x, z, radius * 0.35, color, -1);
    this.fx.ring(x, z, radius, color, 0.45, 2.4);
    this.stage.shake(Math.min(0.9, radius * 0.07));
    this.audio.play('boom');
    for (const t of this.grid.query(x, z, radius, [])) {
      if (!t.alive) continue;
      const d = Math.hypot(t.x - x, t.z - z) - t.r;
      if (d < radius) t.onHit(dmg * (d < radius * 0.5 ? 1 : 0.6), this, x, z);
    }
    if (team === 'neutral' && this.ship.alive && Math.hypot(this.ship.x - x, this.ship.z - z) < radius) this.ship.hurt(12, this);
  }

  splash(x: number, z: number, radius: number, dmg: number, exclude: Hittable, color: number): void {
    this.fx.ring(x, z, radius, color, 0.25, 1.8);
    for (const t of this.grid.query(x, z, radius, [])) {
      if (t === exclude || !t.alive) continue;
      if (Math.hypot(t.x - x, t.z - z) - t.r < radius) t.onHit(dmg, this, x, z);
    }
  }

  /** Singularity Weapon black hole. */
  vortex(x: number, z: number): void {
    const magnet: Magnet = { x, z, r: 9, k: 2, onCollect: (v, cx, cz) => this.addCrystals(v, cx, cz) };
    this.vortexes.push({ x, z, t: 1.6, magnet });
    this.fx.ring(x, z, 9, 0xc77dff, 0.5, 2.6, 9);
    this.audio.play('vortex');
  }

  private updateVortexes(dt: number): void {
    for (const v of this.vortexes) {
      v.t -= dt;
      const dps = 40 * this.ship.gunTier;
      for (const t of this.grid.query(v.x, v.z, 9, this.scratch)) {
        if (!t.alive) continue;
        const dx = v.x - t.x, dz = v.z - t.z;
        const d = Math.hypot(dx, dz) || 1;
        if (t.team === 'enemy' && !(t instanceof Boss)) {
          t.vx += (dx / d) * 40 * dt;
          t.vz += (dz / d) * 40 * dt;
          if (t instanceof Enemy) {
            t.x += (dx / d) * 6 * dt;
            t.z += (dz / d) * 6 * dt;
          }
        }
        if (d < 4.5 + t.r) t.onHit(dps * dt, this, v.x, v.z);
      }
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 3 + Math.random() * 6;
        this.fx.particle(v.x + Math.cos(a) * r, 0.5, v.z + Math.sin(a) * r, -Math.sin(a) * 18 - Math.cos(a) * r * 2, 0, Math.cos(a) * 18 - Math.sin(a) * r * 2, 0xc77dff, 0.7, 0.4, 2.4, 0);
      }
      this.fx.flash(v.x, v.z, 3, 0x6a2aff, 0.05, 0.5, 1.5);
    }
    this.vortexes = this.vortexes.filter((v) => v.t > 0);
  }

  /** Count crystals into the bank (units × sector value × difficulty). */
  addCrystals(units: number, x: number, z: number): void {
    const v = units * SECTOR_VALUE[Math.min(this.sector, SECTOR_VALUE.length - 1)] * this.mods.crystals;
    this.bank += v;
    this.stats.crystals += v;
    this.gainAccum += v;
    this.gainX = x;
    this.gainZ = z;
    this.audio.play('pickup');
    this.ui.bankPulse();
  }

  spend(cost: number): boolean {
    if (this.god) return true;
    if (this.bank + 1e-6 < cost) {
      this.audio.play('denied');
      this.ui.toast(`Need ${Math.ceil(cost - this.bank)} more crystals`, 'bad');
      return false;
    }
    this.bank -= cost;
    return true;
  }

  hitStop(t: number): void {
    this.hitStopT = Math.max(this.hitStopT, t);
  }

  applyPowerup(kind: PickupKind, x: number, z: number): void {
    this.fx.text(x, z, POWERUP_NAMES[kind], 'fx-power');
    this.audio.play('powerup');
    this.stats.crystals += 0;
    if (kind === 'overdrive') this.ship.overdrive = 10;
    if (kind === 'bubble') this.ship.bubble = 8;
    if (kind === 'magnet') {
      this.crystals.vacuum();
      this.ui.toast('All crystals fly home!', 'gold');
    }
    if (kind === 'nuke') {
      this.fx.screen('rgba(255,240,200,1)', 0.6);
      this.explode(this.ship.x, this.ship.z, 24, 500 * (1 + this.sector), 'player', 0xffe04a);
      this.stage.shake(1.1);
      this.audio.play('bigBoom');
    }
  }

  rescueSparky(): void {
    this.sparky = true;
    this.drones.addSparky(this);
    this.ui.banner('SPARKY JOINED YOU!', 'A little robot friend: it zaps enemies and grabs crystals', 'gold', 3.2);
    this.audio.play('jackpot');
    this.stats.crystals += 0;
  }

  bossDefeated(boss: Boss): void {
    this.ceaseFire = true;
    this.slowMoT = 1.8;
    this.stats.bosses++;
    this.bolts.clearEnemy(this);
    this.ui.bossBar(null);
    this.ui.banner(`${boss.def.name.toUpperCase()} DEFEATED!`, 'You did it!', 'gold', 3);
    this.audio.play('bossDie');
    this.fx.screen('rgba(255,255,255,1)', 0.7);
    this.stage.shake(1.2);
    for (let i = 0; i < 9; i++) {
      this.later(i * 0.16, () => {
        const a = Math.random() * Math.PI * 2, r = Math.random() * boss.r * 1.2;
        this.fx.explosion(boss.x + Math.cos(a) * r, boss.z + Math.sin(a) * r, 2 + Math.random() * 2, i % 2 ? boss.def.glow : 0xffd25a, boss.def.color);
        this.audio.play('boom');
        this.stage.shake(0.6);
      });
    }
    this.later(1.5, () => {
      this.fx.explosion(boss.x, boss.z, 7, 0xffffff, boss.def.color);
      this.fx.ring(boss.x, boss.z, 40, boss.def.glow, 1.2, 2.6);
      this.crystals.spawn(boss.x, boss.z, Math.round(boss.def.crystals * this.mods.crystals), 4, this);
      boss.dispose();
      if (this.boss === boss) this.boss = null;
      let n = 0;
      for (const e of this.enemies) if (e.alive) {
        n++;
        this.later(Math.random() * 0.6, () => e.die(this, true));
      }
      if (n) this.ui.toast('ALL ENEMIES DESTROYED!', 'gold');
      this.audio.play('bigBoom');
    });
  }

  stationDestroyed(): void {
    if (this.mode !== 'play') return;
    this.controlsLocked = true;
    this.slowMoT = 2;
    this.ui.banner('STATION LOST', 'The core is breaking apart…', 'bad', 3);
    this.audio.music('none');
    for (let i = 0; i < 12; i++) {
      this.later(i * 0.18, () => {
        const a = Math.random() * Math.PI * 2, r = Math.random() * this.station.radius;
        this.fx.explosion(Math.cos(a) * r, Math.sin(a) * r, 2 + Math.random() * 2.5, 0xffa040, 0xc5cfda);
        this.audio.play('bigBoom');
        this.stage.shake(0.8);
      });
    }
    this.later(2.3, () => {
      this.station.setVisible(false);
      this.fx.explosion(0, 0, 8, 0xffffff, 0xc5cfda);
    });
    this.later(3.6, () => {
      this.mode = 'over';
      this.audio.play('gameover');
      this.ui.showGameOver(this);
    });
  }

  private later(t: number, fn: () => void): void {
    this.timers.push({ t, fn });
  }

  // ================================================================ building

  upgradeGuns(): void {
    const cost = gunUpgradeCost(this.ship.gunTier);
    if (cost === null) {
      this.ui.toast('Guns are maxed out: Singularity Weapon!', 'info');
      return;
    }
    if (!this.spend(cost)) return;
    this.ship.setGunTier(this.ship.gunTier + 1);
    const g = GUNS[this.ship.gunTier - 1];
    this.fx.ring(this.ship.x, this.ship.z, 4, g.color, 0.5);
    this.fx.sparks(this.ship.x, this.ship.z, g.color, 24, 8);
    this.ui.banner(g.name.toUpperCase() + '!', `Ship guns level ${this.ship.gunTier}`, 'info', 1.6);
    this.audio.play('upgrade');
    this.ui.hint('guns');
  }

  selectModule(kind: ModuleKind): void {
    const def = MODULE_BY_KIND[kind];
    if (!moduleUnlocked(kind, this.sector)) {
      this.audio.play('denied');
      this.ui.toast(`${def.title} unlocks in Sector ${def.unlockSector + 1}`, 'info');
      return;
    }
    const cost = moduleCost(kind, 1)!;
    if (this.bank < cost && !this.god) {
      this.audio.play('denied');
      this.ui.toast(`${def.title} costs ${cost} 💎`, 'bad');
      return;
    }
    if (![...this.station.sockets].some((s) => !this.station.modules.has(s.id))) {
      this.audio.play('denied');
      this.ui.toast('No free sockets: expand the station!', 'info');
      return;
    }
    this.placing = kind;
    this.setBuild(true);
    this.audio.play('click');
  }

  placeAt(socketId: number): boolean {
    const kind = this.placing;
    if (!kind || !this.station.canPlace(socketId)) return false;
    const cost = moduleCost(kind, 1)!;
    if (!this.spend(cost)) return false;
    const m = this.station.place(kind, socketId);
    if (!m) {
      this.bank += cost;
      return false;
    }
    this.stats.modules++;
    this.fx.ring(m.x, m.z, 3.5, MODULE_BY_KIND[kind].color, 0.5);
    this.audio.play('build');
    this.ui.toast(`${MODULE_BY_KIND[kind].title} built!`, 'good');
    this.ui.hint('build');
    this.placing = null;
    return true;
  }

  upgradeModule(socketId: number): void {
    const m = this.station.modules.get(socketId);
    if (!m) return;
    const cost = moduleCost(m.kind, m.tier + 1);
    if (cost === null) return;
    if (!this.spend(cost)) return;
    const up = this.station.upgrade(socketId);
    if (!up) return;
    this.fx.ring(up.x, up.z, 3.5, MODULE_BY_KIND[up.kind].color, 0.5);
    this.audio.play('upgrade');
    this.ui.toast(`${this.station.tierStats(up).name}!`, 'good');
    this.drones.prune(this);
  }

  sellModule(socketId: number): void {
    const m = this.station.modules.get(socketId);
    if (!m) return;
    const v = sellValue(m.kind, m.tier);
    this.station.remove(socketId);
    this.bank += v;
    this.fx.sparks(m.x, m.z, 0xffd25a, 16, 6);
    this.audio.play('sell');
    this.ui.toast(`Sold for ${v} 💎`, 'info');
    this.drones.prune(this);
  }

  expandStation(): void {
    const next = this.station.rings;
    if (next >= EXPANSIONS.length) {
      this.ui.toast('The station is already a Mega Station!', 'info');
      return;
    }
    if (!ringUnlocked(next, this.sector)) {
      this.audio.play('denied');
      this.ui.toast(`${EXPANSIONS[next].name} unlocks in Sector ${EXPANSIONS[next].unlockSector + 1}`, 'info');
      return;
    }
    const cost = expansionCost(next)!;
    if (!this.spend(cost)) return;
    this.station.expand();
    this.ui.banner(`${EXPANSIONS[next].name.toUpperCase()} BUILT!`, `${this.station.sockets.length} sockets for modules`, 'good', 2.4);
    this.audio.play('expand');
    this.stage.shake(0.4);
  }

  setBuild(on: boolean): void {
    if (this.mode !== 'play' || this.controlsLocked) on = false;
    if (!on) this.placing = null;
    if (this.buildMode === on) return;
    this.buildMode = on;
    this.station.setBuildMode(on);
    this.ui.setBuildMode(on);
    this.input.fireHeld = false;
  }

  /** Click on the play field while building. */
  buildClick(px: number, py: number): void {
    const w = this.stage.screenToWorld(px, py);
    const s = this.station.socketAt(w.x, w.z, 2.4);
    if (!s) {
      this.ui.closePopup();
      return;
    }
    if (this.placing && !this.station.modules.has(s.id)) {
      this.placeAt(s.id);
      return;
    }
    this.ui.openSocket(this, s.id);
  }

  callWave(): void {
    if (this.director?.callEarly()) {
      const bonus = Math.round(BAL.crystals.earlyCallBonus * SECTOR_VALUE[this.sector] * this.mods.crystals);
      this.bank += bonus;
      this.ui.toast(`Brave! +${bonus} 💎 for calling the wave early`, 'gold');
      this.audio.play('click');
    }
  }

  // ================================================================ director

  private handleDirector(evs: DirectorEvent[]): void {
    for (const ev of evs) {
      switch (ev.type) {
        case 'calm':
          this.calmEventDone = false;
          this.calmT = 0;
          this.audio.music(this.endless ? 'battle' : 'calm');
          break;
        case 'warning':
          this.ui.warning(this, ev.wave, ev.boss, ev.dirs, ev.duration);
          this.audio.play('siren');
          this.setBuild(false);
          break;
        case 'waveStart':
          this.audio.music(ev.boss ? 'boss' : 'battle');
          break;
        case 'spawn':
          this.spawnOrder(ev.order);
          break;
        case 'waveCleared': {
          const waveNo = this.endless ? this.endlessLevel + ev.wave + 1 : ev.wave + 1;
          const bonus = Math.round(BAL.crystals.waveBonus * Math.min(waveNo, 8) * SECTOR_VALUE[this.sector] * this.mods.crystals);
          this.bank += bonus;
          this.crystals.vacuum();
          this.station.repairFull();
          if (this.ship.alive) this.ship.hp = this.ship.maxHp;
          this.ui.banner('WAVE CLEARED!', `+${bonus} 💎 bonus, station repaired`, 'good', 2.4);
          this.ui.clearIncoming();
          this.audio.play('waveClear');
          this.ceaseFire = false;
          if (this.endless) {
            this.endlessLevel++;
            this.saveCheckpoint();
          }
          break;
        }
        case 'sectorClear':
          this.sectorCleared();
          break;
      }
    }
  }

  private sectorCleared(): void {
    if (this.sector >= LAST_SECTOR && !this.endless) {
      this.mode = 'victory';
      this.controlsLocked = true;
      this.audio.music('victory');
      this.later(1.2, () => this.ui.showVictory(this));
      return;
    }
    this.mode = 'hyperspace';
    this.hyperT = 0;
    this.controlsLocked = true;
    this.setBuild(false);
    this.ui.banner('SECTOR CLEAR!', 'Get ready for the hyperspace jump…', 'gold', 2.6);
    this.audio.play('sectorClear');
    this.audio.music('none');
  }

  startEndless(): void {
    this.endless = true;
    this.endlessLevel = 0;
    this.mode = 'play';
    this.controlsLocked = false;
    this.makeDirector(false);
    this.saveCheckpoint();
    this.ui.enterPlay(this);
    this.ui.banner('ENDLESS MODE', 'How long can your station survive?', 'gold', 3);
    this.audio.music('battle');
  }

  private updateHyperspace(realDt: number): void {
    const t0 = this.hyperT;
    this.hyperT += realDt;
    const t = this.hyperT;
    const s = this.ship;
    if (s.alive) {
      const tx = 0, tz = this.station.radius + 3;
      s.x += (tx - s.x) * (1 - Math.exp(-2 * realDt));
      s.z += (tz - s.z) * (1 - Math.exp(-2 * realDt));
      s.vx = s.vz = 0;
    }
    if (t < 2) this.crystals.vacuum();
    const ramp = (a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
    if (t < 4) {
      this.bg.warpAmount = ramp(2, 4);
      this.stage.fovKick = ramp(2.2, 4) * 26;
      if (t > 2.5) this.stage.shake(0.15 * ramp(2.5, 4));
    } else {
      this.bg.warpAmount = 1 - ramp(4, 5.6);
      this.stage.fovKick = (1 - ramp(4, 5.6)) * 26;
    }
    if (t0 < 2 && t >= 2) this.audio.play('hyper');
    if (t0 < 4 && t >= 4) {
      this.fx.screen('rgba(220,240,255,1)', 1);
      this.jumpTo(this.sector + 1);
    }
    if (t0 < 5.8 && t >= 5.8) {
      this.mode = 'play';
      this.controlsLocked = false;
      this.hyperT = -1;
      this.ui.sectorCard(this);
      this.audio.music('calm');
    }
  }

  /** Swap to the next sector mid-jump. */
  private jumpTo(index: number): void {
    const keepBank = this.bank;
    this.resetWorld();
    this.applySector(index);
    this.bank = keepBank;
    this.asteroids.setSector(this.def, index);
    this.ship.missilesMax = BAL.missiles.start + index * BAL.missiles.perSector;
    this.ship.missiles = this.ship.missilesMax;
    this.station.repairFull();
    if (!this.ship.alive) this.ship.respawn(this);
    this.ship.hp = this.ship.maxHp;
    this.makeDirector(false);
    this.saveCheckpoint();
  }

  // ================================================================ main update

  update(realDt: number): void {
    const input = this.input;
    if (input.pressed('KeyM')) this.audio.toggleMute();
    if (this.mode === 'title') {
      this.titleT += realDt;
      this.stage.distGoal = 30;
      this.stage.follow(Math.sin(this.titleT * 0.1) * 4, 6 + Math.cos(this.titleT * 0.13) * 2, realDt);
      this.station.update(realDt, this);
      this.asteroids.update(realDt * 0.5, this);
      this.fx.update(realDt, realDt);
      this.finishFrame(realDt);
      return;
    }

    // global keys
    if (this.mode === 'play' && !this.controlsLocked) {
      if (input.pressed('KeyP') || (input.pressed('Escape') && !this.buildMode)) {
        this.setPaused(!this.paused);
      }
    }
    if (this.paused) {
      this.ui.update(this);
      this.stage.update(0);
      input.endFrame();
      return;
    }
    if (this.mode === 'play' && !this.controlsLocked) this.handleKeys();

    // time scale: hit-stop, slow-mo, build mode
    let ts = 1;
    if (this.hitStopT > 0) {
      this.hitStopT -= realDt;
      ts = 0.06;
    } else if (this.slowMoT > 0) {
      this.slowMoT -= realDt;
      ts = 0.3;
    }
    if (this.buildMode) ts = Math.min(ts, 0.22);
    const dt = realDt * ts;
    this.time += dt;
    if (this.mode === 'play') this.stats.time += realDt;

    // aim
    if (input.touchActive || this.autoFire) {
      const t = this.nearestTarget(this.ship.x, this.ship.z, 30) ?? (this.isCalm ? this.nearestRock(this.ship.x, this.ship.z, 26) : null);
      if (t) this.aim = { x: t.x, z: t.z };
      else {
        const mv = input.move();
        if (mv.x || mv.z) this.aim = { x: this.ship.x + mv.x * 10, z: this.ship.z + mv.z * 10 };
      }
      this.autoFire = input.touchActive && !!t;
    } else if (input.hasMouse) {
      this.aim = this.stage.screenToWorld(input.mouseX, input.mouseY);
    }

    // collision grid
    this.grid.clear();
    for (const a of this.asteroids.list) if (a.alive) this.grid.insert(a);
    for (const e of this.enemies) if (e.alive) this.grid.insert(e);
    if (this.boss?.alive) {
      this.grid.insert(this.boss);
      for (const p of this.boss.pods) if (p.alive) this.grid.insert(p);
      for (const d of this.boss.decoys) if (d.alive) this.grid.insert(d);
    }
    const extra: Hittable[] = [];
    this.events.hittables(extra);
    for (const h of extra) this.grid.insert(h);

    // timers (game time)
    for (const t of this.timers) t.t -= realDt;
    const due = this.timers.filter((t) => t.t <= 0);
    this.timers = this.timers.filter((t) => t.t > 0);
    for (const t of due) t.fn();

    // world
    this.ship.update(dt, this);
    this.station.update(dt, this);
    this.drones.update(dt, this);
    for (const e of this.enemies) if (e.alive) e.update(dt, this);
    if (this.boss?.alive) {
      this.boss.update(dt, this);
      this.ui.bossBar(this.boss);
    }
    this.bolts.update(dt, this);
    this.missiles.update(dt, this);
    this.asteroids.update(dt, this);
    this.updateMagnets(dt);
    this.pickups.update(dt, this);
    this.events.update(dt, this);
    this.updateVortexes(dt);
    this.enemies = this.enemies.filter((e) => {
      if (!e.alive) e.dispose();
      return e.alive;
    });

    if (this.mode === 'play' && this.director) {
      this.handleDirector(this.director.update(dt, this.enemiesAlive));
      this.calmEvents(dt);
    }
    if (this.mode === 'hyperspace') this.updateHyperspace(realDt);

    // floating "+N" for crystal gains
    this.gainT -= realDt;
    if (this.gainAccum > 0 && this.gainT <= 0) {
      this.fx.text(this.gainX, this.gainZ, `+${Math.round(this.gainAccum)}`, 'fx-gain', 0.8);
      this.gainAccum = 0;
      this.gainT = 0.22;
    }

    this.fx.update(dt, realDt);
    this.updateCamera(realDt);
    this.finishFrame(realDt);
  }

  private finishFrame(realDt: number): void {
    this.bolts.render();
    this.bg.update(realDt, this.stage.target, this.stage.renderer.getPixelRatio());
    this.stage.update(realDt);
    this.ui.update(this);
    this.input.endFrame();
  }

  private updateMagnets(dt: number): void {
    const m = this.magnetsBuf;
    m.length = 0;
    const s = this.ship;
    if (s.alive) {
      this.shipMagnet.x = s.x;
      this.shipMagnet.z = s.z;
      this.shipMagnet.r = BAL.ship.magnetRadius + (this.sparky ? 4 : 0);
      m.push(this.shipMagnet);
    }
    this.stationMagnet.r = this.station.magnetRadius;
    if (this.station.alive) m.push(this.stationMagnet);
    this.drones.magnets(m);
    for (const v of this.vortexes) m.push(v.magnet);
    this.crystals.update(dt, m, this.stationMagnet, this.time);
  }

  private calmEvents(dt: number): void {
    const d = this.director!;
    if (d.phase !== 'calm' || this.calmEventDone || this.endless) return;
    this.calmT += dt;
    if (this.calmT < 6) return;
    this.calmEventDone = true;
    let kind: EventKind | null = null;
    if (this.sector === 0 && d.wave === 2 && !this.sparky) kind = 'sos';
    else if (d.wave >= 1 && this.rng.chance(0.75)) kind = this.events.pickRandom();
    if (kind) this.events.start(kind, this);
  }

  private updateCamera(realDt: number): void {
    const s = this.ship;
    const st = this.stage;
    if (this.buildMode) {
      st.distGoal = 24 + this.station.rings * 10;
      st.follow(this.station.x, this.station.z + 2, realDt);
      return;
    }
    if (this.mode === 'hyperspace') {
      st.distGoal = 52;
      st.follow(0, 4, realDt);
      return;
    }
    st.distGoal = this.boss?.alive ? BAL.camera.bossDist : BAL.camera.dist;
    st.distGoal *= 1 + this.zoom * 0.12;
    if (s.alive) {
      const ax = Math.max(-12, Math.min(12, (this.aim.x - s.x) * BAL.camera.lookAhead));
      const az = Math.max(-9, Math.min(9, (this.aim.z - s.z) * BAL.camera.lookAhead));
      st.follow(s.x + ax, s.z + az, realDt);
    } else st.follow(this.station.x, this.station.z + 6, realDt);
  }

  zoom = 0;

  setPaused(p: boolean): void {
    if (this.mode !== 'play') return;
    this.paused = p;
    this.input.fireHeld = false;
    this.ui.showPause(p, this);
    this.audio.setPaused(p);
  }

  private handleKeys(): void {
    const input = this.input;
    if (input.wheel) this.zoom = Math.max(-2, Math.min(3, this.zoom + input.wheel * 0.5));
    if (input.pressed('KeyB', 'Tab')) this.setBuild(!this.buildMode);
    if (this.buildMode && (input.pressed('Escape') || input.pressed('Mouse2'))) {
      if (this.placing) this.placing = null;
      else this.setBuild(false);
      this.ui.closePopup();
    }
    if (input.pressed('Digit1', 'Numpad1')) this.upgradeGuns();
    for (const m of MODULES) if (input.pressed('Digit' + m.hotkey, 'Numpad' + m.hotkey)) this.selectModule(m.kind);
    if (input.pressed('KeyX')) this.expandStation();
    if (input.pressed('KeyN')) this.callWave();
    if (this.dev) {
      if (input.pressed('Digit8')) this.bank += 500 * SECTOR_VALUE[this.sector];
      if (input.pressed('Digit9')) this.devClearWave();
      if (input.pressed('Digit0')) this.devNextSector();
      if (input.pressed('Minus')) this.devBoss();
      if (input.pressed('Equal')) {
        this.god = !this.god;
        this.ui.toast(this.god ? 'God mode ON' : 'God mode OFF', 'info');
      }
    }
  }

  // ================================================================ dev helpers (?dev and window.__game)

  devClearWave(): void {
    this.director?.dropPending();
    for (const e of this.enemies) e.die(this, true);
    if (this.boss?.alive) this.boss.onHit(1e9, this, this.boss.x, this.boss.z);
  }

  devBoss(): void {
    if (!this.director) return;
    const d = this.director;
    while (d.wave < d.waveCount - 1) d.wave++;
    if (d.phase === 'calm') d.callEarly();
  }

  devNextSector(): void {
    if (this.sector >= LAST_SECTOR) return;
    this.mode = 'hyperspace';
    this.hyperT = 0;
    this.controlsLocked = true;
  }

  devEvent(kind: EventKind): void {
    this.events.start(kind, this);
  }

  /** Counts for tests and the dev overlay. */
  counts() {
    return {
      mode: this.mode,
      sector: this.sector,
      phase: this.director?.phase,
      wave: this.director?.wave,
      bank: Math.floor(this.bank),
      gunTier: this.ship.gunTier,
      hp: Math.round(this.ship.hp),
      station: Math.round(this.station.hp),
      shield: Math.round(this.station.shield),
      enemies: this.enemiesAlive,
      asteroids: this.asteroids.list.length,
      crystals: this.crystals.count,
      bolts: this.bolts.list.length,
      modules: this.station.modules.size,
      rings: this.station.rings,
      boss: this.boss ? Math.round(this.boss.frac * 100) : null,
      calls: this.stage.renderer.info.render.calls,
    };
  }

  get maxGun(): number {
    return MAX_GUN_TIER;
  }

  /** world → screen for UI (popups, arrows) */
  project(x: number, z: number, y = 0): { x: number; y: number } {
    return this.stage.worldToScreen(x, y, z);
  }

  get threeScene(): THREE.Scene {
    return this.stage.scene;
  }
}
