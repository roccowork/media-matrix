// 「AI 前沿」v3 样片（5 秒）：画面用开源模板 remotion-video-templates 的 KineticText（逐词弹入），
// 字幕用 remotion-captions-themes（跟着配音逐词跳动），加上 Fluent 3D 图标和 v2 的干净背景。
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import { Line } from "../../vendor/video-templates/KineticText";
import { CaptionTheme } from "../../vendor/captions-themes/CaptionTheme";
import { Backdrop, Header, v2 } from "../v2/Style";
import { Icon3D } from "../v2/Preview";
import { words } from "../episodes/2026-11-01.words";

const Region: React.FC<{ top: number; height: number; children: React.ReactNode }> = ({ top, height, children }) => (
  <div style={{ position: "absolute", left: 40, right: 40, top, height }}>{children}</div>
);

// 一行动感文字：from/to 是帧数
const Kinetic: React.FC<{ text: string; from: number; to: number; top: number; emphasis?: boolean; sizes?: [number, number] }> = ({ text, from, to, top, emphasis, sizes }) => (
  <Sequence from={from} durationInFrames={to - from} layout="none">
    <Region top={top} height={260}>
      <Line text={text} emphasis={Boolean(emphasis)} duration={to - from} textColor={v2.white} emphasisColor={v2.gold} fontFamily={v2.font} sizes={sizes ?? [104, 170]} />
    </Region>
  </Sequence>
);

export const SAMPLE_DURATION = 150;

export const FrontierSample: React.FC<{ theme: string }> = ({ theme }) => {
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ fontFamily: v2.font, color: v2.white }}>
      <Backdrop glow={[80, 15]} />
      <Header date="2026.11.01" />
      {/* 画面主体：跟着配音的节奏逐词弹入 */}
      <Kinetic text="Claude 的 5 小时 限制" from={0} to={70} top={330} />
      <Kinetic text="没了！" from={42} to={150} top={600} emphasis />
      <Kinetic text="Anthropic 10.30 官宣" from={72} to={150} top={330} sizes={[84, 120]} />
      <Icon3D name="alarm_clock" size={280} delay={6} style={{ left: 400, top: 900 }} />
      {/* 字幕：开源字幕主题，逐词跳动 */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 1280, height: 420 }}>
        <CaptionTheme data={words} theme={theme} primaryColor="#FFFFFF" secondaryColor={v2.gold} fontSize={76} />
      </div>
      <Audio src={staticFile("frontier/2026-11-01/voice.mp3")} />
      <Audio src={staticFile("frontier/bgm.mp3")} volume={(f) => 0.12 * interpolate(f, [0, 10, durationInFrames - 15, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
    </AbsoluteFill>
  );
};
