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
      {t: 0, pos: [10, 7, 72], look: [0, 0, 0], fov: 36, roll: -4},
      {t: 5, pos: [5, 3.4, 34], look: [0, 0, 0], fov: 36, roll: -2},
      {t: 10, pos: [-5, 1.9, 19], look: [0, 0, 0], fov: 38, roll: 5},
      {t: 15, pos: [-13, 0.9, 10.5], look: [0, 0.2, 0], fov: 40, roll: 11},
    ],
  },
  post: {bloom: {intensity: 0.55, threshold: 1.3, radius: 0.6}, tone: 'aces', vignette: 0.55, grain: 0.018, chromatic: 0.0009},
  params: {diskGain: 0.2, spin: 1.0, steps: 260},
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
