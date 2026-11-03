// 资产 biology.nervedetour.v1：喉返神经「绕远路」示意动画（侧面线稿，第 10–11 镜）。参数见 registry.ts。
// 画面：发光线条画的脊椎动物侧面轮廓（身体、脖子、头；鱼形态有鳃裂、鳍和尾鳍，陆生形态有四条腿），里面是
//   脑（头里）→ 喉（喉咙，紧挨着头）→ 心脏和主动脉弓（胸腔里）；
//   喉返神经：从脑出发沿脖子后侧一路往下，到胸腔里钩过主动脉弓，再沿脖子前侧折回往上，到喉——
//   脖子越长，弯路越长；虚线是「直走」的距离（脑 → 喉）作对比。
// 动画：脖子长度从 startNeck 长到 endNeck（growAt 起 growDuration 秒）；fishStart = true 时从鱼开始，鱼的特征随生长淡出、腿淡入；
//   光脉冲沿神经从脑走到喉（pulseAt 起，pulseTime 秒走完，不论神经多长）。
// 单位：米（长颈鹿：脖子约 1.8 m，身体约 1.5 m）；整张图是示意，片中注明「示意」。
// 几何每帧按参数重建（几根管子，量很小），全部由帧驱动，确定性。
import React, {useEffect, useMemo} from 'react';
import * as THREE from 'three';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import type {Vec3} from '../../../engine/shot';

export type NerveDetourProps = {
  position?: Vec3;
  scale?: number;
  startNeck?: number; // 米
  endNeck?: number; // 米
  growAt?: number; // 秒；-1 = 一直是 endNeck
  growDuration?: number;
  fishStart?: boolean;
  pulseAt?: number; // 秒；-1 = 不显示脉冲
  pulseTime?: number; // 脉冲从脑走到喉用的秒数
  direct?: boolean; // 显示「直走」虚线
  outlineColor?: string;
  nerveColor?: string;
};

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const V = (x: number, y: number) => new THREE.Vector3(x, y, 0);

const LINE_VERT = /* glsl */ `
varying float vU;
void main() { vU = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// 发光线：uPulse < 0 不显示脉冲；uDash > 0 画虚线
const LINE_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uAlpha; uniform float uPulse; uniform float uDash; uniform float uLen;
varying float vU;
void main() {
  float a = uAlpha;
  if (uDash > 0.0 && fract(vU * uLen / uDash) > 0.55) discard;
  vec3 col = uCol * a;
  if (uPulse >= 0.0) {
    float d = (vU - uPulse) * uLen;
    col += uCol * exp(-d * d / 0.004) * 5.0;            // 光团（约 ±6 cm）
    col += uCol * 0.6 * step(vU, uPulse);               // 走过的部分更亮
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const mkMat = (hex: string, alpha: number, pulse = -1, dash = 0) =>
  new THREE.ShaderMaterial({vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    uniforms: {uCol: {value: new THREE.Color(hex)}, uAlpha: {value: alpha}, uPulse: {value: pulse}, uDash: {value: dash}, uLen: {value: 1}}});

type Stroke = {pts: THREE.Vector3[]; r: number; mat: THREE.ShaderMaterial; closed?: boolean};

const ellipse = (cx: number, cy: number, rx: number, ry: number, rot = 0, n = 64) => {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    out.push(V(cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)));
  }
  return out;
};

export const NerveDetourAsset: React.FC<NerveDetourProps> = ({
  position = [0, 0, 0],
  scale = 1,
  startNeck = 0.3,
  endNeck = 1.8,
  growAt = -1,
  growDuration = 4,
  fishStart = false,
  pulseAt = -1,
  pulseTime = 2.5,
  direct = true,
  outlineColor = '#5fcfff',
  nerveColor = '#ffcf5a',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;

  const mats = useMemo(() => ({
    outline: mkMat(outlineColor, 0.55), faint: mkMat(outlineColor, 0.25), heart: mkMat('#ff4a5e', 0.9), aorta: mkMat('#ff6a6a', 0.75),
    brain: mkMat('#ffb3d0', 0.8), larynx: mkMat('#ffffff', 0.85), nerve: mkMat(nerveColor, 0.55, 0), direct: mkMat('#ffffff', 0.5, -1, 0.05),
    fish: mkMat(outlineColor, 0.55), legs: mkMat(outlineColor, 0.55), faintLegs: mkMat(outlineColor, 0.25),
  }), [outlineColor, nerveColor]);

  const k = growAt < 0 ? 1 : ease((t - growAt) / Math.max(growDuration, 0.01));
  const L = startNeck + (endNeck - startNeck) * k;               // 当前脖子长度
  const fishness = fishStart ? 1 - Math.min(1, k * 1.6) : 0;      // 鱼的特征
  const landness = 1 - fishness;

  const strokes = useMemo(() => {
    const S: Stroke[] = [];
    const lerpV = (p: THREE.Vector3, q: THREE.Vector3, k_: number) => p.clone().lerp(q, k_);
    // ---------- 长颈鹿式四足动物（侧面，头朝右；地面 y = −2.05） ----------
    const tilt = THREE.MathUtils.degToRad(32);                      // 脖子与竖直方向的夹角
    const dir = V(Math.sin(tilt), Math.cos(tilt));
    const nrm = V(dir.y, -dir.x);                                    // 脖子前侧方向（右下）
    const nbBack = V(0.6, 0.44), nbFront = V(0.9, 0.12);             // 脖子根部：后缘（鬐甲）/ 前缘（胸口上方）
    const base = lerpV(nbBack, nbFront, 0.5);
    const taper = 0.55;                                              // 脖子顶端宽度 / 根部宽度
    const top = base.clone().addScaledVector(dir, L);
    const half = nbBack.distanceTo(nbFront) / 2;
    const ntBack = top.clone().addScaledVector(nrm, -half * taper), ntFront = top.clone().addScaledVector(nrm, half * taper);
    // 身体：从胸口沿胸、腹、臀、背画到鬐甲
    S.push({pts: [nbFront, V(0.95, -0.05), V(0.8, -0.3), V(0.45, -0.42), V(0.0, -0.44), V(-0.45, -0.38), V(-0.72, -0.2), V(-0.8, 0.05), V(-0.72, 0.26), V(-0.3, 0.38), V(0.2, 0.46), nbBack], r: 0.013, mat: mats.legs});
    // 脖子两条边
    S.push({pts: [nbBack, lerpV(nbBack, ntBack, 0.5).addScaledVector(nrm, -0.01), ntBack], r: 0.013, mat: mats.legs});
    S.push({pts: [nbFront, lerpV(nbFront, ntFront, 0.5).addScaledVector(nrm, 0.01), ntFront], r: 0.013, mat: mats.legs});
    // 头：局部坐标（u 朝前下方的口鼻，v 朝上）
    const hu = V(0.94, -0.34).normalize(), hv = V(0.34, 0.94);
    const ho = top.clone().addScaledVector(dir, 0.04);
    const H = (u: number, v: number) => ho.clone().addScaledVector(hu, u).addScaledVector(hv, v);
    S.push({pts: [ntBack, H(-0.1, 0.06), H(0.05, 0.1), H(0.28, 0.06), H(0.38, 0.0), H(0.36, -0.06), H(0.24, -0.09), H(0.04, -0.09), ntFront], r: 0.012, mat: mats.legs});
    S.push({pts: [H(-0.04, 0.09), H(-0.07, 0.2)], r: 0.011, mat: mats.legs});              // 角
    S.push({pts: [H(0.01, 0.1), H(0.0, 0.2)], r: 0.011, mat: mats.legs});
    S.push({pts: [H(-0.09, 0.07), H(-0.2, 0.12), H(-0.12, 0.05)], r: 0.009, mat: mats.legs}); // 耳朵
    // 腿：近侧两条亮、远侧两条暗；有膝盖和蹄
    const leg = (x: number, near: boolean, hind: boolean) => {
      const y0 = hind ? -0.36 : -0.42, knee = hind ? -1.05 : -1.2, g = -2.05;
      const w0 = 0.075, wk = 0.04, ws = 0.032;
      const kx = x + (hind ? -0.06 : 0.02);
      const pts = [V(x - w0, y0), V(kx - wk, knee), V(x - ws, g + 0.12), V(x - ws - 0.01, g), V(x + ws + 0.03, g), V(x + ws, g + 0.12), V(kx + wk, knee), V(x + w0, y0)];
      S.push({pts, r: 0.011, mat: near ? mats.legs : mats.faintLegs});
    };
    leg(0.42, false, false); leg(-0.52, false, true); leg(0.6, true, false); leg(-0.36, true, true);
    S.push({pts: [V(-0.79, 0.12), V(-0.9, -0.3), V(-0.92, -0.7)], r: 0.009, mat: mats.legs});   // 尾巴
    S.push({pts: ellipse(-0.92, -0.76, 0.025, 0.07), r: 0.008, mat: mats.legs});
    // ---------- 鱼（侧面，头朝右；第 11 镜开始的样子） ----------
    if (fishness > 0.01) {
      S.push({pts: [V(1.05, 0.0), V(0.9, 0.2), V(0.4, 0.34), V(-0.2, 0.3), V(-0.7, 0.12), V(-0.95, 0.0), V(-0.7, -0.12), V(-0.2, -0.28), V(0.4, -0.3), V(0.9, -0.17), V(1.05, 0.0)], r: 0.013, mat: mats.fish});
      S.push({pts: [V(-0.95, 0.0), V(-1.25, 0.28), V(-1.15, 0.0), V(-1.25, -0.28), V(-0.95, 0.0)], r: 0.012, mat: mats.fish});
      S.push({pts: [V(-0.15, 0.31), V(0.05, 0.52), V(0.3, 0.33)], r: 0.012, mat: mats.fish});
      S.push({pts: [V(0.25, -0.29), V(0.15, -0.45), V(0.42, -0.31)], r: 0.011, mat: mats.fish});
      for (let i = 0; i < 5; i++) {                                    // 鳃裂
        const x = 0.62 - i * 0.055;
        S.push({pts: [V(x, 0.1), V(x - 0.03, -0.1)], r: 0.008, mat: mats.fish});
      }
      S.push({pts: ellipse(0.93, 0.07, 0.025, 0.025), r: 0.008, mat: mats.fish});     // 眼
    }
    // ---------- 器官和神经（位置在鱼和长颈鹿之间平滑过渡） ----------
    const m_ = landness;
    const brain = lerpV(V(0.82, 0.12), H(-0.02, 0.03), m_);
    const lar = lerpV(V(0.66, -0.06), top.clone().addScaledVector(dir, -0.06).addScaledVector(nrm, half * taper * 0.45), m_);
    const hrt = lerpV(V(0.5, -0.17), V(0.66, -0.12), m_);
    const hr = 0.075 + 0.05 * m_;
    S.push({pts: [hrt.clone().add(V(0, hr * 0.9)), hrt.clone().add(V(hr * 0.9, hr * 0.2)), hrt.clone().add(V(0.0, -hr * 1.2)), hrt.clone().add(V(-hr * 0.9, hr * 0.2)), hrt.clone().add(V(0, hr * 0.9))], r: 0.013, mat: mats.heart});
    const ar = hr * 1.25;
    const arch: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const a_ = Math.PI * (i / 24);
      arch.push(hrt.clone().add(V(ar * Math.cos(a_), hr * 0.9 + ar * 0.85 * Math.sin(a_))));
    }
    S.push({pts: arch, r: 0.018, mat: mats.aorta});
    S.push({pts: ellipse(brain.x, brain.y, 0.06, 0.04, -0.3), r: 0.01, mat: mats.brain});
    S.push({pts: ellipse(lar.x, lar.y, 0.028, 0.028), r: 0.008, mat: mats.larynx});
    // 神经：脑 → 沿脖子后侧往下 → 绕到主动脉弓后面、从弓下方钩过 → 沿脖子前侧往上 → 喉
    const inBack = (sv: number) => base.clone().addScaledVector(dir, sv).addScaledVector(nrm, -half * (1 - (1 - taper) * sv / Math.max(L, 1e-3)) * 0.45);
    const inFront = (sv: number) => base.clone().addScaledVector(dir, sv).addScaledVector(nrm, half * (1 - (1 - taper) * sv / Math.max(L, 1e-3)) * 0.35);
    const archBack = hrt.clone().add(V(-ar - 0.03, hr)), under = hrt.clone().add(V(0, -hr * 0.15)), archFront = hrt.clone().add(V(ar + 0.035, hr * 1.1));
    const np: THREE.Vector3[] = [brain.clone()];
    if (L > 0.12) { for (let sv = L - 0.06; sv > 0.08; sv -= 0.15) np.push(inBack(sv)); }
    np.push(archBack, hrt.clone().add(V(-ar * 0.75, -hr * 0.05)), under.clone().add(V(0, -ar * 0.55)), hrt.clone().add(V(ar * 0.75, -hr * 0.05)), archFront);
    if (L > 0.12) { for (let sv = 0.12; sv < L - 0.08; sv += 0.15) np.push(inFront(sv)); }
    np.push(lar.clone());
    S.push({pts: np, r: 0.012, mat: mats.nerve});
    if (direct) S.push({pts: [brain.clone(), lar.clone()], r: 0.007, mat: mats.direct});
    return S;
  }, [mats, L, fishness, landness, direct]);

  // 透明度 / 脉冲
  mats.fish.uniforms.uAlpha.value = 0.55 * fishness;
  mats.legs.uniforms.uAlpha.value = 0.55 * landness;
  mats.faintLegs.uniforms.uAlpha.value = 0.22 * landness;
  mats.nerve.uniforms.uPulse.value = pulseAt < 0 ? -1 : Math.min(1.2, Math.max(0, (t - pulseAt) / Math.max(pulseTime, 0.01)));

  const geos = useMemo(() => strokes.map((s) => {
    const curve = s.pts.length > 2 ? new THREE.CatmullRomCurve3(s.pts, false, 'centripetal', 0.3) : new THREE.LineCurve3(s.pts[0], s.pts[1]);
    const len = curve.getLength();
    if (s.mat === mats.nerve || s.mat === mats.direct) s.mat.uniforms.uLen.value = len;
    return new THREE.TubeGeometry(curve, Math.max(8, Math.round(len * 120)), s.r, 6, false);
  }), [strokes, mats]);
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);

  return (
    <group position={position} scale={scale}>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} material={strokes[i].mat} frustumCulled={false} />
      ))}
    </group>
  );
};
