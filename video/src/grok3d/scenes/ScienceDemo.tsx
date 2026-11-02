import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, interpolate} from 'remotion';
import {ScienceScene} from '../components/ScienceScene';
import {PrimitiveSubject} from '../components/PrimitiveSubject';
import {Highlight} from '../components/Highlight';

/**
 * Demo composition — replace PrimitiveSubject with your own Model / content.
 * Structure shows the recommended pattern:
 *   - full-stage ScienceScene
 *   - optional Sequence blocks for timed emphasis
 *   - overlay 2D UI (title / captions) outside the canvas
 */
export const ScienceDemo: React.FC = () => {
  const frame = useCurrentFrame();

  // Simple 2D title fade
  const titleOpacity = interpolate(frame, [0, 20, 150, 175], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{backgroundColor: '#0a0e17'}}>
      {/* ── 3D stage ─────────────────────────────────────────── */}
      <ScienceScene
        lighting="tech"
        camera="orbit-and-dolly"
        radius={5.5}
        height={1.6}
        ground
        particles
      >
        {/* Main subject — swap for <Model src="/models/your.glb" /> */}
        <PrimitiveSubject
          shape="icosahedron"
          color="#7e9cff"
          highlightFrom={45}
          highlightTo={150}
          highlightColor="#40c4ff"
          spin={0.01}
        />

        {/* Example of wrapping a second object with Highlight */}
        <Sequence from={90} durationInFrames={60} layout="none">
          <Highlight from={0} to={60} color="#ff80ab" intensity={0.5}>
            <mesh position={[2.2, 0.4, -0.5]} castShadow>
              <sphereGeometry args={[0.35, 32, 32]} />
              <meshStandardMaterial
                color="#ff80ab"
                emissive="#ff80ab"
                emissiveIntensity={0.4}
                metalness={0.2}
                roughness={0.4}
              />
            </mesh>
          </Highlight>
        </Sequence>
      </ScienceScene>

      {/* ── 2D overlay (titles, captions, UI) ─────────────────── */}
      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingBottom: 64,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            opacity: titleOpacity,
            color: 'white',
            fontFamily: 'system-ui, sans-serif',
            fontSize: 42,
            fontWeight: 600,
            letterSpacing: 1,
            textShadow: '0 4px 24px rgba(0,0,0,0.6)',
          }}
        >
          Science 3D Skeleton
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
