// 资产验收镜头：biology.nervedetour.v1（喉返神经绕远路示意），5 秒，电影级科学可视化风格。配置：shotconfigs/biology.nervedetour.v1.json
// 分镜（第 10 镜）：发光线稿的长颈鹿式动物侧面，脖子从短拉长到 1.8 米，镜头跟着拉远；喉返神经从脑下到胸腔、钩过主动脉弓再折回喉，弯路越拉越长；光脉冲沿神经走一遍，白色虚线是直走的距离。
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage} from '../../engine/core/Stage';
import {AssetView} from '../../engine/assets/AssetView';
import type {ShotConfig} from '../../engine/shot';
import cfg from '../../../shotconfigs/biology.nervedetour.v1.json';

export const NERVEDETOUR_SHOT = cfg as unknown as ShotConfig; // JSON 已由 tools/shot.mjs validate 按 Schema 校验

export const NerveDetour: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#030a14'}}>
    <Stage camera={NERVEDETOUR_SHOT.camera} post={NERVEDETOUR_SHOT.post} background="#030a14">
      {/* 背景必须不透明：加色混合会把 alpha 写成 1 */}
      <color attach="background" args={['#030a14']} />
      {NERVEDETOUR_SHOT.assets.map((a, i) => (
        <AssetView key={i} id={a.id} params={a.params} />
      ))}
    </Stage>
  </AbsoluteFill>
);
