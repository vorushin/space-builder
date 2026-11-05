import * as THREE from 'three';
import type { SectorLook } from '../config/sectors';
import { Rng } from '../logic/math';
import { Noise3 } from './noise';
import { glowTexture } from './textures';

interface Layer {
  obj: THREE.Object3D;
  /** how much the layer follows the camera (1 = infinitely far) */
  f: number;
}

const STAR_VS = `
attribute float size; attribute float phase; attribute vec3 color;
uniform float uPR; uniform float uTime;
varying vec3 vColor;
void main(){
  vColor = color * (0.72 + 0.28 * sin(uTime * (1.3 + phase * 0.4) + phase * 6.28));
  gl_PointSize = size * uPR;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const STAR_FS = `
varying vec3 vColor;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor * a * a, a);
}`;

const ATMO_VS = `
varying vec3 vN; varying vec3 vV;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const ATMO_FS = `
uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
void main(){
  float f = pow(1.0 - max(dot(vN, vV), 0.0), 2.6);
  gl_FragColor = vec4(uColor * f * 1.8, f);
}`;

/** Stars, nebula clouds, a big planet below the play plane, and hyperspace streaks. */
export class Background {
  private layers: Layer[] = [];
  private starMats: THREE.ShaderMaterial[] = [];
  private starGeoms: THREE.BufferGeometry[] = [];
  private nebulae: THREE.Sprite[] = [];
  private planetGroup = new THREE.Group();
  private tilt = new THREE.Group();
  private planet: THREE.Mesh;
  private clouds: THREE.Mesh;
  private atmo: THREE.Mesh;
  private halo: THREE.Sprite;
  private rings: THREE.Mesh;
  private sunGlow: THREE.Sprite;
  private warp: THREE.LineSegments;
  private warpPos: Float32Array;
  private time = 0;
  /** 0..1 hyperspace streak strength */
  warpAmount = 0;
  private texCache = new Map<string, { map: THREE.Texture; emissive: THREE.Texture | null; clouds: THREE.Texture | null }>();

  constructor(scene: THREE.Scene) {
    // --- stars: 3 parallax layers ---
    const specs = [
      { y: -520, f: 0.93, n: 2600, sx: 900, z0: -1500, z1: 500, s0: 1.2, s1: 2.8, bright: 0.9 },
      { y: -230, f: 0.78, n: 1400, sx: 520, z0: -800, z1: 300, s0: 1.6, s1: 3.4, bright: 1.1 },
      { y: -80, f: 0.4, n: 420, sx: 260, z0: -360, z1: 200, s0: 1.4, s1: 2.4, bright: 0.45 },
    ];
    const rng = new Rng(1234);
    for (const sp of specs) {
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array(sp.n * 3);
      const size = new Float32Array(sp.n);
      const phase = new Float32Array(sp.n);
      const col = new Float32Array(sp.n * 3);
      for (let i = 0; i < sp.n; i++) {
        pos[i * 3] = rng.range(-sp.sx, sp.sx);
        pos[i * 3 + 1] = sp.y + rng.range(-30, 30);
        pos[i * 3 + 2] = rng.range(sp.z0, sp.z1);
        const big = rng.chance(0.06);
        size[i] = big ? sp.s1 * 1.6 : rng.range(sp.s0, sp.s1);
        phase[i] = rng.next();
        const b = sp.bright * (big ? 2.4 : rng.range(0.5, 1.1));
        col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = b;
      }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('size', new THREE.BufferAttribute(size, 1));
      g.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const mat = new THREE.ShaderMaterial({
        vertexShader: STAR_VS,
        fragmentShader: STAR_FS,
        uniforms: { uPR: { value: 1 }, uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const pts = new THREE.Points(g, mat);
      pts.frustumCulled = false;
      pts.renderOrder = -20;
      scene.add(pts);
      this.layers.push({ obj: pts, f: sp.f });
      this.starMats.push(mat);
      this.starGeoms.push(g);
    }

    // --- nebula clouds ---
    const cloudTex = cloudTexture(77);
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.32 }),
      );
      s.position.set(rng.range(-520, 520), rng.range(-460, -300), rng.range(-1000, -150));
      s.scale.setScalar(rng.range(380, 720));
      s.material.rotation = rng.range(0, Math.PI * 2);
      s.renderOrder = -19;
      scene.add(s);
      this.nebulae.push(s);
      this.layers.push({ obj: s, f: 0.86 });
    }

    // --- planet ---
    const R = 115;
    this.planet = new THREE.Mesh(
      new THREE.SphereGeometry(R, 72, 48),
      new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 }),
    );
    this.clouds = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.012, 64, 40),
      new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, roughness: 1, color: 0xffffff }),
    );
    this.atmo = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.035, 64, 40),
      new THREE.ShaderMaterial({
        vertexShader: ATMO_VS,
        fragmentShader: ATMO_FS,
        uniforms: { uColor: { value: new THREE.Color(0x6fe8ff) } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35 }),
    );
    this.halo.scale.setScalar(R * 3.0);
    const ringTex = ringTexture();
    this.rings = new THREE.Mesh(
      new THREE.RingGeometry(R * 1.35, R * 2.15, 128, 1),
      new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.85 }),
    );
    this.rings.rotation.x = -Math.PI / 2;
    // tilt the planet so we see its equator, not its pole (the camera looks down at ~56°)
    this.tilt.rotation.set(-0.72, 0, 0.32);
    this.tilt.add(this.planet, this.clouds, this.rings);
    this.planetGroup.add(this.halo, this.tilt, this.atmo);
    this.planetGroup.position.set(250, -470, -520);
    this.planetGroup.renderOrder = -18;
    scene.add(this.planetGroup);
    this.layers.push({ obj: this.planetGroup, f: 0.88 });

    // --- distant sun glow ---
    this.sunGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }),
    );
    this.sunGlow.position.set(-620, -420, -1100);
    this.sunGlow.scale.setScalar(520);
    scene.add(this.sunGlow);
    this.layers.push({ obj: this.sunGlow, f: 0.95 });

    // --- hyperspace streaks: bright heads fading into long tails ---
    const n = 900;
    this.warpPos = new Float32Array(n * 6);
    const warpCol = new Float32Array(n * 6);
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.BufferAttribute(this.warpPos, 3));
    wg.setAttribute('color', new THREE.BufferAttribute(warpCol, 3));
    for (let i = 0; i < n; i++) {
      const x = rng.range(-360, 360), y = rng.range(-320, -10), z = rng.range(-760, 200);
      this.warpPos.set([x, y, z, x, y, z - 20], i * 6);
      const k = rng.range(0.6, 1.6);
      const tint = rng.chance(0.3) ? [1.0, 0.75, 1.6] : [0.75, 1.1, 1.7];
      warpCol.set([tint[0] * k * 2, tint[1] * k * 2, tint[2] * k * 2, 0, 0, 0], i * 6);
    }
    this.warp = new THREE.LineSegments(
      wg,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.warp.frustumCulled = false;
    scene.add(this.warp);
    this.layers.push({ obj: this.warp, f: 0.5 });
  }

  setLook(look: SectorLook, sectorIndex: number): void {
    // star tints
    const rng = new Rng(99 + sectorIndex);
    const tints = look.stars.map((c) => new THREE.Color(c));
    for (const g of this.starGeoms) {
      const col = g.getAttribute('color') as THREE.BufferAttribute;
      const size = g.getAttribute('size') as THREE.BufferAttribute;
      for (let i = 0; i < col.count; i++) {
        const t = rng.pick(tints);
        const b = 0.55 + (size.getX(i) / 4) * 0.9;
        col.setXYZ(i, t.r * b, t.g * b, t.b * b);
      }
      col.needsUpdate = true;
    }
    this.nebulae.forEach((s, i) => {
      s.material.color.set(look.nebula[i % look.nebula.length]);
      s.material.opacity = sectorIndex === 2 ? 0.5 : sectorIndex === 1 ? 0.22 : 0.34;
    });
    this.sunGlow.material.color.set(look.sun);

    // planet
    const p = look.planet;
    const key = `${p.kind}-${p.a}-${p.b}`;
    let tex = this.texCache.get(key);
    if (!tex) {
      tex = planetTextures(p.kind, p.a, p.b, p.c, 11 + sectorIndex);
      this.texCache.set(key, tex);
    }
    const pm = this.planet.material as THREE.MeshStandardMaterial;
    pm.map = tex.map;
    pm.emissiveMap = tex.emissive;
    pm.emissive.set(tex.emissive ? 0xffffff : 0x000000);
    pm.emissiveIntensity = tex.emissive ? 2.2 : 0;
    pm.needsUpdate = true;
    const cm = this.clouds.material as THREE.MeshStandardMaterial;
    cm.map = tex.clouds;
    cm.alphaMap = null;
    this.clouds.visible = !!tex.clouds;
    cm.needsUpdate = true;
    (this.atmo.material as THREE.ShaderMaterial).uniforms.uColor.value.set(p.atmosphere);
    this.halo.material.color.set(p.atmosphere);
    this.halo.material.opacity = p.kind === 'moon' ? 0.12 : 0.32;
    this.rings.visible = p.rings;
    (this.rings.material as THREE.MeshBasicMaterial).color.set(p.b);
    // each sector's planet sits in a slightly different spot
    const spots = [
      [330, -560, -640],
      [-340, -540, -660],
      [300, -600, -700],
      [-320, -560, -640],
    ];
    const s = spots[sectorIndex % spots.length];
    this.planetGroup.userData.base = new THREE.Vector3(s[0], s[1], s[2]);
    this.planet.rotation.set(0, sectorIndex * 1.7, 0);
  }

  update(dt: number, target: THREE.Vector3, pixelRatio: number): void {
    this.time += dt;
    for (const m of this.starMats) {
      m.uniforms.uTime.value = this.time;
      m.uniforms.uPR.value = pixelRatio;
    }
    for (const l of this.layers) {
      const base = (l.obj.userData.base ??= l.obj.position.clone()) as THREE.Vector3;
      l.obj.position.set(base.x + target.x * l.f, base.y, base.z + target.z * l.f);
    }
    this.planet.rotation.y += dt * 0.006;
    this.clouds.rotation.y += dt * 0.009;

    // hyperspace streaks rush toward the bottom of the screen
    const wm = this.warp.material as THREE.LineBasicMaterial;
    wm.opacity = this.warpAmount;
    this.warp.visible = this.warpAmount > 0.01;
    if (this.warp.visible) {
      const len = 10 + this.warpAmount * this.warpAmount * 260;
      const speed = 300 + this.warpAmount * 1800;
      const a = this.warpPos;
      for (let i = 0; i < a.length; i += 6) {
        let z = a[i + 2] + speed * dt;
        if (z > 260) z -= 1020;
        a[i + 2] = z;
        a[i + 5] = z - len;
      }
      (this.warp.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    }
  }
}

// ---------- procedural textures ----------

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function toTex(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function cloudTexture(seed: number): THREE.Texture {
  const N = 256;
  const [c, g] = canvas(N, N);
  const img = g.createImageData(N, N);
  const nz = new Noise3(seed);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = (x - N / 2) / (N / 2), dy = (y - N / 2) / (N / 2);
      const r = Math.sqrt(dx * dx + dy * dy);
      const fall = Math.max(0, 1 - r);
      const n = nz.fbm(x / 48, y / 48, 0.5, 5);
      const a = Math.max(0, (n - 0.38) * 2.2) * fall * fall;
      const i = (y * N + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.min(255, a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  return toTex(c);
}

function ringTexture(): THREE.Texture {
  const N = 512;
  const [c, g] = canvas(N, N);
  const rng = new Rng(5);
  const inner = (1.35 / 2.15) * (N / 2);
  for (let r = N / 2; r > inner; r -= 1) {
    const a = 0.15 + 0.6 * rng.next() * rng.next();
    const l = 70 + rng.int(0, 60);
    g.strokeStyle = `rgba(${l + 120},${l + 100},${l + 140},${a})`;
    g.beginPath();
    g.arc(N / 2, N / 2, r, 0, Math.PI * 2);
    g.stroke();
  }
  return toTex(c);
}

function mix(a: THREE.Color, b: THREE.Color, t: number, out: THREE.Color): THREE.Color {
  return out.copy(a).lerp(b, Math.max(0, Math.min(1, t)));
}

/** Equirectangular planet texture (+ emissive for lava, + clouds for the ocean world). */
function planetTextures(kind: string, ca: number, cb: number, cc: number, seed: number) {
  const W = 512, H = 256;
  const nz = new Noise3(seed);
  const A = new THREE.Color(ca), B = new THREE.Color(cb), C = new THREE.Color(cc);
  const [mc, mg] = canvas(W, H);
  const map = mg.createImageData(W, H);
  let emissive: THREE.Texture | null = null;
  let clouds: THREE.Texture | null = null;
  const [ec, eg] = canvas(W, H);
  const emi = eg.createImageData(W, H);
  const [cc2, cg] = canvas(W, H);
  const cld = cg.createImageData(W, H);
  const col = new THREE.Color();
  const tmp = new THREE.Color();
  const rng = new Rng(seed);
  const craters = Array.from({ length: 70 }, () => {
    const lon = rng.range(0, Math.PI * 2), lat = Math.asin(rng.range(-1, 1));
    return { x: Math.cos(lat) * Math.cos(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.sin(lon), r: rng.range(0.03, 0.16) };
  });
  const storm = { x: Math.cos(0.35) * Math.cos(1.2), y: Math.sin(0.35), z: Math.cos(0.35) * Math.sin(1.2) };

  for (let v = 0; v < H; v++) {
    const lat = (0.5 - v / H) * Math.PI;
    for (let u = 0; u < W; u++) {
      const lon = (u / W) * Math.PI * 2;
      const x = Math.cos(lat) * Math.cos(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.sin(lon);
      const i = (v * W + u) * 4;
      let er = 0, eg2 = 0, eb = 0;
      if (kind === 'ocean') {
        const n = nz.fbm(x * 2.1 + 3, y * 2.1, z * 2.1, 6);
        if (n > 0.53) {
          mix(B, tmp.set(0xc9b27a), (n - 0.53) * 5, col);
        } else {
          mix(A.clone().multiplyScalar(0.55), A, Math.max(0, (n - 0.3) * 4), col);
        }
        const ice = Math.abs(lat) + (nz.get(x * 6, y * 6, z * 6) - 0.5) * 0.25;
        if (ice > 1.22) col.copy(C);
        const cn = nz.fbm(x * 3 + 10, y * 5, z * 3, 5);
        const ca2 = Math.max(0, Math.min(1, (cn - 0.5) * 3.5));
        cld.data[i] = cld.data[i + 1] = cld.data[i + 2] = 255;
        cld.data[i + 3] = ca2 * 230;
      } else if (kind === 'moon') {
        const n = nz.fbm(x * 3, y * 3, z * 3, 6);
        mix(B, A, n * 1.4 - 0.2, col);
        for (const c of craters) {
          const d = Math.acos(Math.min(1, x * c.x + y * c.y + z * c.z));
          if (d < c.r * 1.15) {
            const t = d / c.r;
            if (t < 0.85) col.multiplyScalar(0.72 + t * 0.2);
            else if (t < 1.15) col.lerp(C, 0.35);
          }
        }
      } else if (kind === 'gas') {
        const turb = nz.fbm(x * 2.5, y * 2.5, z * 2.5, 5);
        const t = y * 7 + turb * 3.2;
        const band = 0.5 + 0.5 * Math.sin(t * 2.4);
        mix(A, B, band, col);
        if (Math.sin(t * 0.9) > 0.75) col.lerp(C, 0.6);
        const ds = Math.acos(Math.min(1, x * storm.x + y * storm.y + z * storm.z));
        if (ds < 0.28) col.lerp(tmp.set(0xffd8f0), (1 - ds / 0.28) * 0.7);
      } else {
        // lava
        const n = nz.fbm(x * 3, y * 3, z * 3, 6);
        mix(A, C, n, col);
        const ridge = 1 - Math.abs(nz.fbm(x * 4 + 7, y * 4, z * 4, 5) * 2 - 1);
        if (ridge > 0.86) {
          const g2 = (ridge - 0.86) / 0.14;
          col.lerp(B, g2);
          er = B.r * g2;
          eg2 = B.g * g2;
          eb = B.b * g2;
        }
      }
      map.data[i] = col.r * 255;
      map.data[i + 1] = col.g * 255;
      map.data[i + 2] = col.b * 255;
      map.data[i + 3] = 255;
      emi.data[i] = er * 255;
      emi.data[i + 1] = eg2 * 255;
      emi.data[i + 2] = eb * 255;
      emi.data[i + 3] = 255;
    }
  }
  mg.putImageData(map, 0, 0);
  if (kind === 'lava') {
    eg.putImageData(emi, 0, 0);
    emissive = toTex(ec);
  }
  if (kind === 'ocean') {
    cg.putImageData(cld, 0, 0);
    clouds = toTex(cc2);
  }
  return { map: toTex(mc), emissive, clouds };
}
