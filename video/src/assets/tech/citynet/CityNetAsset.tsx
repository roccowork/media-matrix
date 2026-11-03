// 资产 tech.citynet.v1：城市间数据光带（行星夜面上，城市之间不断弹起发光的弧线，光点沿弧线飞过，再熄灭换一对城市）。
// 每条弧有自己的周期；第 k 个周期的两个端点由种子 + (i, k) 决定，落在 facing 方向周围 spread 角度内的球面上。
// 一个周期内：0–35% 从 A 长到 B，35–75% 光点沿弧飞行，75–100% 淡出。画法：发光带（与闪电 / 磁场线同一套 ribbon）。
// 每帧在 CPU 上按时间重建几何（弧少、段少，开销很小），同帧确定。
import React, {useMemo, useRef} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Vec3} from '../../../engine/shot';
import {buildRibbonGeometry, RIBBON_GLOW_GLSL, RIBBON_VERT, type Seg, type V3} from '../../physics/common/ribbon';

export type CityNetProps = {
  center?: Vec3; // 行星中心
  radius?: number; // 行星半径
  facing?: Vec3; // 弧线集中在球面这个方向周围（一般朝镜头的夜面）
  spread?: number; // 分布范围（度）
  count?: number; // 同时存在的弧线条数
  height?: number; // 弧高（相对弦长）
  width?: number;
  color?: string;
  pulseColor?: string;
  period?: number; // 每条弧的平均周期（秒）
  maxSpan?: number; // 一条弧最远连多远（度）：真实的连线多在相邻城市之间
  brightness?: number;
  seed?: string | number;
};

const FRAG = /* glsl */ `
uniform vec3 uCol; uniform vec3 uPulse; uniform float uBright;
varying float vSide; varying float vBr; varying float vT; varying float vLine; varying float vPxA;
${RIBBON_GLOW_GLSL}
void main() {
  // vBr 打包：整数部分 = 弧的整体亮度 ×100，小数部分 = 光点位置（0–1，<0 表示无光点）
  float a = floor(vBr) / 100.0;
  float pp = fract(vBr) * 1.25 - 0.1;
  float d = vT - pp;
  float pulse = pp > -0.05 ? exp(-d * d * 900.0) + 0.35 * exp(-max(-d, 0.0) * 18.0) * step(d, 0.0) : 0.0;
  vec3 c = ribbonGlow(vSide, uCol, 0.22) * 0.32 * a + ribbonGlow(vSide, uPulse, 0.45) * pulse * 1.6 * a;
  gl_FragColor = vec4(c * uBright * vPxA, 1.0);
}`;

const norm = (v: V3): V3 => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; };

export const CityNetAsset: React.FC<CityNetProps> = ({
  center = [0, 0, 0], radius = 5, facing = [0, 0, 1], spread = 55, count = 70, height = 0.25, width = 0.025,
  color = '#ffb35c', pulseColor = '#fff2d6', period = 3.2, maxSpan = 30, brightness = 1, seed = 'citynet',
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
  // 球面上 facing 周围的随机点
  const f = norm(facing);
  const ref: V3 = Math.abs(f[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm([f[1] * ref[2] - f[2] * ref[1], f[2] * ref[0] - f[0] * ref[2], f[0] * ref[1] - f[1] * ref[0]]);
  const v: V3 = [f[1] * u[2] - f[2] * u[1], f[2] * u[0] - f[0] * u[2], f[0] * u[1] - f[1] * u[0]];
  const pointAt = (key: string): V3 => {
    const ang = random(`${key}a`) * Math.PI * 2;
    const r = Math.sqrt(random(`${key}r`)) * Math.sin((spread * Math.PI) / 180);
    const z = Math.sqrt(Math.max(0, 1 - r * r));
    return norm([f[0] * z + (u[0] * Math.cos(ang) + v[0] * Math.sin(ang)) * r, f[1] * z + (u[1] * Math.cos(ang) + v[1] * Math.sin(ang)) * r, f[2] * z + (u[2] * Math.cos(ang) + v[2] * Math.sin(ang)) * r]);
  };
  const segs: Seg[] = [];
  const N = 40;
  for (let i = 0; i < count; i++) {
    const P = period * (0.6 + 0.8 * random(`${S}-p${i}`));
    const ph = random(`${S}-ph${i}`) * P;
    const k = Math.floor((t + ph) / P);
    const x = ((t + ph) / P) - k; // 0–1 周期内进度
    const A = pointAt(`${S}-${i}-${k}-A`);
    // B：从 A 出发、随机方向、5° 到 maxSpan 之间（短弧为主）
    const Bt = pointAt(`${S}-${i}-${k}-B`);
    const ang = ((5 + (maxSpan - 5) * Math.pow(random(`${S}-${i}-${k}-span`), 1.6)) * Math.PI) / 180;
    const dotAB = A[0] * Bt[0] + A[1] * Bt[1] + A[2] * Bt[2];
    const perp = norm([Bt[0] - A[0] * dotAB, Bt[1] - A[1] * dotAB, Bt[2] - A[2] * dotAB]);
    const B: V3 = norm([A[0] * Math.cos(ang) + perp[0] * Math.sin(ang), A[1] * Math.cos(ang) + perp[1] * Math.sin(ang), A[2] * Math.cos(ang) + perp[2] * Math.sin(ang)]);
    const chord = Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]) * radius;
    if (chord < radius * 0.08) continue;
    const grow = Math.min(1, x / 0.35);
    const alpha = x < 0.75 ? 1 : Math.max(0, 1 - (x - 0.75) / 0.25);
    const pulse = x > 0.3 && x < 0.8 ? (x - 0.3) / 0.5 : -0.08;
    const brPack = Math.round(alpha * (0.6 + 0.4 * random(`${S}-b${i}`)) * 100) + Math.max(0, Math.min(0.999, (pulse + 0.1) / 1.25));
    let prev: V3 | null = null;
    const nMax = Math.ceil(N * grow);
    for (let j = 0; j <= nMax; j++) {
      const s = Math.min(j / N, grow);
      // 球面插值 + 抬高（sin 包络）
      const om = Math.acos(Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])));
      const w1 = Math.sin((1 - s) * om) / Math.sin(om), w2 = Math.sin(s * om) / Math.sin(om);
      const dir = norm([A[0] * w1 + B[0] * w2, A[1] * w1 + B[1] * w2, A[2] * w1 + B[2] * w2]);
      const h = radius * 1.003 + Math.sin(s * Math.PI) * chord * height;
      const p: V3 = [center[0] + dir[0] * h, center[1] + dir[1] * h, center[2] + dir[2] * h];
      if (prev) segs.push({a: prev, b: p, w: 1, br: brPack, t0: (j - 1) / N, t1: s});
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
