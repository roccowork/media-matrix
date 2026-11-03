// 资产验收镜头：tech.datastream.v1（数据高速公路），10 秒，赛博科技风格。配置：shotconfigs/tech.datastream.v1.json
// 分镜：镜头沿光纤束中心线在束内部高速穿行（fly_through，匀速），数据包迎面飞过，束间闪电式数据交换，远处汇聚点辉光。
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage} from '../../engine/core/Stage';
import {AssetView} from '../../engine/assets/AssetView';
import type {ShotConfig} from '../../engine/shot';
import cfg from '../../../shotconfigs/tech.datastream.v1.json';

export const DATASTREAM_SHOT = cfg as unknown as ShotConfig; // JSON 已由 tools/shot.mjs validate 按 Schema 校验

export const DataStream: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#02040a'}}>
    <Stage camera={DATASTREAM_SHOT.camera} post={DATASTREAM_SHOT.post} background="#02040a">
      {/* 场景背景必须不透明：加色混合会把 alpha 写成 1，透明背景下字符 / 光点周围会露出黑框 */}
      <color attach="background" args={['#02040a']} />
      {DATASTREAM_SHOT.assets.map((a, i) => (
        <AssetView key={i} id={a.id} params={a.params} />
      ))}
    </Stage>
  </AbsoluteFill>
);
