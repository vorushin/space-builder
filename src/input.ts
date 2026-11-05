import type { V2 } from './logic/math';

/** Keyboard + mouse (+ touch stick state written by the touch UI). Edges are cleared every frame. */
export class Input {
  private down = new Set<string>();
  private edges = new Set<string>();
  mouseX = 0;
  mouseY = 0;
  hasMouse = false;
  fireHeld = false;
  private leftArmed = false;
  private rightDown = false;
  /** touch: left stick vector (-1..1) and auto-fire */
  stick: V2 = { x: 0, z: 0 };
  touchActive = false;
  wheel = 0;
  /** set while the pointer is over HUD buttons, so clicks there don't shoot */
  overUi = false;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      // typing in a text field (the commander name) is not a game key
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!e.repeat) this.edges.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.reset());
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    // Mouse buttons are tracked from the `buttons` bitmask: a second button pressed while
    // another is held arrives as a pointermove (chorded buttons), not a pointerdown.
    const track = (e: PointerEvent, isDown: boolean) => {
      if (e.pointerType === 'touch') return;
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.hasMouse = true;
      const left = (e.buttons & 1) !== 0;
      const right = (e.buttons & 2) !== 0;
      // firing only starts from a press on the play field (not on HUD buttons)
      if (isDown && e.target === canvas && e.button === 0) this.leftArmed = true;
      if (!left) this.leftArmed = false;
      this.fireHeld = left && this.leftArmed;
      if (right && !this.rightDown && e.target === canvas) this.edges.add('Mouse2');
      this.rightDown = right;
    };
    window.addEventListener('pointermove', (e) => track(e, false));
    window.addEventListener('pointerdown', (e) => track(e, true));
    window.addEventListener('pointerup', (e) => track(e, false));
    canvas.addEventListener(
      'wheel',
      (e) => {
        this.wheel += Math.sign(e.deltaY);
        e.preventDefault();
      },
      { passive: false },
    );
  }

  reset(): void {
    this.down.clear();
    this.fireHeld = false;
    this.leftArmed = false;
    this.rightDown = false;
    this.stick = { x: 0, z: 0 };
  }

  /** Stop shooting until the next press on the play field (pause, build mode). */
  releaseFire(): void {
    this.fireHeld = false;
    this.leftArmed = false;
  }

  isDown(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  /** True once per key press. */
  pressed(...codes: string[]): boolean {
    let hit = false;
    for (const c of codes) if (this.edges.delete(c)) hit = true;
    return hit;
  }

  /** Synthesise a press (HUD buttons, touch buttons). */
  press(code: string): void {
    this.edges.add(code);
  }

  /** Movement direction on the plane (screen-relative: up = −Z). Length ≤ 1. */
  move(): V2 {
    let x = 0, z = 0;
    if (this.isDown('KeyW', 'ArrowUp')) z -= 1;
    if (this.isDown('KeyS', 'ArrowDown')) z += 1;
    if (this.isDown('KeyA', 'ArrowLeft')) x -= 1;
    if (this.isDown('KeyD', 'ArrowRight')) x += 1;
    x += this.stick.x;
    z += this.stick.z;
    const l = Math.hypot(x, z);
    return l > 1 ? { x: x / l, z: z / l } : { x, z };
  }

  endFrame(): void {
    this.edges.clear();
    this.wheel = 0;
  }

  get element(): HTMLCanvasElement {
    return this.canvas;
  }
}
