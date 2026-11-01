// 「AI 前沿」3D 版样片（5 秒）：按 Remotion 官方 skill 的 3D 写法（@remotion/three + React Three Fiber），
// 所有动画都由当前帧驱动。画面：深蓝紫渐变 + 霓虹透视网格地面 + 光粒子；
// 「5 小时」做成 5 段发光圆环，说到「没了」时炸开（冲击波 + 碎片 + 闪白）；
// 镜头冲刺穿过光速线进入下一段；玻璃卡片在空间里漂浮；说到 200 美元时金币从天而降。
import React, { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, Audio, random, staticFile, useVideoConfig, interpolate } from "remotion";
import { Code, Lightning, Rocket, Timer } from "@phosphor-icons/react";
import { Header, v2 } from "../v2/Style";
import { Captions, Count, Headline, SfxAt, Stamp, kf, sp, tween, useNow } from "../motion/MotionSample";

const C = { cyan: "#38bdf8", violet: "#8b5cf6", pink: "#ec4899", gold: "#f5b83d", fog: "#080a24" };

// 0→1→0 的钟形包络，用于短暂效果（冲刺、闪光）
const bell = (now: number, a: number, b: number) => (now <= a || now >= b ? 0 : Math.sin(((now - a) / (b - a)) * Math.PI));
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// ── 镜头：缓慢推进 + 轻微环绕；「没了」震一下；冲刺时 FOV 拉大 ──
const Rig: React.FC = () => {
  const { camera } = useThree();
  const now = useNow();
  const shake = kf(now, 1.44, [0, 0.16, -0.13, 0.08, -0.04, 0], 0.45);
  const warp = bell(now, 1.84, 2.5);
  const cam = camera as THREE.PerspectiveCamera;
  cam.fov = 50 + warp * 28;
  cam.updateProjectionMatrix();
  const z = 9 - now * 0.25 - tween(now, 1.84, 0.6, 0, 1.2);
  camera.position.set(Math.sin(now * 0.6) * 0.35 + shake, 2.6 + shake * 0.6, z);
  camera.lookAt(0, 2.2, z - 9);
  return null;
};

// ── 霓虹网格地面：向镜头滚动，冲刺时加速 ──
const Floor: React.FC = () => {
  const now = useNow();
  const offset = now * 1.4 + tween(now, 1.84, 0.7, 0, 14);
  return (
    <group position={[0, 0, (offset % 2) - 20]}>
      <gridHelper args={[160, 80, C.pink, C.cyan]} position={[0, 0, 0]}>
        <lineBasicMaterial attach="material" color={C.cyan} transparent opacity={0.55} />
      </gridHelper>
    </group>
  );
};

// 远处地平线的光晕（用代码画一张径向渐变贴图）
const Horizon: React.FC = () => {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, "rgba(236,72,153,0.9)");
    grd.addColorStop(0.35, "rgba(139,92,246,0.45)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }, []);
  return (
    <mesh position={[0, 2, -70]}>
      <planeGeometry args={[150, 60]} />
      <meshBasicMaterial map={tex} transparent blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
    </mesh>
  );
};

// ── 漂浮的光粒子 ──
const Particles: React.FC = () => {
  const now = useNow();
  const N = 500;
  const base = useMemo(() => {
    const a = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      a[i * 3] = (random(`px${i}`) - 0.5) * 30;
      a[i * 3 + 1] = random(`py${i}`) * 12;
      a[i * 3 + 2] = -random(`pz${i}`) * 50 + 8;
    }
    return a;
  }, []);
  const pos = useMemo(() => new Float32Array(N * 3), []);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = base[i * 3] + Math.sin(now * 0.7 + i) * 0.15;
    pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(now * 0.5 + i * 1.7) * 0.2;
    pos[i * 3 + 2] = ((base[i * 3 + 2] + 42 + now * 1.2 + tween(now, 1.84, 0.7, 0, 20)) % 50) - 42;
  }
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.07} color={C.cyan} transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
    </points>
  );
};

// ── 「5 小时」圆环：5 段依次点亮，「没了」时炸开 ──
const SEG = 5;
const BOOM = 1.44;
const ClockRing: React.FC = () => {
  const now = useNow();
  if (now > 2.6) return null;
  const arc = ((Math.PI * 2) / SEG) * 0.84;
  const boom = clamp01((now - BOOM) / 0.9);
  const boomEase = 1 - Math.pow(1 - boom, 3);
  const wave = clamp01((now - BOOM) / 0.6);
  return (
    <group position={[0, 2.25, 0]} rotation={[0, 0, now * 0.15]}>
      {Array.from({ length: SEG }).map((_, i) => {
        const mid = Math.PI / 2 - (i + 0.5) * ((Math.PI * 2) / SEG);
        const on = sp(now, 0.1 + i * 0.24, 0, 1, { stiffness: 380, damping: 14 });
        const dir = [Math.cos(mid), Math.sin(mid)];
        const fly = boomEase * 5;
        const op = 1 - boom;
        return (
          <group key={i} position={[dir[0] * fly * 1.4, dir[1] * fly * 1.4, boomEase * 0.8]} rotation={[boomEase * (i % 2 ? 4 : -3), boomEase * 2, Math.PI / 2 - (i + 1) * ((Math.PI * 2) / SEG) + ((Math.PI * 2) / SEG) * 0.08]} scale={0.6 + on * 0.4}>
            <mesh>
              <torusGeometry args={[1.6, 0.075, 16, 64, arc]} />
              <meshBasicMaterial color="#fff3d6" transparent opacity={op * clamp01(on * 1.5)} toneMapped={false} />
            </mesh>
            <mesh>
              <torusGeometry args={[1.6, 0.26, 16, 64, arc]} />
              <meshBasicMaterial color={C.gold} transparent opacity={0.35 * on * op} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
      {/* 冲击波 */}
      {now >= BOOM && (
        <mesh scale={1 + wave * 5}>
          <ringGeometry args={[1.5, 1.62, 96]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={(1 - wave) * 0.9} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* 碎片 */}
      {now >= BOOM &&
        Array.from({ length: 46 }).map((_, i) => {
          const a = random(`sa${i}`) * Math.PI * 2;
          const d = (2 + random(`sd${i}`) * 6) * boomEase + 1.6;
          const s = 0.05 + random(`ss${i}`) * 0.12;
          return (
            <mesh key={i} position={[Math.cos(a) * d, Math.sin(a) * d, boomEase * random(`sz${i}`) * 5]} rotation={[now * 6 + i, now * 4, 0]} scale={s * (1 - boom * 0.6)}>
              <tetrahedronGeometry args={[1, 0]} />
              <meshBasicMaterial color={i % 3 ? C.gold : "#ffffff"} transparent opacity={1 - boom} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
          );
        })}
    </group>
  );
};

// 地面冲击波
const FloorWave: React.FC = () => {
  const now = useNow();
  if (now < BOOM || now > BOOM + 1) return null;
  const w = clamp01((now - BOOM) / 0.9);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={1 + w * 14}>
      <ringGeometry args={[0.9, 1, 96]} />
      <meshBasicMaterial color={C.cyan} transparent opacity={(1 - w) * 0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
};

// ── 冲刺：光速线 ──
const Warp: React.FC = () => {
  const now = useNow();
  const w = bell(now, 1.8, 2.55);
  if (w <= 0) return null;
  return (
    <group>
      {Array.from({ length: 140 }).map((_, i) => {
        const a = random(`wa${i}`) * Math.PI * 2;
        const r = 0.8 + random(`wr${i}`) * 5;
        const z = ((random(`wz${i}`) * 60 + (now - 1.8) * 90) % 60) - 52;
        return (
          <mesh key={i} position={[Math.cos(a) * r, 2.2 + Math.sin(a) * r, z]}>
            <boxGeometry args={[0.02, 0.02, 3 + w * 6]} />
            <meshBasicMaterial color={i % 4 ? C.cyan : C.pink} transparent opacity={w} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
};

// ── 玻璃卡片：在空间里漂浮，第二段从远处飞入 ──
const Slabs: React.FC = () => {
  const now = useNow();
  if (now < 1.9) return null;
  const slabs = [
    [-2.2, 3.6, -3],
    [2.3, 3.1, -4],
    [-1.6, 1.2, -2],
    [2.0, 1.0, -1.5],
    [0.2, 4.4, -6],
    [-3.2, 2.2, -7],
  ];
  return (
    <group>
      {slabs.map(([x, y, z], i) => {
        const at = 1.95 + i * 0.07;
        const zz = sp(now, at, -40, z, { stiffness: 120, damping: 16 });
        const fade = 1 - tween(now, 3.55 + i * 0.03, 0.4, 0, 0.75);
        return (
          <group key={i} position={[x, y + Math.sin(now * 1.3 + i) * 0.12, zz]} rotation={[Math.sin(now * 0.8 + i) * 0.25, (x > 0 ? -0.5 : 0.5) + Math.sin(now * 0.6 + i) * 0.2, 0]}>
            <mesh>
              <boxGeometry args={[1.5, 0.95, 0.04]} />
              <meshPhysicalMaterial color="#9cc9ff" transparent opacity={0.16 * fade} roughness={0.1} metalness={0.2} clearcoat={1} />
            </mesh>
            <lineSegments>
              <edgesGeometry args={[new THREE.BoxGeometry(1.5, 0.95, 0.04)]} />
              <lineBasicMaterial color={i % 2 ? C.cyan : C.violet} transparent opacity={0.9 * fade} />
            </lineSegments>
          </group>
        );
      })}
    </group>
  );
};

// ── 金币雨（说到 200 美元） ──
const Coins: React.FC = () => {
  const now = useNow();
  if (now < 3.68) return null;
  return (
    <group>
      {Array.from({ length: 26 }).map((_, i) => {
        const at = 3.7 + i * 0.035;
        const x = (random(`cx${i}`) - 0.5) * 6;
        const z = -1.5 - random(`cz${i}`) * 5;
        const y = sp(now, at, 9 + random(`cy${i}`) * 3, 0.05 + (i % 4) * 0.07, { stiffness: 160, damping: 9 });
        const spin = Math.max(0, now - at) * (6 + random(`cs${i}`) * 6);
        return (
          <mesh key={i} position={[x, y, z]} rotation={[Math.PI / 2 + Math.sin(spin) * 0.6, spin, 0]}>
            <cylinderGeometry args={[0.26, 0.26, 0.05, 48]} />
            <meshStandardMaterial color={C.gold} metalness={0.85} roughness={0.25} emissive="#b87400" emissiveIntensity={0.9} />
          </mesh>
        );
      })}
    </group>
  );
};

const Scene: React.FC = () => (
  <>
    <Rig />
    <fog attach="fog" args={[C.fog, 8, 55]} />
    <ambientLight intensity={0.6} />
    <pointLight position={[-4, 5, 5]} intensity={80} color={C.cyan} />
    <pointLight position={[4, 4, 3]} intensity={80} color={C.pink} />
    <pointLight position={[0, 7, 6]} intensity={60} color="#fff1cc" />
    <Horizon />
    <Floor />
    <FloorWave />
    <Particles />
    <ClockRing />
    <Warp />
    <Slabs />
    <Coins />
  </>
);

// ── 2D 线条图标（Phosphor）做成玻璃小方块，第二段依次弹出 ──
const Chips: React.FC<{ now: number }> = ({ now }) => {
  if (now < 2.8 || now > 4.1) return null;
  const icons = [Lightning, Code, Timer, Rocket];
  const out = tween(now, 3.55, 0.35, 0, 1);
  return (
    <div style={{ position: "absolute", top: 820, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 34, opacity: 1 - out }}>
      {icons.map((I, i) => {
        const s = sp(now, 2.85 + i * 0.09, 0, 1, { stiffness: 420, damping: 12 });
        return (
          <div key={i} style={{ width: 132, height: 132, borderRadius: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.03))", border: "1.5px solid rgba(160,210,255,0.45)", boxShadow: "0 0 40px rgba(56,189,248,0.35), inset 0 1px 0 rgba(255,255,255,0.4)", backdropFilter: "blur(8px)", transform: `translateY(${Math.sin(now * 3 + i) * 8 - out * 120}px) scale(${s}) rotate(${(1 - s) * (i % 2 ? 30 : -30)}deg)` }}>
            <I size={70} weight="duotone" color={i % 2 ? C.cyan : "#c4b5fd"} />
          </div>
        );
      })}
    </div>
  );
};

export const FX3D_DURATION = 150;

export const Fx3D: React.FC = () => {
  const now = useNow();
  const { width, height, durationInFrames } = useVideoConfig();
  const flash = Math.max(0, 1 - (now - BOOM) / 0.25) * (now >= BOOM ? 0.55 : 0) + bell(now, 1.84, 2.0) * 0.12;
  const glow = "0 0 24px rgba(56,189,248,0.75), 0 0 60px rgba(139,92,246,0.55)";
  return (
    <AbsoluteFill style={{ fontFamily: v2.font, color: v2.white, background: "radial-gradient(120% 70% at 50% 8%, #3a1d7a 0%, #141a5c 38%, #070a22 70%, #03040c 100%)" }}>
      <ThreeCanvas width={width} height={height} camera={{ fov: 50, position: [0, 2.6, 9], near: 0.1, far: 200 }}>
        <Scene />
      </ThreeCanvas>
      {/* 暗角 */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.6) 100%)" }} />
      <Header date="2026.11.01" />
      <div style={{ textShadow: glow }}>
        <Headline now={now} exitAt={1.6} size={124} top={300} ws={[{ text: "Claude", at: 0 }, { text: "的", at: 0.32 }, { text: "5 小时", at: 0.5, hl: true }, { text: "限制", at: 1.05 }]} />
        <Stamp now={now} at={BOOM} leaveAt={1.62} />
        <Headline now={now} exitAt={3.6} size={170} top={360} ws={[{ text: "10.30", at: 2.05, gold: true }]} />
        <Headline now={now} exitAt={3.6} size={100} top={580} ws={[{ text: "Anthropic", at: 2.72 }, { text: "官宣", at: 3.2 }]} />
      </div>
      <Chips now={now} />
      {now >= 3.68 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 380, textAlign: "center", transform: `scale(${sp(now, 3.68, 0.4, 1, { stiffness: 300, damping: 12 })})` }}>
          <div style={{ fontSize: 40, color: "#c7d2fe", letterSpacing: 8 }}>顶配套餐 · 每月</div>
          <div style={{ fontSize: 260, fontWeight: 900, lineHeight: 1.05, letterSpacing: -4, background: "linear-gradient(180deg, #fff6d8 0%, #f5b83d 55%, #b86b00 100%)", WebkitBackgroundClip: "text", color: "transparent", filter: "drop-shadow(0 0 30px rgba(245,184,61,0.6))" }}>
            $<Count now={now} at={3.75} to={200} />
          </div>
        </div>
      )}
      <Captions now={now} />
      {/* 闪白 */}
      <AbsoluteFill style={{ background: "#fff", opacity: flash, mixBlendMode: "screen" }} />
      <Audio src={staticFile("frontier/2026-11-01/voice.mp3")} />
      <Audio src={staticFile("frontier/bgm.mp3")} volume={(f) => 0.13 * interpolate(f, [0, 10, durationInFrames - 15, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      <SfxAt at={1.44} src="frontier/pop.mp3" vol={0.8} />
      <SfxAt at={1.8} src="frontier/whoosh.mp3" vol={0.5} />
      <SfxAt at={3.62} src="frontier/whoosh.mp3" vol={0.35} />
      <SfxAt at={3.75} src="frontier/chime.mp3" vol={0.35} />
    </AbsoluteFill>
  );
};
