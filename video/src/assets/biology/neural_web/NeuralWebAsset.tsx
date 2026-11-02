// 资产 biology.neural_web.v1：GPU 粒子神经网（默认 24 万个光点）。
// 每颗粒子只存「属于哪条纤维、在纤维上的位置、随机抖动」三个属性；位置、颜色、亮度全在顶点着色器里按 uTime 算，
// CPU 每帧零开销、结果确定。纤维 = 随机起点 + 多个正弦叠加 + simplex 噪声扭曲的流线（像参考图的发光神经纤维）。
// 激活：一道从 waveOrigin 向外扩散的球面波，波前经过的地方变亮变暖，之后留余辉。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import {NOISE_GLSL} from '../../../engine/shaders/noise.glsl';
import type {Vec3} from '../../../engine/shot';

export type NeuralWebProps = {
  center?: Vec3;
  radius?: number;
  fibers?: number;
  perFiber?: number;
  waveOrigin?: Vec3;
  waveStart?: number; // 秒
  waveSpeed?: number; // 单位/秒
  size?: number;
  warm?: string;
  cool?: string;
  seed?: string;
};

const VERT = /* glsl */ `
attribute vec4 aSeed;   // x = 纤维 id 的随机数, y = 纤维上的位置 u, z/w = 抖动
uniform float uTime; uniform vec3 uCenter; uniform float uRadius; uniform vec3 uWaveO; uniform float uWaveR; uniform float uSize;
uniform vec3 uWarm; uniform vec3 uCool;
varying vec3 vCol; varying float vA;
${NOISE_GLSL}
float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
void main() {
  float f = aSeed.x; float u = aSeed.y;
  // 纤维的起点和走向（每条纤维一组固定随机数）
  vec3 s0 = vec3(h1(f + 1.0), h1(f + 2.0), h1(f + 3.0)) * 2.0 - 1.0;
  vec3 dir = normalize(vec3(h1(f + 4.0), h1(f + 5.0), h1(f + 6.0)) * 2.0 - 1.0);
  float len = uRadius * (0.8 + 1.2 * h1(f + 7.0));
  vec3 p = uCenter + s0 * uRadius * 0.9 + dir * (u - 0.5) * len;
  p += vec3(sin(u * 6.0 + f * 9.0), sin(u * 5.0 + f * 13.0), sin(u * 7.0 + f * 5.0)) * uRadius * 0.12;
  vec3 w = vec3(snoise(p * 0.18 + 1.0), snoise(p * 0.18 + 7.0), snoise(p * 0.18 + 13.0));
  p += w * uRadius * 0.22;
  p += (vec3(aSeed.z, aSeed.w, h1(aSeed.z * 31.0)) - 0.5) * 0.06 * (1.0 + 3.0 * pow(h1(aSeed.w * 17.0), 6.0));  // 纤维的粗细和散开的光点
  // 激活波
  float d = distance(p, uWaveO);
  float front = exp(-pow((d - uWaveR) * 1.4, 2.0));
  float lit = smoothstep(uWaveR, uWaveR - 3.0, d) * step(0.0, uWaveR);
  float shimmer = 0.6 + 0.4 * sin(u * 60.0 - uTime * 4.0 + f * 20.0);
  float warmness = clamp(0.25 + 0.75 * lit + front, 0.0, 1.0) * step(0.45, h1(f + 9.0)) + front;
  vCol = mix(uCool, uWarm, clamp(warmness, 0.0, 1.0));
  vA = (0.45 + 0.6 * lit + 2.5 * front) * shimmer;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (1.0 + 2.5 * pow(h1(aSeed.z * 7.0), 8.0)) * (300.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
varying vec3 vCol; varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  float a = smoothstep(0.5, 0.0, r);
  gl_FragColor = vec4(vCol * vA * a * 2.0, 1.0);
}`;

export const NeuralWebAsset: React.FC<NeuralWebProps> = ({center = [0, 0, 0], radius = 8, fibers = 480, perFiber = 500, waveOrigin = [0, 0, 0], waveStart = 0, waveSpeed = 2.5, size = 0.045, warm = '#ff9a3c', cool = '#3b7bff', seed = 'web'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const {geo, mat} = useMemo(() => {
    const n = fibers * perFiber;
    const a = new Float32Array(n * 4);
    for (let i = 0; i < fibers; i++) {
      const fid = random(`${seed}f${i}`) * 100;
      for (let k = 0; k < perFiber; k++) {
        const j = (i * perFiber + k) * 4;
        a[j] = fid;
        a[j + 1] = k / (perFiber - 1);
        a[j + 2] = random(`${seed}a${i}-${k}`);
        a[j + 3] = random(`${seed}b${i}-${k}`);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('aSeed', new THREE.BufferAttribute(a, 4));
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const m = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: {value: 0}, uCenter: {value: new THREE.Vector3(...center)}, uRadius: {value: radius}, uWaveO: {value: new THREE.Vector3(...waveOrigin)},
        uWaveR: {value: -1}, uSize: {value: size}, uWarm: {value: new THREE.Color(warm)}, uCool: {value: new THREE.Color(cool)},
      },
    });
    return {geo: g, mat: m};
  }, [center, radius, fibers, perFiber, waveOrigin, size, warm, cool, seed]);
  mat.uniforms.uTime.value = t;
  mat.uniforms.uWaveR.value = t < waveStart ? -1 : (t - waveStart) * waveSpeed;
  return <points geometry={geo} material={mat} frustumCulled={false} />;
};
