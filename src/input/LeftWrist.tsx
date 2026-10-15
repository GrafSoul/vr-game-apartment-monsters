import { useFrame, useThree } from '@react-three/fiber';
import { XRControllerModel, XRSpace } from '@react-three/xr';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, Matrix4, Mesh, MeshBasicMaterial, Quaternion, SRGBColorSpace, Vector2, Vector3 } from 'three';
import { playClick } from '../fx/audio';
import { game, startLevel } from '../game/game';
import { settings } from '../state/settings';
import { BUTTONS, drawWristPanel, PANEL_PX, type WristButton } from './wristPanel';
import { wristUi } from './wristUi';

/** Panel size along the forearm and across it, metres. */
const PANEL_LONG = 0.18;
const PANEL_SHORT = (PANEL_LONG * PANEL_PX.height) / PANEL_PX.width;
/**
 * Grip-space axes per the WebXR spec: -Z runs across the fist toward the thumb, +Y runs along the forearm
 * toward the elbow, and the back of the LEFT hand faces -X. Flip to 1 if the panel ends up on the palm side.
 */
const BACK_OF_HAND = -1;
/** Panel centre in grip space: off the back of the wrist, slid toward the elbow along the forearm (+Y). */
const PANEL_OFFSET = new Vector3(BACK_OF_HAND * 0.045, 0.14, 0);
/** The panel counts as "looked at" when its face is within ~66° of the eyes, within arm's reach. */
const USE_DOT = 0.4;
const USE_DISTANCE = 0.9;
const BRIGHTNESS_STEP = 0.15;

/**
 * Lays the panel along the forearm like a wrist gauntlet: face out of the back of the arm, text running
 * from elbow toward the hand (grip -Y), text "up" toward the little-finger side (grip +Z), which faces away
 * from the body when the forearm is raised across the chest.
 */
const PANEL_ROTATION = (() => {
  const normal = new Vector3(BACK_OF_HAND, 0, 0);
  const right = new Vector3(0, -1, 0);
  const up = new Vector3().crossVectors(normal, right);
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right, up, normal));
})();

function applyButton(id: WristButton): void {
  const g = game.get();
  const s = settings.get();
  switch (id) {
    case 'pause':
      game.set({ paused: !g.paused });
      break;
    case 'reset':
      startLevel(g.level);
      break;
    case 'shadows':
      settings.set({ shadows: !s.shadows });
      break;
    case 'occlusion':
      settings.set({ occlusion: !s.occlusion });
      break;
    case 'dimmer':
      settings.set({ brightness: Math.max(0.3, +(s.brightness - BRIGHTNESS_STEP).toFixed(2)) });
      break;
    case 'brighter':
      settings.set({ brightness: Math.min(2, +(s.brightness + BRIGHTNESS_STEP).toFixed(2)) });
      break;
  }
}

function buttonAt(uv: Vector2): WristButton | null {
  return BUTTONS.find((b) => uv.x >= b.u0 && uv.x <= b.u1 && uv.y >= b.v0 && uv.y <= b.v1)?.id ?? null;
}

/**
 * Left controller: the real controller model plus a control panel lying on the forearm.
 * Looking at it swaps the right-hand blaster for a pointer; the trigger presses the button under the pointer.
 */
export function LeftWrist() {
  const camera = useThree((s) => s.camera);
  const panel = useRef<Mesh>(null);
  const ui = useRef({ hovered: null as WristButton | null, flashT: 0 });
  const gameState = game.use((s) => s);
  const settingsState = settings.use((s) => s);

  const { canvas, texture, material } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = PANEL_PX.width;
    canvas.height = PANEL_PX.height;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    const material = new MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false });
    return { canvas, texture, material };
  }, []);

  const redraw = () => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawWristPanel(ctx, game.get(), settings.get(), ui.current.hovered, ui.current.flashT > 0);
    texture.needsUpdate = true;
  };

  useEffect(redraw, [gameState, settingsState]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    wristUi.panel = panel.current;
    wristUi.press = (uv) => {
      const id = buttonAt(uv);
      if (!id) return;
      applyButton(id);
      playClick();
      ui.current.flashT = 0.18;
      redraw();
    };
    return () => {
      wristUi.panel = null;
      wristUi.press = null;
      wristUi.inUse = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    const mesh = panel.current;
    if (!mesh) return;
    const eye = camera.getWorldPosition(new Vector3());
    const centre = mesh.getWorldPosition(new Vector3());
    const face = new Vector3(0, 0, 1).transformDirection(mesh.matrixWorld);
    const toEye = eye.clone().sub(centre);
    const near = toEye.length() < USE_DISTANCE;
    wristUi.inUse = near && face.dot(toEye.normalize()) > USE_DOT;
    const target = wristUi.inUse ? 1 : 0.55;
    material.opacity += (target - material.opacity) * Math.min(1, delta * 10);

    const s = ui.current;
    let dirty = false;
    const hovered = wristUi.inUse && wristUi.hover ? buttonAt(wristUi.hover) : null;
    if (hovered !== s.hovered) {
      s.hovered = hovered;
      dirty = true;
    }
    if (s.flashT > 0) {
      s.flashT -= delta;
      if (s.flashT <= 0) dirty = true;
    }
    if (dirty) redraw();
  });

  return (
    <>
      <Suspense fallback={null}>
        <XRControllerModel />
      </Suspense>
      <XRSpace space="grip-space">
        <mesh ref={panel} position={PANEL_OFFSET} quaternion={PANEL_ROTATION} material={material} renderOrder={10}>
          <planeGeometry args={[PANEL_LONG, PANEL_SHORT]} />
        </mesh>
      </XRSpace>
    </>
  );
}
