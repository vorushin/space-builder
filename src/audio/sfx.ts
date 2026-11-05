/**
 * Procedural sound: every effect is synthesised with WebAudio (no files),
 * plus a tiny step sequencer for calm / battle / boss music.
 */
export type SfxName =
  | 'laser' | 'turret' | 'rail' | 'enemyShot' | 'boom' | 'bigBoom' | 'crack' | 'rockBreak' | 'pickup'
  | 'hurt' | 'dash' | 'missile' | 'denied' | 'shieldHit' | 'shieldDown' | 'stationHit' | 'zap' | 'blink'
  | 'clink' | 'bossRoar' | 'bossShot' | 'dashBoss' | 'charge' | 'laserBeam' | 'jackpot' | 'event' | 'build'
  | 'upgrade' | 'sell' | 'expand' | 'siren' | 'waveClear' | 'powerup' | 'hyper' | 'click' | 'gameover'
  | 'sectorClear' | 'bossDie' | 'vortex';

export type MusicMode = 'none' | 'title' | 'calm' | 'battle' | 'boss' | 'victory';

const THROTTLE: Partial<Record<SfxName, number>> = {
  laser: 0.05, turret: 0.07, enemyShot: 0.08, boom: 0.05, crack: 0.04, rockBreak: 0.06, pickup: 0.035,
  shieldHit: 0.06, stationHit: 0.1, zap: 0.06, bossShot: 0.1, clink: 0.2, hurt: 0.15, bigBoom: 0.08,
};

const MUTE_KEY = 'space-builder-3d.muted';
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private musicBus!: GainNode;
  private comp!: DynamicsCompressorNode;
  private noise!: AudioBuffer;
  private last = new Map<string, number>();
  muted = false;
  private streak = 0;
  private streakT = 0;
  private mode: MusicMode = 'none';
  private wantMode: MusicMode = 'none';
  private step = 0;
  private nextT = 0;
  private timer: number | null = null;
  private paused = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      /* ignore */
    }
    const unlock = () => this.resume();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  resume(): void {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const c = this.ctx;
      this.comp = c.createDynamicsCompressor();
      this.comp.threshold.value = -14;
      this.comp.ratio.value = 6;
      this.master = c.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.sfx = c.createGain();
      this.sfx.gain.value = 0.9;
      this.musicBus = c.createGain();
      this.musicBus.gain.value = 0.32;
      this.sfx.connect(this.comp);
      this.musicBus.connect(this.comp);
      this.comp.connect(this.master);
      this.master.connect(c.destination);
      const len = c.sampleRate * 1.5;
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.timer = window.setInterval(() => this.schedule(), 25);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  setPaused(p: boolean): void {
    this.paused = p;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(p ? 0.08 : 0.32, this.ctx.currentTime, 0.2);
  }

  // ------------------------------------------------------------ primitives

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo = 0, delay = 0, attack = 0.005, dest?: AudioNode): void {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo > 0) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest ?? this.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private hiss(dur: number, vol: number, f0: number, f1: number, type: BiquadFilterType = 'lowpass', delay = 0, q = 1, dest?: AudioNode): void {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest ?? this.sfx);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  private arp(notes: number[], step: number, type: OscillatorType, vol: number, len = 0.18): void {
    notes.forEach((n, i) => this.tone(midi(n), len, type, vol, 0, i * step));
  }

  // ------------------------------------------------------------ effects

  play(name: SfxName, param = 0): void {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const th = THROTTLE[name];
    if (th) {
      if (now - (this.last.get(name) ?? -1) < th) return;
      this.last.set(name, now);
    }
    const r = () => 0.9 + Math.random() * 0.2;
    switch (name) {
      case 'laser':
        this.tone((880 + param * 50) * r(), 0.08, 'square', 0.035, 260 + param * 20);
        break;
      case 'turret':
        this.tone(760 * r(), 0.06, 'triangle', 0.03, 330);
        break;
      case 'rail':
        this.tone(1500, 0.2, 'sawtooth', 0.05, 180);
        this.hiss(0.18, 0.06, 6000, 1500, 'highpass');
        break;
      case 'enemyShot':
        this.tone(430 * r(), 0.09, 'square', 0.022, 240);
        break;
      case 'boom':
        this.hiss(0.4, 0.22, 1100, 160);
        this.tone(95, 0.3, 'sine', 0.22, 40);
        break;
      case 'bigBoom':
        this.hiss(1.0, 0.32, 1500, 90);
        this.tone(72, 0.9, 'sine', 0.38, 28);
        break;
      case 'crack':
        this.hiss(0.09, 0.09, 2400 * r(), 900, 'bandpass', 0, 2);
        break;
      case 'rockBreak':
        this.hiss(0.28, 0.16, 1600, 300);
        this.tone(130, 0.2, 'sine', 0.14, 60);
        break;
      case 'pickup': {
        const t = now;
        if (t - this.streakT > 0.7) this.streak = 0;
        this.streakT = t;
        const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
        const n = 79 + scale[Math.min(this.streak, scale.length - 1)];
        this.streak++;
        this.tone(midi(n), 0.12, 'triangle', 0.045);
        this.tone(midi(n + 12), 0.08, 'sine', 0.02, 0, 0.02);
        break;
      }
      case 'hurt':
        this.tone(220, 0.25, 'sawtooth', 0.1, 70);
        this.hiss(0.2, 0.1, 2000, 300);
        break;
      case 'dash':
        this.hiss(0.2, 0.08, 800, 5000, 'bandpass', 0, 1.5);
        this.tone(300, 0.15, 'sine', 0.05, 700);
        break;
      case 'missile':
        this.hiss(0.45, 0.08, 500, 2500, 'bandpass', 0, 2);
        this.tone(200, 0.3, 'sawtooth', 0.03, 110);
        break;
      case 'denied':
        this.tone(170, 0.09, 'square', 0.05);
        this.tone(130, 0.12, 'square', 0.05, 0, 0.1);
        break;
      case 'shieldHit':
        this.tone(900 * r(), 0.09, 'sine', 0.04, 1400);
        break;
      case 'shieldDown':
        this.tone(700, 0.7, 'sawtooth', 0.1, 70);
        this.hiss(0.5, 0.1, 3000, 200);
        break;
      case 'stationHit':
        this.tone(130, 0.16, 'square', 0.07, 70);
        break;
      case 'zap':
        this.hiss(0.14, 0.08, 4000, 1500, 'bandpass', 0, 3);
        this.tone(1100 + Math.random() * 600, 0.08, 'square', 0.03, 300);
        break;
      case 'blink':
        this.tone(1300, 0.22, 'sine', 0.06, 280);
        break;
      case 'clink':
        this.tone(1900, 0.06, 'triangle', 0.05);
        break;
      case 'bossRoar':
        this.tone(78, 1.4, 'sawtooth', 0.14, 42, 0, 0.1);
        this.tone(81, 1.4, 'sawtooth', 0.14, 40, 0, 0.1);
        this.hiss(1.2, 0.12, 500, 120, 'lowpass', 0, 1);
        break;
      case 'bossShot':
        this.tone(320, 0.12, 'square', 0.05, 150);
        break;
      case 'dashBoss':
        this.hiss(0.6, 0.18, 300, 3000, 'bandpass', 0, 1);
        this.tone(90, 0.5, 'sawtooth', 0.1, 220);
        break;
      case 'charge':
        this.tone(110, 1.2, 'sawtooth', 0.07, 900, 0, 0.3);
        break;
      case 'laserBeam':
        this.tone(110, 2.4, 'sawtooth', 0.09, 100, 0, 0.05);
        this.tone(113, 2.4, 'sawtooth', 0.09, 104, 0, 0.05);
        this.hiss(2.4, 0.08, 2500, 1200, 'bandpass', 0, 1);
        break;
      case 'jackpot':
        this.arp([72, 76, 79, 84, 88], 0.07, 'triangle', 0.08, 0.25);
        break;
      case 'event':
        this.arp([67, 72, 76], 0.1, 'square', 0.05, 0.22);
        break;
      case 'build':
        this.hiss(0.08, 0.12, 3000, 800, 'bandpass', 0, 2);
        this.tone(300, 0.15, 'triangle', 0.08, 520, 0.03);
        this.tone(midi(84), 0.25, 'sine', 0.05, 0, 0.15);
        break;
      case 'upgrade':
        this.arp([72, 76, 79, 83, 86], 0.05, 'square', 0.04, 0.16);
        break;
      case 'sell':
        this.tone(800, 0.2, 'triangle', 0.06, 400);
        break;
      case 'expand':
        this.tone(60, 0.8, 'sine', 0.3, 35);
        this.arp([60, 64, 67, 72, 76, 79, 84], 0.07, 'triangle', 0.07, 0.3);
        break;
      case 'siren':
        for (let i = 0; i < 2; i++) {
          this.tone(520, 0.4, 'sawtooth', 0.05, 820, i * 0.8, 0.05);
          this.tone(820, 0.4, 'sawtooth', 0.05, 520, i * 0.8 + 0.4, 0.05);
        }
        break;
      case 'waveClear':
        this.arp([72, 76, 79, 84], 0.09, 'triangle', 0.08, 0.3);
        this.arp([60, 64, 67, 72], 0.09, 'square', 0.03, 0.3);
        break;
      case 'powerup':
        this.tone(400, 0.35, 'sine', 0.08, 1600);
        this.arp([84, 88, 91], 0.06, 'triangle', 0.05, 0.15);
        break;
      case 'hyper':
        this.tone(70, 2.2, 'sawtooth', 0.1, 1400, 0, 0.6);
        this.hiss(2.4, 0.16, 200, 6000, 'bandpass', 0, 1);
        break;
      case 'click':
        this.tone(1000, 0.03, 'square', 0.025);
        break;
      case 'gameover':
        this.arp([67, 63, 60, 55], 0.28, 'triangle', 0.09, 0.45);
        break;
      case 'sectorClear':
        this.arp([60, 64, 67, 72, 67, 72, 76, 79, 84], 0.09, 'square', 0.05, 0.25);
        break;
      case 'bossDie':
        this.hiss(2.2, 0.35, 2000, 60);
        this.tone(60, 2.0, 'sine', 0.4, 25);
        this.arp([72, 79, 84, 88, 91], 0.12, 'triangle', 0.07, 0.4);
        break;
      case 'vortex':
        this.tone(240, 0.7, 'sine', 0.1, 50);
        break;
    }
  }

  // ------------------------------------------------------------ music

  music(mode: MusicMode): void {
    this.wantMode = mode;
  }

  private schedule(): void {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    if (this.wantMode !== this.mode) {
      this.mode = this.wantMode;
      this.step = 0;
      this.nextT = c.currentTime + 0.1;
    }
    if (this.mode === 'none' || this.muted) {
      this.nextT = c.currentTime + 0.1;
      return;
    }
    const bpm = this.mode === 'boss' ? 132 : this.mode === 'battle' ? 118 : this.mode === 'victory' ? 110 : 92;
    const stepDur = 60 / bpm / 4;
    while (this.nextT < c.currentTime + 0.15) {
      if (!this.paused) this.playStep(this.step, this.nextT, stepDur);
      this.step = (this.step + 1) % 64;
      this.nextT += stepDur;
    }
  }

  /** One 16th-note step of the current groove at time t. */
  private playStep(step: number, t: number, sd: number): void {
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const minor = this.mode === 'boss';
    const prog = minor ? [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]]
      : this.mode === 'victory' ? [[48, 52, 55], [43, 47, 50], [45, 48, 52], [41, 45, 48]]
      : [[45, 48, 52], [41, 45, 48], [48, 52, 55], [43, 47, 50]];
    const chord = prog[bar];
    const calm = this.mode === 'calm' || this.mode === 'title';
    // pad on bar start
    if (s === 0) for (const n of chord) this.voice(midi(n + 12), sd * 16, calm ? 'triangle' : 'sawtooth', calm ? 0.05 : 0.025, t, 0.4, 1200);
    // arpeggio
    const arpEvery = calm ? 2 : 1;
    if (s % arpEvery === 0) {
      const idx = (s / arpEvery) % 4;
      const n = chord[idx % 3] + 24 + (idx === 3 ? 12 : 0);
      this.voice(midi(n), sd * 1.6, calm ? 'triangle' : 'square', calm ? 0.035 : 0.022, t, 0.005, calm ? 2400 : 3200);
    }
    if (calm) {
      if (s === 8 && this.mode === 'calm') this.voice(midi(chord[0] - 12), sd * 6, 'sine', 0.06, t, 0.01, 400);
      return;
    }
    // bass
    if (s % 2 === 0) this.voice(midi(chord[0] - 12 + (s % 8 === 6 ? 7 : 0)), sd * 1.8, 'sawtooth', 0.07, t, 0.005, 600);
    // drums
    if (s % 4 === 0) this.kick(t);
    if (s === 4 || s === 12) this.snare(t);
    if (s % 2 === 1 || this.mode === 'boss') this.hat(t, s % 4 === 2 ? 0.03 : 0.018);
  }

  private voice(freq: number, dur: number, type: OscillatorType, vol: number, t: number, attack: number, cutoff: number): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private kick(t: number): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + 0.25);
  }

  private snare(t: number): void {
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1500;
    const g = c.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    s.connect(f).connect(g).connect(this.musicBus);
    s.start(t, Math.random());
    s.stop(t + 0.2);
  }

  private hat(t: number, vol: number): void {
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    s.connect(f).connect(g).connect(this.musicBus);
    s.start(t, Math.random());
    s.stop(t + 0.06);
  }

  dispose(): void {
    if (this.timer !== null) clearInterval(this.timer);
  }
}
