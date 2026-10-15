import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Group } from 'three';
import { FlyerVisual } from '../scene/FlyerVisual';
import type { Species } from '../game/game';

/** Dev only: a turntable for judging a creature's look outside the game (`?preview=orb|wingskull|fireskull`). */
export function ModelPreview({ species }: { species: Species }) {
  const camera = useThree((s) => s.camera);
  const spin = useRef<Group>(null);

  useEffect(() => {
    camera.position.set(0, 1.5, species === 'fireskull' ? 0.75 : 1.6);
    camera.lookAt(0, 1.45, 0);
  }, [camera, species]);

  useFrame(() => {
    if (spin.current) spin.current.rotation.y = Math.sin(performance.now() / 2600) * 0.7;
  });

  return (
    <>
      <color attach="background" args={['#0b0d0f']} />
      <hemisphereLight args={['#f3efe8', '#3a3028', 1.2]} />
      <group ref={spin} position={[0, 1.45, 0]}>
        <FlyerVisual species={species} />
      </group>
    </>
  );
}
