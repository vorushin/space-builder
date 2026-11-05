import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { BAL } from '../config/balance';
import type { SectorLook } from '../config/sectors';
import { clamp, damp, type V2 } from '../logic/math';

export const isTouch =
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0 || new URLSearchParams(location.search).has('touch'));

const MAX_PIXELS = 5.5e6;

// Safety net: a single NaN/Inf pixel would be smeared by bloom into big black blocks.
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
      gl_FragColor = min(c, vec4(6e4));
    }`,
};

// Flat shading derives normals from screen derivatives; sub-pixel triangles give a zero cross product → NaN.
THREE.ShaderChunk.normal_fragment_begin = THREE.ShaderChunk.normal_fragment_begin.replace(
  'vec3 normal = normalize( cross( fdx, fdy ) );',
  'vec3 normal = cross( fdx, fdy ); normal = dot( normal, normal ) > 1e-24 ? normalize( normal ) : vec3( 0.0, 0.0, 1.0 );',
);

export function pixelRatioFor(w: number, h: number, dpr: number): number {
  return Math.min(dpr, isTouch ? 1.5 : 2, Math.sqrt(MAX_PIXELS / Math.max(1, w * h)));
}

/** Renderer, bloom, lights and the tilted follow-camera. Gameplay is on the y = 0 plane. */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private hemi: THREE.HemisphereLight;
  private key: THREE.DirectionalLight;
  private rim: THREE.DirectionalLight;

  /** Point on the play plane the camera looks at. */
  readonly target = new THREE.Vector3();
  /** Desired camera distance (the actual one eases toward it). */
  distGoal: number = BAL.camera.dist;
  private dist: number = BAL.camera.dist;
  pitch: number = BAL.camera.pitch;
  /** Extra FOV (hyperspace). */
  fovKick = 0;
  private shakeAmt = 0;
  private time = 0;
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private ndc = new THREE.Vector2();
  private hit = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  width = 1;
  height = 1;
  shakeScale = 1;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x000000);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.classList.add('game-canvas');

    this.camera = new THREE.PerspectiveCamera(BAL.camera.fov, 1, 0.5, 2500);

    this.hemi = new THREE.HemisphereLight(0x9fd8ff, 0x0a2830, 0.9);
    this.key = new THREE.DirectionalLight(0xffffff, 2.6);
    this.key.position.set(-40, 60, 25);
    this.rim = new THREE.DirectionalLight(0x58e0ff, 1.6);
    this.rim.position.set(30, 18, -45);
    this.scene.add(this.hemi, this.key, this.key.target, this.rim, this.rim.target);

    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new ShaderPass(SanitizeShader));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.5, 0.8);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setLook(look: SectorLook): void {
    this.scene.background = new THREE.Color(look.bg);
    this.hemi.color.set(look.hemiSky);
    this.hemi.groundColor.set(look.hemiGround);
    this.key.color.set(look.sun);
    this.key.intensity = look.sunIntensity;
    this.rim.color.set(look.rim);
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.width = w;
    this.height = h;
    const pr = pixelRatioFor(w, h, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w * pr, h * pr);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Narrow screens see the same width of space: pull the camera back. */
  private aspectFactor(): number {
    return clamp(1.6 / this.camera.aspect, 1, 1.9);
  }

  /** Smoothly follow a point (ship + aim lead). */
  follow(x: number, z: number, dt: number, snap = false): void {
    if (snap) {
      this.target.set(x, 0, z);
      return;
    }
    this.target.x = damp(this.target.x, x, 5, dt);
    this.target.z = damp(this.target.z, z, 5, dt);
  }

  shake(amount: number): void {
    this.shakeAmt = Math.min(1.2, Math.max(this.shakeAmt, amount * this.shakeScale));
  }

  update(dt: number): void {
    this.time += dt;
    this.dist = damp(this.dist, this.distGoal * this.aspectFactor(), 3, dt);
    const fov = BAL.camera.fov + this.fovKick;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.8);
    const s = this.shakeAmt * this.shakeAmt;
    const sx = (Math.sin(this.time * 71) + Math.sin(this.time * 43)) * 0.5 * s;
    const sz = (Math.sin(this.time * 59 + 1) + Math.sin(this.time * 37)) * 0.5 * s;
    const t = this.target;
    this.camera.position.set(t.x + sx, Math.sin(this.pitch) * this.dist, t.z + Math.cos(this.pitch) * this.dist + sz);
    this.camera.lookAt(t.x + sx * 0.5, 0, t.z + sz * 0.5);
    // keep the lights' targets with the action so shading stays consistent
    this.key.target.position.copy(t);
    this.key.position.set(t.x - 40, 60, t.z + 25);
    this.rim.target.position.copy(t);
    this.rim.position.set(t.x + 30, 18, t.z - 45);
  }

  render(): void {
    this.composer.render();
  }

  /** Mouse pixel → point on the play plane. */
  screenToWorld(px: number, py: number): V2 {
    this.ndc.set((px / this.width) * 2 - 1, -(py / this.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const p = this.ray.ray.intersectPlane(this.plane, this.hit);
    if (!p) return { x: this.target.x, z: this.target.z };
    return { x: p.x, z: p.z };
  }

  /** World point → CSS pixels. `behind` when it is behind the camera. */
  worldToScreen(x: number, y: number, z: number): { x: number; y: number; behind: boolean } {
    this.tmp.set(x, y, z).project(this.camera);
    return { x: (this.tmp.x * 0.5 + 0.5) * this.width, y: (-this.tmp.y * 0.5 + 0.5) * this.height, behind: this.tmp.z > 1 };
  }
}
