/** Medals to collect. They are awarded from game code with `game.medal(id)`. */
export interface MedalDef {
  id: string;
  icon: string;
  name: string;
  desc: string;
}

export const MEDALS: MedalDef[] = [
  { id: 'first_build', icon: '🔧', name: 'First Build', desc: 'Build your first station module' },
  { id: 'sharp_shooter', icon: '🎯', name: 'Sharp Shooter', desc: 'Upgrade your guns to Triple Shot' },
  { id: 'singularity', icon: '🌀', name: 'Singularity!', desc: 'Get the Singularity Weapon (guns level 10)' },
  { id: 'boss_override', icon: '🤖', name: 'Override Off', desc: 'Defeat Protocol Override' },
  { id: 'boss_marauder', icon: '🏴‍☠️', name: 'Pirate Buster', desc: 'Defeat the Crimson Marauder' },
  { id: 'boss_sovereign', icon: '👑', name: 'Cloud Breaker', desc: 'Defeat the Nebula Sovereign' },
  { id: 'boss_xenarch', icon: '🛸', name: 'Galaxy Saver', desc: 'Defeat Xenarch Prime' },
  { id: 'sparky', icon: '🦾', name: 'Robot Rescue', desc: 'Rescue Sparky from his broken pod' },
  { id: 'mega', icon: '🏗️', name: 'Mega Builder', desc: 'Build the Mega Station' },
  { id: 'full_house', icon: '🏰', name: 'Full House', desc: 'Fill all 18 sockets of the Mega Station' },
  { id: 'comet', icon: '☄️', name: 'Comet Hunter', desc: 'Smash a golden comet' },
  { id: 'untouchable', icon: '✨', name: 'Untouchable', desc: 'Clear a wave without your ship getting hit' },
  { id: 'nova', icon: '💥', name: 'Nova!', desc: 'Unleash a NOVA blast' },
  { id: 'rock_smasher', icon: '🪨', name: 'Rock Smasher', desc: 'Smash 1500 rocks (in all your games)' },
  { id: 'endless_10', icon: '♾️', name: 'Endless 10', desc: 'Survive 10 waves in Endless mode' },
];

export const MEDAL_IDS = MEDALS.map((m) => m.id);
export const MEDAL_BY_ID: Record<string, MedalDef> = Object.fromEntries(MEDALS.map((m) => [m.id, m]));
