// AI 分镜的播放 / 预览（方案第十三节第 3 周：镜头预览、单镜头重渲染）。
//   SB-Shot：渲染分镜里的一镜（inputProps: {config, n?, narration?, annotate?}）——单镜重渲染就是只渲这一个
//   Storyboard：整条分镜按顺序首尾相接播放（inputProps: {storyboard, annotate?}）
// Three.js 镜头：Stage + AssetView 直接渲染；Blender 镜头：云端渲不了，显示资产缩略图当占位并标明
//   （正式画面用 blender/<名字>_scene.py 按这一镜的 config 渲染 PNG 序列）。
// annotate = true 时在底部叠加「镜号 + 旁白」，审片用；正式出片不叠。
import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, Series, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Stage} from '../../engine/core/Stage';
import {AssetView} from '../../engine/assets/AssetView';
import {getAsset} from '../../engine/assets/registry';
import type {ShotConfig} from '../../engine/shot';
import {FONT} from '../../science/kit';

export type OnScreen = {year?: string; text?: string; tag?: string};
export type SBShot = {n: number; narration?: string; visual: string; note?: string; onscreen?: OnScreen; config: ShotConfig};
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

// 画面文字（配乐模式的字卡，《方案补充》#17）：年份大号细体 + 一句短句 + 角标；模糊淡入、离场淡出。成片里也显示
const TextCard: React.FC<{card: OnScreen; duration: number}> = ({card, duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const end = duration * fps;
  const inP = (d: number) => interpolate(frame, [d, d + 0.9 * fps], [0, 1], {easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const out = interpolate(frame, [end - 0.6 * fps, end - 0.1 * fps], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const st = (p: number): React.CSSProperties => ({opacity: p * out, filter: `blur(${(1 - p) * 12}px)`, transform: `translateY(${(1 - p) * 18}px)`});
  return (
    <AbsoluteFill style={{fontFamily: FONT, color: '#fff', pointerEvents: 'none'}}>
      <AbsoluteFill style={{justifyContent: 'flex-end', padding: '0 120px 120px', textShadow: '0 2px 24px rgba(0,0,0,0.6)'}}>
        {card.year && <div style={{...st(inP(0.2 * fps)), fontSize: 148, fontWeight: 200, letterSpacing: '0.12em', lineHeight: 1}}>{card.year}</div>}
        {card.text && <div style={{...st(inP(0.55 * fps)), fontSize: 60, fontWeight: 400, letterSpacing: '0.08em', marginTop: 18}}>{card.text}</div>}
      </AbsoluteFill>
      {card.tag && (
        <div style={{...st(inP(0.4 * fps)), position: 'absolute', top: 64, right: 80, fontSize: 30, letterSpacing: '0.2em', padding: '8px 22px', border: '1.5px solid rgba(255,255,255,0.6)', borderRadius: 40, color: 'rgba(255,255,255,0.85)'}}>
          {card.tag}
        </div>
      )}
    </AbsoluteFill>
  );
};

export const SBShotView: React.FC<{config: ShotConfig; n?: number; narration?: string; note?: string; onscreen?: OnScreen; annotate?: boolean; visual?: string}> = ({config, n, narration, note, onscreen, annotate, visual}) => {
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
      {onscreen && <TextCard card={onscreen} duration={config.duration} />}
      {annotate && <Caption n={n} text={narration || visual} extra={note} />}
    </AbsoluteFill>
  );
};

export const StoryboardView: React.FC<{storyboard: StoryboardData; annotate?: boolean}> = ({storyboard, annotate}) => (
  <Series>
    {storyboard.shots.map((s) => (
      <Series.Sequence key={s.n} durationInFrames={Math.round(s.config.duration * storyboard.fps)}>
        <SBShotView config={s.config} n={s.n} narration={s.narration} note={s.note} onscreen={s.onscreen} visual={s.visual} annotate={annotate} />
      </Series.Sequence>
    ))}
  </Series>
);
