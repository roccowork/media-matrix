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
    fish: mkMat(outlineColor, 0.55), legs: mkMat(outlineColor, 0.55),
  }), [outlineColor, nerveColor]);

  const k = growAt < 0 ? 1 : ease((t - growAt) / Math.max(growDuration, 0.01));
  const L = startNeck + (endNeck - startNeck) * k;               // 当前脖子长度
  const fishness = fishStart ? 1 - Math.min(1, k * 1.6) : 0;      // 鱼的特征
  const landness = 1 - fishness;

  const strokes = useMemo(() => {
    const S: Stroke[] = [];
    // 身体：椭圆（胸腔在右侧），鱼时更扁长
    const bx = 0, by = 0, brx = 0.75 + 0.15 * fishness, bry = 0.42 - 0.12 * fishness;
    S.push({pts: ellipse(bx, by, brx, bry), r: 0.012, mat: mats.outline});
    // 脖子：从身体右上方伸出，向前上方倾斜（长颈鹿约 25°）；鱼时没有脖子
    const tilt = THREE.MathUtils.degToRad(25 + 40 * fishness);
    const base = V(bx + brx * 0.78, by + bry * 0.55);
    const dir = V(Math.sin(tilt), Math.cos(tilt));
    const nrm = V(dir.y, -dir.x);                                // 指向脖子前侧（右下）
    const top = base.clone().addScaledVector(dir, L);
    const nw = 0.11;                                                // 脖子半宽
    S.push({pts: [base.clone().addScaledVector(nrm, -nw * 1.4), top.clone().addScaledVector(nrm, -nw)], r: 0.012, mat: mats.outline});
    S.push({pts: [base.clone().addScaledVector(nrm, nw * 1.6), top.clone().addScaledVector(nrm, nw)], r: 0.012, mat: mats.outline});
    // 头：椭圆，朝前；鱼时头和身体连在一起（脖子长度接近 0）
    const hc = top.clone().addScaledVector(dir, 0.1).addScaledVector(nrm, 0.12);
    S.push({pts: ellipse(hc.x, hc.y, 0.26, 0.12, -tilt + Math.PI / 2 - 0.35), r: 0.012, mat: mats.outline});
    // 脑：头后上部的小椭圆
    const brain = hc.clone().addScaledVector(dir, 0.03).addScaledVector(nrm, -0.08);
    S.push({pts: ellipse(brain.x, brain.y, 0.06, 0.04, -tilt), r: 0.01, mat: mats.brain});
    // 喉：头下方、脖子前侧的小环
    const lar = top.clone().addScaledVector(dir, -0.05).addScaledVector(nrm, nw * 0.55);
    S.push({pts: ellipse(lar.x, lar.y, 0.03, 0.03), r: 0.008, mat: mats.larynx});
    // 心脏 + 主动脉弓（胸腔前部）
    const hrt = V(bx + brx * 0.55, by - bry * 0.15);
    S.push({pts: ellipse(hrt.x, hrt.y, 0.085, 0.1, 0.4), r: 0.012, mat: mats.heart});
    const arch: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const a = Math.PI * (i / 24);
      arch.push(V(hrt.x + 0.11 * Math.cos(a), hrt.y + 0.1 + 0.1 * Math.sin(a)));
    }
    S.push({pts: arch, r: 0.016, mat: mats.aorta});
    // 喉返神经：脑 → 沿脖子后侧往下 → 胸腔里从主动脉弓下方钩过 → 沿脖子前侧往上 → 喉
    const back = (s: number) => base.clone().addScaledVector(dir, s).addScaledVector(nrm, -nw * 0.45);
    const front = (s: number) => base.clone().addScaledVector(dir, s).addScaledVector(nrm, nw * 0.35);
    const np: THREE.Vector3[] = [brain.clone(), back(L - 0.02)];
    for (let s = L - 0.1; s > 0.05; s -= 0.15) np.push(back(s));
    np.push(V(hrt.x - 0.16, hrt.y + 0.16), V(hrt.x - 0.13, hrt.y - 0.02), V(hrt.x, hrt.y - 0.03), V(hrt.x + 0.14, hrt.y + 0.06), V(hrt.x + 0.16, hrt.y + 0.22));
    for (let s = 0.1; s < L - 0.08; s += 0.15) np.push(front(s));
    np.push(lar.clone());
    S.push({pts: np, r: 0.011, mat: mats.nerve});
    if (direct) S.push({pts: [brain.clone(), lar.clone()], r: 0.006, mat: mats.direct});
    // 鱼：尾鳍、背鳍、鳃裂（随 fishness 淡出）
    if (fishness > 0.01) {
      const tx = bx - brx;
      S.push({pts: [V(tx, by), V(tx - 0.3, by + 0.25), V(tx - 0.22, by), V(tx - 0.3, by - 0.25), V(tx, by)], r: 0.012, mat: mats.fish});
      S.push({pts: [V(bx - 0.2, by + bry * 0.95), V(bx + 0.05, by + bry + 0.18), V(bx + 0.25, by + bry * 0.9)], r: 0.012, mat: mats.fish});
      for (let i = 0; i < 5; i++) {
        const g = base.clone().addScaledVector(nrm, 0.02).add(V(-0.05 - i * 0.05, -0.05 - i * 0.02));
        S.push({pts: [g, g.clone().add(V(0.03, -0.12))], r: 0.008, mat: mats.fish});
      }
    }
    // 陆生：四条腿（随 landness 淡入）
    if (landness > 0.01) {
      const legL = 1.6 * landness;
      for (const [x, ph] of [[-0.5, 0], [-0.35, 0.3], [0.4, 0.15], [0.55, 0.45]] as [number, number][]) {
        const y0 = by - Math.sqrt(Math.max(0, 1 - (x / brx) ** 2)) * bry * 0.92;
        S.push({pts: [V(x, y0), V(x + 0.02 * Math.sin(ph * 6), y0 - legL * 0.5), V(x, y0 - legL)], r: 0.012, mat: mats.legs});
      }
    }
    return S;
  }, [mats, L, fishness, landness, direct]);

  // 透明度 / 脉冲
  mats.fish.uniforms.uAlpha.value = 0.55 * fishness;
  mats.legs.uniforms.uAlpha.value = 0.55 * landness;
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
