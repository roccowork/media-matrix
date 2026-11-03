// 资产 biology.virus.v1：程序化包膜病毒（冠状病毒式：球形脂质包膜 + 刺突蛋白 + 膜蛋白）。参数见 registry.ts。
// 结构：
//   1. 包膜：高细分二十面体球，顶点着色器里用噪声起伏（大起伏 + 细颗粒 + 很轻的呼吸），法线用相邻两点差分重算；
//      片元：脂质膜颗粒纹理、凹处压暗（AO）、包裹光照 + 次表面感 + 菲涅尔边缘光；
//   2. 刺突蛋白（S 蛋白）：InstancedMesh；一根细柄 + 三个椭球组成的冠头（三聚体）；
//      底座按同一个噪声函数贴在包膜表面，朝向沿法线带一点随机倾斜，越往上摆得越多（缓慢摇摆）；
//   3. 膜蛋白（M / E 蛋白）：InstancedMesh 小球，半埋在包膜里，强调色；
//   4. 可选体液环境（BioMedium：雾、远景光斑、微粒），只给主角那一个开。
// 全部写深度（不透明），post.dof 能按真实距离虚化。分布用斐波那契球 + 种子抖动；随机数全部 random(seed)。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import {NOISE_GLSL} from '../../../engine/shaders/noise.glsl';
import type {Vec3} from '../../../engine/shot';
import {BioMedium} from '../common/BioMedium';

export type VirusProps = {
  position?: Vec3;
  radius?: number;
  spikes?: number;
  spikeLength?: number;
  proteins?: number;
  envelopeColor?: string;
  spikeColor?: string;
  proteinColor?: string;
  bumpiness?: number;
  spin?: number; // 自转（弧度 / 秒）
  tilt?: number; // 自转轴倾斜（度）
  wobble?: number; // 刺突摇摆幅度倍数
  fog?: number; // 距离雾浓度倍数
  haze?: number; // 体液环境浓度，0 关闭
  hazeColor?: string;
  seed?: string | number;
};

// 共用：包膜表面位移（包膜、刺突、膜蛋白都用它，保证贴合）
const SURF_GLSL = /* glsl */ `
uniform float uR; uniform float uT; uniform float uSeedF; uniform float uBump;
${NOISE_GLSL}
float disp(vec3 n) {
  return uBump * (0.045 * snoise(n * 2.6 + uSeedF) + 0.018 * snoise(n * 7.5 + uSeedF * 1.7))
       + 0.004 * sin(uT * 1.1 + n.y * 3.0 + n.x * 2.0);
}
vec3 surf(vec3 n) { return n * uR * (1.0 + disp(n)); }
`;

const SHADE_GLSL = /* glsl */ `
uniform vec3 uFogCol; uniform float uFogD; uniform float uKey; uniform float uRimK;
vec3 shade(vec3 base, vec3 rim, vec3 n, vec3 v, float ao) {
  vec3 L = normalize(vec3(-0.45, 0.65, 0.6));
  float ndl = dot(n, L);
  float wrap = clamp((ndl + 0.4) / 1.4, 0.0, 1.0);
  float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.4);
  vec3 H = normalize(L + v);
  float spec = pow(max(dot(n, H), 0.0), 40.0);
  vec3 col = base * (0.03 + uKey * wrap) * ao;
  col += base * base * 0.35 * (1.0 - wrap) * ao;                 // 暗部透出饱和色（次表面感）
  vec3 L2 = normalize(vec3(0.7, -0.2, -0.6));                     // 背后冷色轮廓光
  col += rim * pow(max(dot(n, L2), 0.0), 2.0) * 0.5 * uRimK;
  col += rim * fres * 0.9 * uRimK;
  col += mix(vec3(1.0), base, 0.5) * spec * 0.15 * ao;
  return col;
}
vec3 fogit(vec3 col, float d) { return mix(uFogCol, col, exp(-max(d - 3.0, 0.0) * uFogD)); }
`;

// ---------- 包膜 ----------
const ENV_VERT = /* glsl */ `
${SURF_GLSL}
varying vec3 vN; varying vec3 vV; varying vec3 vObj; varying float vD;
void main() {
  vec3 n = normalize(position);
  vec3 t1 = normalize(cross(n, abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 t2 = cross(n, t1);
  float e = 0.01;
  vec3 p = surf(n);
  vec3 pa = surf(normalize(n + t1 * e));
  vec3 pb = surf(normalize(n + t2 * e));
  vec3 N = normalize(cross(pa - p, pb - p));
  if (dot(N, n) < 0.0) N = -N;
  vObj = n; vD = disp(n);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vV = -mv.xyz; vN = normalize(normalMatrix * N);
  gl_Position = projectionMatrix * mv;
}`;
const ENV_FRAG = /* glsl */ `
uniform vec3 uCol; uniform vec3 uRim; uniform float uSeedF2; uniform float uBump;
varying vec3 vN; varying vec3 vV; varying vec3 vObj; varying float vD;
${NOISE_GLSL}
${SHADE_GLSL}
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(vV);
  // 脂质膜颗粒：高频噪声做细小凹凸色差
  float g = snoise(vObj * 38.0 + uSeedF2) * 0.5 + snoise(vObj * 90.0) * 0.25;
  float ao = clamp(0.62 + vD / max(uBump, 0.05) * 7.0, 0.35, 1.1);     // 凹处压暗
  vec3 base = uCol * (0.9 + 0.12 * g);
  vec3 col = shade(base, uRim, n, v, ao);
  gl_FragColor = vec4(fogit(col, length(vV)), 1.0);
}`;

// ---------- 刺突 / 膜蛋白（Instanced，位置在着色器里算） ----------
const INST_VERT = /* glsl */ `
${SURF_GLSL}
attribute vec3 aDir; attribute vec4 aRnd; // aRnd: x 扭转角，y 长度倍数，z/w 倾斜
uniform float uLen; uniform float uWob; uniform float uSink; uniform float uIsSpike;
varying vec3 vN; varying vec3 vV; varying float vH;
void main() {
  vec3 n = normalize(aDir);
  vec3 a = normalize(cross(n, abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 b = cross(n, a);
  vec3 up = normalize(n + (a * aRnd.z + b * aRnd.w) * 0.35 * uIsSpike);
  vec3 tx = normalize(cross(up, abs(up.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 tz = cross(up, tx);
  float cs = cos(aRnd.x), sn = sin(aRnd.x);
  vec3 X = tx * cs + tz * sn; vec3 Z = -tx * sn + tz * cs;
  vec3 lp = position * uR;
  float h = position.y * uLen * aRnd.y;
  // 摇摆：越往上偏得越多
  float hn = clamp(position.y / 0.26, 0.0, 1.0);
  float ph = aRnd.x * 3.0 + aRnd.z * 5.0;
  vec2 sway = vec2(sin(uT * 0.9 + ph), cos(uT * 0.7 + ph * 1.3)) * 0.035 * uWob * hn * hn * uIsSpike;
  vec3 p = surf(n) - n * uSink * uR + X * (lp.x + sway.x * uR) + up * (h * uR) + Z * (lp.z + sway.y * uR);
  vec3 nn = X * normal.x + up * normal.y + Z * normal.z;
  vH = hn;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vV = -mv.xyz; vN = normalize(normalMatrix * nn);
  gl_Position = projectionMatrix * mv;
}`;
const INST_FRAG = /* glsl */ `
uniform vec3 uCol; uniform vec3 uRim; uniform float uIsSpike;
varying vec3 vN; varying vec3 vV; varying float vH;
${SHADE_GLSL}
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(vV);
  float ao = uIsSpike > 0.5 ? mix(0.45, 1.05, smoothstep(0.0, 0.8, vH)) : 0.9;   // 刺突根部压暗
  vec3 col = shade(uCol, uRim, n, v, ao);
  gl_FragColor = vec4(fogit(col, length(vV)), 1.0);
}`;

// 刺突几何（单位：包膜半径 = 1；沿 +y）：细柄 + 三聚体冠头
const makeSpikeGeo = () => {
  const parts: THREE.BufferGeometry[] = [];
  const stalk = new THREE.CylinderGeometry(0.016, 0.024, 0.15, 10, 4);
  stalk.translate(0, 0.075, 0);
  parts.push(stalk);
  for (let k = 0; k < 3; k++) {
    const s = new THREE.SphereGeometry(0.042, 18, 14);
    s.scale(1, 1.45, 1);
    const a = (k / 3) * Math.PI * 2;
    s.rotateZ(Math.cos(a) * -0.25);
    s.rotateX(Math.sin(a) * 0.25);
    s.translate(Math.cos(a) * 0.03, 0.2, Math.sin(a) * 0.03);
    parts.push(s);
  }
  const cap = new THREE.SphereGeometry(0.035, 14, 10);
  cap.translate(0, 0.25, 0);
  parts.push(cap);
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
};

const fibDirs = (n: number, seed: string, jitter: number) => {
  const out: number[] = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5) / n) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = ga * i;
    let x = Math.cos(th) * r, z = Math.sin(th) * r, yy = y;
    x += (random(`${seed}-jx${i}`) - 0.5) * jitter;
    yy += (random(`${seed}-jy${i}`) - 0.5) * jitter;
    z += (random(`${seed}-jz${i}`) - 0.5) * jitter;
    const l = Math.hypot(x, yy, z);
    out.push(x / l, yy / l, z / l);
  }
  return out;
};

export const VirusAsset: React.FC<VirusProps> = ({
  position = [0, 0, 0],
  radius = 1,
  spikes = 70,
  spikeLength = 1,
  proteins = 140,
  envelopeColor = '#8fa6bd',
  spikeColor = '#d8443a',
  proteinColor = '#f0b23e',
  bumpiness = 1,
  spin = 0.12,
  tilt = 18,
  wobble = 1,
  fog = 1,
  haze = 0,
  hazeColor = '#0d3f6e',
  seed = 'virus',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const S = String(seed);
  const nS = Math.max(0, Math.round(spikes));
  const nM = Math.max(0, Math.round(proteins));
  const built = useMemo(() => {
    const seedF = random(`virus-${S}`) * 100;
    const fogCol = new THREE.Color(hazeColor).multiplyScalar(0.55);
    const surfU = {uR: {value: radius}, uT: {value: 0}, uSeedF: {value: seedF}, uBump: {value: bumpiness}};
    const shadeU = {uFogCol: {value: fogCol}, uFogD: {value: 0.12 * fog}};
    const rimCol = new THREE.Color('#9fdcff');
    const env = new THREE.ShaderMaterial({
      vertexShader: ENV_VERT, fragmentShader: ENV_FRAG,
      uniforms: {...surfU, ...shadeU, uCol: {value: new THREE.Color(envelopeColor)}, uRim: {value: rimCol.clone().multiplyScalar(0.6)}, uSeedF2: {value: seedF * 1.3}, uKey: {value: 0.85}, uRimK: {value: 1}},
    });
    const instMat = (col: string, isSpike: boolean, len: number, sink: number) =>
      new THREE.ShaderMaterial({
        vertexShader: INST_VERT, fragmentShader: INST_FRAG,
        uniforms: {
          ...surfU, ...shadeU, uCol: {value: new THREE.Color(col)}, uRim: {value: rimCol.clone().multiplyScalar(isSpike ? 0.5 : 0.3)},
          uLen: {value: len}, uWob: {value: wobble}, uSink: {value: sink}, uIsSpike: {value: isSpike ? 1 : 0},
          uKey: {value: 0.55}, uRimK: {value: 0.45},
        },
      });
    const mk = (geo: THREE.BufferGeometry, n: number, dirs: number[], key: string) => {
      const g = geo.clone();
      const ig = new THREE.InstancedBufferGeometry();
      ig.index = g.index;
      ig.setAttribute('position', g.getAttribute('position'));
      ig.setAttribute('normal', g.getAttribute('normal'));
      const rnd = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        rnd[i * 4] = random(`${S}-${key}-tw${i}`) * Math.PI * 2;
        rnd[i * 4 + 1] = 0.85 + 0.3 * random(`${S}-${key}-l${i}`);
        rnd[i * 4 + 2] = random(`${S}-${key}-a${i}`) - 0.5;
        rnd[i * 4 + 3] = random(`${S}-${key}-b${i}`) - 0.5;
      }
      ig.setAttribute('aDir', new THREE.InstancedBufferAttribute(new Float32Array(dirs), 3));
      ig.setAttribute('aRnd', new THREE.InstancedBufferAttribute(rnd, 4));
      ig.instanceCount = n;
      return ig;
    };
    const spikeGeo = mk(makeSpikeGeo(), nS, fibDirs(nS, `${S}-s`, 0.18), 's');
    const protGeo = mk(new THREE.SphereGeometry(0.05, 14, 10), nM, fibDirs(nM, `${S}-m`, 0.35), 'm');
    const spikeMat = instMat(spikeColor, true, spikeLength, 0.01);
    const protMat = instMat(proteinColor, false, 1, 0.012);
    return {env, spikeGeo, protGeo, spikeMat, protMat, all: [env, spikeMat, protMat]};
  }, [S, radius, bumpiness, fog, hazeColor, envelopeColor, spikeColor, proteinColor, spikeLength, wobble, nS, nM]);
  for (const m of built.all) m.uniforms.uT.value = t;
  return (
    <group position={position}>
      <group rotation={[(tilt * Math.PI) / 180, 0, 0]}>
        <group rotation={[0, spin * t + random(`virus-rot-${S}`) * Math.PI * 2, 0]}>
          <mesh material={built.env} frustumCulled={false}>
            <icosahedronGeometry args={[1, 40]} />
          </mesh>
          {nS > 0 && <mesh geometry={built.spikeGeo} material={built.spikeMat} frustumCulled={false} />}
          {nM > 0 && <mesh geometry={built.protGeo} material={built.protMat} frustumCulled={false} />}
        </group>
      </group>
      {haze > 0 && <BioMedium amount={haze} color={hazeColor} scale={radius} seed={`${S}-medium`} />}
    </group>
  );
};
