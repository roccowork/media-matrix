// 吉祥物「晓晓」（向晓 AI）：three.js 基础形状拼出来的黏土 / 毛绒质感小家伙，不用外部模型。
// 圆滚滚的蓝色身体（物理材质：绒面 sheen + 一层薄清漆）、深色面罩上两只发光的眼睛、额头一弯金色「晨光」、白色耳机、两只小手两只小脚。
// 动作全部由帧驱动（参数从外面传进来）：跳跃压扁拉伸、眨眼、挥手、歪头、呼吸。
import React, { useMemo } from "react";
import * as THREE from "three";

export type MascotPose = {
  y: number; // 离地高度
  squash: number; // >0 压扁（落地），<0 拉长（起跳）
  blink: number; // 0 睁眼 → 1 闭眼
  wave: number; // 右手挥动角度（弧度）
  tilt: number; // 歪头（弧度）
  turn: number; // 左右转身（弧度）
  breathe: number; // 呼吸 0~1
};

const BLUE = "#3d63ff";

export const Mascot: React.FC<{ pose: MascotPose; scale?: number; position?: [number, number, number] }> = ({ pose, scale = 1, position = [0, 0, 0] }) => {
  const mats = useMemo(() => {
    const body = new THREE.MeshPhysicalMaterial({ color: BLUE, roughness: 0.62, sheen: 1, sheenColor: new THREE.Color("#a9c1ff"), sheenRoughness: 0.45, clearcoat: 0.25, clearcoatRoughness: 0.5 });
    const visor = new THREE.MeshPhysicalMaterial({ color: "#0a1030", roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, metalness: 0.1 });
    const eye = new THREE.MeshBasicMaterial({ color: new THREE.Color("#c9f6ff").multiplyScalar(1.6), toneMapped: false });
    const gold = new THREE.MeshStandardMaterial({ color: "#f5b83d", emissive: new THREE.Color("#f5a623"), emissiveIntensity: 1.4, roughness: 0.3 });
    const white = new THREE.MeshPhysicalMaterial({ color: "#f4f6ff", roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.15 });
    const pad = new THREE.MeshPhysicalMaterial({ color: "#c8d0ec", roughness: 0.8, sheen: 0.6, sheenColor: new THREE.Color("#ffffff") });
    return { body, visor, eye, gold, white, pad };
  }, []);
  const sq = pose.squash;
  const sx = 1 + sq * 0.22, sy = 1 - sq * 0.3 + pose.breathe * 0.02;
  const eyeH = Math.max(0.06, 1 - pose.blink);
  return (
    <group position={[position[0], position[1] + pose.y, position[2]]} scale={scale} rotation={[0, pose.turn, 0]}>
      {/* 压扁拉伸以脚底为原点 */}
      <group scale={[sx, sy, sx]}>
        {/* 身体 */}
        <mesh material={mats.body} position={[0, 1.05, 0]} scale={[1, 0.94, 0.92]} castShadow>
          <sphereGeometry args={[1, 64, 48]} />
        </mesh>
        {/* 头部朝向：歪头 */}
        <group position={[0, 1.15, 0]} rotation={[0, 0, pose.tilt]}>
          {/* 面罩 */}
          <mesh material={mats.visor} position={[0, 0.02, 0.62]} scale={[0.72, 0.44, 0.36]}>
            <sphereGeometry args={[1, 48, 32]} />
          </mesh>
          {/* 眼睛：发光胶囊，眨眼时压扁 */}
          {[-0.24, 0.24].map((x) => (
            <mesh key={x} material={mats.eye} position={[x, 0.04, 0.96]} scale={[0.09, 0.13 * eyeH, 0.04]}>
              <sphereGeometry args={[1, 24, 16]} />
            </mesh>
          ))}
          {/* 额头的晨光：一弯金色弧 */}
          <mesh material={mats.gold} position={[0, 0.46, 0.74]} rotation={[-0.55, 0, 0]}>
            <torusGeometry args={[0.26, 0.045, 16, 48, Math.PI]} />
          </mesh>
          {/* 耳机：头梁 + 两只耳罩 */}
          <mesh material={mats.white} position={[0, 0.12, -0.05]} rotation={[0, 0, 0]}>
            <torusGeometry args={[1.02, 0.07, 16, 64, Math.PI]} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.98, 0.0, 0]} rotation={[0, 0, s * Math.PI / 2]}>
              <mesh material={mats.white}><cylinderGeometry args={[0.34, 0.34, 0.26, 40]} /></mesh>
              <mesh material={mats.pad} position={[0, -s * -0.14 * 0, 0]} scale={[1, 0.4, 1]}><sphereGeometry args={[0.3, 32, 16]} /></mesh>
            </group>
          ))}
        </group>
        {/* 左手（垂着微晃） */}
        <mesh material={mats.body} position={[-0.98, 0.72, 0.1]} rotation={[0, 0, 0.5 + Math.sin(pose.breathe * Math.PI) * 0.05]} scale={[0.2, 0.32, 0.2]}>
          <sphereGeometry args={[1, 24, 16]} />
        </mesh>
        {/* 右手：挥手（绕肩膀转） */}
        <group position={[0.86, 0.92, 0.1]} rotation={[0, 0, -0.5 - pose.wave]}>
          <mesh material={mats.body} position={[0.12, -0.26, 0]} scale={[0.2, 0.32, 0.2]}>
            <sphereGeometry args={[1, 24, 16]} />
          </mesh>
        </group>
        {/* 两只脚 */}
        {[-0.38, 0.38].map((x) => (
          <mesh key={x} material={mats.body} position={[x, 0.16, 0.18]} scale={[0.3, 0.17, 0.36]}>
            <sphereGeometry args={[1, 24, 16]} />
          </mesh>
        ))}
      </group>
    </group>
  );
};
