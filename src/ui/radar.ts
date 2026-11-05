import { BAL } from '../config/balance';
import type { Game } from '../game';

/** Round minimap of the whole arena (top-right, under the crystal counter). */
export class Radar {
  readonly el: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private size = 152;
  private frame = 0;
  private incoming: { dir: number; t: number }[] = [];

  constructor(parent: HTMLElement) {
    this.el = document.createElement('canvas');
    this.el.className = 'radar';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.el.width = this.el.height = Math.round(this.size * dpr);
    this.ctx = this.el.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
    parent.append(this.el);
  }

  /** Flash the directions a wave will come from. */
  warn(dirs: number[], seconds: number): void {
    this.incoming = dirs.map((dir) => ({ dir, t: seconds }));
  }

  clearWarn(): void {
    this.incoming = [];
  }

  update(game: Game, dt: number): void {
    for (const w of this.incoming) w.t -= dt;
    this.incoming = this.incoming.filter((w) => w.t > 0);
    // 30 fps is plenty for a radar
    if (++this.frame % 2) return;
    if (this.el.offsetParent === null) return; // hidden (narrow screens)
    const c = this.ctx;
    const S = this.size;
    const R = S / 2 - 6;
    const k = R / (BAL.arenaRadius + 6);
    const cx = S / 2, cy = S / 2;
    const px = (x: number) => cx + x * k;
    const pz = (z: number) => cy + z * k;
    c.clearRect(0, 0, S, S);

    // rings + sweep
    c.strokeStyle = 'rgba(92,255,214,0.18)';
    c.lineWidth = 1;
    for (const f of [0.33, 0.66]) {
      c.beginPath();
      c.arc(cx, cy, R * f, 0, Math.PI * 2);
      c.stroke();
    }
    c.strokeStyle = 'rgba(92,255,214,0.35)';
    c.beginPath();
    c.arc(cx, cy, BAL.arenaRadius * k, 0, Math.PI * 2);
    c.stroke();
    const sweep = (game.time * 1.4) % (Math.PI * 2);
    const g = c.createConicGradient ? c.createConicGradient(sweep - 0.6, cx, cy) : null;
    if (g) {
      g.addColorStop(0, 'rgba(92,255,214,0)');
      g.addColorStop(0.09, 'rgba(92,255,214,0.16)');
      g.addColorStop(0.1, 'rgba(92,255,214,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(cx, cy, R, 0, Math.PI * 2);
      c.fill();
    }

    // incoming wave directions
    for (const w of this.incoming) {
      const blink = Math.floor(w.t * 4) % 2 === 0;
      c.strokeStyle = blink ? 'rgba(255,90,110,0.95)' : 'rgba(255,90,110,0.35)';
      c.lineWidth = 5;
      c.beginPath();
      c.arc(cx, cy, R - 2, w.dir - 0.35, w.dir + 0.35);
      c.stroke();
    }

    // big rocks
    c.fillStyle = 'rgba(190,200,210,0.35)';
    for (const a of game.asteroids.list) {
      if (!a.alive || a.size === 'S') continue;
      const r = a.size === 'G' ? 3.5 : a.size === 'L' ? 2 : 1.3;
      c.fillRect(px(a.x) - r / 2, pz(a.z) - r / 2, r, r);
    }
    // station
    const st = game.station;
    if (st.alive) {
      c.fillStyle = '#4da3ff';
      const s = Math.max(5, st.radius * k * 1.4);
      c.beginPath();
      c.arc(px(st.x), pz(st.z), s / 2, 0, Math.PI * 2);
      c.fill();
    }
    // events
    const b = game.events.beacon();
    const pulse = 0.6 + 0.4 * Math.sin(game.time * 8);
    if (b) {
      c.fillStyle = `rgba(255,207,74,${pulse})`;
      c.beginPath();
      c.arc(px(b.x), pz(b.z), 4, 0, Math.PI * 2);
      c.fill();
    }
    for (const p of game.pickups.crates) {
      c.fillStyle = `rgba(125,255,176,${pulse})`;
      c.fillRect(px(p.x) - 3, pz(p.z) - 3, 6, 6);
    }
    // enemies
    c.fillStyle = '#ff5a6e';
    for (const e of game.enemies) {
      if (!e.alive) continue;
      const r = e.r > 2 ? 3.2 : 2.2;
      c.beginPath();
      c.arc(px(e.x), pz(e.z), r, 0, Math.PI * 2);
      c.fill();
    }
    if (game.boss?.alive) {
      c.fillStyle = `rgba(255,60,40,${0.7 + 0.3 * pulse})`;
      c.beginPath();
      c.arc(px(game.boss.x), pz(game.boss.z), 6, 0, Math.PI * 2);
      c.fill();
    }
    // the players' ships: arrows (player 2 in gold)
    for (const sh of game.ships) {
      if (!sh.alive) continue;
      c.save();
      c.translate(px(sh.x), pz(sh.z));
      c.rotate(sh.heading);
      c.fillStyle = sh.id === 0 ? '#ffffff' : '#ffcf4a';
      c.beginPath();
      c.moveTo(6, 0);
      c.lineTo(-4, 3.5);
      c.lineTo(-2, 0);
      c.lineTo(-4, -3.5);
      c.closePath();
      c.fill();
      c.restore();
    }
  }
}
