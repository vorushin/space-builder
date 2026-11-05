import * as THREE from 'three';
import { BAL } from '../config/balance';
import type { Game } from '../game';
import { Rng } from '../logic/math';
import { crystalGeometry } from '../render/models';

const MAX = BAL.crystals.max;
/** seconds before an uncollected crystal starts floating home on its own */
const HOME_DRIFT_AFTER = 6;

export interface Magnet {
  x: number;
  z: number;
  r: number;
  /** pulling strength multiplier */
  k: number;
  /** what happens on pickup */
  onCollect: (value: number, x: number, z: number) => void;
}

/** Glowing crystal pieces: burst out, get pulled by magnets, collected. Instanced. */
export class Crystals {
  private x = new Float32Array(MAX);
  private z = new Float32Array(MAX);
  private y = new Float32Array(MAX);
  private vx = new Float32Array(MAX);
  private vz = new Float32Array(MAX);
  private vy = new Float32Array(MAX);
  private val = new Float32Array(MAX);
  private age = new Float32Array(MAX);
  private phase = new Float32Array(MAX);
  /** 0 = free, 1 = vacuumed to the station */
  private mode = new Uint8Array(MAX);
  count = 0;
  private mesh: THREE.InstancedMesh;
  private rng = new Rng(9);
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private e = new THREE.Euler();
  private gem = new THREE.Color(0x5cffd6).multiplyScalar(1.45);

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.InstancedMesh(crystalGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true }), MAX);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    for (let i = 0; i < MAX; i++) this.mesh.setColorAt(i, this.gem);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  /** Burst `n` crystals from (x, z). Each is worth the sector's value multiplier. */
  spawn(x: number, z: number, n: number, spread = 1, game?: Game): void {
    for (let k = 0; k < n; k++) {
      if (this.count >= MAX) {
        // too many on the field: bank the oldest straight away
        game?.addCrystals(1, x, z);
        continue;
      }
      const i = this.count++;
      const a = this.rng.range(0, Math.PI * 2);
      const sp = this.rng.range(3, 8);
      this.x[i] = x + Math.cos(a) * spread * 0.5;
      this.z[i] = z + Math.sin(a) * spread * 0.5;
      this.y[i] = 0.5;
      this.vx[i] = Math.cos(a) * sp;
      this.vz[i] = Math.sin(a) * sp;
      this.vy[i] = this.rng.range(2, 6);
      this.val[i] = 1;
      this.age[i] = 0;
      this.phase[i] = this.rng.range(0, 6.28);
      this.mode[i] = 0;
    }
  }

  /** Everything on the field streams to the station (wave cleared). */
  vacuum(): void {
    for (let i = 0; i < this.count; i++) this.mode[i] = 1;
  }

  clear(): void {
    this.count = 0;
    this.mesh.count = 0;
  }

  private remove(i: number): void {
    const l = --this.count;
    if (i === l) return;
    this.x[i] = this.x[l];
    this.z[i] = this.z[l];
    this.y[i] = this.y[l];
    this.vx[i] = this.vx[l];
    this.vz[i] = this.vz[l];
    this.vy[i] = this.vy[l];
    this.val[i] = this.val[l];
    this.age[i] = this.age[l];
    this.phase[i] = this.phase[l];
    this.mode[i] = this.mode[l];
  }

  update(dt: number, magnets: Magnet[], station: Magnet, time: number): void {
    for (let i = 0; i < this.count; ) {
      this.age[i] += dt;
      let magnet: Magnet | null = null;
      let k = 1;
      let max = 42;
      if (this.mode[i] === 1) {
        magnet = station;
        k = 3;
        max = 60;
      } else if (this.age[i] > 0.35) {
        for (const m of magnets) {
          const dx = m.x - this.x[i], dz = m.z - this.z[i];
          if (dx * dx + dz * dz < m.r * m.r) {
            magnet = m;
            k = m.k;
            break;
          }
        }
        // left alone for a while: drift slowly home to the station
        if (!magnet && this.age[i] > HOME_DRIFT_AFTER) {
          magnet = station;
          k = 0.3;
          max = 7;
        }
      }
      if (magnet) {
        // collected → slot i now holds the last crystal, process it next
        if (this.pull(i, magnet, dt, k, max)) continue;
      } else {
        const d = Math.exp(-2.2 * dt);
        this.vx[i] *= d;
        this.vz[i] *= d;
      }
      this.x[i] += this.vx[i] * dt;
      this.z[i] += this.vz[i] * dt;
      // little hop out of the rock, then float
      this.vy[i] -= 14 * dt;
      this.y[i] += this.vy[i] * dt;
      const floor = 0.45 + Math.sin(time * 2.5 + this.phase[i]) * 0.15;
      if (this.y[i] < floor) {
        this.y[i] = floor;
        this.vy[i] = 0;
      }
      i++;
    }
    // render
    for (let i = 0; i < this.count; i++) {
      this.e.set(0.3, time * 2.2 + this.phase[i], 0.2);
      this.q.setFromEuler(this.e);
      this.p.set(this.x[i], this.y[i], this.z[i]);
      const pop = Math.min(1, this.age[i] * 5);
      this.s.setScalar(pop * (1.3 + Math.sin(time * 6 + this.phase[i]) * 0.1));
      this.m4.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m4);
    }
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Accelerate crystal i toward magnet m; returns true if it got collected (and removed). */
  private pull(i: number, m: Magnet, dt: number, k: number, max: number): boolean {
    const dx = m.x - this.x[i], dz = m.z - this.z[i];
    const d = Math.hypot(dx, dz) || 0.001;
    const collect = Math.max(1.4, Math.min(3, m.r * 0.15));
    if (d < collect) {
      m.onCollect(this.val[i], this.x[i], this.z[i]);
      this.remove(i);
      return true;
    }
    const acc = (35 + 60 * (1 - Math.min(1, d / m.r))) * k;
    this.vx[i] += (dx / d) * acc * dt;
    this.vz[i] += (dz / d) * acc * dt;
    // keep it from orbiting forever: bleed the sideways velocity
    const along = (this.vx[i] * dx + this.vz[i] * dz) / d;
    const sx = this.vx[i] - (along * dx) / d, sz = this.vz[i] - (along * dz) / d;
    const bleed = Math.exp(-6 * dt);
    this.vx[i] = (along * dx) / d + sx * bleed;
    this.vz[i] = (along * dz) / d + sz * bleed;
    const sp = Math.hypot(this.vx[i], this.vz[i]);
    if (sp > max) {
      this.vx[i] *= max / sp;
      this.vz[i] *= max / sp;
    }
    return false;
  }
}
