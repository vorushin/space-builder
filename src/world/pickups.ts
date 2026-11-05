import * as THREE from 'three';
import type { Game } from '../game';
import { Rng } from '../logic/math';
import { makeCrate, makePickup, PICKUP_COLORS, type PickupKind } from '../render/models';
import type { Ship } from './ship';

const rng = new Rng(31337);
export const POWERUPS: PickupKind[] = ['overdrive', 'bubble', 'magnet', 'nuke'];
export const POWERUP_NAMES: Record<PickupKind, string> = {
  overdrive: 'OVERDRIVE!',
  bubble: 'BUBBLE SHIELD!',
  magnet: 'MEGA MAGNET!',
  nuke: 'NUKE!',
};

interface Pickup {
  kind: PickupKind | 'crate';
  x: number;
  z: number;
  t: number;
  mesh: THREE.Group;
  alive: boolean;
}

/** Floating power-ups and supply crates. */
export class Pickups {
  list: Pickup[] = [];

  constructor(private scene: THREE.Scene) {}

  drop(game: Game, x: number, z: number, kind?: PickupKind): void {
    const k = kind ?? rng.pick(POWERUPS);
    const mesh = makePickup(k);
    this.add(game, k, x, z, mesh);
  }

  crate(game: Game, x: number, z: number): void {
    this.add(game, 'crate', x, z, makeCrate());
  }

  private add(game: Game, kind: Pickup['kind'], x: number, z: number, mesh: THREE.Group): void {
    mesh.position.set(x, 1, z);
    this.scene.add(mesh);
    this.list.push({ kind, x, z, t: 0, mesh, alive: true });
    game.fx.ring(x, z, 3, kind === 'crate' ? 0x7dffb0 : PICKUP_COLORS[kind], 0.5);
  }

  clear(): void {
    for (const p of this.list) this.scene.remove(p.mesh);
    this.list = [];
  }

  update(dt: number, game: Game): void {
    for (const p of this.list) {
      p.t += dt;
      const ship = game.nearestShip(p.x, p.z, 7);
      if (ship) {
        const dx = ship.x - p.x, dz = ship.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 2.2) {
          p.alive = false;
          this.collect(p, game, ship);
          continue;
        }
        if (d < 7) {
          p.x += (dx / d) * 9 * dt;
          p.z += (dz / d) * 9 * dt;
        }
      }
      const life = p.kind === 'crate' ? 60 : 25;
      if (p.t > life) p.alive = false;
      p.mesh.position.set(p.x, 1 + Math.sin(p.t * 3) * 0.25, p.z);
      p.mesh.rotation.y += dt * 1.8;
      p.mesh.visible = p.t < life - 5 || Math.floor(p.t * 8) % 2 === 0;
      if (Math.random() < 0.15) game.fx.particle(p.x, 1, p.z, 0, 1.5, 0, p.kind === 'crate' ? 0x7dffb0 : PICKUP_COLORS[p.kind], 0.5, 0.6, 2, 1);
    }
    this.list = this.list.filter((p) => {
      if (!p.alive) this.scene.remove(p.mesh);
      return p.alive;
    });
  }

  private collect(p: Pickup, game: Game, ship: Ship): void {
    if (p.kind === 'crate') {
      game.fx.explosion(p.x, p.z, 1.2, 0x7dffb0, -1);
      game.crystals.spawn(p.x, p.z, 18, 1, game);
      game.applyPowerup(rng.pick(POWERUPS), p.x, p.z, ship);
      return;
    }
    game.applyPowerup(p.kind, p.x, p.z, ship);
  }

  /** For edge indicators. */
  get crates(): Pickup[] {
    return this.list.filter((p) => p.kind === 'crate');
  }
}
