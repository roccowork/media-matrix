// 验收镜头 A：黑洞（吸积盘 + 引力透镜），15 秒，IMAX 宇宙风格。
// 场景 = 一个全屏光线步进 Shader（blackhole.glsl.ts）；相机、后期由引擎 Stage 按 ShotConfig 驱动。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {AbsoluteFill, random, useCurrentFrame, useVideoConfig} from 'remotion';
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
  post: {bloom: {intensity: 0.65, threshold: 1.15, radius: 0.45}, tone: 'aces', vignette: 0.55, grain: 0.018, chromatic: 0.0009},
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
          uNearGain: {value: 1},
        },
      }),
    [shot],
  );
  const u = mat.uniforms;
  u.uTime.value = frame / fps;
  u.uCamPos.value.copy(camera.position);
  u.uCamWorld.value.copy(camera.matrixWorld);
  u.uProjInv.value.copy(camera.projectionMatrixInverse);
  // 镜头离黑洞越近，盘的亮度越往下压（防止最后几秒内圈过曝成一片白）
  const dist = camera.position.length();
  u.uNearGain.value = 0.5 + 0.5 * Math.min(1, Math.max(0, (dist - 18) / 40));
  return (
    <mesh frustumCulled={false} material={mat} renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
};

const Dust: React.FC = () => {
  const {geom, tex} = useMemo(() => {
    const n = 2600;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      // 在镜头飞行路线附近的一个斜长盒子里（从 (14,46,52) 到 (-3,15,16)）
      const t = random(`dt${i}`);
      const cx = 14 - 17 * t, cy = 46 - 31 * t, cz = 52 - 36 * t;
      pos[i * 3] = cx + (random(`dx${i}`) - 0.5) * 16;
      pos[i * 3 + 1] = cy + (random(`dy${i}`) - 0.5) * 9;
      pos[i * 3 + 2] = cz + (random(`dz${i}`) - 0.5) * 16;
      const warm = random(`dc${i}`) > 0.5;
      const b = 0.4 + random(`db${i}`) * 1.6;
      col[i * 3] = (warm ? 1.0 : 0.45) * b;
      col[i * 3 + 1] = (warm ? 0.7 : 0.75) * b;
      col[i * 3 + 2] = (warm ? 0.4 : 1.0) * b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d')!;
    const r = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = r;
    x.fillRect(0, 0, 64, 64);
    return {geom: g, tex: new THREE.CanvasTexture(c)};
  }, []);
  return (
    <points geometry={geom} frustumCulled={false}>
      <pointsMaterial map={tex} size={0.06} sizeAttenuation vertexColors transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
    </points>
  );
};

export const BlackHole: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#000'}}>
    <Stage camera={BLACKHOLE_SHOT.camera} post={BLACKHOLE_SHOT.post}>
      <FullScreenShader shot={BLACKHOLE_SHOT} />
      <Dust />
    </Stage>
  </AbsoluteFill>
);
