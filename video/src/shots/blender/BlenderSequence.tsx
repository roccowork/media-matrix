// Blender 镜头接入 Remotion 的通用合成：逐帧显示 Blender 渲染的 PNG 序列，再叠加 ShotConfig.post 里的暗角和颗粒
// （与 Three.js 镜头同一套后期参数）。PNG 序列在 public/blender/<镜头 id>/frame_0000.png …（不进 git），
// 由 blender/<名字>_scene.py 渲染，见 blender/README.md。
import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import type {ShotConfig} from '../../engine/shot';
import {Grain} from '../../science/kit';

export const makeBlenderSequence = (shot: ShotConfig): React.FC => {
  const dir = `blender/${shot.id}`;
  const Seq: React.FC = () => {
    const frame = useCurrentFrame();
    const post = shot.post;
    const vig = post.vignette ?? 0;
    return (
      <AbsoluteFill style={{backgroundColor: '#010204'}}>
        <Img src={staticFile(`${dir}/frame_${String(frame).padStart(4, '0')}.png`)} style={{width: '100%', height: '100%'}} />
        {vig > 0 && (
          <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,${Math.min(0.9, vig)}) 100%)`}} />
        )}
        {(post.grain ?? 0) > 0 && <Grain opacity={(post.grain ?? 0) * 5} />}
      </AbsoluteFill>
    );
  };
  return Seq;
};
