// 「AI 科普」画面风格样片（10 秒，横屏，无声）：只用 Remotion + three.js，验证「高端、震撼」能不能用代码做出来。
// 镜头 A（0～3.2 秒）：星光跃迁，标题逐字升起，冲进标题、闪白切镜。
// 镜头 B（3.2～10 秒）：一句话的 7 个词元悬浮在三维空间，镜头环绕推进；「它」亮起，向每个词射出光束（粗细 = 注意力权重），
// 光点沿光束流动，「小猫」被命中时冲击波 + 权重弹出。后期：辉光（Bloom）、色差、暗角、胶片颗粒。
// 规则：所有动画只由当前帧驱动（不用 useFrame 做时间动画），随机数用 remotion 的 random(seed)。
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { AbsoluteFill, continueRender, delayRender, random, useCurrentFrame, useVideoConfig, Easing, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/NotoSansSC";

const { fontFamily: CJK } = loadFont("normal", { weights: ["500", "900"], ignoreTooManyRequestsWarning: true });
const GOLD = "#f5b83d";
const CYAN = "#5ee7ff";
const CUT = 3.2;
export const ATTENTION_SECONDS = 10;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (t: number) => Easing.bezier(0.16, 1, 0.3, 1)(clamp(t));
const easeIn = (t: number) => Easing.bezier(0.7, 0, 0.84, 0)(clamp(t));
const prog = (now: number, a: number, d: number) => clamp((now - a) / d);
const useNow = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
};

// ── 镜头 A：星光跃迁 ──
const Warp: React.FC<{ now: number }> = ({ now }) => {
  const N = 1400;
  const { positions, colors, seeds } = useMemo(() => {
    const p = new Float32Array(N * 6), c = new Float32Array(N * 6), s: [number, number, number][] = [];
    for (let i = 0; i < N; i++) {
      const a = random(`a${i}`) * Math.PI * 2, r = 0.6 + random(`r${i}`) * 9, z = random(`z${i}`) * 120;
      s.push([Math.cos(a) * r, Math.sin(a) * r, z]);
      const col = new THREE.Color(random(`c${i}`) < 0.18 ? GOLD : random(`d${i}`) < 0.3 ? CYAN : "#ffffff");
      for (const k of [0, 3]) c.set([col.r, col.g, col.b], i * 6 + k);
    }
    return { positions: p, colors: c, seeds: s };
  }, []);
  // 速度先慢后急；冲进标题前猛拉
  const travel = now * 18 + easeIn(prog(now, 1.6, 1.6)) * 140;
  const streak = 0.6 + easeIn(prog(now, 1.4, 1.8)) * 18;
  for (let i = 0; i < N; i++) {
    const [x, y, z0] = seeds[i];
    const z = -((z0 + travel) % 120) + 8;
    positions.set([x, y, z, x, y, z - streak], i * 6);
  }
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, [positions, colors]);
  geo.attributes.position.needsUpdate = true;
  const { camera } = useThree();
  camera.position.set(0, 0, 10);
  camera.rotation.set(0, 0, now * 0.12);
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial vertexColors transparent opacity={0.9} blending={THREE.AdditiveBlending} toneMapped={false} />
    </lineSegments>
  );
};

// ── 文字贴图：用 canvas 画中文（等字体加载完再画） ──
const useFontsReady = () => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("等中文字体"));
  useEffect(() => {
    document.fonts.load(`900 64px ${CJK}`).then(() => document.fonts.ready).then(() => {
      setReady(true);
      continueRender(handle);
    });
  }, [handle]);
  return ready;
};

const cardTexture = (text: string, ready: boolean) => {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "rgba(40,52,90,0.92)");
  grad.addColorStop(1, "rgba(10,14,32,0.92)");
  g.fillStyle = grad;
  g.beginPath();
  g.roundRect(6, 6, 500, 244, 36);
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = "rgba(160,200,255,0.55)";
  g.stroke();
  g.fillStyle = "#ffffff";
  g.font = `900 ${text.length > 2 ? 104 : 124}px ${ready ? CJK : "sans-serif"}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 256, 136);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

// ── 镜头 B：注意力光束 ──
const TOKENS = ["小猫", "没有", "跳上", "桌子", "因为", "它", "太累了"];
const WEIGHT = [0.87, 0.05, 0.12, 0.18, 0.06, 0, 0.45]; // 「它」对每个词的注意力
const SRC = 5;
const T_LIT = CUT + 1.2; // 「它」亮起
const T_BEAM = CUT + 1.9; // 光束射出
const T_HIT = CUT + 3.4; // 命中「小猫」

const tokenPos = (i: number): THREE.Vector3 => {
  const a = ((i - 3) / 6) * 1.25; // 弧形排列，间距够大不互相遮挡
  return new THREE.Vector3(Math.sin(a) * 10.5, Math.sin(i * 1.7) * 0.3, -Math.cos(a) * 10.5 + 10.5);
};

const Beam: React.FC<{ from: THREE.Vector3; to: THREE.Vector3; w: number; now: number; i: number }> = ({ from, to, w, now, i }) => {
  const curve = useMemo(() => {
    const up = new THREE.Vector3(0, 0.6, 0);
    const a = from.clone().add(up), b = to.clone().add(up);
    const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 1.2 + a.distanceTo(b) * 0.3, 0.4));
    return new THREE.QuadraticBezierCurve3(a, mid, b);
  }, [from, to]);
  const geo = useMemo(() => new THREE.TubeGeometry(curve, 120, 0.018 + w * 0.09, 12, false), [curve, w]);
  const start = T_BEAM + i * 0.07;
  const grow = ease(prog(now, start, 0.9));
  geo.setDrawRange(0, Math.floor(geo.index!.count * grow / 6) * 6);
  const pulses = [0, 0.33, 0.66].map((k) => (now - start - 0.9) * 0.55 + k);
  const glow = (0.35 + w * 2.6) * (1 + 0.25 * Math.sin(now * 9 + i));
  const color = w > 0.4 ? new THREE.Color(GOLD).multiplyScalar(glow) : new THREE.Color(CYAN).multiplyScalar(glow * 0.8);
  return (
    <group>
      <mesh geometry={geo}>
        <meshBasicMaterial color={color} transparent opacity={0.35 + w * 0.65} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {grow >= 1 &&
        pulses.map((p, k) => {
          const pt = curve.getPoint(((p % 1) + 1) % 1);
          return (
            <mesh key={k} position={pt}>
              <sphereGeometry args={[0.05 + w * 0.12, 16, 16]} />
              <meshBasicMaterial color={new THREE.Color(w > 0.4 ? GOLD : CYAN).multiplyScalar(4)} toneMapped={false} />
            </mesh>
          );
        })}
    </group>
  );
};

const Dust: React.FC<{ now: number }> = ({ now }) => {
  const N = 900;
  const base = useMemo(() => Array.from({ length: N }, (_, i) => [(random(`x${i}`) - 0.5) * 40, (random(`y${i}`) - 0.3) * 16, (random(`z${i}`) - 0.5) * 40, random(`s${i}`)]), []);
  const pos = useMemo(() => new Float32Array(N * 3), []);
  base.forEach(([x, y, z, s], i) => pos.set([x + Math.sin(now * 0.3 + s * 9) * 0.4, y + now * (0.1 + s * 0.2), z], i * 3));
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [pos]);
  geo.attributes.position.needsUpdate = true;
  const dot = useMemo(() => glowTexture("#ffffff"), []);
  return (
    <points geometry={geo}>
      <pointsMaterial size={0.09} map={dot} alphaMap={dot} color={new THREE.Color("#9fc4ff").multiplyScalar(1.4)} transparent opacity={0.8} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
};

// 柔光圆点贴图（粒子、星云用）
const glowTexture = (color: string) => {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, color);
  r.addColorStop(0.25, color + "aa");
  r.addColorStop(1, color + "00");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
};

// 远处两团慢慢呼吸的星云（金、蓝），给空间加层次
const Nebula: React.FC<{ now: number }> = ({ now }) => {
  const gold = useMemo(() => glowTexture("#f5b83d"), []);
  const blue = useMemo(() => glowTexture("#3b6dff"), []);
  return (
    <>
      <sprite position={[-9, 4, -14]} scale={[26 + Math.sin(now) * 1.5, 18, 1]}>
        <spriteMaterial map={blue} transparent opacity={0.28} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <sprite position={[10, 2, -16]} scale={[22, 16 + Math.sin(now * 0.8) * 1.2, 1]}>
        <spriteMaterial map={gold} transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
    </>
  );
};

const Floor: React.FC = () => {
  const grid = useMemo(() => {
    const g = new THREE.GridHelper(80, 80, new THREE.Color(GOLD), new THREE.Color("#27406b"));
    (g.material as THREE.Material).transparent = true;
    (g.material as THREE.Material).opacity = 0.5;
    return g;
  }, []);
  return <primitive object={grid} position={[0, -2.2, 0]} />;
};

const Attention: React.FC<{ now: number }> = ({ now }) => {
  const ready = useFontsReady();
  const textures = useMemo(() => TOKENS.map((t) => cardTexture(t, ready)), [ready]);
  const t = now - CUT;
  const { camera } = useThree();
  // 镜头：从「它」背后低位推进，环绕到正面俯视全句；命中时轻震
  const orbit = interpolate(t, [0, 6.8], [0.55, -0.25], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const dist = interpolate(t, [0, 1.2, 6.8], [6, 9.2, 10.2], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const shake = now > T_HIT ? Math.sin((now - T_HIT) * 60) * 0.08 * Math.exp(-(now - T_HIT) * 6) : 0;
  const target = new THREE.Vector3(0, 0.9, 4.2);
  camera.position.set(target.x + Math.sin(orbit) * dist + shake, 2.2 + t * 0.15, target.z + Math.cos(orbit) * dist);
  camera.lookAt(target);
  const src = tokenPos(SRC);
  return (
    <>
      <color attach="background" args={["#04060f"]} />
      <fog attach="fog" args={["#04060f", 10, 34]} />
      <ambientLight intensity={0.6} />
      <Floor />
      <Nebula now={now} />
      <Dust now={now} />
      {TOKENS.map((tok, i) => {
        const p = tokenPos(i);
        const appear = ease(prog(now, CUT + 0.15 + i * 0.08, 0.7));
        const lit = i === SRC ? ease(prog(now, T_LIT, 0.4)) : i === 0 ? ease(prog(now, T_HIT, 0.25)) : WEIGHT[i] > 0.3 ? ease(prog(now, T_BEAM + 1.2, 0.5)) * 0.6 : 0;
        const pop = i === 0 ? 1 + Math.sin(prog(now, T_HIT, 0.35) * Math.PI) * 0.18 : i === SRC ? 1 + Math.sin(prog(now, T_LIT, 0.35) * Math.PI) * 0.15 : 1;
        const s = appear * pop;
        return (
          <group key={i} position={[p.x, p.y + (1 - appear) * -2 + Math.sin(now * 1.3 + i) * 0.06, p.z]} rotation={[0, Math.atan2(camera.position.x - p.x, camera.position.z - p.z) * 0.6, 0]} scale={s}>
            <mesh>
              <planeGeometry args={[2.2, 1.1]} />
              <meshBasicMaterial map={textures[i]} transparent toneMapped={false} />
            </mesh>
            {/* 发光边框：亮起时金色、超亮（交给辉光） */}
            <mesh position={[0, 0, -0.01]} scale={[1 + lit * 0.04, 1 + lit * 0.08, 1]}>
              <planeGeometry args={[2.32, 1.22]} />
              <meshBasicMaterial color={new THREE.Color(GOLD).multiplyScalar(0.2 + lit * 5)} transparent opacity={0.15 + lit * 0.85} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
      {TOKENS.map((_, i) => (i === SRC ? null : <Beam key={i} i={i} from={src} to={tokenPos(i)} w={WEIGHT[i]} now={now} />))}
      {/* 命中冲击波 */}
      {now > T_HIT && (
        <mesh position={tokenPos(0)} rotation={[0, Math.atan2(camera.position.x - tokenPos(0).x, camera.position.z - tokenPos(0).z), 0]} scale={0.6 + ease(prog(now, T_HIT, 0.6)) * 2.6}>
          <ringGeometry args={[0.92, 1, 96]} />
          <meshBasicMaterial color={new THREE.Color(GOLD).multiplyScalar(4)} transparent opacity={1 - prog(now, T_HIT, 0.6)} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      )}
    </>
  );
};

const Post: React.FC<{ now: number }> = ({ now }) => {
  const hit = now > T_HIT ? Math.exp(-(now - T_HIT) * 5) : 0;
  const warp = now < CUT ? easeIn(prog(now, 1.6, 1.6)) : 0;
  const ca = 0.0006 + hit * 0.006 + warp * 0.004;
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={1.3 + hit * 1.5} luminanceThreshold={0.25} luminanceSmoothing={0.3} mipmapBlur radius={0.75} />
      <ChromaticAberration offset={new THREE.Vector2(ca, ca * 0.6)} radialModulation={false} modulationOffset={0} />
      <Noise opacity={0.06} blendFunction={BlendFunction.OVERLAY} />
      <Vignette eskil={false} offset={0.25} darkness={0.85} />
    </EffectComposer>
  );
};

// ── HTML 叠加层：标题和字幕式大字 ──
const Rise: React.FC<{ text: string; at: number; now: number; size: number; color?: string; stagger?: number; spacing?: number }> = ({ text, at, now, size, color = "#fff", stagger = 0.045, spacing = 0 }) => (
  <span style={{ display: "inline-block", letterSpacing: spacing }}>
    {[...text].map((ch, i) => {
      const p = ease(prog(now, at + i * stagger, 0.7));
      return (
        <span key={i} style={{ display: "inline-block", fontSize: size, color, opacity: p, transform: `translateY(${(1 - p) * size * 0.6}px) rotateX(${(1 - p) * 70}deg)`, filter: `blur(${(1 - p) * 12}px)`, whiteSpace: "pre" }}>
          {ch}
        </span>
      );
    })}
  </span>
);

const TitleA: React.FC<{ now: number }> = ({ now }) => {
  const push = easeIn(prog(now, 2.4, 0.8)); // 冲进标题
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", perspective: 1200, transform: `scale(${1 + push * 6})`, filter: `blur(${push * 18}px)`, opacity: 1 - prog(now, 2.95, 0.25) }}>
      <div style={{ fontFamily: "Inter, " + CJK, fontWeight: 900, textAlign: "center", textShadow: `0 0 40px ${GOLD}aa, 0 0 120px ${GOLD}55` }}>
        <Rise text="TRANSFORMER" at={0.35} now={now} size={150} color="#fff7e0" spacing={18} />
      </div>
      <div style={{ marginTop: 18, fontFamily: CJK, fontWeight: 500, letterSpacing: 24, opacity: ease(prog(now, 1.2, 0.6)), textShadow: "0 0 20px rgba(94,231,255,0.6)" }}>
        <Rise text="大模型的心脏是怎么跳动的" at={1.2} now={now} size={44} color={CYAN} stagger={0.03} />
      </div>
    </AbsoluteFill>
  );
};

const CaptionB: React.FC<{ now: number }> = ({ now }) => {
  const q = now > CUT + 0.4 && now < T_HIT + 0.2;
  const a = now >= T_HIT + 0.2;
  const hl = ease(prog(now, T_HIT + 0.9, 0.5));
  return (
    <AbsoluteFill style={{ fontFamily: CJK, fontWeight: 900, alignItems: "center" }}>
      {q && (
        <div style={{ marginTop: 90, textShadow: "0 6px 30px rgba(0,0,0,0.8)", opacity: 1 - prog(now, T_HIT, 0.2) }}>
          <Rise text="「它」指的是谁？" at={CUT + 0.4} now={now} size={78} />
        </div>
      )}
      {a && (
        <div style={{ marginTop: 90, textShadow: "0 6px 30px rgba(0,0,0,0.8)", textAlign: "center" }}>
          <Rise text="每个词，都看一遍所有词" at={T_HIT + 0.2} now={now} size={70} stagger={0.035} />
          <div style={{ marginTop: 22, fontSize: 40, fontWeight: 500, color: "rgba(255,255,255,0.85)", opacity: hl, letterSpacing: 6 }}>
            这就是 <span style={{ color: "#04060f", background: GOLD, padding: "2px 18px", borderRadius: 8, boxShadow: `0 0 30px ${GOLD}` }}>注意力机制</span>
          </div>
        </div>
      )}
      {/* 命中时的权重读数，贴在画面左侧「小猫」附近 */}
      {now > T_HIT && (
        <div style={{ position: "absolute", left: 130, top: 300, fontFamily: "Inter, " + CJK, fontWeight: 900, fontSize: 92, color: GOLD, textShadow: `0 0 30px ${GOLD}`, opacity: ease(prog(now, T_HIT + 0.1, 0.3)), transform: `translateY(${(1 - ease(prog(now, T_HIT + 0.1, 0.5))) * 40}px)` }}>
          {Math.round(87 * ease(prog(now, T_HIT + 0.1, 0.8)))}%
          <div style={{ fontSize: 30, fontWeight: 500, color: "#fff", letterSpacing: 4 }}>注意力权重</div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export const AttentionShowcase: React.FC = () => {
  const now = useNow();
  const { width, height } = useVideoConfig();
  const flash = Math.max(0, 1 - Math.abs(now - CUT) / 0.18);
  const fadeOut = prog(now, ATTENTION_SECONDS - 0.6, 0.6);
  return (
    <AbsoluteFill style={{ background: "#04060f" }}>
      <ThreeCanvas width={width} height={height} camera={{ fov: 45, near: 0.1, far: 200, position: [0, 0, 10] }} gl={{ antialias: true }}>
        {now < CUT ? <Warp now={now} /> : <Attention now={now} />}
        <Post now={now} />
      </ThreeCanvas>
      {now < CUT ? <TitleA now={now} /> : <CaptionB now={now} />}
      <AbsoluteFill style={{ background: "#fff", opacity: flash * 0.9, mixBlendMode: "screen" }} />
      <AbsoluteFill style={{ background: "#000", opacity: fadeOut }} />
    </AbsoluteFill>
  );
};
