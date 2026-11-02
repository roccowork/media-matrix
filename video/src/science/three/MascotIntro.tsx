// 3D 样片（10 秒）：摄影棚舞台 + 吉祥物晓晓 + 关键词卡片。只用 three.js（@remotion/three），不用外部模型和收费服务。
// 舞台：深色渐变背景 + 雾 + 微反光的地面 + 金 / 青两盏轮廓光 + 远处虚化光斑；反射用 three.js 自带的程序化影棚环境（RoomEnvironment）。
// 调度：晓晓从上方落到台上（下落拉长、落地压扁回弹）→ 眨眼、挥手 → 身后错峰弹出关键词卡片 → 转头看卡片、高兴地蹦一下，
// 「Transformer」卡片点亮 → 镜头缓缓推近。所有动画由帧驱动。
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, continueRender, delayRender, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, EASE, FONT, clamp01, mix } from "../kit";
import { Mascot, type MascotPose } from "./Mascot";

export const MASCOT_INTRO_DURATION = 300;

const glowTex = (color: string) => {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, color);
  r.addColorStop(0.35, color + "88");
  r.addColorStop(1, color + "00");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
};

const useFonts = () => {
  const [ready, setReady] = useState(false);
  const [h] = useState(() => delayRender("字体"));
  useEffect(() => {
    document.fonts.load(`900 64px ${FONT}`).then(() => document.fonts.ready).then(() => { setReady(true); continueRender(h); });
  }, [h]);
  return ready;
};

const cardTex = (text: string, hot: boolean, ready: boolean) => {
  const c = document.createElement("canvas");
  c.width = 640; c.height = 280;
  const g = c.getContext("2d")!;
  g.fillStyle = hot ? "rgba(245,184,61,0.95)" : "rgba(236,241,255,0.94)";
  g.beginPath(); g.roundRect(8, 8, 624, 264, 56); g.fill();
  g.fillStyle = hot ? "#1a1204" : "#121a3a";
  g.font = `900 ${text.length > 6 ? 92 : 112}px ${ready ? FONT : "sans-serif"}`;
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, 320, 148);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
};

const WORDS = ["ChatGPT", "Claude", "Transformer", "注意力", "GPT-3"];
const CARD_POS: [number, number, number][] = [[-3.9, 2.8, -1.4], [-2.5, 4.5, -2.2], [0.3, 5.2, -2.6], [2.9, 4.4, -2.0], [4.1, 2.5, -1.2]];
const HOT = 2;

const Scene: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const { gl, scene, camera } = useThree();
  const ready = useFonts();
  // 舞台环境：渐变背景 + 雾 + 影棚反射
  useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 4; c.height = 512;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, "#0b1438"); grad.addColorStop(0.55, "#070c24"); grad.addColorStop(1, "#03050f");
    g.fillStyle = grad; g.fillRect(0, 0, 4, 512);
    const bg = new THREE.CanvasTexture(c); bg.colorSpace = THREE.SRGBColorSpace;
    scene.background = bg;
    scene.fog = new THREE.Fog("#050919", 14, 34);
    const pmrem = new THREE.PMREMGenerator(gl);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;
  }, [gl, scene]);
  const gold = useMemo(() => glowTex("#f5b83d"), []);
  const cyan = useMemo(() => glowTex("#5ee7ff"), []);
  const blue = useMemo(() => glowTex("#4a6bff"), []);
  const textures = useMemo(() => WORDS.map((w, i) => [cardTex(w, false, ready), cardTex(w, i === HOT, ready)]), [ready]);
  const bokeh = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ x: (random(`bx${i}`) - 0.5) * 30, y: random(`by${i}`) * 9 + 0.5, z: -9 - random(`bz${i}`) * 10, s: 0.6 + random(`bs${i}`) * 1.8, c: random(`bc${i}`) })), []);

  // ── 晓晓的动作 ──
  const LAND = 24;
  const fall = clamp01((frame - 8) / (LAND - 8));
  const land = spring({ frame: frame - LAND, fps, config: { damping: 7, stiffness: 180 } });
  const hopT = (frame - 196) / 22; // 高兴地蹦一下
  const hop = hopT > 0 && hopT < 1 ? Math.sin(hopT * Math.PI) : 0;
  const hopLand = spring({ frame: frame - 218, fps, config: { damping: 8, stiffness: 200 } });
  const pose: MascotPose = {
    y: frame < LAND ? mix(7, 0, fall * fall) : hop * 0.9,
    squash: frame < LAND ? -0.25 * fall : (1 - land) * 0.55 + (frame >= 218 ? (1 - hopLand) * 0.35 : 0) - hop * 0.15,
    blink: [46, 150, 262].reduce((b, t) => Math.max(b, frame >= t && frame < t + 6 ? Math.sin(((frame - t) / 6) * Math.PI) : 0), 0),
    wave: frame >= 60 && frame < 116 ? Math.sin(((frame - 60) / 56) * Math.PI * 3) * 0.55 * Math.sin(((frame - 60) / 56) * Math.PI) + 0.9 * Math.sin(((frame - 60) / 56) * Math.PI) : 0,
    tilt: mix(0, 0.16, EASE.soft(clamp01((frame - 64) / 16))) * (1 - EASE.soft(clamp01((frame - 120) / 16))) + mix(0, -0.12, EASE.soft(clamp01((frame - 170) / 14))),
    turn: mix(0, 0.32, EASE.move(clamp01((frame - 168) / 20))) * (1 - EASE.move(clamp01((frame - 236) / 20))),
    breathe: (Math.sin(frame / 14) + 1) / 2,
  };

  // ── 镜头：从远处缓缓推近，轻微环绕 ──
  const p = EASE.move(clamp01(frame / MASCOT_INTRO_DURATION));
  camera.position.set(mix(-0.6, 1.0, p), mix(2.6, 2.1, p), mix(12.5, 8.2, p));
  camera.lookAt(0, mix(2.0, 2.3, p), 0);

  const shadow = clamp01(1 - pose.y / 7);
  return (
    <>
      <hemisphereLight args={["#9fb4ff", "#0a0f28", 0.5]} />
      <directionalLight position={[3, 7, 6]} intensity={1.6} color="#fff3e0" castShadow shadow-mapSize={[1024, 1024]} shadow-radius={8} />
      <spotLight position={[-6, 5, -4]} angle={0.6} penumbra={0.8} intensity={60} color="#f5b83d" />
      <spotLight position={[6, 5, -4]} angle={0.6} penumbra={0.8} intensity={50} color="#5ee7ff" />
      {/* 地面：深蓝、微反光；中央一圈金色光环当舞台 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#0a1130" roughness={0.42} metalness={0.1} envMapIntensity={0.12} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[1.9, 2.0, 96]} />
        <meshBasicMaterial color={new THREE.Color("#f5b83d").multiplyScalar(1.4 * (0.6 + 0.4 * clamp01((frame - LAND) / 10)))} toneMapped={false} transparent opacity={0.9} />
      </mesh>
      <sprite position={[0, 0.05, 0]} scale={[7, 2.2, 1]}>
        <spriteMaterial map={gold} transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      {/* 接触影：随离地高度变淡变大 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0.1]} scale={[1.6 * (2 - shadow), 1.3 * (2 - shadow), 1]}>
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial color="#000" transparent opacity={0.45 * shadow} depthWrite={false} />
      </mesh>
      {/* 远处虚化光斑，极缓漂移 */}
      {bokeh.map((b, i) => (
        <sprite key={i} position={[b.x + Math.sin(frame / 90 + i) * 0.3, b.y + Math.cos(frame / 110 + i) * 0.2, b.z]} scale={[b.s, b.s, 1]}>
          <spriteMaterial map={b.c < 0.4 ? gold : b.c < 0.75 ? cyan : blue} transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      ))}
      {/* 晓晓背后一团暖光 */}
      <sprite position={[0, 1.8, -1.2]} scale={[5.5, 5.5, 1]}>
        <spriteMaterial map={blue} transparent opacity={0.45} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <Mascot pose={pose} scale={1.25} />
      {/* 关键词卡片：错峰弹出（带过冲），轻轻上下浮动，始终正对镜头 */}
      {WORDS.map((w, i) => {
        const s = spring({ frame: frame - (84 + i * 9), fps, config: { damping: 10, stiffness: 170 } });
        const hot = i === HOT && frame >= 200;
        const glow = hot ? spring({ frame: frame - 200, fps, config: { damping: 9, stiffness: 160 } }) : 0;
        const [x, y, z] = CARD_POS[i];
        const card = new THREE.Vector3(x, y + Math.sin(frame / 22 + i * 1.3) * 0.08, z);
        return (
          <group key={w} position={card} scale={Math.max(0.001, s * (1 + glow * 0.25))} quaternion={camera.quaternion}>
            <mesh>
              <planeGeometry args={[2.3, 1.0]} />
              <meshBasicMaterial map={textures[i][hot ? 1 : 0]} transparent toneMapped={false} />
            </mesh>
            {hot && (
              <sprite position={[0, 0, -0.05]} scale={[3.4 * glow, 2.2 * glow, 1]}>
                <spriteMaterial map={gold} transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} />
              </sprite>
            )}
          </group>
        );
      })}
    </>
  );
};

export const MascotIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: C.bg0 }}>
      <ThreeCanvas width={width} height={height} shadows camera={{ fov: 38, near: 0.1, far: 100, position: [0, 2.6, 12] }} gl={{ antialias: true }}>
        <Scene frame={frame} fps={fps} />
      </ThreeCanvas>
      {/* 暗角 + 颗粒交给 CSS，便宜 */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 75% at 50% 45%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.55) 100%)", pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
