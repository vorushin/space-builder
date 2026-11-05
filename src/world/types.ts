import type { Game } from '../game';

/** Anything player bolts, missiles and explosions can hit. */
export interface Hittable {
  x: number;
  z: number;
  r: number;
  vx: number;
  vz: number;
  alive: boolean;
  /** 'enemy' things are targeted by turrets; 'neutral' are asteroids, comets */
  team: 'enemy' | 'neutral';
  /** apply damage; (hx, hz) is where it came from (for knockback / sparks) */
  onHit(dmg: number, game: Game, hx: number, hz: number): void;
}
