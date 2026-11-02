// 资产 biology.neuron.v1：程序化神经元 = 凹凸的细胞体（胞体）+ 若干条分叉、渐细的树突。
// 胞体：二十面体细分后按分形噪声位移（一次算好，确定性），Shader 里做半透明膜（菲涅尔边缘光）+ 激活后内部的橙金色辉光。
// 树突：渐细管；激活后一道亮光从胞体沿树突往外传。全部由 uTime 驱动。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import {createNoise3D} from '../../../engine/shaders/cpuNoise';
import {taperedTube} from '../../../engine/geometry/taperedTube';
import {NOISE_GLSL} from '../../../engine/shaders/noise.glsl';
import type {Vec3} from '../../../engine/shot';

export type NeuronProps = {
  position?: Vec3;
  radius?: number;
  dendrites?: number;
  reach?: number; // 树突长度
  activateAt?: number; // 秒；激活时刻（-1 = 不激活）
  seed?: string;
  membrane?: string; // 膜的颜色
  glow?: string; // 激活辉光颜色
};

const SOMA_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vView; varying vec3 vP;
void main() {
  vP = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = -mv.xyz; vN = normalMatrix * normal;
  gl_Position = projectionMatrix * mv;
}`;
const SOMA_FRAG = /* glsl */ `
uniform float uAct; uniform float uTime; uniform vec3 uMem; uniform vec3 uGlow;
varying vec3 vN; varying vec3 vView; varying vec3 vP;
${NOISE_GLSL}
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(vView);
  float fres = pow(1.0 - abs(dot(n, v)), 2.5);
  float vein = smoothstep(0.55, 0.95, 1.0 - abs(snoise(vP * 3.2)));          // 表面细小的纹理
  float inner = 0.5 + 0.5 * snoise(vP * 1.6 + uTime * 0.6);
  vec3 col = uMem * (0.06 + 0.9 * fres) + uMem * vein * 0.18;
  col += uGlow * uAct * (0.25 + 0.9 * inner * inner) * (0.25 + 0.75 * (1.0 - fres)) * 0.9;  // 激活：从内部透出来的光（有明暗起伏，不是一团白）
  col += uGlow * uAct * vein * 0.8;
  gl_FragColor = vec4(col, 0.55 + 0.4 * fres + 0.3 * uAct);
}`;
const DEND_FRAG = /* glsl */ `
uniform float uAct; uniform float uSince; uniform vec3 uMem; uniform vec3 uGlow;
varying vec2 vUv; varying vec3 vN; varying vec3 vView;
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(vView);
  float fres = pow(1.0 - abs(dot(n, v)), 2.0);
  float front = uSince * 0.45;                                        // 亮光往外传的位置（沿长度 0→1）
  float band = exp(-pow((vUv.x - front) * 24.0, 2.0)) * step(0.0, uSince);
  float lit = (1.0 - smoothstep(front - 0.3, front, vUv.x)) * step(0.0, uSince) * 0.05; // 传过的地方留一点余辉
  vec3 col = uMem * (0.05 + 0.75 * fres) + uGlow * (band * 1.3 + lit * fres) * uAct;
  gl_FragColor = vec4(col, 0.25 + 0.6 * fres + band * 0.5);
}`;
const DEND_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vView;
void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }`;

export const NeuronAsset: React.FC<NeuronProps> = ({position = [0, 0, 0], radius = 0.55, dendrites = 12, reach = 3.2, activateAt = -1, seed = 'n0', membrane = '#4f8fff', glow = '#ffae42'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const {soma, dends, mats} = useMemo(() => {
    const noise = createNoise3D(seed);
    const g = new THREE.IcosahedronGeometry(radius, 48);
    const p = g.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const d = v.clone().normalize();
      const k = 1 + 0.22 * noise(d.x * 2.2, d.y * 2.2, d.z * 2.2) + 0.07 * noise(d.x * 7, d.y * 7, d.z * 7);
      v.copy(d.multiplyScalar(radius * k));
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    // 树突：从胞体表面随机方向长出，路径弯曲，末端分叉一次
    const curves: {geo: THREE.BufferGeometry}[] = [];
    for (let i = 0; i < dendrites; i++) {
      const dir = new THREE.Vector3(random(`${seed}dx${i}`) - 0.5, random(`${seed}dy${i}`) - 0.5, random(`${seed}dz${i}`) - 0.5).normalize();
      const len = reach * (0.6 + 0.6 * random(`${seed}dl${i}`));
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 6; k++) {
        const u = k / 6;
        const wob = new THREE.Vector3(noise(i * 3.1, u * 3, 1.3), noise(i * 3.1, u * 3, 7.7), noise(i * 3.1, u * 3, 13.1)).multiplyScalar(u * len * 0.45);
        pts.push(dir.clone().multiplyScalar(radius * 0.8 + u * len).add(wob));
      }
      const c = new THREE.CatmullRomCurve3(pts);
      curves.push({geo: taperedTube(c, 96, 10, radius * 0.13, 0.006)});
      // 分叉：每条主干在 35% / 60% / 80% 处各分出一支，越往外越细
      [0.35, 0.6, 0.8].forEach((at, j) => {
        const fork = c.getPointAt(at);
        const fdir = c.getTangentAt(at).add(new THREE.Vector3(random(`${seed}fx${i}${j}`) - 0.5, random(`${seed}fy${i}${j}`) - 0.5, random(`${seed}fz${i}${j}`) - 0.5).multiplyScalar(1.6)).normalize();
        const flen = len * (0.5 - j * 0.12);
        const fpts = [0, 1, 2, 3, 4].map((k) => fork.clone().add(fdir.clone().multiplyScalar((k / 4) * flen)).add(new THREE.Vector3(noise(i + j * 5, k, 3), noise(i + j * 5, k, 9), noise(i + j * 5, k, 17)).multiplyScalar((k / 4) * flen * 0.35)));
        curves.push({geo: taperedTube(new THREE.CatmullRomCurve3(fpts), 48, 6, radius * (0.05 - j * 0.012), 0.004)});
      });
    }
    const mk = (vs: string, fs: string) =>
      new THREE.ShaderMaterial({
        vertexShader: vs,
        fragmentShader: fs,
        transparent: true,
        depthWrite: true,
        uniforms: {uAct: {value: 0}, uTime: {value: 0}, uSince: {value: -1}, uMem: {value: new THREE.Color(membrane)}, uGlow: {value: new THREE.Color(glow)}},
      });
    return {soma: g, dends: curves, mats: {soma: mk(SOMA_VERT, SOMA_FRAG), dend: mk(DEND_VERT, DEND_FRAG)}};
  }, [radius, dendrites, reach, seed, membrane, glow]);
  const since = activateAt < 0 ? -1 : t - activateAt;
  const act = since < 0 ? 0 : Math.min(1, since / 0.35) * (0.75 + 0.25 * Math.exp(-since * 1.5));
  for (const m of [mats.soma, mats.dend]) {
    m.uniforms.uAct.value = act;
    m.uniforms.uTime.value = t;
    m.uniforms.uSince.value = since;
  }
  return (
    <group position={position}>
      <mesh geometry={soma} material={mats.soma} />
      {dends.map((d, i) => (
        <mesh key={i} geometry={d.geo} material={mats.dend} />
      ))}
    </group>
  );
};
