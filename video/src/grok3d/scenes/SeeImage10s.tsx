// 10 秒 3D 样片：「AI 是怎么看懂一张图的？」（科技主题，暂无字幕和配音）
// 分镜：0–2s 悬浮照片推近 → 2–4s 照片碎成像素方块扑面而来 → 4–7s 方块流穿过 3 层识别层，
//       每层弹出它「看到的东西」（线条 / 局部 / 整体）→ 7–9s 方块聚成 3D 小猫，「猫 98%」→ 9–10s 拉远看全流程。
// 照片、像素颜色、线稿、局部小图全部来自同一张图 public/science3d/cat-photo.png（由 Grok-CatPhoto 渲染）。
import React, {useEffect, useMemo, useState} from 'react';
import * as THREE from 'three';
import {AbsoluteFill, continueRender, delayRender, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/google-fonts/NotoSansSC';
import {ScienceScene} from '../components/ScienceScene';
import {PulseWave} from '../components/PulseWave';
import {Label3D} from '../components/Label3D';
import {QuaterniusCat, useCatModel} from '../components/QuaterniusCat';
import {NOINK} from '../film/ink';

export const SEE_IMAGE_DURATION = 300;
const FONT = loadFont('normal', {weights: ['700', '900'], ignoreTooManyRequestsWarning: true}).fontFamily;

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const lerp3 = (a: THREE.Vector3, b: THREE.Vector3, t: number) => a.clone().lerp(b, t);

// ── 布局 ──
const PHOTO_C = new THREE.Vector3(-6, 0.3, 0);
const PW = 3.2;
const PH = 2.4;
const GX = 32;
const GY = 24;
const N = GX * GY;
const CELL = PW / GX;
const LAYER_X = [-2.5, 0.5, 3.5];
const LAYER_COLOR = ['#4f8bff', '#5ee7ff', '#ffc94d'];
const LAYER_NAME = ['第 1 层 · 线条', '第 2 层 · 局部', '第 3 层 · 整体'];
const CAT_C = new THREE.Vector3(6.6, -1.6, 0.4);
const FLOW = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-4.6, 0.3, 0.9),
  new THREE.Vector3(-2.5, 0.25, 0),
  new THREE.Vector3(0.5, 0.35, 0),
  new THREE.Vector3(3.5, 0.25, 0),
  new THREE.Vector3(5.8, -0.2, 0.3),
]);

// ── 镜头关键帧 ──
type Key = {f: number; pos: [number, number, number]; look: [number, number, number]};
const KEYS: Key[] = [
  {f: 0, pos: [-5.0, 1.0, 7.4], look: [-6, 0.3, 0]},
  {f: 55, pos: [-5.5, 0.6, 4.8], look: [-6, 0.3, 0]},
  {f: 98, pos: [-4.2, 1.3, 7.6], look: [-5.0, 0.3, 0.9]},
  {f: 122, pos: [-4.8, 2.0, 8.6], look: [-3.0, 0.8, 0]},
  {f: 190, pos: [1.6, 2.2, 8.8], look: [2.8, 0.9, 0]},
  {f: 236, pos: [4.4, 0.9, 5.6], look: [6.5, -0.15, 0.4]},
  {f: 262, pos: [4.3, 1.0, 5.8], look: [6.4, -0.15, 0.4]},
  {f: 299, pos: [-3.2, 3.6, 13.4], look: [0.8, 0.2, 0]},
];
const cameraAt = (f: number) => {
  let i = 0;
  while (i < KEYS.length - 2 && f > KEYS[i + 1].f) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = ease((f - a.f) / (b.f - a.f));
  const m = (x: number[], y: number[]) => x.map((v, k) => v + (y[k] - v) * t) as [number, number, number];
  return {position: m(a.pos, b.pos), lookAt: m(a.look, b.look), fov: 40};
};

// ── 读照片：像素颜色 + 线稿 + 局部小图（全部从同一张图算出来） ──
type PhotoData = {
  photo: THREE.Texture;
  colors: THREE.Color[];
  panels: THREE.Texture[];
};

const panelCanvas = (title: string, color: string, draw: (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void) => {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 520;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(8,14,32,0.92)';
  g.beginPath();
  g.roundRect(4, 4, 632, 512, 28);
  g.fill();
  g.lineWidth = 5;
  g.strokeStyle = color;
  g.stroke();
  g.fillStyle = color;
  g.font = `900 46px ${FONT}`;
  g.textBaseline = 'middle';
  g.fillText(title, 32, 52);
  draw(g, 28, 96, 584, 396);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

const usePhotoData = (): PhotoData | null => {
  const [data, setData] = useState<PhotoData | null>(null);
  const [h] = useState(() => delayRender('照片'));
  useEffect(() => {
    const img = new Image();
    img.onload = async () => {
      await document.fonts.load(`900 46px ${FONT}`);
      const W = img.width;
      const H = img.height;
      const src = document.createElement('canvas');
      src.width = W;
      src.height = H;
      const sg = src.getContext('2d')!;
      sg.drawImage(img, 0, 0);
      const px = sg.getImageData(0, 0, W, H).data;
      // 每个方块取格子里的平均色
      const colors: THREE.Color[] = [];
      for (let gy = 0; gy < GY; gy++) {
        for (let gx = 0; gx < GX; gx++) {
          let r = 0, g = 0, b = 0, n = 0;
          for (let y = Math.floor((gy * H) / GY); y < Math.floor(((gy + 1) * H) / GY); y += 2) {
            for (let x = Math.floor((gx * W) / GX); x < Math.floor(((gx + 1) * W) / GX); x += 2) {
              const k = (y * W + x) * 4;
              r += px[k]; g += px[k + 1]; b += px[k + 2]; n++;
            }
          }
          colors.push(new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace));
        }
      }
      // 第 1 层：Sobel 边缘检测得到的线稿
      const edge = document.createElement('canvas');
      edge.width = W;
      edge.height = H;
      const eg = edge.getContext('2d')!;
      const out = eg.createImageData(W, H);
      const lum = (x: number, y: number) => {
        const k = (y * W + x) * 4;
        return 0.299 * px[k] + 0.587 * px[k + 1] + 0.114 * px[k + 2];
      };
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const gxv = -lum(x - 1, y - 1) - 2 * lum(x - 1, y) - lum(x - 1, y + 1) + lum(x + 1, y - 1) + 2 * lum(x + 1, y) + lum(x + 1, y + 1);
          const gyv = -lum(x - 1, y - 1) - 2 * lum(x, y - 1) - lum(x + 1, y - 1) + lum(x - 1, y + 1) + 2 * lum(x, y + 1) + lum(x + 1, y + 1);
          const m = Math.min(255, Math.hypot(gxv, gyv) * 2.2);
          const k = (y * W + x) * 4;
          out.data[k] = 94; out.data[k + 1] = 200 + (m > 60 ? 31 : 0); out.data[k + 2] = 255; out.data[k + 3] = m > 40 ? Math.min(255, m * 1.4) : 0;
        }
      }
      eg.putImageData(out, 0, 0);
      const fit = (g: CanvasRenderingContext2D, im: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, x: number, y: number, w: number, h: number) => {
        const s = Math.min(w / sw, h / sh);
        g.drawImage(im, sx, sy, sw, sh, x + (w - sw * s) / 2, y + (h - sh * s) / 2, sw * s, sh * s);
      };
      const panels = [
        panelCanvas(LAYER_NAME[0], LAYER_COLOR[0], (g, x, y, w, h) => fit(g, edge, 0, 0, W, H, x, y, w, h)),
        panelCanvas(LAYER_NAME[1], LAYER_COLOR[1], (g, x, y, w, h) => {
          // 耳朵 / 脸 / 爪子 三个局部
          const crops: [number, number, number, number, string][] = [
            [425, 235, 95, 75, '耳朵'],
            [445, 275, 90, 85, '脸'],
            [365, 425, 110, 70, '爪子'],
          ];
          const cw = (w - 24) / 3;
          crops.forEach(([sx, sy, sw, sh, name], i) => {
            const cx = x + i * (cw + 12);
            g.save();
            g.beginPath();
            g.roundRect(cx, y + 20, cw, h - 110, 18);
            g.clip();
            g.drawImage(src, sx, sy, sw, sh, cx, y + 20, cw, h - 110);
            g.restore();
            g.lineWidth = 4;
            g.strokeStyle = LAYER_COLOR[1];
            g.beginPath();
            g.roundRect(cx, y + 20, cw, h - 110, 18);
            g.stroke();
            g.fillStyle = '#eaf6ff';
            g.font = `700 40px ${FONT}`;
            g.textAlign = 'center';
            g.fillText(name, cx + cw / 2, y + h - 40);
            g.textAlign = 'left';
          });
        }),
        panelCanvas(LAYER_NAME[2], LAYER_COLOR[2], (g, x, y, w, h) => fit(g, src, 270, 150, 280, 350, x, y, w, h)),
      ];
      const photo = new THREE.CanvasTexture(src);
      photo.colorSpace = THREE.SRGBColorSpace;
      setData({photo, colors, panels});
      continueRender(h);
    };
    img.src = staticFile('science3d/cat-photo.png');
  }, [h]);
  return data;
};

// ── 每个方块在第 f 帧的位置 / 旋转 / 大小（纯函数，帧驱动） ──
type Cube = {pos: THREE.Vector3; rot: THREE.Euler; s: number};
const cubeAt = (i: number, f: number): Cube => {
  const gx = i % GX;
  const gy = Math.floor(i / GX);
  const home = new THREE.Vector3(PHOTO_C.x + ((gx + 0.5) / GX - 0.5) * PW, PHOTO_C.y + (0.5 - (gy + 0.5) / GY) * PH, PHOTO_C.z + 0.03);
  const r = (k: string) => random(`cube-${i}-${k}`);
  const dx = home.x - PHOTO_C.x;
  const dy = home.y - PHOTO_C.y;
  const d = Math.hypot(dx / (PW / 2), dy / (PH / 2)) / Math.SQRT2;
  // 碎裂：从中心往外，飞向镜头、旋转
  const s1 = 60 + d * 14 + r('a') * 6;
  const t1 = 1 - Math.pow(1 - clamp01((f - s1) / 42), 3);
  const len = Math.hypot(dx, dy) || 1;
  const burst = new THREE.Vector3((dx / len) * (0.6 + 1.4 * r('b')), (dy / len) * (0.6 + 1.4 * r('b')) + (r('c') - 0.5) * 0.6, 1.2 + 3.2 * r('d'));
  const shard = home.clone().add(burst.clone().multiplyScalar(t1));
  const spin = new THREE.Euler(r('e') * 7 * t1, r('f') * 7 * t1, r('g') * 3 * t1);
  // 方块流：沿管道穿过三层
  const s2 = 104 + r('h') * 44;
  const u = ease(clamp01((f - s2) / 78));
  const ang = r('i') * Math.PI * 2;
  const rad = Math.sqrt(r('j')) * 1.0;
  const off = new THREE.Vector3(0, Math.sin(ang) * rad, Math.cos(ang) * rad);
  const onTube = FLOW.getPointAt(u).add(off.multiplyScalar(1 - 0.35 * Math.sin(u * Math.PI)));
  // 聚成小猫：飞向猫身上的一个随机点，同时缩小消失
  const s3 = s2 + 78;
  const t3 = ease(clamp01((f - s3) / 20));
  const target = CAT_C.clone().add(new THREE.Vector3((r('k') - 0.5) * 2.0, 0.3 + r('l') * 1.4, (r('m') - 0.5) * 0.8));
  let pos: THREE.Vector3;
  let s = CELL * 0.92;
  if (f < s2) {
    pos = shard;
  } else {
    pos = lerp3(shard, onTube, ease(clamp01((f - s2) / 16)));
    s = CELL * interpolate(u, [0, 0.5, 1], [0.92, 0.75, 0.85]);
    if (f >= s3) {
      pos = lerp3(onTube, target, t3);
      s *= 1 - t3;
    }
  }
  const settle = f < s2 ? spin : new THREE.Euler(spin.x + u * 3, spin.y + u * 2, spin.z);
  return {pos, rot: settle, s: f < 60 ? 0 : s};
};

// ── 方块：一个 InstancedMesh 一次画完 ──
const Cubes: React.FC<{data: PhotoData; cubes: Cube[]}> = ({data, cubes}) => {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.6), new THREE.MeshStandardMaterial({roughness: 0.45, metalness: 0.05}), N);
    data.colors.forEach((c, i) => m.setColorAt(i, c));
    m.frustumCulled = false;
    m.layers.set(NOINK); // 方块不描边（几百个小方块描黑边会变成一片黑点）
    return m;
  }, [data]);
  const o = useMemo(() => new THREE.Object3D(), []);
  cubes.forEach((c, i) => {
    o.position.copy(c.pos);
    o.rotation.copy(c.rot);
    o.scale.setScalar(Math.max(0.0001, c.s));
    o.updateMatrix();
    mesh.setMatrixAt(i, o.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return <primitive object={mesh} />;
};

// ── 识别层：发光网格平面；方块穿过时变亮 ──
const gridTexture = () => {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = 2;
  for (let k = 0; k <= 16; k++) {
    const p = (k / 16) * 512;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 512); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(512, p); g.stroke();
  }
  g.lineWidth = 10;
  g.strokeStyle = 'rgba(255,255,255,1)';
  g.strokeRect(5, 5, 502, 502);
  return new THREE.CanvasTexture(c);
};

const Layer: React.FC<{k: number; glow: number; seen: number}> = ({k, glow, seen}) => {
  const tex = useMemo(gridTexture, []);
  const col = new THREE.Color(LAYER_COLOR[k]);
  return (
    <group position={[LAYER_X[k], 0.3, 0]} rotation={[0, Math.PI / 2 - 0.6, 0]}>
      <mesh>
        <planeGeometry args={[3.4, 3.4]} />
        <meshBasicMaterial map={tex} color={col.clone().multiplyScalar(0.8 + glow * 2.2)} transparent opacity={0.28 + glow * 0.45 + seen * 0.1} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh>
        <planeGeometry args={[3.4, 3.4]} />
        <meshBasicMaterial color={col} transparent opacity={0.05 + glow * 0.12} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

// ── 每层弹出的「看到了什么」小窗 ──
const Panel: React.FC<{k: number; tex: THREE.Texture; at: number}> = ({k, tex, at}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (frame < at) return null;
  const s = spring({frame: frame - at, fps, config: {damping: 11, stiffness: 150}});
  const y = 2.45 + (1 - s) * -0.6;
  return (
    <group position={[LAYER_X[k] - 0.2, y, 0.3]} rotation={[0, -0.12, 0]} scale={Math.max(0.001, s)}>
      <mesh>
        <planeGeometry args={[2.1, 2.1 * (520 / 640)]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      {/* 小窗和层之间的引线 */}
      <mesh position={[0.2, -0.95, -0.15]}>
        <cylinderGeometry args={[0.012, 0.012, 0.3, 6]} />
        <meshBasicMaterial color={new THREE.Color(LAYER_COLOR[k]).multiplyScalar(1.6)} toneMapped={false} />
      </mesh>
    </group>
  );
};

export const SeeImage10s: React.FC<{look?: 'basic' | 'film'}> = ({look = 'basic'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const data = usePhotoData();
  const cat = useCatModel();
  const cubes = useMemo(() => Array.from({length: N}, (_, i) => cubeAt(i, frame)), [frame]);
  // 每层附近有多少方块 → 层的亮度；第一次有足够多方块穿过时弹出小窗
  const glow = LAYER_X.map((x) => Math.min(1, cubes.filter((c) => c.s > 0 && Math.abs(c.pos.x - x) < 0.35).length / 90));
  const panelAt = [128, 146, 166];
  const cam = cameraAt(frame);
  // 电影感后期：特写虚化背景，远景全清晰（原版规范：特写 12–16、中景 10–12、远景 0）
  const cInf = interpolate(frame, [0, 60, 100, 130, 200, 230, 262, 290], [12, 14, 10, 6, 6, 13, 13, 0], {extrapolateRight: 'clamp'});
  const catIn = spring({frame: frame - 214, fps, config: {damping: 12, stiffness: 120}});
  const ORANGE = useMemo(() => ({Grey: '#e8984f'}), []);
  return (
    <AbsoluteFill style={{backgroundColor: '#070b16'}}>
      <ScienceScene lighting="tech" cameraPose={cam} lookAt={cam.lookAt} ground particles particleCount={260} post={look === 'basic'} film={look === 'film' ? {cInf, focus: cam.lookAt} : undefined} focus={cam.lookAt} bloom={0.9} bokeh={2.4}>
        <directionalLight position={[-3, 4, 6]} intensity={1.4} color="#fff3e0" />
        <ambientLight intensity={0.5} />
        {/* 拍立得相框：照片碎掉后只剩空框 */}
        <group position={PHOTO_C.toArray()}>
          <mesh position={[0, -0.18, -0.03]}>
            <planeGeometry args={[PW + 0.3, PH + 0.66]} />
            <meshStandardMaterial color="#f4f1ea" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, -0.02]}>
            <planeGeometry args={[PW, PH]} />
            <meshStandardMaterial color="#0d1324" roughness={0.9} />
          </mesh>
          {data && frame < 61 && (
            <mesh position={[0, 0, 0.0]}>
              <planeGeometry args={[PW, PH]} />
              <meshBasicMaterial map={data.photo} toneMapped={false} />
            </mesh>
          )}
        </group>
        {data && <Cubes data={data} cubes={cubes} />}
        {LAYER_X.map((_, k) => (
          <Layer key={k} k={k} glow={glow[k]} seen={frame > panelAt[k] ? 1 : 0} />
        ))}
        {data && data.panels.map((t, k) => <Panel key={k} k={k} tex={t} at={panelAt[k]} />)}
        {/* 聚成的小猫 */}
        {cat && frame >= 214 && (
          <group position={CAT_C.toArray()} rotation={[0, -0.9, 0]} scale={Math.max(0.001, catIn)}>
            <QuaterniusCat model={cat} scale={0.0042} color={ORANGE} offset={20} />
          </group>
        )}
        <spotLight position={[CAT_C.x - 1, 4.5, CAT_C.z + 3.5]} angle={0.55} penumbra={0.8} intensity={frame >= 214 ? 70 : 0} color="#ffe6b8" />
        {frame >= 222 && <PulseWave position={[CAT_C.x, CAT_C.y + 0.02, CAT_C.z]} color="#ffc94d" maxRadius={2.6} />}
        <Label3D position={[CAT_C.x + 0.2, CAT_C.y + 2.45, CAT_C.z]} text="猫 98%" from={234} fontSize={64} color="#1a1204" background="rgba(245,184,61,0.96)" />
        <Label3D position={[CAT_C.x + 0.2, CAT_C.y + 2.0, CAT_C.z]} text="狗 1% · 狐狸 1%" from={240} fontSize={30} color="#cfe3ff" background="rgba(10,14,23,0.7)" />
      </ScienceScene>
    </AbsoluteFill>
  );
};
