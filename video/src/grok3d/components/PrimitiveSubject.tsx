import React from 'react';
import {useCurrentFrame, spring, useVideoConfig, interpolate} from 'remotion';
import {highlightMaterial} from './Highlight';

type Shape = 'sphere' | 'box' | 'torus' | 'icosahedron' | 'cylinder';

type Props = {
  shape?: Shape;
  color?: string;
  position?: [number, number, number];
  scale?: number;
  /** Enable highlight window */
  highlightFrom?: number;
  highlightTo?: number;
  highlightColor?: string;
  metalness?: number;
  roughness?: number;
  /** Slow idle rotation */
  spin?: number;
  /** Entrance spring */
  entrance?: boolean;
};

/**
 * Built-in geometric subject so you can preview the skeleton
 * without any external GLB. Replace with <Model> when ready.
 */
export const PrimitiveSubject: React.FC<Props> = ({
  shape = 'icosahedron',
  color = '#8ab4f8',
  position = [0, 0, 0],
  scale = 1.4,
  highlightFrom = 40,
  highlightTo = 140,
  highlightColor = '#4fc3f7',
  metalness = 0.35,
  roughness = 0.35,
  spin = 0.008,
  entrance = true,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const enter = entrance
    ? spring({frame, fps, config: {damping: 14, stiffness: 80}})
    : 1;

  const mat = highlightMaterial({
    frame,
    from: highlightFrom,
    to: highlightTo,
    baseColor: color,
    highlightColor,
    metalness,
    roughness,
  });

  const geometry = (() => {
    switch (shape) {
      case 'sphere':
        return <sphereGeometry args={[1, 48, 48]} />;
      case 'box':
        return <boxGeometry args={[1.6, 1.6, 1.6]} />;
      case 'torus':
        return <torusGeometry args={[1, 0.35, 32, 64]} />;
      case 'cylinder':
        return <cylinderGeometry args={[0.7, 0.7, 1.8, 32]} />;
      case 'icosahedron':
      default:
        return <icosahedronGeometry args={[1, 1]} />;
    }
  })();

  return (
    <mesh
      position={position}
      scale={scale * enter}
      rotation={[frame * spin * 0.4, frame * spin, frame * spin * 0.2]}
      castShadow
      receiveShadow
    >
      {geometry}
      <meshStandardMaterial {...mat} />
    </mesh>
  );
};
