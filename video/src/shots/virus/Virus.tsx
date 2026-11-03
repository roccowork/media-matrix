// 资产验收镜头：biology.virus.v1（包膜病毒），10 秒，电影级科学可视化风格。配置：shotconfigs/biology.virus.v1.json
// 分镜：深蓝体液里一个病毒占画面主体缓慢自转，刺突轻轻摇摆；镜头从左前方绕到右前方并推近；远处几个病毒在景深里虚化。
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage} from '../../engine/core/Stage';
import {AssetView} from '../../engine/assets/AssetView';
import type {ShotConfig} from '../../engine/shot';
import cfg from '../../../shotconfigs/biology.virus.v1.json';

export const VIRUS_SHOT = cfg as unknown as ShotConfig; // JSON 已由 tools/shot.mjs validate 按 Schema 校验

export const Virus: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#030a14'}}>
    <Stage camera={VIRUS_SHOT.camera} post={VIRUS_SHOT.post} background="#030a14">
      {/* 背景必须不透明：加色混合会把 alpha 写成 1 */}
      <color attach="background" args={['#030a14']} />
      {VIRUS_SHOT.assets.map((a, i) => (
        <AssetView key={i} id={a.id} params={a.params} />
      ))}
    </Stage>
  </AbsoluteFill>
);
