// 资产 cosmos.planet.v1：程序化行星。kind = 0 类地行星（海洋 / 大陆 / 冰盖 / 云层 / 夜面城市灯光），
// kind = 1 气态巨行星（横向条带 + 湍流 + 风暴眼）。外加大气层边缘辉光（菲涅尔）和可选的光环。
// 光照来自 sunDir（平行光，Shader 里算），全部由 uTime 驱动自转 / 云层流动，按 seed 生成地形和条带。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import {NOISE_GLSL} from '../../../engine/shaders/noise.glsl';
import type {Vec3} from '../../../engine/shot';

export type PlanetProps = {
  position?: Vec3;
  radius?: number;
  kind?: number; // 0 类地，1 气态
  ocean?: string;
  land?: string;
  band1?: string; // 气态条带色 1
  band2?: string; // 气态条带色 2
  atmosphere?: string;
  sunDir?: Vec3;
  spin?: number; // 自转（圈 / 分钟）
  tilt?: number; // 自转轴倾角（度）
  clouds?: number; // 云量 0–1
  cityLights?: boolean;
  ring?: boolean;
  ringColor?: string;
  seed?: string | number;
};

const VERT = /* glsl */ `
varying vec3 vObj; varying vec3 vN; varying vec3 vView; varying vec3 vWN; varying vec3 vWP;
void main() {
  vObj = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vWN = normalize(mat3(modelMatrix) * normal);
  vec4 mv = viewMatrix * wp;
  vView = -mv.xyz; vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`;

const SURF_FRAG = /* glsl */ `
uniform float uTime; uniform float uKind; uniform vec3 uSun; uniform vec3 uSeed;
uniform vec3 uOcean; uniform vec3 uLand; uniform vec3 uB1; uniform vec3 uB2; uniform vec3 uAtm;
uniform float uClouds; uniform float uCity; uniform float uSpin;
varying vec3 vObj; varying vec3 vN; varying vec3 vView; varying vec3 vWN; varying vec3 vWP;
${NOISE_GLSL}
void main() {
  vec3 p = normalize(vObj);
  float ang = uTime * uSpin;
  mat2 r = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  vec3 q = vec3(r * p.xz, p.y).xzy;                      // 绕 y 自转后的表面坐标
  vec3 sun = normalize(uSun);
  float ndl = dot(normalize(vWN), sun);
  float day = smoothstep(-0.05, 0.15, ndl);
  vec3 albedo; float spec = 0.0; float night = 0.0;
  if (uKind < 0.5) {
    float h = fbm3s(q * 1.8 + uSeed) * 0.7 + 0.22 * fbm3s(q * 6.0 + uSeed * 1.7) + 0.08 * fbm3s(q * 20.0 + uSeed);
    float landM = smoothstep(0.02, 0.06, h);
    float lat = abs(p.y);
    vec3 landCol = mix(uLand, uLand * vec3(1.2, 1.05, 0.8), smoothstep(0.1, 0.4, h)) * (0.8 + 0.4 * fbm3s(q * 14.0));
    landCol = mix(landCol, vec3(0.55, 0.45, 0.3), smoothstep(0.25, 0.45, h) * 0.6);         // 高地 / 沙漠
    vec3 seaCol = mix(uOcean * 0.55, uOcean, smoothstep(-0.4, 0.05, h));                  // 浅海更亮
    albedo = mix(seaCol, landCol, landM);
    albedo = mix(albedo, vec3(0.92, 0.95, 1.0), smoothstep(0.72, 0.8, lat + 0.06 * snoise(q * 5.0)));  // 冰盖
    spec = (1.0 - landM) * 0.9;
    night = landM * smoothstep(0.86, 0.95, snoise(q * 70.0 + uSeed) * 0.5 + 0.5) * smoothstep(0.3, 0.7, snoise(q * 6.0 + uSeed) * 0.5 + 0.5) * (1.0 - smoothstep(0.6, 0.75, lat)) * uCity;
    // 云层（比地表转得快一点）
    vec3 cq = vec3(mat2(cos(ang * 0.25), -sin(ang * 0.25), sin(ang * 0.25), cos(ang * 0.25)) * q.xz, q.y).xzy;
    float cn = fbm3s(cq * 3.5 + uSeed + vec3(0.0, 0.0, uTime * 0.01)) + 0.25 * fbm3s(cq * 12.0 + uSeed);
    float cl = smoothstep(0.35 - uClouds * 0.4, 0.75 - uClouds * 0.3, cn);
    albedo = mix(albedo, vec3(1.0), cl * 0.85);
    spec *= 1.0 - cl;
    night *= 1.0 - cl;
  } else {
    float lat = p.y;
    float turb = fbm3s(vec3(q.x * 2.0, lat * 3.0, q.z * 2.0) + uSeed) * 0.35;
    float bands = sin((lat + turb * 0.4) * 22.0 + snoise(vec3(lat * 8.0, uSeed.x, 0.0)) * 2.0);
    albedo = mix(uB1, uB2, 0.5 + 0.5 * bands);
    albedo *= 0.85 + 0.3 * fbm3s(vec3(q.x * 6.0, lat * 40.0, q.z * 6.0) + uSeed);
    // 风暴眼
    vec3 sc = normalize(vec3(0.6, -0.35, 0.72));
    float ds = distance(q, sc);
    float storm = smoothstep(0.22, 0.0, ds);
    albedo = mix(albedo, uB2 * vec3(1.3, 0.75, 0.55), storm * (0.6 + 0.4 * sin(ds * 60.0 - uTime)));
  }
  vec3 n = normalize(vN); vec3 v = normalize(vView);
  vec3 col = albedo * (0.02 + 1.25 * max(ndl, 0.0)) * day;
  // 海面高光
  vec3 hdir = normalize(sun + normalize(cameraPosition - vWP));
  col += vec3(1.0, 0.95, 0.85) * pow(max(dot(normalize(vWN), hdir), 0.0), 140.0) * spec * day * 0.6;
  // 晨昏线附近的暖色 + 大气散射边缘
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  col += uAtm * fres * (0.15 + 1.4 * smoothstep(-0.25, 0.5, ndl));
  col += vec3(1.0, 0.45, 0.15) * smoothstep(0.08, 0.0, abs(ndl)) * fres * 0.6 * (uKind < 0.5 ? 1.0 : 0.4);  // 晨昏线只在边缘泛暖
  col += vec3(1.0, 0.72, 0.38) * night * (1.0 - day) * 1.6;
  gl_FragColor = vec4(col, 1.0);
}`;

const ATM_FRAG = /* glsl */ `
uniform vec3 uSun; uniform vec3 uAtm;
varying vec3 vObj; varying vec3 vN; varying vec3 vView; varying vec3 vWN;
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(vView);
  float rim = pow(1.0 - abs(dot(n, v)), 5.0);
  float lit = smoothstep(-0.3, 0.6, dot(normalize(vWN), normalize(uSun)));
  gl_FragColor = vec4(uAtm * rim * lit * 1.6, 1.0);
}`;

const RING_FRAG = /* glsl */ `
uniform vec3 uColor; uniform vec3 uSeed; uniform vec3 uSun; uniform float uR0; uniform float uR1;
varying vec3 vObj; varying vec3 vN; varying vec3 vView; varying vec3 vWN;
float h1(float x) { return fract(sin(x * 127.1 + uSeed.x) * 43758.5453); }
void main() {
  float r = length(vObj.xy);
  float u = (r - uR0) / (uR1 - uR0);
  if (u < 0.0 || u > 1.0) discard;
  float k = floor(u * 90.0);
  float dens = 0.35 + 0.65 * h1(k) * (0.6 + 0.4 * sin(u * 300.0));
  dens *= smoothstep(0.0, 0.05, u) * smoothstep(1.0, 0.92, u) * (1.0 - 0.8 * smoothstep(0.6, 0.62, u) * smoothstep(0.66, 0.64, u));  // 卡西尼缝
  float lit = 0.35 + 0.65 * abs(dot(normalize(vWN), normalize(uSun)));
  gl_FragColor = vec4(uColor * dens * lit, dens * 0.85);
}`;

const toVec = (seed: string | number) => {
  const n = typeof seed === 'number' ? seed : [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 100003, 7);
  return new THREE.Vector3(((n * 0.6180339) % 1) * 30, ((n * 0.4142135) % 1) * 30, ((n * 0.7320508) % 1) * 30);
};

export const PlanetAsset: React.FC<PlanetProps> = ({
  position = [0, 0, 0], radius = 5, kind = 0, ocean = '#1c4fa0', land = '#3f6b35', band1 = '#d9b48a', band2 = '#9c6a45',
  atmosphere = '#5fa8ff', sunDir = [1, 0.25, 0.6], spin = 0.6, tilt = 18, clouds = 0.5, cityLights = true, ring = false, ringColor = '#d8c6a4', seed = 'planet',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const mats = useMemo(() => {
    const sv = toVec(seed);
    const common = {uSun: {value: new THREE.Vector3(...sunDir)}, uAtm: {value: new THREE.Color(atmosphere)}};
    return {
      surf: new THREE.ShaderMaterial({vertexShader: VERT, fragmentShader: SURF_FRAG, uniforms: {
        ...common, uTime: {value: 0}, uKind: {value: kind}, uSeed: {value: sv}, uOcean: {value: new THREE.Color(ocean)}, uLand: {value: new THREE.Color(land)},
        uB1: {value: new THREE.Color(band1)}, uB2: {value: new THREE.Color(band2)}, uClouds: {value: clouds}, uCity: {value: cityLights ? 1 : 0}, uSpin: {value: (spin * Math.PI * 2) / 60}}}),
      atm: new THREE.ShaderMaterial({vertexShader: VERT, fragmentShader: ATM_FRAG, uniforms: common, transparent: true, blending: THREE.AdditiveBlending, side: THREE.FrontSide, depthWrite: false}),
      ring: new THREE.ShaderMaterial({vertexShader: VERT, fragmentShader: RING_FRAG, transparent: true, side: THREE.DoubleSide, depthWrite: false,
        uniforms: {uColor: {value: new THREE.Color(ringColor)}, uSeed: {value: sv}, uSun: {value: new THREE.Vector3(...sunDir)}, uR0: {value: radius * 1.35}, uR1: {value: radius * 2.3}}}),
    };
  }, [kind, ocean, land, band1, band2, atmosphere, sunDir, clouds, cityLights, ringColor, spin, radius, seed]);
  mats.surf.uniforms.uTime.value = t;
  void random;
  return (
    <group position={position} rotation={[0, 0, (tilt * Math.PI) / 180]}>
      <mesh material={mats.surf}>
        <sphereGeometry args={[radius, 128, 96]} />
      </mesh>
      <mesh material={mats.atm} scale={1.025}>
        <sphereGeometry args={[radius, 96, 64]} />
      </mesh>
      {ring && (
        <mesh material={mats.ring} rotation={[-Math.PI / 2 + 0.38, 0, 0]}>
          <ringGeometry args={[radius * 1.35, radius * 2.3, 256, 1]} />
        </mesh>
      )}
    </group>
  );
};
