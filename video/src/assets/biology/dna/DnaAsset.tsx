// 资产 biology.dna.v1：程序化 DNA 双螺旋（电影级科学可视化风格：深色背景、半透明发光骨架、彩色碱基对横档）。
// 螺旋轴沿 x，第 i 个碱基对在 x = (i - (N-1)/2) * rise；两条链相位差约 140°（形成大沟 / 小沟）。
// 所有几何的位置都在顶点着色器里由同一个 strandPos(i, s) 算出（骨架管、磷酸 / 糖原子、碱基、粒子），
// 所以自旋、解旋、复制只改几个 uniform，CPU 每帧零开销、结果确定。
//   骨架：沿链参数化的平滑管（着色器里求切线 / 法线），半透明 + 菲涅尔边缘光 + 内部透光；
//   原子：InstancedMesh 小球（每个碱基对两侧各一个磷酸 + 一个糖）；
//   碱基：InstancedMesh 细长圆角棒（胶囊体压扁；每对两半，各自一种颜色，A-T / G-C 配对），菲涅尔边缘光 + 轻微自发光；
//   解旋：从 unzipAt 秒起，从左端（i = 0）开始双链分开，分叉点（解旋酶位置）有一团亮光；
//   复制：从 replicateAt 秒起，游离的新核苷酸（碱基 + 糖 + 磷酸）从周围飘过来，按 A-T / G-C 对接到分开的单链上，
//         对接时一闪，随后新骨架连起来，两条单链各自长回完整的双螺旋（复制前沿落后分叉点约 5 个碱基对）；
//   氛围：深蓝 / 青色多层体积雾（噪声云片，有视差）+ 远处虚化光斑（bokeh）+ 按距离的雾（远端渐隐），haze 控制浓度；
//   粒子：沿两条链流动的发光粒子（flow）+ 周围漂浮的微尘（dust，增加纵深，配合 post.dof 虚化）。
// 随机：碱基序列、粒子分布、新核苷酸的出发位置 / 先后全部用 remotion 的 random(seed)。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import {NOISE_GLSL} from '../../../engine/shaders/noise.glsl';
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
  replicateAt?: number; // 秒；-1 不复制（需要同时解旋）
  replicateSpeed?: number; // 每秒对接的碱基对数（不会超过解旋前沿）
  flow?: boolean; // 沿链流动的发光粒子
  dust?: number; // 周围微尘密度倍数
  haze?: number; // 体积雾 / 远景光斑 / 距离雾浓度，0 关闭
  hazeColor?: string; // 雾的主色（深蓝），青色由它推出
  seed?: string | number;
};

// 共用：螺旋位置函数（所有螺旋着色器都包含这一段）
const HELIX_GLSL = /* glsl */ `
uniform float uN; uniform float uRise; uniform float uR; uniform float uTwist; uniform float uSpin; uniform float uPhase;
uniform float uFork; uniform float uOpen; uniform float uTime; uniform float uRepFront; uniform float uSeedH;
float sepAt(float i) { return smoothstep(0.0, 4.0, uFork - i); }               // 0 = 配对，1 = 已分开
float openAt(float i) { return uOpen * smoothstep(0.0, 16.0, uFork - i); }    // 分开的距离（越远离分叉点越开）
float repS(float i) { return smoothstep(0.0, 1.0, (uRepFront - i - 1.25) / 3.0); }   // 该处平均复制进度（链半径恢复用）
float jit(float i, float s) { return fract(sin((i * 2.0 + s) * 12.9898 + uSeedH * 78.233) * 43758.5453); }
float nucQ(float i, float s) { return (uRepFront - i - jit(i, s) * 2.5) / 3.0; }    // 新核苷酸：<0 游离，0→1 飞来，≥1 对接
vec3 axisAt(float i, float s) {
  float side = s * 2.0 - 1.0;
  float o = openAt(i);
  return vec3((i - (uN - 1.0) * 0.5) * uRise, side * o, -0.35 * o);
}
float radAt(float i) { return uR * (1.0 - 0.4 * sepAt(i) * (1.0 - repS(i))); }
vec3 strandPos(float i, float s) {
  float ang = i * uTwist + uSpin + s * uPhase;
  float r = radAt(i);
  return axisAt(i, s) + vec3(0.0, cos(ang) * r, sin(ang) * r);
}
// 子代双螺旋 s 的新链：绕同一条（分开后的）轴，相位与母链互补
vec3 newPos(float i, float s) {
  float ang = i * uTwist + uSpin + (1.0 - s) * uPhase;
  float r = radAt(i);
  return axisAt(i, s) + vec3(0.0, cos(ang) * r, sin(ang) * r);
}
vec3 rotA(vec3 v, vec3 a, float t) { float c = cos(t), s = sin(t); return v * c + cross(a, v) * s + a * dot(a, v) * (1.0 - c); }
// 新核苷酸整体（碱基 + 糖 + 磷酸）作为刚体：绕中心 c 翻滚着从出发点 c + f.xyz * uR 飞到对接位置
vec3 fly(vec3 pf, vec3 c, float i, float s, vec4 f) {
  float q = nucQ(i, s);
  float vis = smoothstep(-2.0, -1.2, q);
  float e = smoothstep(0.0, 1.0, q);
  float k = 1.0 - e;
  vec3 ax = normalize(vec3(sin(f.w * 31.0), cos(f.w * 17.0), sin(f.w * 53.0) + 0.2));
  float ang = k * (2.5 + 3.0 * f.w + uTime * 0.5);
  vec3 wander = vec3(sin(uTime * 0.8 + f.w * 40.0), sin(uTime * 0.6 + f.w * 70.0), cos(uTime * 0.7 + f.w * 90.0)) * 0.22 * uR;
  return c + (f.xyz * uR + wander) * k * k + rotA(pf - c, ax, ang) * vis;
}
`;

// 共用：半透明「次表面」质感着色（视空间）+ 距离雾
const SHADE_GLSL = /* glsl */ `
uniform float uGlow; uniform vec3 uRim; uniform vec3 uFogCol; uniform float uFogD;
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
float fogK(float d) { return exp(-max(d - 4.0, 0.0) * uFogD); }
vec3 fogit(vec3 col, float d) { return mix(uFogCol, col, fogK(d)); }
`;

const BACKBONE_VERT = /* glsl */ `
attribute vec4 aT; // x = 沿链的碱基对序号（连续），y = 绕管角度，z = 链 0 / 1，w = 1 新链
uniform float uTubeR;
varying vec3 vN; varying vec3 vV; varying float vI; varying float vNew;
${HELIX_GLSL}
vec3 P(float i, float s, float nw) { return nw > 0.5 ? newPos(i, s) : strandPos(i, s); }
void main() {
  float i = aT.x; float s = aT.z; float nw = aT.w;
  vec3 C = P(i, s, nw);
  vec3 T = normalize(P(i + 0.03, s, nw) - P(i - 0.03, s, nw));
  vec3 ref = C - axisAt(i, s);
  vec3 N0 = normalize(ref - T * dot(ref, T));
  vec3 B = cross(T, N0);
  float cap = sqrt(clamp(min(i + 0.45, uN - 0.55 - i) / 0.3, 0.0, 1.0));      // 两端收口
  if (nw > 0.5) cap *= smoothstep(0.0, 1.0, (uRepFront - i - 4.0) / 2.0);     // 新骨架：核苷酸对接后才连起来
  vec3 nrm = cos(aT.y) * N0 + sin(aT.y) * B;
  vec3 p = C + nrm * uTubeR * cap;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vV = -mv.xyz; vN = normalize(normalMatrix * nrm); vI = i; vNew = nw;
  gl_Position = projectionMatrix * mv;
}`;
const BACKBONE_FRAG = /* glsl */ `
uniform vec3 uCol;
varying vec3 vN; varying vec3 vV; varying float vI; varying float vNew;
${SHADE_GLSL}
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(vV);
  float fres;
  float pulse = 0.5 + 0.5 * sin(vI * 0.9 - uTime * 2.2);
  vec3 base = mix(uCol, mix(uCol, vec3(0.55, 1.0, 0.95), 0.35), vNew) * 0.85;   // 新链略偏青
  vec3 col = shade(base, uRim, n, v, 0.3 + 0.35 * pulse * pulse, fres);
  gl_FragColor = vec4(fogit(col, length(vV)), 0.4 + 0.6 * fres);
}`;

// 原子（磷酸 / 糖）和碱基都是 InstancedMesh，位置在着色器里按 aIdx 算
const ATOM_VERT = /* glsl */ `
attribute vec4 aIdx; // i, s, kind（0 磷酸：两个碱基对之间；1 糖：碱基接在骨架上的地方），新链
attribute vec4 aFly; // 新核苷酸出发偏移（单位：半径）+ 随机数
uniform float uAtomR;
varying vec3 vN; varying vec3 vV; varying float vKind; varying float vNew;
${HELIX_GLSL}
void main() {
  float i = aIdx.x; float s = aIdx.y; float kind = aIdx.z; float nw = aIdx.w;
  vec3 c;
  float r;
  vec3 Pi = nw > 0.5 ? newPos(i, s) : strandPos(i, s);
  if (kind < 0.5) { c = nw > 0.5 ? newPos(i + 0.5, s) : strandPos(i + 0.5, s); r = uAtomR; }
  else {
    vec3 inward = normalize(axisAt(i, s) - Pi);
    c = Pi + inward * uAtomR * 0.9; r = uAtomR * 0.72;
  }
  vec3 p = c + position * r;
  vec3 nrm = normal;
  if (nw > 0.5) {
    p = fly(p, Pi, i, s, aFly);
    vec3 ax = normalize(vec3(sin(aFly.w * 31.0), cos(aFly.w * 17.0), sin(aFly.w * 53.0) + 0.2));
    nrm = rotA(normal, ax, (1.0 - smoothstep(0.0, 1.0, nucQ(i, s))) * (2.5 + 3.0 * aFly.w + uTime * 0.5));
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vV = -mv.xyz; vN = normalize(normalMatrix * nrm); vKind = kind; vNew = nw;
  gl_Position = projectionMatrix * mv;
}`;
const ATOM_FRAG = /* glsl */ `
uniform vec3 uCol;
varying vec3 vN; varying vec3 vV; varying float vKind; varying float vNew;
${SHADE_GLSL}
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(vV);
  float fres;
  vec3 c = mix(uCol, mix(uCol, vec3(0.55, 1.0, 0.95), 0.35), vNew);
  vec3 base = vKind < 0.5 ? c * 0.75 : mix(c, vec3(0.7, 0.9, 1.0), 0.3) * 0.6;
  vec3 col = shade(base, uRim, n, v, vKind < 0.5 ? 0.12 : 0.06, fres);
  gl_FragColor = vec4(fogit(col, length(vV)), 1.0);
}`;

// 碱基：胶囊体（半径 1、柱长 BASE_L）压扁成细长圆角棒；沿 d 方向从骨架伸向配对的碱基
const BASE_L = 5;
const BASE_VERT = /* glsl */ `
attribute vec4 aIdx; // i, s, 碱基种类 0 A / 1 T / 2 G / 3 C，新链
attribute vec4 aFly;
uniform float uBaseW; uniform float uBaseTh; uniform vec3 uBaseCol[4];
varying vec3 vN; varying vec3 vV; varying vec3 vCol; varying float vY; varying float vSep; varying float vFree;
${HELIX_GLSL}
void main() {
  float i = aIdx.x; float s = aIdx.y; float nw = aIdx.w;
  vec3 P; vec3 d; float sep;
  if (nw < 0.5) {
    P = strandPos(i, s);
    sep = sepAt(i);
    float rp = smoothstep(0.0, 1.0, nucQ(i, s));                                       // 新碱基到位后，母链碱基重新伸直配对
    vec3 dPair = 0.5 * mix(strandPos(i, 1.0 - s) - P, newPos(i, s) - P, sep);
    vec3 dSep = normalize(axisAt(i, s) - P) * length(dPair) * 0.85;
    d = mix(dPair, dSep, sep * (1.0 - rp));
    sep *= 1.0 - rp;
    vFree = 0.0;
  } else {
    P = newPos(i, s);
    d = 0.5 * (strandPos(i, s) - P);
    sep = 0.0;
    vFree = 1.0 - smoothstep(0.6, 1.0, nucQ(i, s));
  }
  float len = max(length(d), 1e-4);
  vec3 Y = d / len;
  vec3 X = vec3(1.0, 0.0, 0.0); X = normalize(X - Y * dot(X, Y));           // 碱基是平板：法线大致沿螺旋轴
  vec3 Z = cross(X, Y);
  float segLen = len * 0.78;
  float sy = segLen / ${(BASE_L + 2).toFixed(1)};
  float y = position.y / ${(BASE_L + 2).toFixed(1)} + 0.5;                    // 0 = 骨架端，1 = 氢键端
  vec3 p = P + d * 0.17 + Y * (y * segLen) + X * position.x * uBaseTh + Z * position.z * uBaseW;
  vec3 nl = normal.x / uBaseTh * X + normal.y / sy * Y + normal.z / uBaseW * Z;
  if (nw > 0.5) {
    vec3 ax = normalize(vec3(sin(aFly.w * 31.0), cos(aFly.w * 17.0), sin(aFly.w * 53.0) + 0.2));
    p = fly(p, P, i, s, aFly);
    nl = rotA(nl, ax, (1.0 - smoothstep(0.0, 1.0, nucQ(i, s))) * (2.5 + 3.0 * aFly.w + uTime * 0.5));
  }
  int k = int(aIdx.z + 0.5);
  vCol = k == 0 ? uBaseCol[0] : k == 1 ? uBaseCol[1] : k == 2 ? uBaseCol[2] : uBaseCol[3];
  vY = y; vSep = sep;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vV = -mv.xyz; vN = normalize(normalMatrix * nl);
  gl_Position = projectionMatrix * mv;
}`;
const BASE_FRAG = /* glsl */ `
varying vec3 vN; varying vec3 vV; varying vec3 vCol; varying float vY; varying float vSep; varying float vFree;
${SHADE_GLSL}
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(vV);
  float fres;
  float tip = smoothstep(0.6, 1.0, vY) * (1.0 - vSep * 0.6);                // 靠近氢键的一端更亮
  vec3 rim = mix(vCol, vec3(1.0), 0.45);
  vec3 col = shade(vCol * 0.7, rim, n, v, 0.22 + 0.7 * tip + 0.35 * vFree, fres);
  col += rim * pow(fres, 1.6) * 0.9 * uGlow;                               // 额外的细边缘光：近看也有轮廓
  float band = 0.5 + 0.5 * cos(vY * 31.4);                                  // 细微的环纹（分子表面感）
  col *= 0.88 + 0.12 * band;
  gl_FragColor = vec4(fogit(col, length(vV)), 1.0);
}`;

// 发光点：kind 0 沿链流动的粒子；1 氢键缝里的亮点；2 分叉点的亮光；3 新碱基对接的闪光 + 新氢键
const GLOW_VERT = /* glsl */ `
attribute vec4 aG; // kind, a, b, c
uniform float uHalfH; uniform float uFlowSpeed; uniform vec3 uFlowCol; uniform vec3 uForkCol; uniform float uGlowAmt; uniform float uFogD;
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
    size = uR * 0.11;
    col = vec3(0.75, 0.9, 1.0);
    a = 0.5 * (1.0 - sepAt(i)) * (0.75 + 0.25 * sin(uTime * 2.0 + i));
  } else if (kind < 2.5) {
    float i = clamp(uFork - 0.5, 0.0, uN - 1.0);
    p = 0.5 * (strandPos(i, 0.0) + strandPos(i, 1.0)) + (vec3(h1(aG.y), h1(aG.y + 1.7), h1(aG.y + 3.3)) - 0.5) * uR * 0.5;
    size = uR * (aG.y < 0.5 ? 1.0 : 0.2 + 0.3 * h1(aG.y + 7.0));
    col = uForkCol;
    a = (aG.y < 0.5 ? 0.22 : 0.7) * smoothstep(0.0, 1.5, uFork) * smoothstep(uN + 2.0, uN - 1.0, uFork) * (0.8 + 0.2 * sin(uTime * 6.0 + aG.y * 9.0));
  } else {
    float i = aG.y; float s = aG.z;
    float q = nucQ(i, s);
    p = 0.5 * (newPos(i, s) + strandPos(i, s));
    float flash = exp(-pow((q - 1.0) * 4.0, 2.0));
    size = uR * (0.11 + 0.35 * flash);
    col = mix(vec3(0.6, 1.0, 0.95), vec3(1.0), flash * 0.5);
    a = 0.45 * smoothstep(0.9, 1.1, q) * (0.75 + 0.25 * sin(uTime * 2.0 + i)) + 1.3 * flash * step(0.0, q);
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vC = col; vA = a * uGlowAmt * exp(-max(-mv.z - 4.0, 0.0) * uFogD);
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
uniform float uTime; uniform float uHalfH; uniform vec3 uA; uniform vec3 uB; uniform float uFogD;
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
  vA *= exp(-max(-mv.z - 4.0, 0.0) * uFogD * 0.6);
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

// 体积雾：几层大的噪声云片（世界空间，有视差），加色混合，边缘柔和淡出
const HAZE_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vW;
void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const HAZE_FRAG = /* glsl */ `
uniform vec3 uH1; uniform vec3 uH2; uniform float uAmt; uniform float uTime; uniform float uLayer;
varying vec2 vUv; varying vec3 vW;
${NOISE_GLSL}
float fbm3(vec3 p) { return snoise(p) * 0.55 + snoise(p * 2.1 + 3.1) * 0.3 + snoise(p * 4.3 + 7.7) * 0.15; }
void main() {
  vec2 c = vUv - 0.5;
  float edge = smoothstep(0.5, 0.18, length(c * vec2(1.0, 1.25)));
  vec3 q = vec3(vW.xy * 0.07, uLayer * 3.7 + uTime * 0.025);
  q.xy += vec2(uTime * 0.012 * (1.0 + uLayer), 0.0);
  float n = fbm3(q);
  float m = smoothstep(-0.35, 0.75, n);
  float t = smoothstep(-0.3, 0.6, fbm3(q * 0.6 + 11.0));
  vec3 col = mix(uH1, uH2, t);
  gl_FragColor = vec4(col * m * m * edge * uAmt, 1.0);
}`;

// 远景光斑（bokeh）：大的柔边圆盘，边缘略亮；depthWrite 关闭 → 在景深里按「无穷远」虚化
const BOKEH_VERT = /* glsl */ `
attribute vec4 aB; // xyz 位置，w 随机数
uniform float uTime; uniform float uHalfH; uniform vec3 uH2; uniform vec3 uWarm; uniform float uAmt;
varying vec3 vC; varying float vA;
float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
void main() {
  float w = aB.w;
  vec3 p = aB.xyz + vec3(sin(uTime * 0.09 + w * 20.0), sin(uTime * 0.07 + w * 40.0), 0.0) * 0.4;
  vC = mix(mix(uH2, vec3(0.5, 0.8, 1.0), h1(w * 3.0) * 0.6), uWarm, step(0.88, h1(w * 9.0)));
  vA = uAmt * (0.25 + 0.75 * h1(w * 5.0)) * (0.8 + 0.2 * sin(uTime * 0.9 + w * 60.0));
  float size = 0.25 + 0.9 * pow(h1(w * 13.0), 2.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = max(1.0, size * projectionMatrix[1][1] * uHalfH / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const BOKEH_FRAG = /* glsl */ `
varying vec3 vC; varying float vA;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float disc = 1.0 - smoothstep(0.82, 1.0, r);
  float ring = 0.55 + 0.45 * smoothstep(0.45, 0.92, r);
  gl_FragColor = vec4(vC * vA * disc * ring, 1.0);
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
  replicateAt = -1,
  replicateSpeed = 3,
  flow = true,
  dust = 1,
  haze = 1,
  hazeColor = '#0d3f6e',
  seed = 'dna',
}) => {
  const frame = useCurrentFrame();
  const {fps, height} = useVideoConfig();
  const t = frame / fps;
  const N = Math.max(2, Math.round(length));
  const S = String(seed);
  const replicate = replicateAt >= 0 && unzipAt >= 0;

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
      uRepFront: {value: -100},
      uSeedH: {value: random(`${S}-rep`)},
      uTime: {value: 0},
      uGlow: {value: 1},
      uRim: {value: new THREE.Color()},
      uFogCol: {value: new THREE.Color()},
      uFogD: {value: 0},
      uHalfH: {value: height / 2},
    }),
    [N, S, height],
  );

  const built = useMemo(() => {
    const NS = replicate ? 2 : 1; // 复制时每条链多一条新链
    // ── 骨架管：每条链一段参数网格（沿链 × 绕管） ──
    const along = N * 10 + 10;
    const around = 16;
    const verts = 2 * NS * (along + 1) * (around + 1);
    const aT = new Float32Array(verts * 4);
    const idx: number[] = [];
    let v = 0;
    for (let nw = 0; nw < NS; nw++)
      for (let s = 0; s < 2; s++) {
        const base = v;
        for (let a = 0; a <= along; a++) {
          const i = -0.45 + (a / along) * (N - 0.1);
          for (let r = 0; r <= around; r++) {
            aT[v * 4] = i;
            aT[v * 4 + 1] = (r / around) * Math.PI * 2;
            aT[v * 4 + 2] = s;
            aT[v * 4 + 3] = nw;
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
    tube.setAttribute('aT', new THREE.BufferAttribute(aT, 4));
    tube.setIndex(idx);

    // ── 碱基序列（种子决定） ──
    const seq: [number, number][] = [];
    for (let i = 0; i < N; i++) seq.push(PAIRS[Math.min(3, Math.floor(random(`${S}-bp${i}`) * 4))]);

    // 新核苷酸 (i, s) 的出发偏移：随机方向，偏向外侧（远离另一条子链）和前方
    const flyOf = (i: number, s: number): number[] => {
      const side = s * 2 - 1;
      const dx = random(`${S}-nx${i}-${s}`) - 0.5 + 0.35;
      const dy = random(`${S}-ny${i}-${s}`) - 0.5 + side * 0.75;
      const dz = random(`${S}-nz${i}-${s}`) - 0.5 + 0.45;
      const l = Math.hypot(dx, dy, dz) || 1;
      const dist = 1.8 + 2.4 * random(`${S}-nd${i}-${s}`);
      return [(dx / l) * dist, (dy / l) * dist, (dz / l) * dist, random(`${S}-nw${i}-${s}`)];
    };

    // ── 碱基：InstancedMesh，每对两半（+ 复制时每条单链上新配对的碱基） ──
    const baseGeo = new THREE.CapsuleGeometry(1, BASE_L, 5, 16);
    const bIdx: number[] = [];
    const bFly: number[] = [];
    for (let nw = 0; nw < NS; nw++)
      for (let i = 0; i < N; i++)
        for (let s = 0; s < 2; s++) {
          bIdx.push(i, s, nw ? seq[i][1 - s] : seq[i][s], nw); // 新碱基与母链碱基互补：A-T、G-C
          bFly.push(...(nw ? flyOf(i, s) : [0, 0, 0, 0]));
        }
    baseGeo.setAttribute('aIdx', new THREE.InstancedBufferAttribute(new Float32Array(bIdx), 4));
    baseGeo.setAttribute('aFly', new THREE.InstancedBufferAttribute(new Float32Array(bFly), 4));

    // ── 原子（磷酸 + 糖）：InstancedMesh ──
    const atomGeo = new THREE.IcosahedronGeometry(1, 3);
    const aIdx: number[] = [];
    const aFly: number[] = [];
    for (let nw = 0; nw < NS; nw++)
      for (let i = 0; i < N; i++)
        for (let s = 0; s < 2; s++) {
          const f = nw ? flyOf(i, s) : [0, 0, 0, 0];
          if (i < N - 1) {
            aIdx.push(i, s, 0, nw);
            aFly.push(...f);
          }
          aIdx.push(i, s, 1, nw);
          aFly.push(...f);
        }
    atomGeo.setAttribute('aIdx', new THREE.InstancedBufferAttribute(new Float32Array(aIdx), 4));
    atomGeo.setAttribute('aFly', new THREE.InstancedBufferAttribute(new Float32Array(aFly), 4));
    const atomCount = aIdx.length / 4;

    // ── 发光点：流动粒子 + 氢键亮点 + 分叉亮光 + 对接闪光 ──
    const g: number[] = [];
    if (flow) {
      const per = N * 9;
      for (let s = 0; s < 2; s++) for (let k = 0; k < per; k++) g.push(0, random(`${S}-fl${s}-${k}`), s, random(`${S}-fw${s}-${k}`) * 100);
    }
    for (let i = 0; i < N; i++) g.push(1, i, 0, 0);
    for (let k = 0; k < 24; k++) g.push(2, k === 0 ? 0 : 1 + random(`${S}-fk${k}`) * 10, 0, 0);
    if (replicate) for (let i = 0; i < N; i++) for (let s = 0; s < 2; s++) g.push(3, i, s, 0);
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

    // ── 远景光斑 ──
    const nb = Math.round(90 * Math.min(haze, 2));
    const bk = new Float32Array(Math.max(1, nb) * 4);
    for (let k = 0; k < nb; k++) {
      bk[k * 4] = (random(`${S}-bx${k}`) - 0.5) * 2 * (half + 10);
      bk[k * 4 + 1] = (random(`${S}-by${k}`) - 0.5) * 16;
      bk[k * 4 + 2] = -7 - 24 * random(`${S}-bz${k}`);
      bk[k * 4 + 3] = random(`${S}-bw${k}`);
    }
    const bokehGeo = new THREE.BufferGeometry();
    bokehGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(1, nb) * 3), 3));
    bokehGeo.setAttribute('aB', new THREE.BufferAttribute(bk, 4));
    bokehGeo.setDrawRange(0, nb);

    const mat = (vs: string, fs: string, extra: Record<string, THREE.IUniform>, opts: Partial<THREE.ShaderMaterialParameters> = {}) =>
      new THREE.ShaderMaterial({vertexShader: vs, fragmentShader: fs, uniforms: {...U, ...extra}, ...opts});
    const hz = {uH1: {value: new THREE.Color()}, uH2: {value: new THREE.Color()}, uAmt: {value: 0}, uWarm: {value: new THREE.Color('#ffb36b')}};
    const additive = {transparent: true, depthWrite: false, blending: THREE.AdditiveBlending};
    const mats = {
      tube: mat(BACKBONE_VERT, BACKBONE_FRAG, {uCol: {value: new THREE.Color()}, uTubeR: {value: 0.1}}, {transparent: true, depthWrite: true, side: THREE.FrontSide}),
      atom: mat(ATOM_VERT, ATOM_FRAG, {uCol: {value: new THREE.Color()}, uAtomR: {value: 0.17}}),
      base: mat(BASE_VERT, BASE_FRAG, {uBaseW: {value: 0.16}, uBaseTh: {value: 0.055}, uBaseCol: {value: [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()]}}),
      glow: mat(GLOW_VERT, GLOW_FRAG, {uFlowSpeed: {value: 2.5}, uFlowCol: {value: new THREE.Color()}, uForkCol: {value: new THREE.Color('#7fd0ff')}, uGlowAmt: {value: 1}}, additive),
      dust: mat(DUST_VERT, DUST_FRAG, {uA: {value: new THREE.Color('#5aa8ff')}, uB: {value: new THREE.Color('#ffb36b')}}, additive),
      bokeh: mat(BOKEH_VERT, BOKEH_FRAG, hz, additive),
    };
    // 雾层：z（相对螺旋中心）、横向偏移、尺寸都由种子决定一点点变化
    const layers = haze > 0
      ? [-3.5, -7, -11.5, -17, -24, -33].map((z, k) => {
          const w = 34 + 3.2 * -z;
          const m = mat(HAZE_VERT, HAZE_FRAG, {...hz, uLayer: {value: k}}, {...additive, side: THREE.DoubleSide});
          const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
          mesh.position.set((random(`${S}-hx${k}`) - 0.5) * 8, (random(`${S}-hy${k}`) - 0.5) * 3, z);
          mesh.scale.set(w, w * 0.6, 1);
          mesh.frustumCulled = false;
          mesh.renderOrder = -10 + k;
          return mesh;
        })
      : [];
    const bases = new THREE.InstancedMesh(baseGeo, mats.base, (N * 2 * NS));
    const atoms = new THREE.InstancedMesh(atomGeo, mats.atom, atomCount);
    for (const m of [bases, atoms]) m.frustumCulled = false;
    return {tube, glowGeo, dustGeo, bokehGeo, nb, mats, hz, layers, bases, atoms};
  }, [N, S, flow, dust, haze, replicate, U]);

  // ── 每帧：只改 uniform ──
  const r = radius;
  const fork = unzipAt < 0 ? -100 : (t - unzipAt) * unzipSpeed;
  U.uR.value = r;
  U.uRise.value = 0.34 * r;
  U.uTwist.value = (twist * Math.PI) / 180;
  U.uSpin.value = spin * t;
  U.uOpen.value = 2.0 * r;
  U.uFork.value = fork;
  U.uRepFront.value = replicate ? Math.min(fork - 5, (t - replicateAt) * replicateSpeed) : -100;
  U.uTime.value = t;
  U.uGlow.value = glow;
  const bb = new THREE.Color(backbone);
  U.uRim.value.copy(bb).lerp(new THREE.Color('#ffffff'), 0.45);
  const h1 = new THREE.Color(hazeColor);
  const h2 = h1.clone().lerp(new THREE.Color('#1fb5c4'), 0.55); // 青色
  U.uFogCol.value.copy(h1).multiplyScalar(0.08 * Math.min(haze, 2));
  U.uFogD.value = 0.075 * haze;
  const {mats, hz} = built;
  hz.uH1.value.copy(h1);
  hz.uH2.value.copy(h2);
  hz.uAmt.value = 0.16 * haze;
  mats.tube.uniforms.uCol.value.copy(bb);
  mats.tube.uniforms.uTubeR.value = 0.09 * r;
  mats.atom.uniforms.uCol.value.copy(bb);
  mats.atom.uniforms.uAtomR.value = 0.115 * r;
  mats.base.uniforms.uBaseW.value = 0.1 * r;
  mats.base.uniforms.uBaseTh.value = 0.05 * r;
  [baseA, baseT, baseG, baseC].forEach((c, k) => (mats.base.uniforms.uBaseCol.value[k] as THREE.Color).set(c));
  mats.glow.uniforms.uFlowCol.value.copy(bb);
  mats.glow.uniforms.uGlowAmt.value = glow;
  mats.dust.uniforms.uA.value.copy(bb).lerp(new THREE.Color('#9fd0ff'), 0.4);
  mats.bokeh.uniforms.uAmt.value = 0.5 * Math.min(haze, 2);

  return (
    <group position={position}>
      {built.layers.map((m, k) => (
        <primitive key={k} object={m} />
      ))}
      {built.nb > 0 ? <points geometry={built.bokehGeo} material={mats.bokeh} frustumCulled={false} renderOrder={-1} /> : null}
      <primitive object={built.bases} />
      <primitive object={built.atoms} />
      <mesh geometry={built.tube} material={mats.tube} frustumCulled={false} renderOrder={1} />
      <points geometry={built.glowGeo} material={mats.glow} frustumCulled={false} renderOrder={2} />
      <points geometry={built.dustGeo} material={mats.dust} frustumCulled={false} renderOrder={3} />
    </group>
  );
};
