import { describe, expect, it } from 'vitest';
import { MEDALS } from '../src/config/medals';
import { PAINTS } from '../src/config/paints';
import { awardMedal, cleanName, commanderTitle, decodeProfile, defaultProfile, encodeProfile } from '../src/logic/profile';

describe('profile', () => {
  it('round-trips', () => {
    const p = { ...defaultProfile(), name: 'Robert', paint: 'crimson', medals: ['first_build', 'nova'], bestEndless: 12, rocks: 340, players: 2 as const };
    expect(decodeProfile(encodeProfile(p))).toEqual(p);
  });

  it('falls back to defaults for garbage', () => {
    for (const s of [null, '', '{', '[]', '42', 'null', '{"v":1}']) expect(decodeProfile(s as string)).toEqual(defaultProfile());
  });

  it('sanitises fields', () => {
    const p = decodeProfile(JSON.stringify({ name: '  Rob\u0007ert   the   Great Space Captain ', paint: 'neon-unicorn', medals: ['nova', 'nova', 'made-up', 3], bestEndless: -4, rocks: 'many' }));
    expect(p.name).toBe('Robert the Great');
    expect(p.name.length).toBeLessThanOrEqual(16);
    expect(p.paint).toBe('arctic');
    expect(p.medals).toEqual(['nova']);
    expect(p.bestEndless).toBe(0);
    expect(p.rocks).toBe(0);
    expect(decodeProfile(JSON.stringify({ players: 3 })).players).toBe(1);
  });

  it('awards each medal once and ignores unknown ones', () => {
    const p = defaultProfile();
    expect(awardMedal(p, 'first_build')).toBe(true);
    expect(awardMedal(p, 'first_build')).toBe(false);
    expect(awardMedal(p, 'not-a-medal')).toBe(false);
    expect(p.medals).toEqual(['first_build']);
  });

  it('names the commander', () => {
    expect(commanderTitle({ ...defaultProfile(), name: 'Robert' })).toBe('Commander Robert');
    expect(commanderTitle(defaultProfile())).toBe('Commander');
    expect(cleanName(42)).toBe('');
  });

  it('config ids are unique', () => {
    expect(new Set(MEDALS.map((m) => m.id)).size).toBe(MEDALS.length);
    expect(new Set(PAINTS.map((m) => m.id)).size).toBe(PAINTS.length);
    expect(MEDALS).toHaveLength(15);
  });
});
