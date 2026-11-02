// 10 秒 3D 样片：「它」指的是谁？（科技主题：深蓝 + 金色重点）
// 底子用 Grok 的骨架（ScienceScene / PathFlow / PulseWave / FocusReticle / Caption），加上：
// 3D 玻璃词卡（canvas 贴图）、按注意力权重粗细的光弧、Quaternius 的免费小猫模型（CC0，FBX 自带动画）。
// 分镜：0–2s 词卡依次浮现 → 2–5s「它」亮起，向每个词射出光弧（粗细 = 注意力）→
//       5–8s 金色粒子流涌向「小猫」，小猫模型落到台上，景深对焦切到小猫，87% → 8–10s 结论字幕。
import React, {useEffect, useMemo, useState} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
import {AbsoluteFill, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/google-fonts/NotoSansSC';
import {ScienceScene} from '../components/ScienceScene';
import {PathFlow} from '../components/PathFlow';
import {PulseWave} from '../components/PulseWave';
import {FocusReticle} from '../components/FocusReticle';
import {Caption} from '../components/Caption';
import {Label3D} from '../components/Label3D';

export const ATTENTION10_DURATION = 300;
const FONT = loadFont('normal', {weights: ['900'], ignoreTooManyRequestsWarning: true}).fontFamily;

const WORDS = ['小猫', '没有', '跳上', '桌子', '因为', '它', '太累了'];
const WEIGHT = [0.87, 0.02, 0.03, 0.05, 0.01, 0, 0.02];
const CAT = 0;
const IT = 5;
// 词卡排成一条向后弯的弧，带出纵深
const POS: [number, number, number][] = WORDS.map((_, i) => {
  const x = (i - 3) * 1.55;
  return [x, 0.75, -0.09 * x * x];
});
const CAT_POS: [number, number, number] = [-2.6, -1.6, 1.9];

const T_IT = 60; // 「它」亮起
const T_FLOW = 150; // 金色粒子流
const T_END = 240; // 结论

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// ── 3D 玻璃词卡 ──
const useFontReady = () => {
  const [ready, setReady] = useState(false);
  const [h] = useState(() => delayRender('字体'));
  useEffect(() => {
    document.fonts.load(`900 96px ${FONT}`).then(() => document.fonts.ready).then(() => {
      setReady(true);
      continueRender(h);
    });
  }, [h]);
  return ready;
};

const cardTexture = (text: string, hot: boolean, ready: boolean) => {
  const w = 160 + text.length * 120;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = 220;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 220);
  if (hot) {
    grad.addColorStop(0, '#f7c64a');
    grad.addColorStop(1, '#e08a12');
  } else {
    grad.addColorStop(0, 'rgba(120,170,255,0.38)');
    grad.addColorStop(1, 'rgba(40,70,160,0.22)');
  }
  g.fillStyle = grad;
  g.beginPath();
  g.roundRect(6, 6, w - 12, 208, 44);
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = hot ? '#fff1c4' : 'rgba(170,220,255,0.85)';
  g.stroke();
  g.fillStyle = hot ? '#120a00' : '#f2f6ff';
  g.font = `900 120px ${ready ? FONT : 'sans-serif'}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, 118);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return {tex: t, aspect: w / 220};
};

const Cards: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {camera} = useThree();
  const ready = useFontReady();
  const tex = useMemo(() => WORDS.map((w) => [cardTexture(w, false, ready), cardTexture(w, true, ready)]), [ready]);
  return (
    <>
      {WORDS.map((w, i) => {
        const s = spring({frame: frame - (6 + i * 6), fps, config: {damping: 12, stiffness: 140}});
        const hotAt = i === IT ? T_IT : i === CAT ? T_FLOW + 18 : Infinity;
        const hot = frame >= hotAt;
        const pop = hot ? spring({frame: frame - hotAt, fps, config: {damping: 8, stiffness: 180}}) : 0;
        // 其他词在「它」看过去之后变暗，突出重点
        const dim = !hot && frame > T_FLOW ? interpolate(frame, [T_FLOW, T_FLOW + 20], [1, 0.45], {extrapolateRight: 'clamp'}) : 1;
        const {tex: t, aspect} = tex[i][hot ? 1 : 0];
        const h = 0.62;
        const bob = Math.sin(frame / 24 + i * 1.1) * 0.05;
        return (
          <group key={w} position={[POS[i][0], POS[i][1] + bob + (1 - s) * -0.8, POS[i][2]]} quaternion={camera.quaternion} scale={Math.max(0.001, s) * (1 + pop * 0.18 - (hot ? 0.06 : 0))}>
            <mesh>
              <planeGeometry args={[h * aspect, h]} />
              <meshBasicMaterial map={t} transparent opacity={dim} toneMapped={false} color="#ffffff" depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </>
  );
};

// ── 光弧：从「它」射向每个词，粗细 = 注意力权重；按进度画出来 ──
const arcCurve = (a: [number, number, number], b: [number, number, number], lift: number) => {
  const A = new THREE.Vector3(...a).add(new THREE.Vector3(0, 0.35, 0));
  const B = new THREE.Vector3(...b).add(new THREE.Vector3(0, 0.35, 0));
  const M = A.clone().add(B).multiplyScalar(0.5).add(new THREE.Vector3(0, lift, -0.3));
  return new THREE.QuadraticBezierCurve3(A, M, B);
};

const Beam: React.FC<{i: number; start: number}> = ({i, start}) => {
  const frame = useCurrentFrame();
  const p = ease((frame - start) / 22);
  const curve = useMemo(() => arcCurve(POS[IT], POS[i], 0.6 + Math.abs(IT - i) * 0.55), [i]);
  const geom = useMemo(() => {
    if (p <= 0.01) return null;
    const pts = curve.getPoints(48).slice(0, Math.max(2, Math.round(48 * p) + 1));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.012 + WEIGHT[i] * 0.07, 10, false);
  }, [curve, p, i]);
  if (!geom) return null;
  const hot = i === CAT;
  const fade = !hot && frame > T_FLOW ? interpolate(frame, [T_FLOW, T_FLOW + 20], [1, 0.35], {extrapolateRight: 'clamp'}) : 1;
  return (
    <mesh geometry={geom}>
      <meshBasicMaterial color={hot ? new THREE.Color('#ffc94d').multiplyScalar(2.2) : new THREE.Color('#5ee7ff').multiplyScalar(1.3)} toneMapped={false} transparent opacity={(hot ? 1 : 0.75) * fade} />
    </mesh>
  );
};

// ── 小猫：Quaternius 免费模型（CC0），播放自带的 Idle 动画，时间由帧驱动 ──
// 模型在画布外先加载完（delayRender），再交给 3D 场景；否则 Suspense 加载完后画面不会重绘，截帧里没有小猫
const useFbx = (src: string) => {
  const [obj, setObj] = useState<THREE.Group | null>(null);
  const [h] = useState(() => delayRender(`模型 ${src}`));
  useEffect(() => {
    new FBXLoader().load(src, (o) => {
      setObj(o);
      continueRender(h);
    });
  }, [src, h]);
  return obj;
};

const Cat: React.FC<{fbx: THREE.Group}> = ({fbx}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {mixer, root} = useMemo(() => {
    const colors: Record<string, string> = {Grey: '#8d94a6', White: '#f4f1ea', Pink: '#ff9eb5'};
    fbx.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.frustumCulled = false;
      // 蒙皮网格缩放后包围盒不准，会被误裁掉
      const mats = (Array.isArray(m.material) ? m.material : [m.material]).map(
        (old) => new THREE.MeshStandardMaterial({color: colors[old.name] ?? '#cccccc', roughness: 0.55, metalness: 0.05}),
      );
      m.material = Array.isArray(m.material) ? mats : mats[0];
    });
    const mx = new THREE.AnimationMixer(fbx);
    const idle = fbx.animations.find((a) => a.name.includes('Idle')) ?? fbx.animations[0];
    if (idle) mx.clipAction(idle).play();
    return {mixer: mx, root: fbx};
  }, [fbx]);
  mixer.setTime(frame / fps);
  const t = frame - (T_FLOW + 14);
  if (t < 0) return null;
  const drop = spring({frame: t, fps, config: {damping: 9, stiffness: 160}});
  const s = 0.0038;
  return (
    <group position={[CAT_POS[0], CAT_POS[1] + (1 - Math.min(1, t / 9)) * 2.2, CAT_POS[2]]} rotation={[0, -0.75, 0]}>
      {/* 落地压扁再回弹 */}
      <group scale={[s * (1 + (1 - drop) * 0.25), s * (1 - (1 - drop) * 0.3), s * (1 + (1 - drop) * 0.25)]}>
        <primitive object={root} />
      </group>
    </group>
  );
};

export const Attention10s: React.FC = () => {
  const frame = useCurrentFrame();
  const catModel = useFbx(staticFile('models/quaternius/Cat.fbx'));
  const catFocus = ease((frame - T_FLOW - 10) / 30);
  const focus: [number, number, number] = [
    interpolate(catFocus, [0, 1], [POS[IT][0], CAT_POS[0]]),
    interpolate(catFocus, [0, 1], [POS[IT][1], CAT_POS[1] + 0.8]),
    interpolate(catFocus, [0, 1], [POS[IT][2], CAT_POS[2]]),
  ];
  const flowOn = frame >= T_FLOW;
  const pan = ease((frame - T_FLOW) / 70);
  const lookAt: [number, number, number] = [interpolate(pan, [0, 1], [-0.4, -1.6]), interpolate(pan, [0, 1], [0.55, -0.2]), interpolate(pan, [0, 1], [0, 0.9])];
  return (
    <AbsoluteFill style={{backgroundColor: '#0a0e17'}}>
      <ScienceScene lighting="tech" camera="push-arc" radius={7.6} height={1.7} lookAt={lookAt} fov={42} ground particles particleCount={260} post focus={focus} bloom={0.9} bokeh={2.2}>
        <spotLight position={[CAT_POS[0] + 2, 5, CAT_POS[2] + 3]} angle={0.5} penumbra={0.8} intensity={flowOn ? 60 : 0} color="#ffe2a0" castShadow />
        <Cards />
        {WORDS.map((_, i) => (i === IT ? null : <Beam key={i} i={i} start={T_IT + 8 + Math.abs(IT - i) * 7} />))}
        {flowOn && (
          <PathFlow points={arcCurve(POS[IT], POS[CAT], 0.6 + (IT - CAT) * 0.55).getPoints(12).map((v) => [v.x, v.y, v.z] as [number, number, number])} color="#fff0c0" size={0.14} count={36} speed={0.012} showTube={false} />
        )}
        {frame >= T_IT && <PulseWave position={[POS[IT][0], POS[IT][1] - 0.45, POS[IT][2]]} color="#ffc94d" maxRadius={1.6} thickness={0.02} />}
        {flowOn && <PulseWave position={[CAT_POS[0], CAT_POS[1] + 0.02, CAT_POS[2]]} color="#ffc94d" maxRadius={2.4} />}
        <FocusReticle position={[CAT_POS[0], CAT_POS[1] + 0.75, CAT_POS[2]]} from={T_FLOW + 26} to={T_END + 30} color="#ffd166" size={1.3} />
        {catModel && <Cat fbx={catModel} />}
        <Label3D position={[CAT_POS[0] + 1.7, CAT_POS[1] + 1.35, CAT_POS[2]]} text="注意力 87%" from={T_FLOW + 40} fontSize={40} color="#1a1204" background="rgba(245,184,61,0.95)" />
      </ScienceScene>
      <Caption text="「它」指的是谁？" from={0} to={T_END} position="top" fontSize={68} />
      <Caption text="每个词，都去看一遍所有的词" sub="这就是「注意力」" from={T_END} to={ATTENTION10_DURATION + 30} position="top" fontSize={60} />
    </AbsoluteFill>
  );
};
