// 资产验收镜头：biology.cell.v1（动物细胞），10 秒，电影级科学可视化风格。配置：shotconfigs/biology.cell.v1.json
// 分镜：深蓝体液里一个半透明细胞缓慢自转、细胞膜轻轻蠕动，能看到细胞核、线粒体、高尔基体、内质网和囊泡；镜头绕到右前方并推近；远处两个细胞在景深里虚化。
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage} from '../../engine/core/Stage';
import {AssetView} from '../../engine/assets/AssetView';
import type {ShotConfig} from '../../engine/shot';
import cfg from '../../../shotconfigs/biology.cell.v1.json';

export const CELL_SHOT = cfg as unknown as ShotConfig; // JSON 已由 tools/shot.mjs validate 按 Schema 校验

export const Cell: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#030a14'}}>
    <Stage camera={CELL_SHOT.camera} post={CELL_SHOT.post} background="#030a14">
      {/* 背景必须不透明：加色混合会把 alpha 写成 1 */}
      <color attach="background" args={['#030a14']} />
      {CELL_SHOT.assets.map((a, i) => (
        <AssetView key={i} id={a.id} params={a.params} />
      ))}
    </Stage>
  </AbsoluteFill>
);
