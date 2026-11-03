// 资产验收镜头：cosmos.star.v1（恒星），10 秒，由远推近到表面和日珥。配置：shotconfigs/cosmos.star.v1.json
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage} from '../../engine/core/Stage';
import {AssetView} from '../../engine/assets/AssetView';
import type {ShotConfig} from '../../engine/shot';
import cfg from '../../../shotconfigs/cosmos.star.v1.json';

export const STAR_SHOT = cfg as unknown as ShotConfig; // JSON 已由 tools/shot.mjs validate 按 Schema 校验

export const Star: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#000'}}>
    <Stage camera={STAR_SHOT.camera} post={STAR_SHOT.post}>
      {STAR_SHOT.assets.map((a, i) => (
        <AssetView key={i} id={a.id} params={a.params} />
      ))}
    </Stage>
  </AbsoluteFill>
);
