// 资产 biology.cell.v1：程序化动物细胞（半透明细胞膜里能看到细胞器）。参数见 registry.ts。
// 结构：
//   1. 细胞膜：高细分球，顶点着色器里用噪声做不规则外形 + 缓慢蠕动，法线差分重算；
//      半透明：中间很淡、边缘（菲涅尔）亮，先画内壁再画外壁；不写深度，后面的细胞器能透出来；
//   2. 细胞核：偏离中心的大球（轻微起伏），染色质纹理（紫色 fbm）+ 核孔点阵 + 边缘光，不透明；
//   3. 线粒体：InstancedMesh 胶囊体，表面有嵴的条纹，橙红；在核与膜之间随机分布、随机朝向，缓慢漂动；
//   4. 高尔基体：5 片弯曲压扁的弧形囊叠在一起，挨着细胞核；
//   5. 内质网：细胞核外几层起褶的薄层，用发光小点（核糖体）勾出来；
//   6. 囊泡 / 溶酶体：InstancedMesh 小球，两种颜色；
//   7. 胞质微粒：很淡的漂浮小点；
//   8. 可选体液环境（BioMedium）。
// 细胞器位置、朝向、外形全部 random(seed)；同帧结果确定。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import {useThree} from '@react-three/fiber';
import {NOISE_GLSL} from '../../../engine/shaders/noise.glsl';
import type {Vec3} from '../../../engine/shot';
import {BioMedium} from '../common/BioMedium';

export type CellProps = {
  position?: Vec3;
  radius?: number;
  squash?: number; // 竖向压扁（y 方向缩放）
  wobble?: number; // 膜蠕动幅度倍数
  mitochondria?: number;
  vesicles?: number;
  membraneColor?: string;
  nucleusColor?: string;
  mitoColor?: string;
  golgiColor?: string;
  erColor?: string;
  vesicleColor?: string;
  spin?: number; // 自转（弧度 / 秒）
  fog?: number;
  haze?: number;
  hazeColor?: string;
  seed?: string | number;
};

const SHADE_GLSL = /* glsl */ `
uniform vec3 uFogCol; uniform float uFogD;
vec3 shade(vec3 base, vec3 rim, vec3 n, vec3 v, float ao, float key) {
  vec3 L = normalize(vec3(-0.45, 0.65, 0.6));
  float wrap = clamp((dot(n, L) + 0.4) / 1.4, 0.0, 1.0);
  float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.4);
  vec3 H = normalize(L + v);
  float spec = pow(max(dot(n, H), 0.0), 40.0);
  vec3 col = base * (0.04 + key * wrap) * ao;
  col += base * base * 0.35 * (1.0 - wrap) * ao;
  col += rim * fres * 0.6;
  col += mix(vec3(1.0), base, 0.5) * spec * 0.15 * ao;
  return col;
}
vec3 fogit(vec3 col, float d) { return mix(uFogCol, col, exp(-max(d - 4.0, 0.0) * uFogD)); }
`;

// ---------- 细胞膜 ----------
const MEM_SURF = /* glsl */ `
uniform float uR; uniform float uT; uniform float uSeedF; uniform float uWob; uniform float uSquash;
${NOISE_GLSL}
vec3 surf(vec3 n) {
  float d = 0.11 * snoise(n * 1.3 + uSeedF) + 0.045 * snoise(n * 3.1 + uSeedF * 1.9)
          + uWob * 0.025 * snoise(n * 2.2 + vec3(0.0, uT * 0.18, uT * 0.11));
  vec3 p = n * uR * (1.0 + d);
  p.y *= uSquash;
  return p;
}
`;
const MEM_VERT = /* glsl */ `
${MEM_SURF}
varying vec3 vN; varying vec3 vV; varying vec3 vObj;
void main() {
  vec3 n = normalize(position);
  vec3 t1 = normalize(cross(n, abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 t2 = cross(n, t1);
  vec3 p = surf(n);
  vec3 N = normalize(cross(surf(normalize(n + t1 * 0.01)) - p, surf(normalize(n + t2 * 0.01)) - p));
  if (dot(N, n) < 0.0) N = -N;
  vObj = n;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vV = -mv.xyz; vN = normalize(normalMatrix * N);
  gl_Position = projectionMatrix * mv;
}`;
const MEM_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uInner; uniform float uSeedF2;
varying vec3 vN; varying vec3 vV; varying vec3 vObj;
${NOISE_GLSL}
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(vV);
  if (uInner > 0.5) n = -n;
  float fr = pow(1.0 - clamp(abs(dot(n, v)), 0.0, 1.0), 2.2);
  vec3 L = normalize(vec3(-0.45, 0.65, 0.6));
  float spec = pow(max(dot(n, normalize(L + v)), 0.0), 70.0);
  // 膜上的蛋白质颗粒 / 细纹
  float g = snoise(vObj * 26.0 + uSeedF2) * 0.5 + 0.5;
  float dots = smoothstep(0.78, 0.86, snoise(vObj * 55.0 + uSeedF2 * 2.0) * 0.5 + 0.5);
  float a = (0.05 + 0.75 * fr) * (0.85 + 0.3 * g) + 0.25 * dots * (0.3 + fr);
  a *= uInner > 0.5 ? 0.45 : 1.0;
  float sp = uInner > 0.5 ? 0.0 : spec;                       // 内壁不要高光（会在里面糊成白斑）
  vec3 c = uCol * (0.5 + 0.9 * fr) + mix(vec3(1.0), uCol, 0.4) * sp * 0.5;
  gl_FragColor = vec4(c, clamp(a + sp * 0.35, 0.0, 1.0));
}`;

// ---------- 细胞核 ----------
const NUC_VERT = /* glsl */ `
uniform float uT; uniform float uSeedF;
varying vec3 vN; varying vec3 vV; varying vec3 vObj;
${NOISE_GLSL}
void main() {
  vec3 n = normalize(position);
  float d = 0.05 * snoise(n * 1.8 + uSeedF + vec3(0.0, uT * 0.05, 0.0));
  vec3 p = position * (1.0 + d);
  vObj = n;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vV = -mv.xyz; vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`;
const NUC_FRAG = /* glsl */ `
uniform vec3 uCol; uniform vec3 uRim; uniform float uSeedF;
varying vec3 vN; varying vec3 vV; varying vec3 vObj;
${NOISE_GLSL}
${SHADE_GLSL}
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(vV);
  vec3 q = vObj * 3.0 + uSeedF;
  float chrom = snoise(q) * 0.5 + snoise(q * 2.3) * 0.3 + snoise(q * 5.1) * 0.2;
  float pores = smoothstep(0.82, 0.9, snoise(vObj * 34.0 + uSeedF) * 0.5 + 0.5);
  vec3 base = uCol * (0.75 + 0.45 * smoothstep(-0.4, 0.6, chrom));
  base = mix(base, vec3(0.08, 0.04, 0.15), pores * 0.8);
  vec3 col = shade(base, uRim, n, v, 1.0, 0.75);
  gl_FragColor = vec4(fogit(col, length(vV)), 1.0);
}`;

// ---------- Instanced 细胞器（线粒体 / 高尔基 / 囊泡） ----------
const ORG_VERT = /* glsl */ `
attribute vec4 aR; // x 随机数，y 颜色选择，z/w 备用
uniform float uT; uniform float uDrift;
varying vec3 vN; varying vec3 vV; varying vec3 vL; varying float vSel;
void main() {
  vL = position; vSel = aR.y;
  vec4 wp = instanceMatrix * vec4(position, 1.0);
  float ph = aR.x * 40.0;
  wp.xyz += vec3(sin(uT * 0.31 + ph), sin(uT * 0.23 + ph * 1.7), cos(uT * 0.27 + ph * 2.3)) * uDrift;
  vec4 mv = modelViewMatrix * wp;
  vV = -mv.xyz;
  vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * mv;
}`;
const ORG_FRAG = /* glsl */ `
uniform vec3 uCol; uniform vec3 uCol2; uniform vec3 uRim; uniform float uKind; uniform float uLen;
varying vec3 vN; varying vec3 vV; varying vec3 vL; varying float vSel;
${SHADE_GLSL}
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(vV);
  vec3 base = mix(uCol, uCol2, step(0.5, vSel));
  float ao = 1.0;
  if (uKind < 0.5) {
    // 线粒体：沿长轴的嵴条纹（略斜、不完全规则）
    float s = sin(vL.y / uLen * 30.0 + sin(vL.x / uLen * 9.0 + vL.z / uLen * 7.0) * 1.6);
    float cr = smoothstep(0.3, 0.95, s);
    base *= 0.82 + 0.28 * cr;
    ao = 0.88 + 0.12 * cr;
  }
  vec3 col = shade(base, uRim, n, v, ao, 0.6);
  col += base * 0.08;
  gl_FragColor = vec4(fogit(col, length(vV)), 1.0);
}`;

// ---------- 点：内质网核糖体 + 胞质微粒 ----------
const PTS_VERT = /* glsl */ `
attribute vec4 aP; // xyz 位置，w：<1 核糖体（值为随机数），>=1 胞质微粒
uniform float uT; uniform float uHalfH; uniform vec3 uEr; uniform float uSc;
varying vec3 vC; varying float vA;
float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
void main() {
  float w = aP.w; vec3 p = aP.xyz; float size;
  if (w < 1.0) {
    p += vec3(sin(uT * 0.4 + w * 50.0), cos(uT * 0.3 + w * 70.0), sin(uT * 0.35 + w * 90.0)) * 0.006 * uSc;
    vC = uEr; vA = 0.8 + 0.6 * h1(w * 13.0); size = 0.022 * uSc;
  } else {
    float r = fract(w);
    p += vec3(sin(uT * 0.21 + r * 31.0), sin(uT * 0.17 + r * 53.0), cos(uT * 0.19 + r * 71.0)) * 0.04 * uSc;
    vC = vec3(0.7, 0.85, 1.0); vA = 0.12 + 0.2 * h1(r * 7.0); size = 0.01 * uSc;
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float px = size * projectionMatrix[1][1] * uHalfH / -mv.z;
  if (px < 1.5) { vA *= px * px / 2.25; px = 1.5; }
  gl_PointSize = min(px, 16.0);
  gl_Position = projectionMatrix * mv;
}`;
const PTS_FRAG = /* glsl */ `
varying vec3 vC; varying float vA;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  gl_FragColor = vec4(vC * vA * exp(-r * r * 3.5) * (1.0 - smoothstep(0.85, 1.0, r)), 1.0);
}`;

const rnd = (k: string) => random(k);

export const CellAsset: React.FC<CellProps> = ({
  position = [0, 0, 0],
  radius = 2,
  squash = 0.85,
  wobble = 1,
  mitochondria = 16,
  vesicles = 40,
  membraneColor = '#86d8ff',
  nucleusColor = '#8a6cff',
  mitoColor = '#ff7f50',
  golgiColor = '#ffd166',
  erColor = '#5cc8ff',
  vesicleColor = '#6fffb0',
  spin = 0.05,
  fog = 1,
  haze = 0,
  hazeColor = '#0d3f6e',
  seed = 'cell',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {size, gl} = useThree();
  const t = frame / fps;
  const S = String(seed);
  const R = radius;
  const nMito = Math.max(0, Math.round(mitochondria));
  const nVes = Math.max(0, Math.round(vesicles));

  const built = useMemo(() => {
    const seedF = rnd(`cell-${S}`) * 100;
    const fogU = {uFogCol: {value: new THREE.Color(hazeColor).multiplyScalar(0.55)}, uFogD: {value: (0.1 * fog) / Math.max(R / 2, 0.05)}};
    const rimCol = new THREE.Color('#9fdcff').multiplyScalar(0.5);
    const T = {value: 0};
    // 细胞核位置：略偏离中心
    const na = rnd(`${S}-na`) * Math.PI * 2;
    const nucR = 0.36 * R;
    const nucC = new THREE.Vector3(Math.cos(na) * 0.16 * R, (rnd(`${S}-ny`) - 0.5) * 0.12 * R, Math.sin(na) * 0.16 * R);
    // 在「核外、膜内」随机取点（膜按 0.78R 的椭球近似，留出起伏余量）
    const inside = (key: string, minFromNuc: number, maxR = 0.78) => {
      for (let k = 0; k < 200; k++) {
        const p = new THREE.Vector3(rnd(`${key}-x${k}`) * 2 - 1, rnd(`${key}-y${k}`) * 2 - 1, rnd(`${key}-z${k}`) * 2 - 1).multiplyScalar(R);
        const e = new THREE.Vector3(p.x, p.y / squash, p.z).length() / R;
        if (e < maxR && p.distanceTo(nucC) > nucR + minFromNuc) return p;
      }
      return new THREE.Vector3(0.6 * R, 0, 0);
    };
    const randQuat = (key: string) =>
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(`${key}-a`) * 6.283, rnd(`${key}-b`) * 6.283, rnd(`${key}-c`) * 6.283));

    const mem = (inner: boolean) =>
      new THREE.ShaderMaterial({
        vertexShader: MEM_VERT, fragmentShader: MEM_FRAG, transparent: true, depthWrite: false,
        side: inner ? THREE.BackSide : THREE.FrontSide,
        uniforms: {uR: {value: R}, uT: T, uSeedF: {value: seedF}, uWob: {value: wobble}, uSquash: {value: squash},
          uCol: {value: new THREE.Color(membraneColor)}, uInner: {value: inner ? 1 : 0}, uSeedF2: {value: seedF * 1.7}},
      });
    const nucMat = new THREE.ShaderMaterial({
      vertexShader: NUC_VERT, fragmentShader: NUC_FRAG,
      uniforms: {uT: T, uSeedF: {value: seedF * 0.7}, uCol: {value: new THREE.Color(nucleusColor)}, uRim: {value: rimCol}, ...fogU},
    });
    const orgMat = (c1: string, c2: string, kind: number, len: number, drift: number) =>
      new THREE.ShaderMaterial({
        vertexShader: ORG_VERT, fragmentShader: ORG_FRAG,
        uniforms: {uT: T, uDrift: {value: drift * R}, uCol: {value: new THREE.Color(c1)}, uCol2: {value: new THREE.Color(c2)},
          uRim: {value: rimCol}, uKind: {value: kind}, uLen: {value: len}, ...fogU},
      });
    const mkInst = (geo: THREE.BufferGeometry, mat: THREE.ShaderMaterial, mats: THREE.Matrix4[], key: string, sel: (i: number) => number) => {
      const m = new THREE.InstancedMesh(geo, mat, Math.max(1, mats.length));
      mats.forEach((mm, i) => m.setMatrixAt(i, mm));
      m.count = mats.length;
      const a = new Float32Array(Math.max(1, mats.length) * 4);
      for (let i = 0; i < mats.length; i++) {
        a[i * 4] = rnd(`${key}-r${i}`);
        a[i * 4 + 1] = sel(i);
      }
      geo.setAttribute('aR', new THREE.InstancedBufferAttribute(a, 4));
      m.frustumCulled = false;
      return m;
    };
    // 线粒体
    const mLen = 0.17 * R;
    const mitoGeo = new THREE.CapsuleGeometry(0.05 * R, mLen, 8, 20);
    const mitoM: THREE.Matrix4[] = [];
    for (let i = 0; i < nMito; i++) {
      const p = inside(`${S}-mi${i}`, 0.12 * R, 0.7);
      const s = 0.75 + 0.5 * rnd(`${S}-ms${i}`);
      mitoM.push(new THREE.Matrix4().compose(p, randQuat(`${S}-mq${i}`), new THREE.Vector3(s, s * (0.8 + 0.6 * rnd(`${S}-ml${i}`)), s)));
    }
    const mito = mkInst(mitoGeo, orgMat(mitoColor, mitoColor, 0, mLen, 0.012), mitoM, `${S}-mito`, () => 0);
    // 高尔基体：5 片弯弧囊，叠在核旁边，朝向背离细胞核
    const gDir = new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), nucC).normalize();
    if (gDir.lengthSq() < 0.5) gDir.set(1, 0, 0);
    gDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (rnd(`${S}-ga`) - 0.5) * 2.0).normalize();
    const gBase = nucC.clone().addScaledVector(gDir, nucR + 0.12 * R);
    const gQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), gDir);
    const golgiGeo = new THREE.TorusGeometry(0.2 * R, 0.022 * R, 10, 40, 2.2);
    golgiGeo.rotateZ(Math.PI / 2 - 1.1);
    golgiGeo.rotateX(Math.PI / 2);
    golgiGeo.scale(1, 0.45, 1);
    const golgiM: THREE.Matrix4[] = [];
    for (let k = 0; k < 5; k++) {
      const s = 1 - k * 0.12;
      const p = gBase.clone().addScaledVector(gDir, k * 0.045 * R);
      golgiM.push(new THREE.Matrix4().compose(p, gQ, new THREE.Vector3(s, 1, s)));
    }
    const golgi = mkInst(golgiGeo, orgMat(golgiColor, golgiColor, 1, 1, 0.004), golgiM, `${S}-golgi`, () => 0);
    // 囊泡 / 溶酶体
    const vesGeo = new THREE.SphereGeometry(1, 20, 14);
    const vesM: THREE.Matrix4[] = [];
    for (let i = 0; i < nVes; i++) {
      const p = inside(`${S}-vi${i}`, 0.05 * R, 0.76);
      const s = (0.018 + 0.04 * Math.pow(rnd(`${S}-vs${i}`), 2)) * R;
      vesM.push(new THREE.Matrix4().compose(p, new THREE.Quaternion(), new THREE.Vector3(s, s, s)));
    }
    const ves = mkInst(vesGeo, orgMat(vesicleColor, '#c38bff', 2, 1, 0.02), vesM, `${S}-ves`, (i) => (rnd(`${S}-vc${i}`) > 0.7 ? 1 : 0));
    // 内质网核糖体：核外 3 层起褶薄层上的点 + 胞质微粒
    const pts: number[] = [];
    const ga = Math.PI * (3 - Math.sqrt(5));
    for (let layer = 0; layer < 3; layer++) {
      const n = 1700;
      for (let i = 0; i < n; i++) {
        const y = 1 - ((i + 0.5) / n) * 2;
        const rr = Math.sqrt(1 - y * y);
        const th = ga * i + layer * 1.3;
        const dir = new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr);
        // 起褶：按角度的正弦图案决定这里有没有膜片（断续的薄层）
        const fold = Math.sin(dir.x * 7 + layer * 2 + seedF) * Math.sin(dir.y * 6 - seedF * 0.7) * Math.sin(dir.z * 8 + layer);
        if (fold < 0.05) continue;
        const r = nucR * (1.18 + layer * 0.16) + Math.sin(th * 3.0 + dir.y * 9) * 0.02 * R;
        const p = nucC.clone().addScaledVector(dir, r);
        const e = new THREE.Vector3(p.x, p.y / squash, p.z).length() / R;
        if (e > 0.8) continue;
        pts.push(p.x, p.y, p.z, rnd(`${S}-er${layer}-${i}`) * 0.999);
      }
    }
    for (let i = 0; i < 900; i++) {
      const p = inside(`${S}-cp${i}`, 0.02 * R, 0.8);
      pts.push(p.x, p.y, p.z, 1 + rnd(`${S}-cw${i}`) * 0.999);
    }
    const nPts = pts.length / 4;
    const ptsGeo = new THREE.BufferGeometry();
    ptsGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nPts * 3), 3));
    ptsGeo.setAttribute('aP', new THREE.BufferAttribute(new Float32Array(pts), 4));
    const ptsMat = new THREE.ShaderMaterial({
      vertexShader: PTS_VERT, fragmentShader: PTS_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {uT: T, uHalfH: {value: 540}, uEr: {value: new THREE.Color(erColor)}, uSc: {value: R / 2}},
    });
    return {T, memIn: mem(true), memOut: mem(false), nucMat, nucC, nucR, mito, golgi, ves, ptsGeo, ptsMat};
  }, [S, R, squash, wobble, nMito, nVes, membraneColor, nucleusColor, mitoColor, golgiColor, erColor, vesicleColor, fog, hazeColor]);

  built.T.value = t;
  built.ptsMat.uniforms.uHalfH.value = (size.height * gl.getPixelRatio()) / 2;
  return (
    <group position={position}>
      <group rotation={[0, spin * t + rnd(`cell-rot-${S}`) * Math.PI * 2, 0]}>
        <mesh material={built.nucMat} position={built.nucC} frustumCulled={false}>
          <sphereGeometry args={[built.nucR, 96, 64]} />
        </mesh>
        <primitive object={built.mito} />
        <primitive object={built.golgi} />
        <primitive object={built.ves} />
        <points geometry={built.ptsGeo} material={built.ptsMat} frustumCulled={false} renderOrder={5} />
        <mesh material={built.memIn} frustumCulled={false} renderOrder={10}>
          <icosahedronGeometry args={[1, 48]} />
        </mesh>
        <mesh material={built.memOut} frustumCulled={false} renderOrder={11}>
          <icosahedronGeometry args={[1, 48]} />
        </mesh>
      </group>
      {haze > 0 && <BioMedium amount={haze} color={hazeColor} scale={R / 2} seed={`${S}-medium`} />}
    </group>
  );
};
