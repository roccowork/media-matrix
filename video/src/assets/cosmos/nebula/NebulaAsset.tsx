// 资产 cosmos.nebula.v1：体积星云 + 星空背景。镜头可以在外面看，也可以飞进去；参数见 registry.ts。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {NEBULA_FRAG, NEBULA_VERT} from './nebula.glsl';
import type {Vec3} from '../../../engine/shot';

export type NebulaProps = {
  center?: Vec3;
  radius?: number;
  warm?: string;
  cool?: string;
  density?: number;
  dust?: number;
  gain?: number;
  stars?: number;
  steps?: number;
  seed?: string | number;
};

const seedVec = (seed: string | number) => {
  const n = typeof seed === 'number' ? seed : [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 100003, 7);
  return new THREE.Vector3(((n * 0.6180339) % 1) * 20, ((n * 0.4142135) % 1) * 20, ((n * 0.7320508) % 1) * 20);
};

export const NebulaAsset: React.FC<NebulaProps> = ({center = [0, 0, 0], radius = 20, warm = '#ff7a2f', cool = '#2f7bff', density = 1, dust = 1, gain = 1, stars = 1, steps = 96, seed = 'nebula'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {camera} = useThree();
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: NEBULA_VERT,
        fragmentShader: NEBULA_FRAG,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uCamPos: {value: new THREE.Vector3()}, uCamWorld: {value: new THREE.Matrix4()}, uProjInv: {value: new THREE.Matrix4()}, uTime: {value: 0},
          uCenter: {value: new THREE.Vector3(...center)}, uRadius: {value: radius},
          uWarm: {value: new THREE.Color(warm)}, uCool: {value: new THREE.Color(cool)},
          uDensity: {value: density}, uDust: {value: dust}, uGain: {value: gain}, uStars: {value: stars},
          uSeed: {value: seedVec(seed)}, uSteps: {value: steps},
        },
      }),
    [center, radius, warm, cool, density, dust, gain, stars, steps, seed],
  );
  const u = mat.uniforms;
  u.uTime.value = frame / fps;
  u.uCamPos.value.copy(camera.position);
  u.uCamWorld.value.copy(camera.matrixWorld);
  u.uProjInv.value.copy(camera.projectionMatrixInverse);
  return (
    <mesh frustumCulled={false} material={mat} renderOrder={-2}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
};
