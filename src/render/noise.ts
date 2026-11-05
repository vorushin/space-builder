/** Seeded 3D value noise + fbm, used for planet textures and asteroid shapes. */
export class Noise3 {
  private perm = new Uint8Array(512);
  private vals = new Float32Array(256);

  constructor(seed = 1) {
    let s = seed >>> 0 || 1;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    for (let i = 0; i < 256; i++) this.vals[i] = rnd();
  }

  private h(x: number, y: number, z: number): number {
    const P = this.perm;
    return this.vals[P[P[P[x & 255] + (y & 255)] + (z & 255)]];
  }

  /** Smooth value noise in [0, 1]. */
  get(x: number, y: number, z: number): number {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const l = (a: number, b: number, t: number) => a + (b - a) * t;
    const x00 = l(this.h(xi, yi, zi), this.h(xi + 1, yi, zi), u);
    const x10 = l(this.h(xi, yi + 1, zi), this.h(xi + 1, yi + 1, zi), u);
    const x01 = l(this.h(xi, yi, zi + 1), this.h(xi + 1, yi, zi + 1), u);
    const x11 = l(this.h(xi, yi + 1, zi + 1), this.h(xi + 1, yi + 1, zi + 1), u);
    return l(l(x00, x10, v), l(x01, x11, v), w);
  }

  fbm(x: number, y: number, z: number, octaves = 5): number {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.get(x * f, y * f, z * f) * amp;
      norm += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return sum / norm;
  }
}
