// 验收镜头 A：黑洞（吸积盘 + 引力透镜），15 秒，IMAX 宇宙风格。
// 场景 = 一个全屏光线步进 Shader（blackhole.glsl.ts）；相机、后期由引擎 Stage 按 ShotConfig 驱动。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Stage} from '../../engine/core/Stage';
import type {ShotConfig} from '../../engine/shot';
import {BLACKHOLE_FRAG, BLACKHOLE_VERT} from './blackhole.glsl';

export const BLACKHOLE_SHOT: ShotConfig = {
  id: 'cosmos.blackhole.v1',
  renderer: 'threejs',
  style: 'imax_cosmos',
  fps: 30,
  duration: 15,
  camera: {
    preset: 'fly_through',
    keys: [
      // 从斜上方俯看，让吸积盘像旋涡；目标点偏右，把黑洞放在画面左侧三分之一
      {t: 0, pos: [14, 46, 52], look: [9, 0, 3], fov: 40, roll: -6},
      {t: 6, pos: [8, 30, 33], look: [8, 0, 2], fov: 40, roll: -3},
      {t: 11, pos: [2, 20, 22], look: [6.5, 0, 1], fov: 42, roll: 2},
      {t: 15, pos: [-3, 15, 16], look: [5.5, 0, 1], fov: 44, roll: 6},
    ],
  },
  post: {bloom: {intensity: 0.6, threshold: 1.1, radius: 0.55}, tone: 'aces', vignette: 0.55, grain: 0.018, chromatic: 0.0009},
  params: {diskGain: 0.55, spin: 1.0, steps: 320},
  version: '1.0.0',
};

const FullScreenShader: React.FC<{shot: ShotConfig}> = ({shot}) => {
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
          uDiskGain: {value: Number(shot.params?.diskGain ?? 1)},
          uSpin: {value: Number(shot.params?.spin ?? 1)},
          uSteps: {value: Number(shot.params?.steps ?? 260)},
        },
      }),
    [shot],
  );
  const u = mat.uniforms;
  u.uTime.value = frame / fps;
  u.uCamPos.value.copy(camera.position);
  u.uCamWorld.value.copy(camera.matrixWorld);
  u.uProjInv.value.copy(camera.projectionMatrixInverse);
  return (
    <mesh frustumCulled={false} material={mat}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
};

export const BlackHole: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#000'}}>
    <Stage camera={BLACKHOLE_SHOT.camera} post={BLACKHOLE_SHOT.post}>
      <FullScreenShader shot={BLACKHOLE_SHOT} />
    </Stage>
  </AbsoluteFill>
);
