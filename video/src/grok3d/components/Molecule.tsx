import React from 'react';
import {useCurrentFrame} from 'remotion';
import {ConnectionLine} from './ConnectionLine';

export type Atom = {
  id: string;
  element?: string;
  position: [number, number, number];
  radius?: number;
  color?: string;
};

export type Bond = {
  from: string;
  to: string;
  /** Appear frame for the bond */
  appearAt?: number;
};

type Props = {
  atoms: Atom[];
  bonds?: Bond[];
  /** Global scale */
  scale?: number;
  /** Idle spin */
  spin?: number;
  /** Stagger atom entrance */
  stagger?: number;
};

const ELEMENT_COLORS: Record<string, string> = {
  H: '#ffffff',
  C: '#555555',
  N: '#3f51b5',
  O: '#f44336',
  S: '#ffc107',
  P: '#ff9800',
  Fe: '#b71c1c',
  default: '#90caf9',
};

/**
 * Simple ball-and-stick molecule builder.
 * Pass atoms + bonds — no external model needed.
 */
export const Molecule: React.FC<Props> = ({
  atoms,
  bonds = [],
  scale = 1,
  spin = 0.006,
  stagger = 4,
}) => {
  const frame = useCurrentFrame();
  const atomMap = Object.fromEntries(atoms.map((a) => [a.id, a]));

  return (
    <group
      scale={scale}
      rotation={[0, frame * spin, frame * spin * 0.3]}
    >
      {atoms.map((atom, i) => {
        const color =
          atom.color ??
          ELEMENT_COLORS[atom.element ?? ''] ??
          ELEMENT_COLORS.default;
        const r = atom.radius ?? (atom.element === 'H' ? 0.28 : 0.42);
        // Simple scale-in staggered
        const appear = Math.min(1, Math.max(0, (frame - i * stagger) / 12));

        return (
          <mesh
            key={atom.id}
            position={atom.position}
            scale={appear}
            castShadow
          >
            <sphereGeometry args={[r, 32, 32]} />
            <meshStandardMaterial
              color={color}
              metalness={0.15}
              roughness={0.4}
              emissive={color}
              emissiveIntensity={0.08}
            />
          </mesh>
        );
      })}

      {bonds.map((bond, i) => {
        const a = atomMap[bond.from];
        const b = atomMap[bond.to];
        if (!a || !b) return null;
        return (
          <ConnectionLine
            key={`${bond.from}-${bond.to}-${i}`}
            from={a.position}
            to={b.position}
            appearAt={bond.appearAt ?? 20 + i * 3}
            color="#b0bec5"
            radius={0.06}
          />
        );
      })}
    </group>
  );
};

/** Example water molecule helper */
export const WaterMolecule: React.FC<{scale?: number; spin?: number}> = (
  props,
) => (
  <Molecule
    {...props}
    atoms={[
      {id: 'O', element: 'O', position: [0, 0, 0], radius: 0.48},
      {id: 'H1', element: 'H', position: [0.75, 0.5, 0], radius: 0.28},
      {id: 'H2', element: 'H', position: [-0.75, 0.5, 0], radius: 0.28},
    ]}
    bonds={[
      {from: 'O', to: 'H1', appearAt: 18},
      {from: 'O', to: 'H2', appearAt: 24},
    ]}
  />
);
