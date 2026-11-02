// 「AI 科普」镜头库的公共底座（自己写的，原理参考 video-shotcraft 的审美准则）：
// 缓动曲线、舞台布光（主光 / 余光 / 地平线光带 / 暗角 / 颗粒）、按速度的方向模糊、配色和字体。
// 规则：动画只由帧驱动；随机数只用 remotion 的 random(seed)；运动一律非线性缓动，不做匀速。
import React, { createContext, useContext } from "react";
import { AbsoluteFill, Easing, random, useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/google-fonts/NotoSansSC";

const { fontFamily: CJK } = loadFont("normal", { weights: ["400", "500", "700", "900"], ignoreTooManyRequestsWarning: true });

// 向晓 AI 配色：深海军蓝底 + 晨光金（主强调）+ 冰青（次强调）
export const C = {
  bg0: "#03050c",
  bg1: "#0a1024",
  bg2: "#121a3a",
  gold: "#f5b83d",
  goldHi: "#ffd98a",
  cyan: "#5ee7ff",
  ink: "#f6f7fb",
  dim: "rgba(246,247,251,0.62)",
  line: "rgba(255,255,255,0.14)",
};
export const FONT = `"Inter", ${CJK}, "PingFang SC", sans-serif`;

export const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// ── 镜头时长适配：每个镜头有自己的「自然时长」和一段可拉伸的停留段 [holdAt, holdEnd)。
// 配音比镜头长：只拉长停留段（入场和退场的节奏不变）；配音比镜头短：整体按比例压缩（最多压到 0.6 倍，再短就截掉尾巴）。
// 镜头组件里一律用 useShotFrame() 取帧，不直接用 useCurrentFrame()。
export type ShotMeta = { duration: number; holdAt: number; holdEnd: number };
const Fit = createContext<{ meta: ShotMeta; actual: number } | null>(null);
export const ShotFit: React.FC<{ meta: ShotMeta; actual: number; children: React.ReactNode }> = ({ meta, actual, children }) => (
  <Fit.Provider value={{ meta, actual }}>{children}</Fit.Provider>
);
export const mapShotFrame = (f: number, meta: ShotMeta, actual: number) => {
  const { duration: n, holdAt: a, holdEnd: b } = meta;
  if (actual >= n) {
    const extra = actual - n;
    if (f < a) return f;
    if (f < b + extra) return a + ((f - a) * (b - a)) / (b - a + extra);
    return f - extra;
  }
  return f * Math.min(1 / 0.6, n / actual);
};
export const useShotFrame = () => {
  const f = useCurrentFrame();
  const fit = useContext(Fit);
  return fit ? mapShotFrame(f, fit.meta, fit.actual) : f;
};

// ── 缓动：入场用强 ease-out，出场用强 ease-in，换位用对称 in-out，落座用过冲 ──
const bz = (a: number, b: number, c: number, d: number) => Easing.bezier(a, b, c, d);
export const EASE = {
  in: bz(0.16, 1, 0.3, 1), // 入场 / 急推落定
  soft: bz(0.22, 1, 0.36, 1), // 次要元素跟随
  move: bz(0.65, 0, 0.35, 1), // 相机平移、换位
  out: bz(0.7, 0, 0.84, 0), // 出场 / 甩出画外
  settle: bz(0.34, 1.45, 0.64, 1), // 冲过头再回落
  land: bz(0.42, 0, 0.3, 1), // 长减速落位
};
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** 从 start 帧起、dur 帧内的 0→1 进度（带缓动） */
export const ramp = (frame: number, start: number, dur: number, ease: (t: number) => number = EASE.in) => ease(clamp01((frame - start) / dur));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** 阻尼振荡：落座后的「咔哒」小摆，amp 起始幅度，decay 衰减快慢 */
export const wobble = (frame: number, start: number, amp: number, decay = 0.28, freq = 0.9) =>
  frame < start ? 0 : amp * Math.exp(-(frame - start) * decay) * Math.sin((frame - start) * freq);
export const rnd = (seed: string, lo = -1, hi = 1) => lo + random(seed) * (hi - lo);

// ── 颗粒：一张 SVG 噪声，每 2 帧换一次种子（胶片感，不闪） ──
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.08 }) => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 2) % 7;
  return (
    <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity, mixBlendMode: "soft-light", pointerEvents: "none" }}>
      <filter id={`grain${seed}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#grain${seed})`} />
    </svg>
  );
};

/**
 * 舞台：上暗下更暗的渐变底 + 主光（顶部偏左的暖光）+ 余光（右下冷光）+ 可选地平线光带 + 暗角 + 颗粒。
 * keyLight / fill 是 0~1 的画面坐标；breathe 让主光极缓呼吸（暗场氛围用，幅度很小）
 */
export const Stage: React.FC<{
  keyLight?: [number, number];
  fill?: [number, number] | null;
  horizon?: number | null;
  intensity?: number;
  breathe?: boolean;
  children?: React.ReactNode;
}> = ({ keyLight = [0.42, 0.12], fill = [0.86, 0.88], horizon = null, intensity = 1, breathe = true, children }) => {
  const frame = useCurrentFrame();
  const b = breathe ? 1 + 0.08 * Math.sin(frame / 40) : 1;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.bg1} 0%, ${C.bg0} 62%, #010208 100%)`, overflow: "hidden", fontFamily: FONT, color: C.ink }}>
      <AbsoluteFill
        style={{
          background:
            `radial-gradient(ellipse 60% 64% at ${keyLight[0] * 100}% ${keyLight[1] * 100}%, ${rgba("#7f9bff", 0.32 * intensity * b)} 0%, ${rgba("#7f9bff", 0)} 70%),` +
            `radial-gradient(ellipse 30% 30% at ${keyLight[0] * 100}% ${keyLight[1] * 100}%, ${rgba(C.goldHi, 0.12 * intensity * b)} 0%, ${rgba(C.goldHi, 0)} 70%)` +
            (fill ? `, radial-gradient(ellipse 46% 42% at ${fill[0] * 100}% ${fill[1] * 100}%, ${rgba(C.cyan, 0.1 * intensity)} 0%, ${rgba(C.cyan, 0)} 72%)` : ""),
          mixBlendMode: "screen",
        }}
      />
      {horizon !== null && (
        <div style={{ position: "absolute", left: "-10%", right: "-10%", top: `${horizon * 100 - 8}%`, height: "16%", background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${rgba(C.gold, 0.22 * intensity)} 0%, ${rgba(C.gold, 0)} 70%)` }} />
      )}
      {children}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 75% 70% at 50% 46%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.62) 100%)", pointerEvents: "none" }} />
      <Grain />
    </AbsoluteFill>
  );
};

/** 按速度的方向模糊：vx/vy 是这一帧的位移（像素/帧），越快越糊，方向和运动一致 */
export const SpeedBlur: React.FC<{ id: string; vx: number; vy?: number; k?: number; max?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  id, vx, vy = 0, k = 0.35, max = 30, children, style,
}) => {
  const s = Math.min(max, Math.hypot(vx, vy) * k);
  if (s < 0.4) return <div style={style}>{children}</div>;
  const deg = (Math.atan2(vy, vx) * 180) / Math.PI;
  const fid = `sb-${id}`;
  return (
    <div style={style}>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <filter id={fid} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={`${s.toFixed(2)} 0`} />
        </filter>
      </svg>
      {/* 先转到运动方向做水平模糊，再转回来 */}
      <div style={{ position: "absolute", inset: 0, transform: `rotate(${deg}deg)`, filter: `url(#${fid})` }}>
        <div style={{ position: "absolute", inset: 0, transform: `rotate(${-deg}deg)` }}>{children}</div>
      </div>
    </div>
  );
};

/** 逐字入场：每个字从下方 + 模糊里升起，错峰 gap 帧（中文按字，英文按词） */
export const Rise: React.FC<{ text: string; at: number; gap?: number; dur?: number; style?: React.CSSProperties; hl?: string }> = ({ text, at, gap = 2, dur = 16, style, hl }) => {
  const frame = useShotFrame();
  const units = /[一-鿿]/.test(text) ? [...text] : text.split(/(\s+)/);
  return (
    <span style={{ display: "inline-block", whiteSpace: "pre", ...style }}>
      {units.map((u, i) => {
        const p = ramp(frame, at + i * gap, dur);
        const isHl = hl && hl.includes(u.trim()) && u.trim();
        return (
          <span key={i} style={{ display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * 0.45}em)`, filter: `blur(${(1 - p) * 10}px)`, color: isHl ? C.gold : undefined }}>
            {u}
          </span>
        );
      })}
    </span>
  );
};
