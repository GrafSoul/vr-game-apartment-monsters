import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Box3, Color, Group, Matrix4, Mesh, Object3D, Vector3 } from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { dissolveUniforms, makeDissolvable, type DissolveUniforms } from '../fx/dissolve';
import type { Species } from '../game/game';
import { SkullVisual } from './SkullVisual';

const ORB_URL = `${import.meta.env.BASE_URL}models/orb.glb`;
const WING_URL = `${import.meta.env.BASE_URL}models/wingskull.glb`;
const AXES = ['x', 'y', 'z'] as const;
/** Wing beats per second × 2π. The body bob is locked to it so the downstroke lifts the skull. */
const FLAP_RATE = 7.5;

const f = (n: number) => n.toFixed(5);
const mat4 = (m: Matrix4) => `mat4(${m.elements.map(f).join(',')})`;

/**
 * Wraps root-space GLSL motion for one mesh: the vertex goes from mesh space to the model root, `p` moves
 * there (the body may use `p` and `uMotionTime`), then it comes back. Root space is shared by every mesh,
 * so separate parts (stalks and the eyes on them) move together.
 */
function inRootSpace(root: Object3D, mesh: Mesh, body: string): string {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
  const fromRoot = toRoot.clone().invert();
  return /* glsl */ `{
    vec3 p = (${mat4(toRoot)} * vec4(transformed, 1.0)).xyz;
    float t = uMotionTime;
    ${body}
    transformed = (${mat4(fromRoot)} * vec4(p, 1.0)).xyz;
  }`;
}

/** Bounding box of `object` in `root`'s space. */
function boxIn(root: Object3D, object: Object3D): Box3 {
  root.updateMatrixWorld(true);
  const box = new Box3().setFromObject(object);
  return box.applyMatrix4(root.matrixWorld.clone().invert());
}

/**
 * Eye orb: the body breathes, and the further out a vertex is the more it sways, so the stalks writhe
 * and carry their eyes with them.
 */
function orbMotion(root: Object3D): (mesh: Mesh) => string {
  const box = boxIn(root, root);
  const c = box.getCenter(new Vector3());
  const radius = Math.max(...box.getSize(new Vector3()).toArray()) / 2;
  const k = 3.6 / radius;
  return (mesh) =>
    inRootSpace(
      root,
      mesh,
      /* glsl */ `
      vec3 d = p - vec3(${f(c.x)}, ${f(c.y)}, ${f(c.z)});
      float r = length(d);
      float stalk = smoothstep(${f(radius * 0.45)}, ${f(radius * 0.95)}, r);
      float breath = 1.0 + 0.035 * sin(t * 2.3) * (1.0 - stalk);
      d *= breath;
      d += vec3(sin(t*2.1 + d.y*${f(k)}), sin(t*1.7 + d.z*${f(k)} + 1.3), sin(t*1.9 + d.x*${f(k)} + 2.1)) * ${f(radius * 0.12)} * stalk * stalk;
      p = vec3(${f(c.x)}, ${f(c.y)}, ${f(c.z)}) + d;`,
    );
}

/**
 * Winged skull: the wings bend along their plane's normal (the thinnest axis of the wing mesh) by how far
 * out along the span they are, so the tips sweep most and pull in a little at the bottom of the beat.
 */
function wingMotion(root: Object3D): (mesh: Mesh) => string {
  return (mesh) => {
    if (!mesh.name.startsWith('Object_8')) return '';
    const box = boxIn(root, mesh);
    const c = box.getCenter(new Vector3());
    const dims = box.getSize(new Vector3()).toArray();
    const span = AXES[dims.indexOf(Math.max(...dims))];
    const normal = AXES[dims.indexOf(Math.min(...dims))];
    const half = Math.max(...dims) / 2;
    return inRootSpace(
      root,
      mesh,
      /* glsl */ `
      float off = p.${span} - ${f(c[span])};
      float out_ = max(0.0, abs(off) - ${f(half * 0.15)});
      float beat = sin(t * ${f(FLAP_RATE)});
      p.${normal} += beat * out_ * 0.8;
      p.${span} -= sign(off) * abs(beat) * out_ * 0.12;`,
    );
  };
}

function Orb({ dissolve }: { dissolve: DissolveUniforms }) {
  const gltf = useGLTF(ORB_URL);
  const scene = useMemo(() => {
    const copy = cloneSkinned(gltf.scene);
    makeDissolvable(copy, { vertexMotion: orbMotion(copy) }, dissolve);
    return copy;
  }, [gltf.scene, dissolve]);
  return <primitive object={scene} />;
}

function WingSkull({ dissolve }: { dissolve: DissolveUniforms }) {
  const gltf = useGLTF(WING_URL);
  const scene = useMemo(() => {
    const copy = cloneSkinned(gltf.scene);
    makeDissolvable(copy, { vertexMotion: wingMotion(copy) }, dissolve);
    return copy;
  }, [gltf.scene, dissolve]);
  // The model faces +X: turn it to face +Z like every other creature.
  return (
    <group rotation-y={-Math.PI / 2}>
      <primitive object={scene} />
    </group>
  );
}

/** Props for {@link FlyerVisual}. */
interface FlyerVisualProps {
  species: Species;
  /** Shared dissolve uniforms from the behaviour component; created locally when omitted. */
  dissolve?: DissolveUniforms;
  /** Flaming skull only: flame strength and jaw speed (higher while charging). */
  intensity?: number;
  /** Phase offset so creatures released together do not move in step. */
  seed?: number;
}

/**
 * One flyer's look by species, with dissolve and "alive" motion wired in: vertex motion inside the model
 * (stalks, wings, jaw) plus a bob and sway of the whole body. Where it flies is up to the parent.
 */
export function FlyerVisual({ species, dissolve, intensity = 1, seed = 0 }: FlyerVisualProps) {
  const uniforms = useMemo(() => dissolve ?? dissolveUniforms(new Color(1, 0.55, 0.2)), [dissolve]);
  const body = useRef<Group>(null);

  useFrame((_, delta) => {
    uniforms.uMotionTime.value += delta;
    const g = body.current;
    if (!g) return;
    const t = uniforms.uMotionTime.value + seed;
    if (species === 'orb') {
      g.position.y = Math.sin(t * 1.6) * 0.035;
      g.rotation.set(Math.sin(t * 0.9) * 0.12, Math.sin(t * 0.6) * 0.18, Math.sin(t * 1.1) * 0.1);
    } else if (species === 'wingskull') {
      g.position.y = -Math.sin(t * FLAP_RATE) * 0.04;
      g.rotation.set(Math.sin(t * FLAP_RATE) * 0.08, Math.sin(t * 0.7) * 0.15, Math.sin(t * 1.3) * 0.12);
    } else {
      g.position.y = Math.sin(t * 2.2) * 0.02;
      // Twitchy head: a slow look-around plus small jerks.
      g.rotation.set(Math.sin(t * 1.4) * 0.15 + Math.sin(t * 9.1) * 0.03, Math.sin(t * 0.8) * 0.25, Math.sin(t * 1.9) * 0.12);
    }
  });

  return (
    <group ref={body}>
      {species === 'orb' && <Orb dissolve={uniforms} />}
      {species === 'wingskull' && <WingSkull dissolve={uniforms} />}
      {species === 'fireskull' && <SkullVisual intensity={intensity} dissolve={uniforms} />}
    </group>
  );
}

useGLTF.preload(ORB_URL);
useGLTF.preload(WING_URL);
