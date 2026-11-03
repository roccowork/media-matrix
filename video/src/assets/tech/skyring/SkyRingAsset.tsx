// 资产 tech.skyring.v1：城市升空成光环（《一百年后》第 6 镜「城市，搬到了天上」）。
// 几万个城市光点从行星夜面一片片升起（先沿径向抬升，再沿弧线飞到轨道上），在赤道上空汇成一圈发光的环形城市；
// 光点到位后，环本身（分段的结构带 + 一节节亮灯的舱段）逐渐亮起并缓慢自转。
// 光点位置全部在顶点着色器里按 uTime 计算（GPU 粒子，确定性）；结构带是一张环形平面的 Shader。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Vec3} from '../../../engine/shot';

export type SkyRingProps = {
  center?: Vec3;
  radius?: number; // 行星半径
  ringRadius?: number; // 光环半径（相对行星半径）
  tilt?: number; // 光环平面倾角（度，绕 x 轴）
  facing?: Vec3; // 光点从球面哪片区域升起（一般是朝镜头的夜面）
  spread?: number; // 升起区域范围（度）
  count?: number;
  liftAt?: number; // 开始升起（秒）
  liftDuration?: number; // 所有光点升起完毕要多久（秒）
  flight?: number; // 单个光点从地面飞到环上用时（秒）
  spin?: number; // 环自转（圈 / 分钟）
  cityColor?: string;
  ringColor?: string;
  size?: number;
  brightness?: number;
  seed?: string | number;
};

const VERT = /* glsl */ `
attribute vec3 aStart; attribute vec4 aR;  // aR: x 出发时刻(0–1), y 环上角度, z 环厚度方向偏移, w 亮度随机
uniform float uTime; uniform float uLiftAt; uniform float uLiftDur; uniform float uFlight; uniform float uR; uniform float uRingR;
uniform mat3 uRingBasis; uniform float uSpin; uniform float uSize; uniform vec3 uCity; uniform vec3 uRingCol;
varying vec3 vCol; varying float vA;
vec3 ringPoint(float a, float off) {
  vec3 u = uRingBasis[0], w = uRingBasis[2], n = uRingBasis[1];
  return (u * cos(a) + w * sin(a)) * (uRingR + off * 0.06 * uR) + n * off * 0.025 * uR;
}
void main() {
  float t0 = uLiftAt + aR.x * uLiftDur;
  float k = clamp((uTime - t0) / uFlight, 0.0, 1.0);
  float a = aR.y + uTime * uSpin;
  vec3 ground = aStart * uR * 1.002;
  vec3 up = aStart * uR * 1.25;
  vec3 dst = ringPoint(a, aR.z);
  // 三次贝塞尔：地面 → 抬升点 → 环上方 → 环
  vec3 c1 = up;
  vec3 c2 = dst + normalize(dst) * uR * 0.15;
  float s = k * k * (3.0 - 2.0 * k);
  float is = 1.0 - s;
  vec3 p = is * is * is * ground + 3.0 * is * is * s * c1 + 3.0 * is * s * s * c2 + s * s * s * dst;
  float arrived = smoothstep(0.85, 1.0, k);
  vCol = mix(uCity, uRingCol, smoothstep(0.3, 1.0, k));
  float flying = k > 0.0 && k < 1.0 ? 1.0 : 0.0;
  vA = (0.6 + 0.8 * aR.w) * (1.0 + 1.2 * flying + 0.4 * arrived);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (1.0 + 0.8 * flying) * (300.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
varying vec3 vCol; varying float vA;
void main() { float r = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vCol * vA * smoothstep(0.5, 0.0, r) * 1.6, 1.0); }`;

// 结构带：环形平面，径向几道细带 + 沿圆周一节节的舱段灯，按 uOn 亮起
const BAND_VERT = /* glsl */ `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BAND_FRAG = /* glsl */ `
uniform float uOn; uniform float uR0; uniform float uR1; uniform vec3 uCol; uniform float uRot;
varying vec2 vP;
void main() {
  float r = length(vP);
  float u = (r - uR0) / (uR1 - uR0);
  if (u < 0.0 || u > 1.0) discard;
  float a = atan(vP.y, vP.x) + uRot;
  float lanes = smoothstep(0.08, 0.0, abs(u - 0.15)) + smoothstep(0.06, 0.0, abs(u - 0.5)) * 0.6 + smoothstep(0.08, 0.0, abs(u - 0.85));
  float seg = fract(a * 60.0 / 6.2831853);
  float pods = smoothstep(0.35, 0.0, abs(seg - 0.5)) * smoothstep(0.3, 0.0, abs(u - 0.5)) * step(0.3, fract(sin(floor(a * 60.0 / 6.2831853) * 91.3) * 437.5));
  float edge = smoothstep(0.0, 0.1, u) * smoothstep(1.0, 0.9, u);
  float v = (lanes * 0.55 + pods * 0.9 + 0.05) * edge * uOn;
  gl_FragColor = vec4(uCol * v, 1.0);
}`;

export const SkyRingAsset: React.FC<SkyRingProps> = ({
  center = [0, 0, 0], radius = 5, ringRadius = 1.7, tilt = 18, facing = [0.1, 0.45, 0.88], spread = 55, count = 30000,
  liftAt = 0.4, liftDuration = 2.6, flight = 1.6, spin = 1.2, cityColor = '#ffb35c', ringColor = '#bfe9ff', size = 0.02, brightness = 1, seed = 'skyring',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const S = String(seed);
  const res = useMemo(() => {
    const f = new THREE.Vector3(...facing).normalize();
    const ref = Math.abs(f.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(ref, f).normalize();
    const v = new THREE.Vector3().crossVectors(f, u);
    const start = new Float32Array(count * 3);
    const rnd = new Float32Array(count * 4);
    // 城市成团：先撒若干「城市中心」，每个光点属于某个城市
    const cities = 160;
    const centers = Array.from({length: cities}, (_, c) => {
      const ang = random(`${S}ca${c}`) * Math.PI * 2;
      const r = Math.sqrt(random(`${S}cr${c}`)) * Math.sin((spread * Math.PI) / 180);
      const z = Math.sqrt(Math.max(0, 1 - r * r));
      return f.clone().multiplyScalar(z).add(u.clone().multiplyScalar(Math.cos(ang) * r)).add(v.clone().multiplyScalar(Math.sin(ang) * r)).normalize();
    });
    for (let i = 0; i < count; i++) {
      const c = Math.floor(random(`${S}pc${i}`) * cities);
      const jit = new THREE.Vector3(random(`${S}jx${i}`) - 0.5, random(`${S}jy${i}`) - 0.5, random(`${S}jz${i}`) - 0.5).multiplyScalar(0.06 * Math.pow(random(`${S}js${i}`), 0.7));
      const d = centers[c].clone().add(jit).normalize();
      start.set([d.x, d.y, d.z], i * 3);
      // 同一个城市的光点差不多同时升起（城市整片升空），城市之间错开
      rnd.set([Math.min(1, random(`${S}ct${c}`) * 0.85 + random(`${S}pt${i}`) * 0.15), random(`${S}pa${i}`) * Math.PI * 2, (random(`${S}po${i}`) - 0.5) * 2, random(`${S}pb${i}`)], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aStart', new THREE.BufferAttribute(start, 3));
    g.setAttribute('aR', new THREE.BufferAttribute(rnd, 4));
    const tr = (tilt * Math.PI) / 180;
    const basis = new THREE.Matrix3().set(1, 0, 0, 0, Math.cos(tr), -Math.sin(tr), 0, Math.sin(tr), Math.cos(tr));
    // basis 列：u = (1,0,0)，n = 倾斜后的法线，w = 倾斜后的 z
    const mat = new THREE.ShaderMaterial({vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {uTime: {value: 0}, uLiftAt: {value: liftAt}, uLiftDur: {value: liftDuration}, uFlight: {value: flight}, uR: {value: radius}, uRingR: {value: radius * ringRadius},
        uRingBasis: {value: basis}, uSpin: {value: (spin * Math.PI * 2) / 60}, uSize: {value: size}, uCity: {value: new THREE.Color(cityColor).multiplyScalar(brightness)}, uRingCol: {value: new THREE.Color(ringColor).multiplyScalar(brightness)}}});
    const band = new THREE.ShaderMaterial({vertexShader: BAND_VERT, fragmentShader: BAND_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: {uOn: {value: 0}, uR0: {value: radius * ringRadius * 0.94}, uR1: {value: radius * ringRadius * 1.06}, uCol: {value: new THREE.Color(ringColor).multiplyScalar(brightness * 0.9)}, uRot: {value: 0}}});
    return {g, mat, band, tr};
  }, [radius, ringRadius, tilt, facing, spread, count, liftAt, liftDuration, flight, spin, cityColor, ringColor, size, brightness, S]);
  res.mat.uniforms.uTime.value = t;
  const allIn = liftAt + liftDuration + flight;
  res.band.uniforms.uOn.value = Math.max(0, Math.min(1, (t - (liftAt + flight)) / (allIn - liftAt - flight + 0.6)));
  res.band.uniforms.uRot.value = -t * ((spin * Math.PI * 2) / 60);
  return (
    <group position={center}>
      <points geometry={res.g} material={res.mat} frustumCulled={false} renderOrder={9} />
      {/* 环平面：RingGeometry 在 xy 平面，先转到 xz 平面再按 tilt 倾斜 */}
      <mesh material={res.band} rotation={[Math.PI / 2 + res.tr, 0, 0]} renderOrder={8}>
        <ringGeometry args={[radius * ringRadius * 0.94, radius * ringRadius * 1.06, 256, 2]} />
      </mesh>
    </group>
  );
};
