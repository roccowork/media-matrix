// 资产 tech.citychip.v1：「城市灯光变成芯片电路」——从高空俯瞰的城市夜景平面，从中心向外被一道白色波前改写成芯片：
//   城市层：扭曲的路网（主干道亮、支路暗）、沿路的点状路灯、街区里成团的灯光、市中心更密更亮（暖橙色）
//   芯片层：同一套网格——路变成走线（直角布线、细线 + 流动的数据光点），路口变成焊盘 / 过孔，街区变成芯片模块（发光边框 + 内部细格）
//   转场：从 morphCenter 向外的圆形波前（带噪声起伏），波前处一圈白光；之前是城市、之后是芯片
// 全部在一张平面的片元着色器里按坐标计算，镜头从高处俯冲下来看；同帧确定。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import {NOISE_GLSL} from '../../../engine/shaders/noise.glsl';
import type {Vec3} from '../../../engine/shot';

export type CityChipProps = {
  position?: Vec3; // 平面中心（平面水平铺在 y = position.y）
  size?: number; // 平面边长
  blocks?: number; // 平面上大约多少个街区（每边）
  morphAt?: number; // 秒：开始变芯片；-1 = 不变（纯城市）
  morphDuration?: number; // 秒：波前走到平面边缘要多久
  cityColor?: string;
  chipColor?: string;
  brightness?: number;
  seed?: string | number;
};

const VERT = /* glsl */ `
varying vec2 vUv; varying float vDist;
void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`;

const FRAG = /* glsl */ `
uniform float uT; uniform float uBlocks; uniform float uMorph; uniform float uSeedF; uniform float uBright;
uniform vec3 uCity; uniform vec3 uChip;
varying vec2 vUv; varying float vDist;
${NOISE_GLSL}
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeedF) * 43758.5453); }
float aal(float d, float w, float px) { return 1.0 - smoothstep(w, w + px * 1.5, abs(d)); }
void main() {
  vec2 uv = vUv - 0.5;
  float r = length(uv);
  // 网格坐标（轻微扭曲，像真实城市的路网）
  vec2 warp = vec2(snoise(vec3(uv * 2.2, uSeedF)), snoise(vec3(uv * 2.2 + 7.0, uSeedF)));
  vec2 g = (uv + warp * 0.035) * uBlocks;
  vec2 cell = floor(g), f = fract(g);
  float px = fwidth(g.x);
  // 路：每格边界都是路；每 4 格一条主干道
  float dx = min(f.x, 1.0 - f.x), dy = min(f.y, 1.0 - f.y);
  bool majX = mod(floor(g.x + 0.5), 4.0) == 0.0, majY = mod(floor(g.y + 0.5), 4.0) == 0.0;
  float road = max(aal(dx, majX ? 0.035 : 0.015, px), aal(dy, majY ? 0.035 : 0.015, px));
  float major = max(majX ? aal(dx, 0.035, px) : 0.0, majY ? aal(dy, 0.035, px) : 0.0);
  // 市中心更亮更密
  // 灯光密度：几个城区中心 + 噪声起伏；一条河和几块空地完全是黑的（像卫星夜景照片）
  float n = snoise(vec3(uv * 3.5, uSeedF + 3.0)) * 0.5 + snoise(vec3(uv * 9.0, uSeedF + 5.0)) * 0.25;
  float density = smoothstep(0.62, 0.0, r) * 0.9 + smoothstep(0.25, 0.0, length(uv - vec2(0.22, -0.15))) * 0.6 + smoothstep(0.2, 0.0, length(uv - vec2(-0.25, 0.2))) * 0.5;
  density = clamp(density * (0.55 + 0.9 * n) - 0.05, 0.0, 1.2);
  float river = abs(uv.y + 0.08 * sin(uv.x * 9.0 + uSeedF) - 0.12 + 0.05 * snoise(vec3(uv * 5.0, 2.0)));
  density *= smoothstep(0.012, 0.03, river);
  density *= smoothstep(0.62, 0.7, snoise(vec3(uv * 6.0, uSeedF + 9.0)) * 0.5 + 0.5) < 0.5 ? 1.0 : 0.15;
  // ---------- 城市 ----------
  // 路灯：沿路的点
  float lamps = 0.0;
  vec2 lg = g * 6.0;
  vec2 lf = fract(lg) - 0.5;
  lamps = smoothstep(0.18, 0.0, length(lf)) * road * step(0.3, h21(floor(lg)));
  // 街区里的灯团
  vec2 bg = g * 3.0; vec2 bf = fract(bg) - 0.5; vec2 bc = floor(bg);
  float bl = smoothstep(0.22, 0.0, length(bf + (vec2(h21(bc), h21(bc + 3.0)) - 0.5) * 0.4)) * step(1.0 - density * 0.9, h21(bc + 9.0));
  float vary = 0.5 + h21(floor(lg) + 2.0);
  vec3 city = uCity * (major * 0.28 * density + road * 0.03 * density + lamps * vary * 1.0 * density + bl * 1.25 * density);
  city = mix(city, city * vec3(1.0, 1.05, 1.25), step(0.85, h21(floor(lg) + 4.0)));   // 少数冷白色灯（LED）
  city += uCity * 0.025 * density;           // 城市天光
  // ---------- 芯片 ----------
  // 走线：路 → 细线，主干道 → 双线总线
  float trace = max(aal(dx, 0.008, px), aal(dy, 0.008, px));
  float bus = max(majX ? aal(abs(dx - 0.03), 0.006, px) : 0.0, majY ? aal(abs(dy - 0.03), 0.006, px) : 0.0);
  // 数据光点沿走线流动
  float flowX = fract(g.x * 0.5 - uT * 0.6 + h21(vec2(floor(g.y + 0.5), 1.0)));
  float flowY = fract(g.y * 0.5 - uT * 0.5 + h21(vec2(floor(g.x + 0.5), 2.0)));
  float flow = aal(dy, 0.01, px) * pow(flowX, 18.0) + aal(dx, 0.01, px) * pow(flowY, 18.0);
  // 路口 → 焊盘
  float pad = smoothstep(0.07, 0.05, length(vec2(dx, dy))) * step(0.4, h21(cell + 5.0));
  // 街区 → 芯片模块（发光边框 + 内部细格）
  vec2 bq = abs(f - 0.5);
  float inBlock = step(max(bq.x, bq.y), 0.36) * step(0.35, h21(cell + 11.0));
  float frame = inBlock * (1.0 - smoothstep(0.0, px * 2.0, abs(max(bq.x, bq.y) - 0.34)));
  float grid = inBlock * 0.25 * max(aal(fract(f.x * 8.0) - 0.5, 0.04, px * 8.0), aal(fract(f.y * 8.0) - 0.5, 0.04, px * 8.0));
  float core = inBlock * step(max(bq.x, bq.y), 0.16) * (0.6 + 0.4 * sin(uT * 3.0 + h21(cell) * 6.28));
  vec3 chip = uChip * (trace * 0.45 + bus * 0.6 + pad * 1.2 + frame * 0.9 + grid + core * 0.5) + vec3(1.0) * flow * 1.6;
  chip += uChip * 0.025;
  // ---------- 转场波前 ----------
  float front = uMorph * 0.85 + 0.06 * snoise(vec3(uv * 6.0, uSeedF));
  float m = smoothstep(front + 0.01, front - 0.03, r);
  float edge = exp(-pow((r - front) * 110.0, 2.0)) * step(0.001, uMorph) * step(uMorph, 0.999);
  vec3 col = mix(city, chip, m) + mix(uCity, vec3(1.0), 0.5) * edge * 0.9;
  // 平面四周淡出（看不到边）
  col *= smoothstep(0.5, 0.36, max(abs(uv.x), abs(uv.y)));
  gl_FragColor = vec4(col * uBright, 1.0);
}`;

export const CityChipAsset: React.FC<CityChipProps> = ({
  position = [0, 0, 0], size = 40, blocks = 40, morphAt = 1, morphDuration = 3, cityColor = '#ffb35c', chipColor = '#45d3ff', brightness = 1, seed = 'citychip',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const S = String(seed);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: {uT: {value: 0}, uBlocks: {value: blocks}, uMorph: {value: 0}, uSeedF: {value: random(`cc-${S}`) * 100}, uBright: {value: brightness},
      uCity: {value: new THREE.Color(cityColor)}, uChip: {value: new THREE.Color(chipColor)}},
  }), [S, blocks, brightness, cityColor, chipColor]);
  mat.uniforms.uT.value = t;
  const x = morphAt < 0 ? 0 : Math.min(1, Math.max(0, (t - morphAt) / Math.max(morphDuration, 0.01)));
  mat.uniforms.uMorph.value = x * x * (3 - 2 * x) * 1.25;
  return (
    <mesh material={mat} position={position} rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false}>
      <planeGeometry args={[size, size, 1, 1]} />
    </mesh>
  );
};
