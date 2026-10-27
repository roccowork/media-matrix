import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { Background } from "./Background";
import { useScale } from "./useScale";

export type TitleCardProps = {
  kicker?: string; // 小标题，例如「Step 1」
  title: string;
  subtitle?: string;
};

// 章节标题卡：用于视频中切换段落
export const TitleCard: React.FC<TitleCardProps> = ({ kicker, title, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = useScale();
  const bar = spring({ frame, fps, config: { damping: 200 } });
  const text = spring({ frame: frame - 6, fps, config: { damping: 200 } });
  const out = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <Background>
      <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${120 * s}px`, opacity: out }}>
        <div style={{ display: "flex", gap: 32 * s }}>
          <div
            style={{
              width: 12 * s,
              borderRadius: 6 * s,
              background: `linear-gradient(${brand.colors.primary}, ${brand.colors.accent})`,
              transform: `scaleY(${bar})`,
              transformOrigin: "top",
            }}
          />
          <div style={{ fontFamily: brand.fonts.sans, opacity: text, transform: `translateX(${(1 - text) * 40 * s}px)` }}>
            {kicker ? (
              <div style={{ fontFamily: brand.fonts.mono, fontSize: 36 * s, color: brand.colors.primary, marginBottom: 12 * s }}>
                {kicker}
              </div>
            ) : null}
            <div style={{ fontSize: 84 * s, fontWeight: 800, color: brand.colors.text, lineHeight: 1.2 }}>{title}</div>
            {subtitle ? (
              <div style={{ fontSize: 40 * s, color: brand.colors.muted, marginTop: 20 * s }}>{subtitle}</div>
            ) : null}
          </div>
        </div>
      </AbsoluteFill>
    </Background>
  );
};
