// 资产验收镜头：biology.dna.v1（DNA 双螺旋，镜头沿侧面滑过并推近，5 秒起从左端解旋），10 秒。配置：shotconfigs/biology.dna.v1.json
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage} from '../../engine/core/Stage';
import {AssetView} from '../../engine/assets/AssetView';
import type {ShotConfig} from '../../engine/shot';
import cfg from '../../../shotconfigs/biology.dna.v1.json';

export const DNA_SHOT = cfg as unknown as ShotConfig; // JSON 已由 tools/shot.mjs validate 按 Schema 校验

export const Dna: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#02040a'}}>
    <Stage camera={DNA_SHOT.camera} post={DNA_SHOT.post} background="#02040a">
      <color attach="background" args={['#02040a']} />
      {DNA_SHOT.assets.map((a, i) => (
        <AssetView key={i} id={a.id} params={a.params} />
      ))}
    </Stage>
  </AbsoluteFill>
);
