import { Vector3 } from 'three';
import { createStore } from '../state/createStore';
import { ARMOR_MAX, killsForLevel } from './rules';

/** A point on a wall where something comes out, and the wall normal facing the room. */
export interface SpawnPoint {
  position: Vector3;
  normal: Vector3;
}

/** A glowing crack on a wall. */
export interface Rift extends SpawnPoint {
  id: number;
  size: 'small' | 'boss';
  open: boolean;
}

/** Small flyer species: eye orb (base), winged skull (from level 3), flaming skull (from level 4). */
export type Species = 'orb' | 'wingskull' | 'fireskull';

/** A live creature; its component drives it and reports hits and death back here. */
export interface Creature {
  id: number;
  kind: 'small' | 'boss';
  /** Which flyer, for small creatures. */
  species: Species;
  hp: number;
  maxHp: number;
  spawn: SpawnPoint;
}

export type Phase = 'idle' | 'intro' | 'playing' | 'boss' | 'cleared' | 'defeat';

/** What a banner announces; the HUD turns it into text in the current language. */
export type BannerKind = 'level' | 'boss' | 'cleared' | 'bossDown' | 'defeat';

/** A message floating in front of the player for a few seconds. */
export interface Banner {
  id: number;
  kind: BannerKind;
  level: number;
}

export interface GameState {
  phase: Phase;
  level: number;
  armor: number;
  killed: number;
  target: number;
  /** Small creatures released this level (alive or dead). */
  released: number;
  rifts: Rift[];
  creatures: Creature[];
  banner: Banner | null;
  /** performance.now() of the last bite, for the red flash. */
  hurtAt: number;
  paused: boolean;
}

const initial: GameState = {
  phase: 'idle',
  level: 1,
  armor: ARMOR_MAX,
  killed: 0,
  target: killsForLevel(1),
  released: 0,
  rifts: [],
  creatures: [],
  banner: null,
  hurtAt: -1e9,
  paused: false,
};

/** Game state store. */
export const game = createStore<GameState>(initial);

let nextId = 1;
/** Unique id for rifts, creatures and banners. */
export const newId = (): number => nextId++;

/** Starts (or restarts) a level with full armor and an empty room. */
export function startLevel(level: number): void {
  game.set({
    phase: 'intro',
    level,
    armor: ARMOR_MAX,
    killed: 0,
    target: killsForLevel(level),
    released: 0,
    rifts: [],
    creatures: [],
    banner: { id: newId(), kind: 'level', level },
    paused: false,
  });
}

/** Shows a banner for the current level. */
export function showBanner(kind: BannerKind): void {
  game.set({ banner: { id: newId(), kind, level: game.get().level } });
}

/** A creature reached the player. Armor 0 ends the level in defeat. */
export function hurtPlayer(amount: number): void {
  const s = game.get();
  if (s.phase !== 'playing' && s.phase !== 'boss') return;
  const armor = Math.max(0, s.armor - amount);
  game.set({ armor, hurtAt: performance.now() });
  if (armor === 0) {
    game.set({ phase: 'defeat', creatures: [], rifts: s.rifts.map((r) => ({ ...r, open: false })) });
    showBanner('defeat');
  }
}

/** Records a hit; returns the creature's remaining hp. */
export function damageCreature(id: number): number {
  const creature = game.get().creatures.find((c) => c.id === id);
  if (!creature) return 0;
  const hp = Math.max(0, creature.hp - 1);
  game.set((s) => ({ creatures: s.creatures.map((c) => (c.id === id ? { ...c, hp } : c)) }));
  return hp;
}

/** Removes a creature after its death animation and counts the kill. */
export function removeCreature(id: number): void {
  const s = game.get();
  const creature = s.creatures.find((c) => c.id === id);
  if (!creature) return;
  const creatures = s.creatures.filter((c) => c.id !== id);
  if (creature.kind === 'boss') {
    game.set({ creatures, phase: 'cleared' });
    showBanner('bossDown');
    return;
  }
  game.set({ creatures, killed: s.killed + 1 });
}
