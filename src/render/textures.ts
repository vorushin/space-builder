import * as THREE from 'three';

let glow: THREE.Texture | null = null;

/** Soft radial glow (white), shared. */
export function glowTexture(): THREE.Texture {
  if (glow) return glow;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.2, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.15)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  glow = new THREE.CanvasTexture(c);
  glow.colorSpace = THREE.SRGBColorSpace;
  return glow;
}

let hex: THREE.Texture | null = null;

/** Hexagon grid used on the shield bubble. */
export function hexTexture(): THREE.Texture {
  if (hex) return hex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(0,0,0,0)';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 3;
  const r = 22;
  const w = Math.sqrt(3) * r;
  for (let row = -1; row < 9; row++) {
    for (let col = -1; col < 9; col++) {
      const cx = col * w + (row % 2 ? w / 2 : 0);
      const cy = row * r * 1.5;
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        if (k === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
      g.stroke();
    }
  }
  hex = new THREE.CanvasTexture(c);
  hex.wrapS = hex.wrapT = THREE.RepeatWrapping;
  hex.repeat.set(4, 2);
  return hex;
}
