import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { useScale } from "./useScale";

const CHUNK_COLORS = ["#22D3EE", "#A78BFA", "#4ADE80", "#FBBF24", "#F87171", "#60A5FA"];

// 文档切片：一份文档按段落被切成几块，彼此分开并标上颜色
export const DocChunking: React.FC<{ title: string; chunks: string[][]; splitAt: number; width?: number | string }> = ({
  title,
  chunks,
  splitAt,
  width = "70%",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = useScale();
  const p = spring({ frame: frame - splitAt, fps, config: { damping: 16 } });

  return (
    <div style={{ width }}>
      <div
        style={{
          fontFamily: brand.fonts.sans,
          fontSize: 36 * s,
          fontWeight: 800,
          color: brand.colors.text,
          marginBottom: 16 * s,
        }}
      >
        {title}
      </div>
      {chunks.map((lines, i) => {
        const c = CHUNK_COLORS[i % CHUNK_COLORS.length];
        const delay = spring({ frame: frame - splitAt - i * 4, fps, config: { damping: 16 } });
        return (
          <div
            key={i}
            style={{
              marginTop: p * 22 * s,
              transform: `translateX(${delay * (i % 2 ? 24 : -24) * s}px) rotate(${delay * (i % 2 ? 0.8 : -0.8)}deg)`,
              background: brand.colors.panel,
              border: `${2 * s}px solid ${p > 0.05 ? c : brand.colors.border}`,
              borderRadius: (4 + p * 14) * s,
              padding: `${12 * s}px ${20 * s}px`,
              boxShadow: p > 0.05 ? `0 0 ${20 * s * p}px ${c}55` : "none",
              position: "relative",
            }}
          >
            {p > 0.05 ? (
              <div
                style={{
                  position: "absolute",
                  top: -14 * s,
                  left: 16 * s,
                  fontFamily: brand.fonts.mono,
                  fontSize: 20 * s,
                  color: brand.colors.bg,
                  background: c,
                  borderRadius: 6 * s,
                  padding: `${1 * s}px ${10 * s}px`,
                  opacity: p,
                }}
              >
                片段 {i + 1}
              </div>
            ) : null}
            {lines.map((l, j) => (
              <div key={j} style={{ fontFamily: brand.fonts.sans, fontSize: 26 * s, lineHeight: 1.6, color: brand.colors.text }}>
                {l}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};
