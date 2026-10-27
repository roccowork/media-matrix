import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { useScale } from "./useScale";

export type Cue = { start: number; end: number; text: string }; // 单位：秒

// 字幕条：叠加在任意画面上，按时间显示对应字幕
export const Captions: React.FC<{ cues: Cue[] }> = ({ cues }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = useScale();
  const t = frame / fps;
  const cue = cues.find((c) => t >= c.start && t < c.end);
  if (!cue) return null;

  const local = (t - cue.start) * fps;
  const opacity = interpolate(local, [0, 4], [0, 1], { extrapolateRight: "clamp" });
  const portrait = height > width;

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: (portrait ? 360 : 70) * s }}>
      <div
        style={{
          maxWidth: "86%",
          fontFamily: brand.fonts.sans,
          fontSize: 46 * s,
          fontWeight: 600,
          color: "#fff",
          background: "rgba(11,16,32,0.78)",
          border: `${2 * s}px solid ${brand.colors.border}`,
          borderRadius: 16 * s,
          padding: `${14 * s}px ${32 * s}px`,
          textAlign: "center",
          lineHeight: 1.4,
          opacity,
        }}
      >
        {cue.text}
      </div>
    </AbsoluteFill>
  );
};
