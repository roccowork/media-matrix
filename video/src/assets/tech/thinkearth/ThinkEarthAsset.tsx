// 资产 tech.thinkearth.v1：会思考的地球（《一百年后》第 5 镜「云层变神经网络」）。
// 行星表面上方一层薄壳：几百个「神经元」节点（按种子散在球面），每个节点连向最近的几个邻居，连线是贴着球面、略微拱起的发光弧；
// 一道白色波前从 waveDir 方向向四周扩散（球面上的圆），扫过的地方节点和连线依次亮起，之后电信号光点沿连线来回跑。
// 画法：发光带（physics/common/ribbon），每帧在 CPU 上按时间算每条线的亮度和光点位置后重建（同帧确定）。
import React, {useMemo, useRef} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Vec3} from '../../../engine/shot';
import {buildRibbonGeometry, RIBBON_GLOW_GLSL, RIBBON_VERT, type Seg, type V3} from '../../physics/common/ribbon';

export type ThinkEarthProps = {
  center?: Vec3;
  radius?: number;
  nodes?: number; // 节点数
  links?: number; // 每个节点连几个最近邻
  lift?: number; // 壳高于地表多少（相对半径）
  arch?: number; // 连线拱起高度（相对弦长）
  waveDir?: Vec3; // 波前从球面哪个方向出发
  waveAt?: number; // 波前出发时刻（秒）
  waveDuration?: number; // 扫过半个球用时（秒）
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
  // vBr 打包：整数部分 = 线的亮度 ×100（>100 表示正被波前扫过，额外发白），小数部分 = 光点位置（0–1）
  float a = floor(vBr) / 100.0;
  float pp = fract(vBr);
  float d = vT - pp;
  float pulse = exp(-d * d * 500.0);
  float flash = clamp(a - 1.0, 0.0, 2.0);
  a = min(a, 1.0);
  vec3 c = ribbonGlow(vSide, uCol, 0.22) * 0.38 * a + ribbonGlow(vSide, uPulse, 0.4) * pulse * 1.4 * a + ribbonGlow(vSide, vec3(1.0), 0.5) * flash * 0.9;
  gl_FragColor = vec4(c * uBright * vPxA, 1.0);
}`;

const norm = (v: V3): V3 => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const ThinkEarthAsset: React.FC<ThinkEarthProps> = ({
  center = [0, 0, 0], radius = 5, nodes = 420, links = 3, lift = 0.02, arch = 0.18, waveDir = [0, 0.3, 1], waveAt = 0.6, waveDuration = 3,
  color = '#5fd2ff', pulseColor = '#fff0c8', width = 0.014, brightness = 1, seed = 'thinkearth',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {size, gl} = useThree();
  const t = frame / fps;
  const S = String(seed);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: RIBBON_VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {uCap: {value: 0}, uWidth: {value: width}, uViewH: {value: 1080}, uCol: {value: new THREE.Color(color)}, uPulse: {value: new THREE.Color(pulseColor)}, uBright: {value: brightness}},
  }), [width, color, pulseColor, brightness]);
  // 节点和边（只算一次）：Fibonacci 球面 + 抖动，连最近邻
  const net = useMemo(() => {
    const P: V3[] = [];
    const ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < nodes; i++) {
      const y = 1 - (2 * (i + 0.5)) / nodes;
      const r = Math.sqrt(1 - y * y);
      const th = ga * i;
      const j: V3 = [(random(`${S}jx${i}`) - 0.5) * 0.12, (random(`${S}jy${i}`) - 0.5) * 0.12, (random(`${S}jz${i}`) - 0.5) * 0.12];
      P.push(norm([r * Math.cos(th) + j[0], y + j[1], r * Math.sin(th) + j[2]]));
    }
    const E: [number, number][] = [];
    const seen = new Set<string>();
    for (let i = 0; i < nodes; i++) {
      const d = P.map((q, k) => [k === i ? -2 : dot(P[i], q), k] as [number, number]).sort((a, b) => b[0] - a[0]);
      const kk = links + (random(`${S}lk${i}`) > 0.7 ? 1 : 0);
      for (let m = 0; m < kk; m++) {
        const k = d[m][1];
        const key = i < k ? `${i}-${k}` : `${k}-${i}`;
        if (!seen.has(key)) { seen.add(key); E.push([i, k]); }
      }
    }
    return {P, E};
  }, [nodes, links, S]);
  const W = norm(waveDir as V3);
  const waveAng = t < waveAt ? -1 : ((t - waveAt) / waveDuration) * Math.PI; // 波前已扫到的球面角
  const segs: Seg[] = [];
  const NS = 10;
  const R = radius * (1 + lift);
  net.E.forEach(([i, k], e) => {
    const A = net.P[i], B = net.P[k];
    const mid = norm([A[0] + B[0], A[1] + B[1], A[2] + B[2]]);
    const ang = Math.acos(Math.max(-1, Math.min(1, dot(mid, W))));
    if (waveAng < ang) return;                                    // 波前还没到
    const since = (waveAng - ang) / Math.PI * waveDuration;       // 被扫到后过了几秒
    const flash = Math.max(0, 1 - since / 0.35);                   // 刚被扫到时发白一下
    const alpha = Math.min(1, since / 0.25) * (0.55 + 0.45 * random(`${S}eb${e}`));
    const per = 1.1 + 1.6 * random(`${S}ep${e}`);
    const ph = ((since + random(`${S}eo${e}`) * per) / per) % 1;
    const dir = random(`${S}ed${e}`) > 0.5;
    const pulse = dir ? ph : 1 - ph;
    const br = Math.round((alpha + flash) * 100) + Math.min(0.999, pulse);
    const om = Math.acos(Math.max(-1, Math.min(1, dot(A, B))));
    const chord = Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]) * R;
    let prev: V3 | null = null;
    for (let j = 0; j <= NS; j++) {
      const s = j / NS;
      const w1 = Math.sin((1 - s) * om) / Math.sin(om), w2 = Math.sin(s * om) / Math.sin(om);
      const d = norm([A[0] * w1 + B[0] * w2, A[1] * w1 + B[1] * w2, A[2] * w1 + B[2] * w2]);
      const h = R + Math.sin(s * Math.PI) * chord * arch;
      const p: V3 = [center[0] + d[0] * h, center[1] + d[1] * h, center[2] + d[2] * h];
      if (prev) segs.push({a: prev, b: p, w: 1, br, t0: (j - 1) / NS, t1: s});
      prev = p;
    }
  });
  // 波前：一圈白色光环（球面上的小圆），扫过半个球后淡出
  if (waveAng > 0 && waveAng < Math.PI) {
    const ref: V3 = Math.abs(W[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = norm([W[1] * ref[2] - W[2] * ref[1], W[2] * ref[0] - W[0] * ref[2], W[0] * ref[1] - W[1] * ref[0]]);
    const v: V3 = [W[1] * u[2] - W[2] * u[1], W[2] * u[0] - W[0] * u[2], W[0] * u[1] - W[1] * u[0]];
    const fade = Math.min(1, waveAng / 0.3) * (1 - Math.max(0, (waveAng - Math.PI * 0.7) / (Math.PI * 0.3)));
    const br = Math.round(100 + fade * 120) + 0.999;
    const RN = 96;
    let prev: V3 | null = null;
    for (let j = 0; j <= RN; j++) {
      const a = (j / RN) * Math.PI * 2;
      const d = norm([W[0] * Math.cos(waveAng) + (u[0] * Math.cos(a) + v[0] * Math.sin(a)) * Math.sin(waveAng),
        W[1] * Math.cos(waveAng) + (u[1] * Math.cos(a) + v[1] * Math.sin(a)) * Math.sin(waveAng),
        W[2] * Math.cos(waveAng) + (u[2] * Math.cos(a) + v[2] * Math.sin(a)) * Math.sin(waveAng)]);
      const p: V3 = [center[0] + d[0] * R, center[1] + d[1] * R, center[2] + d[2] * R];
      if (prev) segs.push({a: prev, b: p, w: 1.3, br, t0: 0, t1: 0});
      prev = p;
    }
  }
  const geoRef = useRef<THREE.BufferGeometry | null>(null);
  if (geoRef.current) geoRef.current.dispose();
  const geo = segs.length ? buildRibbonGeometry(segs) : null;
  geoRef.current = geo;
  mat.uniforms.uViewH.value = size.height * gl.getPixelRatio();
  return geo ? <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={8} /> : null;
};
