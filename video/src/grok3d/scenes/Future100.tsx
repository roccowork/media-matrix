// 15 秒 3D 样片：「100 年后，AI 会发展到什么程度？」（无配音、无字幕；画面上只有年份和结尾的问号）
// 主线：镜头沿 -z 穿过一条时间隧道，每过一道年份门看到一个具体的变化：
//   2026 手机里的对话气泡 → 2035 家里干活的机器人 → 2050 AI 科学家组装 DNA / 分子、试管依次亮起
//   → 2080 自己运转的城市、空中车流 → 2126 飞出地球，飞船驶向远方，定格「？」
// 机器人：public/models/RobotExpressive.glb（CC0）；其余全部代码生成。
import React, {useEffect, useMemo, useState} from 'react';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {RoundedBox} from '@react-three/drei';
import {AbsoluteFill, continueRender, delayRender, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont as loadAnton} from '@remotion/google-fonts/Anton';
import {loadFont as loadSC} from '@remotion/google-fonts/NotoSansSC';
import {ScienceScene} from '../components/ScienceScene';
import {makeSkinBaker} from '../components/bakeSkin';

export const FUTURE100_DURATION = 450;
const NUM = loadAnton('normal', {ignoreTooManyRequestsWarning: true}).fontFamily;
const SC = loadSC('normal', {weights: ['700'], ignoreTooManyRequestsWarning: true}).fontFamily;

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
type V3 = [number, number, number];

// ── 各站位置 ──
const PHONE: V3 = [0, 0, 0];
const HOME: V3 = [0, -0.6, -20];
const LAB: V3 = [0, 1, -40];
const CITY: V3 = [0, -3, -78];
const SPACE: V3 = [0, 0, -125];
const GATES: {year: string; pos: V3; color: string; at: number}[] = [
  {year: '2026', pos: [0, 0.4, -6], color: '#5ee7ff', at: 62},
  {year: '2035', pos: [0, 0.8, -29], color: '#7cf0a8', at: 152},
  {year: '2050', pos: [0, 1.4, -51], color: '#b48cff', at: 242},
  {year: '2080', pos: [0, 4.5, -95], color: '#ffc94d', at: 336},
];

// ── 镜头关键帧 ──
type Key = {f: number; pos: V3; look: V3};
const KEYS: Key[] = [
  {f: 0, pos: [-0.6, 0.35, 7.2], look: [0, 0.1, 0]},
  {f: 42, pos: [-0.3, 0.25, 5.4], look: [0, 0.1, 0]},
  {f: 70, pos: [0, 0.6, -8], look: [0, 0.4, -20]},
  {f: 82, pos: [2.6, 1.3, -14.5], look: [0, 0.4, -20]},
  {f: 140, pos: [1.7, 1.3, -15.4], look: [0, 0.5, -20]},
  {f: 160, pos: [0, 1.0, -31], look: [0, 1, -40]},
  {f: 172, pos: [2.6, 1.3, -35], look: [0, 1, -40]},
  {f: 230, pos: [-1.8, 1.7, -35.6], look: [0, 1.1, -40]},
  {f: 250, pos: [0, 2.2, -53], look: [0, -1.5, -70]},
  {f: 262, pos: [0, 4.5, -60], look: [0, -2.5, -78]},
  {f: 322, pos: [5, 6.5, -70], look: [0, -2.5, -84]},
  {f: 345, pos: [0, 5.5, -98], look: [0, 1, -125]},
  {f: 400, pos: [0, 3.6, -105], look: [0, 0.5, -128]},
  {f: 449, pos: [0, 4.2, -101], look: [0, 1.5, -132]},
];
const cameraAt = (f: number) => {
  let i = 0;
  while (i < KEYS.length - 2 && f > KEYS[i + 1].f) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = ease((f - a.f) / (b.f - a.f));
  const m = (x: V3, y: V3) => x.map((v, k) => v + (y[k] - v) * t) as V3;
  return {position: m(a.pos, b.pos), lookAt: m(a.look, b.look), fov: 42};
};

// ── 工具：字体就绪后再画 canvas 贴图 ──
const useFontsReady = () => {
  const [ok, setOk] = useState(false);
  const [h] = useState(() => delayRender('字体'));
  useEffect(() => {
    Promise.all([document.fonts.load(`400 200px ${NUM}`), document.fonts.load(`700 60px ${SC}`)]).then(() => document.fonts.ready).then(() => {
      setOk(true);
      continueRender(h);
    });
  }, [h]);
  return ok;
};
const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};
const glowTex = (color: string) =>
  canvasTex(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, color);
    r.addColorStop(0.35, color + '88');
    r.addColorStop(1, color + '00');
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
  });

// ── 年份门：发光圆环 + 大号年份 ──
const Gate: React.FC<{year: string; pos: V3; color: string; at: number}> = ({year, pos, color, at}) => {
  const frame = useCurrentFrame();
  const tex = useMemo(
    () =>
      canvasTex(1024, 360, (g) => {
        g.font = `400 300px ${NUM}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.shadowColor = color;
        g.shadowBlur = 40;
        g.fillStyle = '#ffffff';
        g.fillText(year, 512, 190);
      }),
    [year, color],
  );
  // 穿过时闪一下
  const flash = Math.max(0, 1 - Math.abs(frame - at) / 8);
  const col = new THREE.Color(color).multiplyScalar(1.6 + flash * 3);
  return (
    <group position={pos}>
      <mesh>
        <torusGeometry args={[3.2, 0.06, 16, 160]} />
        <meshBasicMaterial color={col} toneMapped={false} />
      </mesh>
      <mesh>
        <torusGeometry args={[3.45, 0.015, 8, 160]} />
        <meshBasicMaterial color={col} toneMapped={false} transparent opacity={0.6} />
      </mesh>
      {/* 年份：挂在门的上方 */}
      <mesh position={[0, 2.1, 0.05]}>
        <planeGeometry args={[3.4, 3.4 * (360 / 1024)]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} color={new THREE.Color(1.3, 1.3, 1.3)} depthWrite={false} />
      </mesh>
      {/* 门里一层很淡的光膜 */}
      <mesh>
        <circleGeometry args={[3.2, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.04 + flash * 0.35} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

// ── 时间隧道：沿路径的光环 + 星尘 ──
const Tunnel: React.FC = () => {
  const frame = useCurrentFrame();
  const dust = useMemo(() => {
    const n = 1800;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = random(`d${i}`) * Math.PI * 2;
      const r = 4 + random(`r${i}`) * 26;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.sin(a) * r * 0.7 + 2;
      pos[i * 3 + 2] = 10 - random(`z${i}`) * 160;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const tex = useMemo(() => glowTex('#9fd8ff'), []);
  return (
    <group>
      <points geometry={dust}>
        <pointsMaterial map={tex} size={0.22} sizeAttenuation transparent opacity={0.8} depthWrite={false} blending={THREE.AdditiveBlending} color="#bfe6ff" />
      </points>
      {/* 门与门之间的细光环，镜头穿过时有速度感 */}
      {Array.from({length: 26}, (_, i) => {
        const z = -8 - i * 3.4;
        const pulse = 0.5 + 0.5 * Math.sin(frame / 6 - i * 0.7);
        return (
          <mesh key={i} position={[0, 0.5 + i * 0.08, z]}>
            <torusGeometry args={[5.5 + (i % 3) * 0.4, 0.008, 6, 120]} />
            <meshBasicMaterial color="#4f8bff" transparent opacity={0.12 + pulse * 0.12} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
};

// ── 2026：手机和对话气泡 ──
const Phone: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const screen = useMemo(
    () =>
      canvasTex(540, 1120, (g) => {
        const grd = g.createLinearGradient(0, 0, 0, 1120);
        grd.addColorStop(0, '#0d1b3a');
        grd.addColorStop(1, '#162a55');
        g.fillStyle = grd;
        g.fillRect(0, 0, 540, 1120);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.beginPath();
        g.roundRect(200, 40, 140, 30, 15);
        g.fill();
      }),
    [],
  );
  const bubbles: {y: number; w: number; me: boolean; at: number}[] = [
    {y: 0.95, w: 0.95, me: true, at: 6},
    {y: 0.45, w: 1.25, me: false, at: 18},
    {y: -0.05, w: 0.75, me: true, at: 30},
    {y: -0.55, w: 1.3, me: false, at: 40},
  ];
  return (
    <group position={PHONE} rotation={[0, 0.12 - frame * 0.002, 0]}>
      <RoundedBox args={[1.9, 3.8, 0.16]} radius={0.22} smoothness={6}>
        <meshStandardMaterial color="#14161c" metalness={0.8} roughness={0.25} />
      </RoundedBox>
      <mesh position={[0, 0, 0.082]}>
        <planeGeometry args={[1.72, 3.6]} />
        <meshBasicMaterial map={screen} toneMapped={false} />
      </mesh>
      {bubbles.map((b, i) => {
        const s = spring({frame: frame - b.at, fps, config: {damping: 12, stiffness: 180}});
        const x = b.me ? 0.78 - b.w / 2 : -0.78 + b.w / 2;
        const col = b.me ? '#3d8bff' : '#e9eef8';
        return (
          <group key={i} position={[x, b.y, 0.1 + s * 0.12]} scale={Math.max(0.001, s)}>
            <RoundedBox args={[b.w, 0.36, 0.05]} radius={0.16} smoothness={4}>
              <meshStandardMaterial color={col} emissive={col} emissiveIntensity={b.me ? 0.6 : 0.25} roughness={0.4} />
            </RoundedBox>
            {/* 「正在输入」的三个点 / 文字条 */}
            {[0, 1, 2].map((k) => (
              <mesh key={k} position={[-b.w / 2 + 0.2 + k * ((b.w - 0.4) / 2.6), 0, 0.03]}>
                <boxGeometry args={[(b.w - 0.4) / 3.2, 0.06, 0.01]} />
                <meshBasicMaterial color={b.me ? '#dce9ff' : '#7d8aa6'} />
              </mesh>
            ))}
          </group>
        );
      })}
      <pointLight position={[0, 0, 1.2]} intensity={3} distance={5} color="#6fa8ff" />
    </group>
  );
};

// ── 2035：家和机器人 ──
const useRobot = () => {
  const [g, setG] = useState<{scene: THREE.Group; animations: THREE.AnimationClip[]} | null>(null);
  const [h] = useState(() => delayRender('机器人'));
  useEffect(() => {
    new GLTFLoader().load(staticFile('models/RobotExpressive.glb'), (gl) => {
      setG({scene: gl.scene, animations: gl.animations});
      continueRender(h);
    });
  }, [h]);
  return g;
};
const Robot: React.FC<{gltf: {scene: THREE.Group; animations: THREE.AnimationClip[]}; clip: string; pos: V3; rotY: number; offset?: number}> = ({gltf, clip, pos, rotY, offset = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {root, mixer, bake} = useMemo(() => {
    const r = SkeletonUtils.clone(gltf.scene) as THREE.Group;
    r.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.frustumCulled = false;
        m.castShadow = true;
      }
    });
    const mx = new THREE.AnimationMixer(r);
    const a = gltf.animations.find((x) => x.name === clip);
    if (a) mx.clipAction(a).play();
    return {root: r, mixer: mx, bake: makeSkinBaker(r)};
  }, [gltf, clip]);
  mixer.setTime((frame + offset) / fps);
  bake();
  return (
    <group position={pos} rotation={[0, rotY, 0]} scale={0.26}>
      <primitive object={root} />
    </group>
  );
};

const Home: React.FC<{robot: {scene: THREE.Group; animations: THREE.AnimationClip[]} | null}> = ({robot}) => {
  const frame = useCurrentFrame();
  const steam = useMemo(() => glowTex('#ffffff'), []);
  const [x, y, z] = HOME;
  return (
    <group position={[x, y, z]}>
      {/* 地板 + 地毯 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[4.2, 64]} />
        <meshStandardMaterial color="#3a2a22" roughness={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.3, 0.005, 0.4]}>
        <circleGeometry args={[1.8, 64]} />
        <meshStandardMaterial color="#c9a27a" roughness={1} />
      </mesh>
      {/* 沙发 */}
      <group position={[-1.6, 0, -1.3]} rotation={[0, 0.5, 0]}>
        <RoundedBox args={[2.2, 0.45, 0.9]} radius={0.12} position={[0, 0.3, 0]}>
          <meshStandardMaterial color="#5b6fa8" roughness={0.9} />
        </RoundedBox>
        <RoundedBox args={[2.2, 0.75, 0.25]} radius={0.1} position={[0, 0.65, -0.35]}>
          <meshStandardMaterial color="#4f6299" roughness={0.9} />
        </RoundedBox>
      </group>
      {/* 茶几 + 咖啡杯（冒热气） */}
      <RoundedBox args={[1.2, 0.08, 0.7]} radius={0.03} position={[0.9, 0.45, 0.2]}>
        <meshStandardMaterial color="#d8c3a5" roughness={0.5} />
      </RoundedBox>
      {[[0.75, 0.2], [1.1, 0.35]].map(([cx, cz], i) => (
        <mesh key={i} position={[cx, 0.56, cz]}>
          <cylinderGeometry args={[0.06, 0.05, 0.14, 24]} />
          <meshStandardMaterial color="#f4f1ea" roughness={0.3} />
        </mesh>
      ))}
      {[0, 1, 2].map((k) => {
        const t = ((frame / 40 + k / 3) % 1);
        return (
          <sprite key={k} position={[0.75 + Math.sin(t * 6 + k) * 0.03, 0.7 + t * 0.5, 0.2]} scale={[0.18 + t * 0.2, 0.18 + t * 0.2, 1]}>
            <spriteMaterial map={steam} transparent opacity={0.35 * (1 - t)} depthWrite={false} />
          </sprite>
        );
      })}
      {/* 叠好的一摞衣服 */}
      {['#e85d75', '#f2c14e', '#5ec2b7', '#f4f1ea'].map((c, i) => (
        <RoundedBox key={c} args={[0.5, 0.07, 0.38]} radius={0.03} position={[1.3, 0.53 + i * 0.075, -0.05]} rotation={[0, (i % 2) * 0.08, 0]}>
          <meshStandardMaterial color={c} roughness={0.9} />
        </RoundedBox>
      ))}
      {/* 落地灯 */}
      <mesh position={[2.2, 0.9, -1.2]}>
        <cylinderGeometry args={[0.02, 0.02, 1.8, 8]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[2.2, 1.85, -1.2]}>
        <coneGeometry args={[0.3, 0.35, 32, 1, true]} />
        <meshStandardMaterial color="#ffe2b0" emissive="#ffcc80" emissiveIntensity={1.4} side={THREE.DoubleSide} />
      </mesh>
      <pointLight position={[2.2, 1.6, -1.2]} intensity={12} distance={8} color="#ffcf8a" />
      <pointLight position={[0, 2.6, 1.8]} intensity={6} distance={8} color="#ffe9cc" />
      {/* 机器人：一个在端咖啡（点头），一个在旁边挥手 */}
      {robot && <Robot gltf={robot} clip="Yes" pos={[0.1, 0, 0.6]} rotY={0.6} />}
      {robot && <Robot gltf={robot} clip="Wave" pos={[-0.9, 0, 0.1]} rotY={0.9} offset={10} />}
    </group>
  );
};

// ── 2050：AI 科学家：DNA 双螺旋自动组装 + 分子 + 试管 ──
const Lab: React.FC = () => {
  const frame = useCurrentFrame();
  const t0 = 160;
  const N = 34;
  const dna = useMemo(() => {
    const pts: {a: THREE.Vector3; b: THREE.Vector3; fromA: THREE.Vector3; fromB: THREE.Vector3}[] = [];
    for (let i = 0; i < N; i++) {
      const y = (i - N / 2) * 0.12;
      const ang = i * 0.42;
      const a = new THREE.Vector3(Math.cos(ang) * 0.55, y, Math.sin(ang) * 0.55);
      const b = new THREE.Vector3(Math.cos(ang + Math.PI) * 0.55, y, Math.sin(ang + Math.PI) * 0.55);
      const rf = (k: string) => new THREE.Vector3((random(`${k}x${i}`) - 0.5) * 7, (random(`${k}y${i}`) - 0.5) * 5, (random(`${k}z${i}`) - 0.5) * 5);
      pts.push({a, b, fromA: rf('a'), fromB: rf('b')});
    }
    return pts;
  }, []);
  const [x, y, z] = LAB;
  const spin = frame * 0.02;
  const colA = new THREE.Color('#5ee7ff').multiplyScalar(1.6);
  const colB = new THREE.Color('#ff7ad9').multiplyScalar(1.6);
  return (
    <group position={[x, y, z]}>
      <group rotation={[0, spin, 0.25]} position={[-0.6, 0.2, 0]}>
        {dna.map((p, i) => {
          const t = ease(clamp01((frame - t0 - i * 1.1) / 22));
          const pa = p.fromA.clone().lerp(p.a, t);
          const pb = p.fromB.clone().lerp(p.b, t);
          const mid = pa.clone().add(pb).multiplyScalar(0.5);
          const len = pa.distanceTo(pb);
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pb.clone().sub(pa).normalize());
          return (
            <group key={i}>
              <mesh position={pa}>
                <sphereGeometry args={[0.07, 16, 16]} />
                <meshBasicMaterial color={colA} toneMapped={false} />
              </mesh>
              <mesh position={pb}>
                <sphereGeometry args={[0.07, 16, 16]} />
                <meshBasicMaterial color={colB} toneMapped={false} />
              </mesh>
              {t > 0.92 && (
                <mesh position={mid} quaternion={q}>
                  <cylinderGeometry args={[0.012, 0.012, len, 6]} />
                  <meshBasicMaterial color="#cfd8ff" transparent opacity={(t - 0.92) / 0.08 * 0.7} />
                </mesh>
              )}
            </group>
          );
        })}
      </group>
      {/* 两个旋转的药物分子（球棍模型） */}
      {[[1.9, 0.9, -0.6, 1], [1.6, -0.9, 0.5, -1]].map(([mx, my, mz, dir], k) => (
        <group key={k} position={[mx, my, mz]} rotation={[frame * 0.015 * dir, frame * 0.02 * dir, 0]}>
          {Array.from({length: 7}, (_, i) => {
            const v = new THREE.Vector3(random(`m${k}${i}x`) - 0.5, random(`m${k}${i}y`) - 0.5, random(`m${k}${i}z`) - 0.5).normalize().multiplyScalar(i === 0 ? 0 : 0.42);
            const col = ['#ff6b6b', '#f4f1ea', '#5ee7ff', '#ffd166'][i % 4];
            const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize());
            return (
              <group key={i}>
                <mesh position={v}>
                  <sphereGeometry args={[i === 0 ? 0.13 : 0.09, 20, 20]} />
                  <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.35} roughness={0.3} metalness={0.1} />
                </mesh>
                {i > 0 && (
                  <mesh position={v.clone().multiplyScalar(0.5)} quaternion={q}>
                    <cylinderGeometry args={[0.02, 0.02, 0.42, 8]} />
                    <meshStandardMaterial color="#aab4cc" />
                  </mesh>
                )}
              </group>
            );
          })}
        </group>
      ))}
      {/* 一排试管，依次亮起（实验自动完成） */}
      {Array.from({length: 7}, (_, i) => {
        const lit = clamp01((frame - (t0 + 20 + i * 6)) / 8);
        const c = new THREE.Color('#7cf0a8').multiplyScalar(0.4 + lit * 1.6);
        return (
          <group key={i} position={[-1.8 + i * 0.42, -1.55, 1.1]}>
            <mesh>
              <cylinderGeometry args={[0.1, 0.1, 0.7, 20, 1, true]} />
              <meshStandardMaterial color="#cfe9ff" transparent opacity={0.25} roughness={0.05} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, -0.12, 0]}>
              <cylinderGeometry args={[0.085, 0.085, 0.42, 20]} />
              <meshBasicMaterial color={c} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[-0.55, -1.95, 1.1]}>
        <boxGeometry args={[3.4, 0.08, 0.5]} />
        <meshStandardMaterial color="#2a2f45" metalness={0.6} roughness={0.3} />
      </mesh>
      <pointLight position={[0, 1.5, 2.5]} intensity={8} distance={8} color="#c9b5ff" />
    </group>
  );
};

// ── 2080：自己运转的城市 + 空中车流 ──
const windowTex = () =>
  canvasTex(64, 256, (g) => {
    g.fillStyle = '#0b1020';
    g.fillRect(0, 0, 64, 256);
    for (let yy = 6; yy < 256; yy += 12) {
      for (let xx = 6; xx < 64; xx += 14) {
        const on = random(`w${xx}-${yy}`) > 0.35;
        g.fillStyle = on ? (random(`c${xx}-${yy}`) > 0.7 ? '#9fe7ff' : '#ffd79a') : '#1a2236';
        g.fillRect(xx, yy, 8, 6);
      }
    }
  });
const City: React.FC = () => {
  const frame = useCurrentFrame();
  const G = 13;
  const {mesh, curves} = useMemo(() => {
    const tex = windowTex();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const mat = new THREE.MeshStandardMaterial({map: tex, emissiveMap: tex, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.1, roughness: 0.6, metalness: 0.3, color: '#8090b0'});
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, G * G);
    const o = new THREE.Object3D();
    let k = 0;
    for (let i = 0; i < G; i++) {
      for (let j = 0; j < G; j++) {
        const cx = (i - (G - 1) / 2) * 1.5;
        const cz = (j - (G - 1) / 2) * 1.5;
        const d = Math.hypot(cx, cz);
        const h = 0.6 + random(`h${i}-${j}`) * (4.5 - d * 0.22) + (d < 3 ? 2.5 : 0);
        o.position.set(cx, Math.max(0.6, h) / 2, cz);
        o.scale.set(0.9, Math.max(0.6, h), 0.9);
        o.updateMatrix();
        m.setMatrixAt(k++, o.matrix);
      }
    }
    m.frustumCulled = false;
    // 空中车道：几条在楼宇之间盘旋的闭合曲线
    const cs = Array.from({length: 5}, (_, c) => {
      const r = 3 + c * 1.6;
      const hgt = 3.2 + c * 0.7;
      return new THREE.CatmullRomCurve3(
        Array.from({length: 8}, (_, a) => {
          const ang = (a / 8) * Math.PI * 2 + c;
          return new THREE.Vector3(Math.cos(ang) * r, hgt + Math.sin(ang * 2 + c) * 0.5, Math.sin(ang) * r * 0.8);
        }),
        true,
      );
    });
    return {mesh: m, curves: cs};
  }, []);
  const [x, y, z] = CITY;
  return (
    <group position={[x, y, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#070b16" roughness={0.6} metalness={0.4} />
      </mesh>
      {/* 地面的光网格（道路） */}
      <gridHelper args={[20, 13, '#1f4a7a', '#1f4a7a']} position={[0, 0.01, 0]} />
      <primitive object={mesh} />
      {curves.map((c, i) => (
        <group key={i}>
          <mesh>
            <tubeGeometry args={[c, 200, 0.012, 6, true]} />
            <meshBasicMaterial color={i % 2 ? '#5ee7ff' : '#ffc94d'} transparent opacity={0.35} toneMapped={false} />
          </mesh>
          {Array.from({length: 6}, (_, k) => {
            const u = (frame * (0.004 + i * 0.0007) + k / 6) % 1;
            const p = c.getPointAt(u);
            const tan = c.getTangentAt(u);
            const col = new THREE.Color(i % 2 ? '#bff4ff' : '#ffe2a0').multiplyScalar(2.2);
            return (
              <mesh key={k} position={p} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan)}>
                <boxGeometry args={[0.12, 0.06, 0.32]} />
                <meshBasicMaterial color={col} toneMapped={false} />
              </mesh>
            );
          })}
        </group>
      ))}
      <pointLight position={[0, 8, 4]} intensity={30} distance={25} color="#9fb8ff" />
    </group>
  );
};

// ── 2126：地球 + 驶向远方的飞船 + 「？」 ──
const earthTex = () =>
  canvasTex(1024, 512, (g) => {
    g.fillStyle = '#0a2a5c';
    g.fillRect(0, 0, 1024, 512);
    // 程序生成的「大陆」+ 城市灯光
    for (let i = 0; i < 2600; i++) {
      const x = random(`ex${i}`) * 1024;
      const y = 60 + random(`ey${i}`) * 392;
      const n = Math.sin(x * 0.011) * Math.cos(y * 0.017) + Math.sin(x * 0.004 + y * 0.009) * 0.8;
      if (n > 0.35) {
        g.fillStyle = '#1f5a3a';
        g.fillRect(x, y, 14, 10);
        if (random(`el${i}`) > 0.55) {
          g.fillStyle = '#ffd79a';
          g.fillRect(x + 4, y + 3, 3, 3);
        }
      }
    }
  });
const Space: React.FC<{fontsReady: boolean}> = ({fontsReady}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const tex = useMemo(earthTex, []);
  const atmo = useMemo(() => glowTex('#5ec8ff'), []);
  const engine = useMemo(() => glowTex('#9fe7ff'), []);
  const q = useMemo(
    () =>
      canvasTex(512, 512, (g) => {
        g.font = `400 440px ${fontsReady ? NUM : 'sans-serif'}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.shadowColor = '#ffc94d';
        g.shadowBlur = 50;
        g.fillStyle = '#fff4d6';
        g.fillText('?', 256, 280);
      }),
    [fontsReady],
  );
  const year = useMemo(
    () =>
      canvasTex(1024, 360, (g) => {
        g.font = `400 300px ${fontsReady ? NUM : 'sans-serif'}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.shadowColor = '#ffffff';
        g.shadowBlur = 40;
        g.fillStyle = '#ffffff';
        g.fillText('2126', 512, 190);
      }),
    [fontsReady],
  );
  const [x, y, z] = SPACE;
  // 飞船：从镜头附近出发，沿弧线飞向远方
  const st = clamp01((frame - 350) / 95);
  const shipPos = new THREE.Vector3(1.8 - st * 3.5, 2.4 + st * 2.2, 14 - ease(st) * 30);
  const qIn = spring({frame: frame - 405, fps, config: {damping: 14, stiffness: 90}});
  const yIn = clamp01((frame - 338) / 14) * (1 - clamp01((frame - 395) / 12));
  return (
    <group position={[x, y, z]}>
      {/* 地球 */}
      <group position={[0, -7.5, 0]} rotation={[0.35, frame * 0.004, 0]}>
        <mesh>
          <sphereGeometry args={[7, 96, 96]} />
          <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.35} roughness={0.8} />
        </mesh>
      </group>
      <sprite position={[0, -7.5, 0]} scale={[17.5, 17.5, 1]}>
        <spriteMaterial map={atmo} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <directionalLight position={[8, 6, 6]} intensity={2.2} color="#ffffff" />
      {/* 飞船 */}
      <group position={shipPos} rotation={[0.15, 0.25, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.28, 1.4, 24]} />
          <meshStandardMaterial color="#e8ecf5" metalness={0.7} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0, 0.75]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.28, 0.32, 0.5, 24]} />
          <meshStandardMaterial color="#aab4cc" metalness={0.8} roughness={0.3} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.45, 0, 0.75]} rotation={[0, 0, s * 0.2]}>
            <boxGeometry args={[0.5, 0.04, 0.5]} />
            <meshStandardMaterial color="#5ee7ff" emissive="#5ee7ff" emissiveIntensity={0.6} metalness={0.5} />
          </mesh>
        ))}
        <sprite position={[0, 0, 1.15]} scale={[1.4, 1.4, 1]}>
          <spriteMaterial map={engine} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
        {/* 尾迹 */}
        {Array.from({length: 10}, (_, k) => (
          <sprite key={k} position={[0, -k * 0.06, 1.3 + k * 0.45]} scale={[0.9 - k * 0.07, 0.9 - k * 0.07, 1]}>
            <spriteMaterial map={engine} transparent opacity={0.5 - k * 0.045} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        ))}
      </group>
      {/* 年份 2126（进入太空时浮现，之后让位给「？」） */}
      <mesh position={[0, 5.5, -6]}>
        <planeGeometry args={[7, 7 * (360 / 1024)]} />
        <meshBasicMaterial map={year} transparent opacity={yIn} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh position={[0, 3.2, -8]} scale={Math.max(0.001, qIn)}>
        <planeGeometry args={[4.2, 4.2]} />
        <meshBasicMaterial map={q} transparent toneMapped={false} color={new THREE.Color(1.4, 1.3, 1.1)} depthWrite={false} />
      </mesh>
    </group>
  );
};

export const Future100: React.FC = () => {
  const frame = useCurrentFrame();
  const fontsReady = useFontsReady();
  const robot = useRobot();
  const cam = cameraAt(frame);
  return (
    <AbsoluteFill style={{backgroundColor: '#03040a'}}>
      <ScienceScene lighting="space" cameraPose={cam} lookAt={cam.lookAt} ground={false} particles={false} post bloom={1.0}>
        <fog attach="fog" args={['#03040a', 16, 48]} />
        <ambientLight intensity={0.35} />
        <Tunnel />
        {fontsReady && GATES.map((g) => <Gate key={g.year} {...g} />)}
        {frame < 110 && <Phone />}
        {frame > 40 && frame < 200 && <Home robot={robot} />}
        {frame > 130 && frame < 290 && <Lab />}
        {frame > 220 && frame < 380 && <City />}
        {frame > 300 && <Space fontsReady={fontsReady} />}
      </ScienceScene>
    </AbsoluteFill>
  );
};
