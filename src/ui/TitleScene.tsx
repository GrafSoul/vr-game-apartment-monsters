import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Group, Vector3 } from 'three';
import { Rift } from '../fx/Rift';
import { FlyerVisual } from '../scene/FlyerVisual';

const WALL_CENTRE = new Vector3(0, 1.4, -2.75);
const WALL_YAW = -0.25;
const RIFT_NORMAL = new Vector3(Math.sin(WALL_YAW), 0, Math.cos(WALL_YAW));
const WALL_ALONG = new Vector3(Math.cos(WALL_YAW), 0, -Math.sin(WALL_YAW));
/** The rift sits on the wall plane, right of centre, so the overlay text on the left does not cover it. */
const RIFT_AT = WALL_CENTRE.clone().addScaledVector(WALL_ALONG, 0.85).setY(1.55);

/**
 * The title screen's backdrop: a live rift on a dark wall with a burning skull hanging half out of it,
 * snapping its jaw at the camera. Shown only outside MR, behind the landing overlay.
 */
export function TitleScene() {
  const beast = useRef<Group>(null);
  const camera = useThree((s) => s.camera);
  const t = useRef(0);

  useEffect(() => {
    camera.position.set(0, 1.55, 0.6);
    camera.lookAt(0.35, 1.45, -2.6);
  }, [camera]);

  useFrame((_, delta) => {
    t.current += delta;
    const b = beast.current;
    if (!b) return;
    // Leans out of the rift and back, slowly, like it is deciding.
    const lean = 0.3 + Math.sin(t.current * 0.6) * 0.15;
    b.position.copy(RIFT_AT).addScaledVector(RIFT_NORMAL, lean);
    b.position.y += Math.sin(t.current * 1.3) * 0.04;
    b.lookAt(camera.position);
  });

  return (
    <>
      <color attach="background" args={['#06080a']} />
      <fog attach="fog" args={['#06080a', 2.5, 6.5]} />
      <mesh position={WALL_CENTRE} rotation-y={WALL_YAW} receiveShadow>
        <planeGeometry args={[8, 4]} />
        <meshStandardMaterial color="#1a1c1e" roughness={0.95} />
      </mesh>
      <Rift position={RIFT_AT} normal={RIFT_NORMAL} open={1} width={0.95} height={1.5} />
      <pointLight position={RIFT_AT.clone().addScaledVector(RIFT_NORMAL, 0.4)} color="#ff7a30" intensity={6} distance={3.5} decay={2} />
      <group ref={beast} scale={1.8}>
        <FlyerVisual species="fireskull" intensity={1.3} />
      </group>
    </>
  );
}
