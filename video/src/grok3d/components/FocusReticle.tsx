import React from 'react';
import {useCurrentFrame, interpolate, spring, useVideoConfig} from 'remotion';

type Props = {
  position?: [number, number, number];
  from?: number;
  to?: number;
  color?: string;
  size?: number;
};

/**
 * Cinematic focus brackets that appear around a point of interest.
 * Purely visual guide — pairs well with Highlight + camera push-in.
 */
export const FocusReticle: React.FC<Props> = ({
  position = [0, 0, 0],
  from = 0,
  to = 90,
  color = '#40c4ff',
  size = 0.9,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  if (frame < from || frame > to) return null;

  const local = frame - from;
  const enter = spring({
    frame: local,
    fps,
    config: {damping: 14, stiffness: 100},
  });

  const opacity = interpolate(
    frame,
    [from, from + 8, to - 10, to],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

  const arm = size * 0.35;
  const gap = size * 0.55 * (1.4 - 0.4 * enter);

  const corners: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];

  return (
    <group position={position} scale={enter}>
      {corners.map(([cx, cy], i) => (
        <group key={i} position={[cx * gap, cy * gap, 0]}>
          {/* horizontal tick */}
          <mesh position={[(-cx * arm) / 2, 0, 0]}>
            <boxGeometry args={[arm, 0.025, 0.025]} />
            <meshBasicMaterial color={color} transparent opacity={opacity} />
          </mesh>
          {/* vertical tick */}
          <mesh position={[0, (-cy * arm) / 2, 0]}>
            <boxGeometry args={[0.025, arm, 0.025]} />
            <meshBasicMaterial color={color} transparent opacity={opacity} />
          </mesh>
        </group>
      ))}
    </group>
  );
};
