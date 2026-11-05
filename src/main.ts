import './ui/style.css';
import { Audio } from './audio/sfx';
import { Game } from './game';
import { Input } from './input';
import { Background } from './render/background';
import { Stage } from './render/stage';
import { UI } from './ui/ui';

const app = document.getElementById('app')!;
const uiRoot = document.getElementById('ui')!;

const stage = new Stage(app);
const bg = new Background(stage.scene);
const ui = new UI(uiRoot);
const audio = new Audio();
const input = new Input(stage.renderer.domElement);
const game = new Game(stage, bg, ui, audio, input, uiRoot);
ui.bind(game);
game.toTitle();

declare global {
  interface Window {
    __game: Game;
  }
}
window.__game = game;

const params = new URLSearchParams(location.search);
const speed = game.dev ? Math.max(1, Math.min(8, Number(params.get('speed') ?? 1) || 1)) : 1;
let bot: { tick(g: Game, dt: number): void; log: string[] } | null = null;
if (game.dev && params.has('bot')) {
  void import('./dev/bot').then((m) => {
    bot = new m.Bot();
    (window as unknown as { __bot: unknown }).__bot = bot;
  });
}

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  for (let i = 0; i < speed; i++) {
    bot?.tick(game, dt);
    game.update(dt);
  }
  stage.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
