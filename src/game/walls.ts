import { MathUtils, Vector3 } from 'three';
import { createStore } from '../state/createStore';
import type { SpawnPoint } from './game';

/** A vertical wall rectangle in world space, from the headset's room setup. */
export interface Wall {
  center: Vector3;
  /** Unit normal facing into the room. */
  normal: Vector3;
  /** Unit horizontal direction along the wall. */
  along: Vector3;
  halfWidth: number;
  bottom: number;
  top: number;
}

/** Walls detected in the room; empty without room setup. */
export const walls = createStore<{ list: Wall[] }>({ list: [] });

const UP = new Vector3(0, 1, 0);
const MIN_DISTANCE = 1.4;
const MAX_DISTANCE = 6;
const EDGE_MARGIN = 0.35;
const VIRTUAL_RADIUS = 3;

/** Options for picking spawn points. */
export interface SpotQuery {
  count: number;
  /** Minimum distance between picked points, metres. */
  separation: number;
  /** Centre height above the floor, or null for a random 0.9–1.9 m. */
  height: number | null;
  /** Points must lie within this many degrees of where the player looks, so creatures appear in view. */
  maxAngle: number;
}

/** A wall straight ahead of the player at a fixed distance, for rooms without a wall in view. */
function virtualWallAhead(eye: Vector3, forward: Vector3): Wall {
  const center = eye.clone().addScaledVector(forward, VIRTUAL_RADIUS).setY(1.4);
  const normal = forward.clone().negate();
  return { center, normal, along: new Vector3().crossVectors(UP, normal).normalize(), halfWidth: 2, bottom: 0, top: 2.4 };
}

function sample(pool: Wall[], eye: Vector3, forward: Vector3, q: SpotQuery, picked: SpawnPoint[]): void {
  const maxAngle = MathUtils.degToRad(q.maxAngle);
  for (let attempt = 0; attempt < 160 && picked.length < q.count; attempt++) {
    const wall = pool[Math.floor(Math.random() * pool.length)];
    const usable = wall.halfWidth - EDGE_MARGIN;
    if (usable <= 0) continue;
    const y = q.height ?? MathUtils.randFloat(0.9, 1.9);
    if (y < wall.bottom + 0.3 || y > wall.top - 0.3) continue;
    const position = wall.center.clone().addScaledVector(wall.along, MathUtils.randFloatSpread(usable * 2)).setY(y);
    const flat = position.clone().sub(eye).setY(0);
    const distance = flat.length();
    if (distance < MIN_DISTANCE || distance > MAX_DISTANCE) continue;
    if (flat.normalize().angleTo(forward) > maxAngle) continue;
    if (picked.some((p) => p.position.distanceTo(position) < q.separation)) continue;
    picked.push({ position, normal: wall.normal.clone() });
  }
}

/** Picks spawn points on walls in the player's view; tops up from a virtual wall ahead if the room has too few. */
export function pickSpots(eye: Vector3, facing: Vector3, q: SpotQuery): SpawnPoint[] {
  const forward = facing.clone().setY(0);
  if (forward.lengthSq() < 1e-4) forward.set(0, 0, -1);
  forward.normalize();
  const picked: SpawnPoint[] = [];
  const room = walls.get().list;
  if (room.length > 0) sample(room, eye, forward, q, picked);
  if (picked.length < q.count) sample([virtualWallAhead(eye, forward)], eye, forward, q, picked);
  return picked;
}

/** The single wall point closest to straight ahead, for the boss to come through where the player is looking. */
export function pickFrontSpot(eye: Vector3, facing: Vector3, height: number): SpawnPoint | null {
  const forward = facing.clone().setY(0);
  if (forward.lengthSq() < 1e-4) forward.set(0, 0, -1);
  forward.normalize();
  const candidates = pickSpots(eye, facing, { count: 12, separation: 0.3, height, maxAngle: 25 });
  let best: SpawnPoint | null = null;
  let bestAngle = Infinity;
  for (const c of candidates) {
    const angle = c.position.clone().sub(eye).setY(0).normalize().angleTo(forward);
    if (angle < bestAngle) {
      bestAngle = angle;
      best = c;
    }
  }
  return best;
}
