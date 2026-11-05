import { SPEAKERS, type Line, type Speaker } from '../config/lines';

interface Queued {
  who: Speaker;
  text: string;
}

const TYPE_SPEED = 48; // characters per second
const QUEUE_MAX = 4;

/**
 * The talking-characters panel: a portrait, the speaker's name and a line that types out.
 * Lines queue up so they never overlap; boss lines can jump the queue.
 */
export class Comms {
  readonly el: HTMLDivElement;
  private face: HTMLDivElement;
  private nameEl: HTMLDivElement;
  private textEl: HTMLDivElement;
  private queue: Queued[] = [];
  private cur: Queued | null = null;
  private shown = 0;
  private hold = 0;
  private blipAcc = 0;
  /** called every few typed characters (talk blips) */
  onBlip: ((who: Speaker) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'comms';
    this.el.innerHTML = `<div class="face"><i class="eye l"></i><i class="eye r"></i><i class="mouth"></i></div><div class="bubble"><div class="who"></div><div class="said"></div></div>`;
    this.face = this.el.querySelector('.face')!;
    this.nameEl = this.el.querySelector('.who')!;
    this.textEl = this.el.querySelector('.said')!;
    parent.append(this.el);
  }

  /** Queue lines (in order). `priority` clears whatever was waiting. */
  say(lines: Line[], vars: Record<string, string>, priority = false): void {
    const fill = (t: string) => t.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
    if (priority) {
      this.queue = [];
      this.cur = null;
    }
    for (const l of lines) {
      if (this.queue.length >= QUEUE_MAX) this.queue.shift();
      this.queue.push({ who: l.who, text: fill(l.text) });
    }
  }

  clear(): void {
    this.queue = [];
    this.cur = null;
    this.el.classList.remove('show');
  }

  get busy(): boolean {
    return !!this.cur || this.queue.length > 0;
  }

  update(dt: number): void {
    if (!this.cur) {
      const next = this.queue.shift();
      if (!next) return;
      this.cur = next;
      this.shown = 0;
      this.hold = 1.8 + next.text.length * 0.035;
      const sp = SPEAKERS[next.who];
      this.el.className = `comms show speaker-${next.who}`;
      this.el.style.setProperty('--sp', sp.color);
      this.nameEl.textContent = sp.name;
      this.textEl.textContent = '';
    }
    const c = this.cur;
    if (this.shown < c.text.length) {
      const before = Math.floor(this.shown);
      this.shown = Math.min(c.text.length, this.shown + dt * TYPE_SPEED);
      const now = Math.floor(this.shown);
      if (now !== before) {
        this.textEl.textContent = c.text.slice(0, now);
        this.blipAcc += now - before;
        if (this.blipAcc >= 3) {
          this.blipAcc = 0;
          this.onBlip?.(c.who);
        }
        this.face.classList.toggle('talk', now % 4 < 2);
      }
      return;
    }
    this.face.classList.remove('talk');
    this.hold -= dt;
    if (this.hold <= 0) {
      this.cur = null;
      if (!this.queue.length) this.el.classList.remove('show');
    }
  }
}
