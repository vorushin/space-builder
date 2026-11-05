/**
 * Procedural low-poly models. Everything points its nose along +X and sits on the y = 0 plane.
 */
import * as THREE from 'three';
import type { ModuleKind } from '../config/modules';
import type { BossId, EnemyDef, SectorLook, Shape } from '../config/sectors';
import { Rng } from '../logic/math';
import { additive, glass, glow, hull } from './materials';
import { Noise3 } from './noise';

type G = THREE.BufferGeometry;

function M(geo: G, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** Extrude a polygon given in (x, z) into a flat slab of `depth` (centred on y = 0). */
function slab(points: [number, number][], depth: number): G {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.rotateX(Math.PI / 2);
  g.translate(0, depth / 2, 0);
  return g;
}

const mirror = (pts: [number, number][]): [number, number][] => pts.map(([x, z]) => [x, -z]);

/** A barrel along +X. */
function barrel(len: number, r: number, mat: THREE.Material): G {
  const g = new THREE.CylinderGeometry(r, r * 1.15, len, 6).rotateZ(-Math.PI / 2);
  g.translate(len / 2, 0, 0);
  void mat;
  return g;
}

export interface Rig {
  root: THREE.Group;
  /** child that banks / bobs */
  body: THREE.Group;
  /** per-instance hull materials that flash white on hit */
  mats: THREE.MeshStandardMaterial[];
  parts: Record<string, THREE.Object3D>;
}

function rig(): Rig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  return { root, body, mats: [], parts: {} };
}

function flashMat(r: Rig, color: number, metal = 0.35, rough = 0.5): THREE.MeshStandardMaterial {
  const m = hull(color, { unique: true, metal, rough });
  r.mats.push(m);
  return m;
}

// ---------------------------------------------------------------- ship

export interface ShipRig extends Rig {
  flames: THREE.Mesh[];
  guns: THREE.Group;
  bubble: THREE.Mesh;
}

export function makeShip(): ShipRig {
  const r = rig() as ShipRig;
  const white = flashMat(r, 0xe6edf5, 0.4, 0.45);
  const blue = hull(0x2f7dff, { metal: 0.5, rough: 0.4 });
  const dark = hull(0x2a3340, { metal: 0.6, rough: 0.5 });

  const fus = new THREE.ConeGeometry(0.46, 2.4, 6).rotateZ(-Math.PI / 2).scale(1, 0.6, 1);
  r.body.add(M(fus, white, 0.25, 0.05, 0));
  r.body.add(M(new THREE.BoxGeometry(0.85, 0.42, 0.95), dark, -0.85, 0, 0));
  const wing: [number, number][] = [[0.45, 0.22], [-0.75, 1.3], [-1.12, 1.3], [-0.9, 0.22]];
  r.body.add(M(slab(wing, 0.1), white, 0, -0.04, 0));
  r.body.add(M(slab(mirror(wing), 0.1), white, 0, -0.04, 0));
  const stripe: [number, number][] = [[0.05, 0.5], [-0.55, 1.1], [-0.72, 1.1], [-0.2, 0.5]];
  r.body.add(M(slab(stripe, 0.04), blue, 0, 0.04, 0));
  r.body.add(M(slab(mirror(stripe), 0.04), blue, 0, 0.04, 0));
  // tail fins
  const fin = new THREE.BoxGeometry(0.55, 0.45, 0.06);
  const f1 = M(fin, blue, -0.95, 0.3, 0.32);
  const f2 = M(fin, blue, -0.95, 0.3, -0.32);
  f1.rotation.x = -0.35;
  f2.rotation.x = 0.35;
  r.body.add(f1, f2);
  const canopy = new THREE.SphereGeometry(0.3, 12, 8).scale(1.6, 0.75, 0.85);
  r.body.add(M(canopy, glass(0x4fd8ff, 0.7), 0.35, 0.22, 0));

  r.flames = [];
  for (const z of [-0.3, 0.3]) {
    r.body.add(M(new THREE.CylinderGeometry(0.17, 0.21, 0.3, 8).rotateZ(Math.PI / 2), dark, -1.35, 0, z));
    const flameGeo = new THREE.ConeGeometry(0.17, 1, 8).rotateZ(Math.PI / 2);
    flameGeo.translate(-0.5, 0, 0);
    const fl = M(flameGeo, additive(0x6fe0ff, 2.6, 0.95), -1.5, 0, z);
    r.flames.push(fl);
    r.body.add(fl);
  }
  r.guns = new THREE.Group();
  r.body.add(r.guns);

  r.bubble = M(new THREE.SphereGeometry(2, 20, 14), additive(0x6fb7ff, 0.9, 0.35));
  r.bubble.visible = false;
  r.root.add(r.bubble);
  return r;
}

const POD_SPOTS: [number, number][][] = [
  [[1.05, 0]],
  [[1.05, 0]],
  [[0.1, 0.72], [0.1, -0.72]],
  [[1.05, 0], [0.1, 0.72], [0.1, -0.72]],
  [[1.05, 0], [0.1, 0.72], [0.1, -0.72]],
  [[1.05, 0], [0.1, 0.72], [0.1, -0.72], [-0.55, 1.18], [-0.55, -1.18]],
  [[1.05, 0], [0.1, 0.72], [0.1, -0.72], [-0.55, 1.18], [-0.55, -1.18]],
  [[1.05, 0], [0.1, 0.72], [0.1, -0.72], [-0.55, 1.18], [-0.55, -1.18]],
  [[1.05, 0], [0.1, 0.72], [0.1, -0.72], [-0.55, 1.18], [-0.55, -1.18], [0.45, 0.42], [0.45, -0.42]],
  [[1.05, 0], [0.1, 0.72], [0.1, -0.72], [-0.55, 1.18], [-0.55, -1.18], [0.45, 0.42], [0.45, -0.42]],
];

/** Rebuild the visible gun pods for a gun tier (1..10). */
export function setShipGuns(r: ShipRig, tier: number, color: number): void {
  r.guns.clear();
  const spots = POD_SPOTS[Math.max(0, Math.min(9, tier - 1))];
  const len = 0.5 + tier * 0.05;
  const metal = hull(0x3a4656, { metal: 0.7, rough: 0.35 });
  for (const [x, z] of spots) {
    r.guns.add(M(barrel(len, 0.07 + tier * 0.004, metal), metal, x - 0.1, -0.02, z));
    r.guns.add(M(new THREE.SphereGeometry(0.07 + tier * 0.006, 6, 4), glow(color, 2.2), x - 0.1 + len, -0.02, z));
  }
}

// ---------------------------------------------------------------- enemies

const darker = (c: number, k = 0.5) => new THREE.Color(c).multiplyScalar(k).getHex();

export function makeEnemy(def: EnemyDef): Rig {
  const r = rig();
  const main = flashMat(r, def.color, 0.35, 0.5);
  const dark = flashMat(r, darker(def.color, 0.38), 0.5, 0.5);
  const eye = glow(def.glow, 2.6);
  const b = r.body;
  const shape: Shape = def.shape;
  switch (shape) {
    case 'drone': {
      b.add(M(new THREE.IcosahedronGeometry(0.58, 0), main));
      const ring = M(new THREE.TorusGeometry(0.88, 0.11, 5, 14).rotateX(Math.PI / 2), dark);
      b.add(ring);
      r.parts.spin = ring;
      b.add(M(new THREE.SphereGeometry(0.22, 8, 6), eye, 0.52, 0.06, 0));
      b.add(M(new THREE.BoxGeometry(0.5, 0.08, 0.3), dark, -0.4, 0, 0.75), M(new THREE.BoxGeometry(0.5, 0.08, 0.3), dark, -0.4, 0, -0.75));
      break;
    }
    case 'dart': {
      b.add(M(new THREE.ConeGeometry(0.45, 2.0, 4).rotateZ(-Math.PI / 2).rotateX(Math.PI / 4).scale(1, 0.5, 1), main, 0.2, 0, 0));
      const w: [number, number][] = [[0.2, 0.1], [-0.95, 0.95], [-1.1, 0.88], [-0.7, 0.1]];
      b.add(M(slab(w, 0.08), dark), M(slab(mirror(w), 0.08), dark));
      b.add(M(new THREE.SphereGeometry(0.2, 8, 6), eye, -0.85, 0, 0));
      b.add(M(new THREE.BoxGeometry(0.4, 0.06, 0.12), eye, 0.35, 0.18, 0));
      break;
    }
    case 'raider': {
      b.add(M(new THREE.BoxGeometry(1.5, 0.55, 1.1), main));
      for (const s of [1, -1]) {
        const claw = M(new THREE.BoxGeometry(0.95, 0.24, 0.22), dark, 0.95, 0, 0.42 * s);
        claw.rotation.y = 0.32 * s;
        b.add(claw);
        b.add(M(new THREE.CylinderGeometry(0.26, 0.26, 0.95, 6).rotateZ(Math.PI / 2), dark, -0.2, 0, 0.78 * s));
        b.add(M(new THREE.SphereGeometry(0.15, 6, 4), eye, -0.75, 0, 0.78 * s));
      }
      b.add(M(new THREE.BoxGeometry(0.2, 0.1, 0.7), eye, 0.62, 0.3, 0));
      break;
    }
    case 'cruiser': {
      b.add(M(new THREE.BoxGeometry(1.9, 0.42, 0.72), main));
      b.add(M(new THREE.ConeGeometry(0.4, 0.8, 4).rotateZ(-Math.PI / 2).rotateX(Math.PI / 4).scale(1, 0.6, 1), main, 1.33, 0, 0));
      b.add(M(new THREE.BoxGeometry(0.45, 0.4, 0.38), dark, -0.35, 0.36, 0));
      b.add(M(new THREE.BoxGeometry(0.16, 0.08, 0.3), eye, -0.18, 0.5, 0));
      for (const s of [1, -1]) {
        b.add(M(new THREE.BoxGeometry(1.5, 0.28, 0.22), dark, -0.1, 0, 0.47 * s));
        const t = new THREE.Group();
        t.position.set(0.45, 0.28, 0.2 * s);
        t.add(M(new THREE.CylinderGeometry(0.14, 0.16, 0.14, 6), dark));
        t.add(M(barrel(0.38, 0.04, dark), dark, 0.05, 0.03, 0));
        b.add(t);
      }
      for (const z of [-0.22, 0, 0.22]) b.add(M(new THREE.SphereGeometry(0.11, 6, 4), eye, -0.98, 0, z));
      break;
    }
    case 'wraith': {
      const ghost = glass(def.color, 0.9);
      b.add(M(new THREE.OctahedronGeometry(0.7, 0).scale(1.8, 0.55, 0.9), ghost));
      for (const s of [1, -1]) {
        const sp = M(new THREE.ConeGeometry(0.16, 1.3, 4).rotateZ(Math.PI / 2), ghost, -0.6, 0, 0.55 * s);
        sp.rotation.y = 0.5 * s;
        b.add(sp);
      }
      b.add(M(new THREE.ConeGeometry(0.14, 1.1, 4).rotateZ(Math.PI / 2), ghost, -1.0, 0.2, 0));
      b.add(M(new THREE.SphereGeometry(0.26, 8, 6), glow(0xffffff, 2.2), 0.1, 0.05, 0));
      r.mats.push(...[]);
      break;
    }
    case 'stalker': {
      b.add(M(new THREE.CylinderGeometry(0.32, 0.48, 1.55, 6).rotateZ(-Math.PI / 2), main));
      const w: [number, number][] = [[-0.45, 0.2], [0.45, 1.12], [0.25, 1.25], [-0.75, 0.32]];
      b.add(M(slab(w, 0.08), dark), M(slab(mirror(w), 0.08), dark));
      for (const s of [1, -1]) b.add(M(barrel(0.5, 0.05, dark), dark, 0.35, 0, 1.15 * s));
      b.add(M(new THREE.SphereGeometry(0.24, 8, 6), eye, 0.1, 0.25, 0));
      b.add(M(new THREE.SphereGeometry(0.18, 6, 4), eye, -0.82, 0, 0));
      break;
    }
    case 'hunter': {
      const pts: [number, number][] = [[1.25, 0], [0.25, 0.5], [-0.35, 1.45], [-0.9, 1.3], [-0.65, 0.35], [-1.1, 0], [-0.65, -0.35], [-0.9, -1.3], [-0.35, -1.45], [0.25, -0.5]];
      b.add(M(slab(pts, 0.32), main));
      b.add(M(new THREE.ConeGeometry(0.35, 1.6, 4).rotateZ(-Math.PI / 2).scale(1, 0.5, 0.6), dark, 0.2, 0.22, 0));
      b.add(M(new THREE.BoxGeometry(0.12, 0.08, 0.9), eye, 0.7, 0.2, 0));
      for (const s of [1, -1]) b.add(M(new THREE.SphereGeometry(0.13, 6, 4), eye, -0.6, 0.1, 1.1 * s));
      break;
    }
    case 'scout': {
      b.add(M(new THREE.SphereGeometry(0.5, 10, 6).scale(1.8, 0.55, 0.8), main));
      for (let k = 0; k < 3; k++) {
        const f = M(new THREE.BoxGeometry(0.8, 0.05, 0.6), dark, -0.7, 0, 0);
        f.rotation.x = (k * Math.PI * 2) / 3;
        f.position.y = Math.cos(f.rotation.x) * 0.0;
        b.add(f);
      }
      b.add(M(new THREE.SphereGeometry(0.3, 8, 6).scale(1.6, 0.4, 0.8), eye, 0.05, -0.15, 0));
      b.add(M(new THREE.SphereGeometry(0.12, 6, 4), eye, 0.82, 0.05, 0));
      break;
    }
    case 'beetle': {
      b.add(M(new THREE.SphereGeometry(0.36, 8, 6).scale(1, 0.65, 1), main, 0.75, 0, 0));
      b.add(M(new THREE.SphereGeometry(0.5, 8, 6).scale(1, 0.6, 1), dark, 0.1, 0, 0));
      b.add(M(new THREE.SphereGeometry(0.62, 8, 6).scale(1.2, 0.6, 1), main, -0.75, 0, 0));
      for (const s of [1, -1]) {
        for (let k = 0; k < 3; k++) {
          const leg = M(new THREE.BoxGeometry(0.08, 0.08, 0.8), dark, 0.35 - k * 0.38, -0.05, 0.55 * s);
          leg.rotation.y = (k - 1) * 0.5 * s;
          b.add(leg);
        }
        const mand = M(new THREE.ConeGeometry(0.08, 0.5, 4).rotateZ(-Math.PI / 2), dark, 1.1, 0, 0.15 * s);
        mand.rotation.y = -0.4 * s;
        b.add(mand);
        b.add(M(new THREE.SphereGeometry(0.1, 6, 4), eye, 0.92, 0.15, 0.17 * s));
      }
      b.add(M(new THREE.SphereGeometry(0.2, 6, 4), eye, -0.75, 0.3, 0));
      break;
    }
    case 'dread': {
      b.add(M(new THREE.CylinderGeometry(0.55, 0.85, 3.0, 6).rotateZ(-Math.PI / 2).scale(1, 0.55, 1), main));
      b.add(M(new THREE.ConeGeometry(0.55, 1.0, 6).rotateZ(-Math.PI / 2).scale(1, 0.55, 1), main, 2.0, 0, 0));
      const w: [number, number][] = [[0.6, 0.4], [-0.9, 1.6], [-1.5, 1.55], [-1.1, 0.45]];
      b.add(M(slab(w, 0.14), dark), M(slab(mirror(w), 0.14), dark));
      b.add(M(new THREE.BoxGeometry(2.2, 0.36, 0.18), dark, -0.2, 0.42, 0));
      for (let k = 0; k < 4; k++) for (const s of [1, -1]) b.add(M(new THREE.SphereGeometry(0.09, 6, 4), eye, 0.9 - k * 0.55, 0.12, 0.5 * s));
      for (const z of [-0.35, 0, 0.35]) b.add(M(new THREE.SphereGeometry(0.2, 8, 6), eye, -1.55, 0, z));
      break;
    }
  }
  r.root.scale.setScalar(def.radius);
  return r;
}

// ---------------------------------------------------------------- bosses

export function makeBoss(id: BossId, color: number, glowColor: number): Rig {
  const r = rig();
  const main = flashMat(r, color, 0.4, 0.45);
  const dark = flashMat(r, darker(color, 0.35), 0.55, 0.45);
  const eye = glow(glowColor, 2.8);
  const b = r.body;
  if (id === 'override') {
    b.scale.setScalar(1.25);
    b.add(M(new THREE.IcosahedronGeometry(1.7, 1), main));
    const ring = new THREE.Group();
    ring.add(M(new THREE.TorusGeometry(2.7, 0.32, 6, 28).rotateX(Math.PI / 2), dark));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      ring.add(M(new THREE.SphereGeometry(0.22, 6, 4), eye, Math.cos(a) * 2.7, 0.25, Math.sin(a) * 2.7));
    }
    b.add(ring);
    r.parts.ring = ring;
    const eyeM = M(new THREE.SphereGeometry(0.62, 12, 8), glow(0xff2020, 3.2), 1.45, 0.1, 0);
    b.add(eyeM);
    r.parts.eye = eyeM;
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const sp = M(new THREE.ConeGeometry(0.22, 1.4, 5).rotateZ(-Math.PI / 2), dark, Math.cos(a) * 1.9, 0, Math.sin(a) * 1.9);
      sp.rotation.y = -a;
      b.add(sp);
    }
  } else if (id === 'marauder') {
    b.add(M(new THREE.BoxGeometry(5.2, 0.95, 1.9), main));
    b.add(M(new THREE.ConeGeometry(1.0, 2.4, 4).rotateZ(-Math.PI / 2).rotateX(Math.PI / 4).scale(1, 0.55, 1), main, 3.75, 0, 0));
    b.add(M(new THREE.BoxGeometry(1.4, 0.8, 1.0), dark, -1.0, 0.8, 0));
    b.add(M(new THREE.BoxGeometry(0.5, 0.12, 0.8), eye, -0.7, 1.15, 0));
    for (const s of [1, -1]) {
      const side = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const c = M(barrel(0.9, 0.12, dark), dark, 1.2 - k * 1.0, 0.1, 1.05 * s);
        c.rotation.y = -(Math.PI / 2) * s;
        side.add(c);
      }
      b.add(side);
      r.parts[s > 0 ? 'cannonsL' : 'cannonsR'] = side;
      const wing: [number, number][] = [[-0.6, 0.9], [-2.5, 2.4], [-3.1, 2.3], [-2.4, 0.9]];
      b.add(M(slab(s > 0 ? wing : mirror(wing), 0.18), dark));
      b.add(M(new THREE.SphereGeometry(0.22, 8, 6), eye, 4.1, 0.25, 0.32 * s));
    }
    for (const z of [-0.6, 0, 0.6]) b.add(M(new THREE.SphereGeometry(0.36, 8, 6), glow(0xff6a3a, 2.6), -2.7, 0, z));
  } else if (id === 'sovereign') {
    const core = M(new THREE.IcosahedronGeometry(0.95, 1), glow(0xe8a0ff, 1.25));
    b.add(core);
    r.parts.core = core;
    b.add(M(new THREE.OctahedronGeometry(1.5, 0).scale(1, 1.6, 1), flashMat(r, color, 0.6, 0.3), 0, 0, 0));
    const crown = new THREE.Group();
    const petal = flashMat(r, 0xc89bff, 0.5, 0.35);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const p = M(new THREE.OctahedronGeometry(0.6, 0).scale(3.2, 0.5, 1.0), petal, Math.cos(a) * 2.6, 0, Math.sin(a) * 2.6);
      p.rotation.y = -a;
      crown.add(p);
    }
    b.add(crown);
    r.parts.crown = crown;
    b.add(M(new THREE.TorusGeometry(1.75, 0.12, 6, 32).rotateX(Math.PI / 2), eye));
  } else {
    // xenarch: huge disc mothership with 4 turret pods
    b.add(M(new THREE.CylinderGeometry(5.0, 5.7, 1.0, 12), main));
    b.add(M(new THREE.CylinderGeometry(3.6, 5.0, 0.6, 12), dark, 0, 0.75, 0));
    const dome = M(new THREE.SphereGeometry(2.1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass(0xff9a3a, 0.5), 0, 1.0, 0);
    b.add(dome);
    const core = M(new THREE.SphereGeometry(1.0, 12, 8), glow(glowColor, 3), 0, 1.6, 0);
    b.add(core);
    r.parts.core = core;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const sp = M(new THREE.ConeGeometry(0.3, 1.4, 4).rotateZ(-Math.PI / 2), dark, Math.cos(a) * 5.9, -0.1, Math.sin(a) * 5.9);
      sp.rotation.y = -a;
      b.add(sp);
      b.add(M(new THREE.SphereGeometry(0.14, 6, 4), eye, Math.cos(a + 0.26) * 5.3, 0.4, Math.sin(a + 0.26) * 5.3));
    }
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const pod = new THREE.Group();
      pod.position.set(Math.cos(a) * 5.4, 0.8, Math.sin(a) * 5.4);
      pod.add(M(new THREE.SphereGeometry(0.85, 10, 8), dark));
      const head = new THREE.Group();
      head.add(M(barrel(1.3, 0.16, main), main, 0.2, 0.1, 0.25), M(barrel(1.3, 0.16, main), main, 0.2, 0.1, -0.25));
      head.add(M(new THREE.SphereGeometry(0.28, 8, 6), eye, 0.55, 0.45, 0));
      pod.add(head);
      pod.userData.head = head;
      b.add(pod);
      r.parts['pod' + k] = pod;
    }
  }
  return r;
}

// ---------------------------------------------------------------- station

export interface StationRig {
  root: THREE.Group;
  spinner: THREE.Object3D;
  beacon: THREE.Mesh;
  rings: THREE.Group[];
}

const STEEL = 0xc5cfda;

export function makeStationCore(): StationRig {
  const root = new THREE.Group();
  const steel = hull(STEEL, { metal: 0.55, rough: 0.4 });
  const dark = hull(0x3a4656, { metal: 0.6, rough: 0.5 });
  const accent = hull(0x2f7dff, { metal: 0.5, rough: 0.4 });
  root.add(M(new THREE.CylinderGeometry(2.0, 2.35, 1.3, 8), steel));
  root.add(M(new THREE.CylinderGeometry(2.38, 2.38, 0.22, 8), accent, 0, -0.35, 0));
  root.add(M(new THREE.SphereGeometry(1.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), glass(0x5fe8ff, 0.55), 0, 0.62, 0));
  root.add(M(new THREE.ConeGeometry(2.0, 1.7, 8).rotateX(Math.PI), dark, 0, -1.5, 0));
  const spinner = new THREE.Group();
  spinner.add(M(new THREE.TorusGeometry(3.05, 0.26, 6, 36).rotateX(Math.PI / 2), steel));
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const w = M(new THREE.BoxGeometry(0.3, 0.12, 0.16), glow(0xffe8a0, 1.8), Math.cos(a) * 3.05, 0.25, Math.sin(a) * 3.05);
    w.rotation.y = -a;
    spinner.add(w);
  }
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const sp = M(new THREE.BoxGeometry(1.0, 0.14, 0.14), dark, Math.cos(a) * 2.5, 0, Math.sin(a) * 2.5);
    sp.rotation.y = -a;
    spinner.add(sp);
  }
  root.add(spinner);
  root.add(M(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 5), dark, 0, 1.9, 0));
  const beacon = M(new THREE.SphereGeometry(0.18, 8, 6), glow(0xff4040, 3, true), 0, 3.05, 0);
  root.add(beacon);
  // spokes to the 4 inner sockets (diagonals)
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k / 4) * Math.PI * 2;
    const sp = M(new THREE.BoxGeometry(3.3, 0.28, 0.42), steel, Math.cos(a) * 3.85, -0.15, Math.sin(a) * 3.85);
    sp.rotation.y = -a;
    root.add(sp);
  }
  return { root, spinner, beacon, rings: [] };
}

/** Outer ring structure for ring 1 (Command Center) or ring 2 (Mega Station). */
export function makeRing(ring: 1 | 2): THREE.Group {
  const g = new THREE.Group();
  const steel = hull(STEEL, { metal: 0.55, rough: 0.4 });
  const dark = hull(0x3a4656, { metal: 0.6, rough: 0.5 });
  const R = ring === 1 ? 10.5 : 15.5;
  const tube = ring === 1 ? 0.42 : 0.5;
  g.add(M(new THREE.TorusGeometry(R, tube, 8, ring === 1 ? 72 : 110).rotateX(Math.PI / 2), steel));
  const spokes = ring === 1 ? 3 : 4;
  const inner = ring === 1 ? 3.2 : 10.5;
  for (let k = 0; k < spokes; k++) {
    const a = (ring === 1 ? Math.PI / 6 : Math.PI / 4) + (k / spokes) * Math.PI * 2 + (ring === 1 ? Math.PI / 3 : 0);
    const len = R - inner;
    const sp = M(new THREE.BoxGeometry(len, 0.3, 0.5), dark, Math.cos(a) * (inner + len / 2), -0.1, Math.sin(a) * (inner + len / 2));
    sp.rotation.y = -a;
    g.add(sp);
  }
  const lights = ring === 1 ? 36 : 52;
  const lm = glow(ring === 1 ? 0x7fd8ff : 0xffd27a, 2);
  for (let k = 0; k < lights; k++) {
    const a = (k / lights) * Math.PI * 2;
    g.add(M(new THREE.BoxGeometry(0.18, 0.1, 0.18), lm, Math.cos(a) * R, tube * 0.9, Math.sin(a) * R));
  }
  if (ring === 2) {
    const panel = hull(0x1d3f8a, { metal: 0.8, rough: 0.25 });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      for (const off of [2.2, 4.0]) {
        const p = M(new THREE.BoxGeometry(1.5, 0.06, 1.0), panel, Math.cos(a) * (R + off), 0, Math.sin(a) * (R + off));
        p.rotation.y = -a;
        g.add(p);
      }
      const arm = M(new THREE.BoxGeometry(4.2, 0.08, 0.1), dark, Math.cos(a) * (R + 2.6), 0, Math.sin(a) * (R + 2.6));
      arm.rotation.y = -a;
      g.add(arm);
    }
  }
  return g;
}

export interface PadRig {
  root: THREE.Group;
  rim: THREE.Mesh;
}

export function makeSocketPad(): PadRig {
  const root = new THREE.Group();
  root.add(M(new THREE.CylinderGeometry(1.15, 1.28, 0.3, 6), hull(0x48566a, { metal: 0.6, rough: 0.45 }), 0, -0.05, 0));
  const rim = M(new THREE.TorusGeometry(1.35, 0.07, 4, 6).rotateX(Math.PI / 2), glow(0x6fffd8, 2.5, true), 0, 0.14, 0);
  rim.visible = false;
  root.add(rim);
  return { root, rim };
}

export interface ModuleRig {
  root: THREE.Group;
  /** part that yaws toward targets (turrets, launchers) */
  head: THREE.Object3D | null;
  /** part that spins / pulses */
  fx: THREE.Object3D | null;
}

export function makeModule(kind: ModuleKind, tier: number): ModuleRig {
  const root = new THREE.Group();
  const steel = hull(STEEL, { metal: 0.55, rough: 0.4 });
  const dark = hull(0x3a4656, { metal: 0.6, rough: 0.45 });
  root.add(M(new THREE.CylinderGeometry(0.75, 0.9, 0.42, 8), dark, 0, 0.25, 0));
  let head: THREE.Object3D | null = null;
  let fx: THREE.Object3D | null = null;
  const top = 0.46;
  switch (kind) {
    case 'turret': {
      const h = new THREE.Group();
      h.position.y = top + 0.2;
      h.add(M(new THREE.BoxGeometry(0.85, 0.45, 0.7), steel));
      h.add(M(new THREE.BoxGeometry(0.3, 0.1, 0.5), glow(0x59f3ff, 2), 0.1, 0.25, 0));
      const metal = hull(0x2a3340, { metal: 0.8, rough: 0.3 });
      if (tier === 1) h.add(M(barrel(1.0, 0.09, metal), metal, 0.3, 0.02, 0));
      if (tier === 2) for (const z of [-0.16, 0.16]) h.add(M(barrel(1.1, 0.09, metal), metal, 0.3, 0.02, z));
      if (tier === 3) {
        h.add(M(barrel(1.8, 0.11, metal), metal, 0.3, 0.02, 0));
        for (let k = 0; k < 3; k++) h.add(M(new THREE.TorusGeometry(0.17, 0.05, 4, 8).rotateY(Math.PI / 2), glow(0x6ff6ff, 2.4), 0.75 + k * 0.38, 0.02, 0));
      }
      root.add(h);
      head = h;
      break;
    }
    case 'mining': {
      const y = hull(0xffc83a, { metal: 0.3, rough: 0.5 });
      root.add(M(new THREE.SphereGeometry(0.72, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), y, 0, top, 0));
      root.add(M(new THREE.BoxGeometry(0.2, 0.32, 0.55), glow(0xffd25a, 2.2), 0.66, top + 0.15, 0));
      root.add(M(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4), dark, -0.25, top + 0.9, 0.2));
      const dish = M(new THREE.ConeGeometry(0.28, 0.16, 8, 1, true).rotateX(Math.PI), steel, -0.25, top + 1.35, 0.2);
      root.add(dish);
      fx = dish;
      for (let k = 1; k < tier; k++) root.add(M(new THREE.BoxGeometry(0.3, 0.12, 0.3), y, -0.5, top + 0.06 * k, -0.45 + k * 0.3));
      break;
    }
    case 'shield': {
      root.add(M(new THREE.CylinderGeometry(0.12, 0.2, 1.2, 6), steel, 0, top + 0.6, 0));
      const orb = M(new THREE.SphereGeometry(0.38, 12, 8), glow(0x6fb7ff, 2.6), 0, top + 1.35, 0);
      root.add(orb);
      fx = orb;
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        const fin = M(new THREE.BoxGeometry(0.5, 0.7, 0.06), dark, Math.cos(a) * 0.3, top + 0.4, Math.sin(a) * 0.3);
        fin.rotation.y = -a;
        root.add(fin);
      }
      for (let k = 0; k < tier; k++) root.add(M(new THREE.TorusGeometry(0.42 + k * 0.08, 0.04, 4, 16).rotateX(Math.PI / 2), glow(0x6fb7ff, 2), 0, top + 0.7 + k * 0.22, 0));
      break;
    }
    case 'missile': {
      const h = new THREE.Group();
      h.position.y = top + 0.25;
      h.add(M(new THREE.BoxGeometry(0.9, 0.5, 0.9), steel));
      const rows = tier + 1;
      for (let k = 0; k < rows; k++) {
        for (const z of [-0.2, 0.2]) {
          const y2 = 0.32 + k * 0.0;
          const zz = z + (k - (rows - 1) / 2) * 0.0;
          h.add(M(new THREE.CylinderGeometry(0.11, 0.11, 0.7, 6).rotateZ(-Math.PI / 2), dark, 0.1, y2 - 0.05 + (k % 2) * 0.2 - 0.1, zz * (1 + k * 0.6)));
          h.add(M(new THREE.ConeGeometry(0.1, 0.22, 6).rotateZ(-Math.PI / 2), glow(0xff8a3d, 2.2), 0.55, y2 - 0.05 + (k % 2) * 0.2 - 0.1, zz * (1 + k * 0.6)));
        }
      }
      root.add(h);
      head = h;
      break;
    }
    case 'tesla': {
      root.add(M(new THREE.CylinderGeometry(0.1, 0.16, 1.7, 6), steel, 0, top + 0.85, 0));
      for (let k = 0; k < 2 + tier; k++) root.add(M(new THREE.TorusGeometry(0.42 - k * 0.04, 0.08, 4, 12).rotateX(Math.PI / 2), hull(0xb08a40, { metal: 0.9, rough: 0.3 }), 0, top + 0.3 + k * 0.3, 0));
      const ball = M(new THREE.SphereGeometry(0.34, 12, 8), glow(0xb49dff, 2.8), 0, top + 1.85, 0);
      root.add(ball);
      fx = ball;
      break;
    }
    case 'dock': {
      root.add(M(new THREE.BoxGeometry(1.5, 0.12, 1.2), steel, 0, top, 0));
      for (const [x, z] of [[0.65, 0.5], [0.65, -0.5], [-0.65, 0.5], [-0.65, -0.5]]) root.add(M(new THREE.SphereGeometry(0.07, 6, 4), glow(0x7dffb0, 2.6), x, top + 0.1, z));
      root.add(M(new THREE.BoxGeometry(0.5, 0.45, 1.0), dark, -0.55, top + 0.28, 0));
      for (let k = 0; k < tier; k++) root.add(M(new THREE.BoxGeometry(0.4, 0.06, 0.12), glow(0x7dffb0, 2), 0.1 + k * 0.25, top + 0.08, 0));
      break;
    }
  }
  return { root, head, fx };
}

// ---------------------------------------------------------------- drones & friends

export function makeMiningDrone(): THREE.Group {
  const g = new THREE.Group();
  const y = hull(0xffc83a, { metal: 0.3, rough: 0.5 });
  const dark = hull(0x3a4656, { metal: 0.6, rough: 0.45 });
  g.add(M(new THREE.BoxGeometry(0.55, 0.22, 0.55), y));
  for (const [x, z] of [[0.36, 0.36], [0.36, -0.36], [-0.36, 0.36], [-0.36, -0.36]]) {
    g.add(M(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 8), dark, x, 0.14, z));
  }
  g.add(M(new THREE.SphereGeometry(0.12, 6, 4), glow(0xffe07a, 2.6), 0.2, -0.08, 0));
  return g;
}

export function makeWingman(): Rig {
  const r = rig();
  const body = hull(0xd8ffe8, { metal: 0.4, rough: 0.45 });
  const accent = hull(0x2fbf6a, { metal: 0.5, rough: 0.4 });
  r.body.add(M(new THREE.ConeGeometry(0.32, 1.5, 5).rotateZ(-Math.PI / 2).scale(1, 0.55, 1), body, 0.1, 0, 0));
  const w: [number, number][] = [[0.2, 0.12], [-0.55, 0.8], [-0.75, 0.78], [-0.55, 0.12]];
  r.body.add(M(slab(w, 0.06), accent), M(slab(mirror(w), 0.06), accent));
  r.body.add(M(new THREE.SphereGeometry(0.15, 8, 6), glow(0x7dffb0, 2.6), -0.7, 0, 0));
  return r;
}

export function makeSparky(): THREE.Group {
  const g = new THREE.Group();
  const white = hull(0xf2f6fa, { metal: 0.2, rough: 0.35 });
  const dark = hull(0x26303c, { metal: 0.5, rough: 0.4 });
  g.add(M(new THREE.SphereGeometry(0.45, 16, 12), white));
  g.add(M(new THREE.SphereGeometry(0.34, 14, 10).scale(0.5, 0.75, 1), dark, 0.25, 0.04, 0));
  for (const z of [-0.12, 0.12]) g.add(M(new THREE.SphereGeometry(0.075, 8, 6), glow(0x6ff6ff, 3), 0.42, 0.08, z));
  g.add(M(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4), dark, -0.05, 0.6, 0));
  const tip = M(new THREE.SphereGeometry(0.08, 8, 6), glow(0xffd25a, 3, true), -0.05, 0.82, 0);
  g.add(tip);
  for (const z of [-0.45, 0.45]) g.add(M(new THREE.BoxGeometry(0.22, 0.06, 0.18), hull(0x2f7dff), -0.05, 0, z));
  g.userData.tip = tip;
  return g;
}

export type PickupKind = 'overdrive' | 'bubble' | 'magnet' | 'nuke';

export const PICKUP_COLORS: Record<PickupKind, number> = {
  overdrive: 0xff8a3d,
  bubble: 0x6fb7ff,
  magnet: 0xff4a6a,
  nuke: 0xffe04a,
};

export function makePickup(kind: PickupKind): THREE.Group {
  const g = new THREE.Group();
  const c = PICKUP_COLORS[kind];
  g.add(M(new THREE.TorusGeometry(0.75, 0.06, 4, 24).rotateX(Math.PI / 2), glow(c, 2.4)));
  if (kind === 'overdrive') g.add(M(new THREE.OctahedronGeometry(0.42, 0).scale(1, 1.5, 1), glow(c, 2.6)));
  if (kind === 'bubble') g.add(M(new THREE.SphereGeometry(0.42, 14, 10), glass(c, 1.2)));
  if (kind === 'magnet') {
    g.add(M(new THREE.TorusGeometry(0.32, 0.12, 6, 12, Math.PI).rotateZ(Math.PI / 2), hull(c)));
    for (const z of [-0.32, 0.32]) g.add(M(new THREE.BoxGeometry(0.3, 0.24, 0.24), hull(0xf0f0f0), -0.12, 0, z));
  }
  if (kind === 'nuke') {
    g.add(M(new THREE.SphereGeometry(0.4, 12, 8), glow(c, 2)));
    for (let k = 0; k < 3; k++) {
      const f = M(new THREE.BoxGeometry(0.5, 0.06, 0.18), hull(0x222222), 0, 0, 0);
      f.rotation.y = (k / 3) * Math.PI * 2;
      f.position.set(Math.cos(f.rotation.y) * 0.3, 0.42, -Math.sin(f.rotation.y) * 0.3);
      g.add(f);
    }
  }
  return g;
}

export function makeCrate(): THREE.Group {
  const g = new THREE.Group();
  g.add(M(new THREE.BoxGeometry(1.2, 1.0, 1.2), hull(0x8a96a6, { metal: 0.6, rough: 0.4 })));
  const s = glow(0x7dffb0, 2.4);
  for (const [x, z] of [[0.61, 0], [-0.61, 0]]) g.add(M(new THREE.BoxGeometry(0.04, 0.2, 1.0), s, x, 0, z));
  for (const [x, z] of [[0, 0.61], [0, -0.61]]) g.add(M(new THREE.BoxGeometry(1.0, 0.2, 0.04), s, x, 0, z));
  g.add(M(new THREE.BoxGeometry(0.5, 0.05, 0.5), s, 0, 0.53, 0));
  return g;
}

export function makeComet(): THREE.Group {
  const g = new THREE.Group();
  g.add(M(new THREE.IcosahedronGeometry(1.1, 1), hull(0xffd25a, { metal: 0.9, rough: 0.25 })));
  g.add(M(new THREE.IcosahedronGeometry(0.75, 0), glow(0xfff0a0, 2.8), 0.2, 0.3, 0));
  return g;
}

export function makePod(): THREE.Group {
  // Sparky's broken escape pod
  const g = new THREE.Group();
  g.add(M(new THREE.CapsuleGeometry(0.7, 1.0, 4, 10).rotateZ(Math.PI / 2), hull(0xe8e8e8, { metal: 0.4, rough: 0.5 })));
  g.add(M(new THREE.SphereGeometry(0.42, 10, 8), glass(0x6ff6ff, 0.8), 0.6, 0.3, 0));
  const beacon = M(new THREE.SphereGeometry(0.16, 8, 6), glow(0xffd25a, 3.2, true), -0.4, 0.75, 0);
  g.add(beacon);
  g.userData.beacon = beacon;
  return g;
}

// ---------------------------------------------------------------- asteroids & crystals

export type RockSize = 'G' | 'L' | 'M' | 'S';
export type RockKind = 'rock' | 'rich' | 'explosive';
export const ROCK_RADIUS: Record<RockSize, number> = { G: 6, L: 3, M: 1.8, S: 1.0 };

/** Asteroid geometry variants coloured for one sector. */
export class AsteroidKit {
  private variants: Record<RockSize, G[]> = { G: [], L: [], M: [], S: [] };
  readonly rockMat: THREE.MeshStandardMaterial;
  readonly hotMat: THREE.MeshStandardMaterial;
  readonly veinMat: THREE.MeshBasicMaterial;
  readonly crackMat: THREE.MeshBasicMaterial;
  private shard = new THREE.OctahedronGeometry(1, 0).scale(0.55, 1.4, 0.55);
  private crack = new THREE.BoxGeometry(1, 0.2, 0.2);

  constructor(look: SectorLook, seed: number) {
    const nz = new Noise3(seed);
    const rng = new Rng(seed);
    const dark = new THREE.Color(look.rockDark);
    const light = new THREE.Color(look.rock);
    const c = new THREE.Color();
    (['G', 'L', 'M', 'S'] as RockSize[]).forEach((size, si) => {
      for (let v = 0; v < 6; v++) {
        const detail = size === 'G' ? 2 : size === 'S' ? 0 : 1;
        const g = new THREE.IcosahedronGeometry(1, detail);
        const pos = g.getAttribute('position') as THREE.BufferAttribute;
        const off = rng.range(0, 100);
        const sq = [rng.range(0.75, 1.1), rng.range(0.65, 0.95), rng.range(0.75, 1.1)];
        const colors = new Float32Array(pos.count * 3);
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          const n = nz.fbm(x * 1.5 + off, y * 1.5 + si, z * 1.5, 4);
          const k = 0.68 + n * 0.62;
          pos.setXYZ(i, x * k * sq[0], y * k * sq[1], z * k * sq[2]);
        }
        // per-face colour so the flat facets read well
        for (let i = 0; i < pos.count; i += 3) {
          const t = Math.min(1, Math.max(0, nz.get(pos.getX(i) * 3 + off, pos.getY(i) * 3, pos.getZ(i) * 3) * 1.3 - 0.1));
          c.copy(dark).lerp(light, t).multiplyScalar(0.9 + rng.next() * 0.2);
          for (let j = 0; j < 3; j++) colors.set([c.r, c.g, c.b], (i + j) * 3);
        }
        g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        g.computeVertexNormals();
        this.variants[size].push(g);
      }
    });
    this.rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0.08 });
    this.hotMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0.05, color: 0xff8a7a, emissive: 0x3a0800 });
    this.veinMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(look.vein).multiplyScalar(2.4) });
    this.crackMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff4a1a).multiplyScalar(2.8) });
  }

  make(size: RockSize, kind: RockKind, rng: Rng): THREE.Group {
    const r = ROCK_RADIUS[size];
    const g = new THREE.Group();
    const rock = new THREE.Mesh(rng.pick(this.variants[size]), kind === 'explosive' ? this.hotMat : this.rockMat);
    rock.scale.setScalar(r);
    g.add(rock);
    const dirs = kind === 'rich' ? rng.int(4, 7) + (size === 'G' ? 6 : 0) : kind === 'explosive' ? rng.int(4, 6) : 0;
    for (let i = 0; i < dirs; i++) {
      const v = new THREE.Vector3(rng.range(-1, 1), rng.range(-0.4, 1), rng.range(-1, 1)).normalize();
      if (kind === 'rich') {
        const m = new THREE.Mesh(this.shard, this.veinMat);
        m.position.copy(v).multiplyScalar(r * 0.78);
        m.scale.setScalar(r * rng.range(0.16, 0.26));
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
        g.add(m);
      } else {
        const m = new THREE.Mesh(this.crack, this.crackMat);
        m.position.copy(v).multiplyScalar(r * 0.84);
        m.scale.set(r * rng.range(0.5, 0.9), r * 0.6, r * 0.6);
        m.lookAt(m.position.clone().multiplyScalar(2));
        m.rotateZ(rng.range(0, Math.PI));
        g.add(m);
      }
    }
    return g;
  }

  dispose(): void {
    for (const list of Object.values(this.variants)) list.forEach((g) => g.dispose());
    this.rockMat.dispose();
    this.hotMat.dispose();
    this.veinMat.dispose();
    this.crackMat.dispose();
  }
}

/** Faceted gem with baked per-face brightness (works with an HDR instance colour). */
export function crystalGeometry(): G {
  const g = new THREE.OctahedronGeometry(0.3, 0).scale(1, 1.7, 1);
  const pos = g.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 3) {
    const k = [1, 0.62, 0.85, 0.5, 0.95, 0.7, 0.8, 0.55][(i / 3) % 8];
    for (let j = 0; j < 3; j++) colors.set([k, k, k], (i + j) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}
