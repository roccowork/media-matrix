// 资产 biology.axon.v1：两个神经元之间的轴突（信号通道）+ 电信号脉冲 + 沿途迸出的火花 + 到达时的突触爆光。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import {taperedTube} from '../../../engine/geometry/taperedTube';
import type {Vec3} from '../../../engine/shot';

export type AxonProps = {
  from?: Vec3;
  to?: Vec3;
  start?: number; // 秒：信号出发
  duration?: number; // 秒：传到终点用时
  thickness?: number;
  seed?: string;
  membrane?: string;
  glow?: string;
};

const VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vView;
void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }`;
const FRAG = /* glsl */ `
uniform float uFront; uniform vec3 uMem; uniform vec3 uGlow;
varying vec2 vUv; varying vec3 vN; varying vec3 vView;
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(vView);
  float fres = pow(1.0 - abs(dot(n, v)), 2.0);
  float band = exp(-pow((vUv.x - uFront) * 14.0, 2.0));
  float trail = smoothstep(uFront - 0.5, uFront, vUv.x) * step(vUv.x, uFront) * 0.6;   // 身后拖着的余辉
  float rings = 0.5 + 0.5 * sin(vUv.x * 160.0);                                   // 髓鞘环节的细纹
  vec3 col = uMem * (0.05 + 0.75 * fres) * (0.85 + 0.15 * rings) + uGlow * (band * 5.0 + trail * 0.6 * fres);
  gl_FragColor = vec4(col, 0.3 + 0.6 * fres + band * 0.8);
}`;

const glowTex = (() => {
  let t: THREE.Texture | null = null;
  return () => {
    if (t) return t;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.2, 'rgba(255,255,255,0.5)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
    t = new THREE.CanvasTexture(c);
    return t;
  };
})();

export const AxonAsset: React.FC<AxonProps> = ({from = [0, 0, 0], to = [4, 0, 0], start = 1, duration = 3, thickness = 0.07, seed = 'ax', membrane = '#4f8fff', glow = '#ffae42'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const {geo, mat, curve, sparkSeeds} = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 8; k++) {
      const u = k / 8;
      const p = a.clone().lerp(b, u);
      const amp = Math.sin(u * Math.PI) * a.distanceTo(b) * 0.12;
      p.add(new THREE.Vector3(random(`${seed}x${k}`) - 0.5, random(`${seed}y${k}`) - 0.5, random(`${seed}z${k}`) - 0.5).multiplyScalar(amp * 2));
      pts.push(p);
    }
    const c = new THREE.CatmullRomCurve3(pts);
    const m = new THREE.ShaderMaterial({vertexShader: VERT, fragmentShader: FRAG, transparent: true, uniforms: {uFront: {value: -1}, uMem: {value: new THREE.Color(membrane)}, uGlow: {value: new THREE.Color(glow)}}});
    return {geo: taperedTube(c, 160, 12, thickness, thickness * 0.7), mat: m, curve: c, sparkSeeds: Array.from({length: 40}, (_, i) => i)};
  }, [from, to, thickness, seed, membrane, glow]);
  const u = (t - start) / duration;
  mat.uniforms.uFront.value = u;
  const tex = glowTex();
  const head = u >= 0 && u <= 1 ? curve.getPointAt(Math.min(1, Math.max(0, u))) : null;
  const arrive = t - (start + duration); // 到达后经过的秒数
  const burst = arrive >= 0 ? Math.exp(-arrive * 2.2) : 0;
  const glowCol = new THREE.Color(glow);
  return (
    <group>
      <mesh geometry={geo} material={mat} />
      {head && (
        <sprite position={head} scale={[0.45, 0.45, 1]}>
          <spriteMaterial map={tex} color={glowCol.clone().multiplyScalar(3)} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      )}
      {/* 信号经过时沿途迸出的火花：每颗火花在经过时刻出生，往外飘、变暗 */}
      {sparkSeeds.map((i) => {
        const su = random(`${seed}s${i}`);
        const born = start + su * duration;
        const age = t - born;
        if (age < 0 || age > 1.2) return null;
        const p = curve.getPointAt(su);
        const d = new THREE.Vector3(random(`${seed}sx${i}`) - 0.5, random(`${seed}sy${i}`) - 0.5, random(`${seed}sz${i}`) - 0.5).normalize().multiplyScalar(age * 0.6);
        const k = Math.exp(-age * 3);
        return (
          <sprite key={i} position={p.clone().add(d)} scale={[0.12 * k + 0.02, 0.12 * k + 0.02, 1]}>
            <spriteMaterial map={tex} color={glowCol.clone().multiplyScalar(2.5 * k)} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        );
      })}
      {burst > 0.01 && (
        <sprite position={to} scale={[3.5 * (1.4 - burst), 3.5 * (1.4 - burst), 1]}>
          <spriteMaterial map={tex} color={glowCol.clone().multiplyScalar(3 * burst)} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      )}
    </group>
  );
};
