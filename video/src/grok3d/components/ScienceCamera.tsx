import React from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {CameraMode, getCameraPose} from '../presets/camera';

type Props = {
  mode?: CameraMode;
  target?: [number, number, number];
  radius?: number;
  height?: number;
  fov?: number;
};

/**
 * Imperatively drives the R3F camera from Remotion's frame.
 * Must live inside <ThreeCanvas>.
 */
export const ScienceCamera: React.FC<Props> = ({
  mode = 'orbit-and-dolly',
  target = [0, 0, 0],
  radius = 6,
  height = 1.8,
  fov = 45,
}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const {camera} = useThree();

  // 修：原版在 useEffect 里改相机，Remotion 截帧时相机不动、3D 标签错位；改成渲染时直接设。
  {
    const pose = getCameraPose({
      frame,
      fps,
      durationInFrames,
      mode,
      target,
      radius,
      height,
      fov,
    });

    camera.position.set(...pose.position);
    camera.lookAt(...pose.lookAt);
    (camera as THREE.PerspectiveCamera).fov = pose.fov;
    camera.updateProjectionMatrix();
  }

  return null;
};
