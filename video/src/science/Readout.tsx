// 镜头：数字读数（原理：needle-sweep-selftest 满弧扫针 + 数字滚动 + 落定弹出）——讲一个关键数字
// 表盘点亮 → 指针先甩满全弧（扫过的刻度依次点亮，像点火自检）→ 弹簧回程过冲后落到真值；
// 同时大数字从 0 滚到终值（与指针同帧落定），落定瞬间数字 overshoot 弹一下、标签和注释升起；之后停住。
import React from "react";
import { spring, useVideoConfig } from "remotion";
import { C, EASE, FONT, Rise, Stage, clamp01, mix, ramp, rgba, useShotFrame, type ShotMeta } from "./kit";

export const READOUT_DURATION = 130;
export const READOUT_META: ShotMeta = { duration: READOUT_DURATION, holdAt: 78, holdEnd: 116, sfx: [{ at: 12, kind: "whip", vol: 0.5 }, { at: 54, kind: "ding", vol: 0.45 }] };

export type ReadoutProps = { value: string; unit?: string; label: string; note?: string; ratio?: number };
const DEFAULTS: ReadoutProps = { value: "1750", unit: "亿", label: "GPT-3 的参数量", note: "比上一代大了 100 多倍", ratio: 0.82 };

const R = 300, CX = 960, CY = 500, A0 = -210, A1 = 30; // 表盘：240° 的弧，从左下到右下
const pt = (deg: number, r: number) => [CX + Math.cos((deg * Math.PI) / 180) * r, CY + Math.sin((deg * Math.PI) / 180) * r];

export const Readout: React.FC<Partial<ReadoutProps>> = (props) => {
  const p = { ...DEFAULTS, ...props } as ReadoutProps;
  const frame = useShotFrame();
  const { fps } = useVideoConfig();
  const ratio = clamp01(p.ratio ?? 0.8);
  const on = ramp(frame, 0, 16, EASE.in);
  // 指针：去程 14 帧甩满弧，回程弹簧落到真值（带一次过冲）
  const go = ramp(frame, 12, 14, EASE.in);
  const back = spring({ frame: frame - 28, fps, config: { damping: 11, stiffness: 120 } });
  const needle = frame < 28 ? go : mix(1, ratio, back);
  const ang = mix(A0, A1, needle);
  const settled = 28 + 26;
  // 数字：从 0 滚到终值，和指针同帧落定；保留原文里的小数位
  const num = parseFloat(p.value.replace(/,/g, ""));
  const dec = (p.value.split(".")[1] || "").length;
  const roll = ramp(frame, 16, settled - 16, EASE.soft);
  const shown = isNaN(num) ? p.value : (num * roll).toFixed(dec);
  const pop = 1 + 0.08 * Math.sin(clamp01((frame - settled) / 10) * Math.PI);
  const ticks = Array.from({ length: 41 }, (_, i) => i / 40);
  return (
    <Stage keyLight={[0.5, 0.06]} horizon={0.93} intensity={0.9}>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: on }}>
        {/* 刻度：指针扫过的刻度点亮，24 帧内回落；真值以内的刻度常亮 */}
        {ticks.map((t, i) => {
          const d = mix(A0, A1, t);
          const major = i % 5 === 0;
          const [x1, y1] = pt(d, R - (major ? 34 : 20)), [x2, y2] = pt(d, R);
          const passedAt = 12 + EASE.in(t) * 14;
          const flash = frame >= passedAt ? Math.exp(-(frame - passedAt) / 8) : 0;
          const lit = t <= needle ? 0.85 : 0.18;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={rgba(t <= ratio ? C.gold : C.cyan, Math.min(1, lit + flash))} strokeWidth={major ? 5 : 3} strokeLinecap="round" />;
        })}
        {/* 外弧 + 进度弧 */}
        <path d={`M ${pt(A0, R + 22).join(" ")} A ${R + 22} ${R + 22} 0 1 1 ${pt(A1, R + 22).join(" ")}`} fill="none" stroke={C.line} strokeWidth={3} />
        <path d={`M ${pt(A0, R + 22).join(" ")} A ${R + 22} ${R + 22} 0 ${needle > 0.75 ? 1 : 0} 1 ${pt(ang, R + 22).join(" ")}`} fill="none" stroke={C.gold} strokeWidth={6} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 12px ${rgba(C.gold, 0.8)})` }} />
        {/* 指针 */}
        <line x1={CX} y1={CY} x2={pt(ang, R - 50)[0]} y2={pt(ang, R - 50)[1]} stroke={C.goldHi} strokeWidth={6} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 10px ${rgba(C.gold, 0.9)})` }} />
        <circle cx={CX} cy={CY} r={16} fill={C.goldHi} />
      </svg>
      {/* 读数 */}
      <div style={{ position: "absolute", left: 0, right: 0, top: CY + 16, textAlign: "center", fontFamily: FONT }}>
        <div style={{ display: "inline-block", transform: `scale(${pop})`, fontSize: 168, fontWeight: 900, letterSpacing: -4, fontVariantNumeric: "tabular-nums",
          background: "linear-gradient(180deg, #fff7df 0%, #f5b83d 60%, #b06a00 100%)", WebkitBackgroundClip: "text", color: "transparent", filter: `drop-shadow(0 6px 30px ${rgba(C.gold, 0.45)})` }}>
          {shown}
          {p.unit && <span style={{ fontSize: 84, marginLeft: 10 }}>{p.unit}</span>}
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 70, textAlign: "center", fontSize: 64, fontWeight: 900 }}>
        <Rise text={p.label} at={6} gap={2} />
      </div>
      {p.note && frame >= settled && (
        <div style={{ position: "absolute", left: 0, right: 0, top: CY + 236, textAlign: "center", fontSize: 44, fontWeight: 600, color: C.dim }}>
          <Rise text={p.note} at={settled + 4} gap={1} />
        </div>
      )}
    </Stage>
  );
};
