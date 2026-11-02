// 验收镜头 C：AI 芯片内部，15 秒，赛博科技风格。
// 配置：shotconfigs/tech.ai_chip.v1.json；资产：tech.chip.v1；环境光照：engine/env/StudioEnv。
// 分镜：0–4s 斜俯视电路板和芯片 → 1.5s 数据脉冲开始沿电路流动 → 4–9s 推进到硅晶片 → 9–15s 贴着晶片表面低空飞行。
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage} from '../../engine/core/Stage';
import {AssetView} from '../../engine/assets/AssetView';
import {StudioEnv} from '../../engine/env/StudioEnv';
import type {ShotConfig} from '../../engine/shot';
import cfg from '../../../shotconfigs/tech.ai_chip.v1.json';

export const CHIP_SHOT = cfg as unknown as ShotConfig; // JSON 已由 tools/shot.mjs validate 按 Schema 校验

export const AIChip: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#03050c'}}>
    <Stage camera={CHIP_SHOT.camera} post={CHIP_SHOT.post} background="#03050c">
      <StudioEnv intensity={0.55} />
      <fog attach="fog" args={['#03050c', 10, 26]} />
      {/* 主光（冷白）+ 两盏轮廓光（青 / 品红），赛博风格 */}
      <directionalLight position={[4, 6, 3]} intensity={1.6} color="#e8f0ff" />
      <pointLight position={[-6, 2.5, -5]} intensity={18} distance={16} color="#5ee7ff" />
      <pointLight position={[6, 2, -6]} intensity={14} distance={16} color="#ff4fd8" />
      {CHIP_SHOT.assets.map((a, i) => (
        <AssetView key={i} id={a.id} params={a.params} />
      ))}
    </Stage>
  </AbsoluteFill>
);
