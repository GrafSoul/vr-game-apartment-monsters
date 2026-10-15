import { Vector3 } from 'three';

/** A creature's body for overlap checks: a sphere around its centre of mass. */
interface Body {
  centre: Vector3;
  radius: number;
}

const bodies = new Map<number, Body>();
const push = new Vector3();

/** Registers a creature body; returns the unregister function for effect cleanup. */
export function joinCrowd(id: number, radius: number): () => void {
  bodies.set(id, { centre: new Vector3(), radius });
  return () => {
    bodies.delete(id);
  };
}

/**
 * Updates a creature's body centre and returns how far to move it so it stops overlapping others.
 * Each creature resolves its own half of an overlap, so a pair separates evenly in one frame.
 * With `flat`, the push stays horizontal (walkers keep their feet on the floor).
 */
export function separation(id: number, centre: Vector3, flat = false): Vector3 {
  const self = bodies.get(id);
  push.set(0, 0, 0);
  if (!self) return push;
  self.centre.copy(centre);
  for (const [otherId, other] of bodies) {
    if (otherId === id) continue;
    const away = centre.clone().sub(other.centre);
    if (flat) away.y = 0;
    const distance = away.length();
    const overlap = self.radius + other.radius - distance;
    if (overlap <= 0) continue;
    if (distance < 1e-4) away.set(Math.cos(id), 0, Math.sin(id));
    push.addScaledVector(away.normalize(), overlap / 2);
  }
  return push;
}
