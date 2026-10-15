import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { DirectionalLight, HemisphereLight, PMREMGenerator, Vector3 } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { settings } from '../state/settings';

/**
 * Soft room-like light plus one shadow-casting key light that follows the player,
 * so shadows stay sharp wherever they walk. No network HDRI: the environment is generated.
 */
export function Lighting() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const brightness = settings.use((s) => s.brightness);
  const shadows = settings.use((s) => s.shadows);
  const key = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);

  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = texture;
    return () => {
      scene.environment = null;
      texture.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  useEffect(() => {
    scene.environmentIntensity = 0.55 * brightness;
  }, [scene, brightness]);

  useFrame(() => {
    const light = key.current;
    if (!light) return;
    const eye = camera.getWorldPosition(new Vector3());
    light.position.set(eye.x - 1.5, 4, eye.z + 1.2);
    light.target.position.set(eye.x, 0, eye.z - 1.5);
    light.target.updateMatrixWorld();
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={[0xf3efe8, 0x4a4038, 0.9 * brightness]} />
      <directionalLight
        ref={key}
        intensity={1.8 * brightness}
        color={0xfff1dc}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-camera-near={0.5}
        shadow-camera-far={10}
      />
    </>
  );
}
