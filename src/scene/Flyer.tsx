import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Color, Group, MathUtils, Sphere, Vector3 } from 'three';
import { playImpact } from '../fx/audio';
import { dissolveUniforms } from '../fx/dissolve';
import { fx } from '../fx/Effects';
import { joinCrowd, separation } from '../game/crowd';
import { damageCreature, game, hurtPlayer, removeCreature, type Creature, type Species } from '../game/game';
import { pulseBoth } from '../input/haptics';
import { registerTarget } from '../state/targets';
import { FlyerVisual } from './FlyerVisual';

type Mode = 'emerging' | 'fly' | 'windup' | 'dash' | 'charge' | 'dying' | 'burst';

/** Per-species tuning. Orbs are the baseline; winged skulls are quicker and dive; flaming skulls ram. */
interface Kind {
  /** Model scale. */
  scale: number;
  /** Hit sphere radius, metres. */
  hitRadius: number;
  /** Collision radius against other creatures, metres. */
  bodyRadius: number;
  /** How fast it circles the player (phase multiplier). */
  agility: number;
  /** Height of its orbit relative to the eyes. */
  orbitLift: number;
  windup: number;
  dash: number;
  /** Seconds of hovering between dashes on a given level. */
  dashEvery: (level: number) => number;
}

const KINDS: Record<Species, Kind> = {
  orb: { scale: 0.75, hitRadius: 0.3, bodyRadius: 0.32, agility: 1, orbitLift: -0.15, windup: 0.7, dash: 1.3, dashEvery: (l) => Math.max(3.5, 8 - l) + Math.random() * 3 },
  wingskull: { scale: 0.7, hitRadius: 0.32, bodyRadius: 0.36, agility: 1.7, orbitLift: 0.35, windup: 0.45, dash: 0.95, dashEvery: (l) => Math.max(2.5, 6 - l * 0.6) + Math.random() * 2 },
  fireskull: { scale: 1.4, hitRadius: 0.22, bodyRadius: 0.24, agility: 1.3, orbitLift: 0, windup: 1.2, dash: 0, dashEvery: () => 0 },
};

const EMERGE_TIME = 1.6;
/** At the peak of a dash closer than this to the eyes, the creature bites. */
const BITE_RANGE = 0.7;
/** Flaming skull: ramming speed, the distance at which it bursts on the player, and how long it may chase. */
const CHARGE_SPEED = 3.2;
const BURST_RANGE = 0.35;
const CHARGE_TIMEOUT = 4;

/**
 * One small flyer: squeezes out of its rift, then by species either circles the player and dashes in to
 * bite (orbs, winged skulls diving from above) or hangs still, flares up and rams the player (flaming
 * skulls, which burst on contact). Shot down, it dissolves.
 */
export function Flyer({ creature }: { creature: Creature }) {
  const kind = KINDS[creature.species];
  const root = useRef<Group>(null);
  const camera = useThree((s) => s.camera);
  const dissolve = useMemo(() => dissolveUniforms(new Color(1, 0.55, 0.2)), []);
  const sphere = useMemo(() => new Sphere(new Vector3(), kind.hitRadius), [kind.hitRadius]);
  const [charging, setCharging] = useState(false);
  const sim = useRef({
    mode: 'emerging' as Mode,
    t: 0,
    phase: creature.id * 1.7,
    side: (creature.id % 3) - 1,
    // First dash 4–7 s after release, varied by id so creatures released together do not dash in sync.
    dashIn: 4 + ((creature.id * 37) % 30) / 10,
    dashFrom: new Vector3(),
    velocity: new Vector3(),
    bitten: false,
  });

  useEffect(() => joinCrowd(creature.id, kind.bodyRadius), [creature.id, kind.bodyRadius]);

  useEffect(
    () =>
      registerTarget({
        id: `flyer-${creature.id}`,
        sphere,
        isAlive: () => sim.current.mode !== 'dying' && sim.current.mode !== 'burst',
        onHit: (point) => {
          fx.sparks(point, 0xffb050, 40, 2.2);
          const hp = damageCreature(creature.id);
          playImpact(hp === 0);
          if (hp === 0) {
            if (creature.species === 'fireskull') fx.sparks(point, 0xff7a30, 90, 3.2);
            sim.current.mode = 'dying';
            sim.current.t = 0;
          }
        },
      }),
    [creature.id, creature.species, sphere],
  );

  useFrame((_, delta) => {
    const group = root.current;
    if (!group || game.get().paused) return;
    const s = sim.current;
    const dt = Math.min(delta, 0.05);
    s.t += dt;
    s.phase += dt * kind.agility;
    const { position: spawn, normal } = creature.spawn;
    const eye = camera.getWorldPosition(new Vector3());
    const towardWall = spawn.clone().sub(eye).setY(0);
    const distance = towardWall.length();
    towardWall.normalize();
    const right = new Vector3(-towardWall.z, 0, towardWall.x);
    const centre = eye
      .clone()
      .addScaledVector(towardWall, Math.min(1.9, distance * 0.6))
      .addScaledVector(right, s.side * 0.5)
      .setY(Math.max(1.25, eye.y + kind.orbitLift));
    const orbit = centre.add(new Vector3(Math.sin(s.phase * 0.6) * 0.6, Math.sin(s.phase * 1.3) * 0.2, Math.sin(s.phase * 0.45) * 0.3));

    switch (s.mode) {
      case 'emerging': {
        const k = MathUtils.smootherstep(s.t / EMERGE_TIME, 0, 1);
        const behind = spawn.clone().addScaledVector(normal, -0.35);
        const out = spawn.clone().addScaledVector(normal, 0.7);
        group.position.lerpVectors(behind, out, Math.min(1, k * 1.4));
        if (k > 0.7) group.position.lerp(orbit, (k - 0.7) / 0.3);
        group.scale.setScalar(kind.scale * (0.5 + 0.5 * k));
        if (s.t >= EMERGE_TIME) {
          // Flaming skulls do not circle: they stop where they came out and wind up straight away.
          s.mode = creature.species === 'fireskull' ? 'windup' : 'fly';
          s.t = 0;
          s.dashFrom.copy(group.position);
        }
        break;
      }
      case 'fly':
        group.position.lerp(orbit, Math.min(1, dt * 2.5 * kind.agility));
        if (s.t > s.dashIn) {
          s.mode = 'windup';
          s.t = 0;
          s.dashFrom.copy(group.position);
        }
        break;
      case 'windup': {
        const k = s.t / kind.windup;
        const shake = 0.012 + 0.03 * k;
        group.position.copy(s.dashFrom).add(new Vector3(MathUtils.randFloatSpread(shake), MathUtils.randFloatSpread(shake), MathUtils.randFloatSpread(shake)));
        group.scale.setScalar(kind.scale * (1 + 0.12 * Math.sin(s.t * 40)));
        if (s.t >= kind.windup) {
          group.scale.setScalar(kind.scale);
          s.t = 0;
          s.bitten = false;
          if (creature.species === 'fireskull') {
            s.mode = 'charge';
            s.velocity.copy(eye).sub(group.position).normalize().multiplyScalar(CHARGE_SPEED);
            setCharging(true);
          } else {
            s.mode = 'dash';
          }
        }
        break;
      }
      case 'dash': {
        const k = MathUtils.clamp(s.t / kind.dash, 0, 1);
        const target = eye.clone().addScaledVector(s.dashFrom.clone().sub(eye).normalize(), 0.45);
        const out = k < 0.35 ? MathUtils.smootherstep(k / 0.35, 0, 1) : 1 - MathUtils.smootherstep((k - 0.35) / 0.65, 0, 1);
        group.position.lerpVectors(s.dashFrom, target, out);
        if (!s.bitten && k >= 0.35) {
          s.bitten = true;
          if (group.position.distanceTo(eye) < BITE_RANGE) {
            hurtPlayer(1);
            pulseBoth(1, 220);
            playImpact(true);
          }
        }
        if (k >= 1) {
          s.mode = 'fly';
          s.t = 0;
          s.dashIn = kind.dashEvery(game.get().level);
        }
        break;
      }
      case 'charge': {
        // Homes in a little, so stepping aside late still works but standing still does not.
        const want = eye.clone().sub(group.position).normalize().multiplyScalar(CHARGE_SPEED);
        s.velocity.lerp(want, Math.min(1, dt * 1.5));
        group.position.addScaledVector(s.velocity, dt);
        if (group.position.distanceTo(eye) < BURST_RANGE || s.t > CHARGE_TIMEOUT) {
          if (group.position.distanceTo(eye) < BURST_RANGE + 0.15) {
            hurtPlayer(1);
            pulseBoth(1, 300);
          }
          playImpact(true);
          fx.sparks(group.position.clone(), 0xff7a30, 120, 3.5);
          // Gone in a flash: hide it now, the store drops it on this removal (it still counts towards the level).
          dissolve.uDissolve.value = 1;
          s.mode = 'burst';
          removeCreature(creature.id);
        }
        break;
      }
      case 'dying':
        dissolve.uDissolve.value = Math.min(1, s.t / 0.8);
        group.position.y -= dt * 0.25;
        if (s.t > 0.9 && s.mode === 'dying') {
          s.mode = 'burst';
          removeCreature(creature.id);
        }
        break;
      case 'burst':
        return;
    }
    // Shove apart from other creatures instead of passing through them (not while squeezing out of a rift).
    if (s.mode === 'fly' || s.mode === 'windup' || s.mode === 'dash') group.position.add(separation(creature.id, group.position));
    if (s.mode !== 'dying') group.lookAt(eye);
    sphere.center.copy(group.position);
  });

  return (
    <group ref={root}>
      <FlyerVisual species={creature.species} dissolve={dissolve} intensity={charging ? 2 : 1} seed={creature.id * 2.3} />
    </group>
  );
}
