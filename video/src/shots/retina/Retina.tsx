// 资产验收镜头：biology.retina.v1（视网膜微观剖面），12 秒，电影级科学可视化风格。配置：shotconfigs/biology.retina.v1.json
// 分镜：正对视网膜切片：光点从上方穿过神经层，在最下面的感光细胞外节被吸收、闪一下，信号传回神经纤维流向视盘；落在视盘（盲点）里的光点直接穿过 → 第 6 秒起感光层和神经层互换位置、感光细胞翻转（章鱼排布，示意），盲点合上 → 再射一轮光点，光直接打到感光细胞。
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage} from '../../engine/core/Stage';
import {AssetView} from '../../engine/assets/AssetView';
import type {ShotConfig} from '../../engine/shot';
import cfg from '../../../shotconfigs/biology.retina.v1.json';

export const RETINA_SHOT = cfg as unknown as ShotConfig; // JSON 已由 tools/shot.mjs validate 按 Schema 校验

export const Retina: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#040812'}}>
    <Stage camera={RETINA_SHOT.camera} post={RETINA_SHOT.post} background="#040812">
      {/* 背景必须不透明：加色混合会把 alpha 写成 1 */}
      <color attach="background" args={['#040812']} />
      {RETINA_SHOT.assets.map((a, i) => (
        <AssetView key={i} id={a.id} params={a.params} />
      ))}
    </Stage>
  </AbsoluteFill>
);
