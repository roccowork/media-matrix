// 资产 life.lifelines.v1：人生光河（《成功的科学》第 1 集《天才不是一种人，是一段时间》全片主视觉）。
// 一条「人生线」= 一个人的职业生涯，沿 x 轴从左（入行）流向右（最后一天）。大部分是暗的细丝，
// 中间某一段（高光期，约占一生的 1/10）会在某个时刻被点燃。
// 两层：
//   1. 主角线（hero）：画面中心那条「你的一生」，发光带（ribbon）有宽度，可以从左往右长出来（drawAt / drawDuration），
//      在 heroIgniteAt 时从高光段中心向两端烧亮，同时迸出火花（sparks）。
//   2. 光河（river）：几千条同样的细丝铺成一条缓缓起伏的河，按离主角线的距离一圈圈显现（riverAt / riverDuration），
//      每条线的高光段位置、长短、点燃时刻都随机（streakAt 起，在 streakSpread 秒内陆续点燃）——「它什么时候来，几乎是随机的」。
// 画法：光河是一次建好的 LineSegments（1 像素线，全部动画在着色器里按时间算）；主角线用发光带；火花是点精灵。
// 同帧确定：随机数全部来自 random(seed)；没有 useFrame。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Vec3} from '../../../engine/shot';
import {buildRibbonGeometry, RIBBON_GLOW_GLSL, RIBBON_VERT, type Seg, type V3} from '../../physics/common/ribbon';

export type LifeLinesProps = {
  position?: Vec3;
  length?: number; // 一生的长度（世界单位，沿 x）
  // —— 主角线 ——
  hero?: boolean;
  heroWidth?: number;
  heroDim?: number; // 暗的部分有多亮
  drawAt?: number; // 主角线从左往右长出（秒）；-1 = 一开始就是完整的
  drawDuration?: number;
  heroStreak?: number; // 高光段中心（0–1，沿一生）
  heroStreakLen?: number; // 高光段长度（0–1）
  heroIgniteAt?: number; // 点燃时刻（秒）；-1 = 不点燃
  heroIgniteDuration?: number; // 从中心烧到两端用时
  sparks?: number; // 点燃时迸出的火花数
  dust?: number; // 漂浮光尘颗数（给黑场纵深）
  dustSpread?: number; // 光尘分布范围
  // —— 光河 ——
  count?: number; // 光河里的人生线条数
  spreadZ?: number; // 河宽（z）
  spreadY?: number; // 河高（y）
  riverAt?: number; // 光河开始显现（秒）；-1 = 不显示
  riverDuration?: number; // 从中心显现到最外圈用时
  riverDim?: number; // 光河暗线亮度（几千条线叠加，单条要很暗）
  streakGain?: number; // 光河高光段亮度
  fogDist?: number; // 光河按距离衰减的参考距离（越远越淡，抵消透视挤压造成的过曝）；0 = 不衰减
  streakAt?: number; // 光河里的高光段开始陆续点燃（秒）；-1 = 不点燃
  streakSpread?: number; // 在多少秒内陆续点完
  streakShare?: number; // 有高光段的线占比（研究：大多数人至少一次）
  wave?: number; // 河面起伏幅度
  flow?: number; // 河面起伏流动速度
  // —— 颜色 / 亮度 ——
  dimColor?: string;
  glowColor?: string;
  hotColor?: string;
  brightness?: number;
  timeOffset?: number; // 跨镜衔接：本镜时间 + timeOffset
  seed?: string | number;
};

const SEG = 64; // 每条人生线的分段数

// 河面起伏：每条线由 (y0, z0, 相位) 决定；主角线 y0 = z0 = 0
const flowPoint = (s: number, y0: number, z0: number, ph: number, L: number, wave: number, t: number, flow: number): V3 => {
  const x = (s - 0.5) * L;
  const y = y0 + wave * (0.55 * Math.sin(s * 6.1 + ph + t * flow) + 0.3 * Math.sin(s * 13.7 + ph * 2.3 - t * flow * 0.7)) * (0.35 + Math.abs(y0) * 0.15);
  const z = z0 + wave * 0.6 * Math.sin(s * 4.3 + ph * 1.7 + t * flow * 0.5);
  return [x, y, z];
};

const RIVER_VERT = /* glsl */ `
attribute float aS; attribute vec4 aR; attribute vec2 aP; // aR: 高光中心, 高光长度, 点燃时刻, 基础亮度；aP: 显现延迟(0-1), 相位
uniform float uT; uniform float uL; uniform float uWave; uniform float uFlow;
varying float vS; varying vec4 vR; varying float vReveal; varying float vDepth;
uniform float uRiverAt; uniform float uRiverDur;
void main() {
  vec3 p = position; // x = (s-0.5)L, y = y0, z = z0
  float s = aS;
  float ph = aP.y;
  p.y += uWave * (0.55 * sin(s * 6.1 + ph + uT * uFlow) + 0.3 * sin(s * 13.7 + ph * 2.3 - uT * uFlow * 0.7)) * (0.35 + abs(position.y) * 0.15);
  p.z += uWave * 0.6 * sin(s * 4.3 + ph * 1.7 + uT * uFlow * 0.5);
  vS = s; vR = aR;
  vReveal = uRiverAt < 0.0 ? 0.0 : clamp((uT - uRiverAt - aP.x * uRiverDur) / 0.8, 0.0, 1.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const RIVER_FRAG = /* glsl */ `
uniform float uT; uniform vec3 uDim; uniform vec3 uGlow; uniform vec3 uHot; uniform float uRiverDim; uniform float uBright; uniform float uStreakGain; uniform float uFog;
varying float vS; varying vec4 vR; varying float vReveal; varying float vDepth;
void main() {
  if (vReveal <= 0.0) discard;
  float c = vR.x, len = vR.y, ign = vR.z;
  float d = abs(vS - c) / max(len * 0.5, 1e-4);
  float inside = 1.0 - smoothstep(0.7, 1.0, d);
  float since = uT - ign;
  float on = ign < 0.0 ? 0.0 : smoothstep(0.0, 0.35, since);
  float flash = ign < 0.0 ? 0.0 : exp(-max(since, 0.0) * 2.2) * step(0.0, since);
  // 点燃从高光中心往两端烧开
  float burn = ign < 0.0 ? 0.0 : step(d, clamp(since / 0.5, 0.0, 1.0));
  // 两端（入行 / 最后一天）渐隐
  float ends = smoothstep(0.0, 0.06, vS) * (1.0 - smoothstep(0.94, 1.0, vS));
  vec3 col = uDim * uRiverDim * vR.w + mix(uGlow, uHot, flash) * inside * on * burn * uStreakGain * (1.0 + 2.5 * flash);
  // 远处的线在屏幕上挤得更密（1 像素线叠加更亮），按距离衰减抵消，同时像雾一样淡出
  float fog = uFog <= 0.0 ? 1.0 : min(1.3, pow(uFog / max(vDepth, 1e-3), 1.6));
  gl_FragColor = vec4(col * vReveal * ends * fog * uBright, 1.0);
}`;

const HERO_FRAG = /* glsl */ `
uniform vec3 uDim; uniform vec3 uGlow; uniform vec3 uHot; uniform float uBright; uniform float uHeroDim;
uniform float uDraw; uniform float uC; uniform float uLen; uniform float uBurn; uniform float uFlash;
varying float vSide; varying float vBr; varying float vT; varying float vLine; varying float vPxA;
${RIBBON_GLOW_GLSL}
void main() {
  if (vT > uDraw) discard;
  float d = abs(vT - uC) / max(uLen * 0.5, 1e-4);
  float inside = (1.0 - smoothstep(0.75, 1.0, d)) * step(d, uBurn);
  float edge = exp(-pow((d - uBurn) * 6.0, 2.0)) * step(0.001, uBurn) * (1.0 - step(1.0, uBurn)); // 正在烧开的火线
  float tip = uDraw < 0.999 ? exp(-pow((vT - uDraw) * 90.0, 2.0)) * 2.0 + exp(-(uDraw - vT) * 25.0) * 0.5 : 0.0; // 正在长出的线头 + 身后一小段余辉
  float ends = smoothstep(0.0, 0.04, vT);
  float sd = abs(vSide);
  vec3 dimC = uDim * (exp(-sd * sd / 0.09) * 0.9 + exp(-sd * 3.0) * 0.25); // 暗段：没有白芯，像冷掉的余烬
  vec3 c = dimC * uHeroDim * ends
         + ribbonGlow(vSide, mix(uGlow, uHot, uFlash * 0.6), 0.3) * inside * (1.0 + 2.2 * uFlash)
         + ribbonGlow(vSide, uHot, 0.5) * (edge * 2.5 + tip * 1.6);
  gl_FragColor = vec4(c * uBright * vPxA, 1.0);
}`;

const HALO_FRAG = /* glsl */ `
uniform vec3 uGlow; uniform float uBright; uniform float uC; uniform float uLen; uniform float uBurn; uniform float uFlash; uniform float uDraw;
varying float vSide; varying float vBr; varying float vT; varying float vLine; varying float vPxA;
void main() {
  if (vT > uDraw) discard;
  float d = abs(vT - uC) / max(uLen * 0.5, 1e-4);
  float inside = (1.0 - smoothstep(0.5, 1.15, d)) * smoothstep(d - 0.15, d, uBurn);
  float sd = abs(vSide);
  float g = exp(-sd * sd * 6.0) * (1.0 - smoothstep(0.6, 1.0, sd));
  float tip = uDraw < 0.999 ? exp(-pow((vT - uDraw) * 70.0, 2.0)) : 0.0;
  gl_FragColor = vec4(uGlow * g * (inside * (0.12 + 0.35 * uFlash) + tip * 0.6) * uBright * vPxA, 1.0);
}`;

const smooth = (x: number) => {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
};

export const LifeLinesAsset: React.FC<LifeLinesProps> = ({
  position = [0, 0, 0], length = 60,
  hero = true, heroWidth = 0.05, heroDim = 0.5, drawAt = -1, drawDuration = 4, heroStreak = 0.55, heroStreakLen = 0.11,
  heroIgniteAt = -1, heroIgniteDuration = 0.7, sparks = 900, dust = 1500, dustSpread = 14,
  count = 5000, spreadZ = 16, spreadY = 2.4, riverAt = -1, riverDuration = 2.5, riverDim = 0.05, streakGain = 0.35, fogDist = 25,
  streakAt = -1, streakSpread = 6, streakShare = 0.9, wave = 0.35, flow = 0.12,
  dimColor = '#8a5a22', glowColor = '#ffb23c', hotColor = '#fff3d6', brightness = 1, timeOffset = 0, seed = 'lifelines',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {size, gl} = useThree();
  const t = frame / fps + timeOffset;
  const S = String(seed);
  const L = length;
  const viewH = size.height * gl.getPixelRatio();
  const cDim = useMemo(() => new THREE.Color(dimColor), [dimColor]);
  const cGlow = useMemo(() => new THREE.Color(glowColor), [glowColor]);
  const cHot = useMemo(() => new THREE.Color(hotColor), [hotColor]);

  // —— 光河：一次建好 ——
  const river = useMemo(() => {
    if (count <= 0) return null;
    const gauss = (k: string) => Math.sqrt(-2 * Math.log(Math.max(random(`${k}a`), 1e-6))) * Math.cos(2 * Math.PI * random(`${k}b`));
    const n = count * SEG * 2;
    const P = new Float32Array(n * 3), As = new Float32Array(n), Ar = new Float32Array(n * 4), Ap = new Float32Array(n * 2);
    let v = 0;
    for (let i = 0; i < count; i++) {
      // 截面：中间密、外面疏；离主角线太近的挪开，留出主角的位置
      let z0 = gauss(`${S}z${i}`) * spreadZ * 0.32, y0 = gauss(`${S}y${i}`) * spreadY * 0.32;
      const r0 = Math.hypot(z0 / spreadZ, y0 / spreadY);
      if (r0 < 0.03) { const k = 0.03 / Math.max(r0, 1e-4); z0 *= k; y0 *= k; }
      const ph = random(`${S}ph${i}`) * 6.283;
      const has = random(`${S}has${i}`) < streakShare;
      const c = 0.12 + 0.76 * random(`${S}c${i}`); // 高光期出现在一生的任何时候
      const len = 0.07 + 0.08 * random(`${S}l${i}`);
      const ign = has && streakAt >= 0 ? streakAt + Math.pow(random(`${S}ig${i}`), 0.8) * streakSpread : -1;
      const b = 0.35 + 0.65 * random(`${S}b${i}`);
      const delay = Math.min(1, Math.hypot(z0 / (spreadZ * 0.5), y0 / (spreadY * 0.5)) * 0.8 + random(`${S}dl${i}`) * 0.2);
      for (let j = 0; j < SEG; j++) {
        for (const s of [j / SEG, (j + 1) / SEG]) {
          P.set([(s - 0.5) * L, y0, z0], v * 3);
          As[v] = s;
          Ar.set([c, len, ign, b], v * 4);
          Ap.set([delay, ph], v * 2);
          v++;
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('aS', new THREE.BufferAttribute(As, 1));
    g.setAttribute('aR', new THREE.BufferAttribute(Ar, 4));
    g.setAttribute('aP', new THREE.BufferAttribute(Ap, 2));
    const m = new THREE.ShaderMaterial({
      vertexShader: RIVER_VERT, fragmentShader: RIVER_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      uniforms: {uT: {value: 0}, uL: {value: L}, uWave: {value: wave}, uFlow: {value: flow}, uRiverAt: {value: riverAt}, uRiverDur: {value: riverDuration},
        uDim: {value: cDim}, uGlow: {value: cGlow}, uHot: {value: cHot}, uRiverDim: {value: riverDim * Math.min(1, 2000 / Math.max(count, 1))}, uBright: {value: brightness}, uStreakGain: {value: streakGain * Math.min(1, Math.sqrt(2000 / Math.max(count, 1)))}, uFog: {value: fogDist}},
    });
    return {g, m};
  }, [count, spreadZ, spreadY, streakAt, streakSpread, streakShare, S, L, wave, flow, riverAt, riverDuration, cDim, cGlow, cHot, riverDim, streakGain, fogDist, brightness]);
  if (river) river.m.uniforms.uT.value = t;

  // —— 主角线 ——
  const heroGeo = useMemo(() => {
    if (!hero) return null;
    const segs: Seg[] = [];
    const N = 400;
    let prev = flowPoint(0, 0, 0, 0, L, wave * 0.4, 0, 0);
    for (let j = 1; j <= N; j++) {
      const s = j / N;
      const p = flowPoint(s, 0, 0, 0, L, wave * 0.4, 0, 0);
      segs.push({a: prev, b: p, w: 1, br: 1, t0: (j - 1) / N, t1: s});
      prev = p;
    }
    return buildRibbonGeometry(segs);
  }, [hero, L, wave]);
  const heroMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: RIBBON_VERT, fragmentShader: HERO_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {uCap: {value: 0}, uWidth: {value: heroWidth}, uViewH: {value: 1080}, uDim: {value: cDim}, uGlow: {value: cGlow}, uHot: {value: cHot},
      uBright: {value: brightness}, uHeroDim: {value: heroDim}, uDraw: {value: 1}, uC: {value: heroStreak}, uLen: {value: heroStreakLen}, uBurn: {value: 0}, uFlash: {value: 0}},
  }), [heroWidth, cDim, cGlow, cHot, brightness, heroDim, heroStreak, heroStreakLen]);
  const draw = drawAt < 0 ? 1 : smooth((t - drawAt) / Math.max(drawDuration, 0.01)) * 0.999 + (t >= drawAt + drawDuration ? 0.001 : 0);
  const since = heroIgniteAt < 0 ? -1 : t - heroIgniteAt;
  heroMat.uniforms.uViewH.value = viewH;
  heroMat.uniforms.uDraw.value = Math.min(1, draw);
  heroMat.uniforms.uBurn.value = since < 0 ? 0 : Math.min(1.0001, 1 - Math.pow(1 - Math.min(1, since / heroIgniteDuration), 3));
  heroMat.uniforms.uFlash.value = since < 0 ? 0 : Math.exp(-since * 1.6);

  // —— 火花：拖尾发光带。初速度大、带阻力、受重力往下坠成弧；每颗画「t-拖尾 → t」一小段 ——
  const sparkSeeds = useMemo(() => {
    if (!hero || sparks <= 0) return null;
    const out: {o: V3; v: V3; life: number; w: number}[] = [];
    for (let i = 0; i < sparks; i++) {
      const s0 = heroStreak + (random(`${S}sp${i}`) - 0.5) * heroStreakLen * 0.9;
      const th = random(`${S}st${i}`) * 6.283;
      const up = 0.15 + 0.85 * random(`${S}se${i}`);
      const sp = 2 + 9 * Math.pow(random(`${S}ss${i}`), 2.2);
      out.push({o: flowPoint(s0, 0, 0, 0, L, wave * 0.4, 0, 0), v: [(random(`${S}sx${i}`) - 0.5) * sp * 0.9, up * sp, Math.cos(th) * sp * 0.8], life: 0.8 + 2.4 * random(`${S}sl${i}`), w: 0.35 + 0.65 * random(`${S}sw${i}`)});
    }
    return out;
  }, [hero, sparks, heroStreak, heroStreakLen, S, L, wave]);
  const sparkMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: RIBBON_VERT, fragmentShader: `
uniform vec3 uHot; uniform vec3 uGlow; uniform float uBright;
varying float vSide; varying float vBr; varying float vT; varying float vLine; varying float vPxA;
${RIBBON_GLOW_GLSL}
void main() { gl_FragColor = vec4(ribbonGlow(vSide, mix(uGlow, uHot, vT * 0.7), 0.3) * vBr * (0.4 + 0.6 * vT) * uBright * vPxA, 1.0); }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {uCap: {value: 0}, uWidth: {value: heroWidth * 0.45}, uViewH: {value: 1080}, uHot: {value: cHot}, uGlow: {value: cGlow}, uBright: {value: brightness}},
  }), [heroWidth, cHot, cGlow, brightness]);
  const sparkPos = (sd: {o: V3; v: V3}, tt: number): V3 => {
    const k = (1 - Math.exp(-2.2 * tt)) / 2.2;
    return [sd.o[0] + sd.v[0] * k, sd.o[1] + sd.v[1] * k - 2.4 * tt * tt, sd.o[2] + sd.v[2] * k];
  };
  const sparkSegs: Seg[] = [];
  if (sparkSeeds && since > 0) {
    sparkSeeds.forEach((sd) => {
      if (since > sd.life) return;
      const a = 1 - since / sd.life;
      const t1 = since, t0 = Math.max(0, since - 0.07);
      const N = 3;
      let prev = sparkPos(sd, t0);
      for (let j = 1; j <= N; j++) {
        const p = sparkPos(sd, t0 + ((t1 - t0) * j) / N);
        sparkSegs.push({a: prev, b: p, w: sd.w, br: a * a * 1.6, t0: (j - 1) / N, t1: j / N});
        prev = p;
      }
    });
  }
  const sparkGeo = sparkSegs.length ? buildRibbonGeometry(sparkSegs) : null;
  sparkMat.uniforms.uViewH.value = viewH;
  const haloMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: RIBBON_VERT, fragmentShader: HALO_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {uCap: {value: 0}, uWidth: {value: heroWidth * 3}, uViewH: {value: 1080}, uGlow: {value: cGlow}, uBright: {value: brightness}, uC: {value: heroStreak}, uLen: {value: heroStreakLen}, uBurn: {value: 0}, uFlash: {value: 0}, uDraw: {value: 1}},
  }), [heroWidth, cGlow, brightness, heroStreak, heroStreakLen]);
  for (const k of ['uViewH', 'uBurn', 'uFlash', 'uDraw'] as const) haloMat.uniforms[k].value = heroMat.uniforms[k].value;

  // —— 漂浮的光尘：给黑场纵深（近大远小、缓慢漂移） ——
  const dustGeo = useMemo(() => {
    if (dust <= 0) return null;
    const P = new Float32Array(dust * 3), A = new Float32Array(dust);
    for (let i = 0; i < dust; i++) {
      P.set([(random(`${S}dx${i}`) - 0.5) * L * 1.2, (random(`${S}dy${i}`) - 0.5) * dustSpread, (random(`${S}dz${i}`) - 0.5) * dustSpread * 2], i * 3);
      A[i] = 0.2 + 0.8 * random(`${S}da${i}`);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('aA', new THREE.BufferAttribute(A, 1));
    return g;
  }, [dust, dustSpread, S, L]);
  const dustMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: `attribute float aA; uniform float uT; uniform float uViewH; varying float vA;
void main() { vec3 p = position + vec3(uT * 0.08, sin(uT * 0.3 + position.x) * 0.15, 0.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float px = 0.05 * projectionMatrix[1][1] * 0.5 * uViewH / max(-mv.z, 1e-3);
  vA = aA * min(1.0, px / 2.0) * smoothstep(0.3, 2.0, -mv.z);
  gl_PointSize = clamp(px, 1.0, 14.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uCol; uniform float uBright; uniform float uLight; varying float vA;
void main() { vec2 c = gl_PointCoord - 0.5; float g = exp(-dot(c, c) * 18.0); gl_FragColor = vec4(uCol * g * vA * 0.35 * uBright * uLight, 1.0); }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: {uT: {value: 0}, uViewH: {value: 1080}, uCol: {value: cGlow}, uBright: {value: brightness}, uLight: {value: 1}},
  }), [cGlow, brightness]);
  dustMat.uniforms.uT.value = t;
  dustMat.uniforms.uViewH.value = viewH;
  dustMat.uniforms.uLight.value = 0.5 + (since > 0 ? 2.5 * Math.exp(-since * 1.2) + 0.6 : 0); // 点燃时照亮光尘

  return (
    <group position={position}>
      {river && (riverAt >= 0 && t >= riverAt) ? <lineSegments geometry={river.g} material={river.m} frustumCulled={false} renderOrder={5} /> : null}
      {heroGeo ? <mesh geometry={heroGeo} material={heroMat} frustumCulled={false} renderOrder={9} /> : null}
      {heroGeo && (since > 0 || draw < 0.999) ? <mesh geometry={heroGeo} material={haloMat} frustumCulled={false} renderOrder={8} /> : null}
      {sparkGeo ? <mesh geometry={sparkGeo} material={sparkMat} frustumCulled={false} renderOrder={10} /> : null}
      {dustGeo ? <points geometry={dustGeo} material={dustMat} frustumCulled={false} renderOrder={4} /> : null}
    </group>
  );
};

/** 主角线上 s（0–1）处的点（世界坐标，未加 position）：写镜头关键帧时用来对准主角线 */
export const heroPoint = (s: number, length = 60, wave = 0.35): V3 => flowPoint(s, 0, 0, 0, length, wave * 0.4, 0, 0);
