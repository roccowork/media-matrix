import React from 'react';
import {useCurrentFrame, interpolate} from 'remotion';

type Props = {
  /** Origin */
  position?: [number, number, number];
  color?: string;
  /** Frames between each new wave */
  interval?: number;
  /** How long one wave lives */
  lifetime?: number;
  /** Max radius */
  maxRadius?: number;
  /** Ring thickness */
  thickness?: number;
  /** How many concurrent waves */
  count?: number;
};

/**
 * Expanding ripple rings — impact, signal broadcast, shockwave, heartbeat.
 */
export const PulseWave: React.FC<Props> = ({
  position = [0, 0, 0],
  color = '#40c4ff',
  interval = 30,
  lifetime = 50,
  maxRadius = 3.5,
  thickness = 0.04,
  count = 3,
}) => {
  const frame = useCurrentFrame();

  return (
    <group position={position} rotation={[Math.PI / 2, 0, 0]}>
      {Array.from({length: count}).map((_, i) => {
        const local = (frame - i * interval) % (interval * count);
        if (local < 0 || local > lifetime) return null;

        const t = local / lifetime;
        const radius = interpolate(t, [0, 1], [0.15, maxRadius]);
        const opacity = interpolate(t, [0, 0.15, 1], [0, 0.7, 0]);

        return (
          <mesh key={i}>
            <torusGeometry args={[radius, thickness, 8, 64]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={opacity}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
};
