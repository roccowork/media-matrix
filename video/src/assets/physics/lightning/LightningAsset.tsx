// 资产 physics.lightning.v1：闪电 / 电弧。参数见 registry.ts。
// 两种模式：
//   击打（arc = false）：按 rate 每秒若干次，每次一道主干 + 分叉（中点位移生成，形状由种子 + 第几次决定）；
//     时间上：先导 0.05 秒从起点长到终点 → 2–4 次回闪（同一通道反复变亮）→ 余辉衰减，总长约 0.6 秒；
//   电弧（arc = true）：两点之间持续放电，每 2 帧换一次形状（两条叠在一起更粗更亮），亮度随机抖动。
// 画法：面向镜头的发光带（白芯 + 彩色光晕，加色混合）+ 放电时的大片辉光面片（照亮周围）+ 可选两端金属电极球。
// 不写深度（加色），所以镜头不要开 post.dof；同帧结果确定（形状只依赖种子和时间分段）。
import React, {useMemo, useRef} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Vec3} from '../../../engine/shot';
import {BioMedium} from '../../biology/common/BioMedium';
import {buildRibbonGeometry, makeBolt, RIBBON_GLOW_GLSL, RIBBON_VERT, type V3} from '../common/ribbon';

export type LightningProps = {
  from?: Vec3;
  to?: Vec3;
  arc?: boolean;
  rate?: number;
  branches?: number;
  jaggedness?: number;
  width?: number;
  color?: string;
  brightness?: number;
  electrodes?: boolean;
  haze?: number;
  hazeColor?: string;
  seed?: string | number;
};

const BOLT_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uEnv; uniform float uGrow; uniform float uBright;
varying float vSide; varying float vBr; varying float vT; varying float vLine; varying float vPxA;
${RIBBON_GLOW_GLSL}
void main() {
  if (vT > uGrow) discard;
  float tip = uGrow < 1.0 ? 1.0 + 2.0 * exp(-(uGrow - vT) * 40.0) : 1.0;   // 先导的头更亮
  vec3 c = ribbonGlow(vSide, uCol, 0.3);
  gl_FragColor = vec4(c * vBr * uEnv * uBright * vPxA * tip, 1.0);
}`;

const GLOW_VERT = /* glsl */ `
uniform float uSize; varying vec2 vQ;
void main() {
  vQ = position.xy;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
}`;
const GLOW_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uAmt; varying vec2 vQ;
void main() {
  float d = length(vQ);
  float g = exp(-d * d * 7.0) * 0.5 + exp(-d * 3.0) * 0.25;
  g *= 1.0 - smoothstep(0.75, 1.0, d);
  gl_FragColor = vec4(uCol * g * uAmt, 1.0);
}`;

// 电极：深色金属球，高光 + 被电弧照亮
const ELEC_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  vec4 mv = viewMatrix * w;
  vV = -mv.xyz; vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`;
const ELEC_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uAmt; uniform vec3 uOther;
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(vV);
  vec3 L = normalize(vec3(-0.4, 0.7, 0.6));
  float spec = pow(max(dot(n, normalize(L + v)), 0.0), 60.0);
  float fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 base = vec3(0.05, 0.055, 0.065) * (0.4 + 0.6 * max(dot(n, L), 0.0));
  // 朝向另一极（电弧方向）的一面被照亮
  vec3 toO = normalize((viewMatrix * vec4(uOther, 1.0)).xyz + vV);
  float lit = pow(max(dot(n, toO), 0.0), 2.0);
  vec3 c = base + vec3(0.9) * spec * 0.5 + vec3(0.25, 0.3, 0.4) * fr * 0.4 + uCol * lit * uAmt * 0.9;
  gl_FragColor = vec4(c, 1.0);
}`;

type Active = {key: string; env: number; grow: number};

export const LightningAsset: React.FC<LightningProps> = ({
  from = [0, 3, 0],
  to = [0, -3, 0],
  arc = false,
  rate = 0.8,
  branches = 0.12,
  jaggedness = 0.22,
  width = 0.04,
  color = '#9fc8ff',
  brightness = 1,
  electrodes = false,
  haze = 0,
  hazeColor = '#1a1240',
  seed = 'lightning',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {size, gl} = useThree();
  const t = frame / fps;
  const S = String(seed);
  const viewH = size.height * gl.getPixelRatio();
  const L = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const mid: Vec3 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];

  // ---- 这一帧有哪些闪电在亮 ----
  const active: Active[] = [];
  if (arc) {
    const k = Math.floor(frame / 2);
    const fl = 0.75 + 0.25 * random(`${S}-fl${k}`);
    active.push({key: `${S}-arc${k}`, env: fl, grow: 1});
    active.push({key: `${S}-arcb${k}`, env: fl * 0.55, grow: 1});
  } else if (rate > 0) {
    const life = 0.6;
    const k0 = Math.max(0, Math.floor((t - life) * rate) - 1);
    const k1 = Math.floor(t * rate) + 1;
    for (let k = k0; k <= k1; k++) {
      const tk = (k + 0.15 + 0.5 * random(`${S}-tk${k}`)) / rate;
      const dt = t - tk;
      if (dt < 0 || dt > life) continue;
      const nStroke = 2 + Math.floor(random(`${S}-ns${k}`) * 3);
      let s = 0.05;
      let env = 0;
      for (let i = 0; i < nStroke; i++) {
        if (dt >= s) env = Math.max(env, (i === 0 ? 1 : 0.6 + 0.4 * random(`${S}-sb${k}-${i}`)) * Math.exp(-(dt - s) * 22));
        s += 0.035 + 0.07 * random(`${S}-sg${k}-${i}`);
      }
      const grow = Math.min(1, dt / 0.05);
      env = Math.max(env, dt < 0.05 ? 0.45 : 0, 0.18 * Math.exp(-(dt - 0.05) * 6));   // 先导期 + 余辉
      active.push({key: `${S}-st${k}`, env, grow});
    }
  }

  // 形状只依赖 key，缓存起来（同一道闪电的回闪用同一条通道）
  const cache = useRef(new Map<string, {geo: THREE.BufferGeometry; mat: THREE.ShaderMaterial}>());
  const shared = useMemo(
    () => ({
      col: new THREE.Color(color),
      glow: new THREE.ShaderMaterial({
        vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, depthTest: false,
        blending: THREE.AdditiveBlending, uniforms: {uSize: {value: L * 0.9}, uCol: {value: new THREE.Color(color)}, uAmt: {value: 0}},
      }),
      elec: [0, 1].map((i) =>
        new THREE.ShaderMaterial({
          vertexShader: ELEC_VERT, fragmentShader: ELEC_FRAG,
          uniforms: {uCol: {value: new THREE.Color(color)}, uAmt: {value: 0}, uOther: {value: new THREE.Vector3(...(i ? from : to))}},
        }),
      ),
    }),
    [color, L, from, to],
  );
  const get = (key: string) => {
    let e = cache.current.get(key);
    if (!e) {
      const segs = makeBolt(from as V3, to as V3, key, {levels: arc ? 5 : 7, jag: jaggedness, branch: arc ? branches * 0.4 : branches, branchDepth: arc ? 1 : 2});
      const geo = buildRibbonGeometry(segs);
      const mat = new THREE.ShaderMaterial({
        vertexShader: RIBBON_VERT, fragmentShader: BOLT_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: {uCap: {value: 0.5}, uWidth: {value: width}, uViewH: {value: viewH}, uCol: {value: shared.col}, uEnv: {value: 0}, uGrow: {value: 0}, uBright: {value: brightness}},
      });
      e = {geo, mat};
      cache.current.set(key, e);
      // 只留最近的，防止长镜头内存涨
      if (cache.current.size > 24) {
        const first = cache.current.keys().next().value as string;
        cache.current.get(first)?.geo.dispose();
        cache.current.delete(first);
      }
    }
    e.mat.uniforms.uEnv.value = 0;
    return e;
  };
  const items = active.map((a) => {
    const e = get(a.key);
    e.mat.uniforms.uEnv.value = a.env;
    e.mat.uniforms.uGrow.value = a.grow;
    e.mat.uniforms.uViewH.value = viewH;
    return {key: a.key, ...e};
  });
  const envMax = active.reduce((m, a) => Math.max(m, a.env * (a.grow >= 1 ? 1 : 0.5)), 0);
  shared.glow.uniforms.uAmt.value = envMax * 0.55 * brightness;
  for (const m of shared.elec) m.uniforms.uAmt.value = envMax * brightness;
  const er = L * 0.06;

  return (
    <group>
      {items.map((it) => (
        <mesh key={it.key} geometry={it.geo} material={it.mat} frustumCulled={false} renderOrder={6} />
      ))}
      <mesh material={shared.glow} position={mid} frustumCulled={false} renderOrder={5}>
        <planeGeometry args={[2, 2]} />
      </mesh>
      {electrodes &&
        [from, to].map((p, i) => (
          <mesh key={i} material={shared.elec[i]} position={p} frustumCulled={false}>
            <sphereGeometry args={[er, 48, 32]} />
          </mesh>
        ))}
      {haze > 0 && (
        <group position={mid}>
          <BioMedium amount={haze} color={hazeColor} scale={L / 4} seed={`${S}-medium`} />
        </group>
      )}
    </group>
  );
};
