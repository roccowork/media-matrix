// 资产 cosmos.galaxynet.v1：醒来的银河（《一百年后》第 11 镜「银河，开始醒来」；第 12 镜里向中心汇聚）。
// 星系盘面上几百到上千个「恒星节点」（沿对数螺旋旋臂分布，旋臂公式与 cosmos.galaxy.v1 相同，同一个 galaxySeed 时落在同一组旋臂上），
// 每个节点连向盘面上最近的几个邻居（发光带，略微拱离盘面），另有少量跨旋臂的长「轴突」高高拱起；
// 从银心向外一道唤醒波前扫过：节点闪亮、连线从先亮的一端长向另一端；之后一波波「呼吸」光环向外扩散，
// 扫过处整片网络变亮，电信号光点沿连线奔跑。collapseAt 之后节点按半径先外后内、打着旋被吸向中心并淡出（第 12 镜接眼睛）。
// 画法：发光带（physics/common/ribbon）+ 节点点精灵，每帧在 CPU 上按时间重建（同帧确定，随机数全部来自 random(seed)）。
import React, {useMemo, useRef} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Vec3} from '../../../engine/shot';
import {buildRibbonGeometry, RIBBON_GLOW_GLSL, RIBBON_VERT, type Seg, type V3} from '../../physics/common/ribbon';

export type GalaxyNetProps = {
  position?: Vec3;
  radius?: number; // 星系半径（与 cosmos.galaxy.v1 一致）
  tilt?: number; // 盘面倾角（度，绕 X 轴，与 cosmos.galaxy.v1 一致）
  arms?: number;
  twist?: number;
  galaxySeed?: string | number; // 填 cosmos.galaxy.v1 的 seed，节点就落在它的旋臂上
  nodes?: number;
  links?: number;
  axons?: number; // 跨旋臂长连线条数
  wakeAt?: number; // 唤醒波前从银心出发（秒）
  wakeDuration?: number; // 波前扫到外缘用时（秒）
  breathEvery?: number; // 呼吸光环间隔（秒）
  breathSpeed?: number; // 呼吸光环向外速度（星系半径 / 秒）
  collapseAt?: number; // 开始向中心汇聚（秒）；-1 = 不汇聚
  collapseDuration?: number;
  swirl?: number; // 汇聚时打旋（弧度）
  timeOffset?: number; // 时间偏移（秒）：接上一镜时填上一镜时长，信号节奏无缝衔接；以上时刻都按「本镜时间 + timeOffset」算
  color?: string;
  pulseColor?: string;
  width?: number;
  brightness?: number;
  seed?: string | number;
};

const FRAG = /* glsl */ `
uniform vec3 uCol; uniform vec3 uPulse; uniform float uBright;
varying float vSide; varying float vBr; varying float vT; varying float vLine; varying float vPxA;
${RIBBON_GLOW_GLSL}
void main() {
  // vBr：整数部分 = 亮度 ×100（>100 部分发白），小数部分 = 光点位置；vT > 生长进度（vLine）的部分不画
  if (vT > vLine) discard;
  float a = floor(vBr) / 100.0;
  float pp = fract(vBr);
  float d = vT - pp;
  float pulse = exp(-d * d * 900.0);
  float flash = clamp(a - 1.0, 0.0, 2.0);
  a = min(a, 1.0);
  float tip = vLine < 0.999 ? exp(-pow((vT - vLine) * 25.0, 2.0)) : 0.0;  // 正在生长的线头发白
  vec3 c = ribbonGlow(vSide, uCol, 0.22) * 0.34 * a + ribbonGlow(vSide, uPulse, 0.4) * pulse * 1.3 * a + ribbonGlow(vSide, vec3(1.0), 0.5) * (flash * 0.8 + tip * 1.2);
  gl_FragColor = vec4(c * uBright * vPxA, 1.0);
}`;

const NODE_VERT = /* glsl */ `
attribute float aBr; uniform float uViewH; uniform float uSize;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float px = uSize * projectionMatrix[1][1] * 0.5 * uViewH / max(-mv.z, 1e-3);
  float a = aBr;
  if (px < 2.0) { a *= px / 2.0; px = 2.0; }
  px = min(px, 48.0);
  vA = a;
  gl_PointSize = px;
  gl_Position = projectionMatrix * mv;
}`;
const NODE_FRAG = /* glsl */ `
uniform vec3 uCol; uniform vec3 uPulse; uniform float uBright; varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5; float d2 = dot(c, c);
  float core = exp(-d2 * 90.0); float halo = exp(-d2 * 16.0) * 0.35;
  float flash = clamp(vA - 1.0, 0.0, 2.0);
  vec3 col = mix(uPulse, vec3(1.0), 0.6) * core * min(vA, 1.0) * 1.3 + uCol * halo * min(vA, 1.0) + vec3(1.0) * core * flash;
  gl_FragColor = vec4(col * uBright, 1.0);
}`;

const smooth = (x: number) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };
const fract = (x: number) => x - Math.floor(x);
const RMIN = 0.07;

export const GalaxyNetAsset: React.FC<GalaxyNetProps> = ({
  position = [0, 0, 0], radius = 10, tilt = 0, arms = 2, twist = 2.2, galaxySeed = 'galaxy', nodes = 900, links = 3, axons = 40,
  wakeAt = 0.3, wakeDuration = 2.4, breathEvery = 1.3, breathSpeed = 0.55, collapseAt = -1, collapseDuration = 3, swirl = 1.6, timeOffset = 0,
  color = '#58c8ff', pulseColor = '#fff0c8', width = 0.06, brightness = 1, seed = 'galaxynet',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {size, gl} = useThree();
  const t = frame / fps + timeOffset;
  const S = String(seed);
  const nArms = Math.max(1, Math.min(6, Math.round(arms)));
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: RIBBON_VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {uCap: {value: 0}, uWidth: {value: width}, uViewH: {value: 1080}, uCol: {value: new THREE.Color(color)}, uPulse: {value: new THREE.Color(pulseColor)}, uBright: {value: brightness}},
  }), [width, color, pulseColor, brightness]);
  const nodeMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: NODE_VERT, fragmentShader: NODE_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: {uViewH: {value: 1080}, uSize: {value: width * 9}, uCol: {value: new THREE.Color(color)}, uPulse: {value: new THREE.Color(pulseColor)}, uBright: {value: brightness}},
  }), [width, color, pulseColor, brightness]);

  // 节点（归一化盘面坐标 r, th）和边：只算一次
  const net = useMemo(() => {
    // 与 cosmos.galaxy.v1 相同的旋臂公式
    const gSeed = Math.floor(random(`galaxy-${galaxySeed}`) * 1e6);
    const rot = random(`galaxy-rot-${galaxySeed}`) * Math.PI * 2;
    const armAngle = (k: number, r: number) => {
      const h = fract(Math.sin((k + 1) * 12.9898 + gSeed * 0.001) * 43758.5453);
      const wob = 0.16 * Math.sin(r * (5 + 4 * h) + h * 6.28) + 0.07 * Math.sin(r * 17 + h * 40);
      return rot + (k * Math.PI * 2) / nArms + twist * Math.log(Math.max(r, RMIN) / RMIN) + wob;
    };
    const gauss = (key: string) => Math.sqrt(-2 * Math.log(Math.max(random(`${key}a`), 1e-6))) * Math.cos(2 * Math.PI * random(`${key}b`));
    const R: number[] = [], TH: number[] = [], XY: [number, number][] = [], B: number[] = [];
    for (let i = 0; i < nodes; i++) {
      let r: number, th: number;
      if (i < nodes * 0.08) {
        r = 0.03 + 0.12 * Math.sqrt(random(`${S}br${i}`));
        th = random(`${S}bt${i}`) * Math.PI * 2;
      } else {
        r = 0.12 + 0.8 * Math.pow(random(`${S}r${i}`), 0.85);
        const k = Math.floor(random(`${S}k${i}`) * nArms);
        const onArm = random(`${S}oa${i}`) < 0.9;
        th = onArm ? armAngle(k, r) + gauss(`${S}g${i}`) * Math.min(0.28, Math.max(0.08, 0.04 / r)) : random(`${S}th${i}`) * Math.PI * 2;
      }
      R.push(r); TH.push(th); XY.push([Math.cos(th) * r, Math.sin(th) * r]);
      B.push(0.55 + 0.45 * random(`${S}nb${i}`));
    }
    const E: {a: number; b: number; axon: boolean}[] = [];
    const seen = new Set<string>();
    const d2 = (i: number, k: number) => (XY[i][0] - XY[k][0]) ** 2 + (XY[i][1] - XY[k][1]) ** 2;
    for (let i = 0; i < nodes; i++) {
      const order = XY.map((_, k) => [k === i ? 1e9 : d2(i, k), k] as [number, number]).sort((a, b) => a[0] - b[0]);
      const kk = links + (random(`${S}lk${i}`) > 0.7 ? 1 : 0);
      for (let m = 0; m < kk; m++) {
        const [dd, k] = order[m];
        if (Math.sqrt(dd) > 0.16) break;
        const key = i < k ? `${i}-${k}` : `${k}-${i}`;
        if (!seen.has(key)) { seen.add(key); E.push({a: i, b: k, axon: false}); }
      }
    }
    for (let j = 0; j < axons; j++) {
      const a = Math.floor(random(`${S}xa${j}`) * nodes);
      let best = -1, bd = 0;
      for (let q = 0; q < 12; q++) {
        const b = Math.floor(random(`${S}xb${j}-${q}`) * nodes);
        const dd = Math.sqrt(d2(a, b));
        if (dd > 0.2 && dd < 0.6 && dd > bd) { bd = dd; best = b; }
      }
      if (best >= 0) E.push({a, b: best, axon: true});
    }
    return {R, TH, B, E};
  }, [nodes, links, axons, nArms, twist, galaxySeed, S]);

  // 每个节点当前状态
  const N = net.R.length;
  const pos: V3[] = new Array(N);
  const lit: number[] = new Array(N); // 被唤醒的时刻
  const vis: number[] = new Array(N); // 汇聚时的淡出
  const rNow: number[] = new Array(N);
  for (let i = 0; i < N; i++) {
    const r0 = net.R[i];
    lit[i] = wakeAt + Math.pow(r0, 0.8) * wakeDuration + random(`${S}lj${i}`) * 0.15;
    let r = r0, th = net.TH[i], v = 1, y = 0;
    if (collapseAt >= 0) {
      const st = collapseAt + (1 - r0) * 0.4 * collapseDuration + random(`${S}cj${i}`) * 0.1 * collapseDuration;
      const p = smooth((t - st) / (0.6 * collapseDuration));
      const e = p * p;
      r = r0 * (1 - e);
      th += e * swirl * (0.6 + 0.4 / (r0 + 0.3));
      y = Math.sin(p * Math.PI) * 0.04 * (random(`${S}cy${i}`) - 0.5);
      v = 1 - smooth((p - 0.75) / 0.25);
    }
    rNow[i] = r;
    vis[i] = v;
    pos[i] = [Math.cos(th) * r * radius, y * radius, Math.sin(th) * r * radius];
  }
  // 呼吸光环：从银心一波波向外扩散，扫过处变亮
  const breath = (r: number) => {
    if (breathEvery <= 0) return 0;
    let s = 0;
    const t0 = wakeAt + wakeDuration * 0.6;
    for (let w = 0; w < 8; w++) {
      const tw = t0 + w * breathEvery;
      if (tw > t) break;
      const rf = (t - tw) * breathSpeed;
      s += Math.exp(-(((r - rf) / 0.07) ** 2)) * Math.max(0, 1 - rf / 1.3);
    }
    return s;
  };

  const segs: Seg[] = [];
  const grow: number[] = [];
  const NS = 6;
  net.E.forEach((e, ei) => {
    const first = lit[e.a] <= lit[e.b] ? e.a : e.b;
    const second = first === e.a ? e.b : e.a;
    const t0 = lit[first];
    if (t < t0) return;
    const v = Math.min(vis[first], vis[second]);
    if (v <= 0.001) return;
    const A = pos[first], Bp = pos[second];
    const L = Math.hypot(A[0] - Bp[0], A[1] - Bp[1], A[2] - Bp[2]);
    const g = Math.min(1, (t - t0) / ((e.axon ? 0.7 : 0.3) * (0.7 + 0.6 * random(`${S}eg${ei}`))));
    const since = t - t0;
    const flash = Math.max(0, 1 - since / 0.4) * 0.8;
    const rm = (rNow[first] + rNow[second]) / 2;
    const base = (e.axon ? 0.75 : 0.45 + 0.4 * random(`${S}eb${ei}`)) * (0.75 + 0.25 * (1 - rm));
    const alpha = Math.min(1, since / 0.3) * Math.min(1, base * (1 + 1.4 * breath(rm))) * v;
    const per = (e.axon ? 0.9 : 0.7) + 1.2 * random(`${S}ep${ei}`);
    const ph = fract((Math.max(0, since - 0.3) + random(`${S}eo${ei}`) * per) / per);
    const pulse = since < 0.3 ? 0.999 : random(`${S}ed${ei}`) > 0.5 ? ph : 1 - ph;
    const br = Math.round((alpha + flash * v) * 100) + Math.min(0.999, pulse);
    const arch = (e.axon ? 0.14 : 0.015) * L;
    let prev: V3 | null = null;
    const ns = e.axon ? 14 : NS;
    for (let j = 0; j <= ns; j++) {
      const s = j / ns;
      const p: V3 = [A[0] + (Bp[0] - A[0]) * s, A[1] + (Bp[1] - A[1]) * s + Math.sin(s * Math.PI) * arch, A[2] + (Bp[2] - A[2]) * s];
      if (prev) { segs.push({a: prev, b: p, w: e.axon ? 1.3 : 1, br, t0: (j - 1) / ns, t1: s}); grow.push(g); }
      prev = p;
    }
  });

  // 呼吸光环本身：盘面上一圈淡淡的扩散光环
  if (breathEvery > 0) {
    const t0 = wakeAt + wakeDuration * 0.6;
    for (let w = 0; w < 8; w++) {
      const tw = t0 + w * breathEvery;
      if (tw > t) break;
      const rf = (t - tw) * breathSpeed;
      const fade = Math.min(1, rf / 0.15) * Math.max(0, 1 - rf / 1.2) * (collapseAt >= 0 ? 1 - smooth((t - collapseAt) / 0.8) : 1);
      if (fade <= 0.01 || rf <= 0) continue;
      const br = Math.round(fade * 30) + 0.999;
      const RN = 160;
      let prev: V3 | null = null;
      for (let j = 0; j <= RN; j++) {
        const a = (j / RN) * Math.PI * 2;
        const p: V3 = [Math.cos(a) * rf * radius, 0, Math.sin(a) * rf * radius];
        if (prev) { segs.push({a: prev, b: p, w: 2.2, br, t0: 0, t1: 0}); grow.push(1); }
        prev = p;
      }
    }
  }

  // 节点点精灵
  const nodePos = new Float32Array(N * 3);
  const nodeBr = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    nodePos.set(pos[i], i * 3);
    if (t < lit[i]) { nodeBr[i] = 0; continue; }
    const since = t - lit[i];
    const flash = Math.max(0, 1 - since / 0.35) * 1.5;
    const tw = 0.75 + 0.25 * Math.sin(t * (2 + 3 * random(`${S}nt${i}`)) + i);
    nodeBr[i] = (Math.min(1, since / 0.15) * net.B[i] * tw * (0.7 + 0.8 * breath(rNow[i])) + flash) * vis[i];
  }

  const geoRef = useRef<THREE.BufferGeometry | null>(null);
  if (geoRef.current) geoRef.current.dispose();
  const geo = segs.length ? buildRibbonGeometry(segs, (i) => grow[i]) : null;
  geoRef.current = geo;
  const nodeGeoRef = useRef<THREE.BufferGeometry | null>(null);
  if (nodeGeoRef.current) nodeGeoRef.current.dispose();
  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3));
  nodeGeo.setAttribute('aBr', new THREE.BufferAttribute(nodeBr, 1));
  nodeGeoRef.current = nodeGeo;
  const viewH = size.height * gl.getPixelRatio();
  mat.uniforms.uViewH.value = viewH;
  nodeMat.uniforms.uViewH.value = viewH;
  return (
    <group position={position} rotation={[(tilt * Math.PI) / 180, 0, 0]}>
      {geo ? <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={9} /> : null}
      <points geometry={nodeGeo} material={nodeMat} frustumCulled={false} renderOrder={10} />
    </group>
  );
};
