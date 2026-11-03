// 资产 biology.eye.v1：人眼球剖面（可切开、可显示光线聚焦）。参数见 registry.ts。
// 按真实比例（《方案补充》#12），单位：毫米（1 单位 = 1 mm），右眼，角膜朝 +z、鼻侧朝 +x、上方 +y：
//   - 巩膜外径 11.7（厚约 0.65）→ 脉络膜（约 0.25）→ 视网膜（约 0.25）；眼轴长约 24.4
//   - 角膜：曲率半径 7.8、直径 11.5、厚约 0.55，顶点在 z = 12.7；角膜缘在 z ≈ 10.2
//   - 前房深约 3 → 虹膜 / 晶状体前极在 z ≈ 9.1；晶状体直径 9.5、厚 4（前表面曲率半径 10、后表面 6）
//   - 视神经：在后极偏鼻侧 15° 穿出，神经直径约 3、带硬脑膜鞘约 4.5；视盘直径约 1.8；黄斑在后极，直径约 5.5
//   - 视网膜血管：从视盘发出，上下颞侧大弓绕过黄斑（动脉细、颜色浅；静脉粗、颜色深），按种子分支
// 切开：一张「剖面盖板」跟着切面走，着色器按到各结构的距离算出切面上每一层的颜色（不需要实心几何）；
//       其余壳面在切面一侧 discard，背面（内壁）照样画 → 看得到眼底。
// 光线：平行光经角膜、晶状体两次折射，汇聚到黄斑中央凹；光点沿光线流动。
// 全部由帧驱动、random(seed)，确定性。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import {NOISE_GLSL} from '../../../engine/shaders/noise.glsl';
import type {Vec3} from '../../../engine/shot';

export type EyeProps = {
  position?: Vec3;
  scale?: number; // 1 = 真实尺寸（毫米）
  yaw?: number; // 视线方向（度）：左右
  pitch?: number; // 视线方向（度）：上下
  cutNormal?: Vec3; // 切面法线（被切掉的一侧）；默认 [0,1,0] = 切掉上半，露出水平切面
  cutAt?: number; // 秒；-1 = 不切
  cutDuration?: number; // 秒
  cutDepth?: number; // 最终切到离球心多远（0 = 正中）
  pupil?: number; // 瞳孔半径（毫米，正常 1–4）
  irisColor?: string;
  rays?: number; // 光线条数，0 = 不显示
  raysAt?: number; // 秒
  rayColor?: string;
  seed?: string | number;
};

// ---------- 尺寸（毫米） ----------
const R_SCL = 11.7, R_CHO = 11.05, R_RET = 10.8, R_RIN = 10.55;
const Z_LIMBUS = Math.sqrt(R_SCL * R_SCL - 5.75 * 5.75); // 10.19
const COR_R = 7.8, COR_C = Z_LIMBUS - Math.sqrt(COR_R * COR_R - 5.75 * 5.75); // 角膜球心 z ≈ 4.92
const LENS = {za: 9.1, zp: 5.1, Ra: 10, Rp: 6, eq: 4.75};
const IRIS_Z = 9.3, IRIS_OUT = 5.9, IRIS_T = 0.4;
const NERVE_ANG = (15 * Math.PI) / 180;
const NERVE_DIR = new THREE.Vector3(Math.sin(NERVE_ANG), 0, -Math.cos(NERVE_ANG));
const NERVE_R = 1.5, SHEATH_R = 2.25, NERVE_LEN = 22;
const FOVEA = new THREE.Vector3(0, 0, -R_RIN);

const lensSagA = (r: number) => LENS.za - (LENS.Ra - Math.sqrt(LENS.Ra * LENS.Ra - r * r));
const lensSagP = (r: number) => LENS.zp + (LENS.Rp - Math.sqrt(LENS.Rp * LENS.Rp - r * r));
const corneaZ = (r: number) => COR_C + Math.sqrt(COR_R * COR_R - r * r);

// ---------- 着色器 ----------
const VERT = /* glsl */ `
varying vec3 vL; varying vec3 vW; varying vec3 vN; varying vec2 vUv;
void main() {
  vL = position; vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const COMMON = /* glsl */ `
uniform vec3 uCutN; uniform float uCutD; uniform float uSeedF; uniform float uOpen;
varying vec3 vL; varying vec3 vW; varying vec3 vN; varying vec2 vUv;
${NOISE_GLSL}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * snoise(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
void cutTest() { if (dot(vL, uCutN) > uCutD) discard; }
// 主光（左上前方，暖白）+ 补光（右下后方，冷）+ 湿润高光
vec3 shade(vec3 base, vec3 n, float specK, float gloss) {
  vec3 v = normalize(cameraPosition - vW);
  vec3 L1 = normalize(vec3(-0.5, 0.75, 0.55)), L2 = normalize(vec3(0.7, -0.3, -0.4));
  float d1 = clamp((dot(n, L1) + 0.25) / 1.25, 0.0, 1.0), d2 = max(dot(n, L2), 0.0);
  float s = pow(max(dot(n, normalize(L1 + v)), 0.0), gloss);
  float fr = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.0);
  return base * (0.10 + 0.95 * d1 + 0.22 * d2 * vec3(0.75, 0.85, 1.0)) + specK * s * vec3(1.0, 0.97, 0.92) + fr * 0.08 * base;
}`;

// 巩膜外表面：象牙白，近角膜缘略灰蓝，表面细小的巩膜外层血管；湿润高光
const SCLERA_FRAG = /* glsl */ `
${COMMON}
void main() {
  cutTest();
  vec3 p = vL;
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  if (!gl_FrontFacing) {   // 巩膜内壁（脉络膜挡住了，一般看不到）
    gl_FragColor = vec4(shade(vec3(0.25, 0.08, 0.05), n, 0.0, 8.0), 1.0); return;
  }
  vec3 base = mix(vec3(0.93, 0.89, 0.84), vec3(0.86, 0.87, 0.9), smoothstep(6.0, 10.0, p.z));
  base *= 0.95 + 0.05 * fbm(p * 0.9 + uSeedF);
  // 巩膜外层血管：细的弯曲红纹，越靠前越多
  float v1 = 1.0 - abs(snoise(p * 0.55 + vec3(uSeedF, 3.1, 0.0)));
  float v2 = 1.0 - abs(snoise(p * 1.3 + vec3(1.7, uSeedF, 4.0)));
  float ves = smoothstep(0.978, 0.997, v1) * 0.45 + smoothstep(0.985, 0.998, v2) * 0.25;
  ves *= smoothstep(2.0, 9.5, p.z);                                  // 只在前部（睑裂露出的部分）隐约可见
  base = mix(base, vec3(0.72, 0.16, 0.13), clamp(ves, 0.0, 0.8));
  gl_FragColor = vec4(shade(base, n, 0.55, 70.0), 1.0);
}`;

// 脉络膜：只在切开时从边缘看到（深红褐，血管密）
const CHOROID_FRAG = /* glsl */ `
${COMMON}
void main() {
  cutTest();
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec3 base = vec3(0.32, 0.08, 0.05) * (0.8 + 0.4 * fbm(vL * 2.0 + uSeedF));
  gl_FragColor = vec4(shade(base, n, 0.1, 20.0), 1.0);
}`;

// 视网膜内壁 = 眼底：橙红底色、周边变暗、脉络膜纹理隐约透出；视盘淡黄；黄斑暗、中央凹反光点
const RETINA_FRAG = /* glsl */ `
${COMMON}
uniform vec3 uDisc; uniform float uDiscR;
void main() {
  cutTest();
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec3 d = normalize(vL);
  float post = clamp(-d.z, 0.0, 1.0);                              // 越靠后极越亮
  vec3 base = vec3(0.78, 0.26, 0.12) * (0.55 + 0.45 * post);
  float tig = fbm(vL * 1.6 + uSeedF * 0.1);                        // 豹纹状的脉络膜纹理
  base *= 0.88 + 0.18 * smoothstep(-0.2, 0.5, tig);
  // 黄斑：后极直径约 5.5 mm 的暗区，中央凹 1.5 mm
  float dm = distance(vL, vec3(0.0, 0.0, -${R_RIN.toFixed(2)}));
  base = mix(base * vec3(0.55, 0.42, 0.35), base, smoothstep(0.6, 2.75, dm));
  base += vec3(0.9, 0.8, 0.6) * exp(-dm * dm / 0.02) * 0.6;       // 中央凹反光
  // 视盘：淡黄粉，中间视杯更白
  float dd = distance(vL, uDisc);
  float disc = 1.0 - smoothstep(uDiscR * 0.85, uDiscR * 1.05, dd);
  base = mix(base, vec3(0.98, 0.78, 0.55), disc);
  base = mix(base, vec3(1.0, 0.93, 0.82), 1.0 - smoothstep(uDiscR * 0.3, uDiscR * 0.5, dd));
  if (gl_FrontFacing) base = vec3(0.3, 0.07, 0.04);               // 外面（被脉络膜包住）
  // 没切开时眼球里面是暗的（瞳孔看起来是黑的），切开后才被照亮
  gl_FragColor = vec4(shade(base, n, 0.25, 30.0) * mix(0.04, 1.0, uOpen), 1.0);
}`;

// 视网膜血管
const VESSEL_FRAG = /* glsl */ `
${COMMON}
varying float vKind;
void main() {
  cutTest();
  vec3 n = normalize(vN);
  vec3 base = mix(vec3(0.75, 0.12, 0.08), vec3(0.42, 0.05, 0.06), vKind);   // 动脉 / 静脉
  vec3 v = normalize(cameraPosition - vW);
  float core = pow(clamp(dot(n, v), 0.0, 1.0), 6.0);                          // 血管中央的反光线
  gl_FragColor = vec4((shade(base, n, 0.3, 40.0) + core * 0.12 * (1.0 - vKind)) * mix(0.04, 1.0, uOpen), 1.0);
}`;
const VESSEL_VERT = /* glsl */ `
attribute float kind;
varying vec3 vL; varying vec3 vW; varying vec3 vN; varying vec2 vUv; varying float vKind;
void main() {
  vL = position; vUv = uv; vKind = kind;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

// 虹膜：正面放射状纤维 + 隐窝 + 卷缩轮，瞳孔缘一圈深色；背面黑色色素
const IRIS_FRAG = /* glsl */ `
${COMMON}
uniform vec3 uIris; uniform float uPupil;
void main() {
  cutTest();
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  float r = length(vL.xy), a = atan(vL.y, vL.x);
  if (vL.z < ${IRIS_Z.toFixed(2)}) { gl_FragColor = vec4(shade(vec3(0.03, 0.02, 0.02), n, 0.1, 20.0) * mix(0.1, 1.0, uOpen), 1.0); return; }
  float fib = 0.5 + 0.5 * snoise(vec3(a * 28.0, r * 1.2, uSeedF));
  float fib2 = 0.5 + 0.5 * snoise(vec3(a * 70.0, r * 3.0, uSeedF + 5.0));
  vec3 base = uIris * (0.55 + 0.5 * fib * fib2);
  float collar = exp(-pow((r - uPupil * 1.7) / 0.35, 2.0));
  base = mix(base, uIris * 1.6 + 0.08, collar * 0.5);
  float crypt = smoothstep(0.55, 0.8, snoise(vec3(a * 9.0, r * 2.0, uSeedF + 9.0)));
  base *= 1.0 - 0.45 * crypt * smoothstep(uPupil * 1.8, uPupil * 2.4, r);
  base *= mix(0.25, 1.0, smoothstep(uPupil, uPupil + 0.25, r));          // 瞳孔缘
  base *= mix(1.0, 0.45, smoothstep(${(IRIS_OUT - 0.6).toFixed(2)}, ${IRIS_OUT.toFixed(2)}, r)); // 外缘暗环
  gl_FragColor = vec4(shade(base, n, 0.2, 30.0), 1.0);
}`;

// 睫状体
const CILIARY_FRAG = /* glsl */ `
${COMMON}
void main() {
  cutTest();
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  float a = atan(vL.y, vL.x);
  vec3 base = vec3(0.22, 0.08, 0.05) * (0.7 + 0.5 * pow(0.5 + 0.5 * sin(a * 70.0), 3.0));
  gl_FragColor = vec4(shade(base, n, 0.15, 25.0) * mix(0.1, 1.0, uOpen), 1.0);
}`;

// 视神经 + 硬脑膜鞘（外面白色，带少量血管）
const NERVE_FRAG = /* glsl */ `
${COMMON}
void main() {
  cutTest();
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec3 base = vec3(0.9, 0.86, 0.8) * (0.9 + 0.1 * fbm(vL * 1.5 + uSeedF));
  float ves = smoothstep(0.96, 0.995, 1.0 - abs(snoise(vL * 0.6 + uSeedF * 2.0)));
  base = mix(base, vec3(0.7, 0.18, 0.14), ves * 0.6);
  gl_FragColor = vec4(shade(base, n, 0.4, 50.0), 1.0);
}`;

// 透明组织：角膜（强菲涅尔反光 + 高光）、晶状体（微黄、略乳白）
const GLASS_FRAG = /* glsl */ `
${COMMON}
uniform vec3 uTint; uniform float uBase; uniform float uFres;
void main() {
  cutTest();
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(cameraPosition - vW);
  float fr = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 4.0);
  vec3 L1 = normalize(vec3(-0.5, 0.75, 0.55));
  float s = pow(max(dot(n, normalize(L1 + v)), 0.0), 220.0) * 2.2 + pow(max(dot(n, normalize(L1 + v)), 0.0), 30.0) * 0.08;
  float a = clamp(uBase + uFres * fr + s, 0.0, 1.0);
  float lit = mix(0.15, 1.0, uOpen);                                 // 没切开时眼内暗，晶状体不发灰
  gl_FragColor = vec4(uTint * (0.35 + 0.65 * fr) * mix(lit, 1.0, step(0.5, uFres - 0.8)) + vec3(s), a);
}`;

// 剖面盖板：在切面上按各结构算颜色
const CAP_FRAG = /* glsl */ `
${COMMON}
uniform vec3 uNDir; uniform float uPupil; uniform vec3 uIris;
uniform vec4 uLens; uniform vec4 uCor; uniform vec4 uIrisG; uniform vec4 uNerve;
void main() {
  vec3 p = vL;
  float r = length(p);
  vec3 col; bool hit = false;
  vec3 n = normalize(vN);
  // 视神经截面（沿 NERVE_DIR 的圆柱）
  float t = dot(p, uNDir);
  float dax = length(p - uNDir * t);
  if (t > ${R_RIN.toFixed(2)} && t < ${R_RIN.toFixed(2)} + uNerve.z && dax < uNerve.y) {
    hit = true;
    col = dax < uNerve.x ? vec3(0.93, 0.86, 0.66) * (0.85 + 0.15 * snoise(p * 6.0)) : vec3(0.92, 0.9, 0.86);
    if (dax < 0.18) col = vec3(0.72, 0.1, 0.08);                     // 视网膜中央动静脉
    if (abs(dax - uNerve.x) < 0.06) col *= 0.75;
  }
  // 巩膜 / 脉络膜 / 视网膜三层（角膜缘之后）
  if (!hit && r < ${R_SCL.toFixed(2)} && r > ${R_RIN.toFixed(2)} && p.z < ${Z_LIMBUS.toFixed(2)}) {
    hit = true;
    if (r > ${R_CHO.toFixed(2)}) col = vec3(0.93, 0.9, 0.85) * (0.92 + 0.08 * snoise(p * 3.0));
    else if (r > ${R_RET.toFixed(2)}) col = vec3(0.34, 0.07, 0.05);
    else col = vec3(0.92, 0.55, 0.42);
    // 视网膜到锯齿缘（约 z = 5）为止，再往前是睫状体平部
    if (r <= ${R_CHO.toFixed(2)} && p.z > 5.5) col = vec3(0.24, 0.08, 0.05);
  }
  // 角膜截面
  float rc = distance(p, vec3(0.0, 0.0, uCor.y));
  if (!hit && rc < uCor.x && rc > uCor.x - uCor.z && p.z > ${Z_LIMBUS.toFixed(2)} - 0.3) { hit = true; col = vec3(0.82, 0.88, 0.92); }
  // 虹膜截面
  float rr = length(p.xy);
  if (!hit && abs(p.z - uIrisG.x) < uIrisG.z * 0.5 && rr > uPupil && rr < uIrisG.y) {
    hit = true; col = mix(vec3(0.04, 0.02, 0.02), uIris, step(uIrisG.x, p.z) * 0.8 + 0.2);
  }
  // 睫状体截面（虹膜根部后方的三角）
  if (!hit && rr > 5.2 && r < ${R_CHO.toFixed(2)} && p.z > 6.6 && p.z < uIrisG.x + 0.2 && (rr - 5.2) > (uIrisG.x - p.z) * 0.35) { hit = true; col = vec3(0.26, 0.09, 0.05); }
  // 晶状体截面（半透明感：中心核略黄）
  float dA = distance(p, vec3(0.0, 0.0, uLens.x - uLens.z)), dP = distance(p, vec3(0.0, 0.0, uLens.y + uLens.w));
  if (!hit && dA < uLens.z && dP < uLens.w) {
    hit = true;
    float core = length(vec2(rr / 4.75, (p.z - 7.1) / 2.0));
    col = mix(vec3(0.95, 0.85, 0.55), vec3(0.85, 0.88, 0.85), smoothstep(0.2, 0.95, core));
    col *= 0.9 + 0.1 * sin(core * 40.0);                             // 层状纤维
  }
  if (!hit) discard;
  gl_FragColor = vec4(shade(col, n, 0.25, 40.0), 1.0);
}`;

// 光线：沿管子流动的光点；已到达的部分常亮
const RAY_FRAG = /* glsl */ `
uniform float uT; uniform float uReveal; uniform vec3 uCol;
varying vec2 vUv;
void main() {
  float u = vUv.x;
  if (u > uReveal) discard;
  float flow = pow(0.5 + 0.5 * sin((u * 18.0 - uT * 3.0) * 6.2831), 8.0);
  float head = exp(-pow((uReveal - u) * 30.0, 2.0)) * 2.0;
  float b = 0.35 + 0.9 * flow + head;
  gl_FragColor = vec4(uCol * b, 1.0);
}`;
const RAY_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// ---------- 几何 ----------
const toZ = (g: THREE.BufferGeometry) => g.rotateX(Math.PI / 2); // 让球的 +y 极 / 车削轴朝 +z

const shellGeo = (r: number, thetaFrom: number, thetaTo: number) => toZ(new THREE.SphereGeometry(r, 160, 120, 0, Math.PI * 2, thetaFrom, thetaTo - thetaFrom));

// 车削体：profile 是 [半径, z] 列表，绕 z 轴转一圈（LatheGeometry 绕 y 轴，toZ 后 y 正好变成 z）
const lathe = (pts: [number, number][], seg = 128) => {
  const g = new THREE.LatheGeometry(pts.map(([r, z]) => new THREE.Vector2(r, z)), seg);
  return toZ(g);
};

const lensGeo = () => {
  const pts: [number, number][] = [];
  const N = 40;
  for (let i = 0; i <= N; i++) { const r = (LENS.eq * i) / N; pts.push([Math.max(r, 1e-4), lensSagP(r)]); }
  for (let i = N; i >= 0; i--) { const r = (LENS.eq * i) / N; pts.push([Math.max(r, 1e-4), lensSagA(r)]); }
  return lathe(pts);
};

const irisGeo = (pupil: number) => {
  const z0 = IRIS_Z + IRIS_T / 2, z1 = IRIS_Z - IRIS_T / 2;
  const pts: [number, number][] = [[pupil, z1], [IRIS_OUT, z1 - 0.15], [IRIS_OUT, z0 - 0.15], [pupil, z0], [pupil, z1]];
  return lathe(pts);
};

const ciliaryGeo = () => {
  // 贴着脉络膜内侧（r = √(R_CHO² − z²)）从虹膜根部延伸到锯齿缘（z ≈ 6）；内侧是隆起的睫状突
  const wall = (z: number) => Math.sqrt(R_CHO * R_CHO - z * z) - 0.05;
  const pts: [number, number][] = [[5.4, IRIS_Z - 0.15], [wall(9.0), 9.0], [wall(8.0), 8.0], [wall(7.0), 7.0], [wall(6.0), 6.0], [wall(6.0) - 0.3, 6.0], [6.6, 7.6], [5.6, 8.4], [5.4, IRIS_Z - 0.15]];
  return lathe(pts);
};

const nerveGeo = () => {
  const g = new THREE.CylinderGeometry(SHEATH_R, SHEATH_R * 1.05, NERVE_LEN, 64, 1, false);
  g.translate(0, R_RIN + NERVE_LEN / 2, 0); // 沿 +y 从球内伸出
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), NERVE_DIR);
  g.applyQuaternion(q);
  return g;
};

// 视网膜血管：从视盘发出的分支管，贴在视网膜内表面（半径略小于 R_RIN）
const vesselGeo = (seed: string) => {
  const disc = NERVE_DIR.clone().multiplyScalar(R_RIN);
  const geos: THREE.BufferGeometry[] = [];
  const kinds: number[] = [];
  const RV = R_RIN - 0.06;
  let k = 0;
  const rnd = () => random(`${seed}-v-${k++}`);
  // 在球面上从 p 沿切向 dir 走 len，返回点列
  const grow = (p0: THREE.Vector3, dir0: THREE.Vector3, len: number, radius: number, kind: number, bend: number, depth: number) => {
    const pts: THREE.Vector3[] = [];
    const p = p0.clone();
    const dir = dir0.clone();
    const steps = Math.max(4, Math.round(len / 0.35));
    const step = len / steps;
    for (let i = 0; i <= steps; i++) {
      pts.push(p.clone().normalize().multiplyScalar(RV));
      const nrm = p.clone().normalize();
      dir.sub(nrm.clone().multiplyScalar(dir.dot(nrm))).normalize();
      dir.applyAxisAngle(nrm, bend * step + (rnd() - 0.5) * 0.12);
      p.addScaledVector(dir, step);
      p.normalize().multiplyScalar(RV);
      // 分支
      if (depth < 3 && i > 2 && i < steps - 1 && rnd() < 0.09 * (depth + 1)) {
        const side = rnd() < 0.5 ? 1 : -1;
        const bd = dir.clone().applyAxisAngle(nrm, side * (0.5 + rnd() * 0.5));
        grow(p, bd, len * (0.25 + rnd() * 0.3), radius * 0.65, kind, (rnd() - 0.5) * 0.15, depth + 1);
      }
    }
    if (pts.length < 2) return;
    const curve = new THREE.CatmullRomCurve3(pts);
    const tg = new THREE.TubeGeometry(curve, pts.length * 2, radius, 8, false);
    // 末端变细
    const pos = tg.attributes.position;
    const uv = tg.attributes.uv;
    const c = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const u = uv.getX(i);
      const taper = 1 - 0.65 * u;
      const P = new THREE.Vector3().fromBufferAttribute(pos, i);
      curve.getPoint(u, c);
      P.sub(c).multiplyScalar(taper).add(c);
      pos.setXYZ(i, P.x, P.y, P.z);
    }
    tg.computeVertexNormals();
    geos.push(tg);
    kinds.push(kind);
  };
  // 局部切向基：视盘处的「上」和「颞侧（朝黄斑）」
  const nrm = disc.clone().normalize();
  const up = new THREE.Vector3(0, 1, 0).sub(nrm.clone().multiplyScalar(nrm.y)).normalize();
  const temporal = FOVEA.clone().sub(disc);
  temporal.sub(nrm.clone().multiplyScalar(temporal.dot(nrm))).normalize();
  // 四条主干（上颞、下颞、上鼻、下鼻），每条一根动脉 + 一根静脉并行
  const trunks: [number, number, number, number][] = [
    // [与颞侧夹角（朝上为正）, 长度, 弯曲（绕黄斑）, ]
    [0.75, 15, -0.07, 0], [-0.75, 15, 0.07, 0], [2.2, 10, 0.0, 0], [-2.2, 10, 0.0, 0],
  ];
  for (const [ang, len, bend] of trunks) {
    for (const kind of [0, 1]) {
      const off = (kind ? 1 : -1) * 0.12;
      const d = temporal.clone().applyAxisAngle(nrm, ang + off);
      grow(disc.clone().addScaledVector(up, off), d, len * (0.9 + rnd() * 0.2), kind ? 0.075 : 0.055, kind, bend, 0);
    }
  }
  // 黄斑周围的细小分支
  for (let i = 0; i < 10; i++) {
    const a = rnd() * Math.PI * 2;
    const start = FOVEA.clone().add(new THREE.Vector3(Math.cos(a) * 3.2, Math.sin(a) * 3.2, 0));
    const d = FOVEA.clone().sub(start).normalize().applyAxisAngle(start.clone().normalize(), (rnd() - 0.5) * 0.8);
    grow(start, d, 1.4 + rnd(), 0.025, rnd() < 0.5 ? 0 : 1, 0, 3);
  }
  // 合并
  const merged = new THREE.BufferGeometry();
  const P: number[] = [], Nn: number[] = [], U: number[] = [], K: number[] = [], I: number[] = [];
  let base = 0;
  geos.forEach((g, gi) => {
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      P.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      Nn.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      U.push(uv.getX(i), uv.getY(i));
      K.push(kinds[gi]);
    }
    const idx = g.index!;
    for (let i = 0; i < idx.count; i++) I.push(idx.getX(i) + base);
    base += pos.count;
    g.dispose();
  });
  merged.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  merged.setAttribute('kind', new THREE.Float32BufferAttribute(K, 1));
  merged.setIndex(I);
  return merged;
};

// 光线路径：平行光 → 角膜（折射）→ 晶状体前后表面（折射）→ 中央凹（略高于切面，像教科书示意图）
const rayGeos = (n: number, lift: number) => {
  const out: THREE.BufferGeometry[] = [];
  const focus = FOVEA.clone().setY(lift).setZ(-R_RIN + 0.15);
  for (let i = 0; i < n; i++) {
    const h = n === 1 ? 0 : -3.2 + (6.4 * i) / (n - 1);
    const p0 = new THREE.Vector3(h, lift, 45);
    const p1 = new THREE.Vector3(h, lift, corneaZ(Math.abs(h)));
    const h2 = h * 0.82, h3 = h * 0.55;
    const p2 = new THREE.Vector3(h2, lift, lensSagA(Math.abs(h2)));
    const p3 = new THREE.Vector3(h3, lift, lensSagP(Math.abs(h3)));
    const path = new THREE.CurvePath<THREE.Vector3>();
    [p0, p1, p2, p3, focus].reduce((a, b) => { path.add(new THREE.LineCurve3(a, b)); return b; });
    out.push(new THREE.TubeGeometry(path as unknown as THREE.Curve<THREE.Vector3>, 160, 0.06, 6, false));
  }
  return out;
};

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const rad = (d: number) => (d * Math.PI) / 180;

export const EyeAsset: React.FC<EyeProps> = ({
  position = [0, 0, 0],
  scale = 1,
  yaw = 0,
  pitch = 0,
  cutNormal = [0, 1, 0],
  cutAt = -1,
  cutDuration = 3,
  cutDepth = 0,
  pupil = 2,
  irisColor = '#6b4a2e',
  rays = 0,
  raysAt = 0,
  rayColor = '#fff2c8',
  seed = 'eye',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const S = String(seed);

  const res = useMemo(() => {
    const seedF = random(`eye-${S}`) * 100;
    const cutN = new THREE.Vector3(...cutNormal).normalize();
    const common = () => ({uCutN: {value: cutN.clone()}, uCutD: {value: 99}, uSeedF: {value: seedF}, uOpen: {value: 0}});
    const mk = (frag: string, extra: Record<string, THREE.IUniform> = {}, opts: Partial<THREE.ShaderMaterialParameters> = {}) =>
      new THREE.ShaderMaterial({vertexShader: VERT, fragmentShader: frag, uniforms: {...common(), ...extra}, side: THREE.DoubleSide, ...opts});
    const disc = NERVE_DIR.clone().multiplyScalar(R_RIN);
    const mats = {
      sclera: mk(SCLERA_FRAG),
      choroid: mk(CHOROID_FRAG),
      retina: mk(RETINA_FRAG, {uDisc: {value: disc}, uDiscR: {value: 0.9}}),
      vessel: new THREE.ShaderMaterial({vertexShader: VESSEL_VERT, fragmentShader: VESSEL_FRAG, uniforms: common(), side: THREE.FrontSide}),
      iris: mk(IRIS_FRAG, {uIris: {value: new THREE.Color(irisColor)}, uPupil: {value: pupil}}),
      ciliary: mk(CILIARY_FRAG),
      nerve: mk(NERVE_FRAG),
      cornea: mk(GLASS_FRAG, {uTint: {value: new THREE.Color('#dfefff')}, uBase: {value: 0.02}, uFres: {value: 0.9}}, {transparent: true, depthWrite: false}),
      lens: mk(GLASS_FRAG, {uTint: {value: new THREE.Color('#f3e7c4')}, uBase: {value: 0.1}, uFres: {value: 0.6}}, {transparent: true, depthWrite: false}),
      cap: mk(CAP_FRAG, {
        uNDir: {value: NERVE_DIR.clone()}, uPupil: {value: pupil}, uIris: {value: new THREE.Color(irisColor)},
        uLens: {value: new THREE.Vector4(LENS.za, LENS.zp, LENS.Ra, LENS.Rp)},
        uCor: {value: new THREE.Vector4(COR_R, COR_C, 0.55, 0)},
        uIrisG: {value: new THREE.Vector4(IRIS_Z, IRIS_OUT, IRIS_T, 0)},
        uNerve: {value: new THREE.Vector4(NERVE_R, SHEATH_R, NERVE_LEN, 0)},
      }, {side: THREE.FrontSide}),
    };
    const thLimbus = Math.acos(Z_LIMBUS / R_SCL);
    const geos = {
      sclera: shellGeo(R_SCL, thLimbus, Math.PI),
      choroid: shellGeo(R_CHO, Math.acos(8.2 / R_CHO), Math.PI),
      retina: shellGeo(R_RIN, Math.acos(5.5 / R_RIN), Math.PI),
      cornea: toZ(new THREE.SphereGeometry(COR_R, 96, 48, 0, Math.PI * 2, 0, Math.asin(5.75 / COR_R) + 0.01)).translate(0, 0, COR_C),
      lens: lensGeo(),
      iris: irisGeo(pupil),
      ciliary: ciliaryGeo(),
      nerve: nerveGeo(),
      vessel: vesselGeo(S),
      cap: new THREE.PlaneGeometry(40, 40, 1, 1),
    };
    const rayMat = new THREE.ShaderMaterial({vertexShader: RAY_VERT, fragmentShader: RAY_FRAG, uniforms: {uT: {value: 0}, uReveal: {value: 0}, uCol: {value: new THREE.Color(rayColor)}},
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false});
    // 光线略高于切面（切面法线方向抬 0.25 mm）；默认水平切面 → y = 0.25
    const rays_ = rays > 0 ? rayGeos(Math.round(rays), 0.25) : [];
    return {mats, geos, rayMat, rays: rays_, cutN};
  }, [S, cutNormal[0], cutNormal[1], cutNormal[2], pupil, irisColor, rays, rayColor]);

  // 切面推进
  const R0 = R_SCL + 1.5 + NERVE_LEN;     // 起点在整个模型外面（含视神经）
  const k = cutAt < 0 ? 0 : ease((t - cutAt) / Math.max(cutDuration, 0.01));
  const cutD = cutAt < 0 ? 99 : R0 + (cutDepth - R0) * k;
  // 内部亮度：切面进入眼球（离球心 < 巩膜半径）后随切开深度变亮
  const open = cutAt < 0 ? 0 : Math.min(1, Math.max(0, (R_SCL - cutD) / 4));
  for (const m of Object.values(res.mats)) { m.uniforms.uCutD.value = cutD; m.uniforms.uOpen.value = open; }
  res.rayMat.uniforms.uT.value = t;
  res.rayMat.uniforms.uReveal.value = rays > 0 ? Math.min(1, Math.max(0, (t - raysAt) / 2.2)) : 0;

  // 剖面盖板：放在切面上、朝向 +cutN（被切掉的一侧，镜头一般从这边看）
  const capQ = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), res.cutN), [res.cutN]);
  const capPos = res.cutN.clone().multiplyScalar(cutD);
  // 着色器按几何的局部坐标（vL = position）判断各结构，所以把切面位置 / 朝向直接烘焙进盖板顶点
  const capGeo = useMemo(() => res.geos.cap.clone(), [res.geos.cap]);
  {
    const src = res.geos.cap.attributes.position;
    const dst = capGeo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < src.count; i++) {
      v.fromBufferAttribute(src, i).applyQuaternion(capQ).add(capPos);
      dst.setXYZ(i, v.x, v.y, v.z);
    }
    dst.needsUpdate = true;
    capGeo.computeBoundingSphere();
    const nrm = capGeo.attributes.normal;
    for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, res.cutN.x, res.cutN.y, res.cutN.z);
    nrm.needsUpdate = true;
  }
  const showCap = cutAt >= 0 && cutD < R_SCL + NERVE_LEN;

  const {mats, geos} = res;
  return (
    <group position={position} scale={scale} rotation={[rad(-pitch), rad(yaw), 0]}>
      <mesh geometry={geos.sclera} material={mats.sclera} />
      <mesh geometry={geos.choroid} material={mats.choroid} />
      <mesh geometry={geos.retina} material={mats.retina} />
      <mesh geometry={geos.vessel} material={mats.vessel} />
      <mesh geometry={geos.ciliary} material={mats.ciliary} />
      <mesh geometry={geos.iris} material={mats.iris} />
      <mesh geometry={geos.nerve} material={mats.nerve} />
      {showCap && <mesh geometry={capGeo} material={mats.cap} frustumCulled={false} />}
      <mesh geometry={geos.lens} material={mats.lens} renderOrder={2} />
      <mesh geometry={geos.cornea} material={mats.cornea} renderOrder={3} />
      {res.rays.map((g, i) => (
        <mesh key={i} geometry={g} material={res.rayMat} renderOrder={5} frustumCulled={false} />
      ))}
    </group>
  );
};
