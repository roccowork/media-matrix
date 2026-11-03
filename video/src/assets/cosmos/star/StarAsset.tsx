// 资产 cosmos.star.v1：恒星（太阳）。
//   表面：翻腾的等离子体（米粒组织 = 细胞噪声 + 湍流分形，随时间流动）、黑子、临边昏暗（边缘更暗更红）；亮度 >1，交给辉光；
//   日冕：面向镜头的大片光晕，带放射状流线，缓慢变化；
//   日珥：贴着表面拱起的发光弧（管子 + 流动噪声），数量可调。
// 全部由 uTime 驱动、按 seed 生成，确定性。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import {NOISE_GLSL} from '../../../engine/shaders/noise.glsl';
import type {Vec3} from '../../../engine/shot';

export type StarProps = {
  position?: Vec3;
  radius?: number;
  color?: string; // 主色（温度）：橙黄 = 太阳，偏红 = 红矮星，偏蓝白 = 高温恒星
  brightness?: number;
  activity?: number; // 活跃度：湍流强度、黑子、日珥亮度
  corona?: number; // 日冕大小（相对半径）
  prominences?: number; // 日珥数量
  seed?: string | number;
};

const SURF_VERT = /* glsl */ `
varying vec3 vObj; varying vec3 vN; varying vec3 vView;
void main() { vObj = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = -mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`;
const SURF_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uColor; uniform float uBright; uniform float uAct; uniform vec3 uSeed;
varying vec3 vObj; varying vec3 vN; varying vec3 vView;
${NOISE_GLSL}
// 细胞噪声（米粒组织）：返回 F2 - F1（越接近 0 越靠近细胞边界，也就是暗的米粒间隙）
float cellEdge(vec3 p, float t) {
  vec3 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 g = vec3(x, y, z);
    vec3 o = fract(sin(vec3(dot(i + g, vec3(127.1, 311.7, 74.7)), dot(i + g, vec3(269.5, 183.3, 246.1)), dot(i + g, vec3(113.5, 271.9, 124.6)))) * 43758.5453);
    o = 0.5 + 0.42 * sin(t + 6.2831 * o);
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return d2 - d1;
}
void main() {
  vec3 p = normalize(vObj);
  vec3 q = p * 3.0 + uSeed;
  vec3 warp = vec3(fbm3s(q + uTime * 0.05), fbm3s(q + 5.2 - uTime * 0.04), fbm3s(q - 3.7 + uTime * 0.03));
  float turb = fbm3s(q * 1.5 + warp * 1.5 * uAct + uTime * 0.03);
  // 米粒组织：两层（细 + 超米粒），细胞中心亮、边界是暗的细缝
  float e1 = cellEdge(p * 55.0 + warp * 1.5, uTime * 0.5);
  float e2 = cellEdge(p * 14.0 + warp * 0.8 + 9.0, uTime * 0.2);
  float lanes = 1.0 - smoothstep(0.0, 0.12, e1);
  float superL = 1.0 - smoothstep(0.0, 0.06, e2);
  float bright = 0.62 + 0.25 * turb + 0.18 * smoothstep(0.1, 0.5, e1);
  bright -= 0.38 * lanes + 0.12 * superL;
  // 黑子：本影（很暗）+ 半影（放射纹）
  float sp = fbm3s(p * 2.4 + uSeed * 1.3 + uTime * 0.005);
  float umbra = smoothstep(0.62, 0.7, sp) * uAct;
  float pen = smoothstep(0.52, 0.62, sp) * uAct;
  bright *= 1.0 - 0.45 * pen - 0.45 * umbra;
  // 光斑（边缘附近的亮网纹）
  float mu0 = max(dot(normalize(vN), normalize(vView)), 0.0);
  bright += 0.25 * superL * (1.0 - mu0) * uAct;
  vec3 hot = mix(uColor, vec3(1.0, 0.9, 0.65), 0.22);
  vec3 col = mix(uColor * vec3(0.7, 0.22, 0.05), hot, clamp(bright, 0.0, 1.1));
  // 临边昏暗：边缘更暗更红
  float mu = max(dot(normalize(vN), normalize(vView)), 0.0);
  float limb = 0.35 + 0.65 * pow(mu, 0.5);
  col *= limb;
  col = mix(col, col * vec3(1.0, 0.55, 0.3), (1.0 - mu) * 0.6);
  gl_FragColor = vec4(col * uBright * 1.35, 1.0);
}`;

const CORONA_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const CORONA_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uColor; uniform float uScale; uniform float uBright; uniform vec3 uSeed;
varying vec2 vUv;
${NOISE_GLSL}
void main() {
  float r = length(vUv) * uScale;             // 以恒星半径为 1
  if (r < 0.98) discard;
  float a = atan(vUv.y, vUv.x);
  float streams = 0.5 + 0.5 * snoise(vec3(cos(a) * 3.0, sin(a) * 3.0, uTime * 0.15) + uSeed);
  streams = pow(streams, 2.0) * 0.8 + 0.2 * (0.5 + 0.5 * snoise(vec3(cos(a) * 14.0, sin(a) * 14.0, r * 2.0 - uTime * 0.3) + uSeed));
  float fall = exp(-(r - 1.0) * 6.0) * 0.9 + exp(-(r - 1.0) * 1.8) * 0.35 * streams * streams;
  float edge = smoothstep(uScale, uScale * 0.7, r);
  vec3 col = mix(uColor, vec3(1.0, 0.85, 0.6), 0.25) * fall * edge * uBright;
  gl_FragColor = vec4(col * 1.6, 1.0);
}`;

const PROM_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const PROM_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uColor; uniform float uBright; uniform float uOff;
varying vec2 vUv;
${NOISE_GLSL}
void main() {
  float flow = 0.5 + 0.5 * snoise(vec3(vUv.x * 9.0 - uTime * 0.6 + uOff, vUv.y * 3.0, uOff));
  float ends = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
  float a = pow(flow, 1.5) * ends;
  gl_FragColor = vec4(uColor * vec3(1.0, 0.55, 0.25) * a * uBright * 2.0, 1.0);
}`;

const toVec = (seed: string | number) => {
  const n = typeof seed === 'number' ? seed : [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 100003, 7);
  return new THREE.Vector3(((n * 0.6180339) % 1) * 30, ((n * 0.4142135) % 1) * 30, ((n * 0.7320508) % 1) * 30);
};

export const StarAsset: React.FC<StarProps> = ({position = [0, 0, 0], radius = 5, color = '#ffa43a', brightness = 1, activity = 1, corona = 2.6, prominences = 5, seed = 'star'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {camera} = useThree();
  const t = frame / fps;
  const res = useMemo(() => {
    const sv = toVec(seed);
    const col = new THREE.Color(color);
    const surf = new THREE.ShaderMaterial({vertexShader: SURF_VERT, fragmentShader: SURF_FRAG, uniforms: {uTime: {value: 0}, uColor: {value: col}, uBright: {value: brightness}, uAct: {value: activity}, uSeed: {value: sv}}, toneMapped: false});
    const cor = new THREE.ShaderMaterial({vertexShader: CORONA_VERT, fragmentShader: CORONA_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: {uTime: {value: 0}, uColor: {value: col}, uScale: {value: corona}, uBright: {value: brightness}, uSeed: {value: sv}}});
    const proms = Array.from({length: prominences}, (_, i) => {
      const sk = String(seed);
      // 日珥：两个落脚点在表面上，中间拱起
      const c = new THREE.Vector3(random(`${sk}pc${i}x`) - 0.5, random(`${sk}pc${i}y`) - 0.5, random(`${sk}pc${i}z`) - 0.5).normalize();
      const tang = new THREE.Vector3(random(`${sk}pt${i}x`) - 0.5, random(`${sk}pt${i}y`) - 0.5, random(`${sk}pt${i}z`) - 0.5).cross(c).normalize();
      const span = 0.18 + random(`${sk}ps${i}`) * 0.3;
      const height = 0.15 + random(`${sk}ph${i}`) * 0.35;
      const pts = Array.from({length: 13}, (_, k) => {
        const u = k / 12;
        const along = (u - 0.5) * span;
        const base = c.clone().add(tang.clone().multiplyScalar(along)).normalize();
        return base.multiplyScalar(radius * (0.99 + height * Math.sin(u * Math.PI)));
      });
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, radius * (0.012 + random(`${sk}pw${i}`) * 0.02), 8, false);
      const mat = new THREE.ShaderMaterial({vertexShader: PROM_VERT, fragmentShader: PROM_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
        uniforms: {uTime: {value: 0}, uColor: {value: col}, uBright: {value: brightness * activity}, uOff: {value: i * 7.3}}});
      return {geo, mat};
    });
    return {surf, cor, proms};
  }, [color, brightness, activity, corona, prominences, seed, radius]);
  res.surf.uniforms.uTime.value = t;
  res.cor.uniforms.uTime.value = t;
  for (const p of res.proms) p.mat.uniforms.uTime.value = t;
  return (
    <group position={position}>
      <mesh material={res.surf}>
        <sphereGeometry args={[radius, 160, 120]} />
      </mesh>
      {res.proms.map((p, i) => (
        <mesh key={i} geometry={p.geo} material={p.mat} />
      ))}
      {/* 日冕：始终面向镜头 */}
      <mesh material={res.cor} quaternion={camera.quaternion} renderOrder={1}>
        <planeGeometry args={[radius * corona * 2, radius * corona * 2]} />
      </mesh>
    </group>
  );
};
