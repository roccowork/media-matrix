// 资产 cosmos.mooncore.v1：月球心脏（《一百年后》第 7 镜「月亮，成了 AI 的心脏」）。
// 月球表面（环形山、月海，程序生成）按种子切成若干块「壳板」（球面 Voronoi）。
// crackAt 起：板块之间的缝亮起金色光（从细到粗），openAt 起：壳板沿各自方向缓慢向外分开、略微转动，
// 露出里面发光、脉动的核心（能量球 + 表面流动的电路纹光）。全部由 uTime 驱动、按种子生成，确定性。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import {NOISE_GLSL} from '../../../engine/shaders/noise.glsl';
import type {Vec3} from '../../../engine/shot';

export type MoonCoreProps = {
  position?: Vec3;
  radius?: number;
  plates?: number; // 壳板块数
  crackAt?: number; // 裂缝开始发光（秒）
  openAt?: number; // 壳板开始分开（秒）
  openSpeed?: number; // 分开速度（半径 / 秒）
  coreColor?: string;
  crackColor?: string;
  sunDir?: Vec3;
  brightness?: number;
  seed?: string | number;
};

const SHELL_VERT = /* glsl */ `
attribute float aPlate;
varying vec3 vObj; varying vec3 vWN; varying vec3 vN; varying vec3 vView; varying float vPlate;
void main() {
  vObj = position; vPlate = aPlate;
  vWN = normalize(mat3(modelMatrix) * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = -mv.xyz; vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`;
const SHELL_FRAG = /* glsl */ `
uniform vec3 uSun; uniform vec3 uSeed; uniform float uCrack; uniform vec3 uCrackCol; uniform vec3 uCoreCol; uniform float uOpen; uniform float uRad;
uniform vec3 uCentres[48]; uniform int uN;
varying vec3 vObj; varying vec3 vWN; varying vec3 vN; varying vec3 vView; varying float vPlate;
${NOISE_GLSL}
float crater(vec3 p, float sc) {
  vec3 q = p * sc; vec3 i = floor(q), f = fract(q); float d = 9.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 g = vec3(x, y, z);
    vec3 o = fract(sin(vec3(dot(i + g, vec3(127.1, 311.7, 74.7)), dot(i + g, vec3(269.5, 183.3, 246.1)), dot(i + g, vec3(113.5, 271.9, 124.6))) + uSeed) * 43758.5453);
    d = min(d, length(g + o - f));
  }
  return d;
}
void main() {
  vec3 p = normalize(vObj);
  bool inside = !gl_FrontFacing;
  if (inside) {                                              // 壳板内侧：被核心照亮的暗面
    float rimIn = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 3.0);
    gl_FragColor = vec4(vec3(0.035, 0.03, 0.028) + uCoreCol * (0.015 + 0.1 * rimIn) * uOpen, 1.0);   // 壳板内侧：暗岩石，只有边缘被核心照亮
    return;
  }
  // 月面：月海（暗色大斑）+ 两档环形山 + 细碎起伏
  float mare = smoothstep(0.1, 0.35, fbm3s(p * 1.4 + uSeed));
  float c1 = crater(p, 6.0), c2 = crater(p, 18.0);
  float rim = smoothstep(0.32, 0.38, c1) * (1.0 - smoothstep(0.38, 0.46, c1)) * 0.25 + smoothstep(0.3, 0.35, c2) * (1.0 - smoothstep(0.35, 0.4, c2)) * 0.12;
  float bowl = (1.0 - smoothstep(0.0, 0.33, c1)) * 0.18 + (1.0 - smoothstep(0.0, 0.3, c2)) * 0.08;
  float alb = mix(0.62, 0.33, mare) + rim - bowl + 0.06 * fbm3s(p * 30.0);
  float ndl = max(dot(normalize(vWN), normalize(uSun)), 0.0);
  vec3 col = vec3(alb) * vec3(1.0, 0.98, 0.95) * (0.02 + 1.2 * ndl);
  // 裂缝：离本块中心和最近的别块中心距离差小 → 在板缝上
  float d1 = 9.0, d2 = 9.0;
  for (int k = 0; k < 48; k++) { if (k >= uN) break; float d = distance(p, uCentres[k]); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
  float edge = d2 - d1;
  float w = uCrack * 0.05;
  float crack = 1.0 - smoothstep(w * 0.4, w, edge);
  float glowHalo = (1.0 - smoothstep(0.0, w * 3.0 + 0.001, edge)) * uCrack * 0.35;
  col = mix(col, uCrackCol * 3.0, crack * step(0.001, uCrack));
  col += uCrackCol * glowHalo;
  gl_FragColor = vec4(col, 1.0);
}`;
const CORE_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uCoreCol; uniform float uOn;
varying vec3 vObj; varying vec3 vWN; varying vec3 vN; varying vec3 vView; varying float vPlate;
${NOISE_GLSL}
void main() {
  vec3 p = normalize(vObj);
  float fres = pow(1.0 - max(dot(normalize(vN), normalize(vView)), 0.0), 2.0);
  float flow = fbm3s(p * 3.0 + vec3(0.0, uTime * 0.25, 0.0));
  float lines = smoothstep(0.92, 1.0, 1.0 - abs(snoise(p * 9.0 + flow * 2.0 + uTime * 0.3)));   // 流动的电路纹
  float beat = 0.75 + 0.25 * pow(0.5 + 0.5 * sin(uTime * 5.0), 6.0);                          // 心跳
  vec3 col = uCoreCol * (0.8 + 1.2 * flow + 2.5 * lines + 1.5 * fres) * beat;
  gl_FragColor = vec4(col * uOn * 1.4, 1.0);
}`;

export const MoonCoreAsset: React.FC<MoonCoreProps> = ({
  position = [0, 0, 0], radius = 2, plates = 22, crackAt = 0.6, openAt = 2.2, openSpeed = 0.22, coreColor = '#ffb347', crackColor = '#ffcf7a',
  sunDir = [-1, 0.2, 0.6], brightness = 1, seed = 'mooncore',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const S = String(seed);
  const res = useMemo(() => {
    const sv = new THREE.Vector3(random(`${S}sx`) * 30, random(`${S}sy`) * 30, random(`${S}sz`) * 30);
    const centres = Array.from({length: plates}, (_, i) => new THREE.Vector3(random(`${S}c${i}x`) - 0.5, random(`${S}c${i}y`) - 0.5, random(`${S}c${i}z`) - 0.5).normalize());
    const src = new THREE.IcosahedronGeometry(radius, 48); // 本来就是非索引几何
    const pos = src.attributes.position as THREE.BufferAttribute;
    const buckets: number[][] = Array.from({length: plates}, () => []);
    const v = new THREE.Vector3();
    for (let f = 0; f < pos.count; f += 3) {
      v.set(0, 0, 0);
      for (let k = 0; k < 3; k++) v.add(new THREE.Vector3().fromBufferAttribute(pos, f + k));
      v.normalize();
      let best = 0, bd = 9;
      centres.forEach((c, i) => { const d = c.distanceTo(v); if (d < bd) { bd = d; best = i; } });
      buckets[best].push(f);
    }
    const shellMatU = {
      uSun: {value: new THREE.Vector3(...sunDir).normalize()}, uSeed: {value: sv}, uCrack: {value: 0}, uCrackCol: {value: new THREE.Color(crackColor).multiplyScalar(brightness)},
      uCoreCol: {value: new THREE.Color(coreColor).multiplyScalar(brightness)}, uOpen: {value: 0}, uRad: {value: radius},
      uCentres: {value: [...centres, ...Array.from({length: 48 - plates}, () => new THREE.Vector3(9, 9, 9))]}, uN: {value: plates},
    };
    const shellMat = new THREE.ShaderMaterial({vertexShader: SHELL_VERT, fragmentShader: SHELL_FRAG, uniforms: shellMatU, side: THREE.DoubleSide});
    const pieces = buckets.map((faces, i) => {
      const arr = new Float32Array(faces.length * 9);
      faces.forEach((f, j) => { for (let k = 0; k < 9; k++) arr[j * 9 + k] = (pos.array as Float32Array)[f * 3 + k]; });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      g.setAttribute('aPlate', new THREE.BufferAttribute(new Float32Array(faces.length * 3).fill(i), 1));
      g.computeVertexNormals();
      const axis = new THREE.Vector3(random(`${S}r${i}x`) - 0.5, random(`${S}r${i}y`) - 0.5, random(`${S}r${i}z`) - 0.5).normalize();
      return {g, dir: centres[i], axis, speed: 0.75 + 0.5 * random(`${S}v${i}`), spin: (random(`${S}w${i}`) - 0.5) * 0.25};
    });
    const coreMat = new THREE.ShaderMaterial({vertexShader: SHELL_VERT, fragmentShader: CORE_FRAG, uniforms: {uTime: {value: 0}, uCoreCol: {value: new THREE.Color(coreColor).multiplyScalar(brightness)}, uOn: {value: 0}}, toneMapped: false});
    return {shellMat, pieces, coreMat};
  }, [radius, plates, coreColor, crackColor, sunDir, brightness, S]);
  const crack = Math.max(0, Math.min(1, (t - crackAt) / 1.2));
  const open = Math.max(0, t - openAt);
  res.shellMat.uniforms.uCrack.value = crack;
  res.shellMat.uniforms.uOpen.value = Math.min(1, open / 1.5);
  res.coreMat.uniforms.uTime.value = t;
  res.coreMat.uniforms.uOn.value = Math.max(crack * 0.4, Math.min(1, open / 1.0));
  const q = new THREE.Quaternion();
  return (
    <group position={position}>
      {res.pieces.map((p, i) => {
        const d = open * openSpeed * radius * p.speed * (1 + open * 0.3);
        q.setFromAxisAngle(p.axis, open * p.spin);
        return <mesh key={i} geometry={p.g} material={res.shellMat} position={p.dir.clone().multiplyScalar(d)} quaternion={q.clone()} />;
      })}
      <mesh material={res.coreMat}>
        <sphereGeometry args={[radius * 0.82, 96, 64]} />
      </mesh>
      <pointLight intensity={res.coreMat.uniforms.uOn.value * 40} distance={radius * 8} color={coreColor} />
    </group>
  );
};
