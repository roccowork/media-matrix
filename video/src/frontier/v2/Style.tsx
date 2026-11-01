// 「AI 前沿」v2 风格样图：以文字为主角的编辑部风格（参考苹果发布会、彭博社的科技短视频）。
// 干净的深色渐变 + 细噪点 + 一处柔和的暖光，只用金色一种强调色；Logo 只在角落出现，不当背景。
import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/NotoSansSC";

const { fontFamily: cjk } = loadFont("normal", { weights: ["400", "500", "700", "900"], ignoreTooManyRequestsWarning: true });

export const v2 = {
  bg0: "#05070c",
  bg1: "#0c111c",
  gold: "#f5b83d",
  white: "#f8fafc",
  dim: "#8b95a7",
  line: "rgba(255,255,255,0.12)",
  font: `"Inter Display", "Inter", ${cjk}, sans-serif`,
};

// 背景：深色渐变 + 右上角一处很淡的暖光 + 胶片噪点
export const Backdrop: React.FC<{ glow?: [number, number] }> = ({ glow = [78, 18] }) => (
  <AbsoluteFill style={{ background: `linear-gradient(180deg, ${v2.bg1} 0%, ${v2.bg0} 70%)` }}>
    <AbsoluteFill style={{ background: `radial-gradient(circle at ${glow[0]}% ${glow[1]}%, rgba(245,184,61,0.16) 0%, rgba(245,184,61,0.05) 22%, transparent 48%)` }} />
    <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.09, mixBlendMode: "screen" }}>
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  </AbsoluteFill>
);

const Mark: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32">
    <path d="M12.2 21.5a3.8 3.8 0 0 1 7.6 0z" fill={v2.gold} />
    <path d="M8.6 21.5a7.4 7.4 0 0 1 14.8 0" fill="none" stroke={v2.gold} strokeWidth="2" />
    <path d="M4.9 21.5a11.1 11.1 0 0 1 22.2 0" fill="none" stroke={v2.gold} strokeWidth="2" opacity=".55" />
    <path d="M4 21.5h24" stroke={v2.white} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

// 顶部：栏目名 + 期号，很小、很安静
export const Header: React.FC<{ date: string }> = ({ date }) => (
  <div style={{ position: "absolute", top: 110, left: 88, right: 88, display: "flex", alignItems: "center", fontFamily: v2.font }}>
    <Mark size={44} />
    <span style={{ marginLeft: 16, fontSize: 30, fontWeight: 700, color: v2.white, letterSpacing: 2 }}>向晓 AI</span>
    <span style={{ margin: "0 18px", width: 1, height: 26, background: v2.line }} />
    <span style={{ fontSize: 28, color: v2.gold, letterSpacing: 4, fontWeight: 500 }}>AI 前沿</span>
    <span style={{ marginLeft: "auto", fontSize: 26, color: v2.dim, letterSpacing: 3, fontFamily: '"Inter Display", "Inter", sans-serif' }}>{date}</span>
  </div>
);

// 抖音风格大字幕：没有底框，白字加阴影，当前的词金色
export const BigCaption: React.FC<{ words: string[]; active: number }> = ({ words, active }) => (
  <div style={{ position: "absolute", left: 88, right: 88, bottom: 430, fontFamily: v2.font, fontSize: 58, fontWeight: 900, lineHeight: 1.3, letterSpacing: 1 }}>
    {words.map((w, i) => (
      <span key={i} style={{ color: i === active ? v2.gold : i < active ? v2.white : "rgba(248,250,252,0.35)", textShadow: "0 4px 24px rgba(0,0,0,0.6)" }}>
        {w}
      </span>
    ))}
  </div>
);

const Kicker: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 30, letterSpacing: 8, color: v2.dim, fontWeight: 500 }}>{children}</div>
);

// 样图 1：开场标题
export const StyleTitle: React.FC = () => (
  <AbsoluteFill style={{ fontFamily: v2.font, color: v2.white }}>
    <Backdrop glow={[85, 12]} />
    <Header date="2026.11.01" />
    <div style={{ position: "absolute", left: 88, right: 88, top: 560 }}>
      <Kicker>ANTHROPIC · CLAUDE</Kicker>
      <div style={{ marginTop: 40, fontSize: 150, fontWeight: 900, lineHeight: 1.08, letterSpacing: -2 }}>
        Claude 的
        <br />5 小时限制
        <br />
        <span style={{ color: v2.gold }}>没了。</span>
      </div>
      <div style={{ marginTop: 56, width: 120, height: 6, background: v2.gold }} />
      <div style={{ marginTop: 40, fontSize: 36, color: v2.dim, lineHeight: 1.6 }}>
        200 美元的顶配套餐改名 Ultra
        <br />
        取消 5 小时使用窗口
      </div>
    </div>
    <div style={{ position: "absolute", left: 88, bottom: 120, fontSize: 24, color: v2.dim, letterSpacing: 2 }}>来源：Anthropic 官方公告 · 2026.10.30 · 内容由 AI 生成</div>
  </AbsoluteFill>
);

// 样图 2：信息画面（数据表格式，细线分隔）
const Row: React.FC<{ label: string; value: React.ReactNode; note?: string; strong?: boolean }> = ({ label, value, note, strong }) => (
  <div style={{ padding: "38px 0", borderTop: `1px solid ${v2.line}`, display: "flex", alignItems: "baseline" }}>
    <div style={{ width: 230, fontSize: 30, color: v2.dim, letterSpacing: 4 }}>{label}</div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: strong ? 92 : 64, fontWeight: 900, letterSpacing: -1, color: strong ? v2.gold : v2.white, lineHeight: 1.05 }}>{value}</div>
      {note && <div style={{ marginTop: 12, fontSize: 30, color: v2.dim }}>{note}</div>}
    </div>
  </div>
);

export const StyleInfo: React.FC = () => (
  <AbsoluteFill style={{ fontFamily: v2.font, color: v2.white }}>
    <Backdrop glow={[15, 30]} />
    <Header date="2026.11.01" />
    <div style={{ position: "absolute", left: 88, right: 88, top: 360 }}>
      <Kicker>改了什么</Kicker>
      <div style={{ marginTop: 50 }}>
        <Row label="套餐" value={<><span style={{ color: v2.dim, textDecoration: "line-through", textDecorationThickness: 5, fontWeight: 700 }}>Max 20×</span><span style={{ color: v2.dim, margin: "0 22px", fontWeight: 400 }}>→</span>Ultra</>} />
        <Row label="价格" value="$200 / 月" note="不变" />
        <Row label="5 小时窗口" value="取消" strong note="先对已验证的账号开放" />
        <Row label="每周上限" value="还在" note="不是无限用" />
        <div style={{ borderTop: `1px solid ${v2.line}` }} />
      </div>
    </div>
    <BigCaption words={["以前用满五小时，", "就得", "停下来等"]} active={1} />
  </AbsoluteFill>
);

// 样图 3：金句
export const StyleQuote: React.FC = () => (
  <AbsoluteFill style={{ fontFamily: v2.font, color: v2.white }}>
    <Backdrop glow={[50, 60]} />
    <Header date="2026.11.01" />
    <div style={{ position: "absolute", left: 88, right: 88, top: 520 }}>
      <div style={{ fontSize: 220, lineHeight: 0.6, color: v2.gold, fontFamily: "Georgia, serif" }}>“</div>
      <div style={{ marginTop: 40, fontSize: 104, fontWeight: 900, lineHeight: 1.22, letterSpacing: -1 }}>
        重度用户
        <br />
        最怕的不是贵，
        <br />
        <span style={{ color: v2.gold }}>是被打断。</span>
      </div>
      <div style={{ marginTop: 70, fontSize: 38, color: v2.dim, lineHeight: 1.6 }}>
        去掉 5 小时限制，
        <br />
        比加量更懂开发者。
      </div>
      <div style={{ marginTop: 60, display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ width: 48, height: 2, background: v2.gold }} />
        <span style={{ fontSize: 30, color: v2.white, letterSpacing: 4 }}>向晓 AI 的看法</span>
      </div>
    </div>
  </AbsoluteFill>
);
