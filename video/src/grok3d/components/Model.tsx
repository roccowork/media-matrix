import React, {Suspense, useRef} from 'react';
import {useGLTF} from '@react-three/drei';
import {useCurrentFrame, interpolate, spring, useVideoConfig} from 'remotion';
import * as THREE from 'three';

type Props = {
  /** Path under public/, e.g. "/models/cell.glb" */
  src: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  /** Auto-rotate around Y (radians per frame) */
  autoRotateY?: number;
  /** Entrance animation */
  entrance?: 'none' | 'scale' | 'fade-up';
  castShadow?: boolean;
  receiveShadow?: boolean;
};

function LoadedModel({
  src,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  autoRotateY = 0,
  entrance = 'scale',
  castShadow = true,
  receiveShadow = true,
}: Props) {
  const {scene} = useGLTF(src);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ref = useRef<THREE.Group>(null);

  // Clone so multiple instances don't share transforms
  const cloned = React.useMemo(() => scene.clone(true), [scene]);

  const enter = spring({
    frame,
    fps,
    config: {damping: 16, stiffness: 90, mass: 0.8},
  });

  let finalScale = scale;
  let yOffset = 0;

  if (entrance === 'scale') {
    const s = Array.isArray(scale) ? scale : [scale, scale, scale];
    finalScale = [s[0] * enter, s[1] * enter, s[2] * enter];
  } else if (entrance === 'fade-up') {
    yOffset = interpolate(enter, [0, 1], [0.6, 0]);
  }

  const rotY = rotation[1] + frame * autoRotateY;

  return (
    <group
      ref={ref}
      position={[position[0], position[1] + yOffset, position[2]]}
      rotation={[rotation[0], rotY, rotation[2]]}
      scale={finalScale}
    >
      <primitive
        object={cloned}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
      />
    </group>
  );
}

/**
 * Safe GLB loader with Suspense fallback.
 * Put models in public/models/ and pass src="/models/xxx.glb".
 */
export const Model: React.FC<Props> = (props) => {
  return (
    <Suspense fallback={null}>
      <LoadedModel {...props} />
    </Suspense>
  );
};

// Preload helper — call in parent if you know the path early
export const preloadModel = (src: string) => {
  useGLTF.preload(src);
};
