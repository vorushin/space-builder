/**
 * Everything the characters say. {cmd} becomes "Commander Robert" (or just "Commander").
 * Edit freely: short lines read best (they type out in a small panel).
 */
import type { BossId } from './sectors';

export type Speaker = 'aria' | 'sparky' | BossId;

export interface Line {
  who: Speaker;
  text: string;
}

const aria = (text: string): Line => ({ who: 'aria', text });
const sparky = (text: string): Line => ({ who: 'sparky', text });

export const SPEAKERS: Record<Speaker, { name: string; color: string }> = {
  aria: { name: 'ARIA', color: '#5cffd6' },
  sparky: { name: 'Sparky', color: '#ffd25a' },
  override: { name: 'Protocol Override', color: '#ff4a4a' },
  marauder: { name: 'Crimson Marauder', color: '#ff5a3a' },
  sovereign: { name: 'Nebula Sovereign', color: '#ff7af0' },
  xenarch: { name: 'Xenarch Prime', color: '#ffb030' },
};

export const LINES = {
  firstCrystals: [aria('Crystals! We build everything with those. Grab as many as you can.')],
  firstBuild: [aria('Module online! Every module makes our station stronger.')],
  firstWarning: [aria('Enemy signal! The red arrows show where they are coming from.')],
  waveCleared: [
    aria('Wave cleared! Nice flying, {cmd}.'),
    aria('All clear! Quick, build something before the next wave.'),
    aria('They ran away! Grab the crystals!'),
    aria('Great job, {cmd}! The station is repaired.'),
  ],
  sparkyCheer: [sparky('Beep boop! That was fun!'), sparky('Zap zap! We did it!'), sparky('Shiny crystals! Beep!')],
  stationDanger: [aria('{cmd}, the station is taking a beating! Come back and help!'), aria('Hull breach! Defend the station!')],
  shipDown: [aria('Your ship is down! I am building you a new one at the station.')],
  bossWarning: [aria('Something BIG is coming, {cmd}...')],
  novaReady: [aria('NOVA is charged! Press F to unleash it!')],
  bossDefeated: [aria('{boss} is down! You did it, {cmd}!')],
  sparkyRescued: [sparky("Beep boop! Thank you for saving me! I'll zap the baddies for you!")],
  newModules: [aria('New blueprints unlocked: {list}! Check the build bar.')],
  sectorBriefing: [
    [aria("Welcome aboard, {cmd}! I'm ARIA, this station's computer."), aria('Blast asteroids for crystals, then build us some turrets. Drones are on the way!')],
    [aria('This is the Asteroid Belt. Pirates live here, and they will try to ram our station.')],
    [aria('Nebula Field. Ghost ships blink in and out of the purple clouds. Stay sharp!')],
    [aria('Alien Territory. This is it, {cmd}: the alien mothership is somewhere out there.')],
  ],
  victory: [aria('The galaxy is safe. Best commander ever, {cmd}!')],
  endless: [aria('Endless mode! Waves forever. How long can we hold out, {cmd}?')],
  bossArrive: {
    override: [{ who: 'override', text: 'PROTOCOL OVERRIDE ONLINE. TRAINING... TERMINATED.' }],
    marauder: [{ who: 'marauder', text: 'Har har! Those crystals are MINE, little station!' }],
    sovereign: [{ who: 'sovereign', text: 'You cannot hit what you cannot find...' }],
    xenarch: [{ who: 'xenarch', text: 'Tiny station. My fleet will eat your crystals.' }],
  } as Record<BossId, Line[]>,
  bossHalf: {
    override: [{ who: 'override', text: 'ERROR. ERROR. DEPLOYING DRONES.' }],
    marauder: [{ who: 'marauder', text: 'You scratched my ship! Now I am ANGRY!' }],
    sovereign: [{ who: 'sovereign', text: 'Which one of me is real?' }],
    xenarch: [{ who: 'xenarch', text: 'My pods! You will pay for that!' }],
  } as Record<BossId, Line[]>,
};
