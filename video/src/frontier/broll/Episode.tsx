// 「AI 前沿」2026-11-01 完整版（约 30 秒）：实拍空镜 + 官方特效调色 + 逐词跳动文字 + 光漏转场。
// 每句口播配一段空镜，每段画面只突出一个主体；时间点都从配音的逐词时间戳里取，保证字和声音对齐。
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import { anticipate } from "motion";
import { Header, v2 } from "../v2/Style";
import { Captions, Count, Headline, SfxAt, Stamp, kf, sp, tween, useNow } from "../motion/MotionSample";
import { Broll, Leak } from "./BrollSample";
import { words } from "../episodes/2026-11-01.words";

// ── 时间轴 ──
const ALL = words.lines.flatMap((l) => l.words);
// 某个词在 after 秒之后第一次出现的时间
const wt = (text: string, after = 0) => ALL.find((w) => w.text === text && w.start >= after - 0.01)?.start ?? after;
const VOICE_END = 27.6;
export const EPISODE_SECONDS = 30.5;

type Shot = { from: number; to: number; src: string; push?: [number, number]; temp?: number };
const SHOTS: Shot[] = [
  { from: 0, to: 1.84, src: "hourglass", push: [1.0, 1.12], temp: -0.1 },
  { from: 1.84, to: 3.68, src: "datacenter", push: [1.08, 1.3], temp: -0.45 },
  { from: 3.68, to: 6.08, src: "money", push: [1.05, 1.18], temp: 0.15 },
  { from: 6.08, to: 7.92, src: "tunnel", push: [1.0, 1.25], temp: -0.2 },
  { from: 7.92, to: 9.84, src: "clock", push: [1.0, 1.15], temp: -0.1 },
  { from: 9.84, to: 11.12, src: "keyboard", push: [1.05, 1.15], temp: -0.3 },
  { from: 11.12, to: 12.85, src: "alarm", push: [1.0, 1.1], temp: 0 },
  { from: 12.85, to: 14.24, src: "code", push: [1.05, 1.2], temp: -0.3 },
  { from: 14.24, to: 17.92, src: "network", push: [1.0, 1.15], temp: -0.25 },
  { from: 17.92, to: 21.6, src: "laptop", push: [1.0, 1.12], temp: -0.25 },
  { from: 21.6, to: 24.88, src: "programmer", push: [1.05, 1.18], temp: -0.2 },
  { from: 24.88, to: EPISODE_SECONDS, src: "neon", push: [1.0, 1.2], temp: -0.1 },
];
// 光漏只放在大段落之间，不是每次切镜头都放
const LEAKS: { at: number; seed: number; hue: number }[] = [
  { at: 1.84, seed: 3, hue: 200 },
  { at: 3.68, seed: 7, hue: 0 },
  { at: 9.84, seed: 4, hue: 210 },
  { at: 14.24, seed: 9, hue: 260 },
  { at: 21.6, seed: 2, hue: 20 },
  { at: VOICE_END, seed: 5, hue: 200 },
];

const BOOM = 1.44;
const CANCEL = wt("取消", 7.9);
const BREAK = wt("被打", 24);
const IMPACTS = [BOOM, CANCEL, BREAK];

// ── 小组件 ──
const shadow = "0 4px 30px rgba(0,0,0,0.7)";
const fadeOut = (now: number, at: number) => 1 - tween(now, at, 0.3, 0, 1);

// 单个元素弹入
const Pop: React.FC<{ now: number; at: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ now, at, children, style }) => {
  if (now < at) return null;
  const s = sp(now, at, 0.3, 1, { stiffness: 420, damping: 14 });
  const y = sp(now, at, 60, 0, { stiffness: 320, damping: 18 });
  return <div style={{ scale: String(s), translate: `0px ${y}px`, opacity: Math.min(1, s * 1.5), ...style }}>{children}</div>;
};

// 盖章（通用版）
const StampText: React.FC<{ now: number; at: number; text: string; color?: string; style?: React.CSSProperties }> = ({ now, at, text, color = "#ef4444", style }) => {
  if (now < at) return null;
  const s = sp(now, at, 2.4, 1, { stiffness: 520, damping: 17 });
  return (
    <div style={{ display: "inline-block", fontSize: 150, fontWeight: 900, color: "#fff", background: color, padding: "0 40px", borderRadius: 26, rotate: "-6deg", scale: String(s), opacity: Math.min(1, (now - at) * 8), boxShadow: `0 30px 80px ${color}66`, ...style }}>
      {text}
    </div>
  );
};

// 玻璃卡片
const Card: React.FC<{ now: number; at: number; exitAt: number; num: string; children: React.ReactNode }> = ({ now, at, exitAt, num, children }) => {
  if (now < at || now > exitAt + 0.5) return null;
  const s = sp(now, at, 0, 1, { stiffness: 260, damping: 18 });
  const out = tween(now, exitAt, 0.45, 0, 1, anticipate);
  return (
    <div style={{ position: "absolute", left: 80, right: 80, top: 560, padding: "56px 60px", borderRadius: 40, background: "linear-gradient(145deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))", border: "1.5px solid rgba(255,255,255,0.25)", boxShadow: "0 40px 120px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.35)", backdropFilter: "blur(18px)", scale: String(0.85 + s * 0.15), translate: `0px ${(1 - s) * 120 - out * 300}px`, opacity: Math.min(1, s * 1.4) * (1 - Math.max(0, out)) }}>
      <div style={{ position: "absolute", top: -50, left: 50, width: 100, height: 100, borderRadius: 50, background: v2.gold, color: v2.bg0, fontSize: 60, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 40px rgba(245,184,61,0.5)" }}>{num}</div>
      {children}
    </div>
  );
};

// 「5 小时额度」进度条：填满变红
const UsageBar: React.FC<{ now: number; at: number; exitAt: number }> = ({ now, at, exitAt }) => {
  if (now < at || now > exitAt + 0.4) return null;
  const p = tween(now, at + 0.1, 0.85, 0, 1);
  const full = p >= 0.999;
  const op = Math.min(1, (now - at) * 6) * fadeOut(now, exitAt);
  const stop = wt("停下", at);
  return (
    <div style={{ position: "absolute", left: 90, right: 90, top: 640, opacity: op }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 40, color: "rgba(255,255,255,0.85)", textShadow: shadow, marginBottom: 24 }}>
        <span>5 小时额度</span>
        <span style={{ color: full ? "#f87171" : "#fff", fontWeight: 700 }}>{Math.round(p * 100)}%</span>
      </div>
      <div style={{ height: 34, borderRadius: 17, background: "rgba(255,255,255,0.15)", overflow: "hidden", border: "1px solid rgba(255,255,255,0.25)" }}>
        <div style={{ width: `${p * 100}%`, height: "100%", borderRadius: 17, background: full ? "linear-gradient(90deg,#f97316,#ef4444)" : `linear-gradient(90deg,#38bdf8,${v2.gold})`, boxShadow: full ? "0 0 40px rgba(239,68,68,0.8)" : "0 0 30px rgba(56,189,248,0.6)" }} />
      </div>
      <div style={{ marginTop: 70, textAlign: "center" }}>
        <StampText now={now} at={stop} text="⏸ 停下来等" style={{ fontSize: 96 }} />
      </div>
    </div>
  );
};

// 结尾品牌卡
const Outro: React.FC<{ now: number }> = ({ now }) => {
  if (now < VOICE_END) return null;
  const a = VOICE_END + 0.1;
  const dim = tween(now, VOICE_END, 0.5, 0, 0.55);
  return (
    <AbsoluteFill style={{ background: `rgba(3,5,12,${dim})`, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <Pop now={now} at={a}>
        <svg width={170} height={170} viewBox="0 0 32 32">
          <path d="M12.2 21.5a3.8 3.8 0 0 1 7.6 0z" fill={v2.gold} />
          <path d="M8.6 21.5a7.4 7.4 0 0 1 14.8 0" fill="none" stroke={v2.gold} strokeWidth="2" />
          <path d="M4.9 21.5a11.1 11.1 0 0 1 22.2 0" fill="none" stroke={v2.gold} strokeWidth="2" opacity=".55" />
          <path d="M4 21.5h24" stroke={v2.white} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </Pop>
      <Pop now={now} at={a + 0.15} style={{ fontSize: 110, fontWeight: 900, letterSpacing: 4, marginTop: 10, textShadow: shadow }}>向晓 AI</Pop>
      <Pop now={now} at={a + 0.3} style={{ fontSize: 40, color: v2.gold, letterSpacing: 10, marginTop: 20 }}>AI 前沿 · 每天 30 秒看懂 AI</Pop>
      <Pop now={now} at={a + 0.6} style={{ marginTop: 80, fontSize: 38, padding: "18px 48px", borderRadius: 50, border: `2px solid ${v2.gold}`, color: "#fff" }}>关注我，不错过下一条</Pop>
    </AbsoluteFill>
  );
};

export const Episode20261101: React.FC = () => {
  const now = useNow();
  const { fps, durationInFrames } = useVideoConfig();
  const impact = IMPACTS.reduce((m, t) => (now >= t ? Math.max(m, Math.max(0, 1 - (now - t) / 0.5) ** 2) : m), 0);
  const shake = IMPACTS.reduce((s, t) => s + kf(now, t, [0, -14, 11, -7, 4, 0], 0.4), 0);
  const f = (s: number) => Math.round(s * fps);
  return (
    <AbsoluteFill style={{ fontFamily: v2.font, color: v2.white, background: "#000" }}>
      {/* ── 背景空镜 ── */}
      <AbsoluteFill style={{ translate: `${shake}px 0px` }}>
        {SHOTS.map((s) => (
          <Sequence key={s.src} from={f(s.from)} durationInFrames={f(s.to) - f(s.from)}>
            <Broll src={`broll/${s.src}.mp4`} push={s.push} temperature={s.temp} impact={impact} />
          </Sequence>
        ))}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 22%, transparent 62%, rgba(0,0,0,0.75) 100%)" }} />
      {LEAKS.map((l) => (
        <Sequence key={l.at} from={f(l.at) - 8} durationInFrames={24}>
          <Leak seed={l.seed} hueShift={l.hue} />
        </Sequence>
      ))}

      <Header date="2026.11.01" />

      <div style={{ textShadow: shadow }}>
        {/* 1 开场 */}
        <Headline now={now} exitAt={1.62} size={128} top={330} ws={[{ text: "Claude", at: 0 }, { text: "的", at: 0.32 }, { text: "5 小时", at: 0.5, hl: true }, { text: "限制", at: 1.05 }]} />
        <Stamp now={now} at={BOOM} leaveAt={1.66} />
        {/* 2 日期 */}
        <Headline now={now} exitAt={3.3} size={190} top={620} ws={[{ text: "10.30", at: 2.0, gold: true }]} />
        <Headline now={now} exitAt={3.3} size={96} top={860} ws={[{ text: "Anthropic", at: 2.72 }, { text: "官宣", at: 3.2 }]} />
        {/* 4 改名 */}
        <Headline now={now} exitAt={7.75} size={110} top={620} ws={[{ text: "Max 20×", at: 6.08 }]} />
        <Headline now={now} exitAt={7.75} size={200} top={790} ws={[{ text: "Ultra", at: wt("Ultra", 6), gold: true }]} />
        {/* 6 以前 */}
        <Headline now={now} exitAt={11.0} size={130} top={640} ws={[{ text: "以前", at: 9.84 }, { text: "高强度", at: wt("高", 9.8), hl: true }]} />
        <Headline now={now} exitAt={11.0} size={130} top={820} ws={[{ text: "写代码", at: wt("写", 9.8) }]} />
        {/* 8 现在 */}
        <Headline now={now} exitAt={14.1} size={110} top={600} ws={[{ text: "现在", at: 12.85 }]} />
        <Headline now={now} exitAt={14.1} size={170} top={760} ws={[{ text: "一口气", at: wt("一", 12.8), hl: true }]} />
        <Headline now={now} exitAt={14.1} size={170} top={970} ws={[{ text: "干下去", at: wt("干", 12.8) }]} />
        {/* 9 注意 */}
        <Headline now={now} exitAt={14.95} size={120} top={700} ws={[{ text: "但", at: 14.24 }, { text: "注意", at: wt("注意", 14) }, { text: "两点", at: wt("两", 14), gold: true }]} />
        {/* 11 看法 */}
        <Headline now={now} exitAt={24.75} size={52} top={500} ws={[{ text: "我的看法", at: 21.6, gold: true }]} />
        <Headline now={now} exitAt={24.75} size={120} top={620} ws={[{ text: "重度用户", at: 22.4 }]} />
        <Headline now={now} exitAt={24.75} size={120} top={790} ws={[{ text: "最怕的", at: wt("最怕", 22) }, { text: "不是贵", at: wt("不是", 22) }]} />
        <Headline now={now} exitAt={24.75} size={150} top={980} ws={[{ text: "是被打断", at: BREAK - 0.05, hl: true }]} />
        {/* 12 结论 */}
        <Headline now={now} exitAt={27.45} size={96} top={600} ws={[{ text: "去掉", at: 24.88 }, { text: "5 小时限制", at: wt("五", 24.8) }]} />
        <Headline now={now} exitAt={27.45} size={130} top={780} ws={[{ text: "比加量", at: 26.2 }]} />
        <Headline now={now} exitAt={27.45} size={130} top={950} ws={[{ text: "更懂开发者", at: wt("更", 26), hl: true }]} />
      </div>

      {/* 2 日期上方的金线 */}
      {now >= 2.0 && now < 3.9 && <div style={{ position: "absolute", left: 88, top: 600, width: 140 * sp(now, 2.05, 0, 1, { stiffness: 200, damping: 20 }), height: 6, background: v2.gold, opacity: fadeOut(now, 3.3) }} />}

      {/* 3 价格 */}
      {now >= 3.68 && now < 6.1 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 640, textAlign: "center", scale: String(sp(now, 3.68, 0.5, 1, { stiffness: 260, damping: 13 })), opacity: fadeOut(now, 5.8) }}>
          <div style={{ fontSize: 42, color: "rgba(255,255,255,0.85)", letterSpacing: 10, textShadow: shadow }}>顶配套餐 · 每月</div>
          <div style={{ fontSize: 280, fontWeight: 900, lineHeight: 1.05, letterSpacing: -4, background: "linear-gradient(180deg, #fff6d8 0%, #f5b83d 55%, #b86b00 100%)", WebkitBackgroundClip: "text", color: "transparent", filter: "drop-shadow(0 8px 40px rgba(0,0,0,0.6)) drop-shadow(0 0 30px rgba(245,184,61,0.45))" }}>
            $<Count now={now} at={3.75} to={200} />
          </div>
        </div>
      )}

      {/* 4 改名：Max 20× 划掉；价格不变 */}
      {now >= 6.3 && now < 7.9 && <div style={{ position: "absolute", left: 80, top: 690, height: 8, width: 520 * tween(now, 6.35, 0.3, 0, 1), background: "#ef4444", rotate: "-4deg", opacity: fadeOut(now, 7.7), boxShadow: "0 0 20px rgba(239,68,68,0.8)" }} />}
      {now < 7.9 && (
        <div style={{ position: "absolute", left: 88, top: 1060, opacity: fadeOut(now, 7.7) }}>
          <Pop now={now} at={wt("价格", 7)} style={{ display: "inline-block", fontSize: 48, padding: "14px 36px", borderRadius: 40, background: "rgba(255,255,255,0.14)", border: "1.5px solid rgba(255,255,255,0.35)", backdropFilter: "blur(10px)" }}>
            价格不变 ✓
          </Pop>
        </div>
      )}

      {/* 5 取消窗口：5:00:00 被划掉 + 盖章 */}
      {now >= 7.92 && now < 9.9 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 560, textAlign: "center", opacity: fadeOut(now, 9.6) }}>
          <Pop now={now} at={7.92} style={{ fontSize: 46, letterSpacing: 10, color: "rgba(255,255,255,0.85)", textShadow: shadow }}>使用窗口</Pop>
          <Pop now={now} at={7.98} style={{ fontSize: 200, fontWeight: 900, fontVariantNumeric: "tabular-nums", letterSpacing: 2, textShadow: shadow, position: "relative" }}>
            5:00:00
            <div style={{ position: "absolute", left: 120, top: "52%", height: 12, width: 840 * tween(now, CANCEL, 0.25, 0, 1), background: "#ef4444", rotate: "-6deg", boxShadow: "0 0 30px rgba(239,68,68,0.9)" }} />
          </Pop>
          <div style={{ marginTop: 40 }}>
            <StampText now={now} at={CANCEL + 0.05} text="取消" />
          </div>
        </div>
      )}

      {/* 7 额度用满 */}
      <UsageBar now={now} at={11.12} exitAt={12.7} />

      {/* 9 第一 / 10 第二 */}
      <Card now={now} at={15.04} exitAt={17.75} num="1">
        <div style={{ fontSize: 50, color: "rgba(255,255,255,0.75)" }}>每周总用量上限</div>
        <Pop now={now} at={wt("还", 15.4)} style={{ fontSize: 150, fontWeight: 900, color: v2.gold, lineHeight: 1.2 }}>还在</Pop>
        <Pop now={now} at={17.16} style={{ fontSize: 56, fontWeight: 700 }}>不是无限用 ⚠️</Pop>
      </Card>
      <Card now={now} at={17.92} exitAt={21.45} num="2">
        <div style={{ fontSize: 50, color: "rgba(255,255,255,0.75)" }}>先对</div>
        <Pop now={now} at={wt("验证", 18.3)} style={{ fontSize: 120, fontWeight: 900, color: v2.gold, lineHeight: 1.25 }}>已验证账号</Pop>
        <Pop now={now} at={wt("开放", 18.3)} style={{ fontSize: 64, fontWeight: 800 }}>开放 ✅</Pop>
        <Pop now={now} at={20.08} style={{ fontSize: 50, marginTop: 24, color: "rgba(255,255,255,0.8)" }}>新用户：等验证完 ⏳</Pop>
      </Card>

      <Outro now={now} />
      {now < VOICE_END + 0.1 && <Captions now={now} />}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 70, textAlign: "center", fontSize: 22, color: "rgba(255,255,255,0.45)", letterSpacing: 2 }}>来源：Anthropic 官方公告 · 内容由 AI 生成</div>
      <AbsoluteFill style={{ background: "#fff", opacity: impact * 0.3, mixBlendMode: "screen" }} />

      {/* ── 声音 ── */}
      <Audio src={staticFile("frontier/2026-11-01/voice.mp3")} />
      <Audio src={staticFile("frontier/bgm.mp3")} volume={(fr) => interpolate(fr, [0, 10, f(VOICE_END), f(VOICE_END) + 10, durationInFrames - 20, durationInFrames], [0, 0.13, 0.13, 0.3, 0.3, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      {IMPACTS.map((t) => (
        <SfxAt key={t} at={t} src="frontier/pop.mp3" vol={0.8} />
      ))}
      {LEAKS.map((l) => (
        <SfxAt key={l.at} at={l.at - 0.15} src="frontier/whoosh.mp3" vol={0.35} />
      ))}
      <SfxAt at={3.75} src="frontier/chime.mp3" vol={0.3} />
      <SfxAt at={VOICE_END + 0.1} src="frontier/chime.mp3" vol={0.4} />
    </AbsoluteFill>
  );
};
