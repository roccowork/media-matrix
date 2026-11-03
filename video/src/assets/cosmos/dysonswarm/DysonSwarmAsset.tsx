// 资产 cosmos.dysonswarm.v1：戴森云（《一百年后》第 8 镜「太阳，被它亲手包裹」、第 9 镜「整个太阳系，变成一个大脑」）。
// 采光板（GPU 实例化，默认 8 万块）分属几十条倾斜轨道带：每条轨道按顺序「展开」——一颗亮点沿轨道跑一圈，
// 身后的采光板一块块翻开铺成细线，再横向变宽成一条带；几十条带交叠，逐渐把恒星包住，没盖严的缝里漏出阳光。
// 采光板朝恒星一面是被照亮的光伏面（镜面高光），朝外一面是暗金属背板（边缘被身后的阳光勾亮，随机反光闪烁）。
// 第 9 镜：neuralAt 起，球面上流过一道道脑电波似的光纹（多个源头周期性发出波前，沿「神经纹路」更亮，交汇处闪白）；
// outerRings > 0 时，外面再画几圈更大的轨道光环，每圈上一颗行星（光点），行星和球面之间连着带脉冲的光纤。
// 时间 = 帧时间 + timeOffset（下一镜接着上一镜的状态时用）；全部在着色器里按时间和种子算，确定性。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import {NOISE_GLSL} from '../../../engine/shaders/noise.glsl';
import type {Vec3} from '../../../engine/shot';

export type DysonSwarmProps = {
  position?: Vec3; // 恒星中心
  radius?: number; // 恒星半径
  shellRadius?: number; // 采光板球壳半径（相对恒星半径）
  count?: number; // 采光板块数
  rings?: number; // 轨道带条数
  bandWidth?: number; // 每条带的半宽（度）
  panelSize?: number; // 采光板边长（相对球壳半径）
  deployAt?: number; // 第一条轨道开始展开（秒）
  deployDuration?: number; // 最后一条轨道开始展开的时刻 - 第一条（秒）
  ringOpen?: number; // 一条轨道从展开到合拢一圈用时（秒）
  orbitSpeed?: number; // 轨道转速（度 / 秒）
  panelColor?: string; // 光伏面颜色
  backColor?: string; // 背板颜色
  glintColor?: string; // 反光 / 漏光颜色
  glint?: number; // 反光闪烁强度
  neuralAt?: number; // 脑电波光纹开始（秒）；-1 = 关闭
  neuralColor?: string;
  neuralSpeed?: number; // 波前速度（度 / 秒）
  outerRings?: number; // 外圈轨道光环数（每圈一颗行星），0 = 不画
  outerAt?: number; // 外圈光环开始出现（秒）
  outerColor?: string;
  timeOffset?: number; // 时间偏移（秒）
  brightness?: number;
  seed?: string | number;
};

const MAX_SRC = 14;
const MAX_OUT = 8;

const NEURAL_GLSL = /* glsl */ `
uniform float uNeural; uniform float uNT; uniform vec3 uNCol; uniform float uNSpeed;
uniform vec3 uSrc[${MAX_SRC}]; uniform vec2 uSrcT[${MAX_SRC}];
// 球面上一点的脑电波光纹亮度（0 = 无），w.x = 波前，w.y = 神经纹路
vec2 neural(vec3 d) {
  if (uNeural <= 0.0) return vec2(0.0);
  float veins = 1.0 - smoothstep(0.0, 0.06, abs(snoise(d * 2.6 + uSeed)));
  float veins2 = 1.0 - smoothstep(0.0, 0.05, abs(snoise(d * 6.5 - uSeed * 0.7)));
  float v = max(veins, veins2 * 0.6);
  float w = 0.0, w2 = 0.0;
  for (int i = 0; i < ${MAX_SRC}; i++) {
    float P = uSrcT[i].x; float t = uNT - uSrcT[i].y;
    if (t < 0.0) continue;
    float age = mod(t, P);
    float ang = acos(clamp(dot(d, uSrc[i]), -1.0, 1.0));
    float front = age * uNSpeed;
    float x = (ang - front) / 0.07;
    float ring = exp(-x * x) * exp(-age * 0.45) + exp(-ang * ang * 40.0) * exp(-age * 3.0) * 1.5;
    w2 += ring * w;   // 两道波交汇
    w += ring;
  }
  return vec2((w * (0.3 + 1.6 * v) + w2 * 2.0) * uNeural, v * uNeural);
}`;

const PANEL_VERT = /* glsl */ `
attribute vec3 aU; attribute vec3 aW; attribute vec4 aP; attribute vec4 aQ;
// aP: x 沿轨道相位(0–1), y 横向偏移(-1–1), z 该轨道展开顺序(0–1), w 轨道初始角
// aQ: x 半径抖动, y 轨道角速度(弧度/秒), z 摆动相位, w 随机
uniform float uTime; uniform float uShellR; uniform float uSize; uniform float uSinW; uniform float uOpen; uniform float uDeployAt; uniform float uDur;
varying vec2 vUv; varying vec3 vWorld; varying vec3 vNrm; varying vec3 vDir; varying float vHead; varying float vRnd;
void main() {
  float t0 = uDeployAt + aP.z * uDur;          // 这条轨道开始展开的时刻
  float pk = clamp((uTime - t0) / uOpen, 0.0, 1.0);
  float age = pk - aP.x;                       // >0 已经展开
  float sc = smoothstep(0.0, 0.025, age);
  vHead = (pk < 1.0 && age > 0.0) ? exp(-age * 45.0) : 0.0;
  float a = aP.w + uTime * aQ.y - aP.x * 6.2831853;
  vec3 N = normalize(cross(aU, aW));
  float widen = smoothstep(0.0, 1.6, uTime - (t0 + aP.x * uOpen));
  float lat = aP.y * uSinW * (0.12 + 0.88 * widen);
  vec3 d = normalize(cos(a) * aU + sin(a) * aW + N * lat);
  vec3 T = normalize(-sin(a) * aU + cos(a) * aW);
  vec3 B = normalize(cross(d, T)); T = cross(B, d);
  // 采光板轻微摆动（反光闪烁）
  float wob = 0.22 * sin(uTime * (0.6 + aQ.w) + aQ.z);
  vec3 n = normalize(d + T * wob + B * 0.15 * cos(uTime * 0.7 + aQ.z * 2.0));
  vec3 t2 = normalize(T - n * dot(T, n)); vec3 b2 = cross(n, t2);
  vec3 c = d * uShellR * (1.0 + aQ.x * 0.018);
  vec3 p = c + (t2 * position.x * 1.5 + b2 * position.y) * uSize * sc;
  vUv = uv; vDir = d; vRnd = aQ.w;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorld = wp.xyz; vNrm = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * wp;
  if (sc <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
const PANEL_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uSeed; uniform vec3 uCenter; uniform float uSunR;
uniform vec3 uCell; uniform vec3 uBack; uniform vec3 uGlint; uniform float uGlintK; uniform float uBright;
varying vec2 vUv; varying vec3 vWorld; varying vec3 vNrm; varying vec3 vDir; varying float vHead; varying float vRnd;
${NOISE_GLSL}
${NEURAL_GLSL}
void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = normalize(uCenter - vWorld);
  vec2 e = min(vUv, 1.0 - vUv);
  float border = 1.0 - smoothstep(0.0, 0.07, min(e.x, e.y));
  vec3 col;
  if (!gl_FrontFacing) {
    // 朝恒星的光伏面：深蓝电池格 + 恒星照亮 + 镜面高光
    vec3 n = -vNrm;
    vec2 g = abs(fract(vUv * vec2(6.0, 4.0)) - 0.5);
    float grid = smoothstep(0.44, 0.5, max(g.x, g.y));
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(n, H), 0.0), 60.0);
    col = uCell * (0.55 + 0.6 * max(dot(n, L), 0.0)) * (1.0 - 0.5 * grid) + uGlint * (spec * 6.0 + border * 0.6);
  } else {
    // 朝外的背板：暗金属；身后有恒星时边缘被漏出的阳光勾亮
    vec3 toC = normalize(uCenter - cameraPosition);
    float ang = acos(clamp(dot(-V, toC), -1.0, 1.0));
    float sunAng = asin(clamp(uSunR / length(uCenter - cameraPosition), 0.0, 1.0));
    float behind = smoothstep(sunAng * 1.6, sunAng * 0.7, ang);
    float fres = pow(1.0 - abs(dot(vNrm, V)), 4.0);
    float ribs = smoothstep(0.46, 0.5, abs(fract(vUv.x * 3.0) - 0.5));
    col = uBack * (0.35 + 0.25 * ribs) + uGlint * (border * (0.12 + 1.3 * behind) + fres * (0.25 + 0.9 * behind));
    // 随机反光闪烁（摆动的板子把阳光反射向镜头）
    float fl = pow(max(sin(uTime * (1.2 + 2.5 * vRnd) + vRnd * 91.0), 0.0), 90.0) * step(0.55, fract(vRnd * 37.0));
    col += uGlint * fl * 7.0 * uGlintK;
  }
  col += uGlint * vHead * 9.0;                 // 正在展开的轨道最前端：一颗亮点
  vec2 nr = neural(vDir);
  col = col * (1.0 - 0.6 * clamp(nr.y, 0.0, 1.0) * step(0.001, uNeural)) + uNCol * (nr.x * 2.2 + nr.y * 0.18) + vec3(1.0) * pow(max(nr.x - 1.2, 0.0), 2.0) * 0.6;
  gl_FragColor = vec4(col * uBright, 1.0);
}`;

// 外圈：轨道光环（点）+ 行星和球面之间的光纤（点）
const OUT_VERT = /* glsl */ `
attribute vec4 aO; // x 类别(0 环, 1 光纤), y 第几圈, z 沿线位置 0–1, w 随机
uniform float uTime; uniform float uShellR; uniform vec3 uPl[${MAX_OUT}]; uniform vec3 uRU[${MAX_OUT}]; uniform vec3 uRW[${MAX_OUT}]; uniform float uRR[${MAX_OUT}];
uniform float uOutOn; uniform float uPix;
varying float vA; varying float vPulse;
void main() {
  int i = int(aO.y + 0.5);
  float reveal = clamp(uOutOn * 1.6 - aO.y * 0.12, 0.0, 1.0);
  vec3 p; float s = aO.z;
  if (aO.x < 0.5) {
    float a = s * 6.2831853;
    p = (cos(a) * uRU[i] + sin(a) * uRW[i]) * uRR[i];
    // 沿环流动的光脉冲
    vPulse = pow(0.5 + 0.5 * sin(s * 6.2831853 * 3.0 - uTime * 1.3 + aO.y * 2.0), 24.0);
    vA = (0.35 + 0.15 * aO.w) * step(abs(fract(s - aO.y * 0.37) - 0.5) * 2.0, reveal);
  } else {
    vec3 pl = uPl[i];
    vec3 a0 = normalize(pl) * uShellR * 1.02;
    vec3 side = normalize(cross(pl, vec3(0.0, 1.0, 0.0)));
    vec3 c1 = mix(a0, pl, 0.35) + side * length(pl) * 0.12;
    vec3 c2 = mix(a0, pl, 0.7) - side * length(pl) * 0.06;
    float is = 1.0 - s;
    p = is * is * is * a0 + 3.0 * is * is * s * c1 + 3.0 * is * s * s * c2 + s * s * s * pl;
    vPulse = pow(0.5 + 0.5 * sin(s * 18.0 + uTime * 3.0 + aO.y), 16.0);
    vA = 0.28 * step(s, reveal * 1.2 - 0.1);
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uPix * (1.0 + 1.5 * vPulse) / -mv.z;
  gl_Position = projectionMatrix * mv;
  vA *= uOutOn;
}`;
const OUT_FRAG = /* glsl */ `
uniform vec3 uCol; varying float vA; varying float vPulse;
void main() { float r = length(gl_PointCoord - 0.5); float k = smoothstep(0.5, 0.0, r); gl_FragColor = vec4((uCol * (1.0 + 3.0 * vPulse) + vec3(vPulse)) * vA * k, 1.0); }`;
const PL_VERT = /* glsl */ `
uniform vec3 uPl[${MAX_OUT}]; uniform float uOutOn; uniform float uPix; attribute float aI; varying float vA; varying vec3 vC;
void main() {
  int i = int(aI + 0.5);
  vec4 mv = modelViewMatrix * vec4(uPl[i], 1.0);
  gl_PointSize = uPix / -mv.z;
  vA = clamp(uOutOn * 1.6 - aI * 0.12, 0.0, 1.0);
  vC = mix(vec3(1.0, 0.85, 0.6), vec3(0.6, 0.9, 1.0), fract(aI * 0.618));
  gl_Position = projectionMatrix * mv;
}`;
const PL_FRAG = /* glsl */ `
varying float vA; varying vec3 vC;
void main() { float r = length(gl_PointCoord - 0.5); float k = exp(-r * r * 90.0) * 3.0 + exp(-r * r * 14.0) * 0.5; if (r > 0.5) discard; gl_FragColor = vec4(vC * k * vA, 1.0); }`;

const toVec = (seed: string | number) => {
  const n = typeof seed === 'number' ? seed : [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 100003, 7);
  return new THREE.Vector3(((n * 0.6180339) % 1) * 30, ((n * 0.4142135) % 1) * 30, ((n * 0.7320508) % 1) * 30);
};
const RING_PTS = 5000;
const LINK_PTS = 1400;

export const DysonSwarmAsset: React.FC<DysonSwarmProps> = ({
  position = [0, 0, 0], radius = 5, shellRadius = 1.5, count = 80000, rings = 40, bandWidth = 9, panelSize = 0.016,
  deployAt = 0.3, deployDuration = 3, ringOpen = 1.2, orbitSpeed = 4, panelColor = '#24407a', backColor = '#1a1d24', glintColor = '#ffd59a', glint = 1,
  neuralAt = -1, neuralColor = '#8be9ff', neuralSpeed = 40, outerRings = 0, outerAt = 0, outerColor = '#9fdcff', timeOffset = 0, brightness = 1, seed = 'dysonswarm',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps + timeOffset;
  const S = String(seed);
  const shellR = radius * shellRadius;
  const nOut = Math.max(0, Math.min(MAX_OUT, Math.round(outerRings)));
  const res = useMemo(() => {
    const nR = Math.max(1, Math.round(rings));
    // 轨道法线：半球上的斐波那契分布 + 抖动（覆盖均匀），按倾角从小到大排序 → 先赤道、后极区，逐渐合拢
    const normals = Array.from({length: nR}, (_, k) => {
      const z = 1 - (k + 0.5) / nR; // 0–1 半球
      const phi = k * 2.399963 + random(`${S}nphi${k}`) * 0.6;
      const r = Math.sqrt(1 - z * z);
      return new THREE.Vector3(Math.cos(phi) * r, z + (random(`${S}nz${k}`) - 0.5) * 0.08, Math.sin(phi) * r).normalize();
    }).sort((a, b) => b.y - a.y);
    const ringData = normals.map((n, k) => {
      const ref = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const u = new THREE.Vector3().crossVectors(ref, n).normalize();
      const w = new THREE.Vector3().crossVectors(n, u);
      const order = nR > 1 ? k / (nR - 1) : 0;
      const dir = random(`${S}rd${k}`) < 0.5 ? -1 : 1;
      return {u, w, order, a0: random(`${S}ra${k}`) * Math.PI * 2, om: dir * (0.7 + 0.6 * random(`${S}ro${k}`))};
    });
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute('position', base.getAttribute('position'));
    g.setAttribute('uv', base.getAttribute('uv'));
    const aU = new Float32Array(count * 3), aW = new Float32Array(count * 3), aP = new Float32Array(count * 4), aQ = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const k = Math.floor(random(`${S}pk${i}`) * nR);
      const r = ringData[k];
      aU.set([r.u.x, r.u.y, r.u.z], i * 3);
      aW.set([r.w.x, r.w.y, r.w.z], i * 3);
      const lat = (random(`${S}pl${i}`) + random(`${S}pl2${i}`) - 1); // 中间密、两边稀
      aP.set([random(`${S}pp${i}`), lat, r.order, r.a0], i * 4);
      aQ.set([random(`${S}pj${i}`) * 2 - 1, r.om * ((orbitSpeed * Math.PI) / 180), random(`${S}pw${i}`) * 6.283, random(`${S}pr${i}`)], i * 4);
    }
    g.setAttribute('aU', new THREE.InstancedBufferAttribute(aU, 3));
    g.setAttribute('aW', new THREE.InstancedBufferAttribute(aW, 3));
    g.setAttribute('aP', new THREE.InstancedBufferAttribute(aP, 4));
    g.setAttribute('aQ', new THREE.InstancedBufferAttribute(aQ, 4));
    g.instanceCount = count;
    const sv = toVec(seed);
    const src = Array.from({length: MAX_SRC}, (_, i) => new THREE.Vector3(random(`${S}sx${i}`) - 0.5, random(`${S}sy${i}`) - 0.5, random(`${S}sz${i}`) - 0.5).normalize());
    const srcT = Array.from({length: MAX_SRC}, (_, i) => new THREE.Vector2(2.2 + random(`${S}sp${i}`) * 2.5, (i / MAX_SRC) * 2.4 + random(`${S}so${i}`) * 0.5));
    const panel = new THREE.ShaderMaterial({vertexShader: PANEL_VERT, fragmentShader: PANEL_FRAG, side: THREE.DoubleSide, toneMapped: true,
      uniforms: {uTime: {value: 0}, uShellR: {value: shellR}, uSize: {value: panelSize * shellR}, uSinW: {value: Math.sin((bandWidth * Math.PI) / 180)}, uOpen: {value: ringOpen}, uDeployAt: {value: deployAt}, uDur: {value: deployDuration},
        uSeed: {value: sv}, uCenter: {value: new THREE.Vector3(...position)}, uSunR: {value: radius},
        uCell: {value: new THREE.Color(panelColor)}, uBack: {value: new THREE.Color(backColor)}, uGlint: {value: new THREE.Color(glintColor)}, uGlintK: {value: glint}, uBright: {value: brightness},
        uNeural: {value: 0}, uNT: {value: 0}, uNCol: {value: new THREE.Color(neuralColor)}, uNSpeed: {value: (neuralSpeed * Math.PI) / 180}, uSrc: {value: src}, uSrcT: {value: srcT}}});
    // 外圈轨道：半径按几何级数（像行星轨道越往外越稀），轻微倾斜
    const outRad: number[] = [], outU: THREE.Vector3[] = [], outW: THREE.Vector3[] = [], outPh: number[] = [], outOm: number[] = [];
    for (let i = 0; i < MAX_OUT; i++) {
      const R = shellR * 2.1 * Math.pow(1.5, i) * (0.93 + random(`${S}or${i}`) * 0.14);
      const inc = ((random(`${S}oi${i}`) - 0.5) * 14 * Math.PI) / 180;
      const node = random(`${S}on${i}`) * Math.PI * 2;
      const n = new THREE.Vector3(Math.sin(inc) * Math.cos(node), Math.cos(inc), Math.sin(inc) * Math.sin(node));
      const u = new THREE.Vector3().crossVectors(new THREE.Vector3(1, 0, 0), n).normalize();
      const w = new THREE.Vector3().crossVectors(n, u);
      outRad.push(R); outU.push(u); outW.push(w);
      outPh.push(random(`${S}op${i}`) * Math.PI * 2);
      outOm.push(0.6 * Math.pow(shellR * 2.1 / R, 1.5)); // 开普勒：越外越慢
    }
    const nPts = nOut * (RING_PTS + LINK_PTS);
    const og = new THREE.BufferGeometry();
    const aO = new Float32Array(Math.max(1, nPts) * 4);
    let j = 0;
    for (let i = 0; i < nOut; i++) {
      for (let k = 0; k < RING_PTS; k++, j++) aO.set([0, i, k / RING_PTS, random(`${S}rp${i}_${k}`)], j * 4);
      for (let k = 0; k < LINK_PTS; k++, j++) aO.set([1, i, k / LINK_PTS, 0], j * 4);
    }
    og.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(1, nPts) * 3), 3));
    og.setAttribute('aO', new THREE.BufferAttribute(aO, 4));
    og.setDrawRange(0, nPts);
    const pl = outRad.map(() => new THREE.Vector3());
    const outMat = new THREE.ShaderMaterial({vertexShader: OUT_VERT, fragmentShader: OUT_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {uTime: {value: 0}, uShellR: {value: shellR}, uPl: {value: pl}, uRU: {value: outU}, uRW: {value: outW}, uRR: {value: outRad}, uOutOn: {value: 0}, uPix: {value: shellR * 22}, uCol: {value: new THREE.Color(outerColor).multiplyScalar(brightness)}}});
    const plg = new THREE.BufferGeometry();
    plg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(1, nOut) * 3), 3));
    plg.setAttribute('aI', new THREE.BufferAttribute(new Float32Array(Array.from({length: Math.max(1, nOut)}, (_, i) => i)), 1));
    plg.setDrawRange(0, nOut);
    const plMat = new THREE.ShaderMaterial({vertexShader: PL_VERT, fragmentShader: PL_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {uPl: {value: pl}, uOutOn: {value: 0}, uPix: {value: shellR * 260}}});
    return {g, panel, og, outMat, plg, plMat, outRad, outU, outW, outPh, outOm, pl};
  }, [radius, shellR, count, rings, bandWidth, panelSize, ringOpen, panelColor, backColor, glintColor, glint, neuralColor, neuralSpeed, outerColor, brightness, nOut, S, seed, position[0], position[1], position[2], deployAt, deployDuration, orbitSpeed]);
  const sp = res.panel.uniforms;
  sp.uTime.value = t;
  sp.uNeural.value = neuralAt < 0 ? 0 : Math.max(0, Math.min(1, (t - neuralAt) / 1.2));
  sp.uNT.value = Math.max(0, t - Math.max(0, neuralAt));
  if (nOut > 0) {
    for (let i = 0; i < nOut; i++) {
      const a = res.outPh[i] + t * res.outOm[i] * 0.2;
      res.pl[i].copy(res.outU[i]).multiplyScalar(Math.cos(a) * res.outRad[i]).addScaledVector(res.outW[i], Math.sin(a) * res.outRad[i]);
    }
    const on = Math.max(0, Math.min(1, (t - outerAt) / 2.5));
    res.outMat.uniforms.uOutOn.value = on;
    res.outMat.uniforms.uTime.value = t;
    res.plMat.uniforms.uOutOn.value = on;
  }
  return (
    <group position={position}>
      <mesh geometry={res.g} material={res.panel} frustumCulled={false} />
      {nOut > 0 ? <points geometry={res.og} material={res.outMat} frustumCulled={false} renderOrder={6} /> : null}
      {nOut > 0 ? <points geometry={res.plg} material={res.plMat} frustumCulled={false} renderOrder={7} /> : null}
    </group>
  );
};
