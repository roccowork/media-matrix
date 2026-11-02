// 资产验收镜头：cosmos.nebula.v1（体积星云），10 秒，从远处飞进星云。配置：shotconfigs/cosmos.nebula.v1.json
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage} from '../../engine/core/Stage';
import {AssetView} from '../../engine/assets/AssetView';
import type {ShotConfig} from '../../engine/shot';
import cfg from '../../../shotconfigs/cosmos.nebula.v1.json';

export const NEBULA_SHOT = cfg as unknown as ShotConfig; // JSON 已由 tools/shot.mjs validate 按 Schema 校验

export const Nebula: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#000'}}>
    <Stage camera={NEBULA_SHOT.camera} post={NEBULA_SHOT.post}>
      {NEBULA_SHOT.assets.map((a, i) => (
        <AssetView key={i} id={a.id} params={a.params} />
      ))}
    </Stage>
  </AbsoluteFill>
);
