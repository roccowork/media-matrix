// 资产 cosmos.seedburst.v1：蒲公英光种（《一百年后》第 10 镜「它把自己，撒向群星」）。
// 中心是一颗被包裹、发着光的球（戴森球：Voronoi 壳板 + 金色接缝 + 边缘辉光 + 光晕），
// 球面上布满光种子；到了发射时刻，它们像被吹散的蒲公英一样一颗颗离开球面，向四面八方飞散，
// 一部分（cluster）集中朝一个方向飞（镜头跟着这一簇飞）。每颗种子 = 发光头 + 细长光尾，部分种子带一圈细丝「绒毛」（冠毛）。
// 种子位置全部在顶点着色器里按 uTime 解析计算（GPU 粒子，确定性）：
//   距离 r(dt) = R + v·(dt + burst·(1 − e^(−3dt))/3)（起飞快、随后匀速），叠加缓慢的侧向摆动；
//   光尾 = 同一条轨迹上 tail 秒之前的位置，画成屏幕空间里头粗尾细的四边形（InstancedBufferGeometry）。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Vec3} from '../../../engine/shot';

export type SeedBurstProps = {
  position?: Vec3; // 球心
  radius?: number; // 球半径
  count?: number; // 种子数量
  cluster?: number; // 朝 clusterDir 集中飞的比例（0–1）
  clusterDir?: Vec3; // 那一簇的方向（镜头跟着飞）
  clusterSpread?: number; // 那一簇的张角（度）
  speed?: number; // 飞散速度（单位 / 秒）
  speedJitter?: number; // 速度随机幅度（0–1）
  burst?: number; // 起飞爆发：初速度是巡航速度的 (1 + burst) 倍
  tail?: number; // 光尾长度（秒：尾巴 = 多少秒前的位置）
  size?: number; // 种子头大小（世界单位）
  fluff?: number; // 带绒毛的种子比例（0–1）
  fluffLength?: number; // 绒毛长度（世界单位）
  wobble?: number; // 侧向摆动幅度（世界单位）
  emitAt?: number; // 开始发射（秒）
  emitDuration?: number; // 全部发射完要多久（秒）
  color?: string; // 种子头颜色
  tailColor?: string; // 光尾 / 绒毛颜色
  coreColor?: string; // 球的颜色
  core?: number; // 球的亮度（0 = 不画球，只要种子）
  glow?: number; // 球外光晕大小（相对半径）
  brightness?: number;
  seed?: string | number;
};

// 共用：种子轨迹（GLSL）
const TRAJ = /* glsl */ `
uniform float uTime; uniform float uR; uniform float uSpeed; uniform float uBurst; uniform float uWobble;
uniform float uEmitAt; uniform float uEmitDur;
// iR: x 发射时刻(0–1), y 速度倍数, z 亮度随机, w 摆动相位
float emitTime(vec4 r) { return uEmitAt + r.x * uEmitDur; }
vec3 seedPos(float t, vec3 dir, vec4 r) {
  float dt = max(t - emitTime(r), 0.0);
  float v = uSpeed * r.y;
  float d = uR * 1.004 + v * (dt + uBurst * (1.0 - exp(-3.0 * dt)) / 3.0);
  vec3 ref = abs(dir.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 e1 = normalize(cross(ref, dir)); vec3 e2 = cross(dir, e1);
  float ph = r.w * 6.2831853;
  float k = min(dt, 1.5);
  vec3 off = (e1 * sin(dt * 1.3 + ph) + e2 * cos(dt * 0.9 + ph * 1.7)) * uWobble * k;
  return dir * d + off;
}`;

// 光尾 / 绒毛：屏幕空间四边形
const STREAK_VERT = /* glsl */ `
${TRAJ}
attribute vec2 aQ; // x: 0 = 头, 1 = 尾; y: -1..1 横向
attribute vec3 iDir; attribute vec4 iR; attribute vec4 iF; // iF: x 类型(0 光尾, 1 绒毛), y 绒毛方位角, z 绒毛张角随机, w 绒毛长度随机
uniform float uTail; uniform float uSize; uniform float uFluffLen; uniform float uViewH;
varying vec2 vQ; varying float vA; varying float vKind;
void main() {
  float te = emitTime(iR);
  float dt = uTime - te;
  vec3 head = seedPos(uTime, iDir, iR);
  vec3 tailP;
  float wH, wT, a;
  if (iF.x < 0.5) {
    tailP = seedPos(max(uTime - uTail, te), iDir, iR);
    wH = uSize * 0.55; wT = uSize * 0.05;
    a = (0.55 + 0.9 * iR.z) * smoothstep(0.0, 0.15, dt);
  } else {
    // 冠毛：围绕飞行方向向后张开的一圈细丝，起飞后 0.6 秒内撑开
    vec3 fwd = normalize(seedPos(uTime + 0.05, iDir, iR) - head);
    vec3 ref = abs(fwd.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 e1 = normalize(cross(ref, fwd)); vec3 e2 = cross(fwd, e1);
    float open = smoothstep(0.0, 0.6, dt);
    float cone = mix(0.12, 1.05 + 0.35 * iF.z, open);
    vec3 fd = -fwd * cos(cone) + (e1 * cos(iF.y) + e2 * sin(iF.y)) * sin(cone);
    tailP = head + fd * uFluffLen * (0.7 + 0.6 * iF.w);
    wH = uSize * 0.07; wT = uSize * 0.05;
    a = (0.35 + 0.4 * iR.z) * smoothstep(0.0, 0.3, dt);
  }
  vec4 mvH = modelViewMatrix * vec4(head, 1.0);
  vec4 mvT = modelViewMatrix * vec4(tailP, 1.0);
  float nearZ = -0.05;
  if (mvH.z > nearZ && mvT.z > nearZ) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vA = 0.0; return; }
  if (mvH.z > nearZ) mvH = mix(mvT, mvH, (mvT.z - nearZ) / (mvT.z - mvH.z));
  if (mvT.z > nearZ) mvT = mix(mvH, mvT, (mvH.z - nearZ) / (mvH.z - mvT.z));
  vec4 cH = projectionMatrix * mvH; vec4 cT = projectionMatrix * mvT;
  float aspect = projectionMatrix[1][1] / projectionMatrix[0][0];
  vec2 nH = cH.xy / cH.w, nT = cT.xy / cT.w;
  vec2 s = (nT - nH) * vec2(aspect, 1.0);
  float L = length(s);
  vec2 dirS = L > 1e-6 ? s / L : vec2(1.0, 0.0);
  vec2 perp = vec2(-dirS.y, dirS.x);
  // 半宽（NDC 的 y 单位）；太细就压到 0.7 像素并按比例降亮度，远处不闪
  float minW = 1.4 / uViewH;
  float hwH = wH * projectionMatrix[1][1] / cH.w, hwT = wT * projectionMatrix[1][1] / cT.w;
  float fade = clamp(max(hwH, hwT) / minW, 0.0, 1.0);
  hwH = clamp(hwH, minW, 7.0 / uViewH); hwT = clamp(hwT, minW * 0.5, 4.0 / uViewH);
  // 贴脸的种子淡出（不糊屏）；正对镜头、在屏幕上缩成一团的光尾按比例降亮度（不堆成白斑）
  float nearFade = smoothstep(0.4, 2.5, -mvH.z);
  float endOn = clamp(L * uViewH / 30.0, 0.25, 1.0);
  fade *= nearFade * (iF.x < 0.5 ? endOn : 1.0);
  vec4 c = mix(cH, cT, aQ.x);
  float hw = mix(hwH, hwT, aQ.x);
  c.xy += perp * aQ.y * hw / vec2(aspect, 1.0) * c.w;
  gl_Position = c;
  vQ = aQ; vKind = iF.x;
  vA = a * fade * (dt > 0.0 ? 1.0 : 0.0);
}`;
const STREAK_FRAG = /* glsl */ `
uniform vec3 uTailCol; uniform vec3 uHeadCol;
varying vec2 vQ; varying float vA; varying float vKind;
void main() {
  if (vA <= 0.001) discard;
  float across = exp(-vQ.y * vQ.y * 3.0);
  float along = vKind < 0.5 ? pow(1.0 - vQ.x, 1.6) : (0.55 + 0.9 * smoothstep(0.75, 1.0, vQ.x)) * (1.0 - 0.4 * vQ.x);
  vec3 col = mix(uHeadCol, uTailCol, vKind < 0.5 ? smoothstep(0.0, 0.5, vQ.x) : 1.0);
  gl_FragColor = vec4(col * across * along * vA, 1.0);
}`;

// 种子头：发光点
const HEAD_VERT = /* glsl */ `
${TRAJ}
attribute vec3 iDir; attribute vec4 iR;
uniform float uSize; uniform float uViewH;
varying float vA;
void main() {
  float dt = uTime - emitTime(iR);
  vec3 p = seedPos(uTime, iDir, iR);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  if (mv.z > -0.05) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return; }
  float px = uSize * 3.0 * projectionMatrix[1][1] / -mv.z * uViewH * 0.5;
  float fade = clamp(px / 2.5, 0.0, 1.0) * smoothstep(0.4, 2.5, -mv.z);
  gl_PointSize = clamp(px, 2.5, 36.0);
  // 还在球面上的种子暗一些（蒲公英的绒球），起飞时一闪
  float flash = dt > 0.0 ? 1.0 + 1.5 * exp(-dt * 4.0) : 0.35;
  vA = (0.6 + 0.8 * iR.z) * flash * fade;
  gl_Position = projectionMatrix * mv;
}`;
const HEAD_FRAG = /* glsl */ `
uniform vec3 uHeadCol;
varying float vA;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float core = exp(-r * r * 40.0);
  float halo = exp(-r * r * 6.0) * 0.35;
  float v = (core * 1.6 + halo) * smoothstep(1.0, 0.8, r);
  gl_FragColor = vec4(mix(uHeadCol, vec3(1.0), core * 0.5) * v * vA, 1.0);
}`;

// 被包裹的球：Voronoi 壳板 + 发光接缝 + 边缘辉光
const CORE_VERT = /* glsl */ `
varying vec3 vP; varying vec3 vN; varying vec3 vV;
void main() {
  vP = normalize(position);
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const CORE_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uOn; uniform float uTime; uniform vec3 uSeedOff;
varying vec3 vP; varying vec3 vN; varying vec3 vV;
vec3 hash3(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
void main() {
  vec3 q = vP * 9.0 + uSeedOff;
  vec3 b = floor(q); vec3 f = fract(q);
  float d1 = 9.0, d2 = 9.0; vec3 id = vec3(0.0);
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 h = hash3(b + g);
    float d = length(g + h - f);
    if (d < d1) { d2 = d1; d1 = d; id = h; } else if (d < d2) d2 = d;
  }
  float seam = smoothstep(0.09, 0.0, d2 - d1);
  float flick = 0.55 + 0.45 * sin(uTime * (1.0 + id.x * 2.0) + id.y * 6.2831853);
  float fres = pow(1.0 - max(dot(normalize(vN), vV), 0.0), 2.2);
  vec3 panel = uCol * (0.06 + 0.16 * id.z * flick);
  vec3 c = panel + uCol * seam * 0.9 + mix(uCol, vec3(1.0, 0.95, 0.85), 0.4) * fres * 1.1;
  gl_FragColor = vec4(c * uOn, 1.0);
}`;
// 光晕：朝向镜头的平面
const HALO_VERT = /* glsl */ `
uniform float uSizeH;
varying vec2 vUv2;
void main() {
  vUv2 = position.xy;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uSizeH;
  gl_Position = projectionMatrix * mv;
}`;
const HALO_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uOn; uniform float uInner;
varying vec2 vUv2;
void main() {
  float r = length(vUv2);
  if (r > 1.0) discard;
  float x = max(r - uInner, 0.0) / (1.0 - uInner);
  float g = (exp(-x * 5.0) * 0.55 + exp(-x * 18.0) * 0.6) * smoothstep(1.0, 0.6, r);
  gl_FragColor = vec4(uCol * g * uOn, 1.0);
}`;

const FILAMENTS = 10;

export const SeedBurstAsset: React.FC<SeedBurstProps> = ({
  position = [0, 0, 0], radius = 3, count = 24000, cluster = 0.35, clusterDir = [0, 0, -1], clusterSpread = 14,
  speed = 9, speedJitter = 0.45, burst = 1.2, tail = 0.35, size = 0.05, fluff = 0.18, fluffLength = 0.35, wobble = 0.3,
  emitAt = 0.2, emitDuration = 2.8, color = '#fff1c9', tailColor = '#ffb04d', coreColor = '#ffb347', core = 1, glow = 2.2,
  brightness = 1, seed = 'seedburst',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {size: vsize, gl} = useThree();
  const t = frame / fps;
  const S = String(seed);
  const res = useMemo(() => {
    const cd = new THREE.Vector3(...clusterDir).normalize();
    const ref = Math.abs(cd.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const cu = new THREE.Vector3().crossVectors(ref, cd).normalize();
    const cv = new THREE.Vector3().crossVectors(cd, cu);
    const spreadR = (clusterSpread * Math.PI) / 180;
    const dirs = new Float32Array(count * 3);
    const rs = new Float32Array(count * 4);
    const fluffy: number[] = [];
    for (let i = 0; i < count; i++) {
      let d: THREE.Vector3;
      const inCluster = random(`${S}c${i}`) < cluster;
      if (inCluster) {
        // 锥内均匀
        const cosA = 1 - random(`${S}ka${i}`) * (1 - Math.cos(spreadR));
        const sinA = Math.sqrt(1 - cosA * cosA);
        const ph = random(`${S}kp${i}`) * Math.PI * 2;
        d = cd.clone().multiplyScalar(cosA).add(cu.clone().multiplyScalar(Math.cos(ph) * sinA)).add(cv.clone().multiplyScalar(Math.sin(ph) * sinA));
      } else {
        const z = random(`${S}z${i}`) * 2 - 1;
        const ph = random(`${S}p${i}`) * Math.PI * 2;
        const s = Math.sqrt(1 - z * z);
        d = new THREE.Vector3(Math.cos(ph) * s, z, Math.sin(ph) * s);
      }
      dirs.set([d.x, d.y, d.z], i * 3);
      // 发射顺序：先少后多再少（像一口气吹过去）；那一簇稍早出发
      const e = Math.pow(random(`${S}e${i}`), inCluster ? 0.9 : 0.75);
      const sp = 1 + (random(`${S}v${i}`) * 2 - 1) * speedJitter;
      rs.set([inCluster ? e * 0.8 : e, sp, random(`${S}b${i}`), random(`${S}w${i}`)], i * 4);
      if (random(`${S}f${i}`) < fluff) fluffy.push(i);
    }
    // 光尾 + 绒毛：一个 InstancedBufferGeometry
    const nInst = count + fluffy.length * FILAMENTS;
    const iDir = new Float32Array(nInst * 3);
    const iR = new Float32Array(nInst * 4);
    const iF = new Float32Array(nInst * 4);
    iDir.set(dirs, 0);
    iR.set(rs, 0);
    let k = count;
    for (const i of fluffy) {
      const ph0 = random(`${S}fp${i}`) * Math.PI * 2;
      for (let j = 0; j < FILAMENTS; j++, k++) {
        iDir.set(dirs.subarray(i * 3, i * 3 + 3), k * 3);
        iR.set(rs.subarray(i * 4, i * 4 + 4), k * 4);
        iF.set([1, ph0 + (j / FILAMENTS) * Math.PI * 2 + (random(`${S}fj${i}_${j}`) - 0.5) * 0.4, random(`${S}fc${i}_${j}`), random(`${S}fl${i}_${j}`)], k * 4);
      }
    }
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    g.setAttribute('aQ', new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]), 2));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    g.setAttribute('iDir', new THREE.InstancedBufferAttribute(iDir, 3));
    g.setAttribute('iR', new THREE.InstancedBufferAttribute(iR, 4));
    g.setAttribute('iF', new THREE.InstancedBufferAttribute(iF, 4));
    g.instanceCount = nInst;
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    hg.setAttribute('iDir', new THREE.BufferAttribute(dirs, 3));
    hg.setAttribute('iR', new THREE.BufferAttribute(rs, 4));
    const head = new THREE.Color(color).multiplyScalar(brightness);
    const tailC = new THREE.Color(tailColor).multiplyScalar(brightness);
    const traj = {uTime: {value: 0}, uR: {value: radius}, uSpeed: {value: speed}, uBurst: {value: burst}, uWobble: {value: wobble}, uEmitAt: {value: emitAt}, uEmitDur: {value: emitDuration}, uViewH: {value: 1080}, uSize: {value: size}};
    const streak = new THREE.ShaderMaterial({vertexShader: STREAK_VERT, fragmentShader: STREAK_FRAG, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: {...traj, uTail: {value: tail}, uFluffLen: {value: fluffLength}, uTailCol: {value: tailC}, uHeadCol: {value: head}}});
    const heads = new THREE.ShaderMaterial({vertexShader: HEAD_VERT, fragmentShader: HEAD_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {...traj, uHeadCol: {value: head}}});
    const coreCol = new THREE.Color(coreColor).multiplyScalar(brightness);
    const coreMat = new THREE.ShaderMaterial({vertexShader: CORE_VERT, fragmentShader: CORE_FRAG,
      uniforms: {uCol: {value: coreCol}, uOn: {value: core}, uTime: {value: 0}, uSeedOff: {value: new THREE.Vector3(random(`${S}ox`) * 50, random(`${S}oy`) * 50, random(`${S}oz`) * 50)}}});
    const haloMat = new THREE.ShaderMaterial({vertexShader: HALO_VERT, fragmentShader: HALO_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {uCol: {value: coreCol}, uOn: {value: core}, uSizeH: {value: radius * glow}, uInner: {value: 1 / glow}}});
    return {g, hg, streak, heads, coreMat, haloMat};
  }, [radius, count, cluster, clusterDir, clusterSpread, speed, speedJitter, burst, tail, size, fluff, fluffLength, wobble, emitAt, emitDuration, color, tailColor, coreColor, core, glow, brightness, S]);
  const vh = vsize.height * gl.getPixelRatio();
  for (const m of [res.streak, res.heads]) {
    m.uniforms.uTime.value = t;
    m.uniforms.uViewH.value = vh;
  }
  res.coreMat.uniforms.uTime.value = t;
  return (
    <group position={position}>
      {core > 0 && (
        <>
          <mesh material={res.coreMat} renderOrder={5}>
            <sphereGeometry args={[radius, 128, 96]} />
          </mesh>
          <mesh material={res.haloMat} renderOrder={6} frustumCulled={false}>
            <planeGeometry args={[2, 2]} />
          </mesh>
        </>
      )}
      <mesh geometry={res.g} material={res.streak} frustumCulled={false} renderOrder={9} />
      <points geometry={res.hg} material={res.heads} frustumCulled={false} renderOrder={10} />
    </group>
  );
};
