// Stage：一个镜头的 3D 舞台 = ThreeCanvas + 按帧设置的相机 + 按配置开关的后期链。
// 后期全部用 postprocessing 原生 Effect 组装（不用 @react-three/postprocessing 的 DepthOfField：
// Remotion 截帧时它会让物体整个消失）；景深用 film/lensblur（确定性 gather），颗粒用 film/GrainEffect（按帧 seed）。
// 色调映射放在后期（场景渲染保持线性 HDR），所以发光体可以 >1，辉光阈值 1.0 只抓真正的高光。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {EffectComposer} from '@react-three/postprocessing';
import {BlendFunction, BloomEffect, ChromaticAberrationEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect} from 'postprocessing';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {LensBlur, GrainEffect} from '../../grok3d/film/lensblur';
import type {PostConfig, CameraConfig} from '../shot';
import {poseAt, type CameraPose} from '../camera/rigs';

const fwd = new THREE.Vector3();
const fpt = new THREE.Vector3();

const CameraDriver: React.FC<{pose: CameraPose}> = ({pose}) => {
  const {camera} = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  cam.position.set(...pose.pos);
  cam.up.set(Math.sin((pose.roll * Math.PI) / 180), Math.cos((pose.roll * Math.PI) / 180), 0);
  cam.lookAt(...pose.look);
  cam.fov = pose.fov;
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return null;
};

const Post: React.FC<{post: PostConfig; pose: CameraPose}> = ({post, pose}) => {
  const frame = useCurrentFrame();
  const {camera} = useThree();
  const fx = useMemo(() => {
    const toneMode = post.tone === 'agx' ? ToneMappingMode.AGX : post.tone === 'neutral' ? ToneMappingMode.NEUTRAL : ToneMappingMode.ACES_FILMIC;
    return {
      lens: post.dof ? new LensBlur({maxCoC: 24, nearScale: 1.2}) : null,
      bloom: post.bloom
        ? new BloomEffect({blendFunction: BlendFunction.ADD, intensity: post.bloom.intensity, luminanceThreshold: post.bloom.threshold ?? 1.0, luminanceSmoothing: 0.25, mipmapBlur: true, levels: 7, radius: post.bloom.radius ?? 0.7})
        : null,
      chroma: post.chromatic ? new ChromaticAberrationEffect({offset: new THREE.Vector2(post.chromatic, post.chromatic * 0.6), radialModulation: true, modulationOffset: 0.3}) : null,
      tone: new ToneMappingEffect({mode: toneMode}),
      vignette: post.vignette ? new VignetteEffect({offset: 0.3, darkness: post.vignette}) : null,
      grain: post.grain ? new GrainEffect({amount: post.grain, cellPx: 1.4}) : null,
    };
  }, [post]);
  if (fx.lens && post.dof) {
    const cam = camera as THREE.PerspectiveCamera;
    cam.getWorldDirection(fwd);
    fpt.set(...(post.dof.focus ?? pose.look));
    fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
    fx.lens.cInf = post.dof.cInf;
  }
  if (fx.grain) fx.grain.seed = frame;
  return (
    <EffectComposer multisampling={0} frameBufferType={THREE.HalfFloatType}>
      {fx.lens ? <primitive object={fx.lens.pre} dispose={null} /> : <></>}
      {fx.lens ? <primitive object={fx.lens.main} dispose={null} /> : <></>}
      {fx.bloom ? <primitive object={fx.bloom} dispose={null} /> : <></>}
      {fx.chroma ? <primitive object={fx.chroma} dispose={null} /> : <></>}
      <primitive object={fx.tone} dispose={null} />
      {fx.vignette ? <primitive object={fx.vignette} dispose={null} /> : <></>}
      {fx.grain ? <primitive object={fx.grain} dispose={null} /> : <></>}
    </EffectComposer>
  );
};

export const Stage: React.FC<{camera: CameraConfig; post: PostConfig; background?: string; children: React.ReactNode}> = ({camera, post, background = '#000000', children}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const pose = poseAt(camera, frame / fps);
  return (
    <ThreeCanvas
      width={width}
      height={height}
      style={{background}}
      gl={{antialias: false, toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.SRGBColorSpace, powerPreference: 'high-performance'}}
      camera={{fov: pose.fov, near: 0.05, far: 2000, position: pose.pos}}
    >
      <CameraDriver pose={pose} />
      {children}
      <Post post={post} pose={pose} />
    </ThreeCanvas>
  );
};
