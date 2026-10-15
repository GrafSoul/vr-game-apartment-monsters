import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { DoubleSide, Mesh, Quaternion, ShaderMaterial, Vector3 } from 'three';

const Z = new Vector3(0, 0, 1);

interface RiftProps {
  position: Vector3;
  /** Surface normal; the rift lies on the surface and glows toward this side. */
  normal: Vector3;
  /** 0 closed, 1 fully open; the component eases toward it. */
  open: number;
  width?: number;
  height?: number;
}

/** A glowing crack drawn on a real surface (wall or couch) that creatures come through. */
export function Rift({ position, normal, open, width = 0.9, height = 1.4 }: RiftProps) {
  const mesh = useRef<Mesh>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        uniforms: { uTime: { value: 0 }, uOpen: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
        fragmentShader: `uniform float uTime,uOpen; varying vec2 vUv;
          float h(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
          float n(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
            return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                       mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
          float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=.5; } return s; }
          void main(){
            float y=vUv.y; float env=pow(sin(3.14159*clamp((y-0.05)/0.9,0.,1.)),0.8);
            float x=vUv.x-0.5-(fbm(vec3(y*4.0,0.,uTime*0.15))-0.5)*0.35;
            float w=env*0.17*uOpen*(0.75+0.5*fbm(vec3(y*9.,uTime*.4,1.)));
            float d=abs(x)-w;
            float r=1.0-abs(fbm(vec3(vUv*6.0,2.0))*2.0-1.0);
            float veins=smoothstep(0.86,0.97,r)*smoothstep(0.45,0.0,abs(x))*env*uOpen;
            vec3 hot=vec3(1.0,0.42,0.12); vec3 col; float a;
            if(d<0.){
              float sw=fbm(vec3(x*8.0/(w+.01), y*3.0-uTime*0.6, uTime*.2));
              col=mix(vec3(0.03,0.0,0.02), vec3(0.45,0.05,0.08), sw*sw) + hot*smoothstep(-0.035,0.0,d)*3.0;
              a=1.0;
            } else {
              float edge=exp(-d*55.0)*uOpen*env;
              col=hot*edge*3.0 + hot*veins*1.8; a=clamp(edge+veins,0.,1.);
            }
            gl_FragColor=vec4(col,a);
          }`,
      }),
    [],
  );
  const quaternion = useMemo(() => new Quaternion().setFromUnitVectors(Z, normal.clone().normalize()), [normal]);
  const offset = useMemo(() => position.clone().addScaledVector(normal, 0.012), [position, normal]);

  useFrame((_, delta) => {
    material.uniforms.uTime.value += delta;
    const u = material.uniforms.uOpen;
    u.value += (open - u.value) * Math.min(1, delta * 3);
    if (mesh.current) mesh.current.visible = u.value > 0.01;
  });

  return (
    <mesh ref={mesh} position={offset} quaternion={quaternion} material={material} renderOrder={2}>
      <planeGeometry args={[width, height]} />
    </mesh>
  );
}
