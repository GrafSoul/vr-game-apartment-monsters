import { useFrame, useThree } from '@react-three/fiber';
import { useXRMeshes, useXRPlanes, XRMeshModel, XRPlaneModel, XRSpace } from '@react-three/xr';
import { useRef } from 'react';
import { Group, Matrix4, MeshBasicMaterial, Vector3 } from 'three';
import { walls, type Wall } from '../game/walls';
import { settings } from '../state/settings';

const OCCLUDING_PLANES = new Set(['wall', 'ceiling', 'door', 'window', 'table', 'couch', 'other']);
const occluderMaterial = new MeshBasicMaterial({ colorWrite: false });
const IDENTITY = new Matrix4();

/** Hides virtual objects behind real furniture and walls by writing their depth only. */
function Occluders() {
  const enabled = settings.use((s) => s.occlusion);
  const meshes = useXRMeshes();
  const planes = useXRPlanes();
  return (
    <group visible={enabled}>
      {meshes
        .filter((m) => m.semanticLabel !== 'global mesh')
        .map((m, i) => (
          <XRSpace key={`m${i}`} space={m.meshSpace}>
            <XRMeshModel mesh={m} material={occluderMaterial} renderOrder={-1} />
          </XRSpace>
        ))}
      {planes
        .filter((p) => OCCLUDING_PLANES.has(p.semanticLabel ?? 'other'))
        .map((p, i) => (
          <XRSpace key={`p${i}`} space={p.planeSpace}>
            <XRPlaneModel plane={p} material={occluderMaterial} renderOrder={-1} />
          </XRSpace>
        ))}
    </group>
  );
}

/**
 * Turns the headset's wall planes into world-space rectangles for rift placement.
 * Planes whose pose has not arrived yet (identity matrix) are skipped.
 */
function WallScanner() {
  const planes = useXRPlanes('wall');
  const anchors = useRef<Array<Group | null>>([]);
  const camera = useThree((s) => s.camera);
  const lastKey = useRef('');

  useFrame(() => {
    const eye = camera.getWorldPosition(new Vector3());
    const list: Wall[] = [];
    planes.forEach((plane, i) => {
      const anchor = anchors.current[i];
      if (!anchor || plane.polygon.length < 3 || anchor.matrixWorld.equals(IDENTITY)) return;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const p of plane.polygon) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z);
        maxZ = Math.max(maxZ, p.z);
      }
      const center = anchor.localToWorld(new Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2));
      const axisX = new Vector3(1, 0, 0).transformDirection(anchor.matrixWorld);
      const axisZ = new Vector3(0, 0, 1).transformDirection(anchor.matrixWorld);
      const normal = new Vector3(0, 1, 0).transformDirection(anchor.matrixWorld);
      if (Math.abs(normal.y) > 0.3) return; // not vertical
      normal.setY(0).normalize();
      if (normal.dot(eye.clone().sub(center)) < 0) normal.negate();
      // The in-plane axis closer to horizontal runs along the wall; the other one is height.
      const xHorizontal = Math.abs(axisX.y) < Math.abs(axisZ.y);
      const halfWidth = (xHorizontal ? maxX - minX : maxZ - minZ) / 2;
      const halfHeight = (xHorizontal ? maxZ - minZ : maxX - minX) / 2;
      const along = (xHorizontal ? axisX : axisZ).setY(0).normalize();
      list.push({ center, normal, along, halfWidth, bottom: center.y - halfHeight, top: center.y + halfHeight });
    });
    const key = list.map((w) => `${w.center.x.toFixed(1)},${w.center.z.toFixed(1)},${w.halfWidth.toFixed(1)}`).join('|');
    if (key === lastKey.current) return;
    lastKey.current = key;
    walls.set({ list });
  });

  return (
    <>
      {planes.map((plane, i) => (
        <XRSpace key={i} space={plane.planeSpace}>
          <group
            ref={(g) => {
              anchors.current[i] = g;
            }}
          />
        </XRSpace>
      ))}
    </>
  );
}

/** Floor that only receives shadows: the real floor shows through, the shadow lands on it. */
function ShadowCatcher() {
  const enabled = settings.use((s) => s.shadows);
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.002} receiveShadow visible={enabled}>
      <planeGeometry args={[14, 14]} />
      <shadowMaterial transparent opacity={0.38} />
    </mesh>
  );
}

/** Room-facing parts of the scene: occlusion, wall scanning, floor shadows. */
export function Room() {
  return (
    <>
      <Occluders />
      <WallScanner />
      <ShadowCatcher />
    </>
  );
}
