// 资产 cosmos.galaxyeye.v1：星光之眼（《一百年后》第 12 镜「它，在等我们」）。
// 星系里的光点先外后内、打着旋被吸向银心（同时一层暗幕从外向内把星系盘面的光「吸走」），
// 落到一个正对镜头的平面上，汇成一只巨大的眼睛：先是一道发光的细缝（闭着的眼），再缓缓睁开——
// 虹膜是一圈圈放射状的光丝（内金外青），瞳孔深黑并慢慢收缩，眼眶内是压暗的深蓝，上下眼睑边缘是发光的轮廓线。
// 组成：① 暗幕（星系平面上的圆盘，普通混合压暗）② 眼睛面片（预乘透明：瞳孔 / 眼白挡住背景，虹膜光丝和眼睑轮廓自发光）
// ③ GPU 粒子（起点在星系旋臂上，按时间算贝塞尔轨迹飞到眼睛上的目标点；目标点随眼睑开合实时计算）。
// 随机数全部来自 random(seed) / 着色器噪声，同帧确定。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import {NOISE_GLSL} from '../../../engine/shaders/noise.glsl';
import type {Vec3} from '../../../engine/shot';

export type GalaxyEyeProps = {
  position?: Vec3; // 眼睛中心（= 星系中心）
  facing?: Vec3; // 眼睛朝向（一般指向镜头终点位置）
  size?: number; // 眼睛半宽（世界单位）
  galaxyRadius?: number; // 星系半径（与 cosmos.galaxy.v1 一致）
  galaxyTilt?: number; // 星系盘面倾角（度）
  arms?: number;
  twist?: number;
  galaxySeed?: string | number; // 填 cosmos.galaxy.v1 的 seed：光点从它的旋臂上出发
  count?: number;
  gatherAt?: number; // 开始汇聚（秒）
  gatherDuration?: number; // 汇聚用时（秒，先外后内）
  openAt?: number; // 开始睁眼（秒）
  openDuration?: number;
  opening?: number; // 睁开后上眼睑高度（相对半宽）
  veil?: number; // 暗幕把星系盘面压暗的程度（0–1）
  irisColor?: string; // 虹膜外圈
  innerColor?: string; // 虹膜内圈（瞳孔边）
  lidColor?: string; // 眼睑轮廓
  brightness?: number;
  seed?: string | number;
};

const EYE_GLSL = /* glsl */ `
float upperLid(float x, float A) { return A * pow(max(0.0, 1.0 - x * x), 0.9); }
float lowerLid(float x, float A) { return 0.8 * A * pow(max(0.0, 1.0 - x * x), 1.15); }
`;

// ---------- 粒子 ----------
const P_VERT = /* glsl */ `
attribute vec3 aStart; attribute vec3 aCtl; attribute vec4 aE; attribute vec2 aT;
uniform float uTime; uniform float uA; uniform float uRp; uniform float uRi; uniform float uW;
uniform vec3 uC; uniform vec3 uU; uniform vec3 uV; uniform vec3 uN;
uniform float uViewH; uniform float uBright;
uniform vec3 uIris; uniform vec3 uInner; uniform vec3 uLid;
varying vec3 vCol; varying float vA;
${EYE_GLSL}
void main() {
  float type = aE.z; float rr = aE.w;
  vec2 q; vec3 col; float a = 1.0;
  if (type < 0.5) {
    // 虹膜光丝：沿放射线分布，轻微波动
    float s = aE.y;
    float ang = aE.x + 0.05 * sin(s * 9.0 + aE.x * 7.0) + 0.02 * sin(uTime * 0.7 + aE.x * 13.0);
    float r = uRp + (uRi - uRp) * s;
    q = vec2(cos(ang), sin(ang)) * r;
    col = mix(mix(vec3(1.0, 0.95, 0.85), uInner, smoothstep(0.0, 0.18, s)), uIris, smoothstep(0.25, 0.75, s));
    a = 0.5 + 0.3 * exp(-pow((s - 0.3) / 0.06, 2.0)) + 0.5 * exp(-s / 0.05);
  } else if (type < 1.5) {
    // 虹膜外缘（角膜缘）亮环
    q = vec2(cos(aE.x), sin(aE.x)) * uRi * (1.0 + aE.y * 0.03);
    col = mix(uIris, vec3(1.0), 0.3); a = 0.5;
  } else if (type < 2.5) {
    // 眼睑轮廓线
    float x = aE.x;
    float y = aE.y > 0.0 ? upperLid(x, uA) : -lowerLid(x, uA);
    q = vec2(x, y + sign(aE.y) * abs(aE.y) * 0.02);
    col = uLid; a = 0.45 * (1.0 - 0.6 * x * x);
  } else {
    // 眼眶内的薄雾：随眼睑开合缩放
    float x = aE.x; float v = aE.y;
    q = vec2(x, v > 0.0 ? v * upperLid(x, uA) : v * lowerLid(x, uA));
    col = mix(uIris, uLid, 0.5); a = 0.08 * smoothstep(uRi, uRi + 0.06, length(q));
  }
  // 虹膜类粒子被眼睑挡住：压到眼睑边上并几乎隐去
  if (type < 1.5) {
    float up = upperLid(q.x, uA), lo = lowerLid(q.x, uA);
    if (q.y > up || q.y < -lo) { q.y = clamp(q.y, -lo, up); a *= 0.06; }
  }
  // 眼球微凸：越靠中心越朝镜头
  float bulge = 0.12 * max(0.0, 1.0 - dot(q, q));
  vec3 target = uC + (uU * q.x + uV * q.y + uN * bulge) * uW;
  // 飞行：起点（星系旋臂）→ 控制点（打旋、向中心）→ 目标
  float k = clamp((uTime - aT.x) / aT.y, 0.0, 1.0);
  float e = k * k * (3.0 - 2.0 * k);
  float ie = 1.0 - e;
  vec3 p = ie * ie * aStart + 2.0 * ie * e * aCtl + e * e * target;
  float flying = k > 0.0 && k < 1.0 ? 1.0 : 0.0;
  vec3 startCol = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.85, 0.6), rr);
  col = mix(startCol, col, smoothstep(0.55, 1.0, k));
  float arrive = exp(-pow((k - 0.97) / 0.05, 2.0));
  a = mix(0.22 + 0.25 * rr, a, smoothstep(0.6, 1.0, k)) * (1.0 + 0.2 * flying + 0.6 * arrive);
  a *= 0.85 + 0.15 * sin(uTime * (2.0 + 3.0 * rr) + rr * 40.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float px = uW * 0.0045 * projectionMatrix[1][1] * 0.5 * uViewH / max(-mv.z, 1e-3) * (1.0 + 0.25 * flying);
  if (px < 1.6) { a *= (px * px) / (1.6 * 1.6); px = 1.6; }
  px = min(px, 10.0);
  vCol = col; vA = a * uBright;
  gl_PointSize = px;
  gl_Position = projectionMatrix * mv;
}`;
const P_FRAG = /* glsl */ `
varying vec3 vCol; varying float vA;
void main() { vec2 c = gl_PointCoord - 0.5; float d2 = dot(c, c); gl_FragColor = vec4(vCol * vA * (exp(-d2 * 30.0) + 0.1 * exp(-d2 * 8.0)), 1.0); }`;

// ---------- 眼睛面片（预乘透明：rgb 自发光，alpha 挡背景） ----------
const E_VERT = /* glsl */ `varying vec2 vQ; void main() { vQ = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const E_FRAG = /* glsl */ `
uniform float uA; uniform float uRp; uniform float uRi; uniform float uOn; uniform float uTime; uniform float uSeed; uniform float uBright;
uniform vec3 uIris; uniform vec3 uInner; uniform vec3 uLid;
varying vec2 vQ;
${NOISE_GLSL}
${EYE_GLSL}
void main() {
  vec2 q = vQ;
  float up = upperLid(q.x, uA), lo = lowerLid(q.x, uA);
  float ew = 0.006 + 0.01 * uA;
  float inside = smoothstep(-ew, ew, up - q.y) * smoothstep(-ew, ew, q.y + lo) * step(abs(q.x), 1.0);
  // 眼睑轮廓辉光（闭眼时就是一道发光的细缝）
  float dl = min(abs(q.y - up), abs(q.y + lo));
  float edgeMask = smoothstep(1.02, 0.85, abs(q.x));
  float rim = (exp(-dl / 0.005) * 0.55 + exp(-dl / 0.05) * 0.18 + exp(-dl / 0.25) * 0.06) * edgeMask;
  float slit = exp(-abs(q.y) / (0.01 + uA * 0.3)) * exp(-q.x * q.x * 2.0) * (1.0 - smoothstep(0.0, 0.25, uA)) * 0.8;
  float plate = (1.0 - smoothstep(1.0, 1.28, abs(q.x))) * (1.0 - smoothstep(0.55, 0.88, abs(q.y)));
  vec3 glow = plate * uLid * (rim * (0.6 + 0.4 * (1.0 - smoothstep(0.0, 0.3, uA))) + slit);
  // 眼眶内
  float r = length(q);
  float a = atan(q.y, q.x);
  vec3 c = vec3(0.002, 0.006, 0.014);                                 // 深色眼白
  c += uIris * 0.035 * exp(-max(r - uRi, 0.0) / 0.08);
  c += uLid * 0.03 * exp(-dl / 0.06);                                  // 眼睑内侧微光                  // 虹膜外的冷光晕
  float u = (r - uRp) / (uRi - uRp);
  if (u >= 0.0 && u <= 1.08) {
    vec3 s3 = vec3(cos(a), sin(a), 0.0);
    float f1 = 0.5 + 0.5 * snoise(vec3(s3.xy * 18.0, u * 3.0 + uSeed));
    float f2 = 0.5 + 0.5 * snoise(vec3(s3.xy * 46.0, u * 6.0 + uSeed + 7.0));
    float f3 = 0.5 + 0.5 * snoise(vec3(s3.xy * 7.0, u * 1.5 + uSeed + 3.0 + uTime * 0.05));
    float fib = pow(f1, 3.0) * 1.1 + pow(f2, 4.0) * 0.9;
    vec3 ic = mix(mix(vec3(1.0, 0.92, 0.75), uInner, smoothstep(0.0, 0.2, u)), uIris, smoothstep(0.28, 0.8, u));
    float collar = exp(-pow((u - 0.3 - 0.04 * f3) / 0.05, 2.0));       // 虹膜褶环
    float pupRim = exp(-u / 0.04);
    float limbus = smoothstep(0.82, 1.0, u);                             // 角膜缘：外圈压暗
    float e = (0.06 + fib * (0.6 + 0.5 * f3)) * (1.0 - 0.8 * limbus) + collar * (0.25 + 0.35 * f2) + pupRim * 0.9;
    e *= 1.0 - smoothstep(1.0, 1.08, u);
    // 一圈圈向外扩散的光纹
    e *= 0.85 + 0.3 * pow(0.5 + 0.5 * sin(u * 18.0 - uTime * 3.0), 4.0);
    c = mix(c, ic * e, smoothstep(1.08, 1.0, u));
  }
  float pupil = smoothstep(uRp, uRp - 0.012, r);
  c *= 1.0 - pupil;                                                    // 瞳孔深黑
  float alpha = inside * uOn;
  gl_FragColor = vec4((c * inside * uOn + glow * uOn) * uBright, alpha);
}`;

// ---------- 暗幕（星系平面上，从外向内吸走星光） ----------
const V_VERT = E_VERT;
const V_FRAG = /* glsl */ `
uniform float uFront; uniform float uVeil; varying vec2 vQ;
void main() {
  float r = length(vQ);
  float drained = smoothstep(uFront - 0.12, uFront + 0.05, r);
  float dens = min(0.97, 0.3 + 1.3 * exp(-r / 0.3)) * (1.0 - smoothstep(1.05, 1.3, r));
  gl_FragColor = vec4(0.0, 0.0, 0.0, drained * dens * uVeil);
}`;

const smooth = (x: number) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };
const fract = (x: number) => x - Math.floor(x);
const RMIN = 0.07;

export const GalaxyEyeAsset: React.FC<GalaxyEyeProps> = ({
  position = [0, 0, 0], facing = [0, 0.8, 0.6], size = 12, galaxyRadius = 30, galaxyTilt = 0, arms = 2, twist = 2.2, galaxySeed = 'galaxy',
  count = 70000, gatherAt = 0.2, gatherDuration = 2.6, openAt = 2.6, openDuration = 1.8, opening = 0.5, veil = 1,
  irisColor = '#3fd0ff', innerColor = '#ffb347', lidColor = '#bfe8ff', brightness = 1, seed = 'galaxyeye',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {size: vs, gl} = useThree();
  const t = frame / fps;
  const S = String(seed);
  const nArms = Math.max(1, Math.min(6, Math.round(arms)));
  const built = useMemo(() => {
    const N = new THREE.Vector3(...facing).normalize();
    const U = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), N);
    if (U.lengthSq() < 1e-6) U.set(1, 0, 0);
    U.normalize();
    const V = new THREE.Vector3().crossVectors(N, U).normalize();
    const C = new THREE.Vector3(...position);
    // 星系旋臂（与 cosmos.galaxy.v1 同一公式）
    const gSeed = Math.floor(random(`galaxy-${galaxySeed}`) * 1e6);
    const rot = random(`galaxy-rot-${galaxySeed}`) * Math.PI * 2;
    const armAngle = (k: number, r: number) => {
      const h = fract(Math.sin((k + 1) * 12.9898 + gSeed * 0.001) * 43758.5453);
      const wob = 0.16 * Math.sin(r * (5 + 4 * h) + h * 6.28) + 0.07 * Math.sin(r * 17 + h * 40);
      return rot + (k * Math.PI * 2) / nArms + twist * Math.log(Math.max(r, RMIN) / RMIN) + wob;
    };
    const tr = (galaxyTilt * Math.PI) / 180;
    const toWorld = (x: number, y: number, z: number) => new THREE.Vector3(x, y * Math.cos(tr) - z * Math.sin(tr), y * Math.sin(tr) + z * Math.cos(tr)).multiplyScalar(galaxyRadius).add(C);
    const aStart = new Float32Array(count * 3), aCtl = new Float32Array(count * 3), aE = new Float32Array(count * 4), aT = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const g = Math.sqrt(-2 * Math.log(Math.max(random(`${S}ga${i}`), 1e-6))) * Math.cos(2 * Math.PI * random(`${S}gb${i}`));
      const r = 0.06 + 0.94 * Math.pow(random(`${S}r${i}`), 0.7);
      const k = Math.floor(random(`${S}k${i}`) * nArms);
      const th = random(`${S}oa${i}`) < 0.8 ? armAngle(k, r) + g * Math.min(0.5, Math.max(0.12, 0.06 / r)) : random(`${S}th${i}`) * Math.PI * 2;
      const st = toWorld(Math.cos(th) * r, (random(`${S}y${i}`) - 0.5) * 0.02, Math.sin(th) * r);
      // 控制点：向中心收、沿旋转方向打旋、微微抬向镜头
      const th2 = th - 1.1 - 0.6 * random(`${S}sw${i}`);
      const r2 = r * 0.4;
      const ct = toWorld(Math.cos(th2) * r2, 0, Math.sin(th2) * r2).add(N.clone().multiplyScalar(size * 0.15 * random(`${S}cz${i}`)));
      aStart.set([st.x, st.y, st.z], i * 3);
      aCtl.set([ct.x, ct.y, ct.z], i * 3);
      // 类型：0 虹膜光丝 52%，1 角膜缘 10%，2 眼睑 22%，3 眼眶薄雾 16%
      const u = random(`${S}ty${i}`);
      const type = u < 0.52 ? 0 : u < 0.62 ? 1 : u < 0.84 ? 2 : 3;
      let e1: number, e2: number;
      if (type === 0) {
        const fiber = Math.floor(random(`${S}fb${i}`) * 420);
        e1 = (fiber / 420) * Math.PI * 2 + (random(`${S}fj${fiber}`) - 0.5) * 0.01;
        e2 = Math.pow(random(`${S}fs${i}`), 0.8);
      } else if (type === 1) {
        e1 = random(`${S}la${i}`) * Math.PI * 2;
        e2 = random(`${S}lb${i}`) - 0.5;
      } else if (type === 2) {
        e1 = Math.sin((random(`${S}lx${i}`) - 0.5) * Math.PI); // 两端更密，轮廓线更细尖
        e2 = (random(`${S}ls${i}`) > 0.5 ? 1 : -1) * (0.05 + random(`${S}lo${i}`) * Math.pow(random(`${S}lp${i}`), 3));
      } else {
        e1 = (random(`${S}mx${i}`) * 2 - 1) * 0.95;
        e2 = random(`${S}my${i}`) * 2 - 1;
      }
      aE.set([e1, e2, type, random(`${S}rr${i}`)], i * 4);
      // 先外后内出发
      const t0 = gatherAt + (1 - r) * 0.45 * gatherDuration + random(`${S}t0${i}`) * 0.15 * gatherDuration;
      aT.set([t0, gatherDuration * (0.45 + 0.15 * random(`${S}fd${i}`))], i * 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aStart', new THREE.BufferAttribute(aStart, 3));
    geo.setAttribute('aCtl', new THREE.BufferAttribute(aCtl, 3));
    geo.setAttribute('aE', new THREE.BufferAttribute(aE, 4));
    geo.setAttribute('aT', new THREE.BufferAttribute(aT, 2));
    const cols = {uIris: {value: new THREE.Color(irisColor)}, uInner: {value: new THREE.Color(innerColor)}, uLid: {value: new THREE.Color(lidColor)}};
    const pMat = new THREE.ShaderMaterial({
      vertexShader: P_VERT, fragmentShader: P_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      uniforms: {uTime: {value: 0}, uA: {value: 0}, uRp: {value: 0.16}, uRi: {value: 0.42}, uW: {value: size}, uC: {value: C}, uU: {value: U}, uV: {value: V}, uN: {value: N},
        uViewH: {value: 1080}, uBright: {value: brightness}, ...cols},
    });
    const eMat = new THREE.ShaderMaterial({
      vertexShader: E_VERT, fragmentShader: E_FRAG, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: {uA: {value: 0}, uRp: {value: 0.16}, uRi: {value: 0.42}, uOn: {value: 0}, uTime: {value: 0}, uSeed: {value: random(`${S}sn`) * 50}, uBright: {value: brightness}, ...cols},
    });
    const vMat = new THREE.ShaderMaterial({
      vertexShader: V_VERT, fragmentShader: V_FRAG, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
      uniforms: {uFront: {value: 2}, uVeil: {value: veil}},
    });
    // 眼睛面片朝向：局部 x = U，y = V，z = N
    const eyeQuat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(U, V, N));
    return {geo, pMat, eMat, vMat, eyeQuat, tr};
  }, [position, facing, size, galaxyRadius, galaxyTilt, nArms, twist, galaxySeed, count, gatherAt, gatherDuration, veil, irisColor, innerColor, lidColor, brightness, S]);

  const openK = smooth((t - openAt) / openDuration);
  const A = opening * openK * (0.97 + 0.03 * Math.sin(t * 2.1)); // 睁开后极轻微的「呼吸」
  const Rp = 0.17 - 0.05 * smooth((t - openAt - openDuration * 0.5) / 1.4); // 瞳孔慢慢收缩
  const on = smooth((t - gatherAt - gatherDuration * 0.55) / (gatherDuration * 0.4));
  const front = 1.3 * (1 - smooth((t - gatherAt) / (gatherDuration * 0.95)));
  const viewH = vs.height * gl.getPixelRatio();
  const pu = built.pMat.uniforms;
  pu.uTime.value = t; pu.uA.value = A; pu.uRp.value = Rp; pu.uViewH.value = viewH;
  const eu = built.eMat.uniforms;
  eu.uA.value = A; eu.uRp.value = Rp; eu.uOn.value = on; eu.uTime.value = t;
  built.vMat.uniforms.uFront.value = front;
  return (
    <group>
      <group position={position} rotation={[built.tr, 0, 0]}>
        <mesh material={built.vMat} rotation={[-Math.PI / 2, 0, 0]} scale={[galaxyRadius, galaxyRadius, galaxyRadius]} frustumCulled={false} renderOrder={5}>
          <planeGeometry args={[2.7, 2.7, 1, 1]} />
        </mesh>
      </group>
      <mesh material={built.eMat} position={position} quaternion={built.eyeQuat} scale={[size, size, size]} frustumCulled={false} renderOrder={6}>
        <planeGeometry args={[2.6, 1.8, 1, 1]} />
      </mesh>
      <points geometry={built.geo} material={built.pMat} frustumCulled={false} renderOrder={11} />
    </group>
  );
};
