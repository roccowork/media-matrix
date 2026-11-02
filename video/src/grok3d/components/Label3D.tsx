import React from 'react';
import {Html} from '@react-three/drei';
import {useCurrentFrame, interpolate, spring, useVideoConfig} from 'remotion';

type Props = {
  position: [number, number, number];
  text: string;
  /** Appear from this frame */
  from?: number;
  /** Optional disappear */
  to?: number;
  color?: string;
  background?: string;
  fontSize?: number;
  /** Offset in screen pixels */
  offsetY?: number;
};

/**
 * HTML label pinned to a 3D world position.
 * Good for naming parts (nucleus, electrode, orbit…).
 * Uses drei's <Html> — stays readable regardless of camera angle.
 */
export const Label3D: React.FC<Props> = ({
  position,
  text,
  from = 0,
  to = 9999,
  color = '#ffffff',
  background = 'rgba(10, 14, 23, 0.75)',
  fontSize = 18,
  offsetY = -28,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  if (frame < from || frame > to) return null;

  const local = frame - from;
  const enter = spring({
    frame: local,
    fps,
    config: {damping: 16, stiffness: 120},
  });

  const opacity = interpolate(
    frame,
    [from, from + 10, to - 10, to],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

  return (
    <Html position={position} center style={{pointerEvents: 'none'}}>
      <div
        style={{
          transform: `translateY(${offsetY}px) scale(${0.85 + 0.15 * enter})`,
          opacity,
          color,
          background,
          padding: '6px 12px',
          borderRadius: 8,
          fontFamily: 'system-ui, sans-serif',
          fontSize,
          fontWeight: 600,
          letterSpacing: 0.3,
          whiteSpace: 'nowrap',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(6px)',
        }}
      >
        {text}
      </div>
    </Html>
  );
};
