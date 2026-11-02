import React, {useMemo} from 'react';
import {useCurrentFrame, interpolate, spring, useVideoConfig} from 'remotion';
import * as THREE from 'three';

type Props = {
  from: [number, number, number];
  to: [number, number, number];
  color?: string;
  /** Draw progress 0–1; if omitted, animate from `appearAt` */
  progress?: number;
  appearAt?: number;
  duration?: number;
  radius?: number;
  dashed?: boolean;
};

/**
 * Animated bond / link / force line between two points.
 */
export const ConnectionLine: React.FC<Props> = ({
  from,
  to,
  color = '#90caf9',
  progress: progressProp,
  appearAt = 0,
  duration = 25,
  radius = 0.03,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const progress =
    progressProp ??
    spring({
      frame: Math.max(0, frame - appearAt),
      fps,
      durationInFrames: duration,
      config: {damping: 200},
    });

  const {mid, length, quaternion} = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const midPt = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const quat = new THREE.Quaternion();
    quat.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize(),
    );
    return {mid: midPt, length: len, quaternion: quat};
  }, [from, to]);

  const drawnLength = length * progress;

  return (
    <mesh
      position={[mid.x, mid.y, mid.z]}
      quaternion={quaternion}
      scale={[1, progress, 1]}
    >
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.35}
        metalness={0.2}
        roughness={0.4}
        transparent
        opacity={interpolate(progress, [0, 0.15, 1], [0, 1, 1])}
      />
    </mesh>
  );
};
