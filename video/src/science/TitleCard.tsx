// 镜头：章节标题（原理：blur-slide 三通道逐字入场 + marker-underline 马克笔下划线 + 极缓推近）——开场之后的章节路标、金句
// 眉题胶囊先到 → 大标题逐字从下方 + 模糊里升起 → 标题落定 6 帧后，关键词下一笔变宽、毛糙的金色笔画从左到右画完 →
// 副标题错峰跟进 → 停住让人读（整幕极缓推近 3%）→ 退场：整体上移 + 失焦，交给下一镜。
import React from "react";
import { AbsoluteFill } from "remotion";
import { C, EASE, Rise, Stage, clamp01, mix, ramp, rgba, useShotFrame, type ShotMeta } from "./kit";

export const TITLE_CARD_DURATION = 120;
export const TITLE_CARD_META: ShotMeta = { duration: TITLE_CARD_DURATION, holdAt: 60, holdEnd: 104 };

export type TitleCardProps = { kicker?: string; title: string; hl?: string; sub?: string };
const DEFAULTS: TitleCardProps = { kicker: "第一章", title: "注意力，就是一切", hl: "注意力", sub: "2017 年的一篇论文，改写了整个 AI" };

// 马克笔笔画：中段最宽、首尾细，边缘用噪声扰出毛糙感
const Marker: React.FC<{ width: number; p: number }> = ({ width, p }) => (
  <svg width={width + 40} height={40} viewBox={`0 0 ${width + 40} 40`} style={{ position: "absolute", left: -20, bottom: -14, overflow: "visible" }}>
    <defs>
      <filter id="marker-rough"><feTurbulence type="fractalNoise" baseFrequency="0.04 0.9" numOctaves="2" seed="3" /><feDisplacementMap in="SourceGraphic" scale="4" /></filter>
      <clipPath id="marker-clip"><rect x={0} y={0} width={(width + 40) * p} height={40} /></clipPath>
    </defs>
    <path d={`M 14 26 Q ${width * 0.35} 14 ${width * 0.6} 18 T ${width + 26} 12 L ${width + 24} 22 Q ${width * 0.6} 30 14 34 Z`} fill={rgba(C.gold, 0.9)} filter="url(#marker-rough)" clipPath="url(#marker-clip)" />
  </svg>
);

export const TitleCard: React.FC<Partial<TitleCardProps>> = (props) => {
  const p = { ...DEFAULTS, ...props } as TitleCardProps;
  const frame = useShotFrame();
  const units = /[一-鿿]/.test(p.title) ? [...p.title] : p.title.split(/(\s+)/);
  const titleEnd = 10 + units.length * 2 + 16;
  const size = p.title.length > 12 ? 112 : p.title.length > 8 ? 132 : 150;
  const push = mix(1, 1.03, ramp(frame, 0, TITLE_CARD_DURATION, EASE.move));
  const out = ramp(frame, 104, 14, EASE.out);
  // 关键词在标题里的位置（按字数估宽度画下划线）
  const k = p.hl ? p.title.indexOf(p.hl) : -1;
  const hlW = p.hl ? p.hl.length * size * (/[一-鿿]/.test(p.hl) ? 1 : 0.58) : 0;
  return (
    <Stage keyLight={[0.35, 0.1]} horizon={0.9} intensity={0.85}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `scale(${push}) translateY(${-out * 60}px)`, filter: `blur(${out * 14}px)`, opacity: 1 - out }}>
        {p.kicker && (
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: 10, color: "#160f02", background: C.gold, padding: "8px 26px", borderRadius: 40,
            opacity: ramp(frame, 2, 10), transform: `translateY(${(1 - ramp(frame, 2, 14)) * 20}px)` }}>{p.kicker}</div>
        )}
        <div style={{ position: "relative", marginTop: 34, fontSize: size, fontWeight: 900, letterSpacing: -2, lineHeight: 1.1, textShadow: `0 0 60px ${rgba(C.goldHi, 0.25)}` }}>
          {k >= 0 ? (
            <>
              <Rise text={p.title.slice(0, k)} at={10} gap={2} />
              <span style={{ position: "relative", display: "inline-block" }}>
                <Marker width={hlW} p={EASE.soft(clamp01((frame - titleEnd - 6) / 12))} />
                <span style={{ position: "relative" }}><Rise text={p.hl!} at={10 + k * 2} gap={2} /></span>
              </span>
              <Rise text={p.title.slice(k + p.hl!.length)} at={10 + (k + p.hl!.length) * 2} gap={2} />
            </>
          ) : (
            <Rise text={p.title} at={10} gap={2} />
          )}
        </div>
        {p.sub && <div style={{ marginTop: 40, fontSize: 52, fontWeight: 500, color: C.dim }}><Rise text={p.sub} at={titleEnd - 4} gap={1} /></div>}
      </AbsoluteFill>
    </Stage>
  );
};
