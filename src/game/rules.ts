/** Game balance in one place. Levels start at 1. */

export const ARMOR_MAX = 5;

/** Small creatures to kill to clear a level: 6, 8, 10, … */
export const killsForLevel = (level: number): number => 6 + 2 * (level - 1);

/** Hits a small creature takes: 1 on level 1, 2 on level 2, 3 from level 3 on. */
export const smallHp = (level: number): number => Math.min(level, 3);

/** How many small creatures may be in the room at once. */
export const maxAlive = (level: number): number => Math.min(2 + Math.floor((level - 1) / 2), 4);

/** Which flyer comes out next: only eye orbs at first, then winged skulls (level 3+) and flaming skulls (level 4+). */
export function pickSpecies(level: number): 'orb' | 'wingskull' | 'fireskull' {
  const r = Math.random();
  if (level >= 4) return r < 0.45 ? 'orb' : r < 0.75 ? 'wingskull' : 'fireskull';
  if (level >= 3) return r < 0.65 ? 'orb' : 'wingskull';
  return 'orb';
}

/** Flaming skulls burst on the first hit whatever the level. */
export const hpFor = (species: 'orb' | 'wingskull' | 'fireskull', level: number): number => (species === 'fireskull' ? 1 : smallHp(level));

/** Every third level ends with the boss. */
export const isBossLevel = (level: number): boolean => level % 3 === 0;

/** Boss hits: 10 on level 3, then +5 per boss. */
export const bossHp = (level: number): number => 10 + 5 * (level / 3 - 1);

/** Seconds between spawns; shrinks as levels go up. */
export const spawnDelay = (level: number): number => Math.max(1.4, 3.4 - level * 0.25);

/** Rifts that open with each spawn but stay empty. */
export const DECOY_RIFTS = 2;

/** Seconds all rifts glow before a creature comes out of one of them. */
export const RIFT_WARMUP = 1.4;

/** Seconds a banner (level, boss, defeat) stays up. */
export const BANNER_TIME = 2.6;
