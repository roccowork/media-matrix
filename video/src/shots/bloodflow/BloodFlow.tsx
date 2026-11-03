// 资产验收镜头：biology.bloodflow.v1（血管内部穿行），10 秒，电影级科学可视化风格。配置：shotconfigs/biology.bloodflow.v1.json
// 分镜：镜头在直径 60 µm 的小动脉里顺着血流前进，红细胞（真实双凹形）翻滚着从身边超过，偶尔有贴壁滚动的白细胞和小小的血小板；20 倍慢放。
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage} from '../../engine/core/Stage';
import {AssetView} from '../../engine/assets/AssetView';
import type {ShotConfig} from '../../engine/shot';
import cfg from '../../../shotconfigs/biology.bloodflow.v1.json';

export const BLOODFLOW_SHOT = cfg as unknown as ShotConfig; // JSON 已由 tools/shot.mjs validate 按 Schema 校验

export const BloodFlow: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#1a0406'}}>
    <Stage camera={BLOODFLOW_SHOT.camera} post={BLOODFLOW_SHOT.post} background="#1a0406">
      {/* 背景必须不透明：加色混合会把 alpha 写成 1 */}
      <color attach="background" args={['#1a0406']} />
      {BLOODFLOW_SHOT.assets.map((a, i) => (
        <AssetView key={i} id={a.id} params={a.params} />
      ))}
    </Stage>
  </AbsoluteFill>
);
