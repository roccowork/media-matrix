// 节拍层：让画面一刻不停（2026-11-02 用户反馈「画面平静的时间太长」）。原理见 HANDBOOK.md。
// - KeywordPop：念到关键词的那一刻，关键词带模糊从大砸下（背后压暗），停一下再放大淡出；两种样式交替
// - LifeCam：所有镜头外面套一层「活的镜头」——持续慢推 + 轻微漂移，关键词时刻猛推一下（punch-in）
// - Transit：镜头之间的转场（进场 / 出场成对）：zoom 推进穿越、whip 甩镜、flash 闪白、glitch 故障、iris 光圈
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, EASE, FONT, clamp01, mix, rgba } from "./kit";

export const KEY_LEN = 40; // 关键词停留帧数

export const KeywordPop: React.FC<{ text: string; variant: number }> = ({ text, variant }) => {
  const f = useCurrentFrame();
  const inP = EASE.in(clamp01(f / 9));
  const out = EASE.out(clamp01((f - (KEY_LEN - 7)) / 7));
  const size = text.length <= 4 ? 190 : text.length <= 7 ? 150 : 116;
  const scale = mix(1.9, 1, inP) * mix(1, 1.18, out);
  const blur = (1 - inP) * 18 + out * 12;
  const scrim = Math.min(clamp01(f / 4), 1 - out) * 0.55;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: FONT, pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 60% 50% at 50% 50%, rgba(2,4,12,${scrim}) 0%, rgba(2,4,12,${scrim * 0.6}) 70%, rgba(2,4,12,${scrim * 0.3}) 100%)` }} />
      <div style={{ transform: `scale(${scale}) rotate(${variant % 2 ? -3 : 2}deg)`, filter: `blur(${blur}px)`, opacity: Math.min(1, inP * 2) * (1 - out) }}>
        {variant % 2 === 0 ? (
          // 样式 A：金色实心块 + 深色字
          <div style={{ fontSize: size, fontWeight: 900, letterSpacing: -2, color: "#140d02", background: `linear-gradient(160deg, ${C.goldHi}, ${C.gold})`, padding: "6px 44px", borderRadius: 18, boxShadow: `0 30px 90px ${rgba(C.gold, 0.45)}` }}>{text}</div>
        ) : (
          // 样式 B：白色超大字 + 金色下划条
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: size, fontWeight: 900, letterSpacing: -2, color: C.ink, textShadow: `0 0 60px ${rgba(C.goldHi, 0.5)}, 0 10px 40px rgba(0,0,0,0.8)` }}>{text}</div>
            <div style={{ height: 14, marginTop: 6, borderRadius: 7, background: C.gold, width: `${EASE.soft(clamp01((f - 5) / 10)) * 100}%`, boxShadow: `0 0 30px ${rgba(C.gold, 0.8)}` }} />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

/** 活镜头：len 是这个镜头的实际帧数，punches 是镜头内的猛推时刻（帧） */
export const LifeCam: React.FC<{ len: number; punches: number[]; seed: number; children: React.ReactNode }> = ({ len, punches, seed, children }) => {
  const f = useCurrentFrame();
  const push = mix(1, 1.06, EASE.move(clamp01(f / Math.max(1, len))));
  const punch = punches.reduce((a, p) => (f >= p ? a + 0.045 * Math.exp(-(f - p) / 7) * clamp01((f - p) / 2) : a), 0);
  const dx = Math.sin(f / 61 + seed) * 12, dy = Math.cos(f / 83 + seed * 2) * 7, rot = Math.sin(f / 97 + seed) * 0.35;
  return <AbsoluteFill style={{ transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${push + punch})` }}>{children}</AbsoluteFill>;
};

export type TransitKind = "zoom" | "whip" | "flash" | "glitch" | "iris" | "none";
const IN = 9, OUT = 6;

/** 转场：进场用镜头开头 IN 帧，出场用结尾 OUT 帧（两侧各演一半，切点在中间） */
export const Transit: React.FC<{ len: number; enter: TransitKind; exit: TransitKind; children: React.ReactNode }> = ({ len, enter, exit, children }) => {
  const f = useCurrentFrame();
  const a = enter === "none" ? 1 : clamp01(f / IN); // 0→1 进场
  const b = exit === "none" ? 0 : clamp01((f - (len - OUT)) / OUT); // 0→1 出场
  let transform = "", filter = "", clip: string | undefined, flash = 0;
  const ai = EASE.in(a), bo = EASE.out(b);
  if (enter === "zoom" && a < 1) { transform += ` scale(${mix(1.3, 1, ai)})`; filter += ` blur(${(1 - ai) * 16}px)`; }
  if (enter === "whip" && a < 1) { transform += ` translateX(${(1 - ai) * 520}px)`; filter += ` blur(${(1 - ai) * 14}px)`; }
  if (enter === "flash" && a < 1) flash = 1 - ai;
  if (enter === "glitch" && f < 6) { transform += ` translateX(${(f % 2 ? -1 : 1) * (6 - f) * 6}px)`; filter += ` drop-shadow(${(6 - f) * 3}px 0 0 rgba(255,40,80,0.7)) drop-shadow(${-(6 - f) * 3}px 0 0 rgba(40,220,255,0.7))`; }
  if (enter === "iris" && a < 1) clip = `circle(${EASE.in(a) * 120}% at 50% 50%)`;
  if (exit === "zoom" && b > 0) { transform += ` scale(${mix(1, 1.45, bo)})`; filter += ` blur(${bo * 18}px)`; }
  if (exit === "whip" && b > 0) { transform += ` translateX(${-bo * 620}px)`; filter += ` blur(${bo * 16}px)`; }
  if (exit === "flash" && b > 0) flash = Math.max(flash, bo);
  if (exit === "glitch" && b > 0) { const k = Math.round(b * 4); transform += ` translateX(${(k % 2 ? 1 : -1) * k * 10}px)`; filter += ` drop-shadow(${k * 4}px 0 0 rgba(255,40,80,0.7)) drop-shadow(${-k * 4}px 0 0 rgba(40,220,255,0.7))`; }
  return (
    <AbsoluteFill style={{ background: C.bg0 }}>
      <AbsoluteFill style={{ transform: transform || undefined, filter: filter || undefined, clipPath: clip }}>{children}</AbsoluteFill>
      {flash > 0 && <AbsoluteFill style={{ background: "#fff", opacity: flash * 0.85, mixBlendMode: "screen" }} />}
    </AbsoluteFill>
  );
};

export const TRANSIT_SFX: Record<TransitKind, string | null> = { zoom: "zoom", whip: "whip", flash: "flash", glitch: "glitch", iris: "whip", none: null };
