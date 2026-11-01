// 「AI 前沿」通用成片：画面全部由数据驱动（tools/make_episode.py 生成 public/frontier/<日期>/auto.json，渲染时用 --props 传进来）。
// 每段 = 一个实拍空镜 + 一个文字模板（标题 / 盖章 / 数字 / 替换 / 卡片），时间点都已在 Python 里按配音的逐字时间算好。
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import { anticipate } from "motion";
import { Header, v2 } from "../v2/Style";
import { Captions, Count, Headline, SfxAt, kf, sp, tween, useNow } from "../motion/MotionSample";
import { Broll, Leak } from "../broll/BrollSample";
import type { CaptionsData } from "../../vendor/captions-themes/types";

// ── 数据格式（和 tools/make_episode.py 对应）──
export type Tok = { text: string; at: number; hl?: boolean; gold?: boolean };
export type Line = { size: number; toks: Tok[] };
export type Overlay =
  | { type: "title"; kicker?: Tok; lines: Line[] }
  | { type: "stamp"; lines: Line[]; text: string; at: number }
  | { type: "number"; prefix: string; value: number; suffix: string; label: string; at: number }
  | { type: "swap"; from: string; to: string; at: number; toAt: number; note?: string; noteAt?: number }
  | { type: "card"; num: string; title: string; value: string; valueAt: number; note?: string; noteAt?: number; at: number };
export type AutoShot = { from: number; to: number; src: string; temp?: number; overlay?: Overlay | null };
export type CoverData = { kicker: string; lines: string[]; hl?: string; stamp?: string; sub: string[] };
export type AutoData = {
  date: string; // 2026-11-01
  dir?: string; // public/frontier/ 下的文件夹（同一天几条时是 2026-11-02-1），没有就等于 date
  source: string;
  voiceEnd: number;
  total: number;
  shots: AutoShot[];
  words: CaptionsData;
  impacts: number[];
  leaks: number[];
  cover: CoverData;
};

const shadow = "0 4px 30px rgba(0,0,0,0.7)";
const fadeOut = (now: number, at: number) => 1 - tween(now, at, 0.3, 0, 1);

const Pop: React.FC<{ now: number; at: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ now, at, children, style }) => {
  if (now < at) return null;
  const s = sp(now, at, 0.3, 1, { stiffness: 420, damping: 14 });
  const y = sp(now, at, 60, 0, { stiffness: 320, damping: 18 });
  return <div style={{ scale: String(s), translate: `0px ${y}px`, opacity: Math.min(1, s * 1.5), ...style }}>{children}</div>;
};

const StampText: React.FC<{ now: number; at: number; text: string; color?: string; size?: number }> = ({ now, at, text, color = "#ef4444", size = 150 }) => {
  if (now < at) return null;
  const s = sp(now, at, 2.4, 1, { stiffness: 520, damping: 17 });
  return (
    <div style={{ display: "inline-block", fontSize: size, fontWeight: 900, color: "#fff", background: color, padding: "0 40px", borderRadius: 26, rotate: "-6deg", scale: String(s), opacity: Math.min(1, (now - at) * 8), boxShadow: `0 30px 80px ${color}66`, textShadow: "none" }}>
      {text}
    </div>
  );
};

// 多行标题：每行用 Headline（逐词弹入、结束时甩出），行距按字号排
const Lines: React.FC<{ now: number; lines: Line[]; top: number; exitAt: number }> = ({ now, lines, top, exitAt }) => {
  let y = top;
  return (
    <>
      {lines.map((l, i) => {
        const el = <Headline key={i} now={now} exitAt={exitAt} size={l.size} top={y} ws={l.toks} />;
        y += l.size * 1.3;
        return el;
      })}
    </>
  );
};

const OverlayView: React.FC<{ now: number; shot: AutoShot; voiceEnd: number }> = ({ now, shot, voiceEnd }) => {
  const o = shot.overlay;
  const exit = Math.min(shot.to, voiceEnd) - 0.2; // 最后一段的字在片尾品牌卡出来前退场
  if (!o || now < shot.from - 0.05 || now > exit + 0.8) return null;
  if (o.type === "title") {
    return (
      <div style={{ textShadow: shadow }}>
        {o.kicker && <Headline now={now} exitAt={exit} size={52} top={500} ws={[{ ...o.kicker, gold: true }]} />}
        <Lines now={now} lines={o.lines} top={o.kicker ? 600 : 620} exitAt={exit} />
      </div>
    );
  }
  if (o.type === "stamp") {
    const h = o.lines.reduce((a, l) => a + l.size * 1.3, 0);
    return (
      <div style={{ textShadow: shadow }}>
        <Lines now={now} lines={o.lines} top={330} exitAt={exit} />
        <div style={{ position: "absolute", left: 0, right: 0, top: Math.max(860, 330 + h + 80), textAlign: "center", opacity: fadeOut(now, exit) }}>
          <StampText now={now} at={o.at} text={o.text} color={v2.gold} size={190} />
        </div>
      </div>
    );
  }
  if (o.type === "number") {
    if (now < o.at) return null;
    return (
      <div style={{ position: "absolute", left: 0, right: 0, top: 640, textAlign: "center", scale: String(sp(now, o.at, 0.5, 1, { stiffness: 260, damping: 13 })), opacity: fadeOut(now, exit) }}>
        {o.label && <div style={{ fontSize: 42, color: "rgba(255,255,255,0.85)", letterSpacing: 10, textShadow: shadow }}>{o.label}</div>}
        <div style={{ fontSize: 260, fontWeight: 900, lineHeight: 1.05, letterSpacing: -4, background: "linear-gradient(180deg, #fff6d8 0%, #f5b83d 55%, #b86b00 100%)", WebkitBackgroundClip: "text", color: "transparent", filter: "drop-shadow(0 8px 40px rgba(0,0,0,0.6)) drop-shadow(0 0 30px rgba(245,184,61,0.45))" }}>
          {o.prefix}
          <Count now={now} at={o.at + 0.07} to={o.value} />
          {o.suffix}
        </div>
      </div>
    );
  }
  if (o.type === "swap") {
    return (
      <div style={{ position: "absolute", left: 88, right: 88, top: 620, textShadow: shadow, opacity: fadeOut(now, exit) }}>
        <Pop now={now} at={o.at} style={{ position: "relative", display: "inline-block", fontSize: 110, fontWeight: 900, color: "rgba(255,255,255,0.75)" }}>
          {o.from}
          <div style={{ position: "absolute", left: -10, top: "52%", height: 10, width: `calc(${tween(now, o.at + 0.3, 0.3, 0, 1) * 100}% + 20px)`, background: "#ef4444", rotate: "-4deg", boxShadow: "0 0 20px rgba(239,68,68,0.8)" }} />
        </Pop>
        <Pop now={now} at={o.toAt} style={{ fontSize: 200, fontWeight: 900, color: v2.gold, lineHeight: 1.2 }}>{o.to}</Pop>
        {o.note && (
          <Pop now={now} at={o.noteAt ?? o.toAt + 0.6} style={{ display: "inline-block", marginTop: 30, fontSize: 48, padding: "14px 36px", borderRadius: 40, background: "rgba(255,255,255,0.14)", border: "1.5px solid rgba(255,255,255,0.35)", backdropFilter: "blur(10px)" }}>
            {o.note}
          </Pop>
        )}
      </div>
    );
  }
  // card：玻璃卡片
  const s = sp(now, o.at, 0, 1, { stiffness: 260, damping: 18 });
  const out = tween(now, exit, 0.45, 0, 1, anticipate);
  if (now < o.at) return null;
  return (
    <div style={{ position: "absolute", left: 80, right: 80, top: 560, padding: "56px 60px", borderRadius: 40, background: "linear-gradient(145deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))", border: "1.5px solid rgba(255,255,255,0.25)", boxShadow: "0 40px 120px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.35)", backdropFilter: "blur(18px)", scale: String(0.85 + s * 0.15), translate: `0px ${(1 - s) * 120 - out * 300}px`, opacity: Math.min(1, s * 1.4) * (1 - Math.max(0, out)) }}>
      {o.num && <div style={{ position: "absolute", top: -50, left: 50, width: 100, height: 100, borderRadius: 50, background: v2.gold, color: v2.bg0, fontSize: 60, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 40px rgba(245,184,61,0.5)" }}>{o.num}</div>}
      <div style={{ fontSize: 50, color: "rgba(255,255,255,0.75)" }}>{o.title}</div>
      <Pop now={now} at={o.valueAt} style={{ fontSize: o.value.length > 5 ? 110 : 150, fontWeight: 900, color: v2.gold, lineHeight: 1.25 }}>{o.value}</Pop>
      {o.note && <Pop now={now} at={o.noteAt ?? o.valueAt + 0.8} style={{ fontSize: 54, fontWeight: 700, marginTop: 10 }}>{o.note}</Pop>}
    </div>
  );
};

const Mark: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32">
    <path d="M12.2 21.5a3.8 3.8 0 0 1 7.6 0z" fill={v2.gold} />
    <path d="M8.6 21.5a7.4 7.4 0 0 1 14.8 0" fill="none" stroke={v2.gold} strokeWidth="2" />
    <path d="M4.9 21.5a11.1 11.1 0 0 1 22.2 0" fill="none" stroke={v2.gold} strokeWidth="2" opacity=".55" />
    <path d="M4 21.5h24" stroke={v2.white} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const Outro: React.FC<{ now: number; at: number }> = ({ now, at }) => {
  if (now < at) return null;
  const a = at + 0.1;
  return (
    <AbsoluteFill style={{ background: `rgba(3,5,12,${tween(now, at, 0.5, 0, 0.55)})`, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <Pop now={now} at={a}><Mark size={170} /></Pop>
      <Pop now={now} at={a + 0.15} style={{ fontSize: 110, fontWeight: 900, letterSpacing: 4, marginTop: 10, textShadow: shadow }}>向晓 AI</Pop>
      <Pop now={now} at={a + 0.3} style={{ fontSize: 40, color: v2.gold, letterSpacing: 10, marginTop: 20 }}>AI 前沿 · 每天 30 秒看懂 AI</Pop>
      <Pop now={now} at={a + 0.6} style={{ marginTop: 80, fontSize: 38, padding: "18px 48px", borderRadius: 50, border: `2px solid ${v2.gold}`, color: "#fff" }}>关注我，不错过下一条</Pop>
    </AbsoluteFill>
  );
};

const LEAK_HUES = [200, 0, 260, 20];

export const Auto: React.FC<AutoData> = (d) => {
  const now = useNow();
  const { fps, durationInFrames } = useVideoConfig();
  const f = (s: number) => Math.round(s * fps);
  const impact = d.impacts.reduce((m, t) => (now >= t ? Math.max(m, Math.max(0, 1 - (now - t) / 0.5) ** 2) : m), 0);
  const shake = d.impacts.reduce((s, t) => s + kf(now, t, [0, -14, 11, -7, 4, 0], 0.4), 0);
  const date = d.date.replace(/-/g, ".");
  return (
    <AbsoluteFill style={{ fontFamily: v2.font, color: v2.white, background: "#000" }}>
      <AbsoluteFill style={{ translate: `${shake}px 0px` }}>
        {d.shots.map((s, i) => (
          <Sequence key={i} from={f(s.from)} durationInFrames={Math.max(1, f(s.to) - f(s.from))}>
            <Broll src={`broll/${s.src}.mp4`} push={i % 2 ? [1.12, 1.0] : [1.0, 1.15]} temperature={s.temp ?? -0.2} impact={impact} />
          </Sequence>
        ))}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 22%, transparent 62%, rgba(0,0,0,0.75) 100%)" }} />
      {d.leaks.map((t, i) => (
        <Sequence key={t} from={Math.max(0, f(t) - 8)} durationInFrames={24}>
          <Leak seed={i * 3 + 2} hueShift={LEAK_HUES[i % LEAK_HUES.length]} />
        </Sequence>
      ))}
      <Header date={date} />
      {d.shots.map((s, i) => (
        <OverlayView key={i} now={now} shot={s} voiceEnd={d.voiceEnd} />
      ))}
      <Outro now={now} at={d.voiceEnd} />
      {now < d.voiceEnd + 0.1 && <Captions now={now} data={d.words} />}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 70, textAlign: "center", fontSize: 22, color: "rgba(255,255,255,0.45)", letterSpacing: 2 }}>来源：{d.source} · 内容由 AI 生成</div>
      <AbsoluteFill style={{ background: "#fff", opacity: impact * 0.3, mixBlendMode: "screen" }} />

      <Audio src={staticFile(`frontier/${d.dir ?? d.date}/voice.mp3`)} />
      <Audio src={staticFile("frontier/bgm.mp3")} volume={(fr) => interpolate(fr, [0, 10, f(d.voiceEnd), f(d.voiceEnd) + 10, durationInFrames - 20, durationInFrames], [0, 0.13, 0.13, 0.3, 0.3, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      {d.impacts.map((t) => (
        <SfxAt key={t} at={t} src="frontier/pop.mp3" vol={0.8} />
      ))}
      {d.leaks.map((t) => (
        <SfxAt key={t} at={Math.max(0, t - 0.15)} src="frontier/whoosh.mp3" vol={0.35} />
      ))}
      {d.shots
        .filter((s) => s.overlay?.type === "number")
        .map((s) => (
          <SfxAt key={s.from} at={(s.overlay as { at: number }).at + 0.07} src="frontier/chime.mp3" vol={0.3} />
        ))}
      <SfxAt at={d.voiceEnd + 0.1} src="frontier/chime.mp3" vol={0.4} />
    </AbsoluteFill>
  );
};

// 封面：第一个空镜做背景，文字放在 3:4 安全区里（抖音主页网格只显示中间 1080×1440）
export const AutoCover: React.FC<AutoData> = (d) => {
  const c = d.cover;
  const size = (t: string) => (t.length <= 6 ? 170 : t.length <= 9 ? 130 : 100);
  return (
    <AbsoluteFill style={{ fontFamily: v2.font, color: v2.white, background: "#000" }}>
      <Broll src={`broll/${d.shots[0].src}.mp4`} push={[1.12, 1.12]} temperature={d.shots[0].temp ?? -0.2} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.65) 75%)" }} />
      <Header date={d.date.replace(/-/g, ".")} />
      <div style={{ position: "absolute", left: 80, right: 80, top: 360, textShadow: "0 6px 40px rgba(0,0,0,0.8)" }}>
        <div style={{ display: "inline-block", fontSize: 40, fontWeight: 800, letterSpacing: 6, color: v2.bg0, background: v2.gold, padding: "10px 30px", borderRadius: 40, textShadow: "none" }}>{c.kicker}</div>
        <div style={{ marginTop: 40 }}>
          {c.lines.map((l, i) => {
            const k = c.hl ? l.indexOf(c.hl) : -1;
            return (
              <div key={i} style={{ fontSize: size(l), fontWeight: 900, lineHeight: 1.15, letterSpacing: -2 }}>
                {k < 0 ? l : (
                  <>
                    {l.slice(0, k)}
                    <span style={{ background: v2.gold, color: v2.bg0, padding: "0 16px", borderRadius: 14, textShadow: "none" }}>{c.hl}</span>
                    {l.slice(k + (c.hl?.length ?? 0))}
                  </>
                )}
              </div>
            );
          })}
        </div>
        {c.stamp && <div style={{ marginTop: 40, display: "inline-block", fontSize: c.stamp.length <= 4 ? 230 : 150, fontWeight: 900, color: "#fff", background: "#ef4444", padding: "0 50px", borderRadius: 36, rotate: "-5deg", boxShadow: "0 30px 90px rgba(239,68,68,0.55)", textShadow: "none" }}>{c.stamp}</div>}
        <div style={{ marginTop: 70, fontSize: 50, fontWeight: 700, lineHeight: 1.5, color: "rgba(255,255,255,0.92)" }}>
          {c.sub.map((t, i) => (
            <div key={i} style={{ color: i === c.sub.length - 1 && c.sub.length > 1 ? v2.gold : undefined }}>{t}</div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
