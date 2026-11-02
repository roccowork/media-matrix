import React, {useMemo} from 'react';
import {useCurrentFrame, interpolate} from 'remotion';
import * as THREE from 'three';

type Props = {
  /** Control points of the path (world space) */
  points: [number, number, number][];
  /** Number of moving particles */
  count?: number;
  /** Particle size */
  size?: number;
  color?: string;
  /** How fast particles travel 0–1 along the path per frame */
  speed?: number;
  /** Trail opacity falloff */
  tubeRadius?: number;
  /** Show a faint tube along the path */
  showTube?: boolean;
  tubeColor?: string;
  tubeOpacity?: number;
};

/**
 * Particles flowing along a 3D path — signals, energy, blood flow, data, etc.
 * Path is a simple Catmull-Rom through the given points.
 */
export const PathFlow: React.FC<Props> = ({
  points,
  count = 24,
  size = 0.08,
  color = '#40c4ff',
  speed = 0.006,
  showTube = true,
  tubeRadius = 0.025,
  tubeColor = '#40c4ff',
  tubeOpacity = 0.25,
}) => {
  const frame = useCurrentFrame();

  const curve = useMemo(() => {
    const pts = points.map((p) => new THREE.Vector3(...p));
    return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  }, [points]);

  const particlePositions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = (frame * speed + i / count) % 1;
      const p = curve.getPointAt(u);
      arr[i * 3] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    }
    return arr;
  }, [frame, curve, count, speed]);

  const tubeGeom = useMemo(() => {
    if (!showTube) return null;
    return new THREE.TubeGeometry(curve, 64, tubeRadius, 8, false);
  }, [curve, showTube, tubeRadius]);

  return (
    <group>
      {showTube && tubeGeom && (
        <mesh geometry={tubeGeom}>
          <meshBasicMaterial
            color={tubeColor}
            transparent
            opacity={tubeOpacity}
            depthWrite={false}
          />
        </mesh>
      )}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[particlePositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color={color}
          size={size}
          sizeAttenuation
          transparent
          opacity={0.95}
          depthWrite={false}
        />
      </points>
    </group>
  );
};
