// 「AI 前沿」Motion 版样片（5 秒）：动画全部用 Motion（motion.dev，MIT）的弹簧、关键帧和缓动函数计算，
// 按视频帧驱动（time = 帧 / fps），所以渲染出来的每一帧都是确定的，和配音逐词同步。
import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate as rInterp, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { anticipate, easeOut, keyframes, spring } from "motion";
import { Backdrop, Header, v2 } from "../v2/Style";
import { words } from "../episodes/2026-11-01.words";

// ── Motion 驱动工具：输入「从哪个时刻开始」（秒），返回当前帧的值 ──
export const useNow = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
};
type SpringOpts = { stiffness?: number; damping?: number; mass?: number };
export const sp = (now: number, at: number, from: number, to: number, o: SpringOpts = {}) =>
  now < at ? from : (spring({ keyframes: [from, to], stiffness: 260, damping: 16, ...o }).next((now - at) * 1000).value as number);
export const kf = (now: number, at: number, values: number[], duration: number, ease: "easeOut" | "easeInOut" = "easeOut") =>
  now < at ? values[0] : (keyframes({ keyframes: values, duration: duration * 1000, ease }).next((now - at) * 1000).value as number);
export const tween = (now: number, at: number, dur: number, from: number, to: number, ease = easeOut) =>
  from + (to - from) * ease(Math.min(1, Math.max(0, (now - at) / dur)));

// 每个词：说到的那一刻从下面弹起来，带一点随机旋转，回弹后摆正
export const Word: React.FC<{ text: string; at: number; now: number; i: number; color?: string; size: number; hl?: boolean }> = ({ text, at, now, i, color = v2.white, size, hl }) => {
  const s = sp(now, at, 0, 1, { stiffness: 420, damping: 13 });
  const y = sp(now, at, 140, 0, { stiffness: 380, damping: 15 });
  const r = sp(now, at, i % 2 ? 14 : -12, 0, { stiffness: 300, damping: 10 });
  const swipe = hl ? tween(now, at + 0.12, 0.35, 0, 1) : 0;
  return (
    <span style={{ position: "relative", display: "inline-block", marginRight: size * 0.12, transform: `translateY(${y}px) rotate(${r}deg) scale(${s})`, opacity: Math.min(1, s * 1.6) }}>
      {hl && <span style={{ position: "absolute", left: -10, right: -10, top: size * 0.08, bottom: size * 0.02, background: v2.gold, opacity: 0.85, transformOrigin: "left", transform: `scaleX(${swipe}) skewX(-8deg)`, borderRadius: 6, zIndex: -1 }} />}
      <span style={{ position: "relative", padding: hl ? "0 8px" : 0, color: hl && swipe > 0.5 ? v2.bg0 : color }}>{text}</span>
    </span>
  );
};

// 一行标题：整行在 exitAt 时先往下蓄力再往上甩出去（anticipate 缓动）
export const Headline: React.FC<{ ws: { text: string; at: number; hl?: boolean; gold?: boolean }[]; now: number; exitAt: number; size: number; top: number }> = ({ ws, now, exitAt, size, top }) => {
  if (now > exitAt + 0.5 || now < ws[0].at - 0.05) return null;
  const out = tween(now, exitAt, 0.45, 0, 1, anticipate);
  return (
    <div style={{ position: "absolute", left: 80, right: 80, top, fontSize: size, fontWeight: 900, lineHeight: 1.15, letterSpacing: -1, transform: `translateY(${-out * 260}px)`, opacity: 1 - Math.max(0, out) }}>
      {ws.map((w, i) => (
        <Word key={i} text={w.text} at={w.at} now={now} i={i} size={size} hl={w.hl} color={w.gold ? v2.gold : v2.white} />
      ))}
    </div>
  );
};

// 「没了！」盖章：从 2.6 倍砸下来，四周火花散开
export const Stamp: React.FC<{ now: number; at: number; leaveAt?: number }> = ({ now, at, leaveAt = 1.84 }) => {
  if (now < at) return null;
  const s = sp(now, at, 2.6, 1, { stiffness: 520, damping: 17 });
  const o = Math.min(1, (now - at) * 8);
  const burst = tween(now, at + 0.05, 0.5, 0, 1);
  const leave = tween(now, leaveAt, 0.4, 0, 1, anticipate);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 860, display: "flex", justifyContent: "center", opacity: o * (1 - Math.max(0, leave)), transform: `translateY(${-leave * 300}px)` }}>
      <div style={{ position: "relative" }}>
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const d = 150 + burst * 170;
          return (
            <div
              key={i}
              style={{ position: "absolute", left: "50%", top: "50%", width: 46 * (1 - burst) + 6, height: 8, borderRadius: 4, background: i % 2 ? v2.gold : v2.white, opacity: 1 - burst, transform: `translate(-50%,-50%) rotate(${a}rad) translateX(${d}px)` }}
            />
          );
        })}
        <div style={{ fontSize: 200, fontWeight: 900, color: v2.bg0, background: v2.gold, padding: "0 46px", borderRadius: 30, transform: `scale(${s}) rotate(-6deg)`, boxShadow: "0 30px 80px rgba(245,184,61,0.35)" }}>没了！</div>
      </div>
    </div>
  );
};

// 3D 图标：带弹簧飞入、旋转落定、平时浮动；hitAt 时被「震」一下
const Flyer: React.FC<{ name: string; now: number; at: number; leaveAt: number; from: [number, number]; pos: [number, number]; size: number; hitAt?: number }> = ({ name, now, at, leaveAt, from, pos, size, hitAt }) => {
  if (now < at || now > leaveAt + 0.6) return null;
  const x = sp(now, at, from[0], 0, { stiffness: 180, damping: 14 });
  const y = sp(now, at, from[1], 0, { stiffness: 180, damping: 14 });
  const r = sp(now, at, 120, 0, { stiffness: 140, damping: 11 });
  const wobble = hitAt !== undefined ? kf(now, hitAt, [0, -18, 14, -9, 5, 0], 0.6) : 0;
  const float = Math.sin(now * 2.4) * 10;
  const out = tween(now, leaveAt, 0.45, 0, 1, anticipate);
  return (
    <Img
      src={staticFile(`icons3d/${name}.png`)}
      style={{ position: "absolute", left: pos[0], top: pos[1], width: size, height: size, opacity: 1 - Math.max(0, out),
        transform: `translate(${x + out * 700}px, ${y + float}px) rotate(${r + wobble}deg) scale(${1 - Math.max(0, out) * 0.3})`,
        filter: "drop-shadow(0 24px 40px rgba(0,0,0,0.5)) drop-shadow(0 0 50px rgba(245,184,61,0.2))" }}
    />
  );
};

// 抖音风格逐词字幕：当前词金色并被弹簧放大
export const Captions: React.FC<{ now: number }> = ({ now }) => {
  const line = words.lines.find((l) => now >= l.words[0].start - 0.05 && now < (words.lines[words.lines.indexOf(l) + 1]?.words[0].start ?? 99));
  if (!line) return null;
  return (
    <div style={{ position: "absolute", left: 70, right: 70, top: 1480, textAlign: "center", fontSize: 66, fontWeight: 900 }}>
      {line.words.map((w, i) => {
        const active = now >= w.start && now < w.end + 0.05;
        const s = active ? sp(now, w.start, 0.8, 1.18, { stiffness: 500, damping: 14 }) : now >= w.end ? 1 : 0.92;
        return (
          <span key={i} style={{ display: "inline-block", margin: "0 6px", color: active ? v2.gold : now >= w.start ? v2.white : "rgba(255,255,255,0.35)", transform: `scale(${s})`, textShadow: "0 6px 24px rgba(0,0,0,0.7)" }}>
            {w.text}
          </span>
        );
      })}
    </div>
  );
};

// 数字从 0 滚到目标值（弹簧，会稍微冲过头再回来）
export const Count: React.FC<{ now: number; at: number; to: number }> = ({ now, at, to }) => <>{Math.round(Math.min(to, Math.max(0, sp(now, at, 0, to, { stiffness: 90, damping: 15 }))))}</>;

export const MOTION_SAMPLE_DURATION = 150;

export const MotionSample: React.FC = () => {
  const now = useNow();
  const { durationInFrames } = useVideoConfig();
  // 镜头：「没了」砸下来时震一下、推近一下
  const shakeX = kf(now, 1.44, [0, -16, 13, -9, 5, 0], 0.42);
  const punch = kf(now, 1.44, [1, 1.06, 1], 0.5);
  const priceIn = sp(now, 3.68, 0, 1, { stiffness: 260, damping: 14 });
  return (
    <AbsoluteFill style={{ fontFamily: v2.font, color: v2.white }}>
      <Backdrop glow={[80, 15]} />
      <AbsoluteFill style={{ transform: `translateX(${shakeX}px) scale(${punch})` }}>
        <Header date="2026.11.01" />
        <Headline now={now} exitAt={1.84} size={124} top={520}
          ws={[{ text: "Claude", at: 0 }, { text: "的", at: 0.32 }, { text: "5 小时", at: 0.5, hl: true }, { text: "限制", at: 1.05 }]} />
        <Stamp now={now} at={1.44} />
        <Headline now={now} exitAt={3.6} size={150} top={520}
          ws={[{ text: "10.30", at: 1.84, gold: true }]} />
        <Headline now={now} exitAt={3.6} size={96} top={720}
          ws={[{ text: "Anthropic", at: 2.72 }, { text: "官宣", at: 3.2 }]} />
        {now >= 3.68 && (
          <div style={{ position: "absolute", left: 80, right: 80, top: 500, transform: `translateY(${(1 - priceIn) * 120}px) scale(${0.6 + priceIn * 0.4})`, opacity: Math.min(1, priceIn * 1.5) }}>
            <div style={{ fontSize: 40, color: v2.dim, letterSpacing: 6 }}>顶配套餐 · 每月</div>
            <div style={{ fontSize: 230, fontWeight: 900, color: v2.gold, lineHeight: 1.05, letterSpacing: -4 }}>
              $<Count now={now} at={3.75} to={200} />
            </div>
          </div>
        )}
        <Flyer name="alarm_clock" now={now} at={0.15} leaveAt={1.84} from={[650, -200]} pos={[620, 1080]} size={300} hitAt={1.44} />
        <Flyer name="calendar" now={now} at={1.9} leaveAt={3.6} from={[-700, 100]} pos={[620, 1000]} size={320} />
        <Flyer name="money" now={now} at={3.75} leaveAt={9} from={[0, -900]} pos={[600, 940]} size={360} />
      </AbsoluteFill>
      <Captions now={now} />
      <Audio src={staticFile("frontier/2026-11-01/voice.mp3")} />
      <Audio src={staticFile("frontier/bgm.mp3")} volume={(f) => 0.13 * rInterp(f, [0, 10, durationInFrames - 15, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      <SfxAt at={1.44} src="frontier/pop.mp3" vol={0.7} />
      <SfxAt at={1.84} src="frontier/whoosh.mp3" vol={0.4} />
      <SfxAt at={3.62} src="frontier/whoosh.mp3" vol={0.4} />
    </AbsoluteFill>
  );
};

export const SfxAt: React.FC<{ at: number; src: string; vol: number }> = ({ at, src, vol }) => (
  <Sequence from={Math.round(at * 30)} durationInFrames={30} layout="none">
    <Audio src={staticFile(src)} volume={vol} />
  </Sequence>
);
