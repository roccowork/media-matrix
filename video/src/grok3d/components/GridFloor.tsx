import React from 'react';

type Props = {
  size?: number;
  divisions?: number;
  color?: string;
  y?: number;
  opacity?: number;
};

/**
 * Subtle technical grid under the subject (optional alternative to Ground).
 */
export const GridFloor: React.FC<Props> = ({
  size = 16,
  divisions = 32,
  color = '#1e3a5f',
  y = -1.55,
  opacity = 0.5,
}) => {
  return (
    <group position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <gridHelper args={[size, divisions, color, color]} />
      {/* Fade the helper a bit via a transparent plane mask feel — gridHelper
          color is fixed; we keep it minimal */}
      <mesh>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial
          color="#000000"
          transparent
          opacity={1 - opacity}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};
