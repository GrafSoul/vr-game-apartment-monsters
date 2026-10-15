import { Ray, Sphere, Vector3 } from 'three';

/** A shootable creature, approximated by a sphere that its component keeps up to date every frame. */
export interface HitTarget {
  id: string;
  sphere: Sphere;
  isAlive: () => boolean;
  onHit: (point: Vector3) => void;
}

/** Result of a shot: the first target the ray meets. */
export interface TargetHit {
  target: HitTarget;
  point: Vector3;
  distance: number;
}

const targets = new Map<string, HitTarget>();
const ray = new Ray();
const hitPoint = new Vector3();

/** Registers a target and returns the unregister function for effect cleanup. */
export function registerTarget(target: HitTarget): () => void {
  targets.set(target.id, target);
  return () => {
    targets.delete(target.id);
  };
}

/** Finds the closest live target along a ray, up to `maxDistance` metres. */
export function raycastTargets(origin: Vector3, direction: Vector3, maxDistance: number): TargetHit | null {
  ray.set(origin, direction);
  let best: TargetHit | null = null;
  for (const target of targets.values()) {
    if (!target.isAlive()) continue;
    if (!ray.intersectSphere(target.sphere, hitPoint)) continue;
    const distance = hitPoint.distanceTo(origin);
    if (distance > maxDistance || (best && distance >= best.distance)) continue;
    best = { target, point: hitPoint.clone(), distance };
  }
  return best;
}
