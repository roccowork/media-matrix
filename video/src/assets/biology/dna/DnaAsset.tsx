// 资产 biology.dna.v1：程序化 DNA 双螺旋（电影级科学可视化风格：深色背景、半透明发光骨架、彩色碱基对横档）。
// 螺旋轴沿 x，第 i 个碱基对在 x = (i - (N-1)/2) * rise；两条链相位差约 140°（形成大沟 / 小沟）。
// 所有几何的位置都在顶点着色器里由同一个 strandPos(i, s) 算出（骨架管、磷酸 / 糖原子、碱基、粒子），
// 所以自旋、解旋只改几个 uniform，CPU 每帧零开销、结果确定。
//   骨架：沿链参数化的平滑管（着色器里求切线 / 法线），半透明 + 菲涅尔边缘光 + 内部透光；
//   原子：InstancedMesh 小球（每个碱基对两侧各一个磷酸 + 一个糖）；
//   碱基：InstancedMesh 扁平横档（每对两半，各自一种颜色，A-T / G-C 配对），中间留氢键缝，缝里一点亮光；
//   解旋：从 unzipAt 秒起，从左端（i = 0）开始双链分开，分叉点（解旋酶位置）有一团亮光；
//   粒子：沿两条链流动的发光粒子（flow）+ 周围漂浮的微尘（dust，增加纵深，配合 post.dof 虚化）。
// 随机：碱基序列、粒子分布全部用 remotion 的 random(seed)。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Vec3} from '../../../engine/shot';

export type DnaProps = {
  position?: Vec3;
  length?: number; // 碱基对数量
  radius?: number; // 螺旋半径
  twist?: number; // 每个碱基对转过的角度（度），B 型 DNA ≈ 34.3
  spin?: number; // 自旋角速度（弧度 / 秒）
  backbone?: string;
  baseA?: string;
  baseT?: string;
  baseG?: string;
  baseC?: string;
  glow?: number; // 发光强度倍数
  unzipAt?: number; // 秒；-1 不解旋
  unzipSpeed?: number; // 每秒解开的碱基对数
  flow?: boolean; // 沿链流动的发光粒子
  dust?: number; // 周围微尘密度倍数
  seed?: string | number;
};

// 共用：螺旋位置函数（所有着色器都包含这一段）
const HELIX_GLSL = /* glsl */ `
uniform float uN; uniform float uRise; uniform float uR; uniform float uTwist; uniform float uSpin; uniform float uPhase;
uniform float uFork; uniform float uOpen; uniform float uTime;
float sepAt(float i) { return smoothstep(0.0, 4.0, uFork - i); }               // 0 = 配对，1 = 已分开
float openAt(float i) { return uOpen * smoothstep(0.0, 16.0, uFork - i); }    // 分开的距离（越远离分叉点越开）
vec3 axisAt(float i, float s) {
  float side = s * 2.0 - 1.0;
  float o = openAt(i);
  return vec3((i - (uN - 1.0) * 0.5) * uRise, side * o, -0.35 * o);
}
vec3 strandPos(float i, float s) {
  float sep = sepAt(i);
  float ang = i * uTwist + uSpin + s * uPhase;
  float r = uR * (1.0 - 0.4 * sep);
  return axisAt(i, s) + vec3(0.0, cos(ang) * r, sin(ang) * r);
}
`;

// 共用：半透明「次表面」质感着色（视空间）
const SHADE_GLSL = /* glsl */ `
uniform float uGlow; uniform vec3 uRim;
vec3 shade(vec3 base, vec3 rim, vec3 n, vec3 v, float emis, out float fres) {
  vec3 L = normalize(vec3(-0.35, 0.7, 0.6));
  float ndl = dot(n, L);
  float wrap = clamp((ndl + 0.45) / 1.45, 0.0, 1.0);
  fres = pow(1.0 - clamp(abs(dot(n, v)), 0.0, 1.0), 2.6);
  vec3 H = normalize(L + v);
  float spec = pow(max(dot(n, H), 0.0), 60.0);
  vec3 col = base * (0.02 + 0.42 * wrap);
  col += base * base * 0.4 * (1.0 - wrap) * (0.5 + 0.5 * (1.0 - fres));      // 暗部透出饱和的颜色（次表面感）
  col += rim * fres * 1.7 * uGlow;                                          // 菲涅尔边缘光
  col += vec3(1.0) * spec * 0.45;
  col += base * emis * uGlow;
  return col;
}
`;

const BACKBONE_VERT = /* glsl */ `
attribute vec3 aT; // x = 沿链的碱基对序号（连续），y = 绕管角度，z = 链 0 / 1
uniform float uTubeR;
varying vec3 vN; varying vec3 vV; varying float vI;
${HELIX_GLSL}
void main() {
  float i = aT.x; float s = aT.z;
  vec3 C = strandPos(i, s);
  vec3 T = normalize(strandPos(i + 0.03, s) - strandPos(i - 0.03, s));
  vec3 ref = C - axisAt(i, s);
  vec3 N0 = normalize(ref - T * dot(ref, T));
  vec3 B = cross(T, N0);
  float cap = sqrt(clamp(min(i + 0.45, uN - 0.55 - i) / 0.3, 0.0, 1.0));      // 两端收口
  vec3 nrm = cos(aT.y) * N0 + sin(aT.y) * B;
  vec3 p = C + nrm * uTubeR * cap;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vV = -mv.xyz; vN = normalize(normalMatrix * nrm); vI = i;
  gl_Position = projectionMatrix * mv;
}`;
const BACKBONE_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uTime;
varying vec3 vN; varying vec3 vV; varying float vI;
${SHADE_GLSL}
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(vV);
  float fres;
  float pulse = 0.5 + 0.5 * sin(vI * 0.9 - uTime * 2.2);
  vec3 col = shade(uCol * 0.85, uRim, n, v, 0.3 + 0.35 * pulse * pulse, fres);
  gl_FragColor = vec4(col, 0.4 + 0.6 * fres);
}`;

// 原子（磷酸 / 糖）和碱基都是 InstancedMesh，位置在着色器里按 aIdx 算
const ATOM_VERT = /* glsl */ `
attribute vec3 aIdx; // i, s, kind（0 磷酸：两个碱基对之间；1 糖：碱基接在骨架上的地方）
uniform float uAtomR;
varying vec3 vN; varying vec3 vV; varying float vKind;
${HELIX_GLSL}
void main() {
  float i = aIdx.x; float s = aIdx.y; float kind = aIdx.z;
  vec3 c;
  float r;
  if (kind < 0.5) { c = strandPos(i + 0.5, s); r = uAtomR; }
  else {
    vec3 P = strandPos(i, s);
    vec3 inward = normalize(axisAt(i, s) - P);
    c = P + inward * uAtomR * 0.9; r = uAtomR * 0.72;
  }
  vec3 p = c + position * r;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vV = -mv.xyz; vN = normalize(normalMatrix * normal); vKind = kind;
  gl_Position = projectionMatrix * mv;
}`;
const ATOM_FRAG = /* glsl */ `
uniform vec3 uCol;
varying vec3 vN; varying vec3 vV; varying float vKind;
${SHADE_GLSL}
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(vV);
  float fres;
  vec3 base = vKind < 0.5 ? uCol * 0.75 : mix(uCol, vec3(0.7, 0.9, 1.0), 0.3) * 0.6;
  vec3 col = shade(base, uRim, n, v, vKind < 0.5 ? 0.12 : 0.06, fres);
  gl_FragColor = vec4(col, 1.0);
}`;

const BASE_VERT = /* glsl */ `
attribute vec3 aIdx; // i, s, 碱基种类 0 A / 1 T / 2 G / 3 C
uniform float uBaseW; uniform float uBaseTh; uniform vec3 uBaseCol[4];
varying vec3 vN; varying vec3 vV; varying vec3 vCol; varying float vY; varying float vSep;
${HELIX_GLSL}
void main() {
  float i = aIdx.x; float s = aIdx.y;
  vec3 P = strandPos(i, s);
  vec3 Q = strandPos(i, 1.0 - s);
  float sep = sepAt(i);
  vec3 dPair = 0.5 * (Q - P);
  vec3 dSep = normalize(axisAt(i, s) - P) * length(dPair) * 0.85;
  vec3 d = mix(dPair, dSep, sep);
  float len = length(d);
  vec3 Y = d / len;
  vec3 X = vec3(1.0, 0.0, 0.0); X = normalize(X - Y * dot(X, Y));           // 碱基是平板：法线大致沿螺旋轴
  vec3 Z = cross(X, Y);
  // 局部几何：圆柱 y ∈ [0,1]，半径 1
  float y = position.y + 0.5;
  vec3 p = P + d * (0.18 + 0.76 * y) + X * position.x * uBaseTh + Z * position.z * uBaseW;
  vec3 nl = normal.x / uBaseTh * X + normal.y * Y + normal.z / uBaseW * Z;
  int k = int(aIdx.z + 0.5);
  vCol = k == 0 ? uBaseCol[0] : k == 1 ? uBaseCol[1] : k == 2 ? uBaseCol[2] : uBaseCol[3];
  vY = y; vSep = sep;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vV = -mv.xyz; vN = normalize(normalMatrix * nl);
  gl_Position = projectionMatrix * mv;
}`;
const BASE_FRAG = /* glsl */ `
varying vec3 vN; varying vec3 vV; varying vec3 vCol; varying float vY; varying float vSep;
${SHADE_GLSL}
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(vV);
  float fres;
  float tip = smoothstep(0.55, 1.0, vY) * (1.0 - vSep * 0.6);               // 靠近氢键的一端更亮
  vec3 col = shade(vCol * 0.8, mix(vCol, vec3(1.0), 0.25) * 0.8, n, v, 0.3 + 1.0 * tip, fres);
  gl_FragColor = vec4(col, 1.0);
}`;

// 发光点：kind 0 沿链流动的粒子；1 氢键缝里的亮点；2 分叉点的亮光
const GLOW_VERT = /* glsl */ `
attribute vec4 aG; // kind, a, b, c
uniform float uHalfH; uniform float uFlowSpeed; uniform vec3 uFlowCol; uniform vec3 uForkCol; uniform float uGlowAmt;
varying vec3 vC; varying float vA;
${HELIX_GLSL}
float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
void main() {
  float kind = aG.x;
  vec3 p; float size; vec3 col; float a;
  if (kind < 0.5) {
    float s = aG.z;
    float i = mod(aG.y * uN + uTime * uFlowSpeed * (0.7 + 0.6 * h1(aG.w * 13.0)), uN) - 0.5;
    vec3 j = vec3(h1(aG.w * 3.1), h1(aG.w * 5.7), h1(aG.w * 9.3)) - 0.5;
    p = strandPos(i, s) + j * uR * 0.32;
    size = uR * (0.04 + 0.08 * pow(h1(aG.w * 21.0), 3.0));
    col = mix(uFlowCol, vec3(1.0), 0.35);
    a = 1.4 * (0.6 + 0.4 * sin(uTime * 3.0 + aG.w * 40.0)) * smoothstep(-0.5, 2.0, i) * smoothstep(uN - 0.5, uN - 3.0, i);
  } else if (kind < 1.5) {
    float i = aG.y;
    p = 0.5 * (strandPos(i, 0.0) + strandPos(i, 1.0));
    size = uR * 0.13;
    col = vec3(0.75, 0.9, 1.0);
    a = 0.55 * (1.0 - sepAt(i)) * (0.75 + 0.25 * sin(uTime * 2.0 + i));
  } else {
    float i = clamp(uFork - 0.5, 0.0, uN - 1.0);
    p = 0.5 * (strandPos(i, 0.0) + strandPos(i, 1.0)) + (vec3(h1(aG.y), h1(aG.y + 1.7), h1(aG.y + 3.3)) - 0.5) * uR * 0.5;
    size = uR * (aG.y < 0.5 ? 1.0 : 0.2 + 0.3 * h1(aG.y + 7.0));
    col = uForkCol;
    a = (aG.y < 0.5 ? 0.22 : 0.7) * smoothstep(0.0, 1.5, uFork) * smoothstep(uN + 2.0, uN - 1.0, uFork) * (0.8 + 0.2 * sin(uTime * 6.0 + aG.y * 9.0));
  }
  vC = col; vA = a * uGlowAmt;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = max(1.0, size * projectionMatrix[1][1] * uHalfH / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const GLOW_FRAG = /* glsl */ `
varying vec3 vC; varying float vA;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float g = exp(-r * r * 5.0) * (1.0 - smoothstep(0.8, 1.0, r));
  gl_FragColor = vec4(vC * vA * g * 2.2, 1.0);
}`;

const DUST_VERT = /* glsl */ `
attribute vec4 aD; // xyz 位置，w 随机数
uniform float uTime; uniform float uHalfH; uniform vec3 uA; uniform vec3 uB;
varying vec3 vC; varying float vA;
float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
void main() {
  float w = aD.w;
  vec3 p = aD.xyz + vec3(sin(uTime * 0.13 + w * 30.0), sin(uTime * 0.17 + w * 50.0), cos(uTime * 0.11 + w * 70.0)) * 0.25;
  vC = mix(uA, uB, step(0.82, h1(w * 7.0)));
  vA = 0.25 + 0.75 * pow(h1(w * 11.0), 3.0);
  vA *= 0.7 + 0.3 * sin(uTime * 1.3 + w * 90.0);
  float size = 0.014 + 0.07 * pow(h1(w * 17.0), 8.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = max(1.0, size * projectionMatrix[1][1] * uHalfH / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const DUST_FRAG = /* glsl */ `
varying vec3 vC; varying float vA;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float g = exp(-r * r * 4.0) * (1.0 - smoothstep(0.85, 1.0, r));
  gl_FragColor = vec4(vC * vA * g, 1.0);
}`;

const PAIRS: [number, number][] = [
  [0, 1], // A-T
  [1, 0], // T-A
  [2, 3], // G-C
  [3, 2], // C-G
];

export const DnaAsset: React.FC<DnaProps> = ({
  position = [0, 0, 0],
  length = 40,
  radius = 1,
  twist = 34.3,
  spin = 0.25,
  backbone = '#4f9dff',
  baseA = '#ff4f6a',
  baseT = '#ffc23d',
  baseG = '#27e3a0',
  baseC = '#4a6bff',
  glow = 1,
  unzipAt = -1,
  unzipSpeed = 4,
  flow = true,
  dust = 1,
  seed = 'dna',
}) => {
  const frame = useCurrentFrame();
  const {fps, height} = useVideoConfig();
  const t = frame / fps;
  const N = Math.max(2, Math.round(length));
  const S = String(seed);

  const U = useMemo(
    () => ({
      uN: {value: N},
      uRise: {value: 0.34},
      uR: {value: 1},
      uTwist: {value: 0.6},
      uSpin: {value: 0},
      uPhase: {value: (140 * Math.PI) / 180},
      uFork: {value: -100},
      uOpen: {value: 2},
      uTime: {value: 0},
      uGlow: {value: 1},
      uRim: {value: new THREE.Color()},
      uHalfH: {value: height / 2},
    }),
    [N, height],
  );

  const built = useMemo(() => {
    // ── 骨架管：每条链一段参数网格（沿链 × 绕管） ──
    const along = N * 10 + 10;
    const around = 16;
    const verts = 2 * (along + 1) * (around + 1);
    const aT = new Float32Array(verts * 3);
    const idx: number[] = [];
    let v = 0;
    for (let s = 0; s < 2; s++) {
      const base = v;
      for (let a = 0; a <= along; a++) {
        const i = -0.45 + (a / along) * (N - 0.1);
        for (let r = 0; r <= around; r++) {
          aT[v * 3] = i;
          aT[v * 3 + 1] = (r / around) * Math.PI * 2;
          aT[v * 3 + 2] = s;
          v++;
        }
      }
      for (let a = 0; a < along; a++)
        for (let r = 0; r < around; r++) {
          const p0 = base + a * (around + 1) + r;
          const p1 = p0 + around + 1;
          idx.push(p0, p1, p0 + 1, p1, p1 + 1, p0 + 1);
        }
    }
    const tube = new THREE.BufferGeometry();
    tube.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    tube.setAttribute('aT', new THREE.BufferAttribute(aT, 3));
    tube.setIndex(idx);

    // ── 碱基序列（种子决定） ──
    const seq: [number, number][] = [];
    for (let i = 0; i < N; i++) seq.push(PAIRS[Math.min(3, Math.floor(random(`${S}-bp${i}`) * 4))]);

    // ── 碱基：InstancedMesh，每对两半 ──
    const baseGeo = new THREE.CylinderGeometry(1, 1, 1, 18, 1);
    const bIdx = new Float32Array(N * 2 * 3);
    for (let i = 0; i < N; i++)
      for (let s = 0; s < 2; s++) {
        const j = (i * 2 + s) * 3;
        bIdx[j] = i;
        bIdx[j + 1] = s;
        bIdx[j + 2] = seq[i][s];
      }
    baseGeo.setAttribute('aIdx', new THREE.InstancedBufferAttribute(bIdx, 3));

    // ── 原子（磷酸 + 糖）：InstancedMesh ──
    const atomGeo = new THREE.IcosahedronGeometry(1, 3);
    const aIdx: number[] = [];
    for (let i = 0; i < N; i++)
      for (let s = 0; s < 2; s++) {
        if (i < N - 1) aIdx.push(i, s, 0);
        aIdx.push(i, s, 1);
      }
    atomGeo.setAttribute('aIdx', new THREE.InstancedBufferAttribute(new Float32Array(aIdx), 3));
    const atomCount = aIdx.length / 3;

    // ── 发光点：流动粒子 + 氢键亮点 + 分叉亮光 ──
    const g: number[] = [];
    if (flow) {
      const per = N * 9;
      for (let s = 0; s < 2; s++) for (let k = 0; k < per; k++) g.push(0, random(`${S}-fl${s}-${k}`), s, random(`${S}-fw${s}-${k}`) * 100);
    }
    for (let i = 0; i < N; i++) g.push(1, i, 0, 0);
    for (let k = 0; k < 24; k++) g.push(2, k === 0 ? 0 : 1 + random(`${S}-fk${k}`) * 10, 0, 0);
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((g.length / 4) * 3), 3));
    glowGeo.setAttribute('aG', new THREE.BufferAttribute(new Float32Array(g), 4));

    // ── 微尘 ──
    const nd = Math.round(5000 * dust);
    const d = new Float32Array(Math.max(1, nd) * 4);
    const half = (N * 0.34) / 2 + 6;
    for (let k = 0; k < nd; k++) {
      d[k * 4] = (random(`${S}-dx${k}`) - 0.5) * 2 * half;
      d[k * 4 + 1] = (random(`${S}-dy${k}`) - 0.5) * 12;
      d[k * 4 + 2] = (random(`${S}-dz${k}`) - 0.5) * 16 - 2;
      d[k * 4 + 3] = random(`${S}-dw${k}`);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(1, nd) * 3), 3));
    dustGeo.setAttribute('aD', new THREE.BufferAttribute(d, 4));
    dustGeo.setDrawRange(0, nd);

    const mat = (vs: string, fs: string, extra: Record<string, THREE.IUniform>, opts: Partial<THREE.ShaderMaterialParameters> = {}) =>
      new THREE.ShaderMaterial({vertexShader: vs, fragmentShader: fs, uniforms: {...U, ...extra}, ...opts});
    const mats = {
      tube: mat(BACKBONE_VERT, BACKBONE_FRAG, {uCol: {value: new THREE.Color()}, uTubeR: {value: 0.1}}, {transparent: true, depthWrite: true, side: THREE.FrontSide}),
      atom: mat(ATOM_VERT, ATOM_FRAG, {uCol: {value: new THREE.Color()}, uAtomR: {value: 0.17}}),
      base: mat(BASE_VERT, BASE_FRAG, {uBaseW: {value: 0.16}, uBaseTh: {value: 0.055}, uBaseCol: {value: [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()]}}),
      glow: mat(GLOW_VERT, GLOW_FRAG, {uFlowSpeed: {value: 2.5}, uFlowCol: {value: new THREE.Color()}, uForkCol: {value: new THREE.Color('#7fd0ff')}, uGlowAmt: {value: 1}}, {transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}),
      dust: mat(DUST_VERT, DUST_FRAG, {uA: {value: new THREE.Color('#5aa8ff')}, uB: {value: new THREE.Color('#ffb36b')}}, {transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}),
    };
    const bases = new THREE.InstancedMesh(baseGeo, mats.base, N * 2);
    const atoms = new THREE.InstancedMesh(atomGeo, mats.atom, atomCount);
    for (const m of [bases, atoms]) m.frustumCulled = false;
    return {tube, glowGeo, dustGeo, mats, bases, atoms};
  }, [N, S, flow, dust, U]);

  // ── 每帧：只改 uniform ──
  const r = radius;
  U.uR.value = r;
  U.uRise.value = 0.34 * r;
  U.uTwist.value = (twist * Math.PI) / 180;
  U.uSpin.value = spin * t;
  U.uOpen.value = 2.0 * r;
  U.uFork.value = unzipAt < 0 ? -100 : (t - unzipAt) * unzipSpeed;
  U.uTime.value = t;
  U.uGlow.value = glow;
  const bb = new THREE.Color(backbone);
  U.uRim.value.copy(bb).lerp(new THREE.Color('#ffffff'), 0.45);
  const {mats} = built;
  mats.tube.uniforms.uCol.value.copy(bb);
  mats.tube.uniforms.uTubeR.value = 0.1 * r;
  mats.atom.uniforms.uCol.value.copy(bb);
  mats.atom.uniforms.uAtomR.value = 0.13 * r;
  mats.base.uniforms.uBaseW.value = 0.18 * r;
  mats.base.uniforms.uBaseTh.value = 0.045 * r;
  [baseA, baseT, baseG, baseC].forEach((c, k) => (mats.base.uniforms.uBaseCol.value[k] as THREE.Color).set(c));
  mats.glow.uniforms.uFlowCol.value.copy(bb);
  mats.glow.uniforms.uGlowAmt.value = glow;
  mats.dust.uniforms.uA.value.copy(bb).lerp(new THREE.Color('#9fd0ff'), 0.4);

  return (
    <group position={position}>
      <primitive object={built.bases} />
      <primitive object={built.atoms} />
      <mesh geometry={built.tube} material={mats.tube} frustumCulled={false} renderOrder={1} />
      <points geometry={built.glowGeo} material={mats.glow} frustumCulled={false} renderOrder={2} />
      <points geometry={built.dustGeo} material={mats.dust} frustumCulled={false} renderOrder={3} />
    </group>
  );
};
