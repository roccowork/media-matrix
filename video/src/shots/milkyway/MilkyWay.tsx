// 资产验收镜头：cosmos.milkyway.v1（银河天穹），10 秒，电影级科学可视化风格。配置：shotconfigs/cosmos.milkyway.v1.json
// 分镜：黑场里星星一颗颗亮起，银河带随后浮现；镜头缓慢转向银心并变焦推进（天穹在无穷远，只有转向 / 变焦可见）。
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage} from '../../engine/core/Stage';
import {AssetView} from '../../engine/assets/AssetView';
import type {ShotConfig} from '../../engine/shot';
import cfg from '../../../shotconfigs/cosmos.milkyway.v1.json';

export const MILKYWAY_SHOT = cfg as unknown as ShotConfig; // JSON 已由 tools/shot.mjs validate 按 Schema 校验

export const MilkyWay: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#000005'}}>
    <Stage camera={MILKYWAY_SHOT.camera} post={MILKYWAY_SHOT.post} background="#000005">
      {/* 背景必须不透明：加色混合会把 alpha 写成 1 */}
      <color attach="background" args={['#000005']} />
      {MILKYWAY_SHOT.assets.map((a, i) => (
        <AssetView key={i} id={a.id} params={a.params} />
      ))}
    </Stage>
  </AbsoluteFill>
);
