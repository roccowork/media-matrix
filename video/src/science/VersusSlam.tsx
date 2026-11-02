// 镜头：左右对比（原理：versus-slam 对撞开屏 + 弹簧落定 + 胜方加冕）——讲「以前 vs 现在」「A vs B」
// 预备：两张卡在画外先往回收一点 → 加速对冲撞到中线（斜切边对齐）→ 撞击帧：白闪 3 帧 + VS 章从大砸下 + 两卡被反弹开一点再弹簧落定；
// 要点逐条升起（左边灰、右边亮）→ 胜方卡描边发光、轻轻抬起，败方压暗；停住。
import React from "react";
import { AbsoluteFill, spring, useVideoConfig } from "remotion";
import { C, EASE, FONT, SpeedBlur, Stage, clamp01, mix, ramp, rgba, useShotFrame, type ShotMeta } from "./kit";

export const VERSUS_SLAM_DURATION = 140;
export const VERSUS_SLAM_META: ShotMeta = { duration: VERSUS_SLAM_DURATION, holdAt: 96, holdEnd: 139 };

type Side = { title: string; points: string[] };
export type VersusSlamProps = { left: Side; right: Side; winner?: "left" | "right" | "none" };
const DEFAULTS: VersusSlamProps = {
  left: { title: "以前：循环网络", points: ["一个字一个字读", "只能排队算", "句子长了就忘"] },
  right: { title: "现在：Transformer", points: ["所有字一起看", "显卡并行算", "再长也记得住"] },
  winner: "right",
};

const HIT = 22; // 撞击帧
const CW = 760, CH = 640;

export const VersusSlam: React.FC<Partial<VersusSlamProps>> = (props) => {
  const p = { ...DEFAULTS, ...props } as VersusSlamProps;
  const frame = useShotFrame();
  const { fps } = useVideoConfig();
  // 对冲：先往画外回收 4% → ease-in 加速冲到中线；撞击后被弹开 30px 再弹簧回位
  const pre = ramp(frame, 0, 8, EASE.in) * (1 - ramp(frame, 8, 4));
  const rush = clamp01((frame - 8) / (HIT - 8)) ** 2.2;
  const bounce = frame >= HIT ? 30 * (1 - spring({ frame: frame - HIT, fps, config: { damping: 10, stiffness: 180 } })) : 0;
  const off = (f: number) => (f < HIT ? mix(1100, 0, clamp01((f - 8) / (HIT - 8)) ** 2.2) + 40 * (f < 12 ? ramp(f, 0, 8, EASE.in) * (1 - ramp(f, 8, 4)) : 0) : 0);
  const dx = off(frame) + bounce + pre * 40 * (rush === 0 ? 1 : 0);
  const v = off(frame) - off(frame - 1);
  const flash = frame >= HIT ? Math.exp(-(frame - HIT) / 2.5) : 0;
  const stamp = frame >= HIT ? spring({ frame: frame - HIT, fps, config: { damping: 9, stiffness: 220 } }) : 0;
  const win = ramp(frame, 70, 16, EASE.in);
  const card = (s: Side, side: "left" | "right") => {
    const isWin = p.winner === side;
    const isLose = p.winner && p.winner !== "none" && !isWin;
    const sign = side === "left" ? -1 : 1;
    const accent = side === "right" ? C.gold : C.cyan;
    return (
      <SpeedBlur id={`vs${side}`} vx={-sign * v} k={0.3} max={26} style={{ position: "absolute", top: 230, left: side === "left" ? 960 - CW - 20 : 980, width: CW, height: CH,
        transform: `translateX(${sign * dx}px) translateY(${-14 * win * (isWin ? 1 : 0)}px) scale(${1 + (isWin ? 0.02 : 0) * win})`, opacity: isLose ? 1 - 0.45 * win : 1 }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 34, overflow: "hidden",
          clipPath: side === "left" ? "polygon(0 0, 100% 0, 92% 100%, 0 100%)" : "polygon(8% 0, 100% 0, 100% 100%, 0 100%)",
          background: side === "left" ? `linear-gradient(160deg, #1a2346, #0a0f24)` : `linear-gradient(160deg, #2a2210, #0f0c06)`,
          border: `2px solid ${rgba(accent, 0.3 + 0.6 * win * (isWin ? 1 : 0))}`,
          boxShadow: `0 40px 100px rgba(0,0,0,0.5), 0 0 ${isWin ? 80 * win : 0}px ${rgba(C.gold, 0.45)}` }}>
          <div style={{ position: "absolute", left: side === "left" ? 60 : 110, right: side === "left" ? 110 : 60, top: 60, fontFamily: FONT }}>
            <div style={{ fontSize: 58, fontWeight: 900, color: side === "right" ? C.goldHi : C.ink, paddingBottom: 20, borderBottom: `3px solid ${rgba(accent, 0.6)}` }}>{s.title}</div>
            {s.points.slice(0, 4).map((pt, i) => (
              <div key={i} style={{ marginTop: 34, fontSize: 48, fontWeight: 700, display: "flex", alignItems: "center", opacity: ramp(frame, 34 + i * 8 + (side === "right" ? 4 : 0), 12), transform: `translateY(${(1 - ramp(frame, 34 + i * 8 + (side === "right" ? 4 : 0), 14)) * 24}px)` }}>
                <span style={{ width: 18, height: 18, borderRadius: 9, background: accent, marginRight: 22, flexShrink: 0, boxShadow: `0 0 12px ${accent}` }} />
                <span style={{ color: side === "right" ? C.ink : C.dim }}>{pt}</span>
              </div>
            ))}
          </div>
        </div>
      </SpeedBlur>
    );
  };
  return (
    <Stage keyLight={[0.5, 0.05]} intensity={0.8}>
      {card(p.left, "left")}
      {card(p.right, "right")}
      {frame >= HIT && (
        <div style={{ position: "absolute", left: 960 - 90, top: 230 + CH / 2 - 90, width: 180, height: 180, borderRadius: 90, display: "flex", alignItems: "center", justifyContent: "center",
          background: C.gold, color: "#140d02", fontSize: 76, fontWeight: 900, fontStyle: "italic", boxShadow: `0 0 60px ${rgba(C.gold, 0.8)}`,
          transform: `scale(${mix(2.4, 1, Math.min(stamp, 1.15))}) rotate(${mix(-30, -8, Math.min(1, stamp))}deg)`, opacity: clamp01(stamp * 2) }}>VS</div>
      )}
      <AbsoluteFill style={{ background: "#fff", opacity: flash * 0.75, mixBlendMode: "screen" }} />
    </Stage>
  );
};
