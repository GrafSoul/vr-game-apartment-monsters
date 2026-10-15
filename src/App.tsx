import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useXR, XR } from '@react-three/xr';
import { Suspense, useEffect, useRef, useState } from 'react';
import { unlockAudio } from './fx/audio';
import { Effects } from './fx/Effects';
import { Hud } from './fx/Hud';
import { Director } from './game/Director';
import { game, type Species } from './game/game';
import { walls } from './game/walls';
import { setHapticsSession } from './input/haptics';
import { Creatures } from './scene/Creatures';
import { Lighting } from './scene/Lighting';
import { Rifts } from './scene/Rifts';
import { Room } from './scene/Room';
import { t } from './i18n';
import { settings } from './state/settings';
import { Landing } from './ui/Landing';
import { TitleScene } from './ui/TitleScene';
import { ModelPreview } from './dev/ModelPreview';
import { xrStore } from './xrStore';

const SPECIES: readonly Species[] = ['orb', 'wingskull', 'fireskull'];
const previewParam = import.meta.env.DEV ? new URLSearchParams(location.search).get('preview') : null;
/** Dev only: `?preview=orb|wingskull|fireskull` swaps the title screen for a creature turntable. */
const PREVIEW = SPECIES.find((s) => s === previewParam) ?? null;

/** Hands the live XR session to non-React code (haptics). */
function SessionBridge() {
  const session = useXR((s) => s.session);
  useEffect(() => {
    setHapticsSession(session ?? null);
  }, [session]);
  return null;
}

/** Dev only: exposes the scene and stores for inspection from the browser console. */
function DevExpose() {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __hunter: { scene, camera, game, settings, walls } });
  }, [scene, camera]);
  return null;
}

/** Publishes frames per second to the wrist panel once a second. */
function FpsMeter() {
  const acc = useRef({ frames: 0, time: 0 });
  useFrame((_, delta) => {
    const a = acc.current;
    a.frames += 1;
    a.time += delta;
    if (a.time >= 1) {
      settings.set({ fps: Math.round(a.frames / a.time) });
      a.frames = 0;
      a.time = 0;
    }
  });
  return null;
}

/** Landing screen on the headset or desktop, then the game in MR. */
export function App() {
  const [inSession, setInSession] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => xrStore.subscribe((s) => setInSession(s.session != null)), []);

  const enter = () => {
    unlockAudio();
    setError(null);
    xrStore.enterAR().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : t().sessionFailed);
    });
  };

  return (
    <>
      <Canvas shadows camera={{ position: [0, 1.6, 0.01], fov: 70, near: 0.02, far: 40 }} gl={{ antialias: true }}>
        <XR store={xrStore}>
          <SessionBridge />
          <DevExpose />
          <FpsMeter />
          <Lighting />
          <Room />
          <Director />
          <Rifts />
          <Suspense fallback={null}>
            <Creatures />
            {!inSession && !PREVIEW && <TitleScene />}
            {!inSession && PREVIEW && <ModelPreview species={PREVIEW} />}
          </Suspense>
          <Effects />
          <Hud />
        </XR>
      </Canvas>
      {!inSession && !PREVIEW && <Landing onEnter={enter} error={error} />}
    </>
  );
}
