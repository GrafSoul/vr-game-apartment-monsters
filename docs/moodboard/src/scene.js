(function () {
  const stage = document.getElementById('stage');
  const canvas = document.getElementById('scene');
  const scoreEl = document.getElementById('score');
  if (!window.THREE) { stage.classList.add('nogl'); return; }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch (e) { stage.classList.add('nogl'); return; }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x24211e);
  const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.05, 50);
  camera.position.set(0, 1.55, 2.6);
  scene.add(camera);

  const state = { shadows: true, occlusion: true, glow: true, sound: false, score: 0 };

  // ---------- shared helpers ----------
  const NOISE = `
    float hash(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    float noise(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
      return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
    float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.03; a*=.5; } return s; }
  `;

  function radialTexture(stops) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(([o, col]) => grd.addColorStop(o, col));
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const haloTex = radialTexture([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.45)'], [1, 'rgba(255,255,255,0)']]);
  const blobTex = radialTexture([[0, 'rgba(0,0,0,.75)'], [0.5, 'rgba(0,0,0,.35)'], [1, 'rgba(0,0,0,0)']]);
  const halos = [];
  function halo(color, size, opacity) {
    const m = new THREE.SpriteMaterial({ map: haloTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(m); s.scale.setScalar(size); halos.push(s); return s;
  }

  // ---------- room (stands in for passthrough) ----------
  function plankTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d');
    for (let row = 0; row < 8; row++) {
      let x = -(row * 97) % 260;
      while (x < 512) {
        const w = 180 + ((row * 31 + x) % 90);
        const l = 36 + ((row * 13 + x * 7) % 10);
        g.fillStyle = `hsl(28, 30%, ${l}%)`; g.fillRect(x, row * 64, w, 64);
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, row * 64, 2, 64);
        x += w;
      }
      g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, row * 64, 512, 2);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2.5, 2.5); return t;
  }
  const roomMeshes = [];
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xcfc8bd, roughness: 1 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2; floor.position.z = 0.5; floor.receiveShadow = true; scene.add(floor); roomMeshes.push(floor);
  [[0, 1.35, -2.5, 0], [-3, 1.35, 0.5, Math.PI / 2], [3, 1.35, 0.5, -Math.PI / 2]].forEach(([x, y, z, ry]) => {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.7), wallMat);
    w.position.set(x, y, z); w.rotation.y = ry; w.receiveShadow = true; scene.add(w); roomMeshes.push(w);
  });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshStandardMaterial({ color: 0xd8d2c8, emissive: 0x4a4540, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 2.7, 0.5); scene.add(ceil);
  const base = new THREE.Mesh(new THREE.BoxGeometry(6, 0.09, 0.02), new THREE.MeshStandardMaterial({ color: 0xf1ede6, roughness: 0.7 }));
  base.position.set(0, 0.045, -2.49); scene.add(base);

  function box(w, h, d, x, y, z, mat, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); roomMeshes.push(m); return m;
  }
  const fabric = new THREE.MeshStandardMaterial({ color: 0x55636e, roughness: 0.95 });
  const sofa = new THREE.Group(); sofa.position.set(-1.1, 0, -1.75); scene.add(sofa);
  box(2.1, 0.42, 0.95, 0, 0.21, 0, fabric, sofa);
  box(1.96, 0.13, 0.82, 0, 0.485, 0.04, fabric, sofa);
  box(2.1, 0.58, 0.22, 0, 0.71, -0.37, fabric, sofa);
  box(0.18, 0.62, 0.95, -1.05, 0.31, 0, fabric, sofa);
  box(0.18, 0.62, 0.95, 1.05, 0.31, 0, fabric, sofa);
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a4c, roughness: 0.6 });
  const table = new THREE.Group(); table.position.set(1.35, 0, -1.2); scene.add(table);
  box(1.1, 0.05, 0.65, 0, 0.74, 0, wood, table);
  [[-0.5, -0.28], [0.5, -0.28], [-0.5, 0.28], [0.5, 0.28]].forEach(([x, z]) => box(0.05, 0.72, 0.05, x, 0.36, z, wood, table));
  box(0.22, 0.05, 0.3, -0.25, 0.79, 0.05, new THREE.MeshStandardMaterial({ color: 0x3d5a73, roughness: 0.8 }), table);
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 20), new THREE.MeshStandardMaterial({ color: 0xe9e4da, roughness: 0.4 }));
  mug.position.set(0.25, 0.815, -0.05); mug.castShadow = true; table.add(mug);

  scene.add(new THREE.HemisphereLight(0xf2efe8, 0x5a4a3a, 0.9));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
  sun.position.set(-2.6, 4.2, 2.2); sun.target.position.set(0, 0, -1.2); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 12 });
  sun.shadow.bias = -0.0006;

  // ---------- rift on the back wall ----------
  const riftMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uOpen: { value: 1 }, uGlow: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform float uTime,uOpen,uGlow; varying vec2 vUv; ${NOISE}
      void main(){
        vec2 uv=vUv; float y=uv.y;
        float env=pow(sin(3.14159*clamp((y-0.05)/0.9,0.,1.)),0.8);
        float off=(fbm(vec3(y*4.0,0.,uTime*0.15))-0.5)*0.35;
        float x=uv.x-0.5-off;
        float w=env*0.15*uOpen*(0.75+0.5*fbm(vec3(y*9.,uTime*.4,1.)));
        float d=abs(x)-w;
        float r=1.0-abs(fbm(vec3(uv*6.0,2.0))*2.0-1.0);
        float veins=smoothstep(0.86,0.97,r)*smoothstep(0.45,0.0,abs(x))*env*uOpen;
        vec3 hot=vec3(1.0,0.42,0.12);
        vec3 col; float a;
        if(d<0.){
          float sw=fbm(vec3(x*8.0/(w+.01), y*3.0-uTime*0.6, uTime*.2));
          col=mix(vec3(0.03,0.01,0.06), vec3(0.38,0.16,0.85), sw*sw);
          float rim=smoothstep(-0.035,0.0,d);
          col+=hot*rim*(1.0+2.5*uGlow);
          a=1.0;
        } else {
          float edge=exp(-d*55.0)*uOpen*env;
          col=hot*(edge*(1.0+2.0*uGlow)) + hot*veins*(0.6+1.2*uGlow);
          a=clamp(edge+veins,0.,1.);
        }
        gl_FragColor=vec4(col,a);
      }`
  });
  const rift = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.9), riftMat);
  rift.position.set(0.9, 1.45, -2.485); scene.add(rift);
  const riftHalo = halo(0xff7a30, 2.2, 0.35); riftHalo.position.set(0.9, 1.45, -2.4); scene.add(riftHalo);
  const RIFT_MOUTH = new THREE.Vector3(0.9, 1.45, -2.35);

  // ---------- drone (procedural, "neon-tech") ----------
  const HOSTILE = 0xff5a36;
  const drone = new THREE.Group(); scene.add(drone);
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2f36, metalness: 0.8, roughness: 0.35 });
  const droneRingMat = new THREE.MeshStandardMaterial({ color: 0x220a05, emissive: HOSTILE, emissiveIntensity: 2.2, roughness: 0.4 });
  const dBody = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 16), metal); dBody.castShadow = true; drone.add(dBody);
  const dRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.016, 12, 48), droneRingMat); drone.add(dRing);
  const dEye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd2c4 }));
  dEye.position.z = 0.1; drone.add(dEye);
  const dEyeHalo = halo(HOSTILE, 0.35, 0.8); dEyeHalo.position.z = 0.13; drone.add(dEyeHalo);
  const rotors = [];
  [-1, 1].forEach((s) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.014, 0.02), metal); arm.position.x = s * 0.17; drone.add(arm);
    const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.006, 24), new THREE.MeshStandardMaterial({ color: 0x9aa4ad, transparent: true, opacity: 0.35, metalness: 0.5 }));
    rotor.position.set(s * 0.25, 0.03, 0); drone.add(rotor); rotors.push(rotor);
  });
  const droneHit = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
  droneHit.userData.kind = 'drone'; drone.add(droneHit);
  const droneState = { mode: 'emerge', t: 0, timer: 0 };

  // ---------- shadow creature (shader, no model) ----------
  const creature = new THREE.Group(); scene.add(creature);
  const coreMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uDis: { value: 0 }, uGlow: { value: 1 } },
    vertexShader: `uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP; ${NOISE}
      void main(){ vec3 p=position; float n=fbm(p*2.5+vec3(0.,uTime*.6,0.)); p+=normal*(n-0.5)*0.24; vP=position;
        vec4 mv=modelViewMatrix*vec4(p,1.); vV=-mv.xyz; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform float uTime,uDis,uGlow; varying vec3 vN; varying vec3 vV; varying vec3 vP; ${NOISE}
      void main(){ float n=fbm(vP*4.0+vec3(uTime*.3)); if(n<uDis) discard;
        float fr=pow(1.0-max(dot(normalize(vN),normalize(vV)),0.),2.5);
        vec3 col=vec3(0.02,0.015,0.035)+vec3(0.6,0.45,1.0)*fr*(0.5+uGlow*1.3);
        float veins=smoothstep(0.62,0.7,fbm(vP*6.0-vec3(0.,uTime*.8,0.)))*(0.5+0.5*sin(uTime*3.));
        col+=vec3(0.45,0.3,1.0)*veins*0.7*(0.25+uGlow);
        float edge=smoothstep(uDis+0.08,uDis,n)*step(0.001,uDis);
        col+=vec3(0.75,0.6,1.0)*edge*3.0;
        gl_FragColor=vec4(col,1.); }`
  });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.27, 5), coreMat);
  core.castShadow = true; creature.add(core);
  const TENTS = 5, SEGS = 14;
  const tentMat = new THREE.MeshStandardMaterial({ color: 0x0b0912, emissive: 0x1a0d36, roughness: 0.35, metalness: 0.2 });
  const tents = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), tentMat, TENTS * SEGS);
  tents.castShadow = true; tents.frustumCulled = false; scene.add(tents);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xe2d8ff });
  const eyes = [-1, 1].map((s) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 8), eyeMat);
    e.position.set(s * 0.085, 0.06, 0.24); creature.add(e);
    const h = halo(0x9b7bff, 0.22, 0.9); h.position.copy(e.position).z += 0.02; creature.add(h);
    return e;
  });
  const creatureHit = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
  creatureHit.userData.kind = 'shade'; creature.add(creatureHit);
  const creatureState = { mode: 'alive', timer: 0, dis: 0 };
  const occludable = [core, tents, ...eyes];

  // ---------- contact shadow blobs ----------
  function blob() {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = 1; scene.add(m); return m;
  }
  const creatureBlob = blob(), droneBlob = blob();

  // ---------- particles (smoke + sparks) ----------
  function particleSystem(max, color, additive) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(max * 3), alpha = new Float32Array(max), size = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uColor: { value: new THREE.Color(color) } },
      vertexShader: 'attribute float aAlpha; attribute float aSize; varying float vA; void main(){ vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=aSize*(300.0/-mv.z); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 uColor; varying float vA; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d)*vA; if(a<0.01) discard; gl_FragColor=vec4(uColor,a); }'
    });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
    const ps = Array.from({ length: max }, () => ({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), s: 0, a: 1, g: 0 }));
    return {
      mat, emit(at, n, speed, opts) {
        for (let i = 0; i < n; i++) {
          const q = ps.find((x) => x.life <= 0); if (!q) return;
          q.p.copy(at).add(new THREE.Vector3((Math.random() - .5) * opts.spread, (Math.random() - .5) * opts.spread, (Math.random() - .5) * opts.spread));
          q.v.set(Math.random() - .5, Math.random() - .5 + (opts.up || 0), Math.random() - .5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.6));
          q.max = q.life = opts.life * (0.6 + Math.random() * 0.4); q.s = opts.size * (0.6 + Math.random() * 0.8); q.a = opts.alpha; q.g = opts.gravity || 0;
        }
      },
      update(dt) {
        ps.forEach((q, i) => {
          if (q.life > 0) { q.life -= dt; q.v.y -= q.g * dt; q.p.addScaledVector(q.v, dt); }
          const k = Math.max(q.life, 0) / q.max;
          pos[i * 3] = q.p.x; pos[i * 3 + 1] = q.p.y; pos[i * 3 + 2] = q.p.z;
          alpha[i] = q.life > 0 ? q.a * Math.min(1, k * 2) : 0; size[i] = q.s * (q.g ? 1 : 1.6 - k * 0.6);
        });
        geo.attributes.position.needsUpdate = geo.attributes.aAlpha.needsUpdate = geo.attributes.aSize.needsUpdate = true;
      }
    };
  }
  const smoke = particleSystem(160, 0x150f22, false);
  const sparks = particleSystem(240, 0xffc070, true);

  // ---------- blaster in the right hand ----------
  const AMBER = 0xffb547;
  const blaster = new THREE.Group(); camera.add(blaster);
  const gun = new THREE.MeshStandardMaterial({ color: 0x2b3037, metalness: 0.7, roughness: 0.38 });
  const gunDark = new THREE.MeshStandardMaterial({ color: 0x1b1f25, metalness: 0.3, roughness: 0.8 });
  const panel = new THREE.MeshStandardMaterial({ color: 0x7d8792, metalness: 0.4, roughness: 0.45 });
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x2a1a00, emissive: AMBER, emissiveIntensity: 2.4 });
  function part(geo, mat, x, y, z, rx) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (rx) m.rotation.x = rx; blaster.add(m); return m; }
  part(new THREE.BoxGeometry(0.06, 0.07, 0.26), gun, 0, 0, -0.02);
  part(new THREE.BoxGeometry(0.036, 0.022, 0.22), gunDark, 0, 0.046, -0.03);
  part(new THREE.BoxGeometry(0.002, 0.042, 0.13), panel, 0.031, 0.004, -0.04);
  part(new THREE.BoxGeometry(0.002, 0.042, 0.13), panel, -0.031, 0.004, -0.04);
  part(new THREE.BoxGeometry(0.063, 0.008, 0.11), glowMat, 0, 0.026, -0.04);
  part(new THREE.CylinderGeometry(0.018, 0.02, 0.12, 20), gun, 0, 0.004, -0.2, Math.PI / 2);
  const emitter = part(new THREE.TorusGeometry(0.024, 0.007, 10, 24), glowMat, 0, 0.004, -0.262);
  part(new THREE.BoxGeometry(0.045, 0.12, 0.06), gunDark, 0, -0.085, 0.065, -0.28);
  part(new THREE.BoxGeometry(0.01, 0.032, 0.014), gunDark, 0, -0.05, 0.005);
  const muzzle = halo(AMBER, 0.12, 0); muzzle.position.set(0, 0.004, -0.29); blaster.add(muzzle);
  const BLASTER_REST = new THREE.Vector3(0.27, -0.25, -0.72);
  blaster.position.copy(BLASTER_REST); blaster.rotation.set(0.05, 0.42, -0.06); blaster.scale.setScalar(0.85);
  let recoil = 0, flash = 0;

  // ---------- tracers ----------
  const tracers = Array.from({ length: 4 }, () => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1, 6), new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(m); m.userData.life = 0; return m;
  });
  const UP = new THREE.Vector3(0, 1, 0);
  function tracer(from, to) {
    const m = tracers.find((t) => t.userData.life <= 0) || tracers[0];
    const dir = to.clone().sub(from); const len = dir.length();
    m.position.copy(from).addScaledVector(dir, 0.5); m.scale.set(1, len, 1);
    m.quaternion.setFromUnitVectors(UP, dir.normalize()); m.userData.life = 0.12;
  }

  // ---------- sound (optional, synthesized) ----------
  let actx = null;
  function sfx(kind) {
    if (!state.sound || !actx) return;
    const t = actx.currentTime; const g = actx.createGain(); g.connect(actx.destination);
    if (kind === 'shot') {
      const o = actx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.13);
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(g); o.start(t); o.stop(t + 0.16);
    } else {
      const len = kind === 'shade' ? 0.5 : 0.3;
      const buf = actx.createBuffer(1, actx.sampleRate * len, actx.sampleRate); const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = actx.createBufferSource(); src.buffer = buf;
      const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'shade' ? 500 : 1400;
      g.gain.setValueAtTime(0.25, t); src.connect(f); f.connect(g); src.start(t);
    }
  }

  // ---------- shooting ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function shoot(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const targets = [...roomMeshes];
    if (creatureState.mode === 'alive') targets.push(creatureHit);
    if (droneState.mode === 'patrol' || droneState.mode === 'emerge') targets.push(droneHit);
    const hit = ray.intersectObjects(targets, false)[0];
    const from = new THREE.Vector3(); emitter.getWorldPosition(from);
    const to = hit ? hit.point : ray.ray.at(8, new THREE.Vector3());
    tracer(from, to); recoil = 1; flash = 1; sfx('shot');
    if (!hit) return;
    const kind = hit.object.userData.kind;
    if (kind === 'shade') {
      creatureState.mode = 'dying'; creatureState.timer = 0; addScore(150); sfx('shade');
      smoke.emit(hit.point, 40, 0.5, { spread: 0.3, life: 1.4, size: 0.5, alpha: 0.7, up: 0.6 });
      sparks.mat.uniforms.uColor.value.set(0xb79cff); sparks.emit(hit.point, 30, 1.6, { spread: 0.1, life: 0.6, size: 0.05, alpha: 1, gravity: 1.5 });
    } else if (kind === 'drone') {
      droneState.mode = 'dead'; droneState.timer = 0; drone.visible = false; addScore(100); sfx('drone');
      sparks.mat.uniforms.uColor.value.set(0xffb070); sparks.emit(hit.point, 70, 2.4, { spread: 0.08, life: 0.8, size: 0.05, alpha: 1, gravity: 3 });
      smoke.emit(hit.point, 14, 0.3, { spread: 0.15, life: 1.2, size: 0.4, alpha: 0.5, up: 0.5 });
    } else {
      sparks.mat.uniforms.uColor.value.set(0xffc070); sparks.emit(hit.point, 12, 1.2, { spread: 0.02, life: 0.4, size: 0.035, alpha: 1, gravity: 3 });
    }
  }
  function addScore(n) { state.score += n; scoreEl.textContent = state.score; }
  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); shoot(e.clientX, e.clientY); });

  // ---------- toggles ----------
  function applyToggles() {
    sun.castShadow = state.shadows; creatureBlob.visible = droneBlob.visible = state.shadows;
    occludable.forEach((m) => { m.material.depthTest = state.occlusion; m.renderOrder = state.occlusion ? 0 : 10; });
    const g = state.glow ? 1 : 0;
    riftMat.uniforms.uGlow.value = g; coreMat.uniforms.uGlow.value = g;
    halos.forEach((h) => { if (h !== muzzle) h.visible = state.glow; });
    droneRingMat.emissiveIntensity = state.glow ? 2.2 : 0.5; glowMat.emissiveIntensity = state.glow ? 2.4 : 0.5;
  }
  document.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.toggle; state[key] = !state[key];
      btn.setAttribute('aria-pressed', String(state[key]));
      if (key === 'sound' && state.sound && !actx) {
        try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; }
      }
      applyToggles();
    });
  });
  applyToggles();

  // ---------- parallax ----------
  const look = new THREE.Vector3(0, 1.05, -1.6); const aim = new THREE.Vector2();
  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    aim.set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
  });

  // ---------- loop ----------
  const dummy = new THREE.Object3D(); const tmp = new THREE.Vector3();
  let running = true, last = performance.now(), time = 0, rafId = 0;
  function start() { if (!rafId) { last = performance.now(); rafId = requestAnimationFrame(frame); } }
  new IntersectionObserver((en) => { running = en[0].isIntersecting; if (running) start(); }).observe(stage);

  function updateCreature(dt) {
    const t = time;
    const z = -1.6 + 0.72 * Math.sin(t * 0.23);
    const x = -1.1 + 0.7 * Math.sin(t * 0.31);
    const y = 0.62 + 0.5 * THREE.MathUtils.smoothstep(z, -2.05, -1.4) + 0.06 * Math.sin(t * 1.3);
    creature.position.set(x, y, z);
    tmp.copy(camera.position); tmp.y = y; creature.lookAt(tmp);
    if (creatureState.mode === 'dying') {
      creatureState.timer += dt; creatureState.dis = Math.min(1, creatureState.timer / 0.7);
      if (creatureState.dis >= 1) { creatureState.mode = 'gone'; creatureState.timer = 0; }
    } else if (creatureState.mode === 'gone') {
      creatureState.timer += dt; if (creatureState.timer > 1.2) { creatureState.mode = 'forming'; creatureState.timer = 0; }
    } else if (creatureState.mode === 'forming') {
      creatureState.timer += dt; creatureState.dis = Math.max(0, 1 - creatureState.timer / 0.9);
      if (creatureState.dis <= 0) creatureState.mode = 'alive';
    }
    const dis = creatureState.dis; coreMat.uniforms.uDis.value = dis;
    const alive = 1 - dis;
    eyes.forEach((e) => { e.visible = dis < 0.5; });
    creature.children.forEach((c) => { if (c.isSprite) c.visible = state.glow && dis < 0.5; });
    let k = 0;
    for (let i = 0; i < TENTS; i++) {
      const a = (i / TENTS) * Math.PI * 2;
      const dir = tmp.set(Math.cos(a) * 0.65, -1, Math.sin(a) * 0.65).normalize();
      for (let j = 0; j < SEGS; j++) {
        const s = j / (SEGS - 1);
        dummy.position.set(
          x + dir.x * (0.18 + s * 0.75) + Math.sin(t * 2.2 + s * 5 + i) * 0.13 * s,
          y + dir.y * (0.18 + s * 0.75) * 0.8 + Math.sin(t * 1.7 + s * 4 + i * 2) * 0.08 * s,
          z + dir.z * (0.18 + s * 0.75) + Math.cos(t * 2 + s * 5 + i) * 0.13 * s
        );
        dummy.scale.setScalar(0.075 * (1 - s * 0.8) * alive);
        dummy.updateMatrix(); tents.setMatrixAt(k++, dummy.matrix);
      }
    }
    tents.instanceMatrix.needsUpdate = true;
    if (alive > 0.3 && Math.random() < dt * 22) smoke.emit(creature.position, 1, 0.12, { spread: 0.35, life: 1.6, size: 0.42, alpha: 0.45, up: 0.9 });
    creatureBlob.position.set(x, 0.006, z);
    const hk = Math.max(0, 1 - y / 1.6);
    creatureBlob.scale.setScalar(0.9 * (0.6 + hk)); creatureBlob.material.opacity = 0.75 * hk * alive;
  }

  function dronePatrol(t) {
    return tmp.set(0.35 + 0.95 * Math.sin(t * 0.55), 1.42 + 0.22 * Math.sin(t * 1.1), -0.7 + 0.4 * Math.sin(t * 0.37));
  }
  function updateDrone(dt) {
    droneState.t += dt;
    riftMat.uniforms.uOpen.value = THREE.MathUtils.lerp(riftMat.uniforms.uOpen.value, droneState.mode === 'dead' ? 0.35 : 1, dt * 2.5);
    if (droneState.mode === 'dead') {
      droneState.timer += dt;
      if (droneState.timer > 1.6) { droneState.mode = 'emerge'; droneState.timer = 0; drone.visible = true; }
      droneBlob.visible = false; return;
    }
    droneBlob.visible = state.shadows;
    if (droneState.mode === 'emerge') {
      droneState.timer += dt; const k = Math.min(1, droneState.timer / 1.3); const e = k * k * (3 - 2 * k);
      drone.position.lerpVectors(RIFT_MOUTH, dronePatrol(droneState.t), e); drone.scale.setScalar(0.2 + 0.8 * e);
      if (k >= 1) droneState.mode = 'patrol';
    } else {
      drone.position.copy(dronePatrol(droneState.t)); drone.scale.setScalar(1);
    }
    drone.lookAt(camera.position); drone.rotateZ(Math.sin(droneState.t * 1.1) * 0.15);
    rotors.forEach((r) => { r.rotation.y += dt * 40; });
    droneBlob.position.set(drone.position.x, 0.006, drone.position.z);
    droneBlob.scale.setScalar(0.55); droneBlob.material.opacity = 0.35;
  }

  function frame(now) {
    if (!running) { rafId = 0; return; }
    const dt = Math.min((now - last) / 1000, 0.05); last = now; time += dt;
    riftMat.uniforms.uTime.value = coreMat.uniforms.uTime.value = time;
    updateCreature(dt); updateDrone(dt);
    smoke.update(dt); sparks.update(dt);
    tracers.forEach((m) => { m.userData.life -= dt; m.material.opacity = Math.max(0, m.userData.life / 0.12); });
    recoil = Math.max(0, recoil - dt * 7); flash = Math.max(0, flash - dt * 14);
    blaster.position.set(BLASTER_REST.x, BLASTER_REST.y + recoil * 0.01, BLASTER_REST.z + recoil * 0.035);
    blaster.rotation.x = 0.05 + recoil * 0.12;
    muzzle.material.opacity = flash; muzzle.scale.setScalar(0.08 + flash * 0.14);
    const sway = reduceMotion ? 0 : 1;
    look.set(aim.x * 0.6 + Math.sin(time * 0.4) * 0.05 * sway, 1.05 - aim.y * 0.35 + Math.sin(time * 0.6) * 0.03 * sway, -1.6);
    camera.position.x = aim.x * 0.08; camera.lookAt(look);
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(frame);
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 1 ? 72 : 58; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage); resize();
  start();
})();
