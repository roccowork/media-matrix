import React from 'react';
import {useCurrentFrame, interpolate} from 'remotion';

type Props = {
  radius?: number;
  color?: string;
  opacity?: number;
  /** Wireframe style */
  wireframe?: boolean;
  /** Breathing scale amplitude */
  breathe?: number;
  position?: [number, number, number];
  /** Segments */
  detail?: number;
};

/**
 * Semi-transparent shell / atmosphere / membrane / energy field.
 * Stack multiple for layered structures (Earth atmosphere, cell wall…).
 */
export const Shell: React.FC<Props> = ({
  radius = 2,
  color = '#4fc3f7',
  opacity = 0.12,
  wireframe = false,
  breathe = 0.02,
  position = [0, 0, 0],
  detail = 48,
}) => {
  const frame = useCurrentFrame();
  const scale = 1 + Math.sin(frame * 0.04) * breathe;

  return (
    <mesh position={position} scale={scale}>
      <sphereGeometry args={[radius, detail, detail]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={opacity}
        wireframe={wireframe}
        side={2} // DoubleSide
        depthWrite={false}
        metalness={0.1}
        roughness={0.6}
      />
    </mesh>
  );
};
