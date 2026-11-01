/**
 * Hero: a displaced wireframe icosahedron in acid lime that bulges towards
 * the pointer (the bulge is where the orange lives), over a sparse layer of
 * points. Tree-shaken `three` imports only.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Mesh,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from 'three';
import { hoverForMove, pacingFor } from '../lib/frame-pacing';
import { devicePixelRatioCapped, isLowEnd, visibleLoop } from './env';

const SNOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const MESH_VERT = /* glsl */ `
uniform float uTime;
uniform float uAmp;
uniform float uHover;
uniform vec3 uPointer;
varying float vNoise;
varying float vBulge;
${SNOISE}
void main(){
  vec3 p = position;
  float n = snoise(p * 1.35 + vec3(0.0, uTime * 0.21, uTime * 0.12));
  vec4 world = modelMatrix * vec4(p, 1.0);
  float d = distance(world.xyz, uPointer);
  float bulge = (1.0 - smoothstep(0.0, 1.35, d)) * uHover;
  vec3 displaced = p + normal * (n * uAmp + bulge * 0.6);
  vNoise = n;
  vBulge = bulge;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}`;

const MESH_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform vec3 uColorHot;
varying float vNoise;
varying float vBulge;
void main(){
  vec3 c = mix(uColor, uColorHot, clamp(vBulge * 1.6, 0.0, 1.0));
  float a = 0.45 + 0.55 * smoothstep(-0.9, 0.9, vNoise);
  gl_FragColor = vec4(c, a);
}`;

const PTS_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
uniform float uTime;
uniform float uPixelRatio;
varying float vA;
void main(){
  vec3 p = position;
  p.y += sin(uTime * 0.35 + aPhase) * 0.12;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = aSize * uPixelRatio * (7.0 / -mv.z);
  vA = 0.3 + 0.7 * (0.5 + 0.5 * sin(uTime * 0.9 + aPhase * 4.0));
  gl_Position = projectionMatrix * mv;
}`;

const PTS_FRAG = /* glsl */ `
precision mediump float;
uniform vec3 uColor;
varying float vA;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  if (dot(c, c) > 0.25) discard;
  gl_FragColor = vec4(uColor, vA * 0.55);
}`;

export interface HeroOptions {
  reduced: boolean;
}

export function mountHero(canvas: HTMLCanvasElement, opts: HeroOptions): () => void {
  const host = canvas.parentElement ?? canvas;
  const lowEnd = isLowEnd();

  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(devicePixelRatioCapped());
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(36, 1, 0.1, 40);
  camera.position.set(0, 0, 6.2);

  // Icosahedron -------------------------------------------------------------
  const geo = new IcosahedronGeometry(1.55, lowEnd ? 3 : 4);
  const meshMat = new ShaderMaterial({
    vertexShader: MESH_VERT,
    fragmentShader: MESH_FRAG,
    wireframe: true,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uAmp: { value: 0.22 },
      uHover: { value: 0 },
      uPointer: { value: new Vector3(99, 99, 0) },
      uColor: { value: new Color('#c6ff3d') },
      uColorHot: { value: new Color('#ff5a36') },
    },
  });
  const mesh = new Mesh(geo, meshMat);
  mesh.rotation.set(0.35, -0.4, 0.1);
  scene.add(mesh);

  // Points ------------------------------------------------------------------
  let points: Points | null = null;
  if (!lowEnd) {
    const count = 1400;
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = 2.6 + Math.random() * 2.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.8;
      pos[i * 3 + 2] = r * Math.cos(phi);
      size[i] = 0.6 + Math.random() * 1.4;
      phase[i] = Math.random() * Math.PI * 2;
    }
    const pgeo = new BufferGeometry();
    pgeo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    pgeo.setAttribute('aSize', new Float32BufferAttribute(size, 1));
    pgeo.setAttribute('aPhase', new Float32BufferAttribute(phase, 1));
    const pmat = new ShaderMaterial({
      vertexShader: PTS_VERT,
      fragmentShader: PTS_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: renderer.getPixelRatio() },
        uColor: { value: new Color('#8f8f89') },
      },
    });
    points = new Points(pgeo, pmat);
    scene.add(points);
  }

  // Sizing ------------------------------------------------------------------
  const resize = () => {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  // Pointer -----------------------------------------------------------------
  const target = { x: 0, y: 0, hover: 0 };
  const current = { x: 0, y: 0, hover: 0 };
  const ndc = new Vector3();
  const pointerWorld = new Vector3(99, 99, 0);

  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
    // Only bulge while the pointer is over the canvas; still rotate otherwise.
    const inside = nx >= -1 && nx <= 1 && ny >= -1 && ny <= 1;
    const hover = hoverForMove({ pointerType: e.pointerType, inside });
    // Touch moves count as input for the idle clock (in visibleLoop) but never drive hover or tilt.
    if (hover === null) return;
    target.x = nx;
    target.y = ny;
    target.hover = hover;
    if (inside) {
      ndc.set(nx, ny, 0.5).unproject(camera);
      const dir = ndc.sub(camera.position).normalize();
      const t = -camera.position.z / dir.z;
      pointerWorld.copy(camera.position).addScaledVector(dir, t);
    }
  };
  // The container is pointer-events: none, so the canvas never gets pointerleave. Clear the
  // bulge when the pointer leaves the document (relatedTarget is null) or the window loses focus.
  const onOut = (e: PointerEvent) => {
    if (e.relatedTarget === null) target.hover = 0;
  };
  const onBlur = () => {
    target.hover = 0;
  };

  // Render ------------------------------------------------------------------
  let t = 0;
  const draw = (dt: number) => {
    t += dt;
    current.x += (target.x - current.x) * 0.06;
    current.y += (target.y - current.y) * 0.06;
    current.hover += (target.hover - current.hover) * 0.08;

    mesh.rotation.y = -0.4 + 0.35 * Math.sin(t * 0.1) + current.x * 0.45 + t * 0.08;
    mesh.rotation.x = 0.35 + current.y * -0.35 + Math.sin(t * 0.17) * 0.08;
    meshMat.uniforms.uTime!.value = t;
    meshMat.uniforms.uHover!.value = current.hover;
    (meshMat.uniforms.uPointer!.value as Vector3).copy(pointerWorld);

    if (points) {
      points.rotation.y = t * 0.03 + current.x * 0.1;
      points.rotation.x = current.y * -0.08;
      (points.material as ShaderMaterial).uniforms.uTime!.value = t;
    }
    renderer.render(scene, camera);
  };

  canvas.classList.add('is-ready');

  if (opts.reduced) {
    // One static frame; no loop, no pointer.
    t = 2.4;
    draw(0);
    return () => {
      ro.disconnect();
      renderer.dispose();
    };
  }

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerout', onOut, { passive: true });
  window.addEventListener('blur', onBlur);
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const stop = visibleLoop(canvas, draw, pacingFor({ coarse, lowEnd }));

  return () => {
    stop();
    ro.disconnect();
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerout', onOut);
    window.removeEventListener('blur', onBlur);
    geo.dispose();
    meshMat.dispose();
    renderer.dispose();
  };
}
