// 沉浸式 3D 镜头「注意力」（10 秒）：镜头飞进一片深空，一句话的每个词是一块玻璃词砖，从四散的空间里飞拢成句；
// 「它」亮起，向每个词射出发光光束（越粗越亮 = 注意力越大），光脉冲沿光束奔跑；最强一束命中「小猫」时火花四溅、冲击环扩散、镜头猛推；
// 最后镜头绕到低机位慢慢环绕，「87%」浮在小猫上方。
// 用成熟库：three.js + react-three-fiber + drei（RoundedBox / Environment + Lightformer 影棚反射 / Stars 星空）
// + postprocessing（辉光、景深、色差、暗角、颗粒）。所有动画由帧驱动（Stars 的 speed=0，不随时钟闪烁）。
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { Environment, Lightformer, RoundedBox, Stars } from "@react-three/drei";
import { Bloom, ChromaticAberration, DepthOfField, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, continueRender, delayRender, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, EASE, FONT, clamp01, mix } from "../kit";

export const ATTENTION_SPACE_DURATION = 300;

const TOKENS = ["小猫", "没有", "跳上", "桌子", "因为", "它", "太累了"];
const W = [0.87, 0.05, 0.12, 0.18, 0.06, 0, 0.45];
const SRC = 5;
const T_LINE = 34, T_SRC = 104, T_BEAM = 124, T_HIT = 186;
const GOLD = new THREE.Color("#f5b83d");
const CYAN = new THREE.Color("#5ee7ff");

const useFonts = () => {
  const [ready, setReady] = useState(false);
  const [h] = useState(() => delayRender("字体"));
  useEffect(() => {
    document.fonts.load(`900 64px ${FONT}`).then(() => document.fonts.ready).then(() => { setReady(true); continueRender(h); });
  }, [h]);
  return ready;
};
const textTex = (text: string, ready: boolean, color = "#ffffff", size = 150) => {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = color;
  g.font = `900 ${text.length > 2 ? size * 0.78 : size}px ${ready ? FONT : "sans-serif"}`;
  g.textAlign = "center"; g.textBaseline = "middle";
  g.shadowColor = color; g.shadowBlur = 18;
  g.fillText(text, 256, 136);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
};

// 句子成形后的位置：一条略弯的弧
const slot = (i: number) => {
  const a = ((i - 3) / 6) * 1.1;
  return new THREE.Vector3(Math.sin(a) * 9, -0.2 + Math.cos(i * 1.3) * 0.15, -Math.cos(a) * 9 + 9);
};
// 起始位置：四散在纵深空间里
const scatter = (i: number) => new THREE.Vector3((random(`sx${i}`) - 0.5) * 30, (random(`sy${i}`) - 0.5) * 14, -random(`sz${i}`) * 30 - 6);

const Beam: React.FC<{ i: number; frame: number }> = ({ i, frame }) => {
  const w = W[i];
  const curve = useMemo(() => {
    const a = slot(SRC).add(new THREE.Vector3(0, 0.75, 0)), b = slot(i).add(new THREE.Vector3(0, 0.75, 0));
    const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 1.4 + a.distanceTo(b) * 0.32, 0.6));
    return new THREE.CatmullRomCurve3([a, mid, b]);
  }, [i]);
  const geo = useMemo(() => new THREE.TubeGeometry(curve, 160, 0.02 + w * 0.085, 12, false), [curve, w]);
  const order = [1, 4, 2, 3, 6, 0].indexOf(i); // 弱的先、强的压轴
  const start = T_BEAM + order * (w > 0.3 ? 12 : 6) + (i === 0 ? 10 : 0);
  const dur = w > 0.3 ? 30 : 18;
  const grow = EASE.in(clamp01((frame - start) / dur));
  geo.setDrawRange(0, Math.floor((geo.index!.count * grow) / 6) * 6);
  const col = (w > 0.3 ? GOLD : CYAN).clone().multiplyScalar(0.8 + w * 4);
  const pulses = grow >= 1 ? [0, 0.34, 0.67].map((k) => (((frame - start - dur) / 40 + k) % 1 + 1) % 1) : [];
  return (
    <group>
      <mesh geometry={geo}>
        <meshBasicMaterial color={col} transparent opacity={0.3 + w * 0.7} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {grow > 0 && grow < 1 && (
        <mesh position={curve.getPoint(grow)}>
          <sphereGeometry args={[0.07 + w * 0.12, 16, 16]} />
          <meshBasicMaterial color={col.clone().multiplyScalar(2)} toneMapped={false} />
        </mesh>
      )}
      {pulses.map((u, k) => (
        <mesh key={k} position={curve.getPoint(u)}>
          <sphereGeometry args={[0.04 + w * 0.09, 12, 12]} />
          <meshBasicMaterial color={col.clone().multiplyScalar(2.5)} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
};

// 命中火花：解析式抛物运动（确定性），金色为主带少量白和青
const Sparks: React.FC<{ frame: number; at: THREE.Vector3 }> = ({ frame, at }) => {
  const N = 160;
  const seeds = useMemo(() => Array.from({ length: N }, (_, i) => {
    const th = random(`t${i}`) * Math.PI * 2, ph = Math.acos(2 * random(`p${i}`) - 1), v = 3 + random(`v${i}`) * 7;
    return { d: new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.abs(Math.cos(ph)) * 0.9 + 0.2, Math.sin(ph) * Math.sin(th)).multiplyScalar(v), c: random(`c${i}`), l: 0.5 + random(`l${i}`) * 0.9 };
  }), []);
  const mesh = useMemo(() => new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 6), new THREE.MeshBasicMaterial({ toneMapped: false, vertexColors: false }), N), []);
  const t = (frame - T_HIT) / 30;
  const m = new THREE.Matrix4(), col = new THREE.Color();
  seeds.forEach((s, i) => {
    const life = clamp01(t / s.l);
    const p = at.clone().add(s.d.clone().multiplyScalar(t)).add(new THREE.Vector3(0, -4.9 * t * t, 0));
    const sc = t < 0 || life >= 1 ? 0.0001 : (1 - life) * 1.4;
    m.compose(p, new THREE.Quaternion(), new THREE.Vector3(sc, sc, sc));
    mesh.setMatrixAt(i, m);
    col.copy(s.c < 0.7 ? GOLD : s.c < 0.85 ? new THREE.Color("#ffffff") : CYAN).multiplyScalar(3 * (1 - life) + 0.5);
    mesh.setColorAt(i, col);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return t >= 0 && t < 1.5 ? <primitive object={mesh} /> : null;
};

const Scene: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const { camera, scene } = useThree();
  const ready = useFonts();
  useMemo(() => { scene.background = new THREE.Color("#02040d"); scene.fog = new THREE.FogExp2("#030716", 0.028); }, [scene]);
  const tex = useMemo(() => TOKENS.map((t) => [textTex(t, ready), textTex(t, ready, "#1a1204")]), [ready]);
  const pctTex = useMemo(() => textTex("87%", ready, "#ffd98a", 170), [ready]);
  const dust = useMemo(() => {
    const n = 700, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([(random(`dx${i}`) - 0.5) * 40, (random(`dy${i}`) - 0.3) * 16, (random(`dz${i}`) - 0.7) * 40], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); return g;
  }, []);

  // ── 镜头：深空俯冲进来 → 句子成形时拉开 → 命中时猛推 → 低机位环绕 ──
  const hit = frame >= T_HIT ? Math.exp(-(frame - T_HIT) / 6) : 0;
  const fly = EASE.in(clamp01(frame / 70));
  const orbit = EASE.move(clamp01((frame - T_HIT + 10) / 110));
  const ang = mix(0, -0.55, orbit);
  const dist = mix(mix(40, 10.5, fly), 8.4, EASE.move(clamp01((frame - 150) / 40))) - hit * 1.4;
  const target = new THREE.Vector3(mix(0, -1.6, orbit), mix(1.2, 1.9, orbit), 4.8);
  camera.position.set(target.x + Math.sin(ang) * dist, mix(mix(6, 2.2, fly), 1.5, orbit) + Math.sin(frame / 40) * 0.08, target.z + Math.cos(ang) * dist);
  camera.lookAt(target);
  (camera as THREE.PerspectiveCamera).fov = mix(60, 42, fly);
  camera.rotation.z += mix(0.12, 0, fly);
  camera.updateProjectionMatrix();

  const hitAt = slot(0).add(new THREE.Vector3(0, 0.75, 0));
  return (
    <>
      {/* 影棚反射：程序化灯片（不下载素材），给玻璃词砖漂亮的高光 */}
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={3} position={[0, 6, -6]} scale={[12, 2, 1]} color="#ffffff" />
        <Lightformer intensity={2} position={[-8, 2, 2]} rotation-y={Math.PI / 2} scale={[6, 4, 1]} color="#5ee7ff" />
        <Lightformer intensity={2.5} position={[8, 2, 2]} rotation-y={-Math.PI / 2} scale={[6, 4, 1]} color="#f5b83d" />
      </Environment>
      <ambientLight intensity={0.25} />
      <pointLight position={[0, 6, 6]} intensity={40} color="#9fb4ff" />
      <Stars radius={60} depth={40} count={4000} factor={3.2} saturation={0} fade speed={0} />
      <points geometry={dust}>
        <pointsMaterial size={0.05} color={new THREE.Color("#9fc4ff").multiplyScalar(1.4)} transparent opacity={0.7} toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      {/* 词砖 */}
      {TOKENS.map((t, i) => {
        const s = spring({ frame: frame - (T_LINE + Math.abs(i - 3) * 4), fps, config: { damping: 14, stiffness: 60, mass: 1.2 } });
        const p = scatter(i).lerp(slot(i), Math.min(1, s));
        const spin = (1 - Math.min(1, s)) * (random(`r${i}`) - 0.5) * 6;
        const isSrc = i === SRC, isHit = i === 0;
        const lit = isSrc ? EASE.in(clamp01((frame - T_SRC) / 10)) : isHit ? EASE.in(clamp01((frame - T_HIT) / 6)) : W[i] > 0.3 ? EASE.in(clamp01((frame - T_HIT + 30) / 12)) * 0.5 : 0;
        const pop = isHit ? 1 + 0.25 * Math.exp(-(frame - T_HIT) / 8) * (frame >= T_HIT ? 1 : 0) : isSrc ? 1 + 0.15 * Math.sin(clamp01((frame - T_SRC) / 14) * Math.PI) : 1;
        const bob = Math.sin(frame / 26 + i) * 0.06;
        const face = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
        const wide = t.length > 2 ? 2.2 : 1.7;
        return (
          <group key={t} position={[p.x, p.y + bob, p.z]} rotation={[spin * 0.6, face * 0.85 + spin, spin * 0.3]} scale={pop}>
            <RoundedBox args={[wide, 1.05, 0.42]} radius={0.16} smoothness={4}>
              <meshPhysicalMaterial color={lit > 0.3 ? "#ffd27a" : "#9fb6ff"} transmission={1 - lit * 0.6} thickness={0.6} roughness={0.12} ior={1.45} clearcoat={1} clearcoatRoughness={0.08}
                emissive={lit > 0 ? GOLD : new THREE.Color("#000000")} emissiveIntensity={lit * 0.55} attenuationColor="#3b5bff" attenuationDistance={2} />
            </RoundedBox>
            <mesh position={[0, 0, 0.23]}>
              <planeGeometry args={[wide * 0.92, 0.92]} />
              <meshBasicMaterial map={tex[i][lit > 0.6 ? 1 : 0]} transparent toneMapped={false} />
            </mesh>
          </group>
        );
      })}
      {TOKENS.map((_, i) => (i === SRC ? null : <Beam key={i} i={i} frame={frame} />))}
      <Sparks frame={frame} at={hitAt} />
      {/* 冲击环 */}
      {frame >= T_HIT && frame < T_HIT + 24 && (
        <mesh position={hitAt} quaternion={camera.quaternion} scale={0.4 + EASE.in(clamp01((frame - T_HIT) / 24)) * 4}>
          <ringGeometry args={[0.9, 1, 96]} />
          <meshBasicMaterial color={GOLD.clone().multiplyScalar(4)} transparent opacity={1 - (frame - T_HIT) / 24} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* 87%：浮在小猫上方，正对镜头 */}
      {frame >= T_HIT + 6 && (
        <mesh position={slot(0).add(new THREE.Vector3(0, 2.1 + EASE.in(clamp01((frame - T_HIT - 6) / 16)) * 0.3, 0))} quaternion={camera.quaternion} scale={EASE.settle(clamp01((frame - T_HIT - 6) / 14))}>
          <planeGeometry args={[2.6, 1.3]} />
          <meshBasicMaterial map={pctTex} transparent toneMapped={false} />
        </mesh>
      )}
      <EffectComposer multisampling={0}>
        <DepthOfField focusDistance={0} focalLength={0.06} bokehScale={mix(6, 3, fly)} target={frame >= T_HIT ? hitAt : slot(SRC)} />
        <Bloom intensity={1.1 + hit * 1.5} luminanceThreshold={0.5} luminanceSmoothing={0.25} mipmapBlur radius={0.7} />
        <ChromaticAberration offset={new THREE.Vector2(0.0008 + hit * 0.006, 0.0005 + hit * 0.004)} radialModulation={false} modulationOffset={0} />
        <Noise opacity={0.05} blendFunction={BlendFunction.OVERLAY} />
        <Vignette eskil={false} offset={0.22} darkness={0.85} />
      </EffectComposer>
    </>
  );
};

export const AttentionSpace: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: C.bg0 }}>
      <ThreeCanvas width={width} height={height} camera={{ fov: 60, near: 0.1, far: 200, position: [0, 3, 34] }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        <Scene frame={frame} fps={fps} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
