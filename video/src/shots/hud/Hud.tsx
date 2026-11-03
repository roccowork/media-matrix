// 资产验收镜头：tech.hud.v1（全息界面），10 秒，赛博科技风格。配置：shotconfigs/tech.hud.v1.json
// 分镜：暗场里投影底盘从中心扩出 → 光锥升起 → 数据地球弹出 → 面板从中间往两边依次开机（横线展开、纵向弹开、内容擦出），
//       镜头从左前方缓慢推近并向右绕，最后停在地球和面板之间。
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage} from '../../engine/core/Stage';
import {AssetView} from '../../engine/assets/AssetView';
import type {ShotConfig} from '../../engine/shot';
import cfg from '../../../shotconfigs/tech.hud.v1.json';

export const HUD_SHOT = cfg as unknown as ShotConfig; // JSON 已由 tools/shot.mjs validate 按 Schema 校验

export const Hud: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#020812'}}>
    <Stage camera={HUD_SHOT.camera} post={HUD_SHOT.post} background="#020812">
      {/* 背景必须不透明：加色混合会把 alpha 写成 1 */}
      <color attach="background" args={['#020812']} />
      {HUD_SHOT.assets.map((a, i) => (
        <AssetView key={i} id={a.id} params={a.params} />
      ))}
    </Stage>
  </AbsoluteFill>
);
