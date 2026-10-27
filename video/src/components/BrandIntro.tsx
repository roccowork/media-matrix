import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { Background } from "./Background";
import { Logo } from "./Logo";
import { useScale } from "./useScale";

export type BrandIntroProps = {
  episode?: string; // 例如「第 02 期」
  title?: string; // 本期标题
};

// 品牌片头（约 3 秒）：Logo 弹出 → 账号名 → 本期标题
export const BrandIntro: React.FC<BrandIntroProps> = ({ episode, title }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const s = useScale();
  const portrait = height > width;

  const logoIn = spring({ frame, fps, config: { damping: 12 } });
  const nameIn = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const titleIn = spring({ frame: frame - 28, fps, config: { damping: 200 } });
  const fadeOut = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <Background>
      <AbsoluteFill
        style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 36 * s, opacity: fadeOut }}
      >
        <div style={{ transform: `scale(${logoIn}) rotate(${(1 - logoIn) * -90}deg)` }}>
          <Logo size={180 * s} cursorOn={Math.floor(frame / 8) % 2 === 0} />
        </div>
        <div
          style={{
            fontFamily: brand.fonts.sans,
            fontWeight: 800,
            fontSize: 88 * s,
            color: brand.colors.text,
            letterSpacing: 4 * s,
            opacity: nameIn,
            transform: `translateY(${(1 - nameIn) * 40 * s}px)`,
          }}
        >
          {brand.name}
        </div>
        {title ? (
          <div
            style={{
              display: "flex",
              flexDirection: portrait ? "column" : "row",
              alignItems: "center",
              gap: 20 * s,
              opacity: titleIn,
              transform: `translateY(${(1 - titleIn) * 30 * s}px)`,
              fontFamily: brand.fonts.sans,
              fontSize: 44 * s,
              color: brand.colors.muted,
              maxWidth: "85%",
              textAlign: "center",
            }}
          >
            {episode ? (
              <span
                style={{
                  flexShrink: 0,
                  color: brand.colors.bg,
                  background: brand.colors.primary,
                  borderRadius: 10 * s,
                  padding: `${6 * s}px ${18 * s}px`,
                  fontWeight: 700,
                  fontSize: 34 * s,
                }}
              >
                {episode}
              </span>
            ) : null}
            <span>{title}</span>
          </div>
        ) : (
          <div style={{ fontFamily: brand.fonts.sans, fontSize: 40 * s, color: brand.colors.muted, opacity: titleIn }}>
            {brand.slogan}
          </div>
        )}
      </AbsoluteFill>
    </Background>
  );
};
