import React, {useMemo} from 'react';
import {ThreeCanvas} from '@remotion/three';
import {useVideoConfig} from 'remotion';
import {StudioLights, LightingPreset} from '../presets/lighting';
import {ScienceCamera} from './ScienceCamera';
import {CameraMode} from '../presets/camera';
import {Ground} from './Ground';
import {GridFloor} from './GridFloor';
import {ParticleField} from './ParticleField';
import {Bloom, DepthOfField, EffectComposer, Noise, Vignette} from '@react-three/postprocessing';
import * as THREE from 'three';

type Props = {
  children: React.ReactNode;
  /** Visual mood */
  lighting?: LightingPreset;
  /** Camera language */
  camera?: CameraMode;
  /** What the camera looks at */
  lookAt?: [number, number, number];
  /** Camera distance baseline */
  radius?: number;
  /** Camera height */
  height?: number;
  fov?: number;
  /** Show subtle ground disc */
  ground?: boolean;
  /** Technical grid floor (overrides soft ground when true) */
  grid?: boolean;
  /** Background particles for depth */
  particles?: boolean;
  particleColor?: string;
  /** Extra canvas style (e.g. background override) */
  style?: React.CSSProperties;
  /** 新增：电影感后期（辉光 + 景深 + 暗角 + 颗粒） */
  post?: boolean;
  /** 景深对焦点（世界坐标） */
  focus?: [number, number, number];
  bloom?: number;
  bokeh?: number;
  particleCount?: number;
  /** 景深。注意：在 Remotion 截帧下不稳定（焦点变化时物体会整个消失），默认关；纵深感靠雾 + 透视 */
  dof?: boolean;
  /** 直接指定相机位姿（优先于 camera 模式） */
  cameraPose?: {position: [number, number, number]; lookAt: [number, number, number]; fov: number};
};

/**
 * One-stop 3D stage for science explainers.
 *
 * Usage:
 *   <ScienceScene lighting="tech" camera="orbit-and-dolly">
 *     <PrimitiveSubject />
 *     // or <Model src="/models/xxx.glb" />
 *   </ScienceScene>
 */
export const ScienceScene: React.FC<Props> = ({
  children,
  lighting = 'tech',
  camera = 'orbit-and-dolly',
  lookAt = [0, 0, 0],
  radius = 6,
  height = 1.8,
  fov = 45,
  ground = true,
  grid = false,
  particles = true,
  particleColor,
  style,
  post = false,
  focus,
  bloom = 1.2,
  bokeh = 4,
  particleCount,
  dof = false,
  cameraPose,
}) => {
  const {width, height: videoHeight} = useVideoConfig();
  // 景深对焦点：复用同一个 Vector3、每帧改值（每帧 new 一个会让 DepthOfField 出错，远处物体整个消失）
  const focusVec = useMemo(() => new THREE.Vector3(), []);
  focusVec.set(...(focus ?? lookAt));

  return (
    <ThreeCanvas
      width={width}
      height={videoHeight}
      style={style}
      camera={{fov, position: [0, height, radius]}}
    >
      <StudioLights preset={lighting} />
      <ScienceCamera
        mode={camera}
        target={lookAt}
        radius={radius}
        height={height}
        fov={fov}
        pose={cameraPose}
      />

      {ground && !grid && <Ground />}
      {grid && <GridFloor />}
      {particles && (
        <ParticleField
          count={particleCount}
          color={
            particleColor ??
            (lighting === 'bio'
              ? '#a5d6a7'
              : lighting === 'space'
                ? '#b388ff'
                : '#6ec6ff')
          }
        />
      )}

      {/* Soft fill from below so models don't sit in pure black */}
      <hemisphereLight args={['#ffffff', '#111111', 0.15]} />

      {children}

      {post && (
        <EffectComposer multisampling={0}>
          {dof ? <DepthOfField focusDistance={0} focalLength={0.05} bokehScale={bokeh} target={focusVec} /> : <></>}
          <Bloom intensity={bloom} luminanceThreshold={0.7} luminanceSmoothing={0.3} mipmapBlur radius={0.75} />
          <Vignette offset={0.25} darkness={0.75} />
          <Noise opacity={0.035} />
        </EffectComposer>
      )}
    </ThreeCanvas>
  );
};
