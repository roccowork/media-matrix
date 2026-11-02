// 资产 cosmos.blackhole.v1：程序化黑洞（全屏光线步进 Shader）。
// 放进任意 Stage 里即可，相机由 Stage 驱动；参数见 index.ts 的 params。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {BLACKHOLE_FRAG, BLACKHOLE_VERT} from './blackhole.glsl';

export type BlackHoleProps = {
  diskGain?: number; // 吸积盘亮度
  spin?: number; // 盘的转速倍数
  steps?: number; // 光线步进最大步数（质量 / 速度）
  nearDimming?: boolean; // 镜头靠近时自动压亮度，防过曝
  seed?: number; // 种子：每个视频用不同的值，星云和吸积盘纹理就不同
};

export const BlackHoleAsset: React.FC<BlackHoleProps> = ({diskGain = 0.55, spin = 1, steps = 320, nearDimming = true, seed = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {camera} = useThree();
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: BLACKHOLE_VERT,
        fragmentShader: BLACKHOLE_FRAG,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uTime: {value: 0},
          uCamPos: {value: new THREE.Vector3()},
          uCamWorld: {value: new THREE.Matrix4()},
          uProjInv: {value: new THREE.Matrix4()},
          uDiskGain: {value: diskGain},
          uSpin: {value: spin},
          uSteps: {value: steps},
          uNearGain: {value: 1},
          // 种子 → 三个 0–10 的偏移量（同一种子永远同一个值）
          uSeed: {value: new THREE.Vector3(((seed * 0.6180339) % 1) * 10, ((seed * 0.4142135) % 1) * 10, ((seed * 0.7320508) % 1) * 10)},
        },
      }),
    [diskGain, spin, steps, seed],
  );
  const u = mat.uniforms;
  u.uTime.value = frame / fps;
  u.uCamPos.value.copy(camera.position);
  u.uCamWorld.value.copy(camera.matrixWorld);
  u.uProjInv.value.copy(camera.projectionMatrixInverse);
  const dist = camera.position.length();
  u.uNearGain.value = nearDimming ? 0.5 + 0.5 * Math.min(1, Math.max(0, (dist - 18) / 40)) : 1;
  return (
    <mesh frustumCulled={false} material={mat} renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
};
