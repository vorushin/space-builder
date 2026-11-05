import { describe, expect, it } from 'vitest';
import { SECTORS } from '../src/config/sectors';
import { Rng, wrapAngle } from '../src/logic/math';
import { buildEndlessWave, buildWave } from '../src/logic/waves';

describe('waves', () => {
  it('matches the configured enemy counts (normal) and scales them down on easy', () => {
    SECTORS.forEach((sector) => {
      sector.waves.forEach((w, i) => {
        const orders = buildWave(sector, i, new Rng(7 + i), 'normal').filter((o) => !o.boss);
        const total = orders.reduce((n, o) => n + o.count, 0);
        expect(total).toBe(w.groups.reduce((n, g) => n + g.count, 0));
        const easy = buildWave(sector, i, new Rng(7 + i), 'easy').filter((o) => !o.boss).reduce((n, o) => n + o.count, 0);
        expect(easy).toBeLessThanOrEqual(total);
      });
    });
  });

  it('orders are sorted by time and come from directions at least 80° apart', () => {
    for (let seed = 1; seed < 60; seed++) {
      SECTORS.forEach((sector) => {
        sector.waves.forEach((_, i) => {
          const orders = buildWave(sector, i, new Rng(seed), 'normal');
          for (let k = 1; k < orders.length; k++) expect(orders[k].at).toBeGreaterThanOrEqual(orders[k - 1].at);
          const dirs = [...new Set(orders.map((o) => o.dir))];
          for (let a = 0; a < dirs.length; a++)
            for (let b = a + 1; b < dirs.length; b++)
              expect(Math.abs(wrapAngle(dirs[a] - dirs[b]))).toBeGreaterThan((80 * Math.PI) / 180);
        });
      });
    }
  });

  it('only the last wave of each sector has the boss, exactly once', () => {
    SECTORS.forEach((sector) => {
      const last = sector.waves.length - 1;
      sector.waves.forEach((_, i) => {
        const bosses = buildWave(sector, i, new Rng(3), 'normal').filter((o) => o.boss);
        expect(bosses.length).toBe(i === last ? 1 : 0);
        if (i === last) expect(bosses[0].enemy).toBe(sector.boss.id);
      });
    });
  });

  it('every wave references real enemies', () => {
    const ids = new Set(SECTORS.flatMap((s) => s.enemies.map((e) => e.id)));
    SECTORS.forEach((s) => s.waves.forEach((w) => w.groups.forEach((g) => expect(ids.has(g.enemy)).toBe(true))));
  });

  it('endless waves get bigger and bring a boss every 5th level', () => {
    const size = (lvl: number) => buildEndlessWave(lvl, new Rng(lvl), 'normal').filter((o) => !o.boss).reduce((n, o) => n + o.count, 0);
    expect(size(12)).toBeGreaterThan(size(1));
    expect(buildEndlessWave(5, new Rng(1), 'normal').some((o) => o.boss)).toBe(true);
    expect(buildEndlessWave(4, new Rng(1), 'normal').some((o) => o.boss)).toBe(false);
  });
});
