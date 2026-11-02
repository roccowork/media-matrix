// 「AI 科普」成片（1920×1080）：每段口播配一个镜头（src/science/ 的镜头库，见 HANDBOOK.md），
// 镜头时长按这段配音的长度适配（ShotFit：拉长停留段或整体压缩），底部是配音字幕，左上角是品牌角标。
// 数据由 tools/make_explainer.py 生成（public/explainer/<编号>/auto.json），渲染时 --props 传入。
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { SHOTS } from "../science";
import { C, FONT, ShotFit, Stage, rgba, Rise } from "../science/kit";

export type Scene = { from: number; to: number; audio?: string; voice?: string; voiceAt?: number; shot: { type: string; props?: Record<string, unknown> } };
export type ExplainerData = {
  slug: string;
  title: string;
  sources: string[];
  voiceEnd: number;
  total: number;
  scenes: Scene[];
  subs: { from: number; to: number; text: string }[];
  cover: { lines: string[]; hl: string; sub: string };
};

const SERIES = "AI 科普";

// 品牌角标：小、安静，只在镜头之上常驻
const Mark: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32">
    <path d="M12.2 21.5a3.8 3.8 0 0 1 7.6 0z" fill={C.gold} />
    <path d="M8.6 21.5a7.4 7.4 0 0 1 14.8 0" fill="none" stroke={C.gold} strokeWidth="2" />
    <path d="M4.9 21.5a11.1 11.1 0 0 1 22.2 0" fill="none" stroke={C.gold} strokeWidth="2" opacity=".55" />
    <path d="M4 21.5h24" stroke={C.ink} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

// 字幕：底部居中，深色衬底，≥56px（手机小窗也读得清）
const Subtitle: React.FC<{ subs: ExplainerData["subs"] }> = ({ subs }) => {
  const now = useCurrentFrame() / 30;
  const s = subs.find((x) => now >= x.from - 0.05 && now <= x.to + 0.2);
  if (!s) return null;
  return (
    <div style={{ position: "absolute", left: 100, right: 100, bottom: 46, textAlign: "center", fontFamily: FONT }}>
      <span style={{ display: "inline-block", fontSize: 56, fontWeight: 700, lineHeight: 1.3, padding: "8px 28px", borderRadius: 14, color: C.ink, background: "rgba(2,4,12,0.62)", textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}>{s.text}</span>
    </div>
  );
};

const Outro: React.FC<{ at: number }> = ({ at }) => {
  const f = useCurrentFrame() - at;
  return (
    <Stage keyLight={[0.5, 0.2]} horizon={0.75}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: FONT }}>
        <div style={{ opacity: Math.min(1, f / 8), transform: `scale(${interpolate(f, [0, 14], [0.7, 1], { extrapolateRight: "clamp" })})` }}><Mark size={150} /></div>
        <div style={{ marginTop: 10, fontSize: 100, fontWeight: 900 }}><Rise text="向晓 AI" at={at + 6} gap={3} /></div>
        <div style={{ marginTop: 16, fontSize: 40, color: C.gold, letterSpacing: 10 }}><Rise text={`${SERIES} · 一分钟看懂一个知识点`} at={at + 14} gap={1} /></div>
        <div style={{ marginTop: 60, fontSize: 38, padding: "16px 46px", borderRadius: 50, border: `2px solid ${C.gold}`, opacity: Math.min(1, Math.max(0, (f - 24) / 10)) }}>关注我，下期见</div>
      </AbsoluteFill>
    </Stage>
  );
};

export const Explainer: React.FC<ExplainerData> = (d) => {
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const f = (s: number) => Math.round(s * fps);
  return (
    <AbsoluteFill style={{ background: C.bg0, fontFamily: FONT }}>
      {d.scenes.map((s, i) => {
        const shot = SHOTS[s.shot.type] ?? SHOTS.title;
        const len = Math.max(1, f(s.to) - f(s.from));
        return (
          <Sequence key={i} from={f(s.from)} durationInFrames={len}>
            <ShotFit meta={shot.meta} actual={len}>
              <shot.C {...(s.shot.props ?? {})} />
            </ShotFit>
          </Sequence>
        );
      })}
      {d.scenes.map((s, i) =>
        s.voice ? (
          <Sequence key={`v${i}`} from={f(s.voiceAt ?? s.from)} layout="none">
            <Audio src={staticFile(s.voice)} />
          </Sequence>
        ) : null,
      )}
      <Sequence from={f(d.voiceEnd)}>
        <Outro at={f(d.voiceEnd)} />
      </Sequence>
      {frame < f(d.voiceEnd) && (
        <>
          <div style={{ position: "absolute", top: 36, left: 48, display: "flex", alignItems: "center", opacity: 0.85 }}>
            <Mark size={36} />
            <span style={{ marginLeft: 12, fontSize: 26, fontWeight: 700, letterSpacing: 2, color: C.ink }}>向晓 AI</span>
            <span style={{ margin: "0 14px", width: 1, height: 22, background: C.line }} />
            <span style={{ fontSize: 24, color: C.gold, letterSpacing: 4 }}>{SERIES}</span>
          </div>
          <Subtitle subs={d.subs} />
          {d.sources.length > 0 && <div style={{ position: "absolute", right: 48, top: 40, fontSize: 20, color: rgba("#ffffff", 0.4) }}>参考：{d.sources.join("；")} · 内容由 AI 辅助生成</div>}
        </>
      )}
      <Audio src={staticFile("frontier/bgm.mp3")} loop volume={(fr) => interpolate(fr, [0, 15, f(d.voiceEnd), f(d.voiceEnd) + 15, durationInFrames - 20, durationInFrames], [0, 0.08, 0.08, 0.28, 0.28, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
    </AbsoluteFill>
  );
};

// 封面（16:9）：舞台 + 大标题，关键词金色
export const ExplainerCover: React.FC<ExplainerData> = (d) => {
  const c = d.cover;
  const size = (t: string) => (t.length <= 6 ? 170 : t.length <= 10 ? 130 : 100);
  return (
    <Stage keyLight={[0.3, 0.1]} horizon={0.88}>
      <div style={{ position: "absolute", left: 120, top: 110, display: "flex", alignItems: "center", fontFamily: FONT }}>
        <Mark size={70} />
        <span style={{ marginLeft: 18, fontSize: 44, fontWeight: 800, letterSpacing: 3 }}>向晓 AI</span>
        <span style={{ marginLeft: 24, fontSize: 36, fontWeight: 800, letterSpacing: 6, color: "#160f02", background: C.gold, padding: "6px 24px", borderRadius: 30 }}>{SERIES}</span>
      </div>
      <div style={{ position: "absolute", left: 120, right: 120, top: 300, fontFamily: FONT, textShadow: "0 6px 40px rgba(0,0,0,0.7)" }}>
        {c.lines.map((l, i) => {
          const k = c.hl ? l.indexOf(c.hl) : -1;
          return (
            <div key={i} style={{ fontSize: size(l), fontWeight: 900, lineHeight: 1.18, letterSpacing: -2 }}>
              {k < 0 ? l : (<>{l.slice(0, k)}<span style={{ color: C.gold }}>{c.hl}</span>{l.slice(k + c.hl.length)}</>)}
            </div>
          );
        })}
        {c.sub && <div style={{ marginTop: 40, fontSize: 52, color: C.dim }}>{c.sub}</div>}
      </div>
    </Stage>
  );
};

// Studio 预览用的示例（无声）：把镜头库每种镜头各放一段
export const EXPLAINER_DEMO: ExplainerData = (() => {
  const types = ["open", "title", "timeline", "layers", "relay", "readout", "versus", "points"];
  let t = 0;
  const scenes = types.map((type) => {
    const len = (SHOTS[type]?.meta.duration ?? 120) / 30;
    const s = { from: t, to: t + len, audio: "", shot: { type } };
    t += len;
    return s;
  });
  return { slug: "demo", title: "Transformer 是怎么来的", sources: [], voiceEnd: t, total: t + 4.5, scenes, subs: [], cover: { lines: ["Transformer", "是怎么来的"], hl: "Transformer", sub: "一篇论文，改变了整个 AI" } };
})();
