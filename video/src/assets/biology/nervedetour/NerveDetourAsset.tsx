// 资产 biology.nervedetour.v1：喉返神经「绕远路」示意（3D 透视身体，第 10–11 镜）。参数见 registry.ts。
// 《方案补充》#29：长颈鹿 / 鱼用代码生成立体身体——半透明、边缘发光的 X 光透视质感（长颈鹿身上隐约有斑块纹），
//   里面是立体的脑、喉、心脏、主动脉弓（实体着色）和发光的喉返神经：
//   脑 → 沿脖子一路往下 → 在胸腔里从主动脉弓下方钩过 → 沿脖子折回往上 → 喉；虚线是「直走」的距离（脑 → 喉）。
// 动画：脖子长度从 startNeck 长到 endNeck（growAt 起 growDuration 秒）；fishStart = true 时从鱼开始：
//   鱼身淡出、长颈鹿身体淡入（腿从短长到正常），脑 / 喉 / 心脏的位置从鱼的头部平滑移到长颈鹿的位置；
//   光脉冲沿神经从脑走到喉（pulseAt 起，pulseTime 秒走完，不论神经多长）。
// 坐标：米，侧面在 x-y 平面（头朝 +x，背朝 +y，身体左侧朝 +z / 镜头），地面 y = −2.05；外形简化，示意（片中注明）。
// 随脖子长度变化的部分（脖子、神经）每帧重建，其余几何只建一次；全部由帧驱动，确定性。
import React, {useEffect, useMemo} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import type {Vec3} from '../../../engine/shot';

export type NerveDetourProps = {
  position?: Vec3;
  scale?: number;
  startNeck?: number;
  endNeck?: number;
  growAt?: number;
  growDuration?: number;
  fishStart?: boolean;
  pulseAt?: number;
  pulseTime?: number;
  direct?: boolean;
  bodyColor?: string;
  nerveColor?: string;
};

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const V = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);

// ---------- 着色器 ----------
const VERT = /* glsl */ `
varying vec3 vN; varying vec3 vW; varying vec3 vL; varying vec2 vUv;
void main() {
  vL = position; vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
// X 光透视身体：边缘亮、中间几乎透明；可选长颈鹿斑块纹（Voronoi 边界）
const XRAY_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uAlpha; uniform float uPatch;
varying vec3 vN; varying vec3 vW; varying vec3 vL;
vec2 h22(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
float voro(vec2 p) {
  vec2 i = floor(p), f = fract(p); float d1 = 9.0, d2 = 9.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y)); vec2 o = h22(i + g);
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return d2 - d1;
}
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vW);
  float f = 1.0 - abs(dot(n, v));
  float rim = pow(f, 2.6);
  vec3 L = normalize(vec3(-0.4, 0.8, 0.5));
  float lit = 0.5 + 0.5 * dot(n, L);
  float a = (0.035 + 0.75 * rim) * uAlpha;
  vec3 col = uCol * (0.6 + 0.6 * lit);
  if (uPatch > 0.0) {
    float e = 1.0 - smoothstep(0.03, 0.12, voro(vL.xy * 3.2 + vL.z * 1.5));   // 斑块之间的浅色网纹（大块、淡）
    col = mix(col, vec3(1.0, 0.75, 0.42), e * 0.3 * uPatch);
    a += e * 0.045 * uAlpha * uPatch;
  }
  gl_FragColor = vec4(col * a, 1.0);
}`;
// 实体器官：主光 + 补光 + 高光 + 边缘光
const SOLID_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uAlpha;
varying vec3 vN; varying vec3 vW;
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vW);
  vec3 L1 = normalize(vec3(-0.4, 0.8, 0.6)), L2 = normalize(vec3(0.6, -0.3, 0.4));
  float d = clamp((dot(n, L1) + 0.3) / 1.3, 0.0, 1.0);
  float s = pow(max(dot(n, normalize(L1 + v)), 0.0), 40.0);
  float fr = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.5);
  vec3 col = uCol * (0.15 + 0.9 * d + 0.25 * max(dot(n, L2), 0.0)) + 0.35 * s + uCol * fr * 0.6;
  gl_FragColor = vec4(col * uAlpha, 1.0);
}`;
// 发光神经：光团 + 走过的部分更亮；uDash > 0 画虚线
const GLOW_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uAlpha; uniform float uPulse; uniform float uLen; uniform float uDash;
varying vec3 vN; varying vec3 vW; varying vec2 vUv;
void main() {
  float u = vUv.x;
  if (uDash > 0.0 && fract(u * uLen / uDash) > 0.55) discard;
  vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vW);
  float core = 0.6 + 0.4 * abs(dot(n, v));
  vec3 col = uCol * uAlpha * core;
  if (uPulse >= 0.0) {
    float d = (u - uPulse) * uLen;
    col += uCol * exp(-d * d / 0.006) * 6.0;
    col += uCol * 0.7 * step(u, uPulse);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const xray = (hex: string, patch: number) => new THREE.ShaderMaterial({vertexShader: VERT, fragmentShader: XRAY_FRAG, side: THREE.DoubleSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  uniforms: {uCol: {value: new THREE.Color(hex)}, uAlpha: {value: 1}, uPatch: {value: patch}}});
const solid = (hex: string) => new THREE.ShaderMaterial({vertexShader: VERT, fragmentShader: SOLID_FRAG, transparent: true, uniforms: {uCol: {value: new THREE.Color(hex)}, uAlpha: {value: 1}}});
const glow = (hex: string, dash = 0) => new THREE.ShaderMaterial({vertexShader: VERT, fragmentShader: GLOW_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  uniforms: {uCol: {value: new THREE.Color(hex)}, uAlpha: {value: 0.8}, uPulse: {value: -1}, uLen: {value: 1}, uDash: {value: dash}}});

// 沿路径扫一个圆，半径按 r(u) 变化（u = 0…1）
const sweep = (pts: THREE.Vector3[], r: (u: number) => number, seg = 64, rad = 16, closeEnds = true) => {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  const g = new THREE.TubeGeometry(curve, seg, 1, rad, false);
  const pos = g.attributes.position, uv = g.attributes.uv;
  const c = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i);
    curve.getPointAt(Math.min(1, u), c);
    p.fromBufferAttribute(pos, i).sub(c).multiplyScalar(r(u)).add(c);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  g.computeVertexNormals();
  if (!closeEnds) return g;
  const caps = [0, 1].map((u) => {
    const s = new THREE.SphereGeometry(r(u) * 0.98, rad, 8);
    s.translate(...curve.getPointAt(u).toArray());
    return s;
  });
  return mergeGeometries([g.toNonIndexed(), ...caps.map((s) => s.toNonIndexed())])!;
};
const ellipsoid = (c: THREE.Vector3, r: Vec3, rotZ = 0) => {
  const g = new THREE.SphereGeometry(1, 48, 32);
  g.scale(...r);
  g.rotateZ(rotZ);
  g.translate(c.x, c.y, c.z);
  return g.toNonIndexed();
};

// ---------- 静态几何：长颈鹿身体（除脖子）、鱼 ----------
const NB = V(0.74, 0.3);            // 脖子根部中心
const NB_R = 0.2;                   // 脖子根部半径
const tilt = THREE.MathUtils.degToRad(32);
const DIR = V(Math.sin(tilt), Math.cos(tilt));
const FWD = V(DIR.y, -DIR.x);       // 脖子前侧（右下）

const giraffeBody = () => {
  const parts: THREE.BufferGeometry[] = [];
  // 躯干：沿脊柱放样成一整块（避免几个椭球叠在一起、透明时露出接缝）；前高后低，胸深，截面竖向偏高
  const torso = sweep([V(-1.0, 0.03), V(-0.6, 0.04), V(0.0, 0.03), V(0.5, 0.12), V(0.95, 0.14)],
    (u) => 0.005 + 0.4 * Math.pow(Math.sin(Math.PI * u), 0.5) * (u > 0.55 ? 1 - 0.18 * (u - 0.55) : 1), 64, 24, false);   // 两端收尖，不留管口
  torso.scale(1, 1, 0.8);
  parts.push(torso.toNonIndexed());
  // 腿：上粗下细，前腿膝向前、后腿跗关节向后；局部从 y = 0 往下，按 landness 缩放
  const leg = (x: number, z: number, hind: boolean) =>
    sweep([V(x, -0.05, z), V(x + (hind ? -0.07 : 0.03), -0.95, z), V(x + (hind ? 0.02 : 0.0), -1.55, z), V(x, -2.0, z)],
      (u) => (u < 0.4 ? 0.085 - 0.07 * u : u < 0.92 ? 0.05 - 0.02 * (u - 0.4) : 0.042), 48, 12, false);
  const legs = [leg(0.5, 0.17, false), leg(0.6, -0.17, false), leg(-0.55, 0.16, true), leg(-0.45, -0.16, true)];
  const tail = sweep([V(-0.86, 0.12), V(-0.98, -0.25), V(-1.0, -0.62)], () => 0.02, 24, 8);
  const tuft = ellipsoid(V(-1.0, -0.7), [0.04, 0.09, 0.04]);
  return {torso: mergeGeometries(parts)!, legs: mergeGeometries(legs)!, tail: mergeGeometries([tail, tuft])!};
};

const giraffeHead = () => {
  // 局部坐标：原点在脖子顶端，u 朝前下（口鼻），v 朝上
  const parts: THREE.BufferGeometry[] = [];
  parts.push(ellipsoid(V(0.08, 0.04), [0.17, 0.11, 0.1], -0.36));                       // 头颅
  parts.push(ellipsoid(V(0.3, -0.05), [0.16, 0.075, 0.075], -0.36));                    // 口鼻
  for (const z of [0.05, -0.05]) {                                                     // 两只角（顶端圆球）
    parts.push(sweep([V(0.02, 0.12, z), V(0.0, 0.24, z * 1.3)], () => 0.017, 8, 8));
    parts.push(ellipsoid(V(0.0, 0.25, z * 1.3), [0.026, 0.026, 0.026]));
  }
  for (const z of [0.08, -0.08]) parts.push(ellipsoid(V(-0.06, 0.12, z * 1.3), [0.07, 0.025, 0.035], 0.5));   // 耳朵
  return mergeGeometries(parts)!;
};

const fishBody = () => {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(ellipsoid(V(0.05, 0.0), [1.0, 0.32, 0.22]));                               // 纺锤形身体
  const fin = (pts: [number, number][], z = 0, thick = 0.02) => {
    const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(sh, {depth: thick, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: 12});
    g.translate(0, 0, z - thick / 2);
    return g.toNonIndexed();
  };
  parts.push(fin([[-0.88, 0], [-1.28, 0.32], [-1.16, 0], [-1.28, -0.32]]));             // 尾鳍
  parts.push(fin([[-0.2, 0.28], [0.05, 0.56], [0.32, 0.3]]));                           // 背鳍
  parts.push(fin([[0.4, -0.12], [0.22, -0.34], [0.5, -0.2]], 0.2, 0.015));              // 胸鳍
  parts.push(fin([[-0.2, -0.26], [-0.32, -0.42], [-0.05, -0.3]]));                      // 腹鳍
  return mergeGeometries(parts)!;
};
// 鳃裂：鱼身左侧表面的五道弧（发光）
const gillGeo = () => mergeGeometries(Array.from({length: 5}, (_, i) => {
  const x = 0.6 - i * 0.06;
  const pts = [V(x + 0.02, 0.13, 0.13), V(x - 0.01, 0.0, 0.19), V(x + 0.02, -0.13, 0.13)];
  return sweep(pts, () => 0.008, 16, 6, false).toNonIndexed();
}))!;

const heartGeo = () => {
  // 心脏：两个心室 + 心房，略微倾斜
  const parts = [ellipsoid(V(0, 0), [0.1, 0.13, 0.09], 0.5), ellipsoid(V(-0.05, 0.07), [0.07, 0.07, 0.07]), ellipsoid(V(0.05, 0.08), [0.065, 0.06, 0.065])];
  return mergeGeometries(parts)!;
};
const archGeo = (r: number) => {
  // 主动脉弓：从心脏前上方升起，向后弯过去再往下（x-y 平面里的半圆，略向 −z 偏）
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI * (i / 16);
    pts.push(V(r * Math.cos(a), r * 0.85 * Math.sin(a), -0.02 * Math.sin(a)));
  }
  pts.push(V(-r, -0.15, 0));
  return sweep(pts, () => 0.03, 48, 12);
};
const ring = (r: number, t: number) => new THREE.TorusGeometry(r, t, 12, 32).toNonIndexed();

export const NerveDetourAsset: React.FC<NerveDetourProps> = ({
  position = [0, 0, 0],
  scale = 1,
  startNeck = 0.3,
  endNeck = 1.8,
  growAt = -1,
  growDuration = 4,
  fishStart = false,
  pulseAt = -1,
  pulseTime = 2.5,
  direct = true,
  bodyColor = '#5fcfff',
  nerveColor = '#ffcf5a',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;

  const R = useMemo(() => {
    const g = giraffeBody();
    return {
      g, head: giraffeHead(), fish: fishBody(), gills: gillGeo(), heart: heartGeo(), brain: ellipsoid(V(0, 0), [0.055, 0.04, 0.045]), larynx: ring(0.03, 0.009),
      mats: {
        body: xray(bodyColor, 1), fish: xray(bodyColor, 0), gills: glow(bodyColor),
        heart: solid('#d8323f'), aorta: solid('#e2484a'), brain: solid('#f2a3c0'), larynx: solid('#f2f2f2'),
        nerve: glow(nerveColor), direct: glow('#ffffff', 0.05),
      },
    };
  }, [bodyColor, nerveColor]);

  const k = growAt < 0 ? 1 : ease((t - growAt) / Math.max(growDuration, 0.01));
  const L = startNeck + (endNeck - startNeck) * k;
  const fishness = fishStart ? 1 - Math.min(1, k * 1.6) : 0;
  const land = 1 - fishness;

  // 脖子顶端、头的姿态
  const top = NB.clone().addScaledVector(DIR, L);
  const headQ = new THREE.Quaternion();                     // 头的局部 u 轴 = (cos(−20°), sin(−20°))，已在几何里体现，这里不再旋转
  // 器官位置：鱼 ↔ 长颈鹿之间插值
  const lerpV = (a: THREE.Vector3, b: THREE.Vector3, m: number) => a.clone().lerp(b, m);
  const brainP = lerpV(V(0.8, 0.12, 0.0), top.clone().add(V(0.06, 0.06, 0)), land);
  const larP = lerpV(V(0.62, -0.06, 0.0), top.clone().addScaledVector(DIR, -0.08).addScaledVector(FWD, 0.07), land);
  const heartP = lerpV(V(0.46, -0.16, 0), V(0.5, -0.04, 0), land);   // 长颈鹿：两条前腿之间的胸腔里
  const hs = 0.6 + 0.4 * land;                               // 鱼的心脏小一些
  const archR = 0.13 * hs;

  const dyn = useMemo(() => {
    // 脖子：根部粗、顶端细
    const neck = L > 0.02 ? sweep([NB.clone().addScaledVector(DIR, -0.12), NB.clone().addScaledVector(DIR, L * 0.5), top], (u) => NB_R - (NB_R - 0.09) * u, 48, 18, false) : null;
    // 神经：脑 → 脖子后侧往下（z 偏向镜头一侧）→ 主动脉弓外侧 → 弓下方钩过 → 弓内侧 → 脖子前侧往上 → 喉
    const back = (s: number, z: number) => NB.clone().addScaledVector(DIR, s).addScaledVector(FWD, -(NB_R - (NB_R - 0.09) * s / Math.max(L, 1e-3)) * 0.4).setZ(z);
    const front = (s: number, z: number) => NB.clone().addScaledVector(DIR, s).addScaledVector(FWD, (NB_R - (NB_R - 0.09) * s / Math.max(L, 1e-3)) * 0.35).setZ(z);
    const aTop = heartP.clone().add(V(0, 0.11 * hs));
    const pts: THREE.Vector3[] = [brainP.clone()];
    if (L > 0.12) for (let s = L - 0.05; s > 0.06; s -= 0.12) pts.push(back(s, 0.05));
    pts.push(aTop.clone().add(V(-archR - 0.05, archR * 0.4, 0.06)), aTop.clone().add(V(-archR * 0.6, -0.05, 0.07)), aTop.clone().add(V(0, -0.09 * hs, 0.04)),
      aTop.clone().add(V(archR * 0.5, -0.06, 0.0)), aTop.clone().add(V(archR + 0.04, archR * 0.5, -0.02)));
    if (L > 0.12) for (let s = 0.1; s < L - 0.06; s += 0.12) pts.push(front(s, 0.0));
    pts.push(larP.clone());
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
    const len = curve.getLength();
    const nerve = new THREE.TubeGeometry(curve, Math.max(40, Math.round(len * 160)), 0.014, 10, false);
    const dline = new THREE.LineCurve3(brainP, larP);
    const dlen = dline.getLength();
    const dgeo = new THREE.TubeGeometry(dline, 24, 0.007, 6, false);
    const arch = archGeo(archR);
    arch.translate(aTop.x, aTop.y - archR * 0.2, aTop.z);
    return {neck, nerve, len, dgeo, dlen, arch};
  }, [L, land]);
  useEffect(() => () => { dyn.neck?.dispose(); dyn.nerve.dispose(); dyn.dgeo.dispose(); dyn.arch.dispose(); }, [dyn]);

  const {mats} = R;
  mats.body.uniforms.uAlpha.value = land;
  mats.fish.uniforms.uAlpha.value = fishness;
  mats.gills.uniforms.uAlpha.value = 0.9 * fishness;
  mats.nerve.uniforms.uLen.value = dyn.len;
  mats.nerve.uniforms.uPulse.value = pulseAt < 0 ? -1 : Math.min(1.2, Math.max(0, (t - pulseAt) / Math.max(pulseTime, 0.01)));
  mats.direct.uniforms.uLen.value = dyn.dlen;
  mats.direct.uniforms.uAlpha.value = 0.55;

  return (
    <group position={position} scale={scale}>
      {/* 实体器官先画（写深度），透视身体和发光线后画（加色、不写深度） */}
      <mesh geometry={R.heart} material={mats.heart} position={heartP} scale={hs} />
      <mesh geometry={dyn.arch} material={mats.aorta} />
      <mesh geometry={R.brain} material={mats.brain} position={brainP} />
      <mesh geometry={R.larynx} material={mats.larynx} position={larP} rotation={[0, Math.PI / 2, 0]} />
      <mesh geometry={dyn.nerve} material={mats.nerve} renderOrder={5} frustumCulled={false} />
      {direct && <mesh geometry={dyn.dgeo} material={mats.direct} renderOrder={5} frustumCulled={false} />}
      {land > 0.01 && (
        <group>
          <mesh geometry={R.g.torso} material={mats.body} renderOrder={2} />
          <mesh geometry={R.g.tail} material={mats.body} renderOrder={2} />
          {/* 腿：从身体下沿往下长，长度随 land */}
          <mesh geometry={R.g.legs} material={mats.body} renderOrder={2} scale={[1, 0.25 + 0.75 * land, 1]} position={[0, -0.2 * (0.75 - 0.75 * land), 0]} />
          {dyn.neck && <mesh geometry={dyn.neck} material={mats.body} renderOrder={2} frustumCulled={false} />}
          <mesh geometry={R.head} material={mats.body} renderOrder={2} position={top} quaternion={headQ} />
        </group>
      )}
      {fishness > 0.01 && (
        <group>
          <mesh geometry={R.fish} material={mats.fish} renderOrder={2} />
          <mesh geometry={R.gills} material={mats.gills} renderOrder={3} />
        </group>
      )}
    </group>
  );
};
