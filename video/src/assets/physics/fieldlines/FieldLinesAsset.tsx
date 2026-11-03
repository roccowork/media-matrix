// 资产 physics.fieldlines.v1：磁场线（磁偶极子 / 条形磁铁）。参数见 registry.ts。
// 场线用偶极子的解析式：r = L·sin²θ（θ 从 +y 轴量起），L 是这条线离中心最远的距离；
// 每层 L 在若干个方位角 φ 上各一条，从 N 极（上，y>0）出发绕到 S 极（下）。磁铁外部场线方向 N → S。
// 画法：发光带（白芯 + 光晕，越外层越淡）+ 沿线流动的光点（方向 N → S）；
// 开场（growAt）：场线从 N 极往 S 极逐条长出来，外层稍晚；可选中间的条形磁铁（N 红、S 蓝，两极有辉光）。
// 场线加色不写深度，磁铁写深度；镜头不要开 post.dof。种子决定每层方位角的错开和轻微扰动。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {interpolate, random, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Vec3} from '../../../engine/shot';
import {buildRibbonGeometry, RIBBON_GLOW_GLSL, RIBBON_VERT, type Seg, type V3} from '../common/ribbon';

export type FieldLinesProps = {
  position?: Vec3;
  size?: number; // 最外层场线离中心的距离
  shells?: number; // 层数
  perShell?: number; // 每层几条（方位角）
  magnet?: boolean;
  flow?: number; // 光点流速倍数（0 不流动）
  growAt?: number; // 秒；场线开始长出的时间，-1 = 一开始就是完整的
  color?: string;
  pulseColor?: string;
  northColor?: string;
  southColor?: string;
  width?: number;
  brightness?: number;
  tilt?: number; // 磁轴倾斜（度，绕 z）
  spin?: number; // 绕磁轴自转（弧度 / 秒）
  seed?: string | number;
};

const LINE_FRAG = /* glsl */ `
uniform vec3 uCol; uniform vec3 uPulse; uniform float uT; uniform float uFlow; uniform float uBright; uniform float uGrowT; uniform float uNLines;
varying float vSide; varying float vBr; varying float vT; varying float vLine; varying float vPxA;
${RIBBON_GLOW_GLSL}
float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
void main() {
  // 生长：外层（vBr 小）稍晚；每条线自己的进度
  float delay = h1(vLine * 3.7) * 0.25 + (1.0 - vBr) * 0.35;
  float g = clamp((uGrowT - delay) / 1.2, 0.0, 1.0);
  if (vT > g) discard;
  float head = g < 1.0 ? exp(-(g - vT) * 30.0) : 0.0;
  vec3 base = ribbonGlow(vSide, uCol, 0.22) * 0.5;
  // 流动光点：彗星头在前（沿 t 增大方向），尾巴拖在后面
  float k = 3.0;
  float p = fract(vT * k - uT * 0.35 * uFlow + h1(vLine) );
  float dash = smoothstep(0.0, 0.015, 1.0 - p) * pow(p, 24.0);
  vec3 pc = ribbonGlow(vSide, uPulse, 0.4) * dash * 1.4;
  vec3 c = (base + pc) * vBr + ribbonGlow(vSide, uPulse, 0.5) * head * 1.5;
  gl_FragColor = vec4(c * uBright * vPxA, 1.0);
}`;

const MAG_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main() { vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`;
const MAG_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uGlow;
varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(vV);
  vec3 L = normalize(vec3(-0.45, 0.7, 0.55));
  float wrap = clamp((dot(n, L) + 0.3) / 1.3, 0.0, 1.0);
  float spec = pow(max(dot(n, normalize(L + v)), 0.0), 50.0);
  float fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 c = uCol * (0.08 + 0.75 * wrap) + vec3(1.0) * spec * 0.35 + uCol * fr * 0.5 + uCol * uGlow * 0.25;
  gl_FragColor = vec4(c, 1.0);
}`;
const GLOW_VERT = /* glsl */ `
uniform float uSize; varying vec2 vQ;
void main() { vQ = position.xy; vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); mv.xy += position.xy * uSize; gl_Position = projectionMatrix * mv; }`;
const GLOW_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uAmt; varying vec2 vQ;
void main() { float d = length(vQ); float g = (exp(-d * d * 10.0) * 0.6 + exp(-d * 4.0) * 0.25) * (1.0 - smoothstep(0.7, 1.0, d)); gl_FragColor = vec4(uCol * g * uAmt, 1.0); }`;

export const FieldLinesAsset: React.FC<FieldLinesProps> = ({
  position = [0, 0, 0],
  size = 3,
  shells = 5,
  perShell = 8,
  magnet = true,
  flow = 1,
  growAt = 0.3,
  color = '#5fd0ff',
  pulseColor = '#e6f7ff',
  northColor = '#e5484d',
  southColor = '#3b7cf6',
  width = 0.018,
  brightness = 1,
  tilt = 0,
  spin = 0.1,
  seed = 'fieldlines',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {size: vs, gl} = useThree();
  const t = frame / fps;
  const S = String(seed);
  const nSh = Math.max(1, Math.round(shells));
  const nPer = Math.max(1, Math.round(perShell));
  const h = size * 0.17; // 磁铁半长
  const built = useMemo(() => {
    const segs: Seg[] = [];
    const ids: number[] = [];
    let line = 0;
    for (let i = 0; i < nSh; i++) {
      const u = (i + 1) / nSh;
      const Lr = size * (0.3 + 0.7 * Math.pow(u, 1.25));
      const th0 = Math.asin(Math.min(0.999, Math.sqrt((h * 0.92) / Lr)));
      const off = random(`${S}-off${i}`) * Math.PI * 2;
      const br = 1 - 0.55 * (i / Math.max(1, nSh - 1));
      for (let j = 0; j < nPer; j++) {
        const phi = off + (j / nPer) * Math.PI * 2 + (random(`${S}-ph${i}-${j}`) - 0.5) * 0.25;
        const N = 140;
        let prev: V3 | null = null;
        for (let k = 0; k <= N; k++) {
          const th = th0 + (Math.PI - 2 * th0) * (k / N);
          const sn = Math.sin(th);
          const r = Lr * sn * sn;
          const p: V3 = [r * sn * Math.cos(phi), r * Math.cos(th), r * sn * Math.sin(phi)];
          if (prev) {
            segs.push({a: prev, b: p, w: 1, br, t0: (k - 1) / N, t1: k / N});
            ids.push(line);
          }
          prev = p;
        }
        line++;
      }
    }
    const geo = buildRibbonGeometry(segs, (i) => ids[i]);
    const lineMat = new THREE.ShaderMaterial({
      vertexShader: RIBBON_VERT, fragmentShader: LINE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: {
        uCap: {value: 0}, uWidth: {value: width}, uViewH: {value: 1080}, uCol: {value: new THREE.Color(color)}, uPulse: {value: new THREE.Color(pulseColor)},
        uT: {value: 0}, uFlow: {value: flow}, uBright: {value: brightness}, uGrowT: {value: 10}, uNLines: {value: line},
      },
    });
    const magMat = (c: string) => new THREE.ShaderMaterial({vertexShader: MAG_VERT, fragmentShader: MAG_FRAG, uniforms: {uCol: {value: new THREE.Color(c)}, uGlow: {value: 0}}});
    const glowMat = (c: string) =>
      new THREE.ShaderMaterial({
        vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
        uniforms: {uSize: {value: h * 1.6}, uCol: {value: new THREE.Color(c)}, uAmt: {value: 0}},
      });
    return {geo, lineMat, magN: magMat(northColor), magS: magMat(southColor), glowN: glowMat(northColor), glowS: glowMat(southColor)};
  }, [S, nSh, nPer, size, h, width, color, pulseColor, flow, brightness, northColor, southColor]);

  const tg = growAt < 0 ? 100 : t - growAt;
  built.lineMat.uniforms.uT.value = t;
  built.lineMat.uniforms.uGrowT.value = tg;
  built.lineMat.uniforms.uViewH.value = vs.height * gl.getPixelRatio();
  const poleGlow = growAt < 0 ? 1 : interpolate(tg, [-0.3, 0.3], [0.3, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  for (const m of [built.glowN, built.glowS]) m.uniforms.uAmt.value = poleGlow * 0.8 * brightness;
  for (const m of [built.magN, built.magS]) m.uniforms.uGlow.value = poleGlow;
  const bw = h * 0.42;

  return (
    <group position={position} rotation={[0, 0, (tilt * Math.PI) / 180]}>
      <group rotation={[0, spin * t + random(`${S}-rot`) * Math.PI * 2, 0]}>
        <mesh geometry={built.geo} material={built.lineMat} frustumCulled={false} renderOrder={5} />
      </group>
      {magnet && (
        <group>
          <mesh material={built.magN} position={[0, h / 2, 0]}>
            <boxGeometry args={[bw, h, bw]} />
          </mesh>
          <mesh material={built.magS} position={[0, -h / 2, 0]}>
            <boxGeometry args={[bw, h, bw]} />
          </mesh>
          <mesh material={built.glowN} position={[0, h, 0]} frustumCulled={false} renderOrder={6}>
            <planeGeometry args={[2, 2]} />
          </mesh>
          <mesh material={built.glowS} position={[0, -h, 0]} frustumCulled={false} renderOrder={6}>
            <planeGeometry args={[2, 2]} />
          </mesh>
        </group>
      )}
    </group>
  );
};
