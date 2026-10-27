import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { brand } from "../brand";
import { useScale } from "./useScale";

// 引用出处：上面是 AI 的回答，下面是原文，依据所在的行被高亮
export const CitationHighlight: React.FC<{
  answer: string;
  docTitle: string;
  lines: string[];
  highlight: number[]; // 高亮的行（从 0 开始）
  at?: number;
  width?: number | string;
}> = ({ answer, docTitle, lines, highlight, at = 20, width = "75%" }) => {
  const frame = useCurrentFrame();
  const s = useScale();
  const sweep = interpolate(frame, [at, at + 20], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const arrow = interpolate(frame, [at - 10, at], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ width, fontFamily: brand.fonts.sans }}>
      <div
        style={{
          background: "#12301f",
          border: `${2 * s}px solid ${brand.colors.success}88`,
          borderRadius: 18 * s,
          padding: `${18 * s}px ${26 * s}px`,
          fontSize: 32 * s,
          color: brand.colors.text,
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontSize: 22 * s, color: brand.colors.success, marginBottom: 6 * s, fontWeight: 700 }}>知识库助手</div>
        {answer}
      </div>
      <div style={{ textAlign: "center", fontSize: 44 * s, color: brand.colors.warning, opacity: arrow, lineHeight: 1.2 }}>
        ↓ 依据
      </div>
      <div
        style={{
          background: brand.colors.panel,
          border: `${2 * s}px solid ${brand.colors.border}`,
          borderRadius: 18 * s,
          padding: `${18 * s}px ${26 * s}px`,
        }}
      >
        <div style={{ fontSize: 26 * s, fontWeight: 800, color: brand.colors.muted, marginBottom: 10 * s }}>《{docTitle}》</div>
        {lines.map((l, i) => {
          const hl = highlight.includes(i);
          return (
            <div
              key={i}
              style={{
                fontSize: 28 * s,
                lineHeight: 1.7,
                color: hl ? "#fff" : brand.colors.muted,
                padding: `0 ${8 * s}px`,
                borderRadius: 6 * s,
                background: hl ? `linear-gradient(90deg, ${brand.colors.warning}55 ${sweep}%, transparent ${sweep}%)` : "transparent",
              }}
            >
              {l}
            </div>
          );
        })}
      </div>
    </div>
  );
};
