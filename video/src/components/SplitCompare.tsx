import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { Background } from "./Background";
import { useScale } from "./useScale";

type Side = { title: string; color: string; children: React.ReactNode };

// 分屏对比：左右（竖屏时上下）两栏，中间分割线展开
export const SplitCompare: React.FC<{ left: Side; right: Side }> = ({ left, right }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const s = useScale();
  const portrait = height > width;
  const line = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const panel = (side: Side, i: number) => {
    const p = interpolate(frame, [8 + i * 6, 22 + i * 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 30 * s, opacity: p }}>
        <div
          style={{
            fontFamily: brand.fonts.sans,
            fontSize: 40 * s,
            fontWeight: 800,
            color: side.color,
            marginBottom: 24 * s,
            borderBottom: `${4 * s}px solid ${side.color}`,
            paddingBottom: 6 * s,
          }}
        >
          {side.title}
        </div>
        <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>{side.children}</div>
      </div>
    );
  };
  return (
    <Background>
      <AbsoluteFill style={{ flexDirection: portrait ? "column" : "row" }}>
        {panel(left, 0)}
        <div
          style={{
            background: brand.colors.border,
            [portrait ? "height" : "width"]: 3 * s,
            [portrait ? "width" : "height"]: `${line * 80}%`,
            alignSelf: "center",
          }}
        />
        {panel(right, 1)}
      </AbsoluteFill>
    </Background>
  );
};
