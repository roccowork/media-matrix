import React, { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { useScale } from "./useScale";

export type VectorSearchProps = {
  queryAt?: number; // 提问光点出现的帧
  searchAt?: number; // 找到最近片段的帧
  k?: number; // 取最近的几个
  groups?: string[]; // 每组代表一份文档
  queryLabel?: string;
};

const COLORS = ["#22D3EE", "#A78BFA", "#4ADE80"];
const PER_GROUP = 18;

// 向量空间：文档片段变成 3D 光点，提问也变成光点，离它最近的几个亮起
export const VectorSearch3D: React.FC<VectorSearchProps> = ({
  queryAt = 40,
  searchAt = 90,
  k = 3,
  groups = ["员工手册", "IT 管理制度", "费用报销制度"],
  queryLabel = "出差住宿报销标准？",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = useScale();

  // 每份文档的片段聚成一团，位置固定（用 random 保证每次渲染一致）
  const points = useMemo(() => {
    const centers: [number, number, number][] = [
      [-2.6, 0.6, 0],
      [0, -1.2, -1],
      [2.4, 0.8, 0.6],
    ];
    return groups.flatMap((_, g) =>
      Array.from({ length: PER_GROUP }, (_, i) => {
        const r = (n: string) => random(`${g}-${i}-${n}`) - 0.5;
        return { g, pos: new THREE.Vector3(centers[g][0] + r("x") * 2.4, centers[g][1] + r("y") * 2.2, centers[g][2] + r("z") * 2) };
      }),
    );
  }, [groups]);

  // 提问落在「费用报销制度」那一团里
  const queryPos = useMemo(() => new THREE.Vector3(2.1, 0.5, 0.9), []);
  const nearest = useMemo(
    () => points.map((p, i) => ({ i, d: p.pos.distanceTo(queryPos) })).sort((a, b) => a.d - b.d).slice(0, k).map((x) => x.i),
    [points, queryPos, k],
  );

  const qIn = spring({ frame: frame - queryAt, fps, config: { damping: 14 } });
  const found = interpolate(frame, [searchAt, searchAt + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const angle = interpolate(frame, [0, 300], [-0.35, 0.35]);
  const curQ = new THREE.Vector3(queryPos.x, queryPos.y + (1 - qIn) * 5, queryPos.z);

  const lines = useMemo(
    () =>
      nearest.map((i) => {
        const g = new THREE.BufferGeometry().setFromPoints([queryPos, points[i].pos]);
        return new THREE.Line(g, new THREE.LineBasicMaterial({ color: brand.colors.warning, transparent: true }));
      }),
    [nearest, points, queryPos],
  );
  lines.forEach((l) => ((l.material as THREE.LineBasicMaterial).opacity = found));

  return (
    <AbsoluteFill>
      <ThreeCanvas width={width} height={height} camera={{ fov: 45, position: [0, 1, 9] }}>
        <Rig angle={angle} distance={height > width ? 14 : 9} />
        <ambientLight intensity={0.6} />
        <pointLight position={[0, 6, 6]} intensity={60} />
        {points.map((p, i) => {
          const hit = nearest.includes(i);
          const dim = found > 0 && !hit ? 1 - found * 0.7 : 1;
          return (
            <mesh key={i} position={p.pos} scale={hit ? 1 + found * 1.2 : 1}>
              <sphereGeometry args={[0.09, 16, 16]} />
              <meshBasicMaterial color={hit && found > 0.5 ? brand.colors.warning : COLORS[p.g]} transparent opacity={dim} />
            </mesh>
          );
        })}
        {frame >= queryAt ? (
          <mesh position={curQ}>
            <sphereGeometry args={[0.18, 24, 24]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        ) : null}
        {lines.map((l, i) => (
          <primitive key={i} object={l} />
        ))}
      </ThreeCanvas>
      {/* 图例 */}
      <AbsoluteFill style={{ padding: 40 * s, justifyContent: "flex-start", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 * s, fontFamily: brand.fonts.sans, fontSize: 26 * s }}>
          {groups.map((g, i) => (
            <div key={g} style={{ display: "flex", alignItems: "center", gap: 12 * s, color: brand.colors.text }}>
              <div style={{ width: 18 * s, height: 18 * s, borderRadius: "50%", background: COLORS[i] }} />
              {g}
            </div>
          ))}
        </div>
      </AbsoluteFill>
      {frame >= queryAt ? (
        <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: (height > width ? 320 : 70) * s }}>
          <div
            style={{
              fontFamily: brand.fonts.sans,
              fontSize: 34 * s,
              color: brand.colors.bg,
              background: "#fff",
              borderRadius: 999,
              padding: `${10 * s}px ${30 * s}px`,
              opacity: qIn,
            }}
          >
            提问：{queryLabel}
          </div>
          <div
            style={{
              marginTop: 14 * s,
              fontFamily: brand.fonts.sans,
              fontSize: 30 * s,
              color: brand.colors.warning,
              opacity: found,
            }}
          >
            找到最相关的 {k} 段 → 只把这 {k} 段交给 AI
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

const Rig: React.FC<{ angle: number; distance: number }> = ({ angle, distance }) => {
  const camera = useThree((st) => st.camera);
  camera.position.set(Math.sin(angle) * distance, 1.2, Math.cos(angle) * distance);
  camera.lookAt(0, 0, 0);
  return null;
};
