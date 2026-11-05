import * as THREE from 'three';

const cache = new Map<string, THREE.Material>();

/** Flat-shaded painted metal. Shared per colour unless `unique`. */
export function hull(color: number, opts: { metal?: number; rough?: number; unique?: boolean } = {}): THREE.MeshStandardMaterial {
  const key = `hull-${color}-${opts.metal ?? 0.35}-${opts.rough ?? 0.55}`;
  if (!opts.unique && cache.has(key)) return cache.get(key) as THREE.MeshStandardMaterial;
  const m = new THREE.MeshStandardMaterial({ color, metalness: opts.metal ?? 0.35, roughness: opts.rough ?? 0.55, flatShading: true });
  if (!opts.unique) cache.set(key, m);
  return m;
}

/** Unlit HDR colour: blooms. `power` > 1 pushes it above white. */
export function glow(color: number, power = 2.4, unique = false): THREE.MeshBasicMaterial {
  const key = `glow-${color}-${power}`;
  if (!unique && cache.has(key)) return cache.get(key) as THREE.MeshBasicMaterial;
  const c = new THREE.Color(color).multiplyScalar(power);
  const m = new THREE.MeshBasicMaterial({ color: c });
  if (!unique) cache.set(key, m);
  return m;
}

/** Additive glow (engine flames, halos). */
export function additive(color: number, power = 2, opacity = 1): THREE.MeshBasicMaterial {
  const key = `add-${color}-${power}-${opacity}`;
  if (cache.has(key)) return cache.get(key) as THREE.MeshBasicMaterial;
  const m = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(power),
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  cache.set(key, m);
  return m;
}

/** Glassy canopy with a little inner light. */
export function glass(color: number, emissive = 0.6): THREE.MeshStandardMaterial {
  const key = `glass-${color}-${emissive}`;
  if (cache.has(key)) return cache.get(key) as THREE.MeshStandardMaterial;
  const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: emissive, metalness: 0.6, roughness: 0.15, flatShading: true });
  cache.set(key, m);
  return m;
}
