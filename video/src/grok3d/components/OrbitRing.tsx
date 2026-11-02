import React from 'react';
import {useCurrentFrame} from 'remotion';

type Props = {
  radius?: number;
  /** Inclination in radians */
  tilt?: number;
  color?: string;
  opacity?: number;
  /** Thickness of the ring line */
  lineWidth?: number;
  /** Optional satellite mesh that orbits */
  satellite?: React.ReactNode;
  /** Orbit speed (radians per frame) */
  speed?: number;
  /** Starting angle */
  phase?: number;
  /** Y offset of the whole ring */
  y?: number;
};

/**
 * Orbital ring + optional satellite. Good for atoms, planets, electrons, moons.
 */
export const OrbitRing: React.FC<Props> = ({
  radius = 2.2,
  tilt = 0.35,
  color = '#6ec6ff',
  opacity = 0.45,
  satellite,
  speed = 0.02,
  phase = 0,
  y = 0,
}) => {
  const frame = useCurrentFrame();
  const angle = phase + frame * speed;
  const sx = Math.cos(angle) * radius;
  const sz = Math.sin(angle) * radius;

  // Ring as a thin torus (more reliable than Line in R3F without extra deps)
  return (
    <group position={[0, y, 0]} rotation={[tilt, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.012, 8, 96]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>
      {satellite && (
        <group position={[sx, 0, sz]}>{satellite}</group>
      )}
    </group>
  );
};
