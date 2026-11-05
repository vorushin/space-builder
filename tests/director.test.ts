import { describe, expect, it } from 'vitest';
import { Director, type DirectorEvent } from '../src/logic/director';
import type { SpawnOrder } from '../src/logic/waves';

const T = { firstCalm: 10, calm: 5, warning: 2, bossWarning: 3, cleared: 1 };
const orders = (wave: number): SpawnOrder[] =>
  wave === 2
    ? [{ at: 0, enemy: 'a', count: 2, dir: 0 }, { at: 2, enemy: 'boss', count: 1, dir: 0, boss: true }]
    : [{ at: 0, enemy: 'a', count: 3, dir: 0 }, { at: 4, enemy: 'b', count: 1, dir: Math.PI }];

function run(d: Director, seconds: number, alive: () => number, step = 0.1): DirectorEvent[] {
  const ev: DirectorEvent[] = [];
  for (let t = 0; t < seconds - 1e-9; t += step) ev.push(...d.update(step, alive()));
  return ev;
}

describe('director', () => {
  it('goes calm → warning → wave, emitting spawns on time', () => {
    const d = new Director(3, T, orders);
    expect(d.start()).toEqual([{ type: 'calm', wave: 0, duration: 10 }]);
    let ev = run(d, 9.9, () => 0);
    expect(ev).toHaveLength(0);
    ev = run(d, 0.2, () => 0);
    expect(ev[0]).toMatchObject({ type: 'warning', wave: 0, boss: false });
    expect((ev[0] as { dirs: number[] }).dirs).toHaveLength(2);
    ev = run(d, 2, () => 0);
    expect(ev.map((e) => e.type)).toEqual(['waveStart', 'spawn']);
    expect(d.pendingSpawns).toBe(1);
    expect(d.pendingEnemies).toBe(1);
    ev = run(d, 4.05, () => 3);
    expect(ev.filter((e) => e.type === 'spawn')).toHaveLength(1);
  });

  it('only clears when every spawn is out and every enemy is dead', () => {
    const d = new Director(3, T, orders);
    run(d, 12.2, () => 0); // through calm + warning
    expect(d.phase).toBe('wave');
    let alive = 5;
    let ev = run(d, 6, () => alive);
    expect(ev.some((e) => e.type === 'waveCleared')).toBe(false);
    alive = 0;
    ev = run(d, 0.2, () => alive);
    expect(ev.some((e) => e.type === 'waveCleared')).toBe(true);
    ev = run(d, 1.1, () => 0);
    expect(ev).toContainEqual({ type: 'calm', wave: 1, duration: 5 });
  });

  it('does not clear in the same tick the last group spawns into an empty field', () => {
    const late = (): SpawnOrder[] => [{ at: 0, enemy: 'a', count: 1, dir: 0 }, { at: 3, enemy: 'b', count: 2, dir: 0 }];
    const d = new Director(2, T, late);
    run(d, 12.05, () => 0); // calm + warning: wave starts, first group out
    expect(d.phase).toBe('wave');
    // the first group is already dead when the second group spawns; the game then adds 2 enemies
    let alive = 0;
    const seen: string[] = [];
    for (let t = 0; t < 3.5; t += 0.1) {
      for (const e of d.update(0.1, alive)) {
        seen.push(e.type);
        if (e.type === 'spawn') alive += e.order.count;
      }
    }
    expect(seen).toContain('spawn');
    expect(seen).not.toContain('waveCleared');
    expect(d.phase).toBe('wave');
  });

  it('callEarly only works during calm and marks the wave as early', () => {
    const d = new Director(3, T, orders);
    expect(d.callEarly()).toBe(true);
    const ev = run(d, 0.1, () => 0);
    expect(ev[0].type).toBe('warning');
    expect(d.callEarly()).toBe(false);
    const rest = run(d, 6.5, () => 0);
    expect(rest).toContainEqual({ type: 'waveCleared', wave: 0, early: true });
  });

  it('flags the boss wave and finishes with sectorClear', () => {
    const d = new Director(3, T, orders);
    const ev = run(d, 60, () => 0);
    const warnings = ev.filter((e) => e.type === 'warning') as Extract<DirectorEvent, { type: 'warning' }>[];
    expect(warnings.map((w) => w.boss)).toEqual([false, false, true]);
    expect(warnings[2].duration).toBe(3);
    expect(ev[ev.length - 1]).toEqual({ type: 'sectorClear' });
    expect(d.phase).toBe('sectorClear');
    expect(run(d, 5, () => 0)).toHaveLength(0);
  });
});
