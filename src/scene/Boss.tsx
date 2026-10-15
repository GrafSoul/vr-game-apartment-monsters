import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AnimationAction, AnimationClip, Group, LoopOnce, LoopRepeat, MathUtils, Plane, Sphere, Vector3 } from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { playImpact } from '../fx/audio';
import { makeDissolvable } from '../fx/dissolve';
import { fx } from '../fx/Effects';
import { joinCrowd, separation } from '../game/crowd';
import { damageCreature, game, hurtPlayer, removeCreature, type Creature } from '../game/game';
import { pulseBoth } from '../input/haptics';
import { registerTarget } from '../state/targets';

const URL = '/models/mutant.glb';
const CLIPS = {
  idle: 'Armature|Armature|Armature|Armature|IdleComplete',
  jump: 'Jump',
  walk: 'Walk_InPlace',
} as const;
type ClipKey = keyof typeof CLIPS;
type Mode = 'emerging' | 'stalk' | 'idle' | 'lunge' | 'dying';

const SCALE = 1.25;
const HEIGHT = 1.4 * SCALE;
const EMERGE_TIME = 3.2;
const LUNGE_TIME = 0.9;
const STALK_SPEED = 0.4;
const NEAR = 1.5;
const FAR = 2.4;
const LUNGE_STOP = 0.85;
/** A lunge that ends closer than this to the player's eyes (horizontally) lands a bite. */
const BITE_RANGE = 1.15;
/** Collision radius against other creatures (horizontal), metres. */
const BODY_RADIUS = 0.5;
/**
 * Ground speed the walk cycle covers at timeScale 1 for this model at SCALE, m/s. Playback speed is set from the
 * actual movement speed so the feet stay planted instead of sliding. Tune if the feet skate in the headset.
 */
const WALK_CYCLE_SPEED = 0.75;
const EMERGE_DISTANCE = 1.7;

/** Walk-cycle playback speed that matches a ground speed in m/s. */
const walkRate = (speed: number) => speed / WALK_CYCLE_SPEED;

/** The boss: the Three-Head Baby Mutant walks out through the wall, stalks the player and lunges. */
export function Boss({ creature }: { creature: Creature }) {
  const gltf = useGLTF(URL);
  const root = useRef<Group>(null);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const { position: spot, normal } = creature.spawn;
  // Hides the part of the body still "inside" the wall: keeps only what is on the room side.
  const clip = useMemo(() => new Plane(normal.clone(), -normal.dot(spot)), [normal, spot]);
  // A fresh copy per boss, so the next boss does not inherit the previous one's dissolved materials.
  const scene = useMemo(() => cloneSkinned(gltf.scene), [gltf.scene]);
  const dissolve = useMemo(() => makeDissolvable(scene, { clip: [clip] }), [scene, clip]);
  // Drop scale tracks only; translations and rotations carry the pose.
  const clips = useMemo(
    () => gltf.animations.map((c) => new AnimationClip(c.name, c.duration, c.tracks.filter((t) => !t.name.endsWith('.scale')))),
    [gltf.animations],
  );
  const { actions, mixer } = useAnimations(clips, root);
  const sphere = useMemo(() => new Sphere(new Vector3(), 0.55), []);
  const sim = useRef({ mode: 'emerging' as Mode, t: 0, from: new Vector3(), to: new Vector3(), current: null as AnimationAction | null, bitten: false });
  const base = useMemo(() => new Vector3(spot.x, 0, spot.z), [spot]);

  const play = (key: ClipKey, { once = false, speed = 1, fade = 0.25 } = {}) => {
    const next = actions[CLIPS[key]];
    if (!next) return;
    const s = sim.current;
    next.reset();
    next.setLoop(once ? LoopOnce : LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    next.timeScale = speed;
    next.play();
    if (s.current && s.current !== next) next.crossFadeFrom(s.current, fade, false);
    s.current = next;
  };

  useEffect(() => {
    gl.localClippingEnabled = true;
    dissolve.uDissolve.value = 0;
    play('walk', { speed: walkRate(EMERGE_DISTANCE / EMERGE_TIME) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => joinCrowd(creature.id, BODY_RADIUS), [creature.id]);

  useEffect(
    () =>
      registerTarget({
        id: `boss-${creature.id}`,
        sphere,
        isAlive: () => sim.current.mode !== 'dying',
        onHit: (point) => {
          fx.sparks(point, 0xff5a3a, 36, 1.8);
          const hp = damageCreature(creature.id);
          playImpact(hp === 0);
          if (hp === 0) {
            sim.current.mode = 'dying';
            sim.current.t = 0;
            play('idle', { speed: 0.3, fade: 0.1 });
          } else if (root.current) {
            const away = root.current.position.clone().sub(camera.getWorldPosition(new Vector3())).setY(0).normalize();
            root.current.position.addScaledVector(away, 0.06);
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [creature.id, sphere],
  );

  useFrame((_, delta) => {
    const group = root.current;
    if (!group) return;
    const paused = game.get().paused;
    mixer.timeScale = paused ? 0 : 1;
    if (paused) return;
    const s = sim.current;
    const dt = Math.min(delta, 0.05);
    s.t += dt;
    const eye = camera.getWorldPosition(new Vector3());
    const flat = eye.clone().setY(group.position.y);
    const toPlayer = flat.clone().sub(group.position);
    const distance = toPlayer.length();

    switch (s.mode) {
      case 'emerging': {
        const k = MathUtils.clamp(s.t / EMERGE_TIME, 0, 1);
        group.position.copy(base).addScaledVector(normal, -0.8 + EMERGE_DISTANCE * k);
        group.lookAt(group.position.clone().add(normal));
        if (k >= 1) {
          clip.constant = 1000;
          s.mode = 'stalk';
          s.t = 0;
        }
        break;
      }
      case 'stalk':
        group.lookAt(flat);
        if (distance > NEAR) group.position.addScaledVector(toPlayer.normalize(), STALK_SPEED * dt);
        else {
          s.mode = 'idle';
          s.t = 0;
          play('idle');
        }
        break;
      case 'idle':
        group.lookAt(flat);
        if (distance > FAR) {
          s.mode = 'stalk';
          s.t = 0;
          play('walk', { speed: walkRate(STALK_SPEED) });
        } else if (s.t > 2.2) {
          s.mode = 'lunge';
          s.t = 0;
          s.bitten = false;
          s.from.copy(group.position);
          s.to.copy(group.position).addScaledVector(toPlayer.normalize(), Math.max(0, distance - LUNGE_STOP));
          play('jump', { once: true, speed: 1.4 });
        }
        break;
      case 'lunge': {
        group.lookAt(flat);
        const k = MathUtils.clamp(s.t / LUNGE_TIME, 0, 1);
        const out = k < 0.45 ? MathUtils.smootherstep(k / 0.45, 0, 1) : 1 - MathUtils.smootherstep((k - 0.45) / 0.55, 0, 1) * 0.7;
        group.position.lerpVectors(s.from, s.to, out);
        if (!s.bitten && k >= 0.45) {
          s.bitten = true;
          if (Math.hypot(group.position.x - eye.x, group.position.z - eye.z) < BITE_RANGE) {
            hurtPlayer(1);
            pulseBoth(1, 260);
            playImpact(true);
          }
        }
        if (k >= 1) {
          s.mode = 'idle';
          s.t = 0;
          play('idle');
        }
        break;
      }
      case 'dying':
        dissolve.uDissolve.value = Math.min(1, s.t / 1.3);
        if (s.t > 1.4) removeCreature(creature.id);
        break;
    }
    const chest = group.position.clone().setY(group.position.y + HEIGHT * 0.5);
    if (s.mode !== 'emerging' && s.mode !== 'dying') group.position.add(separation(creature.id, chest, true));
    sphere.center.copy(group.position).setY(group.position.y + HEIGHT * 0.55);
  });

  return (
    <group ref={root} scale={SCALE}>
      {/* The clips were authored for a Z-up skeleton; animated, the body lies along -Z. Stand it up. */}
      <group rotation-x={Math.PI / 2}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

useGLTF.preload(URL);
