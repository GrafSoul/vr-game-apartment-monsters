import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, ShaderMaterial, SRGBColorSpace, Vector3 } from 'three';
import { game, type Banner as BannerData } from '../game/game';
import { isBossLevel, killsForLevel } from '../game/rules';
import { useStrings, type Strings } from '../i18n';
import { setListener } from './audio';

const BANNER_PX = { width: 1024, height: 320 };
const BANNER_DISTANCE = 1.7;
const HURT_FADE_MS = 650;

/** Turns a banner event into its two lines of text in the current language. */
function bannerText(banner: BannerData, s: Strings): { title: string; subtitle: string } {
  switch (banner.kind) {
    case 'level': {
      const kills = killsForLevel(banner.level);
      return { title: s.levelTitle(banner.level), subtitle: isBossLevel(banner.level) ? s.levelGoalBoss(kills) : s.levelGoal(kills) };
    }
    case 'boss':
      return { title: s.bossTitle, subtitle: s.bossSub };
    case 'cleared':
      return { title: s.clearedTitle(banner.level), subtitle: s.clearedSub };
    case 'bossDown':
      return { title: s.clearedTitle(banner.level), subtitle: s.bossDownSub };
    case 'defeat':
      return { title: s.defeatTitle, subtitle: s.defeatSub };
  }
}

/** Level / boss / defeat messages, placed once in front of the player where they are looking. */
function Banner() {
  const banner = game.use((s) => s.banner);
  const camera = useThree((s) => s.camera);
  const mesh = useRef<Mesh>(null);
  const shownAt = useRef(0);

  const { canvas, texture, material } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = BANNER_PX.width;
    canvas.height = BANNER_PX.height;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    const material = new MeshBasicMaterial({ map: texture, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false });
    return { canvas, texture, material };
  }, []);

  const text = useStrings();

  useEffect(() => {
    const ctx = canvas.getContext('2d');
    const m = mesh.current;
    if (!ctx || !m || !banner) return;
    const { title, subtitle } = bannerText(banner, text);
    ctx.clearRect(0, 0, BANNER_PX.width, BANNER_PX.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 18;
    ctx.font = '800 112px system-ui, -apple-system, sans-serif';
    ctx.fillText(title.toUpperCase(), BANNER_PX.width / 2, 150);
    ctx.fillStyle = '#ffb547';
    ctx.font = '600 52px system-ui, -apple-system, sans-serif';
    ctx.fillText(subtitle, BANNER_PX.width / 2, 240);
    texture.needsUpdate = true;
    const eye = camera.getWorldPosition(new Vector3());
    const forward = camera.getWorldDirection(new Vector3()).setY(0);
    if (forward.lengthSq() < 1e-4) forward.set(0, 0, -1);
    m.position.copy(eye).addScaledVector(forward.normalize(), BANNER_DISTANCE).setY(eye.y + 0.1);
    m.lookAt(eye);
    shownAt.current = performance.now();
  }, [banner, camera, canvas, texture, text]);

  useFrame((_, delta) => {
    const target = banner ? 1 : 0;
    material.opacity += (target - material.opacity) * Math.min(1, delta * 6);
    if (mesh.current) mesh.current.visible = material.opacity > 0.01;
  });

  return (
    <mesh ref={mesh} material={material} renderOrder={20} visible={false}>
      <planeGeometry args={[1.2, 0.375]} />
    </mesh>
  );
}

/** Red flash around the edge of vision when a creature bites. Follows the head. */
function HurtFlash() {
  const camera = useThree((s) => s.camera);
  const head = useRef<Group>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: { uAmount: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
        fragmentShader: `uniform float uAmount; varying vec2 vUv;
          void main(){ float d=length(vUv-0.5)*2.0; float a=smoothstep(0.35,1.05,d)*uAmount; gl_FragColor=vec4(0.75,0.02,0.02,a); }`,
      }),
    [],
  );

  useFrame(() => {
    const g = head.current;
    if (!g) return;
    camera.getWorldPosition(g.position);
    camera.getWorldQuaternion(g.quaternion);
    const since = performance.now() - game.get().hurtAt;
    const amount = Math.max(0, 1 - since / HURT_FADE_MS);
    material.uniforms.uAmount.value = amount * 0.85;
    g.visible = amount > 0.01;
  });

  return (
    <group ref={head} visible={false}>
      <mesh position-z={-0.12} material={material} renderOrder={30}>
        <planeGeometry args={[0.6, 0.6]} />
      </mesh>
    </group>
  );
}

/** Keeps the Web Audio listener on the player's head for positional rift sounds. */
function Listener() {
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    const position = camera.getWorldPosition(new Vector3());
    const forward = camera.getWorldDirection(new Vector3());
    const up = new Vector3(0, 1, 0).applyQuaternion(camera.getWorldQuaternion(camera.quaternion.clone()));
    setListener(position, forward, up);
  });
  return null;
}

/** Player-facing feedback: banners, bite flash, positional audio listener. */
export function Hud() {
  return (
    <>
      <Banner />
      <HurtFlash />
      <Listener />
    </>
  );
}
