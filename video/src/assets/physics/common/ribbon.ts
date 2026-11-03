// 物理类资产共用：
//   1. 发光带（ribbon）：把一串线段画成始终面向镜头的细长条，片元里按横向距离做「白芯 + 彩色光晕」；
//      闪电、电弧、磁场线都用它。每段 4 个顶点、2 个三角形，位置全在顶点着色器里展开。
//   2. 闪电折线生成：中点位移（每层把每段中点沿垂直方向随机推开）+ 随机分叉（分叉更细更暗，可再分叉）。
//      随机数全部来自 remotion 的 random(key)，同样的 key 永远得到同样的形状。
import * as THREE from 'three';
import {random} from 'remotion';

export type V3 = [number, number, number];
export type Seg = {a: V3; b: V3; w: number; br: number; t0: number; t1: number};

// ---------- 发光带几何 ----------
// aA / aB：段两端；aS：x = 0/1（哪一端），y = -1/1（哪一侧）；aW：x 宽度，y 亮度，z 该点沿整条线的参数 t，w 线编号
export const buildRibbonGeometry = (segs: Seg[], lineId: (i: number) => number = () => 0) => {
  const n = segs.length;
  const A = new Float32Array(n * 4 * 3);
  const B = new Float32Array(n * 4 * 3);
  const Sx = new Float32Array(n * 4 * 2);
  const W = new Float32Array(n * 4 * 4);
  const idx = new Uint32Array(n * 6);
  segs.forEach((s, i) => {
    for (let k = 0; k < 4; k++) {
      const v = i * 4 + k;
      A.set(s.a, v * 3);
      B.set(s.b, v * 3);
      const end = k >> 1;
      Sx[v * 2] = end;
      Sx[v * 2 + 1] = k & 1 ? 1 : -1;
      W[v * 4] = s.w;
      W[v * 4 + 1] = s.br;
      W[v * 4 + 2] = end ? s.t1 : s.t0;
      W[v * 4 + 3] = lineId(i);
    }
    idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 4 * 3), 3));
  g.setAttribute('aA', new THREE.BufferAttribute(A, 3));
  g.setAttribute('aB', new THREE.BufferAttribute(B, 3));
  g.setAttribute('aS', new THREE.BufferAttribute(Sx, 2));
  g.setAttribute('aW', new THREE.BufferAttribute(W, 4));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
};

// 顶点着色器：在视空间里沿「段方向 × 视线」的方向展开宽度；宽度有最小像素保护（远处不断线、按面积压暗）
export const RIBBON_VERT = /* glsl */ `
attribute vec3 aA; attribute vec3 aB; attribute vec2 aS; attribute vec4 aW;
uniform float uWidth; uniform float uViewH; uniform float uCap; // uCap：两端伸出几倍宽度（折线用 0.5 盖住折角缝；平滑曲线用 0，否则接头处叠加成亮珠）
varying float vSide; varying float vBr; varying float vT; varying float vLine; varying float vPxA;
void main() {
  vec3 Av = (modelViewMatrix * vec4(aA, 1.0)).xyz;
  vec3 Bv = (modelViewMatrix * vec4(aB, 1.0)).xyz;
  vec3 P = mix(Av, Bv, aS.x);
  vec3 dir = Bv - Av;
  float L = length(dir);
  dir = L > 1e-6 ? dir / L : vec3(1.0, 0.0, 0.0);
  vec3 perp = normalize(cross(dir, normalize(P)));
  float w = aW.x * uWidth;
  // 最小 1.2 像素宽
  float pxPerUnit = projectionMatrix[1][1] * 0.5 * uViewH / max(-P.z, 1e-3);
  float wpx = w * pxPerUnit;
  float minPx = 1.2;
  vPxA = wpx < minPx ? wpx / minPx : 1.0;
  w = max(w, minPx / pxPerUnit);
  P += perp * aS.y * w;
  P += dir * (aS.x * 2.0 - 1.0) * w * uCap;
  vSide = aS.y; vBr = aW.y; vT = aW.z; vLine = aW.w;
  gl_Position = projectionMatrix * vec4(P, 1.0);
}`;

// 片元：横向距离 → 白芯 + 光晕。核心颜色往白偏，光晕用主色。需要额外调制（流动、生长）的资产自己写片元，复用 ribbonGlow
export const RIBBON_GLOW_GLSL = /* glsl */ `
vec3 ribbonGlow(float side, vec3 col, float coreW) {
  float d = abs(side);
  float core = exp(-d * d / (coreW * coreW));
  float halo = exp(-d * 3.2) * (1.0 - smoothstep(0.85, 1.0, d));
  return mix(col, vec3(1.0), 0.75) * core * 1.6 + col * halo * 0.8;
}
`;

// ---------- 闪电折线 ----------
type BoltOpts = {
  levels?: number; // 中点位移层数（段数 = 2^levels）
  jag?: number; // 折曲幅度（相对段长）
  branch?: number; // 每个点长出分叉的概率
  branchDepth?: number; // 分叉可以再分叉几层
  width?: number;
  bright?: number;
};

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => mul(a, 1 / Math.max(len(a), 1e-9));
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export const makeBolt = (from: V3, to: V3, key: string, o: BoltOpts = {}): Seg[] => {
  const levels = o.levels ?? 6;
  const jag = o.jag ?? 0.22;
  const branchP = o.branch ?? 0.12;
  const depthMax = o.branchDepth ?? 2;
  let c = 0;
  const r = () => random(`${key}:${c++}`);
  const out: Seg[] = [];
  const one = (a: V3, b: V3, w: number, br: number, depth: number) => {
    let pts: V3[] = [a, b];
    const D = norm(sub(b, a));
    const ref: V3 = Math.abs(D[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const U = norm(cross(D, ref));
    const Vv = cross(D, U);
    let amp = len(sub(b, a)) * jag;
    for (let l = 0; l < levels; l++) {
      const np: V3[] = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const m = mul(add(pts[i], pts[i + 1]), 0.5);
        const ang = r() * Math.PI * 2;
        const k = (r() - 0.5) * 2 * amp;
        np.push(add(m, add(mul(U, Math.cos(ang) * k), mul(Vv, Math.sin(ang) * k))), pts[i + 1]);
      }
      pts = np;
      amp *= 0.52;
    }
    const n = pts.length - 1;
    for (let i = 0; i < n; i++) {
      // 越往末端越细一点
      const taper = 1 - 0.35 * (i / n);
      out.push({a: pts[i], b: pts[i + 1], w: w * taper, br, t0: i / n, t1: (i + 1) / n});
    }
    if (depth < depthMax) {
      for (let i = 2; i < n - 2; i++) {
        if (r() > branchP) continue;
        const total = len(sub(b, a));
        const bl = total * (0.18 + 0.35 * r()) * (1 - i / n * 0.5);
        const fwd = norm(sub(pts[i + 1], pts[i]));
        const side = norm(add(mul(U, r() - 0.5), mul(Vv, r() - 0.5)));
        const bd = norm(add(fwd, mul(side, 1.3)));
        one(pts[i], add(pts[i], mul(bd, bl)), w * 0.55, br * 0.55, depth + 1);
      }
    }
  };
  one(from, to, o.width ?? 1, o.bright ?? 1, 0);
  return out;
};
