// 生物资产共用的「体液环境」：几层体积雾云片（有视差）+ 远景虚化光斑（bokeh）+ 近处漂浮微粒。
// 做法和 DNA 资产里的氛围一致（参考 biology.dna.v1），抽出来给细胞 / 病毒复用。
// 雾片和光斑不写深度：开 post.dof 时按「无穷远」虚化，正好当远景；微粒很小，虚不虚影响不大。
// 位置都相对父级 group：雾片排在 -z 方向（镜头建议从 +z 一侧看过来）。随机数全部 random(seed)。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import {useThree} from '@react-three/fiber';
import {NOISE_GLSL} from '../../../engine/shaders/noise.glsl';

const HAZE_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vW;
void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const HAZE_FRAG = /* glsl */ `
uniform vec3 uH1; uniform vec3 uH2; uniform float uAmt; uniform float uTime; uniform float uLayer; uniform float uSc;
varying vec2 vUv; varying vec3 vW;
${NOISE_GLSL}
float fbm3(vec3 p) { return snoise(p) * 0.55 + snoise(p * 2.1 + 3.1) * 0.3 + snoise(p * 4.3 + 7.7) * 0.15; }
void main() {
  vec2 c = vUv - 0.5;
  float edge = smoothstep(0.5, 0.18, length(c * vec2(1.0, 1.25)));
  vec3 q = vec3(vW.xy * 0.07 / uSc, uLayer * 3.7 + uTime * 0.025);
  q.xy += vec2(uTime * 0.012 * (1.0 + uLayer), 0.0);
  float m = smoothstep(-0.35, 0.75, fbm3(q));
  float t = smoothstep(-0.3, 0.6, fbm3(q * 0.6 + 11.0));
  gl_FragColor = vec4(mix(uH1, uH2, t) * m * m * edge * uAmt, 1.0);
}`;
const PTS_VERT = /* glsl */ `
attribute vec4 aP; // xyz 位置，w 随机数
attribute float aKind; // 0 光斑 1 微粒
uniform float uTime; uniform float uHalfH; uniform vec3 uH2; uniform vec3 uWarm; uniform float uAmt; uniform float uSc;
varying vec3 vC; varying float vA; varying float vK;
float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
void main() {
  float w = aP.w; vK = aKind;
  vec3 p; float size;
  if (aKind < 0.5) {
    p = aP.xyz + vec3(sin(uTime * 0.09 + w * 20.0), sin(uTime * 0.07 + w * 40.0), 0.0) * 0.4 * uSc;
    vC = mix(mix(uH2, vec3(0.5, 0.8, 1.0), h1(w * 3.0) * 0.6), uWarm, step(0.88, h1(w * 9.0)));
    vA = uAmt * (0.25 + 0.75 * h1(w * 5.0)) * (0.8 + 0.2 * sin(uTime * 0.9 + w * 60.0));
    size = (0.25 + 0.9 * pow(h1(w * 13.0), 2.0)) * uSc;
  } else {
    p = aP.xyz + vec3(sin(uTime * 0.13 + w * 30.0), sin(uTime * 0.17 + w * 50.0), cos(uTime * 0.11 + w * 70.0)) * 0.25 * uSc;
    vC = mix(vec3(0.55, 0.8, 1.0), uWarm, step(0.85, h1(w * 7.0)));
    vA = (0.2 + 0.6 * pow(h1(w * 11.0), 3.0)) * (0.7 + 0.3 * sin(uTime * 1.3 + w * 90.0)) * min(uAmt, 1.0);
    size = (0.012 + 0.05 * pow(h1(w * 17.0), 8.0)) * uSc;
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = max(1.0, size * projectionMatrix[1][1] * uHalfH / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const PTS_FRAG = /* glsl */ `
varying vec3 vC; varying float vA; varying float vK;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float o;
  if (vK < 0.5) o = (1.0 - smoothstep(0.82, 1.0, r)) * (0.55 + 0.45 * smoothstep(0.45, 0.92, r));
  else o = exp(-r * r * 4.0) * (1.0 - smoothstep(0.85, 1.0, r));
  gl_FragColor = vec4(vC * vA * o, 1.0);
}`;

export type BioMediumProps = {
  amount: number; // 浓度，0 不渲染
  color: string; // 雾主色（深色），亮色由它推出
  scale?: number; // 空间尺度（和资产尺寸成正比）
  seed: string;
};

export const BioMedium: React.FC<BioMediumProps> = ({amount, color, scale = 1, seed}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {size, gl} = useThree();
  const built = useMemo(() => {
    const h1 = new THREE.Color(color);
    const h2 = h1.clone().lerp(new THREE.Color('#3fd0ff'), 0.45).multiplyScalar(1.6);
    const U = {
      uTime: {value: 0}, uHalfH: {value: 540}, uH1: {value: h1.clone().multiplyScalar(0.9 * amount)}, uH2: {value: h2.multiplyScalar(0.55)},
      uAmt: {value: amount}, uWarm: {value: new THREE.Color('#ffb36b')}, uSc: {value: scale},
    };
    const add = (vs: string, fs: string, extra: Record<string, THREE.IUniform> = {}) =>
      new THREE.ShaderMaterial({
        vertexShader: vs, fragmentShader: fs, uniforms: {...U, ...extra}, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
    const layers = [-4, -8, -13, -19, -27, -37].map((z, k) => ({
      mat: add(HAZE_VERT, HAZE_FRAG, {uLayer: {value: k}}),
      pos: [(random(`${seed}-hx${k}`) - 0.5) * 8 * scale, (random(`${seed}-hy${k}`) - 0.5) * 3 * scale, z * scale] as [number, number, number],
      w: (34 + 3.2 * -z) * scale,
    }));
    const nb = Math.round(80 * Math.min(amount, 2));
    const nd = Math.round(500 * Math.min(amount, 2));
    const n = nb + nd;
    const P = new Float32Array(Math.max(1, n) * 4);
    const K = new Float32Array(Math.max(1, n));
    for (let i = 0; i < n; i++) {
      const bok = i < nb;
      P[i * 4] = (random(`${seed}-px${i}`) - 0.5) * (bok ? 50 : 16) * scale;
      P[i * 4 + 1] = (random(`${seed}-py${i}`) - 0.5) * (bok ? 18 : 9) * scale;
      P[i * 4 + 2] = (bok ? -8 - 26 * random(`${seed}-pz${i}`) : (random(`${seed}-pz${i}`) - 0.5) * 12) * scale;
      P[i * 4 + 3] = random(`${seed}-pw${i}`);
      K[i] = bok ? 0 : 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(1, n) * 3), 3));
    geo.setAttribute('aP', new THREE.BufferAttribute(P, 4));
    geo.setAttribute('aKind', new THREE.BufferAttribute(K, 1));
    geo.setDrawRange(0, n);
    const pts = add(PTS_VERT, PTS_FRAG);
    return {U, layers, geo, pts};
  }, [amount, color, scale, seed]);
  if (amount <= 0) return null;
  built.U.uTime.value = frame / fps;
  built.U.uHalfH.value = (size.height * gl.getPixelRatio()) / 2;
  return (
    <group>
      {built.layers.map((l, k) => (
        <mesh key={k} material={l.mat} position={l.pos} scale={[l.w, l.w * 0.6, 1]} frustumCulled={false} renderOrder={-10 + k}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      ))}
      <points geometry={built.geo} material={built.pts} frustumCulled={false} renderOrder={20} />
    </group>
  );
};
