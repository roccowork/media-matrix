// 资产验收镜头：physics.energyfield.v1，10 秒。配置：shotconfigs/physics.energyfield.v1.json
// 分镜：暗场里护盾从下往上扫描成形 → 中心等离子球亮起 → 电弧连到护盾内壁并缓慢游走；护盾不时被击中，击中点一闪、波纹沿球面扩散；镜头绕着推近。
// 加色材质不写深度，所以不开 post.dof。
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage} from '../../engine/core/Stage';
import {AssetView} from '../../engine/assets/AssetView';
import type {ShotConfig} from '../../engine/shot';
import cfg from '../../../shotconfigs/physics.energyfield.v1.json';

export const ENERGYFIELD_SHOT = cfg as unknown as ShotConfig; // JSON 已由 tools/shot.mjs validate 按 Schema 校验

export const EnergyField: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#04030c'}}>
    <Stage camera={ENERGYFIELD_SHOT.camera} post={ENERGYFIELD_SHOT.post} background="#04030c">
      {/* 背景必须不透明：加色混合会把 alpha 写成 1 */}
      <color attach="background" args={['#04030c']} />
      {ENERGYFIELD_SHOT.assets.map((a, i) => (
        <AssetView key={i} id={a.id} params={a.params} />
      ))}
    </Stage>
  </AbsoluteFill>
);
