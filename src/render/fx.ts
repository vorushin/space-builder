import * as THREE from 'three';
import { Rng } from '../logic/math';
import type { Stage } from './stage';
import { glowTexture } from './textures';

const PARTICLES = 4000;
const DEBRIS = 600;
const SEGMENTS = 900;
const RINGS = 28;
const FLASHES = 24;
const TEXTS = 48;

const P_VS = `
attribute float size; attribute vec4 rgba;
uniform float uScale;
varying vec4 vC;
void main(){
  vC = rgba;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * uScale / max(0.5, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const P_FS = `
varying vec4 vC;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, d);
  gl_FragColor = vec4(vC.rgb * a * vC.a, 1.0);
}`;

interface Lightning {
  pts: THREE.Vector3[];
  color: THREE.Color;
  life: number;
  max: number;
  width: number;
}

interface FloatText {
  el: HTMLDivElement;
  x: number;
  y: number;
  z: number;
  life: number;
  max: number;
  active: boolean;
}

/** All the short-lived visual effects. Cheap: a handful of draw calls total. */
export class Fx {
  private rng = new Rng(4242);
  // particles
  private pPos = new Float32Array(PARTICLES * 3);
  private pVel = new Float32Array(PARTICLES * 3);
  private pCol = new Float32Array(PARTICLES * 4);
  private pBase = new Float32Array(PARTICLES * 3);
  private pSize = new Float32Array(PARTICLES);
  private pSize0 = new Float32Array(PARTICLES);
  private pLife = new Float32Array(PARTICLES);
  private pMax = new Float32Array(PARTICLES);
  private pDrag = new Float32Array(PARTICLES);
  private pNext = 0;
  private points: THREE.Points;
  private pMat: THREE.ShaderMaterial;
  // debris
  private debris: THREE.InstancedMesh;
  private dPos = new Float32Array(DEBRIS * 3);
  private dVel = new Float32Array(DEBRIS * 3);
  private dRot = new Float32Array(DEBRIS * 3);
  private dSpin = new Float32Array(DEBRIS * 3);
  private dLife = new Float32Array(DEBRIS);
  private dMax = new Float32Array(DEBRIS);
  private dScale = new Float32Array(DEBRIS);
  private dCol = new Float32Array(DEBRIS * 3);
  private dNext = 0;
  // segments (lightning, beams)
  private seg: THREE.InstancedMesh;
  private segCount = 0;
  private lightning: Lightning[] = [];
  // rings & flashes
  private rings: { m: THREE.Mesh; life: number; max: number; r0: number; r1: number; mat: THREE.MeshBasicMaterial }[] = [];
  private flashes: { s: THREE.Sprite; life: number; max: number; size: number }[] = [];
  // texts
  private texts: FloatText[] = [];
  private textLayer: HTMLDivElement;
  private screenFlash: HTMLDivElement;
  private screenFlashA = 0;

  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private s3 = new THREE.Vector3();
  private col = new THREE.Color();
  private up = new THREE.Vector3(1, 0, 0);

  constructor(private scene: THREE.Scene, private stage: Stage, uiRoot: HTMLElement) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('rgba', new THREE.BufferAttribute(this.pCol, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.pSize, 1).setUsage(THREE.DynamicDrawUsage));
    this.pMat = new THREE.ShaderMaterial({
      vertexShader: P_VS,
      fragmentShader: P_FS,
      uniforms: { uScale: { value: 400 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.pMat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);

    this.debris = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.28, 0),
      new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.85, metalness: 0.1 }),
      DEBRIS,
    );
    this.debris.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(DEBRIS * 3), 3);
    this.debris.count = 0;
    this.debris.frustumCulled = false;
    scene.add(this.debris);

    this.seg = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), SEGMENTS);
    this.seg.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SEGMENTS * 3), 3);
    this.seg.count = 0;
    this.seg.frustumCulled = false;
    scene.add(this.seg);

    const ringGeo = new THREE.RingGeometry(0.82, 1, 56).rotateX(-Math.PI / 2);
    for (let i = 0; i < RINGS; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const m = new THREE.Mesh(ringGeo, mat);
      m.visible = false;
      scene.add(m);
      this.rings.push({ m, life: 0, max: 1, r0: 0, r1: 1, mat });
    }
    for (let i = 0; i < FLASHES; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.visible = false;
      scene.add(s);
      this.flashes.push({ s, life: 0, max: 1, size: 1 });
    }

    this.textLayer = document.createElement('div');
    this.textLayer.className = 'fx-texts';
    uiRoot.appendChild(this.textLayer);
    for (let i = 0; i < TEXTS; i++) {
      const el = document.createElement('div');
      el.className = 'fx-text';
      el.style.display = 'none';
      this.textLayer.appendChild(el);
      this.texts.push({ el, x: 0, y: 0, z: 0, life: 0, max: 1, active: false });
    }
    this.screenFlash = document.createElement('div');
    this.screenFlash.className = 'screen-flash';
    uiRoot.appendChild(this.screenFlash);
  }

  // ------------------------------------------------------------ spawners

  /** One glowing particle. Colours are HDR-ish: `power` > 1 blooms. */
  particle(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: number, size: number, life: number, power = 2, drag = 2.5): void {
    const i = this.pNext;
    this.pNext = (this.pNext + 1) % PARTICLES;
    this.pPos[i * 3] = x;
    this.pPos[i * 3 + 1] = y;
    this.pPos[i * 3 + 2] = z;
    this.pVel[i * 3] = vx;
    this.pVel[i * 3 + 1] = vy;
    this.pVel[i * 3 + 2] = vz;
    this.col.set(color);
    this.pBase[i * 3] = this.col.r * power;
    this.pBase[i * 3 + 1] = this.col.g * power;
    this.pBase[i * 3 + 2] = this.col.b * power;
    this.pSize0[i] = size;
    this.pLife[i] = life;
    this.pMax[i] = life;
    this.pDrag[i] = drag;
  }

  sparks(x: number, z: number, color: number, n: number, speed = 12, size = 0.5, y = 0.3, life = 0.45): void {
    const r = this.rng;
    for (let k = 0; k < n; k++) {
      const a = r.range(0, Math.PI * 2);
      const s = speed * r.range(0.3, 1);
      this.particle(x, y, z, Math.cos(a) * s, r.range(-0.3, 1) * s * 0.4, Math.sin(a) * s, color, size * r.range(0.6, 1.2), life * r.range(0.6, 1.2), 2.4, 3.2);
    }
  }

  /** Directional spray (bullet impacts). */
  spray(x: number, z: number, angle: number, color: number, n: number, speed = 10, spreadA = 0.8): void {
    const r = this.rng;
    for (let k = 0; k < n; k++) {
      const a = angle + r.range(-spreadA, spreadA);
      const s = speed * r.range(0.4, 1);
      this.particle(x, 0.3, z, Math.cos(a) * s, r.range(0, 0.4) * s, Math.sin(a) * s, color, r.range(0.3, 0.55), r.range(0.15, 0.35), 2.6, 4);
    }
  }

  debrisBurst(x: number, z: number, color: number, n: number, speed = 7, scale = 1): void {
    const r = this.rng;
    this.col.set(color);
    for (let k = 0; k < n; k++) {
      const i = this.dNext;
      this.dNext = (this.dNext + 1) % DEBRIS;
      const a = r.range(0, Math.PI * 2);
      const s = speed * r.range(0.3, 1);
      this.dPos.set([x + Math.cos(a) * 0.5 * scale, r.range(-0.3, 0.6), z + Math.sin(a) * 0.5 * scale], i * 3);
      this.dVel.set([Math.cos(a) * s, r.range(-0.5, 1) * s * 0.6, Math.sin(a) * s], i * 3);
      this.dRot.set([r.range(0, 6), r.range(0, 6), r.range(0, 6)], i * 3);
      this.dSpin.set([r.range(-8, 8), r.range(-8, 8), r.range(-8, 8)], i * 3);
      const life = r.range(0.7, 1.5);
      this.dLife[i] = life;
      this.dMax[i] = life;
      this.dScale[i] = scale * r.range(0.5, 1.4);
      const k2 = r.range(0.75, 1.15);
      this.dCol.set([this.col.r * k2, this.col.g * k2, this.col.b * k2], i * 3);
    }
  }

  ring(x: number, z: number, radius: number, color: number, life = 0.45, power = 2.2, r0 = 0.2, y = 0.15): void {
    const ring = this.rings.find((r) => r.life <= 0) ?? this.rings[0];
    ring.life = life;
    ring.max = life;
    ring.r0 = r0;
    ring.r1 = radius;
    ring.mat.color.set(color).multiplyScalar(power);
    ring.m.position.set(x, y, z);
    ring.m.visible = true;
  }

  flash(x: number, z: number, size: number, color: number, life = 0.25, y = 0.6, power = 2.5): void {
    const f = this.flashes.find((r) => r.life <= 0) ?? this.flashes[0];
    f.life = life;
    f.max = life;
    f.size = size;
    f.s.material.color.set(color).multiplyScalar(power);
    f.s.position.set(x, y, z);
    f.s.visible = true;
  }

  explosion(x: number, z: number, size: number, color: number, debrisColor = 0x555a60): void {
    this.flash(x, z, size * 3.2, 0xfff2d0, 0.16, 0.8, 1.8);
    this.flash(x, z, size * 2.6, color, 0.38, 0.6, 1.6);
    this.ring(x, z, size * 3.2, color, 0.5, 2.2);
    this.sparks(x, z, color, Math.min(70, 14 + size * 14), 9 + size * 4, 0.55 + size * 0.12, 0.4, 0.6);
    this.sparks(x, z, 0xfff2d0, Math.min(30, 6 + size * 6), 6 + size * 3, 0.4, 0.4, 0.35);
    if (debrisColor >= 0) this.debrisBurst(x, z, debrisColor, Math.min(24, 3 + Math.round(size * 4)), 4 + size * 2.5, 0.6 + size * 0.25);
  }

  /** Jagged lightning between two points (visible for `life` seconds). */
  zap(ax: number, az: number, bx: number, bz: number, color: number, life = 0.16, width = 0.12, y = 1.0): void {
    const pts: THREE.Vector3[] = [];
    const n = Math.max(4, Math.min(14, Math.round(Math.hypot(bx - ax, bz - az) / 1.4)));
    const nx = -(bz - az), nz = bx - ax;
    const nl = Math.hypot(nx, nz) || 1;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const j = i === 0 || i === n ? 0 : this.rng.range(-0.9, 0.9);
      pts.push(new THREE.Vector3(ax + (bx - ax) * t + (nx / nl) * j, y + this.rng.range(-0.3, 0.3) * (i % n ? 1 : 0), az + (bz - az) * t + (nz / nl) * j));
    }
    this.lightning.push({ pts, color: new THREE.Color(color).multiplyScalar(3), life, max: life, width });
  }

  /** A straight glowing segment for this frame only (beams, lasers). */
  segment(ax: number, ay: number, az: number, bx: number, by: number, bz: number, width: number, color: THREE.Color): void {
    if (this.segCount >= SEGMENTS) return;
    this.v1.set(ax, ay, az);
    this.v2.set(bx - ax, by - ay, bz - az);
    const len = this.v2.length();
    if (len < 1e-4) return;
    this.v2.divideScalar(len);
    this.q.setFromUnitVectors(this.up, this.v2);
    this.v1.addScaledVector(this.v2, len / 2);
    this.s3.set(len, width, width);
    this.m4.compose(this.v1, this.q, this.s3);
    this.seg.setMatrixAt(this.segCount, this.m4);
    this.seg.setColorAt(this.segCount, color);
    this.segCount++;
  }

  text(x: number, z: number, str: string, cls = '', life = 0.9, y = 1.5): void {
    const t = this.texts.find((q) => !q.active) ?? this.texts.reduce((a, b) => (a.life < b.life ? a : b));
    t.active = true;
    t.x = x;
    t.y = y;
    t.z = z;
    t.life = life;
    t.max = life;
    t.el.textContent = str;
    t.el.className = 'fx-text ' + cls;
    t.el.style.display = 'block';
  }

  screen(color: string, alpha: number): void {
    this.screenFlash.style.background = color;
    this.screenFlashA = Math.max(this.screenFlashA, alpha);
  }

  /** Remove everything (sector change). */
  clear(): void {
    this.pLife.fill(0);
    this.dLife.fill(0);
    this.lightning.length = 0;
    for (const r of this.rings) {
      r.life = 0;
      r.m.visible = false;
    }
    for (const f of this.flashes) {
      f.life = 0;
      f.s.visible = false;
    }
    for (const t of this.texts) {
      t.active = false;
      t.el.style.display = 'none';
    }
  }

  // ------------------------------------------------------------ update

  update(dt: number, realDt: number): void {
    // particles
    let alive = 0;
    for (let i = 0; i < PARTICLES; i++) {
      let life = this.pLife[i];
      if (life <= 0) {
        if (this.pSize[i] !== 0) {
          this.pSize[i] = 0;
          this.pCol[i * 4 + 3] = 0;
        }
        continue;
      }
      life -= dt;
      this.pLife[i] = life;
      alive++;
      const k = Math.exp(-this.pDrag[i] * dt);
      const vi = i * 3;
      this.pVel[vi] *= k;
      this.pVel[vi + 1] *= k;
      this.pVel[vi + 2] *= k;
      this.pPos[vi] += this.pVel[vi] * dt;
      this.pPos[vi + 1] += this.pVel[vi + 1] * dt;
      this.pPos[vi + 2] += this.pVel[vi + 2] * dt;
      const t = Math.max(0, life / this.pMax[i]);
      this.pSize[i] = this.pSize0[i] * (0.4 + 0.6 * t);
      this.pCol[i * 4] = this.pBase[vi];
      this.pCol[i * 4 + 1] = this.pBase[vi + 1];
      this.pCol[i * 4 + 2] = this.pBase[vi + 2];
      this.pCol[i * 4 + 3] = t * t;
    }
    const g = this.points.geometry;
    (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('rgba') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('size') as THREE.BufferAttribute).needsUpdate = true;
    const h = this.stage.height * this.stage.renderer.getPixelRatio();
    this.pMat.uniforms.uScale.value = h / (2 * Math.tan((this.stage.camera.fov * Math.PI) / 360));
    void alive;

    // debris
    let dc = 0;
    for (let i = 0; i < DEBRIS; i++) {
      if (this.dLife[i] <= 0) continue;
      this.dLife[i] -= dt;
      const vi = i * 3;
      const k = Math.exp(-1.2 * dt);
      for (let j = 0; j < 3; j++) {
        this.dVel[vi + j] *= k;
        this.dPos[vi + j] += this.dVel[vi + j] * dt;
        this.dRot[vi + j] += this.dSpin[vi + j] * dt;
      }
      const t = Math.max(0, this.dLife[i] / this.dMax[i]);
      const s = Math.max(0.03, this.dScale[i] * Math.min(1, t * 3));
      this.e.set(this.dRot[vi], this.dRot[vi + 1], this.dRot[vi + 2]);
      this.q.setFromEuler(this.e);
      this.v1.set(this.dPos[vi], this.dPos[vi + 1], this.dPos[vi + 2]);
      this.s3.setScalar(s);
      this.m4.compose(this.v1, this.q, this.s3);
      // live instances are packed at the front each frame
      this.debris.instanceColor!.setXYZ(dc, this.dCol[vi], this.dCol[vi + 1], this.dCol[vi + 2]);
      this.debris.setMatrixAt(dc, this.m4);
      dc++;
    }
    this.debris.count = dc;
    this.debris.instanceMatrix.needsUpdate = true;
    if (this.debris.instanceColor) this.debris.instanceColor.needsUpdate = true;

    // lightning → segments
    for (let i = this.lightning.length - 1; i >= 0; i--) {
      const L = this.lightning[i];
      L.life -= realDt;
      if (L.life <= 0) {
        this.lightning.splice(i, 1);
        continue;
      }
      const k = L.life / L.max;
      this.col.copy(L.color).multiplyScalar(0.4 + 0.6 * k);
      for (let j = 0; j < L.pts.length - 1; j++) {
        const a = L.pts[j], b = L.pts[j + 1];
        this.segment(a.x, a.y, a.z, b.x, b.y, b.z, L.width * (0.6 + k), this.col);
      }
    }
    this.seg.count = this.segCount;
    this.seg.instanceMatrix.needsUpdate = true;
    if (this.seg.instanceColor) this.seg.instanceColor.needsUpdate = true;
    this.segCount = 0; // next frame starts fresh; segments are immediate-mode

    // rings
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      if (r.life <= 0) {
        r.m.visible = false;
        continue;
      }
      const t = 1 - r.life / r.max;
      const e = 1 - (1 - t) * (1 - t);
      r.m.scale.setScalar(r.r0 + (r.r1 - r.r0) * e);
      r.mat.opacity = (1 - t) * 0.9;
    }
    // flashes
    for (const f of this.flashes) {
      if (f.life <= 0) continue;
      f.life -= dt;
      if (f.life <= 0) {
        f.s.visible = false;
        continue;
      }
      const t = 1 - f.life / f.max;
      f.s.scale.setScalar(f.size * (0.6 + 0.6 * t));
      f.s.material.opacity = 1 - t;
    }
    // floating texts (real time so they read during slow-mo)
    for (const t of this.texts) {
      if (!t.active) continue;
      t.life -= realDt;
      if (t.life <= 0) {
        t.active = false;
        t.el.style.display = 'none';
        continue;
      }
      const k = 1 - t.life / t.max;
      const p = this.stage.worldToScreen(t.x, t.y + k * 1.2, t.z);
      t.el.style.transform = `translate(-50%, -50%) translate(${p.x.toFixed(1)}px, ${(p.y - k * 30).toFixed(1)}px) scale(${(1 + Math.max(0, 0.25 - k) * 2).toFixed(2)})`;
      t.el.style.opacity = String(Math.min(1, (1 - k) * 2.5));
    }
    if (this.screenFlashA > 0) {
      this.screenFlashA = Math.max(0, this.screenFlashA - realDt * 2.2);
      this.screenFlash.style.opacity = String(this.screenFlashA);
    }
  }

  get scenePoints(): THREE.Points {
    return this.points;
  }

  dispose(): void {
    this.scene.remove(this.points, this.debris, this.seg);
  }
}
