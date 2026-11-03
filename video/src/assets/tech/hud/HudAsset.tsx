// 资产 tech.hud.v1：全息界面（HUD）。参数见 registry.ts。
// 结构（全部自研 Shader，自发光，无贴图）：
//   1. 投影底盘：地面上的同心刻度环（分段弧反向旋转、刻度、虚线环），开机时从中心向外扩出；
//   2. 光锥：从底盘向上张开的半透明光柱（边缘亮、竖向流动条纹），里面有上升的光尘；
//   3. 中央数据地球：经纬线 + 噪声点阵大陆 + 菲涅尔边缘光，两条倾斜轨道环上各有一个光点；
//   4. 悬浮面板：沿弧形排在地球后方、面朝中心，每块一种控件（柱状图 / 波形 / 雷达 / 文字行 / 点阵 / 数码管读数），
//      带边框、角标、标题栏、网格、扫描线、偶发闪烁和横向错位故障；
//      开机：一条横线展开 → 纵向弹开（过冲）→ 一闪 → 内容从上往下擦出（擦入，不用淡入）；
//   5. 连接线：从地球连到每块面板，线上有数据光点流向面板；
//   6. 地面网格：远处渐隐。
// 时间全部由帧号驱动；布局 / 控件类型 / 数据由种子决定（random(seed)），同帧结果确定。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Easing, interpolate, random, useCurrentFrame, useVideoConfig} from 'remotion';
import {NOISE_GLSL} from '../../../engine/shaders/noise.glsl';
import type {Vec3} from '../../../engine/shot';

export type HudProps = {
  position?: Vec3;
  size?: number; // 整体尺寸倍数（1 = 底盘半径 1.6，地球半径 0.55，面板弧半径 3.2）
  panels?: number; // 面板数量
  color?: string; // 主色（青）
  accent?: string; // 强调色（琥珀）
  bootAt?: number; // 秒；开机动画开始时间，-1 = 一开始就是开着的
  flicker?: number; // 闪烁 / 故障强度 0–1
  globe?: boolean; // 中央数据地球
  floor?: boolean; // 地面网格
  brightness?: number;
  seed?: string | number;
};

const COMMON = /* glsl */ `
#define PI 3.14159265
#define TAU 6.2831853
uniform float uT; uniform float uSeed; uniform vec3 uCol; uniform vec3 uAcc; uniform float uBright;
float h11(float x) { return fract(sin(x * 127.1 + uSeed * 0.0137) * 43758.5453); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed * 0.0137) * 43758.5453); }
// 抗锯齿细线：d = 到线的距离，w = 半宽（同单位），px = 一个像素的宽度
float aal(float d, float w, float px) { return 1.0 - smoothstep(w, w + px * 1.5, abs(d)); }
`;

// ---------- 面板 ----------
const PANEL_VERT = /* glsl */ `
varying vec2 vUv; varying float vFog;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFog = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const PANEL_FRAG = /* glsl */ `
${COMMON}
uniform float uAspect; uniform float uType; uniform float uReveal; uniform float uFlash; uniform float uFlick; uniform float uPid;
varying vec2 vUv; varying float vFog;

// 七段数码管：c 为单个字符格内坐标（x 0–1，y 0–1），返回亮度
float seg(vec2 c, vec2 a, vec2 b, float w, float px) {
  vec2 pa = c - a, ba = b - a;
  float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return aal(length(pa - ba * t), w, px);
}
float digit(vec2 c, float d, float px) {
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0) return 0.0;
  // 段位：a 上 b 右上 c 右下 d 下 e 左下 f 左上 g 中
  float m;
  int di = int(d + 0.5);
  if (di == 0) m = 63.0; else if (di == 1) m = 6.0; else if (di == 2) m = 91.0; else if (di == 3) m = 79.0;
  else if (di == 4) m = 102.0; else if (di == 5) m = 109.0; else if (di == 6) m = 125.0; else if (di == 7) m = 7.0;
  else if (di == 8) m = 127.0; else m = 111.0;
  float w = 0.07; float o = 0.0;
  vec2 p0 = vec2(0.18, 0.9), p1 = vec2(0.82, 0.9), p2 = vec2(0.82, 0.5), p3 = vec2(0.82, 0.1), p4 = vec2(0.18, 0.1), p5 = vec2(0.18, 0.5);
  float s = 0.06; // 段之间留缝
  if (mod(m, 2.0) >= 1.0) o = max(o, seg(c, p0 + vec2(s, 0), p1 - vec2(s, 0), w, px));
  if (mod(floor(m / 2.0), 2.0) >= 1.0) o = max(o, seg(c, p1 - vec2(0, s), p2 + vec2(0, s), w, px));
  if (mod(floor(m / 4.0), 2.0) >= 1.0) o = max(o, seg(c, p2 - vec2(0, s), p3 + vec2(0, s), w, px));
  if (mod(floor(m / 8.0), 2.0) >= 1.0) o = max(o, seg(c, p3 - vec2(s, 0), p4 + vec2(s, 0), w, px));
  if (mod(floor(m / 16.0), 2.0) >= 1.0) o = max(o, seg(c, p4 + vec2(0, s), p5 - vec2(0, s), w, px));
  if (mod(floor(m / 32.0), 2.0) >= 1.0) o = max(o, seg(c, p5 + vec2(0, s), p0 - vec2(0, s), w, px));
  if (mod(floor(m / 64.0), 2.0) >= 1.0) o = max(o, seg(c, p5 + vec2(s, 0), p2 - vec2(s, 0), w, px));
  return o;
}
// 「文字」：一行里若干个词，每个词由小方块字形组成（只当纹理，不可读）
float textRow(vec2 c, float row, float len, float px) {
  if (c.x > len || c.y < 0.25 || c.y > 0.75) return 0.0;
  float x = c.x; float acc = 0.0; float on = 0.0;
  for (int k = 0; k < 8; k++) {
    float w = 0.05 + 0.13 * h21(vec2(row, float(k)));
    if (x >= acc && x < acc + w) on = 1.0;
    acc += w + 0.03;
  }
  float g = fract(c.x * 55.0);
  float gl = step(0.18, g) * step(g, 0.82) * step(0.3, h21(vec2(floor(c.x * 55.0), row * 7.0 + floor(c.y * 2.0))));
  return on * mix(1.0, gl, 0.55);
}

vec3 widget(vec2 c, float ca, float px, out float a) {
  a = 0.0; vec3 col = uCol; float o = 0.0;
  float ty = uType;
  float hp = h11(uPid * 13.0);
  if (ty < 0.5) {
    // 柱状图：LED 分段柱，高度随时间起伏，最高段用强调色
    float n = 16.0; float i = floor(c.x * n); float fx = fract(c.x * n);
    float hgt = 0.18 + 0.72 * (0.5 + 0.5 * sin(uT * (0.9 + 0.6 * h11(i + uPid)) + i * 0.8 + hp * 6.0)) * (0.55 + 0.45 * h11(i * 3.0 + uPid));
    float bar = step(0.18, fx) * step(fx, 0.82) * step(c.y, hgt);
    float led = step(0.28, fract(c.y * 22.0));
    o = bar * led;
    if (c.y > hgt - 0.06 && bar > 0.0) col = uAcc;
    o += 0.6 * aal(c.y, 0.004, px);
    o += 0.18 * aal(fract(c.y * 4.0) - 0.5, 0.002, px) * step(0.5, fract(c.x * 40.0));
    a = o;
  } else if (ty < 1.5) {
    // 波形：向左滚动的曲线 + 填充 + 网格 + 当前值光点
    float x = c.x + uT * 0.12;
    float v = 0.5 + 0.22 * sin(x * 11.0 + hp * 6.0) + 0.1 * sin(x * 29.0 + 1.3) + 0.05 * sin(x * 71.0);
    float dv = 0.22 * 11.0 * cos(x * 11.0 + hp * 6.0) + 0.1 * 29.0 * cos(x * 29.0 + 1.3) + 0.05 * 71.0 * cos(x * 71.0);
    float d = (c.y - v) / sqrt(1.0 + dv * dv / (ca * ca));
    o = aal(d, 0.006, px) + 0.35 * aal(d, 0.02, px) * 0.4;
    o += 0.16 * step(c.y, v) * (c.y / max(v, 0.01));
    o += 0.15 * (aal(fract(c.x * 8.0) - 0.5, 0.002, px) + aal(fract(c.y * 4.0) - 0.5, 0.002, px)) * step(0.5, fract((c.x + c.y) * 60.0));
    float xd = 0.86; float xx = xd + uT * 0.12;
    float vd = 0.5 + 0.22 * sin(xx * 11.0 + hp * 6.0) + 0.1 * sin(xx * 29.0 + 1.3) + 0.05 * sin(xx * 71.0);
    float r = length((c - vec2(xd, vd)) * vec2(ca, 1.0));
    float dot2 = smoothstep(0.03, 0.015, r) + 0.6 * aal(r - 0.06 - 0.02 * sin(uT * 4.0), 0.004, px);
    if (dot2 > 0.01) col = mix(col, uAcc, clamp(dot2, 0.0, 1.0));
    o += dot2 + 0.5 * aal(c.x - xd, 0.002, px) * step(0.5, fract(c.y * 30.0));
    a = o;
  } else if (ty < 2.5) {
    // 雷达：同心环 + 十字 + 扫描扇区 + 扫过时亮起的目标点
    vec2 q = (c - 0.5) * vec2(ca, 1.0);
    float r = length(q); float R = 0.46;
    float ang = atan(q.y, q.x);
    o = 0.5 * (aal(r - R, 0.004, px) + aal(r - R * 0.66, 0.003, px) + aal(r - R * 0.33, 0.003, px));
    o += 0.25 * (aal(q.x, 0.002, px) + aal(q.y, 0.002, px)) * step(r, R);
    o += 0.4 * aal(fract(ang / TAU * 72.0) - 0.5, 0.06, px * 40.0) * step(R, r) * step(r, R + 0.03);
    float sw = uT * 1.8 + hp * 6.0;
    float df = mod(sw - ang, TAU);
    o += step(r, R) * (0.55 * exp(-df * 2.5) + 0.8 * aal(df, 0.01, px / max(r, 0.02)));
    for (int k = 0; k < 6; k++) {
      float ba = h11(float(k) * 5.0 + uPid) * TAU; float br = R * (0.2 + 0.75 * h11(float(k) * 7.0 + uPid));
      vec2 bp = vec2(cos(ba), sin(ba)) * br;
      float bd = mod(sw - ba, TAU);
      float blip = smoothstep(0.022, 0.01, length(q - bp)) * (0.25 + exp(-bd * 1.2));
      if (blip > 0.05 && k < 2) col = uAcc;
      o += blip * 1.5;
    }
    a = o;
  } else if (ty < 3.5) {
    // 文字行：逐行打字出现，光标闪烁；少数行用强调色
    float rows = 9.0;
    float row = floor((1.0 - c.y) * rows);
    vec2 rc = vec2(c.x, fract((1.0 - c.y) * rows));
    rc.y = 1.0 - rc.y;
    float len = 0.35 + 0.6 * h21(vec2(row, uPid));
    float typed = clamp(uT * 0.9 - row * 0.35 - hp, 0.0, 1.0) * len;
    // 滚动：打满后整体上移一行
    o = textRow(rc, row + floor(uT * 0.3) * rows, len, px) * step(rc.x, typed);
    float cur = step(abs(rc.x - typed - 0.012), 0.008) * step(0.2, rc.y) * step(rc.y, 0.8) * step(0.5, fract(uT * 2.0)) * step(typed, len - 0.001);
    o = max(o, cur);
    if (h21(vec2(row, uPid + 3.0)) > 0.78) col = uAcc;
    o *= 0.85;
    a = o;
  } else if (ty < 4.5) {
    // 点阵：方格随时间开关，少数格常亮强调色，一道亮带横扫
    vec2 g = vec2(22.0, 10.0);
    vec2 id = floor(c * g); vec2 f = fract(c * g);
    float on = step(0.55, h21(id + floor(uT * 2.5 + h21(id) * 4.0)));
    float cell = step(0.15, f.x) * step(f.x, 0.85) * step(0.15, f.y) * step(f.y, 0.85);
    float sweep = exp(-pow((c.x - fract(uT * 0.25 + hp)) * 8.0, 2.0));
    o = cell * (0.12 + 0.6 * on + 0.8 * sweep * on);
    if (h21(id + 77.0) > 0.93) { col = uAcc; o = cell * (0.7 + 0.3 * sin(uT * 5.0 + id.x)); }
    a = o;
  } else {
    // 数码管读数：大号 6 位数字持续计数 + 下方小字 + 进度条
    float val = floor(10000.0 * hp + uT * (37.0 + 50.0 * hp));
    vec2 dc = (c - vec2(0.04, 0.42)) / vec2(0.15 / ca * 1.3, 0.48);
    float idx = floor(dc.x);
    if (idx >= 0.0 && idx < 6.0) {
      float dv = mod(floor(val / pow(10.0, 5.0 - idx)), 10.0);
      o = digit(vec2(fract(dc.x) * 1.15 - 0.05, dc.y), dv, px * 6.0);
    }
    float prog = fract(uT * 0.13 + hp);
    vec2 pc = c - vec2(0.04, 0.22);
    float bar = step(0.0, pc.x) * step(pc.x, 0.92) * step(abs(pc.y), 0.025);
    float fill = step(pc.x, prog * 0.92);
    float barO = bar * (0.2 + 0.8 * fill * step(0.3, fract(pc.x * 60.0)));
    if (barO > 0.0 && fill > 0.5) col = uAcc;
    o = max(o, barO);
    o = max(o, 0.6 * textRow(vec2(c.x - 0.04, (c.y - 0.04) / 0.1), 3.0 + uPid, 0.5, px));
    a = o;
  }
  return col;
}

void main() {
  vec2 uv = vUv;
  vec2 p = vec2(uv.x * uAspect, uv.y);
  // 故障：偶发一条横带错位
  float gt = floor(uT * 10.0);
  float gOn = step(1.0 - 0.07 * uFlick, h11(gt * 3.1 + uPid * 17.0));
  float band = step(abs(uv.y - h11(gt + 7.0 + uPid)), 0.035);
  p.x += gOn * band * (h11(gt + 9.0) - 0.5) * 0.12;
  float px = fwidth(p.y);
  vec2 cd = min(p, vec2(uAspect, 1.0) - p);
  float edge = min(cd.x, cd.y);
  if (edge < -0.001) discard;
  float I = 0.0; vec3 col = uCol;
  // 底：极淡的填充 + 竖向渐变 + 网格
  float fill = 0.05 + 0.04 * uv.y;
  float grid = 0.03 * (aal(fract(p.x * 10.0) - 0.5, 0.002 * 10.0, px * 10.0) + aal(fract(p.y * 10.0) - 0.5, 0.002 * 10.0, px * 10.0));
  I += fill + grid;
  // 边框 + 四角 L 形角标
  I += 0.55 * aal(edge - 0.004, 0.0025, px);
  float L = 0.12;
  float br = step(cd.y, L) * aal(cd.x - 0.004, 0.006, px) + step(cd.x, L) * aal(cd.y - 0.004, 0.006, px);
  I += 1.1 * clamp(br, 0.0, 1.0) * step(cd.x, L) * step(cd.y, L);
  // 标题栏
  float hy = 0.86;
  I += 0.5 * aal(p.y - hy, 0.002, px) * step(0.04, p.x) * step(p.x, uAspect - 0.04);
  float title = textRow(vec2((p.x - 0.06) / 0.55, (p.y - hy - 0.015) / 0.09), 40.0 + uPid, 0.7, px);
  I += 0.7 * title;
  float ind = step(length(p - vec2(uAspect - 0.08, hy + 0.06)), 0.022) * (0.5 + 0.5 * step(0.5, fract(uT * 1.5 + uPid * 0.3)));
  // 内容区
  vec2 c0 = vec2(0.05, 0.06); vec2 cs = vec2(uAspect - 0.1, 0.74);
  vec2 c = (p - c0) / cs;
  float ca = cs.x / cs.y;
  float wa = 0.0; vec3 wc = uCol;
  if (c.x >= 0.0 && c.x <= 1.0 && c.y >= 0.0 && c.y <= 1.0) {
    wc = widget(c, ca, px / cs.y, wa);
  }
  // 内容擦出：自上而下，波前一条亮线
  float wipe = 1.0 - uv.y;
  float shown = step(wipe, uReveal * 1.08 - 0.04);
  float front = exp(-pow((wipe - (uReveal * 1.08 - 0.04)) * 60.0, 2.0)) * step(uReveal, 0.999) * step(0.001, uReveal);
  I *= mix(0.6, 1.0, step(0.999, uReveal) + shown);
  col = mix(col, wc, step(0.001, wa) * shown);
  I += wa * shown * 1.15;
  I += front * 1.5;
  // 扫描线 + 缓慢下移的亮带
  I *= 0.82 + 0.18 * sin(uv.y * 520.0);
  I *= 1.0 + 0.35 * exp(-pow((fract(uv.y - uT * 0.18) - 0.5) * 9.0, 2.0));
  // 闪烁 + 开机闪光
  I *= 1.0 - uFlick * 0.35 * step(0.94, h11(floor(uT * 24.0) + uPid * 31.0));
  I *= 1.0 + 2.0 * uFlash;
  vec3 outc = col * I + uAcc * ind * 1.2;
  outc *= exp(-max(vFog - 6.0, 0.0) * 0.04);
  gl_FragColor = vec4(outc * uBright, 1.0);
}`;

// ---------- 投影底盘（地面圆盘） ----------
const DISK_VERT = /* glsl */ `
varying vec2 vP;
void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const DISK_FRAG = /* glsl */ `
${COMMON}
uniform float uR; uniform float uBoot;
varying vec2 vP;
void main() {
  vec2 q = vP / uR;
  float r = length(q);
  if (r > 1.05) discard;
  float a = atan(q.y, q.x) / TAU + 0.5;
  float px = fwidth(r);
  float o = 0.0; vec3 col = uCol;
  o += 0.9 * aal(r - 0.98, 0.004, px) + 0.5 * aal(r - 0.93, 0.002, px);
  // 刻度
  float tk = fract(a * 120.0);
  float longT = step(fract(a * 12.0 + 0.004), 0.008);
  o += 0.7 * step(tk, 0.12) * step(0.86, r) * step(r, mix(0.9, 0.93, longT));
  // 分段弧（顺时针慢转）
  float s1 = fract(a * 6.0 + uT * 0.04);
  o += 0.8 * step(0.08, s1) * step(s1, 0.78) * step(0.76, r) * step(r, 0.8);
  // 内圈虚线（逆时针）
  float s2 = fract(a * 48.0 - uT * 0.3);
  o += 0.55 * step(s2, 0.5) * aal(r - 0.62, 0.006, px);
  // 强调色短弧（快转）
  float s3 = fract(a - uT * 0.12);
  float accArc = step(s3, 0.12) * step(0.68, r) * step(r, 0.71);
  o += 0.5 * aal(r - 0.4, 0.003, px) + 0.3 * aal(r - 0.25, 0.002, px);
  // 中心发光
  float glow = exp(-r * 4.0) * 0.6 + exp(-r * 14.0) * 0.8;
  // 开机：从中心往外扩，前沿一圈亮
  float rv = uBoot * 1.05;
  float m = step(r, rv);
  float front = exp(-pow((r - rv) * 30.0, 2.0)) * step(uBoot, 0.999);
  vec3 c = col * (o * m + glow * smoothstep(0.0, 0.4, uBoot)) + uAcc * accArc * m * 1.2 + col * front * 1.5;
  gl_FragColor = vec4(c * uBright, 1.0);
}`;

// ---------- 地面网格 ----------
const FLOOR_FRAG = /* glsl */ `
${COMMON}
uniform float uR; uniform float uBoot;
varying vec2 vP;
void main() {
  vec2 q = vP / uR;
  float r = length(q);
  vec2 g = q * 1.0;
  vec2 fw = fwidth(g);
  vec2 gl = 1.0 - smoothstep(vec2(0.0), fw * 1.5, abs(fract(g) - 0.5) - 0.5 + fw);
  // 远处一格不到几个像素时线会挤成一片，按像素宽度淡出
  float l = max(gl.x, gl.y) * (1.0 - smoothstep(0.04, 0.2, max(fw.x, fw.y)));
  float fade = exp(-r * 0.5) * smoothstep(0.9, 1.4, r) * smoothstep(5.5, 3.0, r);
  float o = l * fade * 0.22 * smoothstep(0.0, 1.0, uBoot);
  gl_FragColor = vec4(uCol * o * uBright, 1.0);
}`;

// ---------- 光锥 ----------
const CONE_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const CONE_FRAG = /* glsl */ `
${COMMON}
${NOISE_GLSL}
uniform float uOn;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  float y = vUv.y;
  float streak = 0.55 + 0.45 * snoise(vec3(vUv.x * 18.0, y * 2.0 - uT * 0.6, uSeed * 0.01));
  float o = pow(1.0 - y, 1.3) * (0.1 + 0.3 * pow(f, 3.0)) * streak * (1.0 - smoothstep(0.75, 1.0, y));
  o *= smoothstep(0.0, 0.05, y);
  gl_FragColor = vec4(uCol * o * uOn * uBright, 1.0);
}`;

// ---------- 数据地球 ----------
const GLOBE_FRAG = /* glsl */ `
${COMMON}
${NOISE_GLSL}
uniform float uOn;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
varying vec3 vObj;
void main() {
  vec3 n = normalize(vObj);
  float lat = asin(clamp(n.y, -1.0, 1.0));
  float lon = atan(n.z, n.x) + uT * 0.25;
  float px = fwidth(lat);
  float o = 0.0;
  o += 0.45 * aal(fract(lat / PI * 12.0) - 0.5, 0.03, px / PI * 12.0 * 1.0);
  o += 0.45 * aal(fract(lon / TAU * 24.0) - 0.5, 0.03, px / TAU * 24.0 * 1.0) * (1.0 - smoothstep(1.3, 1.5, abs(lat)));
  // 点阵大陆
  vec3 m = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
  float land = snoise(m * 1.6 + uSeed * 0.001) + 0.5 * snoise(m * 3.5 + 7.0);
  vec2 dg = vec2(lon / TAU * 90.0, lat / PI * 45.0);
  float dt = smoothstep(0.32, 0.18, length(fract(dg) - 0.5));
  o += 0.9 * dt * smoothstep(0.1, 0.3, land);
  float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
  vec3 c = uCol * (o * 0.85 + fr * 1.2 + 0.04);
  // 城市亮点（强调色）
  float city = step(0.985, h21(floor(dg))) * dt * smoothstep(0.1, 0.3, land);
  c += uAcc * city * 2.0;
  gl_FragColor = vec4(c * uOn * uBright, 1.0);
}`;
const GLOBE_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vObj;
void main() {
  vUv = uv; vObj = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

// ---------- 轨道环（细圆环 + 一个跑动的光点） ----------
const RING_FRAG = /* glsl */ `
${COMMON}
uniform float uOn; uniform float uSpeed; uniform float uOff;
varying vec2 vP;
void main() {
  float r = length(vP);
  float a = atan(vP.y, vP.x) / TAU + 0.5;
  float d = fract(a - uT * uSpeed - uOff);
  float tail = exp(-d * 9.0);
  float s = step(fract(a * 90.0), 0.6);
  vec3 c = uCol * (0.25 * s + 1.6 * tail) + uAcc * exp(-d * 60.0) * 2.0;
  gl_FragColor = vec4(c * uOn * uBright, 1.0);
}`;

// ---------- 连接线上的数据光点 + 光尘 ----------
const PTS_VERT = /* glsl */ `
${COMMON}
attribute vec4 aA; attribute vec4 aB; // 线：起点 xyz + 类型（0 光点 / 1 光尘），终点 xyz + 相位
uniform float uViewH; uniform float uS; uniform float uOn; uniform float uLinkOn; uniform float uConeH; uniform float uConeR;
varying float vA; varying vec3 vC;
void main() {
  vec3 p; float a; float sz;
  vC = uCol;
  if (aA.w < 0.5) {
    float t = fract(uT * 0.45 + aB.w);
    p = mix(aA.xyz, aB.xyz, t);
    a = smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.85, 1.0, t));
    sz = 0.05;
    a *= uLinkOn;
    if (fract(aB.w * 7.0) > 0.8) vC = uAcc;
  } else {
    // 光尘：在光锥内上升
    float t = fract(uT * (0.08 + 0.06 * aB.y) + aB.x);
    float ang = aB.z * TAU + uT * 0.2;
    float rr = sqrt(aB.w) * mix(uConeR * 0.25, uConeR, t);
    p = vec3(cos(ang) * rr, t * uConeH, sin(ang) * rr);
    a = sin(t * PI) * 0.5;
    sz = 0.025;
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float pxs = projectionMatrix[1][1] * 0.5 * uViewH;
  float px = sz * uS * pxs / max(-mv.z, 0.001);
  if (px < 1.5) { a *= px * px / 2.25; px = 1.5; }
  gl_PointSize = min(px, 32.0);
  vA = a * uOn;
  gl_Position = projectionMatrix * mv;
}`;
const PTS_FRAG = /* glsl */ `
uniform float uBright;
varying float vA; varying vec3 vC;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d2 = dot(c, c);
  float g = exp(-d2 * 30.0) + 0.25 * exp(-d2 * 8.0);
  gl_FragColor = vec4(vC * g * vA * 1.4 * uBright, 1.0);
}`;
const LINE_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uOn; uniform float uBright;
void main() { gl_FragColor = vec4(uCol * 0.22 * uOn * uBright, 1.0); }`;
const LINE_VERT = /* glsl */ `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

type PanelLayout = {pos: Vec3; rotY: number; rotX: number; w: number; h: number; type: number; start: number; bob: number};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export const HudAsset: React.FC<HudProps> = ({
  position = [0, 0, 0],
  size = 1,
  panels = 7,
  color = '#38d9ff',
  accent = '#ffb347',
  bootAt = 0.5,
  flicker = 0.5,
  globe = true,
  floor = true,
  brightness = 1,
  seed = 'hud',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const nP = Math.max(1, Math.min(12, Math.round(panels)));
  const S = size;
  const diskR = 1.6 * S;
  const globeR = 0.55 * S;
  const globeY = 1.75 * S;
  const coneH = globeY - globeR * 0.4;
  const seedNum = Math.floor(random(`hud-${seed}`) * 1e5);

  // 布局：面板沿弧排在地球后方（-z 一侧），上下两排交错，面朝中心；类型 / 尺寸 / 先后由种子决定
  const layout = useMemo<PanelLayout[]>(() => {
    const out: PanelLayout[] = [];
    const typeOrder = [0, 1, 2, 3, 4, 5].sort((a, b) => random(`hud-type-${seed}-${a}`) - random(`hud-type-${seed}-${b}`));
    const span = Math.min(150, 40 + nP * 18);
    for (let i = 0; i < nP; i++) {
      const u = nP === 1 ? 0.5 : i / (nP - 1);
      const row = i % 2;
      const jitA = (random(`hud-a-${seed}-${i}`) - 0.5) * 6;
      const ang = ((u - 0.5) * span + jitA) * (Math.PI / 180);
      const Rp = (3.2 + (row ? 0.35 : 0) + (random(`hud-r-${seed}-${i}`) - 0.5) * 0.3) * S;
      const w = (1.25 + 0.5 * random(`hud-w-${seed}-${i}`)) * S;
      const aspect = 1.45 + 0.4 * random(`hud-asp-${seed}-${i}`);
      const y = (row ? 2.75 : 1.35) * S + (random(`hud-y-${seed}-${i}`) - 0.5) * 0.3 * S;
      // 开机顺序：从中间往两边
      const order = Math.abs(u - 0.5) * 2;
      out.push({
        pos: [Math.sin(ang) * Rp, y, -Math.cos(ang) * Rp],
        rotY: -ang,
        rotX: (row ? -0.12 : 0.06),
        w,
        h: w / aspect,
        type: typeOrder[i % 6],
        start: 0.9 + order * 0.9 + random(`hud-s-${seed}-${i}`) * 0.15,
        bob: random(`hud-b-${seed}-${i}`) * Math.PI * 2,
      });
    }
    return out;
  }, [nP, S, seed]);

  const built = useMemo(() => {
    const base = () => ({
      uT: {value: 0}, uSeed: {value: seedNum}, uCol: {value: new THREE.Color(color)}, uAcc: {value: new THREE.Color(accent)},
      uBright: {value: brightness},
    });
    const add = (vs: string, fs: string, u: Record<string, THREE.IUniform>, side: THREE.Side = THREE.DoubleSide) =>
      new THREE.ShaderMaterial({
        vertexShader: vs, fragmentShader: fs, uniforms: u, transparent: true, depthWrite: false, depthTest: false,
        blending: THREE.AdditiveBlending, side,
      });
    const panelMats = layout.map((l, i) =>
      add(PANEL_VERT, PANEL_FRAG, {
        ...base(), uAspect: {value: l.w / l.h}, uType: {value: l.type}, uReveal: {value: 0}, uFlash: {value: 0},
        uFlick: {value: flicker}, uPid: {value: i + 1},
      }),
    );
    const disk = add(DISK_VERT, DISK_FRAG, {...base(), uR: {value: diskR}, uBoot: {value: 0}});
    const floorM = add(DISK_VERT, FLOOR_FRAG, {...base(), uR: {value: diskR}, uBoot: {value: 0}});
    const cone = add(CONE_VERT, CONE_FRAG, {...base(), uOn: {value: 0}});
    const globeM = add(GLOBE_VERT, GLOBE_FRAG, {...base(), uOn: {value: 0}});
    const rings = [0, 1].map((k) => add(DISK_VERT, RING_FRAG, {...base(), uOn: {value: 0}, uSpeed: {value: k ? -0.18 : 0.13}, uOff: {value: k * 0.4}}));
    // 连接线：地球 → 每块面板靠近中心的一侧
    const linePos: number[] = [];
    const ptsA: number[] = [];
    const ptsB: number[] = [];
    const g0: Vec3 = [0, globeY, 0];
    layout.forEach((l, i) => {
      const end: Vec3 = [l.pos[0] * 0.93, l.pos[1] - l.h * 0.5, l.pos[2] * 0.93];
      const startP: Vec3 = [g0[0] + (end[0] - g0[0]) * 0.18, g0[1] + (end[1] - g0[1]) * 0.18, g0[2] + (end[2] - g0[2]) * 0.18];
      linePos.push(...startP, ...end);
      for (let j = 0; j < 4; j++) {
        ptsA.push(...startP, 0);
        ptsB.push(...end, random(`hud-pt-${seed}-${i}-${j}`));
      }
    });
    const nDust = 260;
    for (let j = 0; j < nDust; j++) {
      ptsA.push(0, 0, 0, 1);
      ptsB.push(random(`hud-d0-${seed}-${j}`), random(`hud-d1-${seed}-${j}`), random(`hud-d2-${seed}-${j}`), random(`hud-d3-${seed}-${j}`));
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePos), 3));
    const lineMat = add(LINE_VERT, LINE_FRAG, {uCol: {value: new THREE.Color(color)}, uOn: {value: 0}, uBright: {value: brightness}});
    const nPts = ptsA.length / 4;
    const ptsGeo = new THREE.BufferGeometry();
    ptsGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nPts * 3), 3));
    ptsGeo.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(ptsA), 4));
    ptsGeo.setAttribute('aB', new THREE.BufferAttribute(new Float32Array(ptsB), 4));
    const ptsMat = add(PTS_VERT, PTS_FRAG, {
      ...base(), uViewH: {value: 1080}, uS: {value: S}, uOn: {value: 0}, uLinkOn: {value: 0}, uConeH: {value: coneH}, uConeR: {value: globeR * 1.2},
    });
    return {panelMats, disk, floorM, cone, globeM, rings, lineGeo, lineMat, ptsGeo, ptsMat};
  }, [layout, seedNum, color, accent, brightness, flicker, diskR, globeY, globeR, coneH, S, seed]);

  // ---- 开机时间线（秒，相对 bootAt）----
  const tb = bootAt < 0 ? 100 : t - bootAt;
  const diskBoot = clamp01(interpolate(tb, [0, 0.8], [0, 1], {easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const coneOn = interpolate(tb, [0.3, 1.0], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  // 地球：弹出（过冲一次）
  const gp = interpolate(tb, [0.5, 1.2], [0, 1], {easing: Easing.bezier(0.34, 1.45, 0.64, 1), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const globeOn = interpolate(tb, [0.5, 0.8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const linesOn = interpolate(tb, [1.4, 2.2], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  const all = [built.disk, built.floorM, built.cone, built.globeM, ...built.rings, built.ptsMat, ...built.panelMats];
  for (const m of all) m.uniforms.uT.value = t;
  built.disk.uniforms.uBoot.value = diskBoot;
  built.floorM.uniforms.uBoot.value = diskBoot;
  built.cone.uniforms.uOn.value = coneOn;
  built.globeM.uniforms.uOn.value = globeOn;
  for (const r of built.rings) r.uniforms.uOn.value = globeOn;
  built.lineMat.uniforms.uOn.value = linesOn;
  built.ptsMat.uniforms.uOn.value = coneOn;
  built.ptsMat.uniforms.uLinkOn.value = linesOn / Math.max(coneOn, 1e-3);

  const panelState = layout.map((l, i) => {
    const s = tb - l.start;
    // 横线展开 0.25 秒 → 纵向弹开 0.35 秒（过冲）→ 闪一下 → 内容擦出 0.6 秒
    const sx = interpolate(s, [0, 0.25], [0, 1], {easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    const sy = interpolate(s, [0.22, 0.57], [0.015, 1], {easing: Easing.bezier(0.34, 1.45, 0.64, 1), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    const flash = s > 0.5 ? Math.exp(-(s - 0.55) * (s - 0.55) * 120) : 0;
    const reveal = interpolate(s, [0.6, 1.2], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    const m = built.panelMats[i];
    m.uniforms.uReveal.value = reveal;
    m.uniforms.uFlash.value = flash;
    // 悬浮：轻微上下漂（机器节奏，慢）
    const bob = Math.sin(t * 0.8 + l.bob) * 0.03 * S;
    return {visible: s > 0, sx: Math.max(sx, 0.001), sy, bob};
  });

  const viewH = 1080;
  built.ptsMat.uniforms.uViewH.value = viewH;

  return (
    <group position={position}>
      {floor && (
        <mesh material={built.floorM} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002 * S, 0]} frustumCulled={false} renderOrder={0}>
          <planeGeometry args={[diskR * 12, diskR * 12, 1, 1]} />
        </mesh>
      )}
      <mesh material={built.disk} rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false} renderOrder={1}>
        <planeGeometry args={[diskR * 2.2, diskR * 2.2, 1, 1]} />
      </mesh>
      {coneOn > 0 && (
        <mesh material={built.cone} position={[0, coneH / 2, 0]} frustumCulled={false} renderOrder={2}>
          <cylinderGeometry args={[globeR * 1.25, diskR * 0.16, coneH, 64, 1, true]} />
        </mesh>
      )}
      {globe && globeOn > 0 && (
        <group position={[0, globeY, 0]} scale={Math.max(gp, 0.001)}>
          <mesh material={built.globeM} frustumCulled={false} renderOrder={3}>
            <sphereGeometry args={[globeR, 96, 64]} />
          </mesh>
          <mesh material={built.rings[0]} rotation={[-Math.PI / 2 + 0.35, 0.2, 0]} frustumCulled={false} renderOrder={3}>
            <ringGeometry args={[globeR * 1.32, globeR * 1.34, 256, 1]} />
          </mesh>
          <mesh material={built.rings[1]} rotation={[-Math.PI / 2 - 0.5, -0.4, 0]} frustumCulled={false} renderOrder={3}>
            <ringGeometry args={[globeR * 1.55, globeR * 1.565, 256, 1]} />
          </mesh>
        </group>
      )}
      {linesOn > 0 && <lineSegments geometry={built.lineGeo} material={built.lineMat} frustumCulled={false} renderOrder={4} />}
      <points geometry={built.ptsGeo} material={built.ptsMat} frustumCulled={false} renderOrder={5} />
      {layout.map((l, i) =>
        panelState[i].visible ? (
          <group key={i} position={[l.pos[0], l.pos[1] + panelState[i].bob, l.pos[2]]} rotation={[l.rotX, l.rotY, 0, 'YXZ']}>
            <mesh material={built.panelMats[i]} scale={[panelState[i].sx, panelState[i].sy, 1]} frustumCulled={false} renderOrder={6}>
              <planeGeometry args={[l.w, l.h, 1, 1]} />
            </mesh>
          </group>
        ) : null,
      )}
    </group>
  );
};
