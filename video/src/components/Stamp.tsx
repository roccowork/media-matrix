import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { useScale } from "./useScale";

// 红色印章：从大到小「盖」下来，用于否定、纠错
export const Stamp: React.FC<{ text: string; at: number; color?: string; rotate?: number; size?: number }> = ({
  text,
  at,
  color = brand.colors.danger,
  rotate = -12,
  size = 40,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = useScale();
  if (frame < at) return null;
  const p = spring({ frame: frame - at, fps, config: { damping: 14, stiffness: 180 } });
  const scale = interpolate(p, [0, 1], [2.6, 1]);
  return (
    <div
      style={{
        display: "inline-block",
        transform: `rotate(${rotate}deg) scale(${scale})`,
        opacity: Math.min(1, p * 1.5),
        border: `${5 * s}px solid ${color}`,
        borderRadius: 12 * s,
        padding: `${8 * s}px ${22 * s}px`,
        color,
        fontFamily: brand.fonts.sans,
        fontWeight: 900,
        fontSize: size * s,
        letterSpacing: 2 * s,
        background: "rgba(11,16,32,0.85)",
        boxShadow: `0 0 ${30 * s}px ${color}66`,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};
