// Blender 镜头接入 Remotion：biology.heart.v1（心脏，Blender + Cycles 离线渲染）。配置：shotconfigs/biology.heart.v1.json
// 流程：blender/heart_scene.py 按同一份 ShotConfig 渲染 PNG 图片序列到 public/blender/biology.heart.v1/frame_0000.png …
//       这里逐帧显示，再叠加 ShotConfig.post 里的暗角和颗粒（与 Three.js 镜头同一套后期参数）。
// PNG 序列很大，不进 git（.gitignore）；先渲染图片，再渲染这个合成，见 blender/README.md。
import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import type {ShotConfig} from '../../engine/shot';
import {Grain} from '../../science/kit';
import cfg from '../../../shotconfigs/biology.heart.v1.json';

export const HEART_SHOT = cfg as unknown as ShotConfig; // JSON 已由 tools/shot.mjs validate 按 Schema 校验
const DIR = `blender/${HEART_SHOT.id}`;

export const BlenderHeart: React.FC = () => {
  const frame = useCurrentFrame();
  const post = HEART_SHOT.post;
  const vig = post.vignette ?? 0;
  return (
    <AbsoluteFill style={{backgroundColor: '#010204'}}>
      <Img src={staticFile(`${DIR}/frame_${String(frame).padStart(4, '0')}.png`)} style={{width: '100%', height: '100%'}} />
      {vig > 0 && (
        <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,${Math.min(0.9, vig)}) 100%)`}} />
      )}
      {(post.grain ?? 0) > 0 && <Grain opacity={(post.grain ?? 0) * 5} />}
    </AbsoluteFill>
  );
};
