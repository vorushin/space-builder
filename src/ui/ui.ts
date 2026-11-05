import { BAL } from '../config/balance';
import { GUNS } from '../config/guns';
import { EXPANSIONS, MODULE_BY_KIND, MODULES, type ModuleKind } from '../config/modules';
import { SECTORS, type BossDef } from '../config/sectors';
import type { Game } from '../game';
import { expansionCost, gunUpgradeCost, moduleCost, sellValue, type Difficulty } from '../logic/economy';
import { moduleUnlocked, ringUnlocked } from '../logic/layout';
import { isTouch } from '../render/stage';
import type { Boss } from '../world/bosses';
import { MEDALS, type MedalDef } from '../config/medals';
import { PAINTS } from '../config/paints';
import { cleanName, NAME_MAX } from '../logic/profile';
import { Comms } from './comms';
import { Radar } from './radar';

const HINT_KEY = 'space-builder-3d.hints';

type BannerStyle = 'good' | 'bad' | 'gold' | 'info' | 'boss';
type ToastStyle = 'good' | 'bad' | 'gold' | 'info';

interface Hint {
  id: string;
  html: string;
  when: (g: Game) => boolean;
  done: (g: Game) => boolean;
}

const HINTS: Hint[] = [
  { id: 'move', html: 'Fly with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>. Aim with the mouse.', when: () => true, done: (g) => Math.hypot(g.ship.x, g.ship.z - 12) > 12 },
  { id: 'shoot', html: 'Hold the <b>left mouse button</b> to blast asteroids.', when: () => true, done: (g) => g.stats.rocks > 0 },
  { id: 'collect', html: 'Fly near the glowing crystals to grab them.', when: (g) => g.crystals.count > 0, done: (g) => g.stats.crystals >= 20 },
  { id: 'build', html: 'Press <kbd>2</kbd>, then click a glowing socket to build a turret.', when: (g) => g.bank >= 40, done: (g) => g.station.modules.size > 0 },
  { id: 'guns', html: 'Press <kbd>1</kbd> to upgrade your guns.', when: (g) => g.station.modules.size > 0 && g.bank >= (gunUpgradeCost(g.ship.gunTier) ?? 1e9), done: (g) => g.ship.gunTier >= 2 },
  { id: 'missile', html: '<b>Right-click</b> fires a homing missile!', when: (g) => g.director?.phase === 'wave', done: (g) => g.ship.missiles < g.ship.missilesMax },
  { id: 'dash', html: '<kbd>Space</kbd> dashes. Zoom through enemy bullets!', when: (g) => g.director?.phase === 'wave' && (g.director?.wave ?? 0) >= 1, done: (g) => g.ship.dashCd > 0 },
  { id: 'call', html: 'Ready? Press <kbd>N</kbd> to start the next wave early for bonus crystals.', when: (g) => g.director?.phase === 'calm' && (g.director?.wave ?? 0) >= 2, done: (g) => g.director?.phase !== 'calm' },
];

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (html) el.innerHTML = html;
  return el;
};

/** A button that fires on pointerdown and never keeps keyboard focus (so Space never re-presses it). */
function tap(el: HTMLElement, fn: () => void): void {
  el.tabIndex = -1;
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // only the primary button: a right-click "cancel" over a popup must not sell things
    if (e.button !== 0) return;
    fn();
  });
}

/** Menu buttons: normal clicks with visible focus (keyboard friendly). */
function click(el: HTMLElement, fn: () => void): void {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    fn();
    (document.activeElement as HTMLElement | null)?.blur();
  });
}

interface CardRefs {
  el: HTMLDivElement;
  name: HTMLDivElement;
  cost: HTMLDivElement;
  icon: HTMLDivElement;
  state: string;
  wasPoor: boolean;
}

export class UI {
  private game!: Game;
  private hud = h('div', 'hud hidden');
  private hull = h('div', 'bar hull', '<i></i>');
  private hullTxt = h('b');
  private gunName = h('div', 'gun-name');
  private pips = h('div', 'pips');
  private dash = h('div', 'dash', 'Dash');
  private power = h('div', 'power-chip');
  private sectorName = h('div', 'sector-name');
  private waves = h('div', 'waves');
  private nextWave = h('div', 'next-wave');
  private bankNum = h('div', 'bank-num', '0');
  private stationBar = h('div', 'bar station', '<i></i>');
  private stationTxt = h('b');
  private shieldBar = h('div', 'bar shield', '<i></i>');
  private buildbar = h('div', 'buildbar');
  private cards = new Map<string, CardRefs>();
  private bannerEl = h('div', 'banner');
  private bannerQ: { title: string; sub: string; style: BannerStyle; dur: number }[] = [];
  private bannerT = 0;
  private bannerShown = 0;
  private toasts = h('div', 'toasts');
  private hintEl = h('div', 'hint');
  private hintId: string | null = null;
  private hintsDone = new Set<string>();
  private hintCooldown = 2;
  private bossbar = h('div', 'bossbar', '<div class="bname"></div><div class="bar"><i></i></div>');
  private indLayer = h('div', 'indicators');
  private inds: HTMLDivElement[] = [];
  private incoming: { el: HTMLDivElement; dir: number; t: number }[] = [];
  private popup = h('div', 'popup panel');
  private popupSocket = -1;
  private buildHelp = h('div', 'build-help panel');
  private sectorCardEl = h('div', 'sector-card');
  private sectorCardT = 0;
  private screens: Record<string, HTMLDivElement> = {};
  private devEl = h('div', 'dev');
  private last: Record<string, string | number> = {};
  private bankPopT = 0;
  private diff: Difficulty = 'normal';
  private stationHurtT = 0;
  private helpFrom: 'title' | 'pause' = 'title';
  private fpsT = 0;
  private frames = 0;
  private fps = 0;
  readonly comms: Comms;
  readonly radar: Radar;
  private nova = h('div', 'nova', '<span>NOVA</span><div class="bar"><i></i></div><kbd>F</kbd>');
  private novaBtn = h('button', 'nova-btn', 'Fire!');
  private letterbox = h('div', 'letterbox');
  private bossCard = h('div', 'boss-card');
  private vignette = h('div', 'vignette');
  private p2Panel = h('div', 'panel p2-panel', '<div class="p2-head"><b>Player 2</b><span data-r="p2gun"></span></div><div class="bar hull"><i></i></div><div class="ammo"><span>Missiles</span><div class="pips" data-r="p2pips"></div></div>');
  private tags = [h('div', 'ship-tag p1', 'P1'), h('div', 'ship-tag p2', 'P2')];

  constructor(private root: HTMLElement) {
    try {
      for (const id of JSON.parse(localStorage.getItem(HINT_KEY) ?? '[]')) this.hintsDone.add(id);
    } catch {
      /* ignore */
    }
    this.buildHud();
    root.append(this.vignette, this.hud, this.letterbox, this.bossCard, this.bannerEl, this.toasts, this.sectorCardEl, this.devEl);
    this.comms = new Comms(root);
    this.radar = new Radar(this.hud);
    this.hud.append(this.p2Panel, ...this.tags);
    this.buildScreens();
    if (isTouch) document.body.classList.add('touch-mode');
  }

  bind(game: Game): void {
    this.game = game;
    const canvas = game.stage.renderer.domElement;
    canvas.addEventListener('pointerdown', (e) => {
      if (game.buildMode && e.button === 0 && e.pointerType !== 'touch') game.buildClick(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointerup', (e) => {
      if (game.buildMode && e.pointerType === 'touch') game.buildClick(e.clientX, e.clientY);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && game.mode === 'play' && !game.paused) game.setPaused(true);
    });
    window.addEventListener('blur', () => {
      // (not in ?dev: browser automation steals focus while testing)
      if (game.mode === 'play' && !game.paused && !game.dev) game.setPaused(true);
    });
    if (isTouch) this.buildTouch(game);
    game.pads.onChange = (n) => this.toast(n > 0 ? `🎮 Game controller connected (${n})` : 'Game controller unplugged', 'info');
  }

  // ================================================================ HUD construction

  private buildHud(): void {
    const ship = h('div', 'panel ship-panel');
    const hullLbl = h('div', 'bar-label', '<span>Ship</span>');
    hullLbl.append(this.hullTxt);
    const ammo = h('div', 'ammo', '<span>Missiles</span>');
    ammo.append(this.pips, this.dash);
    this.nova.append(this.novaBtn);
    tap(this.novaBtn, () => this.game.releaseNova());
    ship.append(this.gunName, hullLbl, this.hull, ammo, this.nova, this.power);

    const sector = h('div', 'panel sector-panel');
    sector.append(this.sectorName, this.waves, this.nextWave);

    const bank = h('div', 'panel bank-panel');
    const row = h('div', 'bank');
    row.append(h('div', 'gem'), this.bankNum);
    const stLbl = h('div', 'bar-label', '<span>Station</span>');
    stLbl.append(this.stationTxt);
    bank.append(row, stLbl, this.stationBar, this.shieldBar);

    // build cards
    const mk = (id: string, key: string, icon: string, color: string, fn: () => void, wide = false) => {
      const el = h('div', 'card' + (wide ? ' wide' : ''));
      el.style.setProperty('--c', color);
      const iconEl = h('div', 'icon', icon);
      const name = h('div', 'name');
      const cost = h('div', 'cost');
      el.append(h('div', 'key', key), iconEl, name, cost);
      tap(el, () => {
        el.classList.add('pressed');
        setTimeout(() => el.classList.remove('pressed'), 120);
        fn();
      });
      this.buildbar.append(el);
      this.cards.set(id, { el, name, cost, icon: iconEl, state: '', wasPoor: true });
    };
    mk('guns', '1', '🔥', '#5cffd6', () => this.game.upgradeGuns(), true);
    for (const m of MODULES) mk(m.kind, String(m.hotkey), m.icon, '#' + m.color.toString(16).padStart(6, '0'), () => this.game.selectModule(m.kind));
    mk('expand', 'X', '🏗️', '#c8d2dc', () => this.game.expandStation(), true);
    const build = h('div', 'card build-btn');
    build.append(h('div', 'key', 'B'), h('div', 'icon', '🔧'), h('div', 'name', 'Build mode'));
    tap(build, () => this.game.setBuild(!this.game.buildMode));
    this.buildbar.append(build);

    this.bossbar.querySelector('.bar')!.classList.add('boss');
    this.buildHelp.innerHTML = '';
    this.indLayer.innerHTML = '';
    for (let i = 0; i < 18; i++) {
      const d = h('div', 'ind', '<i></i><span></span>');
      d.style.display = 'none';
      this.indLayer.append(d);
      this.inds.push(d);
    }
    this.popup.style.display = 'none';
    this.hud.append(this.indLayer, ship, sector, bank, this.bossbar, this.hintEl, this.buildHelp, this.buildbar, this.popup);
  }

  private buildScreens(): void {
    const mk = (id: string, dim = true) => {
      const s = h('div', 'screen' + (dim ? ' dim' : ''));
      this.screens[id] = s;
      this.root.append(s);
      return s;
    };
    // title
    const title = mk('title', false);
    title.innerHTML = `
      <div class="title-wrap">
        <h1 class="logo">SPACE BUILDER<small>3D</small></h1>
        <p class="tagline">Mine asteroids, build a giant space station, and stop the alien fleet in four sectors of space.</p>
        <div class="hangar">
          <label>Your name <input data-r="name" maxlength="${NAME_MAX}" placeholder="Commander" autocomplete="off" spellcheck="false" /></label>
          <label>Ship paint <span class="swatches" data-r="swatches"></span></label>
        </div>
        <div class="menu">
          <div class="diff"><button data-d="easy">Easy</button><button data-d="normal" class="on">Normal</button><span class="sep"></span><button data-p="1" class="on">1 player</button><button data-p="2">2 players</button></div>
          <div class="p2-help" data-r="p2help">Player 2: arrow keys to fly (it aims and shoots by itself), Right Shift dash, Enter missile, / NOVA. Or plug in a game controller.</div>
          <button class="btn primary" data-a="new">New game</button>
          <button class="btn" data-a="continue">Continue</button>
          <div class="row-btns"><button class="btn" data-a="help" style="--c:#7c8db0">How to play</button><button class="btn" data-a="medals" style="--c:#b7791f">Medals</button></div>
        </div>
        <div class="best" data-r="best"></div>
        <div class="links"><a href="classic/index.html" target="_self">Play the classic 2D version</a></div>
      </div>`;
    title.querySelectorAll<HTMLButtonElement>('.diff button[data-d]').forEach((b) =>
      click(b, () => {
        this.diff = b.dataset.d as Difficulty;
        title.querySelectorAll('.diff button[data-d]').forEach((x) => x.classList.toggle('on', x === b));
      }),
    );
    title.querySelectorAll<HTMLButtonElement>('.diff button[data-p]').forEach((b) =>
      click(b, () => {
        this.game.profile.players = b.dataset.p === '2' ? 2 : 1;
        this.game.saveProfile();
        this.syncPlayers();
      }),
    );
    click(title.querySelector('[data-a=new]')!, () => this.game.newGame(this.diff));
    click(title.querySelector('[data-a=continue]')!, () => {
      const cp = this.game.loadCheckpoint();
      if (cp) {
        this.game.startFromCheckpoint(cp);
        this.game.sectorIntro();
      }
    });
    click(title.querySelector('[data-a=help]')!, () => this.showHelp('title'));
    click(title.querySelector('[data-a=medals]')!, () => this.showMedals());
    const nameIn = title.querySelector('[data-r=name]') as HTMLInputElement;
    nameIn.addEventListener('input', () => {
      this.game.profile.name = cleanName(nameIn.value);
      this.game.saveProfile();
    });
    nameIn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') nameIn.blur();
    });
    const sw = title.querySelector('[data-r=swatches]')!;
    for (const p of PAINTS) {
      const b = h('button', 'swatch');
      b.style.background = `linear-gradient(135deg, #${p.hull.toString(16).padStart(6, '0')} 55%, #${p.accent.toString(16).padStart(6, '0')} 55%)`;
      b.title = p.name;
      b.dataset.paint = p.id;
      click(b, () => {
        this.game.setPaint(p.id);
        sw.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('on', x === b));
      });
      sw.append(b);
    }

    // medals
    const medals = mk('medals');
    medals.innerHTML = `
      <div class="panel card-screen" style="max-width:760px">
        <h2 data-r="mtitle">Medals</h2>
        <div class="medal-grid" data-r="grid"></div>
        <div class="row"><button class="btn small" data-a="back">Back</button></div>
      </div>`;
    click(medals.querySelector('[data-a=back]')!, () => {
      this.screens.medals.classList.remove('show');
      this.screens.title.classList.add('show');
    });

    // help
    const help = mk('help');
    help.innerHTML = `
      <div class="panel card-screen">
        <h2>How to play</h2>
        <div class="help-grid">
          <div><h4>Fly and fight</h4>
            <p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> fly</p>
            <p>Mouse to aim, hold the left button to shoot</p>
            <p>Right-click or <kbd>Q</kbd> fires a homing missile</p>
            <p><kbd>Space</kbd> dashes through bullets</p></div>
          <div><h4>Build</h4>
            <p>Shoot asteroids and grab the crystals</p>
            <p><kbd>1</kbd> upgrades your guns</p>
            <p><kbd>2</kbd>–<kbd>7</kbd> picks a module, then click a glowing socket</p>
            <p><kbd>B</kbd> build mode: click a module to upgrade or sell it</p>
            <p><kbd>X</kbd> makes the station bigger</p></div>
          <div><h4>Survive</h4>
            <p>Waves attack your station. Red arrows show where they come from.</p>
            <p>Wave 5 of every sector is a boss.</p>
            <p><kbd>N</kbd> calls the next wave early for bonus crystals</p>
            <p><kbd>P</kbd> pause, <kbd>M</kbd> sound</p>
            <p><kbd>F</kbd> NOVA when the purple bar is full</p></div>
        </div>
        <p class="help-coop">Two players: pick "2 players" on the title screen. Player 2 flies with the arrow keys (auto-aim, Right Shift dash, Enter missile, / NOVA) or a game controller (left stick fly, right stick aim and shoot, A dash, B missile, Y NOVA).</p>
        <div class="row"><button class="btn small" data-a="back">Got it</button></div>
      </div>`;
    click(help.querySelector('[data-a=back]')!, () => {
      this.screens.help.classList.remove('show');
      this.screens[this.helpFrom].classList.add('show');
    });

    // pause
    const pause = mk('pause');
    pause.innerHTML = `
      <div class="panel card-screen" style="max-width:420px">
        <h2>Paused</h2>
        <div class="menu">
          <button class="btn primary" data-a="resume">Resume</button>
          <button class="btn" data-a="help" style="--c:#7c8db0">How to play</button>
          <button class="btn" data-a="sound" style="--c:#7c8db0">Sound: on</button>
          <button class="btn" data-a="retry" style="--c:#b45309">Restart this sector</button>
          <button class="btn" data-a="quit" style="--c:#7f1d1d">Quit to title</button>
        </div>
      </div>`;
    click(pause.querySelector('[data-a=resume]')!, () => this.game.setPaused(false));
    click(pause.querySelector('[data-a=help]')!, () => this.showHelp('pause'));
    click(pause.querySelector('[data-a=sound]')!, () => {
      this.game.audio.toggleMute();
      this.syncSound();
    });
    click(pause.querySelector('[data-a=retry]')!, () => {
      this.game.paused = false;
      this.game.retrySector();
    });
    click(pause.querySelector('[data-a=quit]')!, () => this.game.toTitle());

    // game over
    const over = mk('over');
    over.innerHTML = `
      <div class="panel card-screen" style="max-width:480px;text-align:center">
        <h2>Station lost</h2>
        <p class="tagline" data-r="msg" style="margin-top:0"></p>
        <div class="menu">
          <button class="btn primary" data-a="retry">Try again</button>
          <button class="btn" data-a="title" style="--c:#7c8db0">Back to title</button>
        </div>
      </div>`;
    click(over.querySelector('[data-a=retry]')!, () => this.game.retrySector());
    click(over.querySelector('[data-a=title]')!, () => this.game.toTitle());

    // victory
    const win = mk('victory');
    win.innerHTML = `
      <div class="panel card-screen" style="text-align:center">
        <h2>You saved the galaxy!</h2>
        <p class="tagline" style="margin-top:0">Xenarch Prime is defeated and your Mega Station rules all four sectors.</p>
        <div class="stats" data-r="stats"></div>
        <div class="menu">
          <button class="btn primary" data-a="endless">Keep playing: endless waves</button>
          <button class="btn" data-a="title" style="--c:#7c8db0">Back to title</button>
        </div>
      </div>`;
    click(win.querySelector('[data-a=endless]')!, () => {
      win.classList.remove('show');
      this.game.startEndless();
    });
    click(win.querySelector('[data-a=title]')!, () => this.game.toTitle());
  }

  private buildTouch(game: Game): void {
    const t = h('div', 'touch-ui');
    const zone = h('div', 'stick-zone');
    const stick = h('div', 'stick', '<i></i>');
    const knob = stick.querySelector('i') as HTMLElement;
    zone.append(stick);
    let id = -1, ox = 0, oy = 0;
    zone.addEventListener('pointerdown', (e) => {
      id = e.pointerId;
      ox = e.clientX;
      oy = e.clientY;
      stick.style.display = 'block';
      stick.style.left = ox + 'px';
      stick.style.top = oy - zone.getBoundingClientRect().top + 'px';
      game.input.touchActive = true;
      zone.setPointerCapture(e.pointerId);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - ox, dy = e.clientY - oy;
      const l = Math.min(50, Math.hypot(dx, dy));
      const a = Math.atan2(dy, dx);
      knob.style.transform = `translate(${Math.cos(a) * l}px, ${Math.sin(a) * l}px)`;
      game.input.stick = { x: (Math.cos(a) * l) / 50, z: (Math.sin(a) * l) / 50 };
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      stick.style.display = 'none';
      knob.style.transform = '';
      game.input.stick = { x: 0, z: 0 };
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    const missile = h('div', 'tbtn missile', '🚀');
    tap(missile, () => game.input.press('KeyQ'));
    const dash = h('div', 'tbtn dashb', '💨');
    tap(dash, () => game.input.press('Space'));
    const novaB = h('div', 'tbtn novab', '💥');
    tap(novaB, () => game.releaseNova());
    t.append(zone, missile, dash, novaB);
    this.hud.prepend(t);
    game.input.touchActive = true;
  }

  // ================================================================ screens

  private hideScreens(): void {
    for (const s of Object.values(this.screens)) s.classList.remove('show');
  }

  showTitle(game: Game): void {
    this.hideScreens();
    this.hud.classList.add('hidden');
    this.closePopup();
    this.screens.title.classList.add('show');
    const cont = this.screens.title.querySelector('[data-a=continue]') as HTMLButtonElement;
    const cp = game.loadCheckpoint();
    cont.style.display = cp ? '' : 'none';
    if (cp) cont.innerHTML = `Continue<span class="sub">${cp.endless ? 'Endless mode' : `Sector ${cp.sector + 1}: ${SECTORS[cp.sector].name}`}</span>`;
    this.bossbar.classList.remove('show');
    document.body.classList.remove('building', 'cinematic', 'lowhp', 'nova-ready');
    this.comms.clear();
    const t = this.screens.title;
    (t.querySelector('[data-r=name]') as HTMLInputElement).value = game.profile.name;
    t.querySelectorAll<HTMLElement>('.swatch').forEach((x) => x.classList.toggle('on', x.dataset.paint === game.profile.paint));
    (t.querySelector('[data-a=medals]') as HTMLElement).textContent = `Medals ${game.profile.medals.length}/${MEDALS.length}`;
    this.syncPlayers();
    t.querySelector('[data-r=best]')!.textContent = game.profile.bestEndless > 0 ? `Best in Endless mode: wave ${game.profile.bestEndless}` : '';
  }

  private syncPlayers(): void {
    const t = this.screens.title;
    const two = this.game.profile.players === 2;
    t.querySelectorAll<HTMLElement>('.diff button[data-p]').forEach((x) => x.classList.toggle('on', (x.dataset.p === '2') === two));
    (t.querySelector('[data-r=p2help]') as HTMLElement).style.display = two ? 'block' : 'none';
  }

  private showMedals(): void {
    const p = this.game.profile;
    const scr = this.screens.medals;
    scr.querySelector('[data-r=mtitle]')!.textContent = `Medals ${p.medals.length} of ${MEDALS.length}`;
    scr.querySelector('[data-r=grid]')!.innerHTML = MEDALS.map((m) => {
      const got = p.medals.includes(m.id);
      return `<div class="medal${got ? ' got' : ''}"><div class="mi">${m.icon}</div><div><b>${got ? '✓ ' : ''}${m.name}</b><span>${m.desc}</span></div></div>`;
    }).join('');
    this.hideScreens();
    scr.classList.add('show');
  }

  medalToast(m: MedalDef): void {
    const t = h('div', 'medal-toast', `<div class="mi">${m.icon}</div><div><div class="mt">Medal earned!</div><div class="mn"></div></div>`);
    t.querySelector('.mn')!.textContent = m.name;
    this.root.append(t);
    setTimeout(() => t.remove(), 3500);
  }

  /** Boss entrance: letterbox bars + name card. */
  cinematic(on: boolean, def?: BossDef): void {
    document.body.classList.toggle('cinematic', on);
    if (on && def) {
      this.bossCard.innerHTML = `<div class="warn">⚠ Boss approaching ⚠</div><h1></h1><p></p>`;
      this.bossCard.querySelector('h1')!.textContent = def.name;
      this.bossCard.querySelector('p')!.textContent = def.title;
    }
  }

  private showHelp(from: 'title' | 'pause'): void {
    this.helpFrom = from;
    this.hideScreens();
    this.screens.help.classList.add('show');
  }

  enterPlay(game: Game): void {
    this.hideScreens();
    this.hud.classList.remove('hidden');
    this.bossbar.classList.remove('show');
    this.closePopup();
    this.last = {};
    for (const c of this.cards.values()) c.state = '';
    (document.activeElement as HTMLElement | null)?.blur();
    void game;
  }

  showPause(on: boolean, game: Game): void {
    this.hideScreens();
    if (on) {
      this.screens.pause.classList.add('show');
      this.syncSound();
    }
    void game;
  }

  private syncSound(): void {
    const b = this.screens.pause.querySelector('[data-a=sound]') as HTMLButtonElement;
    b.textContent = this.game.audio.muted ? 'Sound: off' : 'Sound: on';
  }

  showGameOver(game: Game): void {
    this.hideScreens();
    this.closePopup();
    const msg = this.screens.over.querySelector('[data-r=msg]')!;
    msg.textContent = game.endless
      ? `Your station held out for ${game.endlessLevel} endless waves.`
      : `Your station was destroyed in Sector ${game.sector + 1}. You keep everything you built before this sector started.`;
    (this.screens.over.querySelector('[data-a=retry]') as HTMLElement).textContent = game.endless ? 'Try endless again' : `Try Sector ${game.sector + 1} again`;
    this.screens.over.classList.add('show');
  }

  showVictory(game: Game): void {
    this.hideScreens();
    const s = game.stats;
    const min = Math.floor(s.time / 60);
    this.screens.victory.querySelector('[data-r=stats]')!.innerHTML = [
      [`${min} min`, 'Play time'],
      [s.kills, 'Enemies destroyed'],
      [Math.round(s.crystals).toLocaleString(), 'Crystals collected'],
      [s.bosses, 'Bosses defeated'],
      [s.modules, 'Modules built'],
      [s.rocks, 'Rocks smashed'],
    ]
      .map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`)
      .join('');
    this.screens.victory.classList.add('show');
  }

  // ================================================================ messages

  banner(title: string, sub: string, style: BannerStyle = 'info', dur = 2.2): void {
    if (this.bannerShown > 0 && this.bannerShown < 1.1 && this.bannerQ.length < 3) {
      this.bannerQ.push({ title, sub, style, dur });
      return;
    }
    this.showBanner(title, sub, style, dur);
  }

  private showBanner(title: string, sub: string, style: BannerStyle, dur: number): void {
    // one big message at a time: a banner replaces the sector title card
    this.sectorCardT = 0;
    this.sectorCardEl.classList.remove('show');
    this.bannerEl.className = 'banner ' + style;
    this.bannerEl.innerHTML = `<h1></h1><p></p>`;
    this.bannerEl.querySelector('h1')!.textContent = title;
    this.bannerEl.querySelector('p')!.textContent = sub;
    void this.bannerEl.offsetWidth;
    this.bannerEl.classList.add('show');
    this.bannerT = dur;
    this.bannerShown = 0.001;
  }

  toast(text: string, style: ToastStyle = 'info'): void {
    const t = h('div', 'toast ' + style);
    t.textContent = text;
    this.toasts.append(t);
    while (this.toasts.children.length > 4) this.toasts.firstChild?.remove();
    setTimeout(() => t.remove(), 2700);
  }

  bankPulse(): void {
    this.bankPopT = 0.1;
  }

  stationHurt(): void {
    this.stationHurtT = 0.25;
  }

  bossIntro(def: BossDef): void {
    this.bossbar.classList.add('show');
    (this.bossbar.querySelector('.bname') as HTMLElement).textContent = def.name;
  }

  bossBar(boss: Boss | null): void {
    if (!boss) {
      this.bossbar.classList.remove('show');
      return;
    }
    if (!this.bossbar.classList.contains('show')) {
      this.bossbar.classList.add('show');
      (this.bossbar.querySelector('.bname') as HTMLElement).textContent = boss.def.name;
    }
    const f = Math.max(0, boss.frac);
    if (this.last.boss !== f) {
      this.last.boss = f;
      (this.bossbar.querySelector('.bar > i') as HTMLElement).style.transform = `scaleX(${f})`;
    }
  }

  warning(game: Game, wave: number, boss: boolean, dirs: number[], duration: number, bossId?: string): void {
    const bossName = SECTORS.find((sec) => sec.boss.id === bossId)?.boss.name ?? game.def.boss.name;
    if (boss) this.banner('⚠ BOSS INCOMING ⚠', `${bossName} is coming!`, 'bad', duration);
    else this.banner(game.endless ? `WAVE ${game.endlessLevel + 1}` : `WAVE ${wave + 1} INCOMING`, dirs.length > 1 ? `From ${dirs.length} sides: follow the red arrows!` : 'Follow the red arrow!', 'bad', 2.4);
    for (const d of this.incoming) d.el.remove();
    this.radar.warn(dirs, duration + 4);
    this.incoming = dirs.map((dir) => {
      const el = h('div', 'incoming' + (boss ? ' boss' : ''), `<i></i><div>${boss ? 'BOSS' : 'Incoming'}</div>`);
      this.hud.append(el);
      return { el, dir, t: duration + 4 };
    });
  }

  clearIncoming(): void {
    for (const d of this.incoming) d.el.remove();
    this.incoming = [];
    this.radar.clearWarn();
  }

  sectorCard(game: Game): void {
    const s = game.sector;
    const def = SECTORS[s];
    const unlocks = [
      ...MODULES.filter((m) => m.unlockSector === s && s > 0).map((m) => `${m.icon} ${m.title}`),
      ...EXPANSIONS.filter((e) => e.unlockSector === s && e.ring > 0).map((e) => `🏗️ ${e.name}`),
    ];
    this.sectorCardEl.innerHTML = `<div class="num">${game.endless ? 'Endless mode' : `Sector ${s + 1} of 4`}</div><h1></h1><p></p>${unlocks.length ? `<div class="unlock">New to build: ${unlocks.join(', ')}</div>` : ''}`;
    this.sectorCardEl.querySelector('h1')!.textContent = def.name;
    this.sectorCardEl.querySelector('p')!.textContent = def.tagline;
    this.sectorCardEl.classList.add('show');
    this.sectorCardT = unlocks.length ? 5 : 3.5;
    for (const c of this.cards.values()) c.state = '';
  }

  hint(id: string): void {
    if (this.hintsDone.has(id)) return;
    this.hintsDone.add(id);
    try {
      localStorage.setItem(HINT_KEY, JSON.stringify([...this.hintsDone]));
    } catch {
      /* ignore */
    }
    if (this.hintId === id) {
      this.hintId = null;
      this.hintEl.classList.remove('show');
      this.hintCooldown = 1.5;
    }
  }

  // ================================================================ build mode & popups

  setBuildMode(on: boolean): void {
    document.body.classList.toggle('building', on);
    if (!on) this.closePopup();
    if (on) {
      this.sectorCardT = 0;
      this.sectorCardEl.classList.remove('show');
    }
  }

  closePopup(): void {
    this.popup.style.display = 'none';
    this.popupSocket = -1;
  }

  openSocket(game: Game, socketId: number): void {
    this.popupSocket = socketId;
    this.renderPopup(game);
    this.popup.style.display = 'block';
    game.audio.play('click');
  }

  private renderPopup(game: Game): void {
    const id = this.popupSocket;
    const m = game.station.modules.get(id);
    const p = this.popup;
    p.innerHTML = '';
    const close = () => this.closePopup();
    if (m) {
      const def = MODULE_BY_KIND[m.kind];
      const tier = def.tiers[m.tier - 1];
      p.append(h('h3', '', `${def.icon} ${tier.name}`), h('div', 'sub', `Level ${m.tier} of 3. ${def.blurb}`));
      if (m.tier < 3) {
        const next = def.tiers[m.tier];
        const cost = moduleCost(m.kind, m.tier + 1)!;
        const up = h('button', 'opt' + (game.bank < cost ? ' poor' : ''), `<span class="oi">⬆️</span><span class="on">Upgrade to ${next.name}</span><span class="oc">${cost} 💎</span>`);
        up.style.setProperty('--c', '#' + def.color.toString(16).padStart(6, '0'));
        tap(up, () => {
          game.upgradeModule(id);
          if (game.station.modules.get(id)) this.renderPopup(game);
        });
        p.append(up);
      }
      const sell = h('button', 'opt sell', `<span class="oi">♻️</span><span class="on">Sell</span><span class="oc">+${sellValue(m.kind, m.tier)} 💎</span>`);
      tap(sell, () => {
        game.sellModule(id);
        close();
      });
      p.append(sell);
    } else {
      p.append(h('h3', '', 'Empty socket'), h('div', 'sub', 'Pick a module to build here.'));
      for (const def of MODULES) {
        const unlocked = moduleUnlocked(def.kind, game.sector);
        const cost = moduleCost(def.kind, 1)!;
        const opt = h('button', 'opt' + (!unlocked ? ' locked' : game.bank < cost ? ' poor' : ''), `<span class="oi">${def.icon}</span><span class="on">${def.title}</span><span class="oc">${unlocked ? cost + ' 💎' : 'Sector ' + (def.unlockSector + 1)}</span>`);
        opt.style.setProperty('--c', '#' + def.color.toString(16).padStart(6, '0'));
        opt.title = def.blurb;
        tap(opt, () => {
          if (!unlocked) return;
          game.placing = def.kind;
          if (game.placeAt(id)) close();
          game.placing = null;
        });
        p.append(opt);
      }
    }
    this.last.popupBank = -1;
  }

  // ================================================================ per-frame update

  update(game: Game, frameDt: number): void {
    const dt = frameDt;
    this.frames++;
    this.fpsT += dt;
    // banners
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      this.bannerShown += dt;
      if (this.bannerT <= 0) {
        this.bannerEl.classList.remove('show');
        this.bannerShown = 0;
        const next = this.bannerQ.shift();
        if (next) this.showBanner(next.title, next.sub, next.style, next.dur);
      }
    } else if (this.bannerQ.length) {
      const next = this.bannerQ.shift()!;
      this.showBanner(next.title, next.sub, next.style, next.dur);
    }
    if (this.sectorCardT > 0) {
      this.sectorCardT -= dt;
      if (this.sectorCardT <= 0) this.sectorCardEl.classList.remove('show');
    }
    this.comms.update(dt);
    if (game.mode === 'title') return;

    this.radar.update(game, dt);
    this.updateShip(game);
    this.updateCoop(game);
    this.updateSector(game);
    this.updateBank(game, dt);
    this.updateCards(game);
    this.updateIndicators(game, dt);
    this.updateHints(game, dt);
    this.updatePopup(game);

    if (game.dev) {
      if (performance.now() - (this.last.fpsAt as number || 0) > 500) {
        const now = performance.now();
        this.fps = Math.round((this.frames * 1000) / Math.max(1, now - ((this.last.fpsAt as number) || now - 500)));
        this.frames = 0;
        this.last.fpsAt = now;
        const c = game.counts();
        this.devEl.textContent = `fps ${this.fps}  calls ${c.calls}\n${JSON.stringify(c)}\n8 +crystals  9 clear wave  0 next sector  - boss  = god`;
      }
    }
  }

  private set(key: string, v: string | number, fn: () => void): void {
    if (this.last[key] === v) return;
    this.last[key] = v;
    fn();
  }

  private updateShip(game: Game): void {
    const s = game.ship;
    const g = GUNS[s.gunTier - 1];
    this.set('gun', s.gunTier, () => {
      this.gunName.innerHTML = `<span></span><span class="lvl">Guns ${s.gunTier}/10</span>`;
      (this.gunName.firstChild as HTMLElement).textContent = g.name;
    });
    const hp = Math.max(0, Math.round(s.hp));
    this.set('hp', hp + (s.alive ? '' : 'x'), () => {
      (this.hull.firstChild as HTMLElement).style.transform = `scaleX(${hp / s.maxHp})`;
      this.hull.classList.toggle('low', hp / s.maxHp < 0.35);
      this.hullTxt.textContent = s.alive ? `${hp}` : 'respawning';
    });
    this.set('pips', s.missiles * 100 + s.missilesMax, () => {
      this.pips.innerHTML = Array.from({ length: s.missilesMax }, (_, i) => `<i class="${i < s.missiles ? 'on' : ''}"></i>`).join('');
    });
    this.set('dash', s.dashCd > 0 ? 1 : 0, () => this.dash.classList.toggle('cooling', s.dashCd > 0));
    const nv = Math.round(game.nova * 100);
    this.set('nova', nv, () => {
      (this.nova.querySelector('.bar > i') as HTMLElement).style.transform = `scaleX(${nv / 100})`;
      const ready = nv >= 100;
      this.nova.classList.toggle('ready', ready);
      document.body.classList.toggle('nova-ready', ready);
    });
    const low = s.alive && s.hp / s.maxHp < 0.35 && game.mode === 'play';
    this.set('lowhp', low ? 1 : 0, () => document.body.classList.toggle('lowhp', low));
    const pw = s.overdrive > 0 ? `Overdrive ${Math.ceil(s.overdrive)}` : s.bubble > 0 ? `Bubble ${Math.ceil(s.bubble)}` : '';
    this.set('pw', pw, () => {
      this.power.textContent = pw;
      this.power.className = 'power-chip' + (pw ? ' on' : '') + (s.bubble > 0 && s.overdrive <= 0 ? ' bubble' : '');
    });
  }

  /** Player 2's panel and the P1 / P2 tags floating over the ships. */
  private updateCoop(game: Game): void {
    const p2 = game.p2;
    this.set('coop', p2 ? 1 : 0, () => {
      this.p2Panel.style.display = p2 ? 'block' : 'none';
      for (const t of this.tags) t.style.display = p2 ? 'block' : 'none';
      document.body.classList.toggle('coop', !!p2);
    });
    if (!p2) return;
    const hp = Math.max(0, Math.round(p2.hp));
    this.set('p2hp', hp + (p2.alive ? '' : 'x'), () => {
      const bar = this.p2Panel.querySelector('.bar') as HTMLElement;
      (bar.firstChild as HTMLElement).style.transform = `scaleX(${hp / p2.maxHp})`;
      bar.classList.toggle('low', hp / p2.maxHp < 0.35);
      (this.p2Panel.querySelector('[data-r=p2gun]') as HTMLElement).textContent = p2.alive ? `${hp}` : 'respawning';
    });
    this.set('p2pips', p2.missiles * 100 + p2.missilesMax, () => {
      this.p2Panel.querySelector('[data-r=p2pips]')!.innerHTML = Array.from({ length: p2.missilesMax }, (_, i) => `<i class="${i < p2.missiles ? 'on' : ''}"></i>`).join('');
    });
    game.ships.forEach((s, i) => {
      const tag = this.tags[i];
      if (!s.alive) {
        tag.style.opacity = '0';
        return;
      }
      const p = game.project(s.x, s.z, 2.2);
      tag.style.opacity = '1';
      tag.style.transform = `translate(-50%, -100%) translate(${p.x.toFixed(0)}px, ${(p.y - 14).toFixed(0)}px)`;
    });
  }

  private updateSector(game: Game): void {
    const d = game.director;
    this.set('sector', game.sector + (game.endless ? 'e' : ''), () => {
      this.sectorName.textContent = game.endless ? `Endless · ${SECTORS[game.sector].name}` : `Sector ${game.sector + 1}: ${game.def.name}`;
    });
    if (!d) return;
    const total = game.endless ? 0 : d.waveCount;
    const wkey = `${d.wave}-${d.phase}-${total}`;
    this.set('waves', wkey, () => {
      if (game.endless) {
        this.waves.innerHTML = '';
        return;
      }
      let html = '';
      for (let i = 0; i < total; i++) {
        const done = i < d.wave || (i === d.wave && (d.phase === 'cleared' || d.phase === 'sectorClear'));
        const now = i === d.wave && (d.phase === 'wave' || d.phase === 'warning');
        html += `<i class="${i === total - 1 ? 'boss ' : ''}${done ? 'done' : now ? 'now' : ''}"></i>`;
      }
      this.waves.innerHTML = html;
    });
    let txt: string;
    if (game.mode === 'hyperspace') txt = 'hyper';
    else if (d.phase === 'calm') txt = 'calm' + Math.ceil(d.timer);
    else if (d.phase === 'warning') txt = 'warn';
    else if (d.phase === 'wave') txt = 'wave' + (game.enemiesAlive + d.pendingEnemies);
    else txt = d.phase;
    this.set('next', txt, () => {
      this.nextWave.className = 'next-wave';
      if (game.mode === 'hyperspace') this.nextWave.textContent = 'Hyperspace jump…';
      else if (d.phase === 'calm') {
        const n = game.endless ? `Wave ${game.endlessLevel + 1}` : d.wave === d.waveCount - 1 ? 'Boss' : `Wave ${d.wave + 1}`;
        this.nextWave.innerHTML = `<span>${n} in <b>${Math.ceil(d.timer)}s</b></span>`;
        const b = h('button', 'call-btn', 'Start now <kbd style="all:unset;font-family:var(--display)">N</kbd>');
        tap(b, () => game.callWave());
        this.nextWave.append(b);
      } else if (d.phase === 'warning') {
        this.nextWave.className = 'next-wave fight';
        this.nextWave.textContent = 'Get ready!';
      } else if (d.phase === 'wave') {
        this.nextWave.className = 'next-wave fight';
        this.nextWave.textContent = `Enemies left: ${game.enemiesAlive + d.pendingEnemies}`;
      } else this.nextWave.textContent = 'Wave cleared!';
    });
  }

  private updateBank(game: Game, dt: number): void {
    const b = Math.floor(game.bank);
    this.set('bank', b, () => (this.bankNum.textContent = b.toLocaleString()));
    if (this.bankPopT > 0) {
      this.bankPopT -= dt;
      this.bankNum.classList.add('pop');
    } else this.bankNum.classList.remove('pop');
    const st = game.station;
    const shp = Math.round(st.hp);
    this.set('st', shp + '/' + Math.round(st.maxHp), () => {
      (this.stationBar.firstChild as HTMLElement).style.transform = `scaleX(${st.hp / st.maxHp})`;
      this.stationTxt.textContent = `${shp} / ${Math.round(st.maxHp)}`;
    });
    const sh = st.shieldMax > 0 ? Math.round((st.shield / st.shieldMax) * 100) : -1;
    this.set('sh', sh, () => {
      this.shieldBar.style.display = sh < 0 ? 'none' : '';
      (this.shieldBar.firstChild as HTMLElement).style.transform = `scaleX(${Math.max(0, sh) / 100})`;
    });
    if (this.stationHurtT > 0) {
      this.stationHurtT -= dt;
      this.stationBar.style.outline = '2px solid rgba(255,90,110,0.9)';
    } else this.stationBar.style.outline = '';
  }

  private updateCards(game: Game): void {
    const bank = game.bank;
    const setCard = (id: string, name: string, cost: string, cls: string, icon?: string) => {
      const c = this.cards.get(id)!;
      const state = name + '|' + cost + '|' + cls + '|' + (icon ?? '');
      if (c.state === state) return;
      const poor = cls.includes('poor');
      const becameReady = c.wasPoor && !poor && !cls.includes('locked') && !cls.includes('max') && c.state !== '';
      c.state = state;
      c.wasPoor = poor || cls.includes('locked');
      c.name.textContent = name;
      c.cost.textContent = cost;
      if (icon) c.icon.textContent = icon;
      const wide = c.el.classList.contains('wide');
      c.el.className = 'card' + (wide ? ' wide' : '') + (cls ? ' ' + cls : '');
      if (becameReady) {
        c.el.classList.add('ready');
        setTimeout(() => c.el.classList.remove('ready'), 2900);
      }
    };
    const gc = gunUpgradeCost(game.ship.gunTier);
    if (gc === null) setCard('guns', 'Guns maxed', '★ MAX', 'max');
    else setCard('guns', GUNS[game.ship.gunTier].name, `💎 ${gc}`, bank < gc ? 'poor' : '');
    for (const m of MODULES) {
      const unlocked = moduleUnlocked(m.kind, game.sector);
      const cost = moduleCost(m.kind, 1)!;
      const active = game.placing === m.kind ? ' active' : '';
      if (!unlocked) setCard(m.kind, m.title, `🔒 Sector ${m.unlockSector + 1}`, 'locked');
      else setCard(m.kind, m.title, `💎 ${cost}`, (bank < cost ? 'poor' : '') + active);
    }
    const ring = game.station.rings;
    if (ring >= EXPANSIONS.length) setCard('expand', 'Mega Station', '★ MAX', 'max');
    else {
      const ex = EXPANSIONS[ring];
      const cost = expansionCost(ring)!;
      if (!ringUnlocked(ring, game.sector)) setCard('expand', ex.name, `🔒 Sector ${ex.unlockSector + 1}`, 'locked');
      else setCard('expand', ex.name, `💎 ${cost}`, bank < cost ? 'poor' : '');
    }
    this.set('bhelp', (game.buildMode ? 1 : 0) + (game.placing ?? ''), () => {
      this.buildHelp.innerHTML = game.placing
        ? `Click a glowing socket to build the ${MODULE_BY_KIND[game.placing as ModuleKind].title}. Right-click to cancel.`
        : 'Build mode: click a socket to build, upgrade or sell. <kbd style="font-family:var(--display)">B</kbd> to fly again.';
    });
  }

  private updatePopup(game: Game): void {
    if (this.popupSocket < 0) return;
    const s = game.station.sockets.find((q) => q.id === this.popupSocket);
    if (!s || !game.buildMode) {
      this.closePopup();
      return;
    }
    const p = game.project(s.x, s.z, 1.5);
    this.popup.style.left = `${Math.max(130, Math.min(window.innerWidth - 130, p.x))}px`;
    this.popup.style.top = `${Math.max(260, p.y)}px`;
    // re-render when affordability changes
    const key = Math.floor(game.bank) + ':' + (game.station.modules.get(this.popupSocket)?.tier ?? 0);
    if (this.last.popupBank !== key) {
      this.renderPopup(game);
      this.last.popupBank = key;
    }
  }

  private updateIndicators(game: Game, dt: number): void {
    const W = window.innerWidth, H = window.innerHeight;
    let used = 0;
    const tgt = game.stage.target;
    // the free play area: below the top panels, above the build bar
    const top = 120, bottom = H - 150, left = 40, right = W - 40;
    const ccx = (left + right) / 2, ccy = (top + bottom) / 2;
    const hw = (right - left) / 2, hh = (bottom - top) / 2;
    const place = (wx: number, wz: number, cls: string, label = '') => {
      if (used >= this.inds.length) return;
      const p = game.project(wx, wz);
      if (p.x > left && p.x < right && p.y > top && p.y < bottom) return;
      // direction on screen ≈ world delta from the camera target (screen right = +x, screen down = +z)
      const dx = wx - tgt.x, dz = wz - tgt.z;
      const a = Math.atan2(dz, dx);
      const ex = Math.cos(a), ey = Math.sin(a);
      const k = Math.min(Math.abs(hw / (ex || 1e-6)), Math.abs(hh / (ey || 1e-6)));
      const x = ccx + ex * k, y = ccy + ey * k;
      const el = this.inds[used++];
      if (el.dataset.cls !== cls) {
        el.className = 'ind ' + cls;
        el.dataset.cls = cls;
      }
      el.style.display = 'block';
      el.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
      const arrow = el.firstChild as HTMLElement;
      arrow.style.transform = `rotate(${a}rad)`;
      const span = el.lastChild as HTMLElement;
      if (span.textContent !== label) span.textContent = label;
    };
    if (game.mode === 'play') {
      if (game.station.alive) place(0, 0, 'station', 'Station');
      if (game.p2) for (const s of game.ships) if (s.alive) place(s.x, s.z, 'station', s.id === 0 ? 'P1' : 'P2');
      const b = game.events.beacon();
      if (b) place(b.x, b.z, 'gold', game.events.beaconLabel());
      for (const c of game.pickups.crates) place(c.x, c.z, 'gold', 'Supplies');
      if (game.boss?.alive) place(game.boss.x, game.boss.z, 'boss', game.boss.def.name);
      const s = game.ship;
      const list = game.enemies.filter((e) => e.alive).sort((a, b2) => (a.x - s.x) ** 2 + (a.z - s.z) ** 2 - ((b2.x - s.x) ** 2 + (b2.z - s.z) ** 2));
      for (const e of list.slice(0, 12)) place(e.x, e.z, 'enemy');
    }
    for (let i = used; i < this.inds.length; i++) if (this.inds[i].style.display !== 'none') this.inds[i].style.display = 'none';

    // incoming wave chevrons
    for (const inc of this.incoming) {
      inc.t -= dt;
      if (inc.t <= 0) {
        inc.el.remove();
        continue;
      }
      const wx = Math.cos(inc.dir) * BAL.arenaRadius, wz = Math.sin(inc.dir) * BAL.arenaRadius;
      const a = Math.atan2(wz - tgt.z, wx - tgt.x);
      const ex = Math.cos(a), ey = Math.sin(a);
      const k = Math.min(Math.abs((hw - 40) / (ex || 1e-6)), Math.abs((hh - 30) / (ey || 1e-6)));
      inc.el.style.transform = `translate(${(ccx + ex * k).toFixed(0)}px, ${(ccy + ey * k).toFixed(0)}px)`;
      (inc.el.firstChild as HTMLElement).style.transform = `rotate(${a + Math.PI}rad)`;
    }
    this.incoming = this.incoming.filter((i) => i.t > 0);
  }

  private updateHints(game: Game, dt: number): void {
    if (game.mode !== 'play' || game.sector > 0 || game.endless) {
      if (this.hintId) {
        this.hintEl.classList.remove('show');
        this.hintId = null;
      }
      return;
    }
    if (this.hintId) {
      const cur = HINTS.find((x) => x.id === this.hintId)!;
      if (cur.done(game)) this.hint(cur.id);
      return;
    }
    this.hintCooldown -= dt;
    if (this.hintCooldown > 0) return;
    for (const hnt of HINTS) {
      if (this.hintsDone.has(hnt.id)) continue;
      if (hnt.done(game)) {
        this.hint(hnt.id);
        continue;
      }
      if (!hnt.when(game)) continue;
      this.hintId = hnt.id;
      this.hintEl.innerHTML = hnt.html;
      this.hintEl.classList.add('show');
      break;
    }
  }
}
