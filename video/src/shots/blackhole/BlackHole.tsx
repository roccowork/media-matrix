// 验收镜头 A：黑洞（吸积盘 + 引力透镜），15 秒，IMAX 宇宙风格。
// 镜头 = 一份 ShotConfig JSON（shotconfigs/cosmos.blackhole.v1.json，经 schemas/shot.schema.json 校验）
//        + 引擎 Stage（相机、后期）+ 资产库里的程序化资产（cosmos.blackhole.v1、cosmos.stardust.v1）。
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage} from '../../engine/core/Stage';
import {AssetView} from '../../engine/assets/AssetView';
import type {ShotConfig} from '../../engine/shot';
import cfg from '../../../shotconfigs/cosmos.blackhole.v1.json';

export const BLACKHOLE_SHOT = cfg as unknown as ShotConfig; // JSON 已由 tools/shot.mjs validate 按 Schema 校验

export const BlackHole: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#000'}}>
    <Stage camera={BLACKHOLE_SHOT.camera} post={BLACKHOLE_SHOT.post}>
      {BLACKHOLE_SHOT.assets.map((a, i) => (
        <AssetView key={i} id={a.id} params={a.params} />
      ))}
    </Stage>
  </AbsoluteFill>
);
