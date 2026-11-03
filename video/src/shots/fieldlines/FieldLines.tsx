// 资产验收镜头：physics.fieldlines.v1，10 秒。配置：shotconfigs/physics.fieldlines.v1.json
// 分镜：暗场中央一根条形磁铁（N 红 S 蓝），场线从 N 极逐条长出、绕到 S 极，线上光点持续由 N 流向 S；镜头从左前方绕到右前方。
// 加色材质不写深度，所以不开 post.dof。
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage} from '../../engine/core/Stage';
import {AssetView} from '../../engine/assets/AssetView';
import type {ShotConfig} from '../../engine/shot';
import cfg from '../../../shotconfigs/physics.fieldlines.v1.json';

export const FIELDLINES_SHOT = cfg as unknown as ShotConfig; // JSON 已由 tools/shot.mjs validate 按 Schema 校验

export const FieldLines: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#02060e'}}>
    <Stage camera={FIELDLINES_SHOT.camera} post={FIELDLINES_SHOT.post} background="#02060e">
      {/* 背景必须不透明：加色混合会把 alpha 写成 1 */}
      <color attach="background" args={['#02060e']} />
      {FIELDLINES_SHOT.assets.map((a, i) => (
        <AssetView key={i} id={a.id} params={a.params} />
      ))}
    </Stage>
  </AbsoluteFill>
);
