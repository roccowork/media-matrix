// 「AI 科普」横屏成片（1920×1080，0.5～5 分钟）：画面全部由数据驱动（tools/make_explainer.py 生成 public/explainer/<编号>/auto.json）。
// 每段 = 一段配音 + 一个图解画面（标题 / 时间线 / 流程 / 对比 / 数字 / 清单 / 引言 / 空镜），元素在口播念到时出现。
// 风格沿用向晓 AI：深色底、只用金色一种强调色。为了渲染快，不用 backdrop-filter、大面积模糊和 WebGL 特效。
import React from "react";
import { Video } from "@remotion/media";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import { v2 } from "../frontier/v2/Style";
import { SfxAt, sp, tween, useNow } from "../frontier/motion/MotionSample";

// ── 数据格式（和 tools/make_explainer.py 对应）──
type Item = { text: string; at: number };
type Side = { title: string; at: number; points: Item[] };
export type Visual =
  | { type: "title"; kicker?: string; title: string; sub?: string; at: number }
  | { type: "timeline"; items: { when: string; label: string; at: number }[] }
  | { type: "flow"; title?: string; steps: Item[] }
  | { type: "compare"; left: Side; right: Side }
  | { type: "number"; prefix: string; value: number; decimals: number; suffix: string; label: string; at: number }
  | { type: "list"; title: string; items: Item[] }
  | { type: "quote"; text: string; who?: string; at: number }
  | { type: "broll"; src: string; caption?: string; at: number };
export type Scene = { from: number; to: number; audio: string; visual: Visual };
export type ExplainerData = {
  slug: string;
  title: string;
  sources: string[];
  intro: number;
  voiceEnd: number;
  total: number;
  scenes: Scene[];
  subs: { from: number; to: number; text: string }[];
  cover: { lines: string[]; hl: string; sub: string };
};

const SERIES = "AI 科普";
const shadow = "0 4px 24px rgba(0,0,0,0.6)";
const gold = v2.gold;

// 出现：从下面弹上来
const Pop: React.FC<{ now: number; at: number; children: React.ReactNode; style?: React.CSSProperties; dy?: number }> = ({ now, at, children, style, dy = 40 }) => {
  const s = sp(now, at, 0, 1, { stiffness: 300, damping: 20 });
  return <div style={{ opacity: Math.min(1, s * 1.4), translate: `0px ${(1 - s) * dy}px`, ...style }}>{children}</div>;
};

// 背景：深色渐变 + 一处缓慢移动的暖光（每段换位置），再加一层细网格，像图解板
const Board: React.FC<{ now: number; seed: number }> = ({ now, seed }) => {
  const x = 30 + ((seed * 37) % 50) + Math.sin(now / 6) * 4;
  const y = 20 + ((seed * 23) % 40);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${v2.bg1} 0%, ${v2.bg0} 75%)` }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${x}% ${y}%, rgba(245,184,61,0.13) 0%, rgba(245,184,61,0.04) 25%, transparent 50%)` }} />
      <AbsoluteFill style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)", backgroundSize: "80px 80px" }} />
    </AbsoluteFill>
  );
};

const Mark: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32">
    <path d="M12.2 21.5a3.8 3.8 0 0 1 7.6 0z" fill={gold} />
    <path d="M8.6 21.5a7.4 7.4 0 0 1 14.8 0" fill="none" stroke={gold} strokeWidth="2" />
    <path d="M4.9 21.5a11.1 11.1 0 0 1 22.2 0" fill="none" stroke={gold} strokeWidth="2" opacity=".55" />
    <path d="M4 21.5h24" stroke={v2.white} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const Header: React.FC<{ title: string }> = ({ title }) => (
  <div style={{ position: "absolute", top: 44, left: 64, right: 64, display: "flex", alignItems: "center", opacity: 0.9 }}>
    <Mark size={40} />
    <span style={{ marginLeft: 14, fontSize: 28, fontWeight: 700, letterSpacing: 2 }}>向晓 AI</span>
    <span style={{ margin: "0 16px", width: 1, height: 24, background: v2.line }} />
    <span style={{ fontSize: 26, color: gold, letterSpacing: 4 }}>{SERIES}</span>
    <span style={{ marginLeft: "auto", fontSize: 24, color: v2.dim, letterSpacing: 2 }}>{title}</span>
  </div>
);

// ── 各种画面 ──
const TitleV: React.FC<{ now: number; v: Extract<Visual, { type: "title" }> }> = ({ now, v }) => (
  <div style={{ position: "absolute", left: 160, right: 160, top: 300, textAlign: "center", textShadow: shadow }}>
    {v.kicker && (
      <Pop now={now} at={v.at}>
        <span style={{ display: "inline-block", fontSize: 34, fontWeight: 800, letterSpacing: 6, color: v2.bg0, background: gold, padding: "8px 28px", borderRadius: 40, textShadow: "none" }}>{v.kicker}</span>
      </Pop>
    )}
    <Pop now={now} at={v.at + 0.15} style={{ marginTop: 36, fontSize: v.title.length > 14 ? 92 : 120, fontWeight: 900, lineHeight: 1.2, letterSpacing: -1 }}>{v.title}</Pop>
    {v.sub && <Pop now={now} at={v.at + 0.45} style={{ marginTop: 28, fontSize: 46, color: "rgba(248,250,252,0.8)" }}>{v.sub}</Pop>}
  </div>
);

const TimelineV: React.FC<{ now: number; v: Extract<Visual, { type: "timeline" }> }> = ({ now, v }) => {
  const n = v.items.length;
  const left = 300, right = 1620, y = 520;
  const xs = v.items.map((_, i) => (n === 1 ? (left + right) / 2 : left + ((right - left) * i) / (n - 1)));
  // 主线画到最近一个已经出现的节点
  const reached = v.items.reduce((m, it, i) => (now >= it.at ? i : m), -1);
  const lineTo = reached < 0 ? left : xs[reached] + (reached < n - 1 ? tween(now, v.items[reached].at, 0.6, 0, 1) * 40 : 0);
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", left, top: y - 2, width: right - left, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 2 }} />
      <div style={{ position: "absolute", left, top: y - 2, width: Math.max(0, lineTo - left), height: 4, background: gold, borderRadius: 2, boxShadow: `0 0 18px ${gold}88` }} />
      {v.items.map((it, i) => {
        const s = sp(now, it.at, 0, 1, { stiffness: 320, damping: 16 });
        const active = i === reached;
        return (
          <div key={i} style={{ position: "absolute", left: xs[i] - 160, width: 320, top: 0, textAlign: "center", opacity: Math.min(1, s * 1.5) }}>
            <div style={{ position: "absolute", top: y - 150, left: 0, right: 0, fontSize: active ? 64 : 54, fontWeight: 900, color: active ? gold : v2.white, translate: `0px ${(1 - s) * 30}px` }}>{it.when}</div>
            <div style={{ position: "absolute", top: y - 16, left: 160 - 16, width: 32, height: 32, borderRadius: 16, background: active ? gold : v2.bg0, border: `4px solid ${gold}`, scale: String(s), boxShadow: active ? `0 0 30px ${gold}` : "none" }} />
            <div style={{ position: "absolute", top: y + 50, left: 0, right: 0, fontSize: 38, lineHeight: 1.35, color: active ? v2.white : "rgba(248,250,252,0.7)", translate: `0px ${(1 - s) * -30}px` }}>{it.label}</div>
          </div>
        );
      })}
    </div>
  );
};

const FlowV: React.FC<{ now: number; v: Extract<Visual, { type: "flow" }> }> = ({ now, v }) => {
  const n = v.steps.length;
  const gap = 90;
  const w = Math.min(380, (1700 - gap * (n - 1)) / n);
  const total = w * n + gap * (n - 1);
  const x0 = (1920 - total) / 2;
  const reached = v.steps.reduce((m, it, i) => (now >= it.at ? i : m), -1);
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {v.title && <Pop now={now} at={v.steps[0]?.at ?? 0} style={{ position: "absolute", top: 200, left: 0, right: 0, textAlign: "center", fontSize: 52, fontWeight: 800 }}>{v.title}</Pop>}
      {v.steps.map((st, i) => {
        const s = sp(now, st.at, 0, 1, { stiffness: 300, damping: 18 });
        const x = x0 + i * (w + gap);
        const active = i === reached;
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <div style={{ position: "absolute", left: x - gap + 14, top: 538, width: (gap - 28) * tween(now, st.at - 0.25, 0.3, 0, 1), height: 5, background: gold, borderRadius: 3 }}>
                <div style={{ position: "absolute", right: -6, top: -9, width: 0, height: 0, borderLeft: `16px solid ${gold}`, borderTop: "11px solid transparent", borderBottom: "11px solid transparent", opacity: now >= st.at ? 1 : 0 }} />
              </div>
            )}
            <div style={{ position: "absolute", left: x, top: 420, width: w, height: 240, borderRadius: 28, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24, boxSizing: "border-box",
              fontSize: w < 300 ? 38 : 46, fontWeight: 800, lineHeight: 1.3,
              background: active ? "rgba(245,184,61,0.14)" : "rgba(255,255,255,0.05)", border: `3px solid ${active ? gold : "rgba(255,255,255,0.18)"}`,
              boxShadow: active ? `0 0 50px rgba(245,184,61,0.25)` : "none", opacity: Math.min(1, s * 1.4), scale: String(0.8 + s * 0.2) }}>
              <div>
                <div style={{ fontSize: 26, color: gold, fontWeight: 700, marginBottom: 10 }}>{String(i + 1).padStart(2, "0")}</div>
                {st.text}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

const SideV: React.FC<{ now: number; s: Side; x: number; accent: boolean }> = ({ now, s, x, accent }) => (
  <div style={{ position: "absolute", left: x, top: 220, width: 720 }}>
    <Pop now={now} at={s.at} style={{ fontSize: 58, fontWeight: 900, color: accent ? gold : v2.white, paddingBottom: 20, borderBottom: `4px solid ${accent ? gold : "rgba(255,255,255,0.3)"}` }}>{s.title}</Pop>
    {s.points.map((p, i) => (
      <Pop key={i} now={now} at={p.at} style={{ marginTop: 34, fontSize: 46, lineHeight: 1.4, display: "flex" }}>
        <span style={{ color: accent ? gold : v2.dim, marginRight: 18 }}>●</span>
        <span>{p.text}</span>
      </Pop>
    ))}
  </div>
);

const CompareV: React.FC<{ now: number; v: Extract<Visual, { type: "compare" }> }> = ({ now, v }) => (
  <div style={{ position: "absolute", inset: 0 }}>
    <SideV now={now} s={v.left} x={150} accent={false} />
    <div style={{ position: "absolute", left: 960 - 1, top: 230, width: 2, height: 560, background: v2.line }} />
    <Pop now={now} at={v.right.at} style={{ position: "absolute", left: 960 - 50, top: 450, width: 100, height: 100, borderRadius: 50, background: v2.bg0, border: `3px solid ${gold}`, color: gold, fontSize: 38, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>VS</Pop>
    <SideV now={now} s={v.right} x={1050} accent />
  </div>
);

const NumberV: React.FC<{ now: number; v: Extract<Visual, { type: "number" }> }> = ({ now, v }) => {
  const x = Math.max(0, Math.min(v.value, sp(now, v.at, 0, v.value, { stiffness: 80, damping: 16 })));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 290, textAlign: "center", opacity: now < v.at ? 0 : 1 }}>
      <div style={{ fontSize: 230, fontWeight: 900, letterSpacing: -4, lineHeight: 1.05, background: "linear-gradient(180deg, #fff6d8 0%, #f5b83d 55%, #b86b00 100%)", WebkitBackgroundClip: "text", color: "transparent", scale: String(sp(now, v.at, 0.6, 1, { stiffness: 240, damping: 14 })) }}>
        {v.prefix}
        {x.toFixed(v.decimals)}
        {v.suffix}
      </div>
      {v.label && <Pop now={now} at={v.at + 0.3} style={{ marginTop: 20, fontSize: 50, color: "rgba(248,250,252,0.85)", letterSpacing: 4 }}>{v.label}</Pop>}
    </div>
  );
};

const ListV: React.FC<{ now: number; v: Extract<Visual, { type: "list" }> }> = ({ now, v }) => {
  const reached = v.items.reduce((m, it, i) => (now >= it.at ? i : m), -1);
  return (
    <div style={{ position: "absolute", left: 260, right: 260, top: 180 }}>
      {v.title && <Pop now={now} at={v.items[0]?.at - 0.3} style={{ fontSize: 58, fontWeight: 900, marginBottom: 30 }}>{v.title}</Pop>}
      {v.items.map((it, i) => (
        <Pop key={i} now={now} at={it.at} dy={0} style={{ display: "flex", alignItems: "center", marginTop: 22, padding: "20px 30px", borderRadius: 20, background: i === reached ? "rgba(245,184,61,0.12)" : "rgba(255,255,255,0.04)", border: `2px solid ${i === reached ? gold : "rgba(255,255,255,0.1)"}`, translate: `${(1 - sp(now, it.at, 0, 1)) * -60}px 0px` }}>
          <span style={{ width: 64, height: 64, borderRadius: 32, background: i === reached ? gold : "rgba(255,255,255,0.12)", color: i === reached ? v2.bg0 : v2.white, fontSize: 34, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
          <span style={{ marginLeft: 28, fontSize: 42, lineHeight: 1.35, fontWeight: 600 }}>{it.text}</span>
        </Pop>
      ))}
    </div>
  );
};

const QuoteV: React.FC<{ now: number; v: Extract<Visual, { type: "quote" }> }> = ({ now, v }) => {
  const shown = Math.floor(tween(now, v.at + 0.2, Math.max(1, v.text.length * 0.08), 0, v.text.length, (t) => t));
  return (
    <div style={{ position: "absolute", left: 220, right: 220, top: 230 }}>
      <Pop now={now} at={v.at} style={{ fontSize: 200, lineHeight: 0.8, color: gold, fontFamily: "Georgia, serif" }}>“</Pop>
      <div style={{ fontSize: v.text.length > 40 ? 52 : 64, fontWeight: 700, lineHeight: 1.5, textShadow: shadow }}>
        {v.text.slice(0, shown)}
        <span style={{ opacity: 0 }}>{v.text.slice(shown)}</span>
      </div>
      {v.who && <Pop now={now} at={v.at + v.text.length * 0.08 + 0.3} style={{ marginTop: 36, fontSize: 40, color: gold, textAlign: "right" }}>—— {v.who}</Pop>}
    </div>
  );
};

const BrollV: React.FC<{ now: number; v: Extract<Visual, { type: "broll" }> }> = ({ now, v }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ scale: String(1.02 + (now - v.at) * 0.006) }}>
        <Video src={staticFile(`broll/${v.src}.mp4`)} muted loop objectFit="cover" style={{ width: "100%", height: "100%" }} />
      </AbsoluteFill>
      {/* 压暗 + 暗角用一层渐变（不用 WebGL 特效：软件渲染下慢 5 倍以上） */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(5,7,12,0.25) 0%, rgba(5,7,12,0.55) 60%, rgba(5,7,12,0.85) 100%)" }} />
      {v.caption && (
        <Pop now={now} at={v.at + 10 / fps} style={{ position: "absolute", left: 120, top: 760, fontSize: 56, fontWeight: 900, padding: "14px 34px", borderLeft: `10px solid ${gold}`, background: "rgba(5,7,12,0.7)" }}>{v.caption}</Pop>
      )}
    </AbsoluteFill>
  );
};

const VisualView: React.FC<{ now: number; v: Visual }> = ({ now, v }) => {
  switch (v.type) {
    case "timeline": return <TimelineV now={now} v={v} />;
    case "flow": return <FlowV now={now} v={v} />;
    case "compare": return <CompareV now={now} v={v} />;
    case "number": return <NumberV now={now} v={v} />;
    case "list": return <ListV now={now} v={v} />;
    case "quote": return <QuoteV now={now} v={v} />;
    case "broll": return <BrollV now={now} v={v} />;
    default: return <TitleV now={now} v={v} />;
  }
};

// 字幕：底部居中，白字黑边，不挡画面主体
const Subtitle: React.FC<{ now: number; subs: ExplainerData["subs"] }> = ({ now, subs }) => {
  const s = subs.find((x) => now >= x.from - 0.05 && now <= x.to + 0.25);
  if (!s) return null;
  return (
    <div style={{ position: "absolute", left: 120, right: 120, bottom: 70, textAlign: "center" }}>
      <span style={{ display: "inline-block", fontSize: 50, fontWeight: 700, lineHeight: 1.35, padding: "8px 26px", borderRadius: 12, background: "rgba(0,0,0,0.45)", textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}>{s.text}</span>
    </div>
  );
};

const Intro: React.FC<{ now: number; d: ExplainerData }> = ({ now, d }) => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", opacity: 1 - tween(now, d.intro - 0.4, 0.4, 0, 1) }}>
    <Pop now={now} at={0.1}><Mark size={150} /></Pop>
    <Pop now={now} at={0.35} style={{ marginTop: 10, fontSize: 40, color: gold, letterSpacing: 12 }}>向晓 AI · {SERIES}</Pop>
    <Pop now={now} at={0.6} style={{ marginTop: 30, fontSize: d.title.length > 14 ? 84 : 110, fontWeight: 900, textShadow: shadow }}>{d.title}</Pop>
  </AbsoluteFill>
);

const Outro: React.FC<{ now: number; at: number }> = ({ now, at }) => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", background: `rgba(3,5,12,${tween(now, at, 0.5, 0, 0.6)})` }}>
    <Pop now={now} at={at + 0.1}><Mark size={150} /></Pop>
    <Pop now={now} at={at + 0.3} style={{ fontSize: 96, fontWeight: 900, letterSpacing: 4, marginTop: 10 }}>向晓 AI</Pop>
    <Pop now={now} at={at + 0.5} style={{ fontSize: 38, color: gold, letterSpacing: 10, marginTop: 16 }}>{SERIES} · 用动画讲清楚一个知识点</Pop>
    <Pop now={now} at={at + 0.8} style={{ marginTop: 60, fontSize: 36, padding: "16px 44px", borderRadius: 50, border: `2px solid ${gold}` }}>关注我，下期见</Pop>
  </AbsoluteFill>
);

export const Explainer: React.FC<ExplainerData> = (d) => {
  const now = useNow();
  const { fps, durationInFrames } = useVideoConfig();
  const f = (s: number) => Math.round(s * fps);
  const idx = d.scenes.findIndex((s) => now >= s.from && now < s.to);
  const scene = idx >= 0 ? d.scenes[idx] : null;
  const fade = scene ? Math.min(tween(now, scene.from, 0.35, 0, 1), 1 - tween(now, scene.to - 0.3, 0.3, 0, 1)) : 0;
  return (
    <AbsoluteFill style={{ fontFamily: v2.font, color: v2.white, background: v2.bg0 }}>
      <Board now={now} seed={Math.max(0, idx) + 1} />
      {now < d.intro && <Intro now={now} d={d} />}
      {scene && (
        <AbsoluteFill style={{ opacity: fade }}>
          <VisualView now={now} v={scene.visual} />
        </AbsoluteFill>
      )}
      {now >= d.intro && now < d.voiceEnd && <Header title={d.title} />}
      {now < d.voiceEnd && <Subtitle now={now} subs={d.subs} />}
      {now >= d.intro && now < d.voiceEnd && (
        <div style={{ position: "absolute", left: 0, bottom: 0, height: 6, width: `${((now - d.intro) / (d.voiceEnd - d.intro)) * 100}%`, background: gold, opacity: 0.8 }} />
      )}
      {now >= d.intro && now < d.voiceEnd && d.sources.length > 0 && (
        <div style={{ position: "absolute", right: 64, bottom: 24, fontSize: 20, color: "rgba(255,255,255,0.4)" }}>参考：{d.sources.join("；")} · 内容由 AI 辅助生成</div>
      )}
      {now >= d.voiceEnd && <Outro now={now} at={d.voiceEnd} />}

      {d.scenes.map((s) => (
        <Sequence key={s.from} from={f(s.from)} durationInFrames={Math.max(1, f(s.to) - f(s.from))} layout="none">
          <Audio src={staticFile(s.audio)} />
        </Sequence>
      ))}
      <Audio src={staticFile("frontier/bgm.mp3")} loop volume={(fr) => interpolate(fr, [0, 15, f(d.intro), f(d.intro) + 15, f(d.voiceEnd), f(d.voiceEnd) + 15, durationInFrames - 20, durationInFrames], [0, 0.3, 0.3, 0.07, 0.07, 0.28, 0.28, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      <SfxAt at={0.1} src="frontier/whoosh.mp3" vol={0.4} />
      {d.scenes.slice(1).map((s) => (
        <SfxAt key={s.from} at={Math.max(0, s.from - 0.1)} src="frontier/whoosh.mp3" vol={0.15} />
      ))}
      <SfxAt at={d.voiceEnd + 0.1} src="frontier/chime.mp3" vol={0.4} />
    </AbsoluteFill>
  );
};

// 封面（16:9，B 站 / YouTube / 抖音横屏都能用）
export const ExplainerCover: React.FC<ExplainerData> = (d) => {
  const c = d.cover;
  const size = (t: string) => (t.length <= 8 ? 150 : t.length <= 12 ? 120 : 96);
  return (
    <AbsoluteFill style={{ fontFamily: v2.font, color: v2.white }}>
      <Board now={0} seed={3} />
      <div style={{ position: "absolute", left: 120, top: 120, display: "flex", alignItems: "center" }}>
        <Mark size={70} />
        <span style={{ marginLeft: 18, fontSize: 44, fontWeight: 800, letterSpacing: 3 }}>向晓 AI</span>
        <span style={{ marginLeft: 24, fontSize: 36, fontWeight: 800, letterSpacing: 6, color: v2.bg0, background: gold, padding: "6px 24px", borderRadius: 30 }}>{SERIES}</span>
      </div>
      <div style={{ position: "absolute", left: 120, right: 120, top: 320, textShadow: shadow }}>
        {c.lines.map((l, i) => {
          const k = c.hl ? l.indexOf(c.hl) : -1;
          return (
            <div key={i} style={{ fontSize: size(l), fontWeight: 900, lineHeight: 1.2, letterSpacing: -2 }}>
              {k < 0 ? l : (
                <>
                  {l.slice(0, k)}
                  <span style={{ color: gold }}>{c.hl}</span>
                  {l.slice(k + c.hl.length)}
                </>
              )}
            </div>
          );
        })}
        {c.sub && <div style={{ marginTop: 40, fontSize: 52, color: "rgba(248,250,252,0.85)" }}>{c.sub}</div>}
      </div>
    </AbsoluteFill>
  );
};
