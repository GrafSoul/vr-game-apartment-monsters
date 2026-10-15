import { useFrame, useThree } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import { useEffect, useRef } from 'react';
import { Vector3 } from 'three';
import { playAt } from '../fx/audio';
import { game, newId, showBanner, startLevel, type Rift, type SpawnPoint } from './game';
import { BANNER_TIME, bossHp, DECOY_RIFTS, hpFor, isBossLevel, maxAlive, pickSpecies, RIFT_WARMUP, spawnDelay } from './rules';
import { pickFrontSpot, pickSpots } from './walls';

/** A spawn in progress: rifts glowing, creature not out yet. */
interface PendingSpawn {
  kind: 'small' | 'boss';
  real: SpawnPoint;
  realRift: number;
  decoys: number[];
  t: number;
}

const BOSS_HEIGHT = 1.05;
/** Rifts open within this many degrees of the player's gaze, so creatures come out in view. */
const SPAWN_VIEW_ANGLE = 35;

/**
 * Runs the level: opens decoy and real rifts, releases creatures, counts kills,
 * calls the boss on every third level, and moves through intro → playing → (boss) → cleared → next level.
 * Starts level 1 when MR begins.
 */
export function Director() {
  const camera = useThree((s) => s.camera);
  const inXR = useXR((s) => s.session != null);
  const flow = useRef({ spawnTimer: 1.2, phaseTime: 0, pending: null as PendingSpawn | null, closeAt: [] as Array<{ id: number; t: number }> });

  useEffect(() => {
    if (inXR) startLevel(1);
    else game.set({ phase: 'idle', creatures: [], rifts: [], banner: null });
  }, [inXR]);

  const openRifts = (spots: SpawnPoint[], size: Rift['size']): number[] => {
    const rifts = spots.map((s) => ({ ...s, id: newId(), size, open: true }));
    game.set((st) => ({ rifts: [...st.rifts, ...rifts] }));
    rifts.forEach((r) => playAt('rift', r.position));
    return rifts.map((r) => r.id);
  };

  const closeRift = (id: number) => game.set((st) => ({ rifts: st.rifts.map((r) => (r.id === id ? { ...r, open: false } : r)) }));

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const s = game.get();
    const f = flow.current;
    if (s.paused || s.phase === 'idle') return;
    f.phaseTime += dt;

    // Scheduled rift closings.
    f.closeAt = f.closeAt.filter((c) => {
      c.t -= dt;
      if (c.t > 0) return true;
      closeRift(c.id);
      return false;
    });
    // Drop closed rifts once their fade-out is long over.
    if (s.rifts.length > 12) game.set({ rifts: s.rifts.filter((r) => r.open) });

    const eye = camera.getWorldPosition(new Vector3());
    const facing = camera.getWorldDirection(new Vector3());

    switch (s.phase) {
      case 'intro':
        if (f.phaseTime > BANNER_TIME) {
          game.set({ phase: 'playing', banner: null });
          f.phaseTime = 0;
          f.spawnTimer = 1;
        }
        break;
      case 'playing': {
        if (s.killed >= s.target) {
          f.phaseTime = 0;
          if (isBossLevel(s.level)) {
            game.set({ phase: 'boss' });
            showBanner('boss');
            const spot = pickFrontSpot(eye, facing, BOSS_HEIGHT);
            if (spot) f.pending = { kind: 'boss', real: spot, realRift: openRifts([spot], 'boss')[0], decoys: [], t: 0 };
          } else {
            game.set({ phase: 'cleared' });
            showBanner('cleared');
          }
          break;
        }
        const alive = s.creatures.filter((c) => c.kind === 'small').length;
        f.spawnTimer -= dt;
        if (!f.pending && f.spawnTimer <= 0 && alive < maxAlive(s.level) && s.released < s.target) {
          const spots = pickSpots(eye, facing, { count: 1 + DECOY_RIFTS, separation: 0.8, height: null, maxAngle: SPAWN_VIEW_ANGLE });
          if (spots.length > 0) {
            const realIndex = Math.floor(Math.random() * spots.length);
            const ids = openRifts(spots, 'small');
            f.pending = { kind: 'small', real: spots[realIndex], realRift: ids[realIndex], decoys: ids.filter((_, i) => i !== realIndex), t: 0 };
            game.set({ released: s.released + 1 });
          }
          f.spawnTimer = spawnDelay(s.level) * (0.7 + Math.random() * 0.6);
        }
        break;
      }
      case 'boss':
        if (f.phaseTime > BANNER_TIME && s.banner) game.set({ banner: null });
        break;
      case 'cleared':
      case 'defeat':
        if (f.phaseTime > BANNER_TIME + 0.6) {
          f.pending = null;
          startLevel(s.phase === 'cleared' ? s.level + 1 : s.level);
          f.phaseTime = 0;
        }
        break;
    }

    // Release the creature once the rifts have glowed long enough.
    const p = f.pending;
    if (p && (s.phase === 'playing' || s.phase === 'boss')) {
      p.t += dt;
      const warmup = p.kind === 'boss' ? RIFT_WARMUP + 1.2 : RIFT_WARMUP;
      if (p.t >= warmup) {
        const species = pickSpecies(s.level);
        const hp = p.kind === 'boss' ? bossHp(s.level) : hpFor(species, s.level);
        game.set((st) => ({ creatures: [...st.creatures, { id: newId(), kind: p.kind, species, hp, maxHp: hp, spawn: p.real }] }));
        p.decoys.forEach((id) => f.closeAt.push({ id, t: 0.25 }));
        f.closeAt.push({ id: p.realRift, t: p.kind === 'boss' ? 3.5 : 1.8 });
        f.pending = null;
      }
    } else if (p && s.phase !== 'playing' && s.phase !== 'boss') {
      f.pending = null;
    }
  });

  // Reset timers whenever the phase changes from outside (defeat, boss death).
  const phase = game.use((s) => s.phase);
  useEffect(() => {
    flow.current.phaseTime = 0;
  }, [phase]);

  return null;
}
