import React, { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { Background } from "./Background";
import { useScale } from "./useScale";

export type ServerRack3DProps = {
  racks?: number; // 机柜数量
  alertRack?: number; // 出故障的机柜序号（从 0 开始），-1 表示不告警
  alertAt?: number; // 第几帧开始告警
  label?: string; // 告警文字
};

const UNITS = 8; // 每个机柜的服务器数量

// 单台服务器：机身 + 闪烁的指示灯
const Server: React.FC<{ y: number; seed: string; alert: boolean; frame: number }> = ({ y, seed, alert, frame }) => {
  const blink = random(`${seed}-${Math.floor(frame / (4 + random(seed) * 6))}`) > 0.35;
  const led = alert ? (Math.floor(frame / 6) % 2 === 0 ? brand.colors.danger : "#3b0d0d") : blink ? brand.colors.success : "#0f3d22";
  return (
    <group position={[0, y, 0]}>
      <mesh>
        <boxGeometry args={[1.6, 0.32, 1.2]} />
        <meshStandardMaterial color={alert ? "#3a1218" : "#1e293b"} metalness={0.6} roughness={0.35} />
      </mesh>
      {[-0.55, -0.4].map((x) => (
        <mesh key={x} position={[x, 0, 0.61]}>
          <boxGeometry args={[0.07, 0.07, 0.02]} />
          <meshBasicMaterial color={led} />
        </mesh>
      ))}
      <mesh position={[0.35, 0, 0.61]}>
        <boxGeometry args={[0.7, 0.04, 0.02]} />
        <meshBasicMaterial color={alert ? brand.colors.danger : brand.colors.primary} transparent opacity={0.6} />
      </mesh>
    </group>
  );
};

// 3D 机房：镜头环绕，到指定时间某个机柜变红告警
export const ServerRack3D: React.FC<ServerRack3DProps> = ({ racks = 5, alertRack = 2, alertAt = 60, label = "CPU 100% · web-03" }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const s = useScale();
  const alerting = alertRack >= 0 && frame >= alertAt;
  const angle = interpolate(frame, [0, durationInFrames], [-0.5, 0.5]);
  // 竖屏视野窄，镜头要拉远一些
  const zoom = interpolate(frame, [0, durationInFrames], [11, 8.5]) * (height > width ? 1.6 : 1);
  const xs = useMemo(() => Array.from({ length: racks }, (_, i) => (i - (racks - 1) / 2) * 2.2), [racks]);
  const tagIn = interpolate(frame, [alertAt, alertAt + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <Background>
      <ThreeCanvas width={width} height={height} camera={{ fov: 45, position: [0, 3, 10] }}>
        <CameraRig angle={angle} distance={zoom} />
        <ambientLight intensity={0.5} />
        <pointLight position={[0, 8, 6]} intensity={80} color={brand.colors.primary} />
        <pointLight position={[-6, 4, -4]} intensity={40} color={brand.colors.accent} />
        {alerting ? <pointLight position={[xs[alertRack] ?? 0, 2, 2]} intensity={30 + Math.sin(frame / 3) * 15} color={brand.colors.danger} /> : null}
        {xs.map((x, r) => (
          <group key={r} position={[x, 0, 0]}>
            {/* 机柜外框 */}
            <mesh position={[0, 1.4, -0.05]}>
              <boxGeometry args={[1.8, 3.2, 1.3]} />
              <meshStandardMaterial color="#0b1222" metalness={0.3} roughness={0.8} transparent opacity={0.5} />
            </mesh>
            {Array.from({ length: UNITS }, (_, u) => (
              <Server key={u} y={u * 0.36} seed={`${r}-${u}`} alert={alerting && r === alertRack} frame={frame} />
            ))}
          </group>
        ))}
        {/* 地面 */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]}>
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial color="#070b17" metalness={0.8} roughness={0.4} />
        </mesh>
        <gridHelper args={[40, 40, brand.colors.border, brand.colors.border]} position={[0, -0.29, 0]} />
      </ThreeCanvas>
      {alerting && label ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 90 * s }}>
          <div
            style={{
              fontFamily: brand.fonts.mono,
              fontSize: 44 * s,
              fontWeight: 700,
              color: "#fff",
              background: `${brand.colors.danger}dd`,
              padding: `${14 * s}px ${36 * s}px`,
              borderRadius: 14 * s,
              opacity: tagIn,
              transform: `scale(${0.8 + tagIn * 0.2})`,
              boxShadow: `0 0 ${40 * s}px ${brand.colors.danger}`,
            }}
          >
            ⚠ {label}
          </div>
        </AbsoluteFill>
      ) : null}
    </Background>
  );
};

// 用帧驱动镜头位置（不要用 useFrame，否则渲染结果不稳定）
const CameraRig: React.FC<{ angle: number; distance: number }> = ({ angle, distance }) => {
  const camera = useThree((st) => st.camera);
  camera.position.set(Math.sin(angle) * distance, 3, Math.cos(angle) * distance);
  camera.lookAt(0, 1.2, 0);
  return null;
};
