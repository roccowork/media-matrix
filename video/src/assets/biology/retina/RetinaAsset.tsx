// 资产 biology.retina.v1：视网膜微观剖面（脊椎动物「装反」的视网膜 ↔ 章鱼「正装」的视网膜，可渐变切换）。参数见 registry.ts。
// 按真实比例（《方案补充》#12），单位：微米（1 单位 = 1 µm）。截一条 800 µm 宽、约 100 µm 厚的切片，光从上方（玻璃体一侧，+y）射入。
// 脊椎动物（人）由上到下：神经纤维层 0–20 → 神经节细胞（胞体 12–18 µm）≈ 32 → 内丛状层 → 内核层（双极细胞）80–110
//   → 外丛状层 → 外核层（感光细胞核）128–170 → 内节 / 外节（视杆直径约 2 µm、外节长约 25–35 µm；视锥更粗、外节尖）→ 色素上皮 → 脉络膜毛细血管
//   ——光要先穿过所有神经层才到感光细胞，外节朝向背光的一侧。
// 视盘（盲点）：画面右侧 discX 以右是视盘边缘，那里没有感光细胞，神经纤维全部从这里向下穿出眼球。
// 章鱼（头足类）：感光细胞外节朝向光、在最上面，神经在后面，纤维从背面离开——没有盲点。
//   （章鱼的双极 / 神经节细胞其实在视叶里，这里把神经层整体挪到后面作示意，注明「示意」。）
// 切换（layout 0 → 1）：感光层（外节、内节、细胞核、色素）和神经层各自整体移动、在纵深上错开互相穿过，感光细胞随之翻转 180°；
//   视盘缺口里的细胞随切换长出来。所有元素都是 GPU 实例，顶点着色器按 uM（切换进度）插值，确定性。
// 光点：从上方射入，在外节被吸收（闪一下），信号沿反方向传回神经纤维层、流向视盘；落在盲点里的光点直接穿过、什么也没碰到。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Vec3} from '../../../engine/shot';

export type RetinaProps = {
  position?: Vec3;
  scale?: number; // 1 = 真实尺寸（µm）
  layout?: number; // 0 = 脊椎动物，1 = 章鱼（flipAt < 0 时直接用这个值）
  flipAt?: number; // 秒：开始从 layout 切到 1 - layout；-1 = 不切
  flipDuration?: number;
  discX?: number; // 视盘边缘位置（µm），> 400 = 画面里没有视盘
  photons?: number; // 每秒射入的光点数，0 = 关
  photonsAt?: number;
  signals?: boolean; // 显示感光后传回的神经信号
  lightColor?: string;
  signalColor?: string;
  seed?: string | number;
};

const HALF_W = 400, Z0 = -90, Z1 = 10;
// 感光层：u = 从外节尖端往细胞核方向的距离
const TIP_V = -230; // 脊椎动物：外节尖端 y（朝下）
const TIP_O = 0; // 章鱼：外节尖端 y（朝上）
const NEURAL_BOTTOM = -250; // 章鱼：神经层整体镜像到这里（y_o = -250 + v）
const RPE_V = -238, RPE_O = -110;

const VERT = /* glsl */ `
attribute vec3 aV; attribute vec3 aO; attribute vec3 aS; attribute vec3 aCol; attribute vec3 aMisc;
attribute vec3 color;
uniform float uM; uniform float uLift;
varying vec3 vN; varying vec3 vW; varying vec3 vC;
void main() {
  float m = uM;
  // aMisc.x = 1：随切换翻转；aMisc.y = 1：只在章鱼里有（视盘缺口），随切换长出；aMisc.z = ±1：切换时往前 / 往后错开
  float g = aMisc.y > 0.5 ? smoothstep(0.4, 1.0, m) : 1.0;
  vec3 p = position * aS * g;
  vec3 n = normal / aS;
  float a = aMisc.x * m * 3.14159265;
  mat2 R = mat2(cos(a), sin(a), -sin(a), cos(a));
  p.xy = R * p.xy; n.xy = R * n.xy;
  vec3 c = mix(aV, aO, m);
  c.z += aMisc.z * sin(3.14159265 * m) * uLift;
  vec4 w = modelMatrix * vec4(c + p, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * n); vC = color * aCol;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const AXON_VERT = /* glsl */ `
attribute vec3 posO;
uniform float uM; uniform float uLift;
varying vec3 vN; varying vec3 vW; varying vec3 vC;
void main() {
  vec3 p = mix(position, posO, uM);
  p.z -= sin(3.14159265 * uM) * uLift;
  vec4 w = modelMatrix * vec4(p, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vC = vec3(0.78, 0.66, 0.45);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
varying vec3 vN; varying vec3 vW; varying vec3 vC;
uniform float uGlow;
void main() {
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(cameraPosition - vW);
  vec3 L1 = normalize(vec3(-0.3, 0.9, 0.45)), L2 = normalize(vec3(0.6, -0.4, 0.3));
  float d1 = clamp((dot(n, L1) + 0.3) / 1.3, 0.0, 1.0), d2 = max(dot(n, L2), 0.0);
  float s = pow(max(dot(n, normalize(L1 + v)), 0.0), 40.0);
  float fr = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.5);
  vec3 col = vC * (0.12 + 0.9 * d1 + 0.25 * d2) + 0.25 * s + vC * fr * 0.5 + vC * uGlow;
  gl_FragColor = vec4(col, 1.0);
}`;

const GLOW_VERT = /* glsl */ `
attribute vec3 aP; attribute float aB; attribute float aR;
varying float vB; varying vec2 vUv;
void main() {
  vB = aB; vUv = uv;
  vec4 mv = viewMatrix * modelMatrix * vec4(aP, 1.0);
  mv.xy += position.xy * aR;                       // 面向镜头的方片
  gl_Position = projectionMatrix * mv;
}`;
const GLOW_FRAG = /* glsl */ `
uniform vec3 uCol;
varying float vB; varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = exp(-d * d * 5.0) + 0.6 * exp(-d * d * 40.0);
  if (vB <= 0.001 || a < 0.01) discard;
  gl_FragColor = vec4(uCol * a * vB, 1.0);
}`;

// ---------- 基础几何（带顶点颜色） ----------
const colored = (g: THREE.BufferGeometry, hex: string) => {
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (g.index) g = g.toNonIndexed();
  return g;
};
// 视杆：尖端在 y = 0，向 +y 依次是外节（长 32、直径 2）、内节（长 25、直径 2.4）、细纤维（到细胞核）
const rodGeo = () => mergeGeometries([
  colored(new THREE.CylinderGeometry(1.0, 1.0, 32, 8).translate(0, 16, 0), '#d8508e'),
  colored(new THREE.CylinderGeometry(1.2, 1.05, 25, 8).translate(0, 32 + 12.5, 0), '#f0a6ae'),
  colored(new THREE.CylinderGeometry(0.35, 0.35, 20, 5).translate(0, 57 + 10, 0), '#c98fb0'),
])!;
// 视锥：外节是尖锥（尖端朝下，离色素上皮远一点），内节粗
const coneGeo = () => mergeGeometries([
  colored(new THREE.CylinderGeometry(2.0, 0.6, 14, 10).translate(0, 15 + 7, 0), '#ffb347'),
  colored(new THREE.SphereGeometry(3.0, 12, 10).scale(1, 2.6, 1).translate(0, 29 + 9, 0), '#ffd58f'),
  colored(new THREE.CylinderGeometry(0.5, 0.5, 16, 5).translate(0, 47 + 8, 0), '#e7b878'),
])!;
const sphereGeo = (hex: string, seg = 10) => colored(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75)), hex);
const boxGeo = (hex: string) => colored(new THREE.BoxGeometry(1, 1, 1), hex);

type Inst = {v: Vec3; o: Vec3; s: Vec3; col: string | THREE.Color; flip?: number; gap?: number; side?: number};
const instGeo = (base: THREE.BufferGeometry, list: Inst[]) => {
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  for (const k of Object.keys(base.attributes)) g.setAttribute(k, base.attributes[k]);
  const n = list.length;
  const A = (k: number) => new Float32Array(n * k);
  const aV = A(3), aO = A(3), aS = A(3), aC = A(3), aM = A(3);
  const c = new THREE.Color();
  list.forEach((it, i) => {
    aV.set(it.v, i * 3); aO.set(it.o, i * 3); aS.set(it.s, i * 3);
    c.set(it.col as THREE.ColorRepresentation); aC.set([c.r, c.g, c.b], i * 3);
    aM.set([it.flip ?? 0, it.gap ?? 0, it.side ?? 0], i * 3);
  });
  g.setAttribute('aV', new THREE.InstancedBufferAttribute(aV, 3));
  g.setAttribute('aO', new THREE.InstancedBufferAttribute(aO, 3));
  g.setAttribute('aS', new THREE.InstancedBufferAttribute(aS, 3));
  g.setAttribute('aCol', new THREE.InstancedBufferAttribute(aC, 3));
  g.setAttribute('aMisc', new THREE.InstancedBufferAttribute(aM, 3));
  g.instanceCount = n;
  return g;
};

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// 一个光点 / 信号的整条路径（随 m 插值）：返回 [点列]，按弧长匀速走
const polyAt = (pts: THREE.Vector3[], d: number) => {
  for (let i = 1; i < pts.length; i++) {
    const L = pts[i].distanceTo(pts[i - 1]);
    if (d <= L) return pts[i - 1].clone().lerp(pts[i], d / Math.max(L, 1e-6));
    d -= L;
  }
  return null;
};
const polyLen = (pts: THREE.Vector3[]) => pts.slice(1).reduce((a, p, i) => a + p.distanceTo(pts[i]), 0);

const MAXG = 400;

export const RetinaAsset: React.FC<RetinaProps> = ({
  position = [0, 0, 0],
  scale = 1,
  layout = 0,
  flipAt = -1,
  flipDuration = 3,
  discX = 220,
  photons = 0,
  photonsAt = 0,
  signals = true,
  lightColor = '#fff3c4',
  signalColor = '#6fd8ff',
  seed = 'retina',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const S = String(seed);

  const res = useMemo(() => {
    let k = 0;
    const r = () => random(`${S}-r-${k++}`);
    const inGap = (x: number) => x > discX;
    const mat = (glow = 0) => new THREE.ShaderMaterial({vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide,
      uniforms: {uM: {value: 0}, uLift: {value: 45}, uGlow: {value: glow}}});
    const lists: Record<string, Inst[]> = {rod: [], cone: [], nuc: [], rpe: [], bip: [], gang: [], proc: []};
    const tint = (a: number) => new THREE.Color(1, 1, 1).multiplyScalar(1 - a / 2 + r() * a);
    // 感光细胞：视杆每 ~2.6 µm 一根，视锥每 ~9 µm 一根（周边视网膜比例）
    for (let x = -HALF_W; x < HALF_W; x += 2.6) {
      for (let z = Z0; z < Z1; z += 2.8) {
        const xx = x + (r() - 0.5) * 1.2, zz = z + (r() - 0.5) * 1.2;
        const gap = inGap(xx) ? 1 : 0;
        const isCone = r() < 0.07;
        const s = 0.9 + r() * 0.2;
        const lift = isCone ? 0 : (r() - 0.5) * 3;
        if (isCone) lists.cone.push({v: [xx, TIP_V + lift, zz], o: [xx, TIP_O - lift, zz], s: [s, 1, s], col: tint(0.25), flip: 1, gap, side: 1});
        else lists.rod.push({v: [xx, TIP_V + lift, zz], o: [xx, TIP_O - lift, zz], s: [s, 1, s], col: tint(0.3), flip: 1, gap, side: 1});
        // 细胞核（外核层，u ≈ 62–100）
        const u = 64 + r() * 36;
        const nr = 2.3 + r() * 0.6;
        lists.nuc.push({v: [xx + (r() - 0.5) * 1.5, TIP_V + u, zz], o: [xx + (r() - 0.5) * 1.5, TIP_O - u, zz], s: [nr, nr * 1.15, nr], col: tint(0.35), gap, side: 1});
        // 感光细胞的突触末梢：从细胞核伸到外丛状层（u 100 → 112）
        if (r() < 0.25) lists.proc.push({v: [xx, TIP_V + 106, zz], o: [xx, TIP_O - 106, zz], s: [0.35, 12, 0.35], col: new THREE.Color('#9e8fd8'), gap, side: 1});
      }
    }
    // 色素上皮：一排约 14 µm 的六角形细胞（这里用扁盒子）
    for (let x = -HALF_W; x < HALF_W; x += 14) {
      for (let z = Z0; z < Z1; z += 14) {
        const gap = inGap(x) ? 1 : 0;
        const h = 9 + r() * 3;
        lists.rpe.push({v: [x + 7, RPE_V, z + 7], o: [x + 7, RPE_O, z + 7], s: [13.2, h, 13.2], col: new THREE.Color('#ffffff').multiplyScalar(0.8 + r() * 0.3), gap, side: 1});
      }
    }
    // 双极细胞（内核层 80–110）：胞体约 8 µm
    for (let x = -HALF_W; x < HALF_W; x += 5) {
      for (let z = Z0; z < Z1; z += 6) {
        const xx = x + (r() - 0.5) * 3, zz = z + (r() - 0.5) * 3, v = 82 + r() * 26;
        const gap = inGap(xx) ? 1 : 0;
        const s = 3 + r() * 1.2;
        lists.bip.push({v: [xx, -v, zz], o: [xx, NEURAL_BOTTOM + v, zz], s: [s, s * 1.5, s], col: tint(0.35), gap, side: -1});
        // 双极细胞的突起：树突向下到外丛状层（≈ 122），轴突向上到内丛状层（≈ 55）
        if (r() < 0.5) lists.proc.push({v: [xx, -88.5, zz], o: [xx, NEURAL_BOTTOM + 88.5, zz], s: [0.4, 67, 0.4], col: new THREE.Color('#b9a8ff'), gap, side: -1});
      }
    }
    // 神经节细胞（约 32）：胞体 12–18 µm，周边一层稀疏
    for (let x = -HALF_W; x < HALF_W; x += 13) {
      for (let z = Z0 + 5; z < Z1; z += 15) {
        const xx = x + (r() - 0.5) * 6, zz = z + (r() - 0.5) * 5, v = 30 + r() * 6;
        const gap = inGap(xx) ? 1 : 0;
        const s = 6 + r() * 3;
        lists.gang.push({v: [xx, -v, zz], o: [xx, NEURAL_BOTTOM + v, zz], s: [s, s * 0.9, s], col: tint(0.3), gap, side: -1});
        // 神经节细胞的树突：伸进内丛状层（32 → 70），分两三支
        for (let b = 0; b < 3; b++) { const ox = (r() - 0.5) * 14, oz = (r() - 0.5) * 10; lists.proc.push({v: [xx + ox / 2, -51, zz + oz / 2], o: [xx + ox / 2, NEURAL_BOTTOM + 51, zz + oz / 2], s: [0.6, 38, 0.6], col: new THREE.Color('#ffdf9a'), gap, side: -1}); }
      }
    }
    // 脉络膜毛细血管（色素上皮下面，脊椎动物才有；章鱼时淡出成同样位置，作示意不动）
    const capT: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
      const y = -250 - r() * 22, z = Z0 + r() * (Z1 - Z0);
      const pts = [];
      for (let x = -HALF_W; x <= HALF_W; x += 40) pts.push(new THREE.Vector3(x, y + (r() - 0.5) * 8, z + (r() - 0.5) * 8));
      capT.push(colored(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 3.5 + r() * 2, 8, false), '#7e1a20'));
    }
    // 神经纤维（轴突）：在纤维层里流向视盘，再在视盘处向下穿出；章鱼时整条路径挪到背面
    const axV: THREE.BufferGeometry[] = [];
    const nAx = 110;
    for (let i = 0; i < nAx; i++) {
      const x0 = -HALF_W - 20 + r() * (Math.min(discX, HALF_W) + HALF_W);
      const v0 = 3 + r() * 16, z0 = Z0 + r() * (Z1 - Z0);
      const dx = 12 + r() * Math.max(20, HALF_W + 20 - discX - 12);   // 在视盘里向下穿出的位置
      const mk = (yTop: number, dir: number) => {
        const pts: THREE.Vector3[] = [];
        const xe = Math.min(discX, HALF_W + 40) + dx;
        const N = 24;
        for (let j = 0; j <= N; j++) {
          const u = j / N;
          if (u < 0.6) {
            const x = x0 + (xe - 18 - x0) * (u / 0.6);
            pts.push(new THREE.Vector3(x, yTop + Math.sin(x * 0.03 + i) * 1.2, z0));
          } else {
            const a = (u - 0.6) / 0.4;   // 拐弯向下
            const ang = a * Math.PI / 2;
            const R = 18;
            const x = xe - 18 + Math.sin(ang) * R;
            const yb = yTop + dir * (1 - Math.cos(ang)) * R;
            pts.push(new THREE.Vector3(x, yb, z0));
          }
        }
        pts.push(new THREE.Vector3(xe, -340, z0));
        return pts;
      };
      const pv = mk(-v0, -1), po = mk(NEURAL_BOTTOM + v0, -1);
      const rad = 0.45 + r() * 0.5;
      const gv = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pv), 90, rad, 5, false);
      const go = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(po), 90, rad, 5, false);
      gv.setAttribute('posO', go.attributes.position.clone());
      axV.push(gv.toNonIndexed());
      go.dispose();
    }
    const axGeo = mergeGeometries(axV.map((g) => { g.deleteAttribute('uv'); return g; }))!;
    const axMat = new THREE.ShaderMaterial({vertexShader: AXON_VERT, fragmentShader: FRAG, side: THREE.DoubleSide, uniforms: {uM: {value: 0}, uLift: {value: 45}, uGlow: {value: 0.0}}});

    const geos = {
      rod: instGeo(rodGeo(), lists.rod),
      cone: instGeo(coneGeo(), lists.cone),
      nuc: instGeo(sphereGeo('#4b5fd6'), lists.nuc),
      rpe: instGeo(boxGeo('#4a2412'), lists.rpe),
      bip: instGeo(sphereGeo('#a07cf0'), lists.bip),
      proc: instGeo(colored(new THREE.CylinderGeometry(1, 1, 1, 5), '#ffffff'), lists.proc),
      gang: instGeo(sphereGeo('#ffcf70', 16), lists.gang),
    };
    const mats = {rod: mat(), cone: mat(0.05), nuc: mat(), rpe: mat(), bip: mat(), gang: mat(0.08), proc: mat()};
    const capGeo = mergeGeometries(capT.map((g) => { g.deleteAttribute('uv'); return g; }))!;
    const capMat = new THREE.ShaderMaterial({vertexShader: AXON_VERT.replace('vC = vec3(0.78, 0.66, 0.45);', 'vC = color;').replace('attribute vec3 posO;', 'attribute vec3 posO; attribute vec3 color;').replace('mix(position, posO, uM)', 'position').replace('p.z -= sin(3.14159265 * uM) * uLift;', ''), fragmentShader: FRAG, uniforms: {uM: {value: 0}, uLift: {value: 0}, uGlow: {value: 0}}});
    // 光点 / 信号：面向镜头的发光方片
    const glow = (hex: string) => {
      const g = new THREE.InstancedBufferGeometry();
      const q = new THREE.PlaneGeometry(1, 1);
      g.index = q.index; g.setAttribute('position', q.attributes.position); g.setAttribute('uv', q.attributes.uv);
      g.setAttribute('aP', new THREE.InstancedBufferAttribute(new Float32Array(MAXG * 3), 3));
      g.setAttribute('aB', new THREE.InstancedBufferAttribute(new Float32Array(MAXG), 1));
      g.setAttribute('aR', new THREE.InstancedBufferAttribute(new Float32Array(MAXG), 1));
      g.instanceCount = MAXG;
      const m = new THREE.ShaderMaterial({vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, uniforms: {uCol: {value: new THREE.Color(hex)}},
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false});
      return {g, m};
    };
    return {geos, mats, axGeo, axMat, capGeo, capMat, light: glow(lightColor), sig: glow(signalColor)};
  }, [S, discX, lightColor, signalColor]);

  // 切换进度
  const m = flipAt < 0 ? layout : (() => {
    const e = ease((t - flipAt) / Math.max(flipDuration, 0.01));
    return layout + (1 - 2 * layout) * e;
  })();
  for (const mt of Object.values(res.mats)) mt.uniforms.uM.value = m;
  res.axMat.uniforms.uM.value = m;

  // 光点与信号（每帧按时间算出位置，确定性）
  {
    const L = res.light.g, G = res.sig.g;
    const lp = L.attributes.aP.array as Float32Array, lb = L.attributes.aB.array as Float32Array, lr = L.attributes.aR.array as Float32Array;
    const gp = G.attributes.aP.array as Float32Array, gb = G.attributes.aB.array as Float32Array, gr = G.attributes.aR.array as Float32Array;
    lb.fill(0); gb.fill(0);
    let nl = 0, ng = 0;
    const flipping = flipAt >= 0 && t > flipAt - 2.6 && t < flipAt + flipDuration;
    const settled = m < 0.02 || m > 0.98;            // 切换过程中不发光点
    if (photons > 0 && t >= photonsAt && !flipping && settled) {
      const oct = m > 0.5;
      const life = 3.4;
      const i0 = Math.max(0, Math.floor((t - photonsAt - life) * photons)), i1 = Math.floor((t - photonsAt) * photons);
      for (let i = i0; i <= i1 && nl < MAXG && ng < MAXG; i++) {
        const t0 = photonsAt + (i + random(`${S}-pt-${i}`) * 0.8) / photons;
        if (flipAt >= 0 && t0 > flipAt - 2.6 && t0 < flipAt + flipDuration) continue;
        const age = t - t0;
        if (age < 0 || age > life) continue;
        const x = -HALF_W + 10 + random(`${S}-px-${i}`) * (2 * HALF_W - 20);
        const z = Z1 + 3;
        const blind = !oct && x > discX;
        const yHit = oct ? TIP_O - 12 : TIP_V + 18;          // 外节中部
        const v = 320;                                        // 画面里的光速（µm / 秒，示意）
        const y = 60 - v * age;
        if (blind || y > yHit) {
          if (y < -360) continue;
          lp.set([x, y, z], nl * 3); lb[nl] = (blind ? Math.min(1, (y + 360) / 120) : 1) * 1.4; lr[nl] = 16; nl++;
          continue;
        }
        const tHit = (60 - yHit) / v, since = age - tHit;
        if (since < 0.35) { lp.set([x, yHit, z], nl * 3); lb[nl] = 2.2 * (1 - since / 0.35); lr[nl] = 9 + 30 * since; nl++; }
        if (!signals) continue;
        // 信号：感光细胞 → 神经节层 → 纤维层流向视盘 → 向下穿出
        const yG = oct ? NEURAL_BOTTOM + 32 : -32, yF = oct ? NEURAL_BOTTOM + 10 : -10;
        const xd = Math.min(discX, HALF_W) + 30;
        const path = [new THREE.Vector3(x, yHit, z), new THREE.Vector3(x, yG, z), new THREE.Vector3(x + 8, yF, z), new THREE.Vector3(xd, yF, z), new THREE.Vector3(xd + 15, -360, z)];
        const d = (since - 0.1) * 520;
        if (d < 0) continue;
        const pnt = polyAt(path, d);
        if (!pnt) continue;
        const fade = Math.min(1, (polyLen(path) - d) / 80);
        gp.set([pnt.x, pnt.y, pnt.z], ng * 3); gb[ng] = 1.4 * fade; gr[ng] = 7; ng++;
      }
    }
    for (const g of [L, G]) { g.attributes.aP.needsUpdate = true; g.attributes.aB.needsUpdate = true; g.attributes.aR.needsUpdate = true; }
  }

  const {geos, mats} = res;
  return (
    <group position={position} scale={scale}>
      <mesh geometry={res.capGeo} material={res.capMat} />
      <mesh geometry={geos.rpe} material={mats.rpe} frustumCulled={false} />
      <mesh geometry={geos.rod} material={mats.rod} frustumCulled={false} />
      <mesh geometry={geos.cone} material={mats.cone} frustumCulled={false} />
      <mesh geometry={geos.nuc} material={mats.nuc} frustumCulled={false} />
      <mesh geometry={geos.bip} material={mats.bip} frustumCulled={false} />
      <mesh geometry={geos.gang} material={mats.gang} frustumCulled={false} />
      <mesh geometry={geos.proc} material={mats.proc} frustumCulled={false} />
      <mesh geometry={res.axGeo} material={res.axMat} frustumCulled={false} />
      <mesh geometry={res.light.g} material={res.light.m} frustumCulled={false} renderOrder={10} />
      <mesh geometry={res.sig.g} material={res.sig.m} frustumCulled={false} renderOrder={11} />
    </group>
  );
};
