import React from 'react';

type Props = {
  size?: number;
  color?: string;
  opacity?: number;
  y?: number;
};

/** Soft receiving plane for contact shadows / grounding */
export const Ground: React.FC<Props> = ({
  size = 20,
  color = '#111822',
  opacity = 0.85,
  y = -1.6,
}) => {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} receiveShadow>
      <circleGeometry args={[size / 2, 64]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={opacity}
        roughness={0.9}
        metalness={0.05}
      />
    </mesh>
  );
};
