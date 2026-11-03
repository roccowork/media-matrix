// 资产 cosmos.galaxy.v1：GPU 粒子螺旋星系（默认 30 万颗星），参数见 registry.ts。
// 结构（参考哈勃 M51 / M101）：
//   1. 盘面漫射光：一张盘面 Shader，按对数螺旋算旋臂密度 + 噪声，表现「数不清的星连成的光」，并压出尘埃带；
//   2. 星点：核球（暖黄白，扁球）、盘面老年星、旋臂上的蓝白年轻星团（成团）、粉红电离氢区（成团、更大更柔）；
//   3. 尘埃：一层「相乘」混合的暗色粒子，贴着旋臂内侧（凹侧）形成暗带，把后面的星光压暗；
//   4. 中心辉光：始终朝向镜头的发光面片。
// 每颗粒子不存任何数据：顶点着色器用 gl_VertexID + 种子做确定性整数哈希，按 uTime 算位置（差速旋转：内圈角速度大）。
// 星点和盘面用同一套旋臂公式和同一条旋转曲线，所以转起来星点和漫射光始终对齐。同帧结果确定（无 Math.random）。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import {NOISE_GLSL} from '../../../engine/shaders/noise.glsl';
import type {Vec3} from '../../../engine/shot';

export type GalaxyProps = {
  position?: Vec3;
  radius?: number;
  arms?: number;
  twist?: number;
  count?: number;
  coreColor?: string;
  armColor?: string;
  tilt?: number; // 度：盘面绕 X 轴倾斜
  spin?: number; // 圈 / 分钟（半径一半处）
  brightness?: number;
  seed?: string | number;
};

// 共享：旋臂中心线角度、旋转曲线、哈希（盘面和星点完全一致）
const COMMON = /* glsl */ `
uniform float uArms; uniform float uTwist; uniform float uRot; uniform float uSeed; uniform float uSpinT;
const float PI = 3.14159265; const float RMIN = 0.07;
// 第 k 条旋臂在归一化半径 r 处的中心角：对数螺旋 + 种子决定的轻微摆动
float armAngle(float k, float r) {
  float base = uRot + k * 6.2831853 / uArms;
  float h = fract(sin((k + 1.0) * 12.9898 + uSeed * 0.001) * 43758.5453);
  float wob = 0.16 * sin(r * (5.0 + 4.0 * h) + h * 6.28) + 0.07 * sin(r * 17.0 + h * 40.0);
  return base + uTwist * log(max(r, RMIN) / RMIN) + wob;
}
float armStrength(float k) { return 0.7 + 0.3 * fract(sin((k + 3.0) * 78.233 + uSeed * 0.0013) * 12543.17); }
// 差速旋转：平坦旋转曲线 v≈常数 → ω∝1/r（内圈加软化）。以 r=0.5 处为 1。
float omega(float r) { return 0.9 / (0.4 + r); }
float wrapPi(float a) { return a - 6.2831853 * floor((a + PI) / 6.2831853); }
`;

const HASH = /* glsl */ `
uint pcg(uint v) { uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
uint gId; uint gK;
float rnd() { gK += 1u; return float(pcg(gId * 16u + gK + uint(uSeed) * 2654435761u) >> 8) / 16777216.0; }
float rndOf(uint id, uint k) { return float(pcg(id * 16u + k + uint(uSeed) * 2246822519u + 99991u) >> 8) / 16777216.0; }
float gauss() { float a = max(rnd(), 1e-6); float b = rnd(); return sqrt(-2.0 * log(a)) * cos(6.2831853 * b); }
`;

// ---------- 星点 ----------
const STAR_VERT = /* glsl */ `
uniform float uR; uniform float uN1; uniform float uN2; uniform float uN3; uniform float uViewH; uniform float uBright;
uniform vec3 uCore; uniform vec3 uArm;
varying vec3 vCol; varying float vA; varying float vSoft;
${COMMON}
${HASH}
${NOISE_GLSL}
void main() {
  float idx = float(gl_VertexID);
  gId = uint(gl_VertexID); gK = 0u;
  float r; float th; float y; vec3 col; float lum; float size; float soft = 0.0;
  vec3 hot = vec3(0.45, 0.65, 1.0);
  if (idx < uN1) {
    // 核球：扁球，密度向中心陡增，暖黄白
    // Plummer 分布（中心密度有限，避免成千上万颗星叠在同一个像素上溢出）
    r = min(0.055 / sqrt(pow(max(rnd() * 0.97, 1e-4), -0.6667) - 1.0), 0.3);
    th = rnd() * 6.2831853;
    float cz = rnd() * 2.0 - 1.0;
    y = r * cz * 0.55;
    r *= sqrt(1.0 - cz * cz);
    float w = rnd();
    col = mix(uCore, vec3(1.0, 0.62, 0.35), 0.4 * w) ;
    lum = 0.16 + 1.5 * pow(rnd(), 14.0);
    size = 1.0;
  } else if (idx < uN2) {
    // 盘面：指数盘；约 60% 沿旋臂（角向高斯分布，越往外越松），其余均匀
    r = clamp(-log(1.0 - rnd() * 0.985) / 3.6, 0.03, 1.15);
    float k = floor(rnd() * uArms);
    bool onArm = rnd() < 0.68 * smoothstep(0.05, 0.2, r);
    float sig = clamp(0.1 / r, 0.14, 0.8);
    th = onArm ? armAngle(k, r) + gauss() * sig : rnd() * 6.2831853;
    // 约 1/4 的旋臂星落在「羽状支流」上：从旋臂向外侧斜出去的短条（M51 那种分叉、毛边）
    if (onArm && rnd() < 0.25) {
      float sid = floor(rnd() * 90.0);
      float r0 = 0.18 + 0.75 * fract(sin(sid * 91.7 + uSeed * 0.003) * 4375.85);
      float kk = floor(fract(sin(sid * 17.3 + uSeed * 0.007) * 9137.2) * uArms);
      float L = rnd() * 0.16;
      r = r0 + L;
      th = armAngle(kk, r0) - 0.06 - L * (2.2 + 1.5 * fract(sid * 0.37)) + gauss() * 0.025 / r;
    }
    y = gauss() * (0.012 + 0.03 * exp(-r * 6.0));
    float t = smoothstep(0.08, 0.6, r);
    col = mix(uCore, uArm, t * (onArm ? 0.9 : 0.5));
    col = mix(col, vec3(1.0, 0.7, 0.45), 0.35 * pow(rnd(), 3.0));
    lum = (onArm ? 0.5 : 0.28) * (0.4 + 0.6 * exp(-r * 1.5)) + 2.0 * pow(rnd(), 18.0);
    size = 0.85;
  } else {
    // 年轻星团 / 电离氢区：成团分布在旋臂脊线上
    bool hii = idx >= uN3;
    float nC = hii ? 160.0 : 520.0;
    uint cid = uint(floor(rnd() * nC)) + (hii ? 7000u : 3000u);
    float rc = 0.16 + 0.82 * pow(rndOf(cid, 1u), 0.8);
    float k = floor(rndOf(cid, 2u) * uArms);
    float ga = sqrt(-2.0 * log(max(rndOf(cid, 3u), 1e-6))) * cos(6.2831853 * rndOf(cid, 4u));
    float thc = armAngle(k, rc) + ga * clamp(0.05 / rc, 0.05, 0.3) + (hii ? -0.02 : 0.0);
    float cs = (hii ? 0.010 : 0.018) * (0.5 + rndOf(cid, 5u));
    vec2 c = vec2(cos(thc), sin(thc)) * rc + vec2(gauss(), gauss()) * cs;
    r = length(c); th = atan(c.y, c.x);
    y = gauss() * 0.006;
    if (hii) {
      col = vec3(1.0, 0.32, 0.55);
      lum = 0.07 + 0.1 * rnd();
      size = 2.5 + 3.5 * rnd();
      soft = 1.0;
    } else {
      col = mix(hot, vec3(1.0), 0.35 * rnd());
      lum = 0.35 + 1.6 * pow(rnd(), 8.0);
      size = 1.2;
    }
    lum *= (0.6 + 0.8 * rndOf(cid, 6u)) * (1.0 - 0.6 * smoothstep(0.65, 1.0, rc));
  }
  // 差速旋转（拖尾旋臂：旋转方向与缠绕方向相反）
  th -= uSpinT * omega(r);
  vec3 p = vec3(cos(th) * r, y, sin(th) * r) * uR;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float pxScale = projectionMatrix[1][1] * 0.5 * uViewH;
  float px = size * uR * 0.0028 * pxScale / max(-mv.z, 0.001);
  float a = lum;
  // 小于 1.6 像素的星：固定像素大小、按面积压亮度（不闪烁、远看能量守恒）
  if (px < 1.6) { a *= (px * px) / (1.6 * 1.6); px = 1.6; }
  else if (soft < 0.5) a *= 1.6 / px;   // 近处星点亮度只按 1/距离 增长，防止近景星团过曝
  px = min(px, soft > 0.5 ? 40.0 : 4.0);
  vCol = col; vA = a * uBright; vSoft = soft;
  gl_PointSize = px;
  gl_Position = projectionMatrix * mv;
}`;
const STAR_FRAG = /* glsl */ `
varying vec3 vCol; varying float vA; varying float vSoft;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d2 = dot(c, c);
  float a = mix(exp(-d2 * 28.0) + 0.06 * exp(-d2 * 7.0), exp(-d2 * 9.0) * 0.6, vSoft);
  vec3 cc = vCol * vA * a;
  if (cc.r != cc.r || cc.g != cc.g || cc.b != cc.b) cc = vec3(0.0, 50.0, 0.0);  // DEBUG
  gl_FragColor = vec4(clamp(cc, 0.0, 60.0), 1.0);
}`;

// ---------- 尘埃（相乘混合：dst *= 输出色） ----------
const DUST_VERT = /* glsl */ `
uniform float uR; uniform float uViewH; uniform float uDust;
varying float vA;
${COMMON}
${HASH}
${NOISE_GLSL}
void main() {
  gId = uint(gl_VertexID) + 900000u; gK = 0u;
  float r = 0.1 + 0.85 * pow(rnd(), 0.9);
  float k = floor(rnd() * uArms);
  // 贴着旋臂内侧（同一角度上半径更小的一侧 = 角度偏 +）
  float th = armAngle(k, r) + clamp(0.05 / r, 0.05, 0.35) + gauss() * clamp(0.03 / r, 0.03, 0.25);
  float y = gauss() * 0.004;
  vec2 q = vec2(cos(th), sin(th)) * r;
  // 噪声把尘埃带撕成丝状 / 断续
  float n = snoise(vec3(q * 7.0, uSeed * 0.01)) * 0.6 + snoise(vec3(q * 19.0, 3.0 + uSeed * 0.01)) * 0.4;
  float a = smoothstep(-0.7, 0.5, n) * smoothstep(0.08, 0.2, r) * (1.0 - smoothstep(0.65, 1.0, r));
  th -= uSpinT * omega(r);
  vec3 p = vec3(cos(th) * r, y, sin(th) * r) * uR;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float pxScale = projectionMatrix[1][1] * 0.5 * uViewH;
  float px = (0.007 + 0.009 * rnd()) * uR * pxScale / max(-mv.z, 0.001);
  if (px < 2.0) { a *= px / 2.0; px = 2.0; }
  px = min(px, 128.0);
  vA = a * uDust * 0.32;
  gl_PointSize = px;
  gl_Position = projectionMatrix * mv;
}`;
const DUST_FRAG = /* glsl */ `
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = exp(-dot(c, c) * 14.0) * vA;
  // 偏红棕的吸收：蓝光被吸收得更多
  vec3 keep = vec3(1.0) - a * vec3(0.30, 0.36, 0.42);
  gl_FragColor = vec4(keep, 1.0);
}`;

// ---------- 盘面漫射光 ----------
const DISK_VERT = /* glsl */ `
varying vec2 vP;
void main() { vP = vec2(position.x, -position.y); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const DISK_FRAG = /* glsl */ `
uniform float uR; uniform float uBright; uniform vec3 uCore; uniform vec3 uArm;
varying vec2 vP;
${COMMON}
${NOISE_GLSL}
void main() {
  vec2 q = vP / uR;
  float r = length(q);
  if (r > 1.25) discard;
  float th = atan(q.y, q.x) + uSpinT * omega(r);   // 回到 t=0 的坐标系里算旋臂
  vec2 q0 = vec2(cos(th), sin(th)) * r;
  float sig = clamp(0.1 / max(r, 0.01), 0.14, 0.8);
  float arm = 0.0; float dust = 0.0;
  for (int i = 0; i < 6; i++) {
    float k = float(i);
    if (k >= uArms) break;
    float a0 = armAngle(k, r);
    float d = wrapPi(th - a0);
    arm += armStrength(k) * exp(-d * d / (2.0 * sig * sig));
    float dd = wrapPi(th - a0 - clamp(0.05 / max(r, 0.01), 0.05, 0.35));
    float ds = clamp(0.03 / max(r, 0.01), 0.03, 0.2);
    dust += exp(-dd * dd / (2.0 * ds * ds));
  }
  float n1 = snoise(vec3(q0 * 4.0, uSeed * 0.01));
  float n2 = snoise(vec3(q0 * 11.0, 5.0 + uSeed * 0.01));
  float n3 = snoise(vec3(q0 * 26.0, 9.0 + uSeed * 0.01));
  float clump = 0.65 + 0.35 * n1 + 0.2 * n2 + 0.1 * n3;
  float disk = exp(-r / 0.32) * (1.0 - smoothstep(0.6, 1.2, r));
  float t = smoothstep(0.06, 0.6, r);
  vec3 col = mix(uCore, uArm, t);
  vec3 e = col * disk * (0.3 + 1.6 * arm * smoothstep(0.04, 0.18, r) * max(clump, 0.1));
  float bulge = exp(-pow(r / 0.12, 2.0)) * 0.8 + exp(-r / 0.04) * 0.5;
  e += uCore * bulge;
  float dl = clamp(dust * smoothstep(-0.2, 0.6, n2 * 0.7 + n3 * 0.3 + 0.2), 0.0, 1.0) * smoothstep(0.07, 0.18, r) * (1.0 - smoothstep(0.6, 1.05, r));
  e *= 1.0 - 0.8 * dl;
  gl_FragColor = vec4(e * uBright * 0.55, 1.0);
}`;

// ---------- 中心辉光（朝向镜头的面片） ----------
const GLOW_VERT = /* glsl */ `
uniform float uSize; varying vec2 vUv2;
void main() {
  vUv2 = position.xy;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
}`;
const GLOW_FRAG = /* glsl */ `
uniform vec3 uCore; uniform float uBright; varying vec2 vUv2;
void main() {
  float d = length(vUv2);
  float g = exp(-d * d * 60.0) * 0.9 + exp(-d * 9.0) * 0.3 + exp(-d * 3.5) * 0.08;
  g *= (1.0 - smoothstep(0.7, 1.0, d));
  vec3 c = mix(uCore, vec3(1.0, 0.97, 0.9), exp(-d * d * 80.0));
  gl_FragColor = vec4(c * g * uBright, 1.0);
}`;

const seedNum = (seed: string | number) => Math.floor(random(`galaxy-${seed}`) * 1e6);

export const GalaxyAsset: React.FC<GalaxyProps> = ({
  position = [0, 0, 0],
  radius = 10,
  arms = 2,
  twist = 2.2,
  count = 300000,
  coreColor = '#ffd9a0',
  armColor = '#9cc4ff',
  tilt = 0,
  spin = 0.4,
  brightness = 1,
  seed = 'galaxy',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {size, gl} = useThree();
  const t = frame / fps;
  const nArms = Math.max(1, Math.min(6, Math.round(arms)));
  const n = Math.round(count);
  const nDust = Math.round(n * 0.4);
  const sNum = seedNum(seed);
  const rot = random(`galaxy-rot-${seed}`) * Math.PI * 2;
  const built = useMemo(() => {
    const common = {
      uArms: {value: nArms}, uTwist: {value: twist}, uRot: {value: rot}, uSeed: {value: sNum}, uSpinT: {value: 0},
      uR: {value: radius}, uBright: {value: brightness},
      uCore: {value: new THREE.Color(coreColor)}, uArm: {value: new THREE.Color(armColor)}, uViewH: {value: 1080},
    };
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const star = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: {...common, uN1: {value: Math.round(n * 0.16)}, uN2: {value: Math.round(n * 0.84)}, uN3: {value: Math.round(n * 0.98)}},
    });
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nDust * 3), 3));
    const dust = new THREE.ShaderMaterial({
      vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor,
      uniforms: {...common, uDust: {value: 1}},
    });
    const disk = new THREE.ShaderMaterial({
      vertexShader: DISK_VERT, fragmentShader: DISK_FRAG, transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: common,
    });
    const glow = new THREE.ShaderMaterial({
      vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending, uniforms: {...common, uSize: {value: radius * 0.6}},
    });
    return {starGeo, star, dustGeo, dust, disk, glow};
  }, [nArms, twist, rot, sNum, radius, brightness, coreColor, armColor, n, nDust]);
  const spinT = (spin / 60) * Math.PI * 2 * t; // 弧度（r=0.5 处）
  const viewH = size.height * gl.getPixelRatio();
  for (const m of [built.star, built.dust, built.disk, built.glow]) {
    m.uniforms.uSpinT.value = spinT;
    m.uniforms.uViewH.value = viewH;
  }
  return (
    <group position={position} rotation={[(tilt * Math.PI) / 180, 0, 0]}>
      <mesh material={built.disk} rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false} renderOrder={1}>
        <planeGeometry args={[radius * 2.5, radius * 2.5, 1, 1]} />
      </mesh>
      <points geometry={built.starGeo} material={built.star} frustumCulled={false} renderOrder={2} />
      <mesh material={built.glow} frustumCulled={false} renderOrder={3}>
        <planeGeometry args={[2, 2]} />
      </mesh>
      <points geometry={built.dustGeo} material={built.dust} frustumCulled={false} renderOrder={4} />
    </group>
  );
};
