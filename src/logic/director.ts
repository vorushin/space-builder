import type { SpawnOrder } from './waves';

/**
 * The rhythm of a sector:
 * calm (mine & build) → warning (siren, arrows) → wave (spawns until all dead) → cleared → next calm …
 * After the last wave is cleared: sectorClear.
 */
export type Phase = 'calm' | 'warning' | 'wave' | 'cleared' | 'sectorClear';

export type DirectorEvent =
  | { type: 'calm'; wave: number; duration: number }
  | { type: 'warning'; wave: number; boss: boolean; bossId?: string; dirs: number[]; duration: number }
  | { type: 'waveStart'; wave: number; boss: boolean }
  | { type: 'spawn'; order: SpawnOrder }
  | { type: 'waveCleared'; wave: number; early: boolean }
  | { type: 'sectorClear' };

export interface Timings {
  firstCalm: number;
  calm: number;
  warning: number;
  bossWarning: number;
  cleared: number;
}

export class Director {
  phase: Phase = 'calm';
  /** index of the upcoming (calm/warning) or current (wave/cleared) wave */
  wave = 0;
  /** seconds left in the timed phases (calm, warning, cleared) */
  timer: number;
  waveTime = 0;
  boss = false;
  calledEarly = false;
  private orders: SpawnOrder[] = [];

  constructor(
    readonly waveCount: number,
    private t: Timings,
    private makeOrders: (wave: number) => SpawnOrder[],
  ) {
    this.timer = t.firstCalm;
  }

  /** Event for the very first calm phase. */
  start(): DirectorEvent[] {
    return [{ type: 'calm', wave: 0, duration: this.timer }];
  }

  get pendingSpawns(): number {
    return this.orders.length;
  }

  /** Enemies (boss counts as one) still waiting to spawn in this wave. */
  get pendingEnemies(): number {
    return this.phase === 'wave' || this.phase === 'warning' ? this.orders.reduce((n, o) => n + o.count, 0) : 0;
  }

  /** Start the next wave now (only during calm). */
  callEarly(): boolean {
    if (this.phase !== 'calm') return false;
    this.calledEarly = true;
    this.timer = 0;
    return true;
  }

  /** Dev: drop pending spawns so the wave clears as soon as the field is empty. */
  dropPending(): void {
    this.orders.length = 0;
  }

  update(dt: number, enemiesAlive: number): DirectorEvent[] {
    const ev: DirectorEvent[] = [];
    switch (this.phase) {
      case 'calm':
        this.timer -= dt;
        if (this.timer <= 0) this.toWarning(ev);
        break;
      case 'warning':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.phase = 'wave';
          this.waveTime = 0;
          ev.push({ type: 'waveStart', wave: this.wave, boss: this.boss });
          this.emitSpawns(ev);
        }
        break;
      case 'wave': {
        this.waveTime += dt;
        // enemiesAlive was counted before this tick's spawns exist, so never clear on a spawning tick
        const spawned = this.emitSpawns(ev);
        if (!spawned && this.orders.length === 0 && enemiesAlive <= 0) {
          this.phase = 'cleared';
          this.timer = this.t.cleared;
          ev.push({ type: 'waveCleared', wave: this.wave, early: this.calledEarly });
        }
        break;
      }
      case 'cleared':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.wave++;
          this.calledEarly = false;
          if (this.wave >= this.waveCount) {
            this.phase = 'sectorClear';
            ev.push({ type: 'sectorClear' });
          } else {
            this.phase = 'calm';
            this.timer = this.t.calm;
            ev.push({ type: 'calm', wave: this.wave, duration: this.timer });
          }
        }
        break;
      case 'sectorClear':
        break;
    }
    return ev;
  }

  private toWarning(ev: DirectorEvent[]): void {
    this.orders = this.makeOrders(this.wave).slice().sort((a, b) => a.at - b.at);
    this.boss = this.orders.some((o) => o.boss);
    this.phase = 'warning';
    this.timer = this.boss ? this.t.bossWarning : this.t.warning;
    const dirs: number[] = [];
    for (const o of this.orders) if (!dirs.some((d) => Math.abs(d - o.dir) < 1e-6)) dirs.push(o.dir);
    const bossId = this.orders.find((o) => o.boss)?.enemy;
    ev.push({ type: 'warning', wave: this.wave, boss: this.boss, bossId, dirs, duration: this.timer });
  }

  private emitSpawns(ev: DirectorEvent[]): number {
    let n = 0;
    while (this.orders.length && this.orders[0].at <= this.waveTime) {
      ev.push({ type: 'spawn', order: this.orders.shift()! });
      n++;
    }
    return n;
  }
}
