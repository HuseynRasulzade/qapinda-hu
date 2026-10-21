/**
 * Persistent WebGL world. One canvas for the whole site; each page only changes
 * the camera preset + door opening. Contents:
 *  - a PBR doorway (frame + door leaf) with soft shadows
 *  - a GLSL "light through the door" plane (flowing green→orange noise, cursor + scroll reactive)
 *  - instanced floating service tokens
 *  - a GLSL particle field that stretches with scroll velocity
 * Quality auto-lowers if FPS drops.
 */
import * as THREE from 'three';
import { reduced, weak, coarse, state } from './env';

type Preset = { pos: [number, number, number]; look: [number, number, number]; open: number; spin: number; tokens: number };
const PRESETS: Record<string, Preset> = {
  home: { pos: [0.6, 1.0, 7.4], look: [-1.9, 0.9, 0], open: 0.25, spin: 0, tokens: 1 },
  about: { pos: [-4.6, 1.2, 5.6], look: [0, 0.8, 0], open: 0.45, spin: 0.4, tokens: 0.6 },
  how: { pos: [0, 1.1, 5.4], look: [0, 0.9, 0], open: 0, spin: 0, tokens: 0.5 },
  services: { pos: [0, 2.6, 8.5], look: [0, 0.4, 0], open: 0.7, spin: 0, tokens: 1.6 },
  pros: { pos: [4.4, 1.0, 5.6], look: [0, 0.8, 0], open: 0.55, spin: -0.4, tokens: 0.8 },
  reviews: { pos: [-2.5, 0.4, 6.4], look: [0, 1.0, 0], open: 0.35, spin: 0.2, tokens: 1 },
  faq: { pos: [3.2, 2.2, 7.5], look: [0, 0.8, 0], open: 0.15, spin: 0, tokens: 0.4 },
  contact: { pos: [0, 1.0, 2.6], look: [0, 1.1, -2], open: 1, spin: 0, tokens: 0.3 },
  calm: { pos: [0, 1.3, 11], look: [0, 1, 0], open: 0.1, spin: 0, tokens: 0.2 },
  lost: { pos: [0.5, 0.7, 6.4], look: [0, 0.9, 0], open: 0.08, spin: 0, tokens: 0.2 },
};


const noiseGLSL = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;} vec2 mod289(vec2 x){return x-floor(x*(1./289.))*289.;}
vec3 permute(vec3 x){return mod289(((x*34.)+1.)*x);}
float snoise(vec2 v){const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);
vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);
vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod289(i);vec3 p=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);m=m*m;m=m*m;
vec3 x=2.*fract(p*C.www)-1.;vec3 h=abs(x)-.5;vec3 ox=floor(x+.5);vec3 a0=x-ox;
m*=1.79284291400159-.85373472095314*(a0*a0+h*h);vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;return 130.*dot(m,g);}
`;

export function initScene(canvas: HTMLCanvasElement) {
  if (reduced || weak) return null;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, alpha: true, powerPreference: 'high-performance' });
  } catch { return null; }

  let quality = coarse ? 1 : 2; // 2 high, 1 mid, 0 low
  const maxDpr = () => Math.min(devicePixelRatio, quality === 2 ? 2 : quality === 1 ? 1.5 : 1);
  renderer.setPixelRatio(maxDpr());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0e1a12, 0.045);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  camera.position.set(2.2, 0.9, 7.2);

  /* ----- lights ----- */
  scene.add(new THREE.HemisphereLight(0x9aca8a, 0x0e1a12, 0.55));
  const key = new THREE.SpotLight(0xffd2a0, 90, 30, 0.6, 0.8, 1.4);
  key.position.set(-4, 6, 6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 6; key.shadow.bias = -0.0004;
  key.target.position.set(0, 1, 0); scene.add(key, key.target);
  const glow = new THREE.PointLight(0xfd7f0d, 18, 14, 1.6); glow.position.set(0, 1.2, -0.4); scene.add(glow);

  /* ----- doorway ----- */
  const door = new THREE.Group(); scene.add(door);
  const W = 1.7, H = 3.2, T = 0.32, D = 0.5;
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1c3f24, roughness: 0.55, metalness: 0.1 });
  const mk = (w: number, h: number, d: number, x: number, y: number, z = 0, mat: THREE.Material = frameMat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; door.add(m); return m;
  };
  mk(T, H + T, D, -(W / 2 + T / 2), H / 2 + T / 2 - 0.0);
  mk(T, H + T, D, W / 2 + T / 2, H / 2 + T / 2);
  mk(W + T * 2, T, D, 0, H + T / 2);
  // glowing light plane behind the leaf (GLSL)
  const lightMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uMouse: { value: new THREE.Vector2() }, uVel: { value: 0 }, uOpen: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime,uVel,uOpen; uniform vec2 uMouse; varying vec2 vUv; ${noiseGLSL}
      void main(){
        vec2 p=vUv*vec2(1.,1.9)+uMouse*.15;
        float n=snoise(p*1.6+vec2(uTime*.12,-uTime*.2+uVel*.4));
        n+=.5*snoise(p*3.2-vec2(uTime*.18,uTime*.1));
        vec3 green=vec3(.345,.68,.275), orange=vec3(.99,.5,.05), cream=vec3(1.,.93,.78);
        vec3 col=mix(green,orange,smoothstep(-.7,.8,n+vUv.y-.4));
        col=mix(col,cream,smoothstep(.55,1.2,n+(1.-vUv.y)*.6));
        float vig=smoothstep(0.,.35,vUv.x)*smoothstep(1.,.65,vUv.x)*smoothstep(0.,.1,vUv.y);
        gl_FragColor=vec4(col*(.55+.6*uOpen),vig*(.55+.45*uOpen));
      }`,
  });
  const lightPlane = new THREE.Mesh(new THREE.PlaneGeometry(W, H), lightMat); lightPlane.position.set(0, H / 2, -0.12); door.add(lightPlane);
  // door leaf hinged on the left edge
  const hinge = new THREE.Group(); hinge.position.set(-W / 2, 0, 0.1); door.add(hinge);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x58ad46, roughness: 0.32, metalness: 0.15 });
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.12), leafMat); leaf.position.set(W / 2, H / 2, 0); leaf.castShadow = true; hinge.add(leaf);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 24, 16), new THREE.MeshStandardMaterial({ color: 0xfd7f0d, roughness: 0.2, metalness: 0.9 }));
  knob.position.set(W - 0.22, H * 0.45, 0.1); hinge.add(knob);
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x4a9a3a, roughness: 0.4 });
  for (const y of [0.3, 0.68]) { const p = new THREE.Mesh(new THREE.BoxGeometry(W * 0.62, H * 0.3, 0.03), panelMat); p.position.set(W / 2, H * y + 0.18, 0.075); hinge.add(p); }
  door.position.set(0, 0, 0);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.45 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  /* ----- instanced service tokens ----- */
  const COUNT = quality === 2 ? 70 : 36;
  const tokenGeo = new THREE.IcosahedronGeometry(0.16, 0);
  const tokens = new THREE.InstancedMesh(tokenGeo, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.2 }), COUNT);
  tokens.castShadow = false;
  const seeds: { r: number; a: number; y: number; s: number; sp: number }[] = [];
  const palette = [0x58ad46, 0x9aca8a, 0xfd7f0d, 0xf4f1e8].map((c) => new THREE.Color(c));
  for (let i = 0; i < COUNT; i++) {
    seeds.push({ r: 2.6 + Math.random() * 5, a: Math.random() * Math.PI * 2, y: Math.random() * 4, s: 0.5 + Math.random() * 1.3, sp: 0.05 + Math.random() * 0.12 });
    tokens.setColorAt(i, palette[i % palette.length]);
  }
  scene.add(tokens);
  const dummy = new THREE.Object3D();

  /* ----- GLSL particle field ----- */
  const PN = quality === 2 ? 1400 : 600;
  const pg = new THREE.BufferGeometry();
  const pp = new Float32Array(PN * 3), ps = new Float32Array(PN);
  for (let i = 0; i < PN; i++) { pp[i * 3] = (Math.random() - 0.5) * 24; pp[i * 3 + 1] = Math.random() * 9 - 1; pp[i * 3 + 2] = (Math.random() - 0.5) * 20 - 2; ps[i] = Math.random(); }
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('aSeed', new THREE.BufferAttribute(ps, 1));
  const pm = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uVel: { value: 0 }, uMouse: { value: new THREE.Vector2() }, uPx: { value: renderer.getPixelRatio() } },
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime,uVel,uPx; uniform vec2 uMouse; varying float vA; varying float vS;
      void main(){ vec3 p=position; p.y+=mod(uTime*(.08+aSeed*.15)+aSeed*9.,9.)-1.; p.y=mod(p.y+1.,9.)-1.;
        p.x+=sin(uTime*.3+aSeed*20.)*.3+uMouse.x*aSeed*1.5; p.y+=uVel*(aSeed-.3)*2.;
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=(1.5+aSeed*3.5+abs(uVel)*6.)*uPx*(8./-mv.z); vA=.25+.6*aSeed; vS=aSeed; }`,
    fragmentShader: /* glsl */ `varying float vA; varying float vS; void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard;
      vec3 c=mix(vec3(.6,.8,.5),vec3(1.,.55,.1),step(.78,vS)); gl_FragColor=vec4(c,smoothstep(.5,0.,d)*vA); }`,
  });
  scene.add(new THREE.Points(pg, pm));

  /* ----- state, resize, loop ----- */
  let preset = PRESETS.home;
  const camPos = new THREE.Vector3().fromArray(preset.pos), camLook = new THREE.Vector3().fromArray(preset.look);
  const wantPos = camPos.clone(), wantLook = camLook.clone();
  let open = 0, wantOpen = 0, spin = 0, tokenAmt = 1, tokenWant = 1;
  const clock = new THREE.Clock();

  const resize = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // on narrow screens pull back and centre the door so it sits behind the copy
    camera.fov = w < 700 ? 58 : 42;
    camera.updateProjectionMatrix();
  };
  resize(); addEventListener('resize', resize);

  function setScene(name: string) {
    preset = PRESETS[name] ?? PRESETS.home;
    const narrow = innerWidth < 800;
    wantPos.fromArray(preset.pos); wantLook.fromArray(preset.look);
    if (narrow) { wantPos.z += 3; wantLook.x *= 0.3; wantPos.x *= 0.4; }
    wantOpen = preset.open; tokenWant = preset.tokens;
    state.doorOverride = -1;
  }

  // FPS watchdog: step quality down if we stay under ~48fps
  let frames = 0, acc = 0;
  const watchdog = (dt: number) => {
    acc += dt; frames++;
    if (acc > 2) {
      const fps = frames / acc; frames = acc = 0;
      if (fps < 48 && quality > 0) {
        quality--; renderer.setPixelRatio(maxDpr()); pm.uniforms.uPx.value = renderer.getPixelRatio(); resize();
        if (quality === 0) { renderer.shadowMap.enabled = false; key.castShadow = false; tokens.count = 18; }
      }
    }
  };

  let running = true;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) clock.getDelta(); });

  renderer.setAnimationLoop(() => {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    watchdog(dt);
    const k = 1 - Math.pow(0.0015, dt); // frame-rate independent damping
    camPos.lerp(wantPos, k * 0.9); camLook.lerp(wantLook, k * 0.9);
    open += ((state.doorOverride >= 0 ? state.doorOverride : wantOpen) - open) * k;
    tokenAmt += (tokenWant - tokenAmt) * k;
    spin += (preset.spin - spin) * k;

    camera.position.set(camPos.x + state.mx * 0.6, camPos.y + state.my * 0.35, camPos.z);
    camera.lookAt(camLook);
    hinge.rotation.y = -open * 1.7 + state.mx * 0.04;
    door.rotation.y = spin + state.mx * 0.12;
    glow.intensity = 10 + open * 40 + Math.sin(t * 2) * 1.5;
    glow.position.x = state.mx * 1.2; key.position.x = -4 + state.mx * 1.5;
    lightMat.uniforms.uTime.value = t; lightMat.uniforms.uMouse.value.set(state.mx, state.my); lightMat.uniforms.uVel.value = state.scrollV; lightMat.uniforms.uOpen.value = open;
    pm.uniforms.uTime.value = t; pm.uniforms.uVel.value = state.scrollV; pm.uniforms.uMouse.value.set(state.mx, state.my);

    for (let i = 0; i < tokens.count; i++) {
      const s = seeds[i]; const a = s.a + t * s.sp;
      dummy.position.set(Math.cos(a) * s.r, 0.4 + s.y * 0.8 + Math.sin(t * s.s + i) * 0.25, Math.sin(a) * s.r * 0.8 - 4.5);
      dummy.rotation.set(t * s.sp * 3 + i, t * s.sp * 2, 0);
      dummy.scale.setScalar(Math.max(0.001, tokenAmt) * (0.35 + s.s * 0.3));
      dummy.updateMatrix(); tokens.setMatrixAt(i, dummy.matrix);
    }
    tokens.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
  });

  canvas.classList.add('ready');
  document.documentElement.classList.add('gl-on');
  return { setScene };
}
