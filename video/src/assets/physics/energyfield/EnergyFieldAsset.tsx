// 资产 physics.energyfield.v1：能量场（球形力场护盾 + 中心等离子球 + 等离子电弧）。参数见 registry.ts。
// 结构：
//   1. 护盾：细分二十面体（每个三角形一格），片元里画格子边线、格子随机闪烁、流动的能量噪声、菲涅尔边缘；
//      被「击中」：按 impacts 每秒若干次，在种子决定的方向上一闪，并从击中点沿球面扩散出一圈波纹（经过的格子变亮）；
//      开场（appearAt）：一道扫描环从底部扫到顶部，扫过的地方护盾成形；
//   2. 中心等离子球：自发光，内部 fbm 噪声缓慢翻涌，中心发白；
//   3. 等离子电弧：从球心表面连到护盾内壁的几条闪电（形状每 3 帧换一次，落点在球面上缓慢游走，像等离子球），
//      落点在护盾上留一个亮斑。
// 全部加色、不写深度，镜头不要开 post.dof。时间全部由帧号驱动、随机数 random(seed)，同帧结果确定。
import React, {useMemo, useRef} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Vec3} from '../../../engine/shot';
import {NOISE_GLSL} from '../../../engine/shaders/noise.glsl';
import {BioMedium} from '../../biology/common/BioMedium';
import {buildRibbonGeometry, makeBolt, RIBBON_GLOW_GLSL, RIBBON_VERT, type Seg, type V3} from '../common/ribbon';

export type EnergyFieldProps = {
  position?: Vec3;
  radius?: number;
  cells?: number; // 网格细分级数（越大格子越小）
  color?: string;
  plasmaColor?: string;
  core?: boolean;
  arcs?: number;
  impacts?: number; // 每秒被击中几次
  appearAt?: number; // 秒；-1 = 一开始就成形
  spin?: number;
  brightness?: number;
  haze?: number;
  hazeColor?: string;
  seed?: string | number;
};

const MAX_IMP = 6;
const MAX_ARC = 12;

const SHIELD_VERT = /* glsl */ `
attribute vec3 aBary; attribute float aFace;
varying vec3 vBary; varying float vFace; varying vec3 vObj; varying vec3 vN; varying vec3 vV;
void main() {
  vBary = aBary; vFace = aFace; vObj = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = -mv.xyz; vN = normalize(normalMatrix * normalize(position));
  gl_Position = projectionMatrix * mv;
}`;
const SHIELD_FRAG = /* glsl */ `
uniform vec3 uCol; uniform vec3 uPl; uniform float uT; uniform float uSeedF; uniform float uBright; uniform float uAppear;
uniform vec4 uImp[${MAX_IMP}]; uniform vec4 uHit[${MAX_ARC}];
varying vec3 vBary; varying float vFace; varying vec3 vObj; varying vec3 vN; varying vec3 vV;
${NOISE_GLSL}
float h1(float n) { return fract(sin(n * 127.1 + uSeedF) * 43758.5453); }
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(vV);
  float facing = dot(n, v);                       // >0 正面，<0 背面（内壁）
  float fr = pow(1.0 - abs(facing), 2.5);
  // 成形扫描：y 从 -1 扫到 1
  float yv = vObj.y;
  float front = uAppear * 2.4 - 1.2;
  if (yv > front) discard;
  float scan = exp(-pow((yv - front) * 18.0, 2.0)) * step(uAppear, 0.999);
  // 格子边线（重心坐标最小值 = 到最近边的距离）
  float e = min(min(vBary.x, vBary.y), vBary.z);
  float fw = fwidth(e);
  float edge = 1.0 - smoothstep(fw * 0.8, fw * 2.2, e);
  // 流动能量
  float flowN = snoise(vObj * 2.2 + vec3(0.0, -uT * 0.35, uT * 0.1) + uSeedF) * 0.5 + 0.5;
  float flowN2 = snoise(vObj * 6.0 + vec3(uT * 0.2, 0.0, -uT * 0.3)) * 0.5 + 0.5;
  // 格子闪烁
  float fl = step(0.965, h1(vFace + floor(uT * 6.0 + h1(vFace * 3.0) * 6.0) * 17.0));
  // 击中：闪光 + 球面上扩散的波纹
  float rip = 0.0; float flash = 0.0;
  for (int i = 0; i < ${MAX_IMP}; i++) {
    vec4 im = uImp[i];
    if (im.w < 0.0) continue;
    float ang = acos(clamp(dot(vObj, normalize(im.xyz)), -1.0, 1.0));
    float age = im.w;
    rip += exp(-pow((ang - age * 1.8) * 9.0, 2.0)) * exp(-age * 1.6);
    flash += exp(-ang * ang * 40.0) * exp(-age * 7.0);
  }
  // 电弧落点亮斑
  float hit = 0.0;
  for (int i = 0; i < ${MAX_ARC}; i++) {
    vec4 hh = uHit[i];
    if (hh.w <= 0.0) continue;
    float ang = acos(clamp(dot(vObj, hh.xyz), -1.0, 1.0));
    hit += exp(-ang * ang * 900.0) * hh.w + exp(-ang * ang * 120.0) * 0.25 * hh.w;
  }
  float side = facing > 0.0 ? 1.0 : 0.55;
  float I = 0.025 + fr * 0.85;
  I += edge * (0.16 + 0.5 * fr + 0.6 * rip) * (0.6 + 0.6 * flowN);
  I += (0.06 * flowN * flowN2 + 0.35 * fl) * (0.3 + fr);
  I += rip * 0.25 + flash * 2.2 + scan * (1.2 + 2.0 * edge);
  vec3 c = uCol * I * side + uPl * hit * 1.4 + vec3(1.0) * flash * 0.6;
  gl_FragColor = vec4(c * uBright, 1.0);
}`;

const CORE_VERT = /* glsl */ `
varying vec3 vObj; varying vec3 vN; varying vec3 vV;
void main() { vObj = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`;
const CORE_FRAG = /* glsl */ `
uniform vec3 uPl; uniform float uT; uniform float uSeedF; uniform float uBright; uniform float uOn; uniform float uR;
varying vec3 vObj; varying vec3 vN; varying vec3 vV;
${NOISE_GLSL}
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(vV);
  float f = max(dot(n, v), 0.0);
  vec3 q = vObj / uR * 2.0;
  float b = snoise(q + vec3(0.0, uT * 0.4, uSeedF)) * 0.5 + snoise(q * 2.3 - vec3(uT * 0.3, 0.0, 0.0)) * 0.3 + snoise(q * 5.0 + uT * 0.5) * 0.2;
  float I = pow(f, 1.5) * (0.9 + 0.8 * b) + pow(f, 8.0) * 1.5 + pow(1.0 - f, 3.0) * 0.6;
  vec3 c = mix(uPl, vec3(1.0, 0.96, 1.0), pow(f, 6.0) * 0.8) * I;
  gl_FragColor = vec4(c * uBright * uOn, 1.0);
}`;

const ARC_FRAG = /* glsl */ `
uniform vec3 uPl; uniform float uBright; uniform float uOn;
varying float vSide; varying float vBr; varying float vT; varying float vLine; varying float vPxA;
${RIBBON_GLOW_GLSL}
void main() {
  vec3 c = ribbonGlow(vSide, uPl, 0.3);
  gl_FragColor = vec4(c * vBr * uBright * uOn * vPxA * (0.7 + 0.5 * vT), 1.0);
}`;

const GLOW_VERT = /* glsl */ `
uniform float uSize; varying vec2 vQ;
void main() { vQ = position.xy; vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); mv.xy += position.xy * uSize; gl_Position = projectionMatrix * mv; }`;
const GLOW_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uAmt; varying vec2 vQ;
void main() { float d = length(vQ); float g = (exp(-d * d * 12.0) * 0.6 + exp(-d * 4.0) * 0.2) * (1.0 - smoothstep(0.7, 1.0, d)); gl_FragColor = vec4(uCol * g * uAmt, 1.0); }`;

const smooth01 = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

export const EnergyFieldAsset: React.FC<EnergyFieldProps> = ({
  position = [0, 0, 0],
  radius = 2,
  cells = 4,
  color = '#4fd8ff',
  plasmaColor = '#d58cff',
  core = true,
  arcs = 6,
  impacts = 0.8,
  appearAt = 0.3,
  spin = 0.1,
  brightness = 1,
  haze = 0,
  hazeColor = '#1a1240',
  seed = 'energyfield',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {size, gl} = useThree();
  const t = frame / fps;
  const S = String(seed);
  const R = radius;
  const detail = Math.max(1, Math.min(7, Math.round(cells)));
  const nArc = core ? Math.max(0, Math.min(MAX_ARC, Math.round(arcs))) : 0;
  const coreR = R * 0.18;
  const viewH = size.height * gl.getPixelRatio();

  const built = useMemo(() => {
    const seedF = random(`ef-${S}`) * 100;
    const geo = new THREE.IcosahedronGeometry(R, detail);
    const n = geo.getAttribute('position').count;
    const bary = new Float32Array(n * 3);
    const face = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      bary[i * 3 + (i % 3)] = 1;
      face[i] = Math.floor(i / 3);
    }
    geo.setAttribute('aBary', new THREE.BufferAttribute(bary, 3));
    geo.setAttribute('aFace', new THREE.BufferAttribute(face, 1));
    const shield = new THREE.ShaderMaterial({
      vertexShader: SHIELD_VERT, fragmentShader: SHIELD_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uCol: {value: new THREE.Color(color)}, uPl: {value: new THREE.Color(plasmaColor)}, uT: {value: 0}, uSeedF: {value: seedF},
        uBright: {value: brightness}, uAppear: {value: 1},
        uImp: {value: Array.from({length: MAX_IMP}, () => new THREE.Vector4(0, 1, 0, -1))},
        uHit: {value: Array.from({length: MAX_ARC}, () => new THREE.Vector4(0, 1, 0, 0))},
      },
    });
    const coreMat = new THREE.ShaderMaterial({
      vertexShader: CORE_VERT, fragmentShader: CORE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {uPl: {value: new THREE.Color(plasmaColor)}, uT: {value: 0}, uSeedF: {value: seedF}, uBright: {value: brightness}, uOn: {value: 0}, uR: {value: coreR}},
    });
    const arcMat = new THREE.ShaderMaterial({
      vertexShader: RIBBON_VERT, fragmentShader: ARC_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: {uCap: {value: 0.5}, uWidth: {value: R * 0.012}, uViewH: {value: 1080}, uPl: {value: new THREE.Color(plasmaColor)}, uBright: {value: brightness}, uOn: {value: 0}},
    });
    const glow = new THREE.ShaderMaterial({
      vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      uniforms: {uSize: {value: R * 0.9}, uCol: {value: new THREE.Color(plasmaColor)}, uAmt: {value: 0}},
    });
    return {geo, shield, coreMat, arcMat, glow};
  }, [S, R, detail, color, plasmaColor, brightness, coreR]);

  // ---- 时间线 ----
  const ta = appearAt < 0 ? 100 : t - appearAt;
  const appear = smooth01(ta / 1.4);
  const coreOn = appearAt < 0 ? 1 : smooth01((ta - 0.9) / 0.6);
  const arcOn = appearAt < 0 ? 1 : smooth01((ta - 1.3) / 0.4);
  const U = built.shield.uniforms;
  U.uT.value = t;
  U.uAppear.value = appear;
  built.coreMat.uniforms.uT.value = t;
  built.coreMat.uniforms.uOn.value = coreOn;
  built.arcMat.uniforms.uOn.value = arcOn;
  built.arcMat.uniforms.uViewH.value = viewH;
  built.glow.uniforms.uAmt.value = coreOn * 0.7 * brightness;

  // 击中：第 k 次在 tk 秒、方向由种子决定；只取正在衰减的最近几次（成形后才开始）
  const imp = U.uImp.value as THREE.Vector4[];
  for (const v of imp) v.w = -1;
  if (impacts > 0) {
    const life = 2.5;
    const kNow = Math.floor(t * impacts);
    let slot = 0;
    for (let k = kNow; k >= 0 && slot < MAX_IMP; k--) {
      const tk = (k + 0.2 + 0.6 * random(`${S}-it${k}`)) / impacts;
      const age = t - tk;
      if (age < 0) continue;
      if (age > life) break;
      if (appearAt >= 0 && tk < appearAt + 1.4) continue;
      // 方向偏向镜头一侧（+z 半球）更容易看到
      const th = random(`${S}-ia${k}`) * Math.PI * 2;
      const y = random(`${S}-iy${k}`) * 1.6 - 0.8;
      const rr = Math.sqrt(1 - y * y);
      imp[slot++].set(Math.cos(th) * rr * 0.9, y, Math.abs(Math.sin(th)) * rr + 0.3, age);
    }
  }

  // 等离子电弧：每条的落点方向在球面上缓慢游走；形状每 3 帧换一次
  const arcGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const hits = U.uHit.value as THREE.Vector4[];
  for (const v of hits) v.w = 0;
  const segs: Seg[] = [];
  const spinA = spin * t;
  for (let i = 0; i < nArc; i++) {
    const a0 = random(`${S}-aa${i}`) * Math.PI * 2;
    const y0 = random(`${S}-ay${i}`) * 1.4 - 0.7;
    const sp = 0.25 + 0.3 * random(`${S}-as${i}`);
    const th = a0 + Math.sin(t * sp + i) * 0.6 + spinA;
    const y = Math.max(-0.95, Math.min(0.95, y0 + Math.sin(t * sp * 0.7 + i * 2.1) * 0.25));
    const rr = Math.sqrt(1 - y * y);
    const d: V3 = [Math.cos(th) * rr, y, Math.sin(th) * rr];
    const from: V3 = [d[0] * coreR * 0.95, d[1] * coreR * 0.95, d[2] * coreR * 0.95];
    const to: V3 = [d[0] * R * 0.995, d[1] * R * 0.995, d[2] * R * 0.995];
    const k = Math.floor(frame / 3);
    const bolt = makeBolt(from, to, `${S}-arc${i}-${k}`, {levels: 5, jag: 0.12, branch: 0.08, branchDepth: 1, bright: 0.8 + 0.4 * random(`${S}-ab${i}-${k}`)});
    segs.push(...bolt);
    hits[i].set(d[0], d[1], d[2], arcOn);
  }
  if (arcGeoRef.current) arcGeoRef.current.dispose();
  const arcGeo = segs.length ? buildRibbonGeometry(segs) : null;
  arcGeoRef.current = arcGeo;

  return (
    <group position={position}>
      {/* 护盾网格不转：击中点和电弧落点按资产自身坐标算，转了会对不上 */}
      <mesh geometry={built.geo} material={built.shield} frustumCulled={false} renderOrder={4} />
      {core && coreOn > 0 && (
        <>
          <mesh material={built.coreMat} frustumCulled={false} renderOrder={3}>
            <sphereGeometry args={[coreR, 64, 48]} />
          </mesh>
          <mesh material={built.glow} frustumCulled={false} renderOrder={2}>
            <planeGeometry args={[2, 2]} />
          </mesh>
        </>
      )}
      {arcGeo && arcOn > 0 && <mesh geometry={arcGeo} material={built.arcMat} frustumCulled={false} renderOrder={5} />}
      {haze > 0 && <BioMedium amount={haze} color={hazeColor} scale={R / 2} seed={`${S}-medium`} />}
    </group>
  );
};
