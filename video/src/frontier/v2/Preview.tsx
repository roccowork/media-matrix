// 「AI 前沿」v2 动态样片（约 7 秒）：三个画面 + 专业转场，看图标动效、文字出现方式和整体节奏
import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { CameraMotionBlur } from "@remotion/motion-blur";
import { Crown, CurrencyDollar, Gauge, Timer } from "@phosphor-icons/react";
import { Backdrop, Header, v2 } from "./Style";

// ── 动效工具 ──
const pop = (frame: number, fps: number, delay: number) => spring({ frame: frame - delay, fps, config: { damping: 11, stiffness: 140, mass: 0.7 } });
const rise = (frame: number, fps: number, delay: number) => spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 110 } });

// 3D 图标：回弹弹出，然后缓慢上下浮动、轻轻摆动，下面有一团随高度变化的柔和投影
export const Icon3D: React.FC<{ name: string; size: number; delay?: number; style?: React.CSSProperties }> = ({ name, size, delay = 0, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = pop(frame, fps, delay);
  const t = (frame - delay) / fps;
  const float = Math.sin(t * 2.2) * size * 0.04;
  const tilt = Math.sin(t * 1.6) * 5;
  return (
    <div style={{ position: "absolute", width: size, height: size * 1.25, ...style }}>
      <div
        style={{
          position: "absolute",
          left: "18%",
          right: "18%",
          bottom: 0,
          height: size * 0.12,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(0,0,0,0.55), transparent 70%)",
          transform: `scale(${(1 - float / size) * p})`,
          opacity: 0.8 * p,
        }}
      />
      <Img
        src={staticFile(`icons3d/${name}.png`)}
        style={{
          width: size,
          height: size,
          transform: `translateY(${float}px) rotate(${tilt}deg) scale(${p})`,
          filter: "drop-shadow(0 18px 30px rgba(0,0,0,0.45)) drop-shadow(0 0 40px rgba(245,184,61,0.18))",
        }}
      />
    </div>
  );
};

// 一行文字从下方滑入（配合运动模糊）
const Line: React.FC<{ children: React.ReactNode; delay: number; style?: React.CSSProperties }> = ({ children, delay, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const r = rise(frame, fps, delay);
  return <div style={{ opacity: r, transform: `translateY(${(1 - r) * 80}px)`, ...style }}>{children}</div>;
};

const Kicker: React.FC<{ children: React.ReactNode; delay: number }> = ({ children, delay }) => (
  <Line delay={delay} style={{ fontSize: 30, letterSpacing: 8, color: v2.dim, fontWeight: 500 }}>
    {children}
  </Line>
);

// ── 画面 1：开场标题 ──
const SceneTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bar = rise(frame, fps, 30);
  return (
    <AbsoluteFill style={{ fontFamily: v2.font, color: v2.white }}>
      <Backdrop glow={[85, 12]} />
      <Header date="2026.11.01" />
      <Icon3D name="alarm_clock" size={300} delay={4} style={{ right: 80, top: 250 }} />
      <div style={{ position: "absolute", left: 88, right: 88, top: 600 }}>
        <Kicker delay={2}>ANTHROPIC · CLAUDE</Kicker>
        <div style={{ marginTop: 40, fontSize: 150, fontWeight: 900, lineHeight: 1.08, letterSpacing: -2 }}>
          <Line delay={6}>Claude 的</Line>
          <Line delay={11}>5 小时限制</Line>
          <Line delay={18} style={{ color: v2.gold }}>没了。</Line>
        </div>
        <div style={{ marginTop: 56, width: 120 * bar, height: 6, background: v2.gold }} />
        <Line delay={34} style={{ marginTop: 40, fontSize: 36, color: v2.dim, lineHeight: 1.6 }}>
          200 美元的顶配套餐改名 Ultra，取消 5 小时使用窗口
        </Line>
      </div>
    </AbsoluteFill>
  );
};

// ── 画面 2：信息表，每行一个会动的 2D 图标 ──
const rows = [
  { Icon: Crown, label: "套餐", value: <><span style={{ color: v2.dim, textDecoration: "line-through", textDecorationThickness: 5, fontWeight: 700 }}>Max 20×</span><span style={{ color: v2.dim, margin: "0 18px", fontWeight: 400 }}>→</span>Ultra</> },
  { Icon: CurrencyDollar, label: "价格", value: "$200 / 月", note: "不变" },
  { Icon: Timer, label: "5 小时窗口", value: "取消", note: "先对已验证账号开放", strong: true },
  { Icon: Gauge, label: "每周上限", value: "还在", note: "不是无限用" },
];

const SceneInfo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = ["以前用满五小时，", "就得", "停下来等"];
  const active = Math.min(words.length - 1, Math.floor(interpolate(frame, [30, 70], [0, 3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  return (
    <AbsoluteFill style={{ fontFamily: v2.font, color: v2.white }}>
      <Backdrop glow={[15, 30]} />
      <Header date="2026.11.01" />
      <Icon3D name="crown" size={220} delay={2} style={{ right: 90, top: 250 }} />
      <div style={{ position: "absolute", left: 88, right: 88, top: 400 }}>
        <Kicker delay={0}>改了什么</Kicker>
        <div style={{ marginTop: 50 }}>
          {rows.map((r, i) => {
            const d = 6 + i * 6;
            const ip = pop(frame, fps, d + 2);
            const wiggle = Math.sin((frame - d) / 7) * 4 * Math.max(0, 1 - (frame - d) / 40);
            return (
              <Line key={r.label} delay={d}>
                <div style={{ padding: "34px 0", borderTop: `1px solid ${v2.line}`, display: "flex", alignItems: "center" }}>
                  <div style={{ width: 84, transform: `scale(${ip}) rotate(${wiggle}deg)` }}>
                    <r.Icon size={56} weight="duotone" color={v2.gold} />
                  </div>
                  <div style={{ width: 200, fontSize: 30, color: v2.dim, letterSpacing: 4 }}>{r.label}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: r.strong ? 88 : 62, fontWeight: 900, letterSpacing: -1, color: r.strong ? v2.gold : v2.white, lineHeight: 1.05 }}>{r.value}</div>
                    {r.note && <div style={{ marginTop: 10, fontSize: 28, color: v2.dim }}>{r.note}</div>}
                  </div>
                </div>
              </Line>
            );
          })}
          <div style={{ borderTop: `1px solid ${v2.line}` }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 88, right: 88, bottom: 430, fontSize: 58, fontWeight: 900, lineHeight: 1.3 }}>
        {words.map((w, i) => (
          <span key={i} style={{ color: i === active ? v2.gold : i < active ? v2.white : "rgba(248,250,252,0.35)", textShadow: "0 4px 24px rgba(0,0,0,0.6)" }}>
            {w}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ── 画面 3：金句 ──
const SceneQuote: React.FC = () => (
  <AbsoluteFill style={{ fontFamily: v2.font, color: v2.white }}>
    <Backdrop glow={[50, 60]} />
    <Header date="2026.11.01" />
    <Icon3D name="bulb" size={240} delay={8} style={{ right: 100, top: 330 }} />
    <div style={{ position: "absolute", left: 88, right: 88, top: 560 }}>
      <Line delay={2} style={{ fontSize: 220, lineHeight: 0.6, color: v2.gold, fontFamily: "Georgia, serif" }}>“</Line>
      <div style={{ marginTop: 40, fontSize: 104, fontWeight: 900, lineHeight: 1.22, letterSpacing: -1 }}>
        <Line delay={6}>重度用户</Line>
        <Line delay={11}>最怕的不是贵，</Line>
        <Line delay={20} style={{ color: v2.gold }}>是被打断。</Line>
      </div>
      <Line delay={32} style={{ marginTop: 70, fontSize: 38, color: v2.dim, lineHeight: 1.6 }}>
        去掉 5 小时限制，比加量更懂开发者。
      </Line>
      <Line delay={40} style={{ marginTop: 60, display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ width: 48, height: 2, background: v2.gold }} />
        <span style={{ fontSize: 30, letterSpacing: 4 }}>向晓 AI 的看法</span>
      </Line>
    </div>
  </AbsoluteFill>
);

export const PREVIEW_DURATION = 55 + 70 + 55 - 15 - 15; // 约 5 秒

export const StylePreview: React.FC = () => (
  <CameraMotionBlur shutterAngle={160} samples={6}>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={55}>
        <SceneTitle />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: 15 })} />
      <TransitionSeries.Sequence durationInFrames={70}>
        <SceneInfo />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />
      <TransitionSeries.Sequence durationInFrames={55}>
        <SceneQuote />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </CameraMotionBlur>
);
