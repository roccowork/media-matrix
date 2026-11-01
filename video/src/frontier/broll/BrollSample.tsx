// 「AI 前沿」实拍空镜版样片（5 秒）：按 Remotion 官方 skill 的做法——底层是背景视频，上面叠文字和动效。
// 空镜来自 Mixkit（Mixkit License，可免费商用），用官方特效包统一调色、压暗、加暗角；
// 重音处用缩放模糊 + 色差做冲击；段落之间用光漏转场。每段只突出一个主体，不堆元素。
import React from "react";
import { Video } from "@remotion/media";
import { colorCorrection } from "@remotion/effects/color-correction";
import { vignette } from "@remotion/effects/vignette";
import { zoomBlur } from "@remotion/effects/zoom-blur";
import { chromaticAberration } from "@remotion/effects/chromatic-aberration";
import { lightLeak } from "@remotion/effects/light-leak";
import { AbsoluteFill, Audio, Sequence, Solid, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Header, v2 } from "../v2/Style";
import { Captions, Count, Headline, SfxAt, Stamp, kf, sp, useNow } from "../motion/MotionSample";

const BOOM = 1.44;
const CUT1 = 1.84;
const CUT2 = 3.68;

// 背景空镜：慢推镜头 + 统一冷色调 + 暗角；impact 是 0~1 的冲击强度
export const Broll: React.FC<{ src: string; push?: [number, number]; impact?: number; temperature?: number }> = ({ src, push = [1.05, 1.15], impact = 0, temperature = -0.25 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ scale: interpolate(frame, [0, durationInFrames], push, { extrapolateRight: "clamp" }) }}>
      <Video
        src={staticFile(src)}
        muted
        objectFit="cover"
        style={{ width: "100%", height: "100%" }}
        effects={[
          colorCorrection({ exposure: -0.55 + impact * 0.9, contrast: 1.15, temperature, saturation: 0.85 }),
          zoomBlur({ amount: impact * 120, center: [0.5, 0.45] }),
          chromaticAberration({ amount: impact * 25 }),
          vignette({ amount: 0.75, radius: 0.55, feather: 0.5 }),
        ]}
      />
    </AbsoluteFill>
  );
};

// 光漏转场（官方 skill 的写法，progress 随帧推进）
export const Leak: React.FC<{ seed: number; hueShift: number }> = ({ seed, hueShift }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  return (
    <Solid
      width={width}
      height={height}
      style={{ mixBlendMode: "screen", opacity: 0.7 }}
      effects={[lightLeak({ seed, hueShift, progress: interpolate(frame, [0, durationInFrames - 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) })]}
    />
  );
};

export const BROLL_SAMPLE_DURATION = 150;

export const BrollSample: React.FC = () => {
  const now = useNow();
  const { fps, durationInFrames } = useVideoConfig();
  // 「没了」那一下的冲击强度：瞬间拉满，0.5 秒内衰减
  const impact = now >= BOOM ? Math.max(0, 1 - (now - BOOM) / 0.5) ** 2 : 0;
  const shake = kf(now, BOOM, [0, -14, 11, -7, 4, 0], 0.4);
  const glow = "0 4px 30px rgba(0,0,0,0.65)";
  return (
    <AbsoluteFill style={{ fontFamily: v2.font, color: v2.white, background: "#000" }}>
      {/* ── 背景空镜 ── */}
      <AbsoluteFill style={{ translate: `${shake}px 0px` }}>
        <Sequence from={0} durationInFrames={Math.round(CUT1 * fps)}>
          <Broll src="broll/hourglass.mp4" push={[1.0, 1.12]} impact={impact} temperature={-0.1} />
        </Sequence>
        <Sequence from={Math.round(CUT1 * fps)} durationInFrames={Math.round((CUT2 - CUT1) * fps)}>
          <Broll src="broll/datacenter.mp4" push={[1.08, 1.3]} temperature={-0.45} />
        </Sequence>
        <Sequence from={Math.round(CUT2 * fps)}>
          <Broll src="broll/money.mp4" push={[1.05, 1.15]} temperature={0.15} />
        </Sequence>
      </AbsoluteFill>
      {/* 底部渐黑，托住字幕 */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 22%, transparent 62%, rgba(0,0,0,0.75) 100%)" }} />

      {/* ── 光漏转场 ── */}
      <Sequence from={Math.round(CUT1 * fps) - 8} durationInFrames={24}>
        <Leak seed={3} hueShift={200} />
      </Sequence>
      <Sequence from={Math.round(CUT2 * fps) - 8} durationInFrames={24}>
        <Leak seed={7} hueShift={0} />
      </Sequence>

      <Header date="2026.11.01" />

      {/* ── 主体文字：每段只有一个焦点 ── */}
      <div style={{ textShadow: glow }}>
        <Headline now={now} exitAt={1.62} size={128} top={330} ws={[{ text: "Claude", at: 0 }, { text: "的", at: 0.32 }, { text: "5 小时", at: 0.5, hl: true }, { text: "限制", at: 1.05 }]} />
        <Stamp now={now} at={BOOM} leaveAt={1.66} />
        <Headline now={now} exitAt={3.55} size={190} top={620} ws={[{ text: "10.30", at: 2.0, gold: true }]} />
        <Headline now={now} exitAt={3.55} size={96} top={860} ws={[{ text: "Anthropic", at: 2.72 }, { text: "官宣", at: 3.2 }]} />
      </div>
      {now >= 2.0 && now < 3.9 && (
        <div style={{ position: "absolute", left: 88, top: 600, width: 140 * sp(now, 2.05, 0, 1, { stiffness: 200, damping: 20 }), height: 6, background: v2.gold, opacity: interpolate(now, [3.5, 3.7], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />
      )}
      {now >= CUT2 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 640, textAlign: "center", scale: String(sp(now, CUT2, 0.5, 1, { stiffness: 260, damping: 13 })) }}>
          <div style={{ fontSize: 42, color: "rgba(255,255,255,0.85)", letterSpacing: 10, textShadow: glow }}>顶配套餐 · 每月</div>
          <div style={{ fontSize: 280, fontWeight: 900, lineHeight: 1.05, letterSpacing: -4, background: "linear-gradient(180deg, #fff6d8 0%, #f5b83d 55%, #b86b00 100%)", WebkitBackgroundClip: "text", color: "transparent", filter: "drop-shadow(0 8px 40px rgba(0,0,0,0.6)) drop-shadow(0 0 30px rgba(245,184,61,0.45))" }}>
            $<Count now={now} at={3.75} to={200} />
          </div>
        </div>
      )}

      <Captions now={now} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 70, textAlign: "center", fontSize: 22, color: "rgba(255,255,255,0.45)", letterSpacing: 2 }}>来源：Anthropic 官方公告 · 内容由 AI 生成</div>

      {/* 「没了」闪白 */}
      <AbsoluteFill style={{ background: "#fff", opacity: impact * 0.35, mixBlendMode: "screen" }} />

      <Audio src={staticFile("frontier/2026-11-01/voice.mp3")} />
      <Audio src={staticFile("frontier/bgm.mp3")} volume={(f) => 0.13 * interpolate(f, [0, 10, durationInFrames - 15, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      <SfxAt at={BOOM} src="frontier/pop.mp3" vol={0.8} />
      <SfxAt at={CUT1 - 0.15} src="frontier/whoosh.mp3" vol={0.45} />
      <SfxAt at={CUT2 - 0.15} src="frontier/whoosh.mp3" vol={0.4} />
      <SfxAt at={3.75} src="frontier/chime.mp3" vol={0.3} />
    </AbsoluteFill>
  );
};
