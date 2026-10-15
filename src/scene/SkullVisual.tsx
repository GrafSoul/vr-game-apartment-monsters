import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, DoubleSide, Group, Mesh, ShaderMaterial } from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { makeDissolvable, type DissolveUniforms } from '../fx/dissolve';

const URL = '/models/skull.glb';
const JAW_CLIP = 'Open Close Jaw';
const SKULL_TILT = -Math.PI / 2;
const SKULL_OFFSET: [number, number, number] = [0.082, -0.015, -0.045];

const NOISE = /* glsl */ `
  float h3(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float n3(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
  float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*n3(p); p*=2.07; a*=.5; } return s; }
`;

/** A shell of licking flames: noise rises upward, the top half stretches into tongues that fade at the tips. */
function flameMaterial(seed: number, brightness: number): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    uniforms: { uTime: { value: seed }, uIntensity: { value: 1 }, uBright: { value: brightness } },
    vertexShader: /* glsl */ `
      uniform float uTime, uIntensity; varying vec3 vPos; varying vec3 vN; varying vec3 vView; ${NOISE}
      void main(){
        vec3 p = position;
        float n = fbm(p*2.6 + vec3(0.0, -uTime*2.4, 0.0));
        p += normal * n * 0.32;
        float up = max(0.0, p.y);
        p.y += up * up * (0.7 + n * 1.1) * uIntensity;
        vPos = position;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vView = -mv.xyz;
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uIntensity, uBright; varying vec3 vPos; varying vec3 vN; varying vec3 vView; ${NOISE}
      void main(){
        float fr = 1.0 - abs(dot(normalize(vN), normalize(vView)));
        float n = fbm(vPos*4.2 + vec3(0.0, -uTime*3.2, 0.0));
        float h = clamp(vPos.y*0.5 + 0.5, 0.0, 1.0);
        // Ragged tongues with gaps: high threshold on rising noise, stronger at the silhouette.
        float a = smoothstep(0.46, 0.86, n + fr*0.3) * pow(fr, 0.8) * uIntensity * 0.8;
        a *= smoothstep(1.0, 0.42, h*0.9 + n*0.4);   // tips burn out
        a *= smoothstep(-0.05, 0.3, h + n*0.25);     // thin at the base
        vec3 col = mix(vec3(1.0, 0.22, 0.02), vec3(1.0, 0.82, 0.32), n*n + (1.0 - h)*0.25);
        gl_FragColor = vec4(col * uBright, a);
      }`,
  });
}

/** Props for {@link SkullVisual}. */
interface SkullVisualProps {
  /** Flame strength and jaw speed: 1 normal, up to ~2 while charging at the player. */
  intensity?: number;
  /** Dissolve uniforms shared with the creature; the flames and eyes fade out with the bone. */
  dissolve?: DissolveUniforms;
}

/**
 * The burning skull: the model with its jaw-snap loop, two flame shells, glowing eye sockets and an
 * orange light on the bone. Pure visuals; behaviour lives in the creature component that uses it.
 */
export function SkullVisual({ intensity = 1, dissolve }: SkullVisualProps) {
  const gltf = useGLTF(URL);
  const scene = useMemo(() => {
    const copy = cloneSkinned(gltf.scene);
    if (dissolve) makeDissolvable(copy, {}, dissolve);
    return copy;
  }, [gltf.scene, dissolve]);
  const root = useRef<Group>(null);
  const { actions } = useAnimations(gltf.animations, root);
  const outer = useMemo(() => flameMaterial(0, 1.2), []);
  const inner = useMemo(() => flameMaterial(7.3, 1.7), []);
  const eyes = useRef<Mesh[]>([]);
  const strength = useRef(intensity);

  useEffect(() => {
    actions[JAW_CLIP]?.reset().play();
  }, [actions]);

  useFrame((state, delta) => {
    strength.current += (intensity - strength.current) * Math.min(1, delta * 4);
    // The jaw snaps faster as the flames flare: a charging skull chatters.
    const jaw = actions[JAW_CLIP];
    if (jaw) jaw.timeScale = 1.1 + 0.9 * strength.current;
    const alive = 1 - (dissolve?.uDissolve.value ?? 0);
    for (const m of [outer, inner]) {
      m.uniforms.uTime.value += delta;
      m.uniforms.uIntensity.value = strength.current * alive;
    }
    const flicker = 0.85 + Math.sin(state.clock.elapsedTime * 23) * 0.08 + Math.sin(state.clock.elapsedTime * 7.7) * 0.07;
    eyes.current.forEach((e) => e.scale.setScalar(flicker * strength.current * alive));
  });

  return (
    <group ref={root}>
      {/*
        Like the mutant, the clip was authored for another up-axis: these two turns put the jaw down and the face
        forward (+Z), measured from the skinned vertices; the offset centres the cranium on the origin.
      */}
      <group position={SKULL_OFFSET}>
        <group rotation-z={Math.PI / 2}>
          <group rotation-x={SKULL_TILT}>
            <primitive object={scene} />
          </group>
        </group>
      </group>
      {/* Eye sockets: hot cores that read even in bright passthrough. */}
      {[-1, 1].map((side, i) => (
        <mesh
          key={side}
          ref={(m) => {
            if (m) eyes.current[i] = m;
          }}
          position={[side * 0.047, 0.035, 0.1]}
        >
          <sphereGeometry args={[0.022, 12, 8]} />
          <meshBasicMaterial color="#ffb347" transparent opacity={0.95} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
      <mesh material={outer} scale={[0.2, 0.22, 0.22]} position={[0, 0.03, -0.01]}>
        <icosahedronGeometry args={[1, 5]} />
      </mesh>
      <mesh material={inner} scale={[0.15, 0.16, 0.17]} position={[0, 0.02, 0]}>
        <icosahedronGeometry args={[1, 4]} />
      </mesh>
      <pointLight color="#ff7a30" intensity={2.2} distance={1.6} decay={2} position={[0, 0.05, 0.2]} />
    </group>
  );
}

useGLTF.preload(URL);
