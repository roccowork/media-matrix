import React, {useMemo} from 'react';
import {useCurrentFrame, interpolate, spring, useVideoConfig} from 'remotion';
import * as THREE from 'three';

type Part = {
  /** Unique key */
  id: string;
  /** Rest position (assembled) */
  position: [number, number, number];
  /** Direction to fly out when exploded (will be normalized * distance) */
  explodeDir?: [number, number, number];
  /** How far it flies (world units) */
  distance?: number;
  children: React.ReactNode;
};

type Props = {
  /** 0 = assembled, 1 = fully exploded. Driven by parent or internal timeline */
  progress?: number;
  /** If progress not passed, animate between these frames */
  from?: number;
  to?: number;
  /** Reverse: start exploded, assemble */
  reverse?: boolean;
  parts: Part[];
};

/**
 * Disassemble / reassemble animation for multi-part subjects.
 * Each part flies along explodeDir as progress goes 0→1.
 */
export const Explode: React.FC<Props> = ({
  progress: progressProp,
  from = 0,
  to = 60,
  reverse = false,
  parts,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  let progress =
    progressProp ??
    interpolate(frame, [from, to], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

  if (reverse) progress = 1 - progress;

  // Soft spring feel near the ends
  const eased = spring({
    frame: Math.round(progress * 30),
    fps,
    config: {damping: 20, stiffness: 80},
  });
  // Blend linear progress with a touch of spring for organic feel
  const t = progress * 0.7 + eased * 0.3 * Math.min(1, progress * 2);

  return (
    <group>
      {parts.map((part, i) => {
        const dir = part.explodeDir ?? [
          Math.sin(i * 2.1),
          0.4 + (i % 3) * 0.15,
          Math.cos(i * 1.7),
        ];
        const len = Math.sqrt(dir[0] ** 2 + dir[1] ** 2 + dir[2] ** 2) || 1;
        const dist = part.distance ?? 1.8;
        const offset: [number, number, number] = [
          (dir[0] / len) * dist * t,
          (dir[1] / len) * dist * t,
          (dir[2] / len) * dist * t,
        ];

        return (
          <group
            key={part.id}
            position={[
              part.position[0] + offset[0],
              part.position[1] + offset[1],
              part.position[2] + offset[2],
            ]}
          >
            {part.children}
          </group>
        );
      })}
    </group>
  );
};
