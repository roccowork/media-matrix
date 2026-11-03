// 资产验收镜头：cosmos.planet.v1（前景类地行星 + 远处带光环的气态巨行星 + 星云背景），10 秒。配置：shotconfigs/cosmos.planet.v1.json
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage} from '../../engine/core/Stage';
import {AssetView} from '../../engine/assets/AssetView';
import type {ShotConfig} from '../../engine/shot';
import cfg from '../../../shotconfigs/cosmos.planet.v1.json';

export const PLANET_SHOT = cfg as unknown as ShotConfig; // JSON 已由 tools/shot.mjs validate 按 Schema 校验

export const Planet: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#000'}}>
    <Stage camera={PLANET_SHOT.camera} post={PLANET_SHOT.post}>
      {PLANET_SHOT.assets.map((a, i) => (
        <AssetView key={i} id={a.id} params={a.params} />
      ))}
    </Stage>
  </AbsoluteFill>
);
