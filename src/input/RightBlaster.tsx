import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useXRControllerButtonEvent, useXRInputSourceStateContext } from '@react-three/xr';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, Color, Group, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { fx } from '../fx/Effects';
import { playShot } from '../fx/audio';
import { raycastTargets } from '../state/targets';
import { pulse } from './haptics';
import { aimAtPanel, wristUi } from './wristUi';

const URL = '/models/pistol.glb';
/** Model space: barrel along +Z, grip down at the back. Muzzle tip measured from the exported GLB. */
const MUZZLE = new Vector3(0, 0.045, 0.16);
const GRIP_CENTRE = new Vector3(0, -0.04, -0.1);
/**
 * The component lives in the controller's target-ray space, so the barrel follows the same aim as
 * Quest's system laser. The handle sits this far behind and below the ray origin (the controller ring),
 * roughly where the palm is. Tune on the headset if the gun feels offset in the hand.
 */
const HAND_IN_RAY_SPACE = new Vector3(0, -0.05, 0.08);
const RANGE = 25;
/** Pointer beam length when it is not touching the panel, metres. */
const POINTER_LENGTH = 0.45;
const LED_IDLE = new Color(0x2bff88);
const LED_FIRE = new Color(0xffb547);

/**
 * Right-hand controller replaced by the Prototype Pistol: trigger fires, with recoil, haptics and sound.
 * While the forearm panel is looked at, the gun hides and a pointer takes its place.
 */
export function RightBlaster() {
  const state = useXRInputSourceStateContext('controller');
  const gltf = useGLTF(URL);
  const recoilRoot = useRef<Group>(null);
  const muzzle = useRef<Object3D>(null);
  const flash = useRef<Mesh>(null);
  const kick = useRef(0);
  const gun = useRef<Group>(null);
  const pointerTip = useRef<Object3D>(null);
  const beam = useRef<Mesh>(null);
  const cursor = useRef<Mesh>(null);

  const leds = useMemo(() => {
    const found: MeshStandardMaterial[] = [];
    gltf.scene.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      if (!mesh.name.startsWith('LED')) return;
      const material = (mesh.material as MeshStandardMaterial).clone();
      material.emissive = LED_IDLE.clone();
      material.emissiveIntensity = 2;
      mesh.material = material;
      found.push(material);
    });
    return found;
  }, [gltf.scene]);

  useEffect(
    () => () => {
      wristUi.hover = null;
    },
    [],
  );

  const fire = () => {
    if (!muzzle.current) return;
    // Looking at the forearm panel: the right hand is a pointer, and the trigger presses buttons.
    if (wristUi.inUse) {
      if (wristUi.hover && wristUi.press) {
        wristUi.press(wristUi.hover);
        pulse(state.inputSource, 0.3, 25);
      }
      return;
    }
    const origin = muzzle.current.getWorldPosition(new Vector3());
    const direction = new Vector3(0, 0, 1).transformDirection(muzzle.current.matrixWorld);
    const hit = raycastTargets(origin, direction, RANGE);
    const end = hit ? hit.point : origin.clone().addScaledVector(direction, 8);
    fx.tracer(origin, end);
    hit?.target.onHit(hit.point);
    kick.current = 1;
    pulse(state.inputSource, 0.75, 45);
    playShot();
  };

  useXRControllerButtonEvent(state, 'xr-standard-trigger', (button) => {
    if (button === 'pressed') fire();
  });

  useFrame((_, delta) => {
    kick.current = Math.max(0, kick.current - delta * 9);
    const k = kick.current;
    if (recoilRoot.current) {
      recoilRoot.current.position.z = 0.025 * k;
      recoilRoot.current.rotation.x = 0.18 * k;
    }
    if (flash.current) {
      flash.current.visible = k > 0.55;
      flash.current.scale.setScalar(0.6 + k);
    }
    leds.forEach((m) => m.emissive.copy(LED_IDLE).lerp(LED_FIRE, k));

    // Pointer mode while the panel is looked at: hide the gun, cast from the controller tip.
    const pointing = wristUi.inUse;
    if (gun.current) gun.current.visible = !pointing;
    const tip = pointerTip.current;
    if (!tip || !beam.current || !cursor.current) return;
    beam.current.visible = pointing;
    cursor.current.visible = false;
    if (!pointing) {
      wristUi.hover = null;
      return;
    }
    const origin = tip.getWorldPosition(new Vector3());
    const direction = new Vector3(0, 0, -1).transformDirection(tip.matrixWorld);
    wristUi.hover = aimAtPanel(origin, direction);
    const length = wristUi.hover ? origin.distanceTo(wristUi.hoverPoint) : POINTER_LENGTH;
    beam.current.scale.set(1, length, 1);
    beam.current.position.set(0, 0, -length / 2);
    if (wristUi.hover && tip.parent) {
      cursor.current.visible = true;
      cursor.current.position.copy(tip.parent.worldToLocal(wristUi.hoverPoint.clone()));
    }
  });

  // Turning the model by 180° about Y maps the grip centre (x, y, z) to (-x, y, -z); shift it onto the palm.
  const offset: [number, number, number] = [
    HAND_IN_RAY_SPACE.x + GRIP_CENTRE.x,
    HAND_IN_RAY_SPACE.y - GRIP_CENTRE.y,
    HAND_IN_RAY_SPACE.z + GRIP_CENTRE.z,
  ];

  return (
    <>
      <group ref={gun}>
        <group ref={recoilRoot}>
          {/* Barrel from the model's +Z to the ray's forward (-Z), grip in the palm. */}
          <group rotation-y={Math.PI} position={offset}>
            <primitive object={gltf.scene} />
            <object3D ref={muzzle} name="hunter-muzzle" position={MUZZLE} />
            <mesh ref={flash} position={MUZZLE} visible={false}>
              <sphereGeometry args={[0.025, 12, 8]} />
              <meshBasicMaterial color={0xffc070} transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} />
            </mesh>
          </group>
        </group>
      </group>
      {/* Pointer: a thin beam from the controller tip and a dot where it meets the panel. */}
      <object3D ref={pointerTip} name="hunter-pointer" />
      <mesh ref={beam} visible={false} rotation-x={Math.PI / 2} renderOrder={11}>
        <cylinderGeometry args={[0.0015, 0.0015, 1, 6]} />
        <meshBasicMaterial color={0xffe2b0} transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <mesh ref={cursor} visible={false} renderOrder={12}>
        <sphereGeometry args={[0.005, 12, 8]} />
        <meshBasicMaterial color={0xffffff} depthTest={false} />
      </mesh>
    </>
  );
}

useGLTF.preload(URL);
