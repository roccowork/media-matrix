import React, {useMemo, useRef} from 'react';
import {useCurrentFrame} from 'remotion';
import * as THREE from 'three';

type Props = {
  count?: number;
  radius?: number;
  size?: number;
  color?: string;
  /** Drift speed */
  speed?: number;
};

/**
 * Lightweight background particles for depth / atmosphere.
 * All motion is frame-driven (deterministic).
 */
export const ParticleField: React.FC<Props> = ({
  count = 120,
  radius = 10,
  size = 0.035,
  color = '#6ec6ff',
  speed = 0.004,
}) => {
  const frame = useCurrentFrame();
  const points = useRef<THREE.Points>(null);

  const {positions, phases} = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const ph = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Pseudo-random but deterministic seed from index
      const s = Math.sin(i * 12.9898) * 43758.5453;
      const r = s - Math.floor(s);
      const theta = r * Math.PI * 2;
      const phi = Math.acos(2 * ((s * 1.17) % 1) - 1);
      const rad = radius * (0.4 + ((s * 2.3) % 1) * 0.6);
      pos[i * 3] = rad * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = rad * Math.sin(phi) * Math.sin(theta) * 0.6;
      pos[i * 3 + 2] = rad * Math.cos(phi);
      ph[i] = r * Math.PI * 2;
    }
    return {positions: pos, phases: ph};
  }, [count, radius]);

  // Update Y drift each frame
  const livePositions = useMemo(() => {
    const out = new Float32Array(positions);
    for (let i = 0; i < count; i++) {
      out[i * 3 + 1] =
        positions[i * 3 + 1] + Math.sin(frame * speed + phases[i]) * 0.35;
    }
    return out;
  }, [frame, positions, phases, count, speed]);

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[livePositions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={size}
        sizeAttenuation
        transparent
        opacity={0.7}
        depthWrite={false}
      />
    </points>
  );
};
