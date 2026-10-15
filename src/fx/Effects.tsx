import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Mesh,
  MeshBasicMaterial,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';

const MAX_SPARKS = 400;
const TRACERS = 6;
const TRACER_LIFE = 0.09;
const UP = new Vector3(0, 1, 0);

interface Spark { life: number; max: number; position: Vector3; velocity: Vector3; color: Color }
interface Pending { kind: 'tracer'; from: Vector3; to: Vector3 }
interface PendingSparks { kind: 'sparks'; at: Vector3; color: Color; count: number; speed: number }

const queue: Array<Pending | PendingSparks> = [];

/** Fire-and-forget visual effects; the <Effects/> component drains this queue every frame. */
export const fx = {
  /** A short glowing bolt from the muzzle to where the shot landed. */
  tracer(from: Vector3, to: Vector3): void {
    queue.push({ kind: 'tracer', from: from.clone(), to: to.clone() });
  },
  /** A burst of sparks with gravity, e.g. a hit on a creature or a wall. */
  sparks(at: Vector3, color: Color | number, count = 30, speed = 2): void {
    queue.push({ kind: 'sparks', at: at.clone(), color: new Color(color), count, speed });
  },
};

/** Pooled tracers and sparks for the whole scene. */
export function Effects() {
  const { points, positions, colors, alphas, sparks, tracers } = useMemo(() => {
    const positions = new Float32Array(MAX_SPARKS * 3);
    const colors = new Float32Array(MAX_SPARKS * 3);
    const alphas = new Float32Array(MAX_SPARKS);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    geometry.setAttribute('aAlpha', new BufferAttribute(alphas, 1));
    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: `attribute float aAlpha; attribute vec3 color; varying float vA; varying vec3 vC;
        void main(){ vA=aAlpha; vC=color; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=0.03*(900.0/-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying float vA; varying vec3 vC;
        void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d)*vA; if(a<0.01) discard; gl_FragColor=vec4(vC*1.6,a); }`,
    });
    const points = new Points(geometry, material);
    points.frustumCulled = false;
    const sparks: Spark[] = Array.from({ length: MAX_SPARKS }, () => ({ life: 0, max: 1, position: new Vector3(), velocity: new Vector3(), color: new Color() }));
    const tracerGeometry = new CylinderGeometry(0.004, 0.004, 1, 6);
    const tracers = Array.from({ length: TRACERS }, () => {
      const mesh = new Mesh(tracerGeometry, new MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
      mesh.frustumCulled = false;
      mesh.userData.life = 0;
      return mesh;
    });
    return { points, positions, colors, alphas, sparks, tracers };
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    while (queue.length) {
      const item = queue.shift();
      if (!item) break;
      if (item.kind === 'tracer') {
        const mesh = tracers.find((t) => t.userData.life <= 0) ?? tracers[0];
        const dir = item.to.clone().sub(item.from);
        const length = dir.length();
        mesh.position.copy(item.from).addScaledVector(dir, 0.5);
        mesh.scale.set(1, length, 1);
        mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
        mesh.userData.life = TRACER_LIFE;
      } else {
        let left = item.count;
        for (const spark of sparks) {
          if (left <= 0) break;
          if (spark.life > 0) continue;
          spark.position.copy(item.at);
          spark.velocity.set(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5).normalize().multiplyScalar(item.speed * (0.3 + Math.random() * 0.7));
          spark.max = spark.life = 0.35 + Math.random() * 0.45;
          spark.color.copy(item.color);
          left--;
        }
      }
    }
    sparks.forEach((spark, i) => {
      if (spark.life > 0) {
        spark.life -= dt;
        spark.velocity.y -= 4 * dt;
        spark.position.addScaledVector(spark.velocity, dt);
      }
      positions.set([spark.position.x, spark.position.y, spark.position.z], i * 3);
      colors.set([spark.color.r, spark.color.g, spark.color.b], i * 3);
      alphas[i] = spark.life > 0 ? spark.life / spark.max : 0;
    });
    const attrs = points.geometry.attributes;
    attrs.position.needsUpdate = attrs.color.needsUpdate = attrs.aAlpha.needsUpdate = true;
    tracers.forEach((mesh) => {
      mesh.userData.life -= dt;
      (mesh.material as MeshBasicMaterial).opacity = Math.max(0, mesh.userData.life / TRACER_LIFE);
    });
  });

  return (
    <>
      <primitive object={points} />
      {tracers.map((mesh) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}
    </>
  );
}
