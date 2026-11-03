// 资产 biology.bloodflow.v1：血管内部穿行（小动脉内部，红细胞 / 白细胞 / 血小板随血流流过）。参数见 registry.ts。
// 按真实比例（《方案补充》#12），单位：微米（1 单位 = 1 µm）：
//   - 红细胞：双凹圆盘，直径约 7.8 µm、边缘厚约 2.5 µm、中心约 1 µm——用 Evans–Fung 实测公式旋转成形
//   - 白细胞（中性粒细胞）：直径约 12 µm，表面有皱褶；血小板：直径约 2.5 µm 的扁圆片
//   - 数量：红细胞按血细胞比容 × 血管容积 ÷ 红细胞体积（约 90 µm³）算；白细胞约为红细胞的 1/700，血小板约 1/20
//   - 流速：泊肃叶抛物线分布 v(r) = vmax·(1 − r²/R²)（中间快、靠壁慢）；红细胞离壁留约 3 µm 无细胞层（Fåhræus 效应）；
//     白细胞贴壁（边集）、慢速滚动；红细胞翻滚角速度 = 当地剪切率 dv/dr = 2·vmax·r / R²
//   - 时间：速度是真实值，但真实速度在微米尺度下太快，所以按 slowmo 倍慢放（默认 20 倍；片中要说明「慢放」）
// 画法：血管壁（管道内侧，内皮细胞铺成的鹅卵石纹 + 细胞核隆起，半透明粉红）+ 三种细胞 InstancedMesh；
//   细胞位置全在顶点着色器里按时间算（窗口跟着镜头循环），CPU 零开销、同帧确定；光照用「头灯」（光从镜头来）+ 次表面红光 + 边缘光；
//   血浆雾：越远越淡入血浆色。所有物体写深度，可以开 post.dof。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import {NOISE_GLSL} from '../../../engine/shaders/noise.glsl';
import type {Vec3} from '../../../engine/shot';

export type BloodFlowProps = {
  diameter?: number; // 血管内径（µm）
  length?: number; // 血管总长（µm）
  hematocrit?: number; // 血细胞比容（0–1，正常约 0.45）
  vmax?: number; // 中心最大流速（µm/s，真实值；小动脉约 2000–10000）
  slowmo?: number; // 慢放倍数
  window?: number; // 镜头前方保持有细胞的距离（µm）
  curve?: number; // 血管弯曲程度
  wallColor?: string;
  rbcColor?: string;
  plasmaColor?: string;
  seed?: string | number;
};

// 中心线（TS 与 GLSL 同一公式）：c(s) = (A·curve·sin(s/L1) + B·curve·sin(s/L2 + 1), C·curve·sin(s/L3 + 2), −s)
const A = 40, B = 18, C = 22, L1 = 260, L2 = 113, L3 = 190;
export const bloodflowPath = (s: number, curve = 1): Vec3 => [
  curve * (A * Math.sin(s / L1) + B * Math.sin(s / L2 + 1)),
  curve * C * Math.sin(s / L3 + 2),
  -s,
];
const PATH_GLSL = /* glsl */ `
uniform float uCurve;
vec3 cpath(float s) { return vec3(uCurve * (${A.toFixed(1)} * sin(s / ${L1.toFixed(1)}) + ${B.toFixed(1)} * sin(s / ${L2.toFixed(1)} + 1.0)), uCurve * ${C.toFixed(1)} * sin(s / ${L3.toFixed(1)} + 2.0), -s); }
vec3 ctan(float s) { return normalize(vec3(uCurve * (${A.toFixed(1)} / ${L1.toFixed(1)} * cos(s / ${L1.toFixed(1)}) + ${B.toFixed(1)} / ${L2.toFixed(1)} * cos(s / ${L2.toFixed(1)} + 1.0)), uCurve * ${C.toFixed(1)} / ${L3.toFixed(1)} * cos(s / ${L3.toFixed(1)} + 2.0), -1.0)); }
void cframe(float s, out vec3 T, out vec3 N, out vec3 Bn) { T = ctan(s); N = normalize(cross(T, vec3(0.0, 1.0, 0.0))); Bn = cross(N, T); }
`;

const SHADE_GLSL = /* glsl */ `
uniform vec3 uPlasma; uniform float uFogK;
vec3 headlight(vec3 base, vec3 n, vec3 v, float sss, float spec) {
  // 头灯：光从镜头来（显微镜 / 内窥镜式照明），包裹漫反射 + 次表面红光 + 边缘光 + 湿润高光
  float ndv = clamp(dot(n, v), 0.0, 1.0);
  float wrap = clamp((ndv + 0.35) / 1.35, 0.0, 1.0);
  float fres = pow(1.0 - ndv, 3.0);
  vec3 col = base * (0.08 + 0.85 * wrap);
  col += base * vec3(1.0, 0.35, 0.25) * sss * (1.0 - ndv) * 0.6;
  col += vec3(1.0, 0.75, 0.7) * fres * 0.35;
  col += vec3(1.0) * pow(ndv, 60.0) * spec * 0.6;
  return col;
}
vec3 fogit(vec3 col, float d) { return mix(uPlasma, col, exp(-d * uFogK)); }
`;

// ---------- 血管壁 ----------
const WALL_VERT = /* glsl */ `
attribute vec2 aSA; // x = 沿中心线 s（µm），y = 绕管角度（0–2π）
uniform float uR; uniform float uT;
varying vec3 vN; varying vec3 vV; varying vec2 vSA;
${PATH_GLSL}
${NOISE_GLSL}
void main() {
  float s = aSA.x; float a = aSA.y;
  vec3 T, N, Bn; cframe(s, T, N, Bn);
  vec3 dir = N * cos(a) + Bn * sin(a);
  // 壁面轻微起伏 + 很慢的搏动（随心跳一点点扩张）
  float bump = 0.6 * snoise(vec3(s * 0.04, cos(a) * 1.5, sin(a) * 1.5));
  float r = uR + bump + 0.35 * sin(uT * 7.5);
  vec3 p = cpath(s) + dir * r;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vV = -mv.xyz; vN = normalize(normalMatrix * (-dir)); vSA = aSA;
  gl_Position = projectionMatrix * mv;
}`;
const WALL_FRAG = /* glsl */ `
uniform vec3 uWall; uniform float uR; uniform float uSeedF;
varying vec3 vN; varying vec3 vV; varying vec2 vSA;
${SHADE_GLSL}
vec2 h22(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p + uSeedF) * 43758.5453); }
// 内皮细胞：沿血流方向拉长的鹅卵石（Voronoi），返回 (到细胞边缘距离, 到细胞中心距离)
vec2 cells(vec2 q) {
  vec2 g = floor(q), f = fract(q); float d1 = 8.0, d2 = 8.0; vec2 c1 = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(float(x), float(y)); vec2 r = o + h22(g + o) - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; c1 = r; } else if (d < d2) d2 = d;
  }
  return vec2(sqrt(d2) - sqrt(d1), sqrt(d1));
}
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(vV);
  // 内皮细胞约 40 µm 长、12 µm 宽（沿流向拉长）
  vec2 q = vec2(vSA.x / 40.0, vSA.y * uR / 12.0);
  vec2 c = cells(q);
  float edge = 1.0 - smoothstep(0.02, 0.09, c.x);
  float nucleus = 1.0 - smoothstep(0.12, 0.22, c.y);
  vec3 base = uWall * (0.85 + 0.2 * nucleus) * (1.0 - 0.35 * edge);
  base = mix(base, base * vec3(0.8, 0.6, 0.75), nucleus * 0.5);
  vec3 col = headlight(base, n, v, 1.0, 0.25);
  gl_FragColor = vec4(fogit(col, length(vV)), 1.0);
}`;

// ---------- 细胞（三种共用一个着色器，按 uKind 区分） ----------
const CELL_VERT = /* glsl */ `
attribute vec4 aI; // x = 起始 s，y = 半径比例 r/R，z = 角度 θ，w = 随机数
attribute vec4 aJ; // xyz = 翻滚轴，w = 初始相位
uniform float uR; uniform float uT; uniform float uVmax; uniform float uCamS; uniform float uWin; uniform float uBack; uniform float uKind;
varying vec3 vN; varying vec3 vV; varying vec3 vL; varying float vRnd;
${PATH_GLSL}
${NOISE_GLSL}
vec3 rot(vec3 p, vec3 ax, float an) { return p * cos(an) + cross(ax, p) * sin(an) + ax * dot(ax, p) * (1.0 - cos(an)); }
void main() {
  float rr = aI.y * uR;
  float v = uVmax * (1.0 - aI.y * aI.y);
  if (uKind > 0.5 && uKind < 1.5) v *= 0.12;                 // 白细胞贴壁滚动，慢得多
  float s = aI.x + v * uT;
  float rel = mod(s - uCamS + uBack, uWin) - uBack;          // 跟着镜头循环的窗口
  s = uCamS + rel;
  vec3 T, N, Bn; cframe(s, T, N, Bn);
  float th = aI.z + 0.15 * sin(uT * 3.0 + aI.w * 30.0);
  vec3 c = cpath(s) + (N * cos(th) + Bn * sin(th)) * rr;
  vec3 ax = normalize(aJ.xyz);
  float shear = 2.0 * uVmax * aI.y / uR;                     // 当地剪切率（1/s）
  float an = aJ.w + shear * uT * (uKind > 0.5 && uKind < 1.5 ? 0.12 : 0.5);
  vec3 lp = position; vec3 ln = normal;
  if (uKind > 0.5 && uKind < 1.5) {                          // 白细胞：表面皱褶
    float k = snoise(normalize(position) * 2.5 + aI.w * 10.0) * 0.5 + snoise(normalize(position) * 6.0) * 0.25;
    lp += normalize(position) * k * 1.4;
  }
  // 离镜头太近的细胞缩小消失（镜头不会被一个细胞糊满；确定性：只看距离）
  float camD = length(c - cameraPosition);
  lp *= smoothstep(5.0, 12.0, camD);
  vec3 p = c + rot(lp, ax, an);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vV = -mv.xyz; vN = normalize(normalMatrix * rot(ln, ax, an)); vL = position; vRnd = aI.w;
  // 窗口两端淡出：缩到 0（不会在镜头前突然出现）
  float edgeFade = smoothstep(-uBack, -uBack + 15.0, rel) * (1.0 - smoothstep(uWin - uBack - 40.0, uWin - uBack, rel));
  if (edgeFade < 0.01) mv.xyz = vec3(0.0, 0.0, 1.0);
  gl_Position = projectionMatrix * mv;
}`;
const CELL_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uKind;
varying vec3 vN; varying vec3 vV; varying vec3 vL; varying float vRnd;
${SHADE_GLSL}
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(vV);
  if (dot(n, v) < 0.0) n = -n;
  vec3 base = uCol * (0.9 + 0.2 * vRnd);
  float sss = 1.0, spec = 0.35;
  if (uKind < 0.5) {
    // 红细胞：中心凹处更薄、透出更亮的红
    float rc = length(vL.xz) / 3.9;
    base *= 0.85 + 0.35 * (1.0 - smoothstep(0.2, 0.7, rc));
  } else if (uKind < 1.5) {
    // 白细胞：用屏幕空间导数求真实法线，皱褶才看得出来
    n = normalize(cross(dFdx(-vV), dFdy(-vV)));
    if (dot(n, v) < 0.0) n = -n;
    sss = 0.4; spec = 0.1;
  }
  else { sss = 0.5; spec = 0.2; }
  vec3 col = headlight(base, n, v, sss, spec);
  gl_FragColor = vec4(fogit(col, length(vV)), 1.0);
}`;

// 红细胞：Evans–Fung 双凹形状（Evans & Fung 1972）：h(ρ) = sqrt(1 − ρ²)·(C0 + C2ρ² + C4ρ⁴)，R0 = 3.91 µm
const rbcGeometry = () => {
  const R0 = 3.91, C0 = 0.81, C2 = 7.83, C4 = -4.39;
  const pts: THREE.Vector2[] = [];
  const n = 28;
  // 从下表面中心 → 边缘 → 上表面中心（LatheGeometry 绕 y 轴旋转）
  for (let i = 0; i <= n; i++) {
    const rho = Math.sin((i / n) * Math.PI * 0.5);
    const h = 0.5 * Math.sqrt(Math.max(0, 1 - rho * rho)) * (C0 + C2 * rho * rho + C4 * rho ** 4);
    pts.push(new THREE.Vector2(rho * R0, -h));
  }
  for (let i = n - 1; i >= 0; i--) {
    const rho = Math.sin((i / n) * Math.PI * 0.5);
    const h = 0.5 * Math.sqrt(Math.max(0, 1 - rho * rho)) * (C0 + C2 * rho * rho + C4 * rho ** 4);
    pts.push(new THREE.Vector2(rho * R0, h));
  }
  pts[0].x = 0.0001; pts[pts.length - 1].x = 0.0001;
  const g = new THREE.LatheGeometry(pts, 40);
  g.computeVertexNormals();
  return g;
};

export const BloodFlowAsset: React.FC<BloodFlowProps> = ({
  diameter = 60,
  length = 2000,
  hematocrit = 0.45,
  vmax = 4000,
  slowmo = 20,
  window: win = 320,
  curve = 1,
  wallColor = '#c4545a',
  rbcColor = '#b3121a',
  plasmaColor = '#3a0a0c',
  seed = 'bloodflow',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const T = frame / fps / slowmo; // 模拟时间（秒）
  const R = diameter / 2;
  const S = String(seed);
  const built = useMemo(() => {
    const seedF = random(`bf-${S}`) * 100;
    const common = {
      uR: {value: R}, uT: {value: 0}, uCurve: {value: curve}, uPlasma: {value: new THREE.Color(plasmaColor)}, uFogK: {value: 0.012},
      uSeedF: {value: seedF},
    };
    // 血管壁
    const segS = Math.ceil(length / 4), segA = 72;
    const wpos = new Float32Array((segS + 1) * (segA + 1) * 3);
    const wsa = new Float32Array((segS + 1) * (segA + 1) * 2);
    const idx: number[] = [];
    for (let i = 0; i <= segS; i++) {
      for (let j = 0; j <= segA; j++) {
        const k = i * (segA + 1) + j;
        wsa[k * 2] = -100 + (i / segS) * length;
        wsa[k * 2 + 1] = (j / segA) * Math.PI * 2;
        if (i < segS && j < segA) idx.push(k, k + segA + 1, k + 1, k + 1, k + segA + 1, k + segA + 2);
      }
    }
    const wallGeo = new THREE.BufferGeometry();
    wallGeo.setAttribute('position', new THREE.BufferAttribute(wpos, 3));
    wallGeo.setAttribute('aSA', new THREE.BufferAttribute(wsa, 2));
    wallGeo.setIndex(idx);
    const wallMat = new THREE.ShaderMaterial({vertexShader: WALL_VERT, fragmentShader: WALL_FRAG, side: THREE.DoubleSide,
      uniforms: {...common, uWall: {value: new THREE.Color(wallColor)}}});
    // 细胞数量（真实比例）
    const volume = Math.PI * (R - 3) ** 2 * win;
    const nRbc = Math.round((hematocrit * volume) / 90);
    const nWbc = Math.max(1, Math.round(nRbc / 700));
    const nPlt = Math.round(nRbc / 20);
    const make = (geo: THREE.BufferGeometry, n: number, key: string, rmin: number, rmax: number) => {
      const ig = new THREE.InstancedBufferGeometry();
      ig.index = geo.index;
      ig.setAttribute('position', geo.getAttribute('position'));
      ig.setAttribute('normal', geo.getAttribute('normal'));
      const I = new Float32Array(n * 4), J = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        // 半径按面积均匀分布（截面上均匀）
        const u = random(`${S}-${key}-r${i}`);
        I[i * 4] = random(`${S}-${key}-s${i}`) * win;
        I[i * 4 + 1] = Math.sqrt(rmin * rmin + u * (rmax * rmax - rmin * rmin)) / R;
        I[i * 4 + 2] = random(`${S}-${key}-a${i}`) * Math.PI * 2;
        I[i * 4 + 3] = random(`${S}-${key}-w${i}`);
        const ax = new THREE.Vector3(random(`${S}-${key}-x${i}`) - 0.5, random(`${S}-${key}-y${i}`) - 0.5, random(`${S}-${key}-z${i}`) - 0.5).normalize();
        J.set([ax.x, ax.y, ax.z, random(`${S}-${key}-p${i}`) * Math.PI * 2], i * 4);
      }
      ig.setAttribute('aI', new THREE.InstancedBufferAttribute(I, 4));
      ig.setAttribute('aJ', new THREE.InstancedBufferAttribute(J, 4));
      ig.instanceCount = n;
      return ig;
    };
    const cellMat = (kind: number, col: string) => new THREE.ShaderMaterial({
      vertexShader: CELL_VERT, fragmentShader: CELL_FRAG, side: THREE.DoubleSide,
      uniforms: {...common, uKind: {value: kind}, uCol: {value: new THREE.Color(col)}, uVmax: {value: vmax}, uCamS: {value: 0},
        uWin: {value: win}, uBack: {value: 30}},
    });
    const plt = new THREE.SphereGeometry(1.25, 12, 8);
    plt.scale(1, 0.35, 1);
    const sets = [
      {geo: make(rbcGeometry(), nRbc, 'rbc', 0, R - 3.5), mat: cellMat(0, rbcColor)},
      {geo: make(new THREE.IcosahedronGeometry(6, 4), nWbc, 'wbc', R - 7.5, R - 6.5), mat: cellMat(1, '#e9dfe6')},
      {geo: make(plt, nPlt, 'plt', 0, R - 2), mat: cellMat(2, '#e2b9a8')},
    ];
    console.log(`[bloodflow] 红细胞 ${nRbc}，白细胞 ${nWbc}，血小板 ${nPlt}`);
    return {wallGeo, wallMat, sets, all: [wallMat, ...sets.map((x) => x.mat)]};
  }, [S, R, length, hematocrit, vmax, win, curve, wallColor, rbcColor, plasmaColor]);
  for (const m of built.all) m.uniforms.uT.value = T;
  // 细胞窗口跟着镜头：中心线上 z = −s，所以在真正绘制前（onBeforeRender，此时相机已就位）读镜头的 s
  const syncCam = (m: THREE.ShaderMaterial) => (_r: THREE.WebGLRenderer, _s: THREE.Scene, camera: THREE.Camera) => {
    m.uniforms.uCamS.value = -camera.position.z;
  };
  return (
    <group>
      <mesh geometry={built.wallGeo} material={built.wallMat} frustumCulled={false} />
      {built.sets.map((x, i) => (
        <mesh key={i} geometry={x.geo} material={x.mat} frustumCulled={false} onBeforeRender={syncCam(x.mat)} />
      ))}
    </group>
  );
};
