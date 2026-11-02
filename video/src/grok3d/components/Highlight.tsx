import React, {useRef} from 'react';
import {useCurrentFrame, interpolate, spring, useVideoConfig} from 'remotion';
import * as THREE from 'three';

type Props = {
  /** Local frame range (relative to parent Sequence) where highlight is active */
  from?: number;
  to?: number;
  color?: string;
  intensity?: number;
  /** Pulse amplitude 0–1 */
  pulse?: number;
  children: React.ReactNode;
};

/**
 * Wraps any mesh / group and adds emissive pulse + slight scale breath
 * while the highlight window is active. Great for guiding attention.
 */
export const Highlight: React.FC<Props> = ({
  from = 0,
  to = 9999,
  color = '#4fc3f7',
  intensity = 0.6,
  pulse = 0.35,
  children,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const group = useRef<THREE.Group>(null);

  const active = frame >= from && frame <= to;
  const local = Math.max(0, frame - from);

  const enter = spring({
    frame: local,
    fps,
    config: {damping: 18, stiffness: 120},
  });

  const pulseVal = active
    ? 1 + Math.sin(local * 0.12) * pulse * enter
    : 1;

  const emissiveIntensity = active
    ? intensity * enter * (0.7 + 0.3 * Math.sin(local * 0.15))
    : 0;

  // Apply scale on the group
  const scale = active ? interpolate(enter, [0, 1], [1, 1.04]) * pulseVal : 1;

  return (
    <group ref={group} scale={scale}>
      {/* We clone materials via a simple emissive overlay approach:
          children keep their own materials; we add a subtle point light
          near the subject to sell the "glow" without fighting material ownership. */}
      {active && (
        <pointLight
          color={color}
          intensity={emissiveIntensity * 2.5}
          distance={4}
          decay={2}
        />
      )}
      {children}
    </group>
  );
};

/**
 * Convenience material helper — use on a mesh when you control the material.
 * Example:
 *   <meshStandardMaterial {...highlightMaterial({frame, from, to})} />
 */
export function highlightMaterial(opts: {
  frame: number;
  from?: number;
  to?: number;
  baseColor?: string;
  highlightColor?: string;
  metalness?: number;
  roughness?: number;
}) {
  const {
    frame,
    from = 0,
    to = 9999,
    baseColor = '#cccccc',
    highlightColor = '#4fc3f7',
    metalness = 0.2,
    roughness = 0.45,
  } = opts;

  const active = frame >= from && frame <= to;
  const t = active ? interpolate(frame, [from, from + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }) : 0;

  return {
    color: baseColor,
    emissive: highlightColor,
    emissiveIntensity: t * (0.55 + 0.25 * Math.sin((frame - from) * 0.14)),
    metalness,
    roughness,
  };
}
