// AI 分镜的播放 / 预览（方案第十三节第 3 周：镜头预览、单镜头重渲染）。
//   SB-Shot：渲染分镜里的一镜（inputProps: {config, n?, narration?, annotate?}）——单镜重渲染就是只渲这一个
//   Storyboard：整条分镜按顺序首尾相接播放（inputProps: {storyboard, annotate?}）
// Three.js 镜头：Stage + AssetView 直接渲染；Blender 镜头：云端渲不了，显示资产缩略图当占位并标明
//   （正式画面用 blender/<名字>_scene.py 按这一镜的 config 渲染 PNG 序列）。
// annotate = true 时在底部叠加「镜号 + 旁白」，审片用；正式出片不叠。
import React from 'react';
import {AbsoluteFill, Img, Series, staticFile} from 'remotion';
import {Stage} from '../../engine/core/Stage';
import {AssetView} from '../../engine/assets/AssetView';
import {getAsset} from '../../engine/assets/registry';
import type {ShotConfig} from '../../engine/shot';

export type SBShot = {n: number; narration: string; visual: string; note?: string; config: ShotConfig};
export type StoryboardData = {id: string; topic: string; title: string; fps: number; shots: SBShot[]};

// 背景色按风格（与各资产验收镜头一致）
const BG: Record<string, string> = {
  imax_cosmos: '#000005', cinematic_science: '#030a14', cyber_tech: '#02040a', motion_design: '#02060e', history_geo: '#0a0806',
};

const Caption: React.FC<{n?: number; text?: string; extra?: string}> = ({n, text, extra}) => (
  <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 56, pointerEvents: 'none'}}>
    <div style={{background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 40, lineHeight: 1.4, padding: '14px 28px', borderRadius: 12, maxWidth: 1600, fontFamily: 'WenQuanYi Zen Hei, Noto Sans SC, sans-serif'}}>
      {n !== undefined && <span style={{color: '#ffd166', marginRight: 18}}>#{n}</span>}
      {text}
      {extra && <div style={{fontSize: 26, color: '#9fc3ff', marginTop: 6}}>{extra}</div>}
    </div>
  </AbsoluteFill>
);

export const SBShotView: React.FC<{config: ShotConfig; n?: number; narration?: string; note?: string; annotate?: boolean}> = ({config, n, narration, note, annotate}) => {
  const bg = BG[config.style] ?? '#02040a';
  let body: React.ReactNode;
  if (config.renderer === 'blender') {
    const a = getAsset(config.assets[0].id);
    body = (
      <AbsoluteFill style={{backgroundColor: '#010204', justifyContent: 'center', alignItems: 'center'}}>
        {a.thumbnail && <Img src={staticFile(a.thumbnail)} style={{width: 1280, height: 720, objectFit: 'cover', opacity: 0.85, borderRadius: 16}} />}
        <div style={{position: 'absolute', top: 40, left: 48, color: '#ffd166', fontSize: 34, fontFamily: 'WenQuanYi Zen Hei, sans-serif'}}>
          Blender 镜头占位 · {config.assets[0].id}（正式画面在笔记本上渲染）
        </div>
      </AbsoluteFill>
    );
  } else {
    body = (
      <AbsoluteFill style={{backgroundColor: bg}}>
        <Stage camera={config.camera} post={config.post} background={bg}>
          {/* 背景必须不透明：加色混合会把 alpha 写成 1 */}
          <color attach="background" args={[bg]} />
          {config.assets.map((a, i) => (
            <AssetView key={i} id={a.id} params={a.params} />
          ))}
        </Stage>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      {body}
      {annotate && <Caption n={n} text={narration} extra={note} />}
    </AbsoluteFill>
  );
};

export const StoryboardView: React.FC<{storyboard: StoryboardData; annotate?: boolean}> = ({storyboard, annotate}) => (
  <Series>
    {storyboard.shots.map((s) => (
      <Series.Sequence key={s.n} durationInFrames={Math.round(s.config.duration * storyboard.fps)}>
        <SBShotView config={s.config} n={s.n} narration={s.narration} note={s.note} annotate={annotate} />
      </Series.Sequence>
    ))}
  </Series>
);
