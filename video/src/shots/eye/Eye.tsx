// 资产验收镜头：biology.eye.v1（人眼球剖面），10 秒，电影级科学可视化风格。配置：shotconfigs/biology.eye.v1.json
// 分镜：眼球从正前方转出来（角膜反光、虹膜纹理、巩膜血管）→ 上半部被一刀切开，露出水平切面（角膜、虹膜、晶状体、三层眼球壁、视神经）和眼底 → 镜头升到切面上方 → 7 条光线经角膜、晶状体折射，汇聚到黄斑。
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage} from '../../engine/core/Stage';
import {AssetView} from '../../engine/assets/AssetView';
import type {ShotConfig} from '../../engine/shot';
import cfg from '../../../shotconfigs/biology.eye.v1.json';

export const EYE_SHOT = cfg as unknown as ShotConfig; // JSON 已由 tools/shot.mjs validate 按 Schema 校验

export const Eye: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#030a14'}}>
    <Stage camera={EYE_SHOT.camera} post={EYE_SHOT.post} background="#030a14">
      {/* 背景必须不透明：加色混合会把 alpha 写成 1 */}
      <color attach="background" args={['#030a14']} />
      {EYE_SHOT.assets.map((a, i) => (
        <AssetView key={i} id={a.id} params={a.params} />
      ))}
    </Stage>
  </AbsoluteFill>
);
