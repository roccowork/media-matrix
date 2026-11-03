// 资产 tech.datastream.v1：数据高速公路（光纤束 + 高速数据包 + 横向闪电式数据交换 + 地面网格 + 漂浮 0/1 字符）。
// 全部是 GPU 计算：每条光纤的走向由「束中心线 spine(s) + 截面偏移」在着色器里按 (光纤序号, uSeed) 的确定性哈希算出，
// 光纤本体、数据包、闪电、字符粒子共用同一段 GLSL，所以数据包永远贴着光纤跑、闪电永远连在两条光纤上。
// 位置全部按 uTime 计算（确定性，CPU 每帧零开销）；种子由 remotion 的 random(seed) 转成 uSeed。
//
// 坐标约定（镜头写 keys 时用）：束从 position 出发沿 -z 延伸 length；中心线
//   spine(s) = position + [curve·L·0.10·sin(4.712·s), curve·L·0.035·(1 − cos(π·s)), −s·L]，s ∈ [0, 1]
// 束中间留空心通道（半径约 0.3·spread），镜头沿 spine 飞就在光纤束内部穿行。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import {useThree} from '@react-three/fiber';
import type {Vec3} from '../../../engine/shot';

export type DataStreamProps = {
  position?: Vec3;
  length?: number;
  fibers?: number;
  packets?: number;
  speed?: number;
  spread?: number;
  colorA?: string;
  colorB?: string;
  curve?: number;
  glyphs?: boolean;
  seed?: string | number;
};

/** CPU 端的中心线（与 GLSL 的 spine 一致），镜头路线可以用它算 */
export const dataStreamSpine = (s: number, position: Vec3 = [0, 0, 0], length = 200, curve = 0.6): Vec3 => [
  position[0] + curve * length * 0.1 * Math.sin(4.712 * s),
  position[1] + curve * length * 0.035 * (1 - Math.cos(Math.PI * s)),
  position[2] - s * length,
];

// 公共 GLSL：哈希、中心线、光纤路径、距离衰减、最小像素宽度
const COMMON = /* glsl */ `
uniform float uTime; uniform vec3 uPos; uniform float uLen; uniform float uSpread; uniform float uCurve; uniform float uSeedF;
uniform float uFibers; uniform float uPix; uniform vec3 uColA; uniform vec3 uColB;
float hsh(float n) { return fract(sin(n * 12.9898 + uSeedF * 78.233) * 43758.5453); }
vec3 spine(float s) {
  return uPos + vec3(uCurve * uLen * 0.10 * sin(4.712 * s), uCurve * uLen * 0.035 * (1.0 - cos(3.14159265 * s)), -s * uLen);
}
// 第 i 条光纤在 s 处的位置：属于 10 个子束之一（子束绕中心线扭转），子束内再散开；少量光纤游离在外圈
vec3 fiberP(float i, float s) {
  float g = mod(i, 10.0);
  float ga = g / 10.0 * 6.2832 + (hsh(g + 20.0) - 0.5) * 0.5;
  float gr = 0.55 + 0.4 * hsh(g + 30.0);
  float stray = step(0.9, hsh(i * 4.1 + 0.7));
  float tw = 1.0 + 0.6 * hsh(g + 41.0) + 0.4 * hsh(uSeedF);
  float a = ga + (hsh(i * 2.11 + 0.3) - 0.5) * 0.9 + s * tw + stray * hsh(i * 5.3) * 6.2832;
  float r = gr + (hsh(i * 3.7 + 0.5) - 0.5) * 0.35 + stray * (0.6 + 1.2 * hsh(i * 6.1));
  r = max(r, 0.32);
  float w = uSpread * mix(1.3, 0.8, s);
  vec2 o = vec2(cos(a), sin(a) * 0.72) * r * w;
  o += vec2(sin(s * 23.0 + i), cos(s * 17.0 + i * 1.3)) * 0.035 * w;
  return spine(s) + vec3(o, 0.0);
}
float distFade(float d) { return exp(-pow(d / (uLen * 0.42), 1.6)) * smoothstep(0.15, 1.2, d); }
// 屏幕上至少 ~1.3 像素宽，避免远处细线闪烁；被撑宽时按比例压暗，总能量不变
vec2 pixWiden(float w, float d) { float m = d * uPix * 1.3; float ww = max(w, m); return vec2(ww, w / ww); }
`;

// ── 光纤本体：面向镜头的细带 ──
const FIBER_VERT = /* glsl */ `
${COMMON}
attribute vec3 aF; // x 光纤序号, y 沿线 s, z 左右 ±1
varying float vV; varying float vS; varying vec3 vCol; varying float vA; varying float vI;
void main() {
  float i = aF.x; float s = aF.y;
  vec3 P = fiberP(i, s);
  vec3 T = normalize(fiberP(i, s + 0.002) - P);
  vec3 V = normalize(cameraPosition - P);
  vec3 side = cross(T, V); side /= max(length(side), 1e-4);
  float d = distance(cameraPosition, P);
  vec2 wd = pixWiden(0.018 * (0.6 + 0.8 * hsh(i * 9.1)), d);
  P += side * aF.z * wd.x;
  vV = aF.z; vS = s; vI = i;
  float g = mod(i, 10.0);
  vCol = mix(uColA, uColB, step(0.62, hsh(g + 50.0)) * 0.85 + 0.15 * hsh(i * 7.7));
  vA = distFade(d) * wd.y * smoothstep(0.0, 0.01, s) * (1.0 - smoothstep(0.96, 1.0, s));
  gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
}`;
const FIBER_FRAG = /* glsl */ `
uniform float uTime; uniform float uLen; uniform float uSpeed;
varying float vV; varying float vS; varying vec3 vCol; varying float vA; varying float vI;
void main() {
  float core = exp(-vV * vV * 5.0);
  // 沿光纤缓慢流动的明暗（底光），亮度保持低，让数据包当主角
  float flow = 0.55 + 0.45 * sin(vS * uLen * 0.6 + uTime * uSpeed * 0.25 + vI * 3.1);
  gl_FragColor = vec4(vCol * core * vA * (0.18 + 0.22 * flow), 1.0);
}`;

// ── 数据包：沿光纤高速流动的发光短条 / 方块，带拖尾 ──
const PACKET_VERT = /* glsl */ `
${COMMON}
uniform float uSpeed;
attribute vec4 aP; // x 光纤序号, y 初相位, z 速度倍数, w 类型随机数
attribute vec2 aQ; // x 沿拖尾 0(头)…1(尾), y 左右 ±1
varying vec2 vQ; varying vec3 vCol; varying float vA; varying float vBlock;
void main() {
  float i = aP.x;
  float block = step(0.78, aP.w);                 // 22% 是方块，其余是带拖尾的光条
  float dir = hsh(aP.y * 31.0 + i) < 0.72 ? -1.0 : 1.0;   // 多数迎着镜头（s 减小方向）跑，相对速度更快
  float spd = uSpeed * aP.z * (block > 0.5 ? 0.7 : 1.0);
  float sh = fract(aP.y + dir * uTime * spd / uLen);
  float trail = (block > 0.5 ? 0.35 : 1.2 + 3.5 * aP.z) * (uSpeed / 30.0);
  float s = sh - dir * aQ.x * trail / uLen;
  vec3 P = fiberP(i, s);
  vec3 T = normalize(fiberP(i, s + 0.002) - P);
  vec3 V = normalize(cameraPosition - P);
  vec3 side = cross(T, V); side /= max(length(side), 1e-4);
  float d = distance(cameraPosition, P);
  vec2 wd = pixWiden(block > 0.5 ? 0.07 : 0.03, d);
  P += side * aQ.y * wd.x;
  vQ = aQ; vBlock = block;
  vCol = block > 0.5 ? mix(uColB, vec3(1.0), 0.15) : mix(uColA, vec3(1.0), 0.08 * aP.z);
  if (hsh(i * 11.3 + aP.y) > 0.8) vCol = block > 0.5 ? uColA : uColB;
  vA = distFade(d) * wd.y * smoothstep(0.0, 0.015, sh) * (1.0 - smoothstep(0.97, 1.0, sh));
  gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
}`;
const PACKET_FRAG = /* glsl */ `
varying vec2 vQ; varying vec3 vCol; varying float vA; varying float vBlock;
void main() {
  float u = vQ.x;
  float edge = vBlock > 0.5 ? (1.0 - smoothstep(0.6, 1.0, abs(vQ.y))) : exp(-vQ.y * vQ.y * 4.0);
  float k = vBlock > 0.5 ? 2.6 * (1.0 - smoothstep(0.8, 1.0, u)) : (pow(1.0 - u, 2.4) * 2.2 + exp(-u * 40.0) * 3.0);
  vec3 c = mix(vCol, vec3(1.0), exp(-u * 25.0) * 0.5 * (1.0 - vBlock));
  gl_FragColor = vec4(c * k * edge * vA, 1.0);
}`;

// ── 闪电式数据交换：两条光纤之间的锯齿闪光，按事件周期随机出现 ──
const BOLT_VERT = /* glsl */ `
${COMMON}
attribute vec3 aB; // x 闪电序号, y 沿线 u 0…1, z 左右 ±1
varying float vV; varying float vA; varying vec3 vCol; varying float vU;
const float SEG = 22.0;
vec3 boltP(float i, float j, float s, float u, float k, vec3 n1, vec3 n2) {
  vec3 a = fiberP(i, s); vec3 b = fiberP(j, s + (hsh(k * 3.3) - 0.5) * 0.004);
  float x = u * SEG; float n0 = floor(x); float f = x - n0;
  float j0 = hsh(k * 7.1 + n0 * 1.7) - 0.5; float j1 = hsh(k * 7.1 + (n0 + 1.0) * 1.7) - 0.5;
  float j2 = hsh(k * 9.3 + n0 * 2.3) - 0.5; float j3 = hsh(k * 9.3 + (n0 + 1.0) * 2.3) - 0.5;
  float env = sin(3.14159 * u);
  float amp = min(distance(a, b) * 0.12, uSpread * 0.35);
  return mix(a, b, u) + (n1 * mix(j0, j1, f) + n2 * mix(j2, j3, f)) * amp * env;
}
void main() {
  float bi = aB.x; float u = aB.y;
  float period = 0.45 + 1.1 * hsh(bi * 1.9 + 0.2);
  float tt = uTime + hsh(bi * 2.7) * period;
  float k = floor(tt / period) + bi * 131.0;
  float local = fract(tt / period) * period;
  float flash = exp(-local * 6.0) * (0.75 + 0.25 * sin(local * 90.0));
  float i = floor(hsh(k * 1.13) * uFibers);
  float j = mod(i + 1.0 + floor(hsh(k * 1.71 + 0.4) * 2.0) + 10.0 * floor(hsh(k * 5.9) * 3.0), uFibers);   // 跳到相邻子束
  float s = 0.02 + 0.96 * hsh(k * 2.37);
  vec3 dirAB = fiberP(j, s) - fiberP(i, s);
  vec3 tA = normalize(dirAB + vec3(0.0, 0.0, 1e-4));
  vec3 n1 = normalize(cross(tA, vec3(0.0, 0.0, 1.0)));
  vec3 n2 = vec3(0.0, 0.0, 1.0);
  vec3 P = boltP(i, j, s, u, k, n1, n2);
  vec3 P2 = boltP(i, j, s, min(u + 0.01, 1.0), k, n1, n2);
  vec3 T = normalize(P2 - P + vec3(1e-5));
  vec3 V = normalize(cameraPosition - P);
  vec3 side = cross(T, V); side /= max(length(side), 1e-4);
  float d = distance(cameraPosition, P);
  vec2 wd = pixWiden(0.022, d);
  P += side * aB.z * wd.x * (1.0 + 2.0 * flash);
  vV = aB.z; vU = u;
  vCol = mix(mix(uColA, uColB, step(0.5, hsh(k * 4.9))), vec3(1.0), 0.2);
  vA = flash * distFade(d) * wd.y * step(0.5, abs(i - j));
  gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
}`;
const BOLT_FRAG = /* glsl */ `
varying float vV; varying float vA; varying vec3 vCol; varying float vU;
void main() {
  float core = exp(-vV * vV * 9.0) + 0.25 * exp(-vV * vV * 1.5);
  float ends = 1.0 + 2.0 * (exp(-vU * 30.0) + exp(-(1.0 - vU) * 30.0));
  gl_FragColor = vec4(vCol * core * vA * 3.2 * ends, 1.0);
}`;

// ── 漂浮的 0/1 字符和尘埃（点精灵，字符用 SDF 在片元里画，不依赖字体） ──
const GLYPH_VERT = /* glsl */ `
${COMMON}
uniform float uSpeed;
attribute vec4 aG; // x s0, y 角度, z 半径, w 随机
varying float vDigit; varying float vA; varying vec3 vCol; varying float vDust;
void main() {
  float s = fract(aG.x - uTime * uSpeed * 0.04 * (0.4 + aG.w) / uLen);
  float a = aG.y * 6.2832 + uTime * 0.05 * (aG.w - 0.5);
  float w = uSpread * mix(1.3, 0.8, s);
  vec3 P = spine(s) + vec3(cos(a) * aG.z * w, sin(a) * aG.z * w * 0.72 + sin(uTime * 0.6 + aG.w * 20.0) * 0.08, 0.0);
  vec4 mv = viewMatrix * vec4(P, 1.0);
  float d = -mv.z;
  vDust = step(0.55, aG.w);
  vDigit = step(0.5, fract(aG.w * 13.7 + floor(uTime * 2.0 + aG.w * 9.0) * 0.37));   // 字符隔一会儿翻转 0↔1
  vCol = mix(uColA, vec3(0.75, 1.0, 0.95), 0.35);
  float sz = vDust > 0.5 ? 0.03 : 0.16 * (0.6 + 0.8 * fract(aG.w * 7.3));
  float px = sz / max(d, 0.1) / uPix;
  vA = distFade(d) * (vDust > 0.5 ? 0.5 : 0.55) * min(1.0, px / 2.0);
  gl_PointSize = clamp(px, 1.5, 64.0);
  gl_Position = projectionMatrix * mv;
}`;
const GLYPH_FRAG = /* glsl */ `
varying float vDigit; varying float vA; varying vec3 vCol; varying float vDust;
void main() {
  vec2 p = gl_PointCoord - 0.5; p.y = -p.y;
  float m;
  if (vDust > 0.5) {
    m = (1.0 - smoothstep(0.0, 0.5, length(p)));
  } else if (vDigit > 0.5) {
    // 「1」：竖杠 + 左上小斜钩
    float bar = (1.0 - smoothstep(0.035, 0.075, abs(p.x))) * step(abs(p.y), 0.36);
    float hook = (1.0 - smoothstep(0.02, 0.06, abs((p.y - 0.36) - (p.x * 0.8)))) * step(-0.17, p.x) * step(p.x, 0.0);
    m = max(bar, hook);
  } else {
    // 「0」：竖椭圆环
    float r = length(vec2(p.x * 1.6, p.y));
    m = (1.0 - smoothstep(0.02, 0.06, abs(r - 0.33)));
  }
  gl_FragColor = vec4(vCol * m * vA * 1.4, 1.0);
}`;

// ── 地面网格（随距离淡出，镜头移动时形成视差） ──
const GRID_VERT = /* glsl */ `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const GRID_FRAG = /* glsl */ `
uniform vec3 uColA; uniform float uLen; uniform float uTime; uniform float uCell; varying vec3 vW;
void main() {
  vec2 g = vW.xz / uCell;
  vec2 fw = fwidth(g);
  vec2 l = 1.0 - smoothstep(vec2(0.0), max(fw * 1.5, vec2(1e-4)), abs(fract(g - 0.5) - 0.5));
  float line = max(l.x, l.y) * clamp(1.0 - max(fw.x, fw.y) * 1.2, 0.0, 1.0);
  float d = distance(cameraPosition, vW);
  float fade = exp(-pow(d / (uLen * 0.3), 1.4));
  // 网格上偶尔有一道沿 z 方向扫过的亮线
  float sc = fract(vW.z / (uCell * 24.0) + uTime * 0.25) - 0.5;
  float scan = exp(-sc * sc * 900.0);
  gl_FragColor = vec4(uColA * line * fade * (0.07 + 0.25 * scan), 1.0);
}`;

// ── 远处汇聚点的辉光（纵深的视觉锚点） ──
const GLOW_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const GLOW_FRAG = /* glsl */ `
uniform vec3 uColA; uniform vec3 uColB; varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float k = exp(-r * r * 6.0) * 0.5 + exp(-r * 18.0) * 0.6;
  gl_FragColor = vec4(mix(uColA, uColB, r * 0.6) * k, 1.0);
}`;

const additive = (vertexShader: string, fragmentShader: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({vertexShader, fragmentShader, uniforms, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide});

const strip = (count: number, segs: number, attr: string, fill: (k: number, u: number, side: number, out: Float32Array, j: number) => void, size: number) => {
  // count 条带，每条 segs 段（segs+1 个截面 × 左右 2 个顶点）
  const nv = count * (segs + 1) * 2;
  const a = new Float32Array(nv * size);
  const idx = new Uint32Array(count * segs * 6);
  let v = 0;
  let q = 0;
  for (let k = 0; k < count; k++) {
    const base = v;
    for (let s = 0; s <= segs; s++) {
      for (const side of [-1, 1]) {
        fill(k, s / segs, side, a, v * size);
        v++;
      }
    }
    for (let s = 0; s < segs; s++) {
      const p0 = base + s * 2;
      idx.set([p0, p0 + 1, p0 + 2, p0 + 1, p0 + 3, p0 + 2], q);
      q += 6;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute(attr, new THREE.BufferAttribute(a, size));
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
};

export const DataStreamAsset: React.FC<DataStreamProps> = ({
  position = [0, 0, 0],
  length = 200,
  fibers = 96,
  packets = 2400,
  speed = 30,
  spread = 3,
  colorA = '#22d8ff',
  colorB = '#ff3fc8',
  curve = 0.6,
  glyphs = true,
  seed = 'datastream',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {camera, size} = useThree();
  const t = frame / fps;
  const nF = Math.round(fibers);
  const nP = Math.round(packets);

  const res = useMemo(() => {
    const seedF = random(`${seed}-ds`) * 10;
    const uniforms: Record<string, THREE.IUniform> = {
      uTime: {value: 0},
      uPos: {value: new THREE.Vector3(...position)},
      uLen: {value: length},
      uSpread: {value: spread},
      uCurve: {value: curve},
      uSeedF: {value: seedF},
      uFibers: {value: nF},
      uPix: {value: 0.001},
      uSpeed: {value: speed},
      uColA: {value: new THREE.Color(colorA)},
      uColB: {value: new THREE.Color(colorB)},
      uCell: {value: 2},
    };
    // 光纤：每条 360 段（长度 200 时每段 ~0.55）
    const fiberGeo = strip(nF, 360, 'aF', (k, u, side, a, j) => { a[j] = k; a[j + 1] = u; a[j + 2] = side; }, 3);
    // 数据包：每个 8 段的小带，实例属性用普通属性展开（确定性、无需 InstancedBufferGeometry）
    const pkSegs = 8;
    const pkPerV = (pkSegs + 1) * 2;
    const pAttr = new Float32Array(nP * pkPerV * 4);
    for (let k = 0; k < nP; k++) {
      const fi = Math.floor(random(`${seed}pf${k}`) * nF);
      const ph = random(`${seed}pp${k}`);
      const sp = 0.6 + 0.9 * random(`${seed}ps${k}`);
      const ty = random(`${seed}pt${k}`);
      for (let v = 0; v < pkPerV; v++) pAttr.set([fi, ph, sp, ty], (k * pkPerV + v) * 4);
    }
    const packetGeo = strip(nP, pkSegs, 'aQ', (_k, u, side, a, j) => { a[j] = u; a[j + 1] = side; }, 2);
    packetGeo.setAttribute('aP', new THREE.BufferAttribute(pAttr, 4));
    // 闪电：数量随光纤数
    const nB = Math.max(4, Math.round(nF * 1.2));
    const boltGeo = strip(nB, 56, 'aB', (k, u, side, a, j) => { a[j] = k; a[j + 1] = u; a[j + 2] = side; }, 3);
    // 字符 + 尘埃
    const nG = glyphs ? Math.round(1800 + nF * 10) : 0;
    const gAttr = new Float32Array(Math.max(nG, 1) * 4);
    for (let k = 0; k < nG; k++) {
      gAttr.set([random(`${seed}gs${k}`), random(`${seed}ga${k}`), 0.25 + 2.4 * Math.pow(random(`${seed}gr${k}`), 0.7), random(`${seed}gw${k}`)], k * 4);
    }
    const glyphGeo = new THREE.BufferGeometry();
    glyphGeo.setAttribute('aG', new THREE.BufferAttribute(gAttr, 4));
    glyphGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(nG, 1) * 3), 3));
    glyphGeo.setDrawRange(0, nG);

    const end = dataStreamSpine(1, position, length, curve);
    const mid = dataStreamSpine(0.5, position, length, curve);
    return {
      uniforms,
      fiberGeo,
      packetGeo,
      boltGeo,
      glyphGeo,
      fiberMat: additive(FIBER_VERT, FIBER_FRAG, uniforms),
      packetMat: additive(PACKET_VERT, PACKET_FRAG, uniforms),
      boltMat: additive(BOLT_VERT, BOLT_FRAG, uniforms),
      glyphMat: additive(GLYPH_VERT, GLYPH_FRAG, uniforms),
      gridMat: additive(GRID_VERT, GRID_FRAG, uniforms),
      glowMat: additive(GLOW_VERT, GLOW_FRAG, uniforms),
      end,
      gridPos: [mid[0], position[1] - spread * 2.4, mid[2]] as Vec3,
    };
  }, [position, length, nF, nP, speed, spread, colorA, colorB, curve, glyphs, seed]);

  const cam = camera as THREE.PerspectiveCamera;
  res.uniforms.uTime.value = t;
  res.uniforms.uPix.value = (2 * Math.tan(((cam.fov ?? 45) * Math.PI) / 360)) / Math.max(1, size.height);

  return (
    <group>
      <mesh position={res.gridPos} rotation={[-Math.PI / 2, 0, 0]} material={res.gridMat} frustumCulled={false} renderOrder={-1}>
        <planeGeometry args={[length * 1.2, length * 1.3]} />
      </mesh>
      <mesh position={res.end} material={res.glowMat} frustumCulled={false} renderOrder={0}>
        <planeGeometry args={[spread * 6, spread * 6]} />
      </mesh>
      <mesh geometry={res.fiberGeo} material={res.fiberMat} frustumCulled={false} renderOrder={1} />
      <mesh geometry={res.packetGeo} material={res.packetMat} frustumCulled={false} renderOrder={2} />
      <mesh geometry={res.boltGeo} material={res.boltMat} frustumCulled={false} renderOrder={3} />
      {glyphs ? <points geometry={res.glyphGeo} material={res.glyphMat} frustumCulled={false} renderOrder={4} /> : null}
    </group>
  );
};
