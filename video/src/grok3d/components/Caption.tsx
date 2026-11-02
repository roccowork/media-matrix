import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig} from 'remotion';

type Props = {
  text: string;
  from?: number;
  to?: number;
  /** bottom | top | center */
  position?: 'bottom' | 'top' | 'center';
  fontSize?: number;
  color?: string;
  /** Optional smaller subtitle under main text */
  sub?: string;
};

/**
 * 2D caption overlay (lives outside ThreeCanvas).
 * Place next to <ScienceScene> inside AbsoluteFill.
 */
export const Caption: React.FC<Props> = ({
  text,
  from = 0,
  to = 9999,
  position = 'bottom',
  fontSize = 36,
  color = '#ffffff',
  sub,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  if (frame < from || frame > to) return null;

  const local = frame - from;
  const enter = spring({
    frame: local,
    fps,
    config: {damping: 16, stiffness: 100},
  });

  const opacity = interpolate(
    frame,
    [from, from + 12, to - 12, to],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

  const justify =
    position === 'top'
      ? 'flex-start'
      : position === 'center'
        ? 'center'
        : 'flex-end';

  return (
    <AbsoluteFill
      style={{
        justifyContent: justify,
        alignItems: 'center',
        paddingTop: position === 'top' ? 64 : 0,
        paddingBottom: position === 'bottom' ? 72 : 0,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${(1 - enter) * 16}px)`,
          textAlign: 'center',
          maxWidth: '80%',
        }}
      >
        <div
          style={{
            color,
            fontFamily: 'system-ui, sans-serif',
            fontSize,
            fontWeight: 600,
            letterSpacing: 0.4,
            textShadow: '0 4px 28px rgba(0,0,0,0.65)',
          }}
        >
          {text}
        </div>
        {sub && (
          <div
            style={{
              marginTop: 10,
              color: 'rgba(255,255,255,0.7)',
              fontFamily: 'system-ui, sans-serif',
              fontSize: fontSize * 0.55,
              fontWeight: 400,
            }}
          >
            {sub}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
