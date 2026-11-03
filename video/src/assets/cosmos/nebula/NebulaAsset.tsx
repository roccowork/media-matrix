// 资产 cosmos.nebula.v1：体积星云 + 星空背景。镜头可以在外面看，也可以飞进去；参数见 registry.ts。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
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
  core?: [number, number, number]; // 发光核心位置（相对星云中心、以半径为单位）
  seed?: string | number;
};

const seedVec = (seed: string | number) => {
  const n = typeof seed === 'number' ? seed : [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 100003, 7);
  return new THREE.Vector3(((n * 0.6180339) % 1) * 20, ((n * 0.4142135) % 1) * 20, ((n * 0.7320508) % 1) * 20);
};

export const NebulaAsset: React.FC<NebulaProps> = ({center = [0, 0, 0], radius = 20, warm = '#ff7a2f', cool = '#2f7bff', density = 1, dust = 1, gain = 1, stars = 1, steps = 96, core = [0.15, 0.05, 0.1], seed = 'nebula'}) => {
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
          uSeed: {value: seedVec(seed)}, uSteps: {value: steps}, uCore: {value: new THREE.Vector3(...core)},
        },
      }),
    [center, radius, warm, cool, density, dust, gain, stars, steps, core, seed],
  );
  const u = mat.uniforms;
  u.uTime.value = frame / fps;
  u.uCamPos.value.copy(camera.position);
  u.uCamWorld.value.copy(camera.matrixWorld);
  u.uProjInv.value.copy(camera.projectionMatrixInverse);
  const cluster = useMemo(() => {
    const n = 140;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const sk = String(seed);
    for (let i = 0; i < n; i++) {
      const r = Math.pow(random(`${sk}cr${i}`), 2.2) * radius * 0.12;
      const th = random(`${sk}ct${i}`) * Math.PI * 2, ph = Math.acos(2 * random(`${sk}cp${i}`) - 1);
      pos[i * 3] = center[0] + core[0] * radius + r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = center[1] + core[1] * radius + r * Math.cos(ph);
      pos[i * 3 + 2] = center[2] + core[2] * radius + r * Math.sin(ph) * Math.sin(th);
      const b = 0.8 + Math.pow(random(`${sk}cb${i}`), 6) * 8;
      const blue = random(`${sk}cc${i}`) > 0.4;
      col.set(blue ? [0.75 * b, 0.85 * b, 1.0 * b] : [1.0 * b, 0.85 * b, 0.65 * b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d')!;
    const rg = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.15, 'rgba(255,255,255,0.6)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = rg;
    x.fillRect(0, 0, 64, 64);
    return {g, tex: new THREE.CanvasTexture(c)};
  }, [center, radius, core, seed]);
  return (
    <>
      <mesh frustumCulled={false} material={mat} renderOrder={-2}>
        <planeGeometry args={[2, 2]} />
      </mesh>
      <points geometry={cluster.g} frustumCulled={false} renderOrder={-1}>
        <pointsMaterial map={cluster.tex} size={radius * 0.006} sizeAttenuation vertexColors transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
    </>
  );
};
