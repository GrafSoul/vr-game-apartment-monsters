import { Color, Material, Mesh, Object3D, Plane } from 'three';

/** Shared uniforms of a dissolvable model: 0 = whole, 1 = gone; the edge glows in `uEdgeColor`. */
export interface DissolveUniforms {
  uDissolve: { value: number };
  uEdgeColor: { value: Color };
  /** Seconds, for vertex motion (stalk wiggle, wing flap); advance it every frame. */
  uMotionTime: { value: number };
}

/** Options for {@link makeDissolvable}. */
export interface DissolveOptions {
  /** Clipping planes for every material (e.g. the wall a boss walks out of). */
  clip?: Plane[];
  edge?: Color;
  /** GLSL run on `transformed` (mesh space) after `begin_vertex`, per mesh; `uMotionTime` is in scope. */
  vertexMotion?: (mesh: Mesh) => string;
}

const NOISE = /* glsl */ `
  float dHash(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float dNoise(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(dHash(i),dHash(i+vec3(1,0,0)),f.x),mix(dHash(i+vec3(0,1,0)),dHash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(dHash(i+vec3(0,0,1)),dHash(i+vec3(1,0,1)),f.x),mix(dHash(i+vec3(0,1,1)),dHash(i+vec3(1,1,1)),f.x),f.y),f.z); }
  float dFbm(vec3 p){ return 0.55*dNoise(p)+0.3*dNoise(p*2.1)+0.15*dNoise(p*4.3); }
`;

function patch(material: Material, uniforms: DissolveUniforms, clip: Plane[], vertexMotion: string): Material {
  const copy = material.clone();
  copy.clippingPlanes = clip;
  copy.onBeforeCompile = (shader) => {
    shader.uniforms.uDissolve = uniforms.uDissolve;
    shader.uniforms.uEdgeColor = uniforms.uEdgeColor;
    shader.uniforms.uMotionTime = uniforms.uMotionTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDissolvePos;\nuniform float uMotionTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertexMotion}`)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvDissolvePos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vDissolvePos;\nuniform float uDissolve;\nuniform vec3 uEdgeColor;\n${NOISE}`)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nfloat dissolveN = dFbm(vDissolvePos * 9.0);\nif (dissolveN < uDissolve) discard;')
      .replace('#include <tonemapping_fragment>', 'float dissolveEdge = smoothstep(uDissolve + 0.07, uDissolve, dissolveN) * step(0.001, uDissolve);\ngl_FragColor.rgb += uEdgeColor * dissolveEdge * 4.0;\n#include <tonemapping_fragment>');
  };
  copy.customProgramCacheKey = () => `hunter-dissolve|${vertexMotion}`;
  return copy;
}

/** Fresh uniforms for one dissolvable model. */
export function dissolveUniforms(edge = new Color(1, 0.42, 0.12)): DissolveUniforms {
  return { uDissolve: { value: 0 }, uEdgeColor: { value: edge }, uMotionTime: { value: 0 } };
}

/**
 * Gives every mesh under `root` its own material copy with a noise dissolve, optional clipping planes and
 * optional vertex motion. Pass `uniforms` to share them with the caller, or let it create new ones.
 */
export function makeDissolvable(root: Object3D, options: DissolveOptions = {}, uniforms = dissolveUniforms(options.edge)): DissolveUniforms {
  const clip = options.clip ?? [];
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    const motion = options.vertexMotion?.(mesh) ?? '';
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => patch(m, uniforms, clip, motion)) : patch(mesh.material, uniforms, clip, motion);
  });
  return uniforms;
}
