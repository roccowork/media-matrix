import React from 'react';

export type LightingPreset = 'tech' | 'bio' | 'space';

type LightConfig = {
  ambient: number;
  key: {position: [number, number, number]; intensity: number; color?: string};
  fill: {position: [number, number, number]; intensity: number; color?: string};
  rim: {position: [number, number, number]; intensity: number; color?: string};
  background: string;
  fog?: {color: string; near: number; far: number};
};

const PRESETS: Record<LightingPreset, LightConfig> = {
  tech: {
    ambient: 0.25,
    key: {position: [5, 6, 4], intensity: 1.2, color: '#e8f0ff'},
    fill: {position: [-4, 2, -2], intensity: 0.35, color: '#6b9fff'},
    rim: {position: [-3, 3, -5], intensity: 0.7, color: '#4fc3f7'},
    background: '#0a0e17',
    fog: {color: '#0a0e17', near: 12, far: 28},
  },
  bio: {
    ambient: 0.3,
    key: {position: [4, 5, 5], intensity: 1.0, color: '#fff5e6'},
    fill: {position: [-3, 1, 2], intensity: 0.4, color: '#ffcc80'},
    rim: {position: [2, 2, -4], intensity: 0.55, color: '#81c784'},
    background: '#0f1410',
    fog: {color: '#0f1410', near: 10, far: 24},
  },
  space: {
    ambient: 0.12,
    key: {position: [6, 4, 3], intensity: 1.4, color: '#ffffff'},
    fill: {position: [-5, 0, -3], intensity: 0.2, color: '#7c4dff'},
    rim: {position: [0, 3, -6], intensity: 0.9, color: '#40c4ff'},
    background: '#02040a',
    fog: {color: '#02040a', near: 15, far: 40},
  },
};

export const getLightingConfig = (preset: LightingPreset): LightConfig =>
  PRESETS[preset];

/** Drop-in lighting for any ScienceScene */
export const StudioLights: React.FC<{preset?: LightingPreset}> = ({
  preset = 'tech',
}) => {
  const cfg = getLightingConfig(preset);

  return (
    <>
      <color attach="background" args={[cfg.background]} />
      {cfg.fog && (
        <fog attach="fog" args={[cfg.fog.color, cfg.fog.near, cfg.fog.far]} />
      )}
      <ambientLight intensity={cfg.ambient} />
      <directionalLight
        position={cfg.key.position}
        intensity={cfg.key.intensity}
        color={cfg.key.color}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight
        position={cfg.fill.position}
        intensity={cfg.fill.intensity}
        color={cfg.fill.color}
      />
      <pointLight
        position={cfg.rim.position}
        intensity={cfg.rim.intensity}
        color={cfg.rim.color}
      />
    </>
  );
};
