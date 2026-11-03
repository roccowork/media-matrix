// AI 分镜的播放 / 预览（方案第十三节第 3 周：镜头预览、单镜头重渲染）。
//   SB-Shot：渲染分镜里的一镜（inputProps: {config, n?, narration?, annotate?}）——单镜重渲染就是只渲这一个
//   Storyboard：整条分镜按顺序首尾相接播放（inputProps: {storyboard, annotate?}）
// Three.js 镜头：Stage + AssetView 直接渲染；Blender 镜头：云端渲不了，显示资产缩略图当占位并标明
//   （正式画面用 blender/<名字>_scene.py 按这一镜的 config 渲染 PNG 序列）。
// annotate = true 时在底部叠加「镜号 + 旁白」，审片用；正式出片不叠。
import React from 'react';
import {AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Stage} from '../../engine/core/Stage';
import {AssetView} from '../../engine/assets/AssetView';
import {getAsset} from '../../engine/assets/registry';
import type {ShotConfig} from '../../engine/shot';
import {FONT} from '../../science/kit';

export type OnScreen = {year?: string; text?: string; tag?: string; style?: 'caption' | 'title'; position?: 'bottom' | 'center' | 'top'};
export type Transition = {type: 'dissolve' | 'flash' | 'zoom' | 'eyelid' | 'cut'; duration?: number};
export type SBShot = {n: number; narration?: string; visual: string; note?: string; onscreen?: OnScreen; transition?: Transition; config: ShotConfig};
export type SBAudio = {mode: 'voice' | 'music'; music?: string; bpm?: number;
  ambient?: {src: string; volume?: number; mute?: [number, number][]};
  sfx?: {src: string; at: number; volume?: number; note?: string}[]};
export type StoryboardData = {id: string; topic: string; title: string; fps: number; shots: SBShot[]; audio?: SBAudio};

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
  // 位置（#22：不遮挡画面主体）：bottom 下方居中（默认）/ center 中央 / top 上方；字号按字数收，保证一行放得下
  const pos = card.position ?? (card.style === 'title' ? 'center' : 'bottom');
  const len = (card.text ?? '').length;
  const big = card.style === 'title';
  const total = len + (card.year ? card.year.length * 1.0 + 1 : 0);
  const textSize = big ? Math.min(96, Math.floor(1500 / Math.max(total, 1) / 1.15)) : Math.min(56, Math.floor(1500 / Math.max(total, 1) / 1.1));
  const justify = pos === 'center' ? 'center' : pos === 'top' ? 'flex-start' : 'flex-end';
  const pad = pos === 'top' ? '64px 120px 0' : pos === 'bottom' ? '0 120px 56px' : '0 120px';
  return (
    <AbsoluteFill style={{fontFamily: FONT, color: '#fff', pointerEvents: 'none'}}>
      <AbsoluteFill style={{justifyContent: justify, alignItems: 'center', padding: pad, textAlign: 'center', textShadow: '0 2px 28px rgba(0,0,0,0.75), 0 0 6px rgba(0,0,0,0.6)'}}>
        {/* 年份和句子排成一行（年份细体、稍大），字只占一行高，尽量少挡画面 */}
        <div style={{display: 'flex', alignItems: 'baseline', gap: '0.5em', whiteSpace: 'nowrap'}}>
          {card.year && <span style={{...st(inP(0.2 * fps)), fontSize: textSize * 1.25, fontWeight: 200, letterSpacing: '0.1em'}}>{card.year}</span>}
          {card.text && (
            <span style={{...st(inP(0.5 * fps)), fontSize: textSize, fontWeight: big ? 300 : 400,
              letterSpacing: big ? `${0.14 - 0.06 * interpolate(frame, [0, end], [0, 1])}em` : '0.06em'}}>{card.text}</span>
          )}
        </div>
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

// 转场（《方案补充》#23）：每镜照常从自己的起点开始，上一镜往后多渲 ov 帧垫在底下，新镜在前 ov 帧里淡入（总时长不变）
//   flash：叠化 + 交界处白光爆闪；zoom：上一镜结尾放大冲进画面中心 + 暖光，新镜从放大拉回；eyelid：上一镜结尾上下合拢成黑，硬切；cut：硬切
const overlapOf = (t: Transition | undefined) => {
  const type = t?.type ?? 'dissolve';
  if (type === 'cut' || type === 'eyelid') return 0;
  return t?.duration ?? (type === 'zoom' ? 0.5 : 0.6);
};

const ShotLayer: React.FC<{len: number; inT?: Transition; outT?: Transition; children: React.ReactNode}> = ({len, inT, outT, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ovIn = Math.round(overlapOf(inT) * fps);
  const opacity = ovIn > 0 ? interpolate(frame, [0, ovIn], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1;
  let transform = '';
  let filter = '';
  if (outT?.type === 'zoom') {
    // 结尾 0.9 秒冲进画面中心（指数放大 + 模糊）
    const p = interpolate(frame, [len - 0.9 * fps, len + overlapOf(outT) * fps], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic)});
    transform = `scale(${Math.pow(6, p)})`;
    filter = `blur(${p * 10}px)`;
  }
  if (inT?.type === 'zoom') {
    const p = interpolate(frame, [0, 1.1 * fps], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
    transform = `scale(${1.35 - 0.35 * p})`;
    filter = `blur(${(1 - p) * 6}px)`;
  }
  let lids = 0;
  if (outT?.type === 'eyelid') lids = interpolate(frame, [len - 0.7 * fps, len - 0.05 * fps], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)});
  return (
    <AbsoluteFill style={{opacity}}>
      <AbsoluteFill style={{transform, filter: filter || undefined}}>{children}</AbsoluteFill>
      {lids > 0 && (
        <>
          <div style={{position: 'absolute', left: -100, right: -100, top: 0, height: `${lids * 54}%`, background: '#000', borderRadius: '0 0 50% 50% / 0 0 30% 30%', boxShadow: '0 20px 60px 30px #000'}} />
          <div style={{position: 'absolute', left: -100, right: -100, bottom: 0, height: `${lids * 54}%`, background: '#000', borderRadius: '50% 50% 0 0 / 30% 30% 0 0', boxShadow: '0 -20px 60px 30px #000'}} />
        </>
      )}
    </AbsoluteFill>
  );
};

// 交界处的光（flash 白、zoom 暖）：0.25 秒冲到最亮，0.6 秒退去
const FlashLight: React.FC<{color: string}> = ({color}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const o = interpolate(frame, [0, 0.25 * fps, 0.85 * fps], [0, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{background: `radial-gradient(circle at 50% 50%, #fff 0%, ${color} 55%, ${color} 100%)`, opacity: o}} />;
};

const StoryboardAudio: React.FC<{audio: SBAudio; total: number}> = ({audio, total}) => {
  const {fps} = useVideoConfig();
  const amb = audio.ambient;
  return (
    <>
      {amb && (
        <Audio src={staticFile(amb.src)} loop volume={(f) => {
          const t = f / fps;
          let v = (amb.volume ?? 0.4) * Math.min(1, t / 2, (total / fps - t) / 2); // 首尾各 2 秒淡入淡出
          // 静音区间 [a, b]：a 之前 0.8 秒淡出，b 之后 1.2 秒淡回
          for (const [a, b] of amb.mute ?? []) v *= t < a ? Math.min(1, (a - t) / 0.8) : t > b ? Math.min(1, (t - b) / 1.2) : 0;
          return Math.max(0, v);
        }} />
      )}
      {(audio.sfx ?? []).map((x, i) => (
        <Sequence key={i} from={Math.round(x.at * fps)} layout="none">
          <Audio src={staticFile(x.src)} volume={x.volume ?? 0.7} />
        </Sequence>
      ))}
    </>
  );
};

export const StoryboardView: React.FC<{storyboard: StoryboardData; annotate?: boolean}> = ({storyboard, annotate}) => {
  const fps = storyboard.fps;
  let at = 0;
  const items = storyboard.shots.map((s, i) => {
    const len = Math.round(s.config.duration * fps);
    const from = at;
    at += len;
    const prev = i > 0 ? storyboard.shots[i - 1].transition : undefined;
    const isLast = i === storyboard.shots.length - 1;
    const out = isLast ? {type: 'cut' as const} : s.transition;
    return {s, len, from, inT: i > 0 ? prev ?? {type: 'dissolve' as const} : {type: 'cut' as const}, out: out ?? {type: 'dissolve' as const}};
  });
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      {items.map(({s, len, from, inT, out}) => (
        <Sequence key={s.n} from={from} durationInFrames={len + Math.round(overlapOf(out) * fps)}>
          <ShotLayer len={len} inT={inT} outT={out}>
            <SBShotView config={s.config} n={s.n} narration={s.narration} note={s.note} onscreen={s.onscreen} visual={s.visual} annotate={annotate} />
          </ShotLayer>
        </Sequence>
      ))}
      {items.filter((x) => x.out.type === 'flash' || x.out.type === 'zoom').map(({s, len, from, out}) => (
        <Sequence key={`fl${s.n}`} from={from + len - Math.round(0.25 * fps)} durationInFrames={Math.round(0.9 * fps)}>
          <FlashLight color={out.type === 'flash' ? 'rgba(235,245,255,1)' : 'rgba(255,170,70,1)'} />
        </Sequence>
      ))}
      {storyboard.audio && <StoryboardAudio audio={storyboard.audio} total={at} />}
    </AbsoluteFill>
  );
};
