// 资产验收镜头：cosmos.galaxy.v1（螺旋星系 + 星云背景），10 秒。配置：shotconfigs/cosmos.galaxy.v1.json
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage} from '../../engine/core/Stage';
import {AssetView} from '../../engine/assets/AssetView';
import type {ShotConfig} from '../../engine/shot';
import cfg from '../../../shotconfigs/cosmos.galaxy.v1.json';

export const GALAXY_SHOT = cfg as unknown as ShotConfig; // JSON 已由 tools/shot.mjs validate 按 Schema 校验

export const Galaxy: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#000'}}>
    <Stage camera={GALAXY_SHOT.camera} post={GALAXY_SHOT.post}>
      {GALAXY_SHOT.assets.map((a, i) => (
        <AssetView key={i} id={a.id} params={a.params} />
      ))}
    </Stage>
  </AbsoluteFill>
);
