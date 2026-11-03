// 资产验收镜头：physics.lightning.v1，10 秒。配置：shotconfigs/physics.lightning.v1.json
// 分镜：深紫暗场里两颗金属电极之间持续放电（电弧每 2 帧变形、照亮电极），远处不时有带分叉的闪电劈下（先导、回闪、余辉）；镜头缓慢推近。
// 加色材质不写深度，所以不开 post.dof。
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage} from '../../engine/core/Stage';
import {AssetView} from '../../engine/assets/AssetView';
import type {ShotConfig} from '../../engine/shot';
import cfg from '../../../shotconfigs/physics.lightning.v1.json';

export const LIGHTNING_SHOT = cfg as unknown as ShotConfig; // JSON 已由 tools/shot.mjs validate 按 Schema 校验

export const Lightning: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#05030c'}}>
    <Stage camera={LIGHTNING_SHOT.camera} post={LIGHTNING_SHOT.post} background="#05030c">
      {/* 背景必须不透明：加色混合会把 alpha 写成 1 */}
      <color attach="background" args={['#05030c']} />
      {LIGHTNING_SHOT.assets.map((a, i) => (
        <AssetView key={i} id={a.id} params={a.params} />
      ))}
    </Stage>
  </AbsoluteFill>
);
