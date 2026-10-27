import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { useScale } from "./useScale";

// 相似度仪表盘：指针转到相似度，低于及格线亮红灯、高于亮绿灯
export const SimilarityGauge: React.FC<{
  value: number; // 0–1
  threshold?: number;
  at?: number;
  question?: string;
  passText?: string;
  failText?: string;
  size?: number;
}> = ({ value, threshold = 0.5, at = 0, question, passText = "相关，交给 AI 回答", failText = "不相关，直接拒答", size = 520 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = useScale();
  const p = spring({ frame: frame - at, fps, config: { damping: 20, mass: 1.4 } });
  const v = value * p;
  const settled = frame > at + 40;
  const pass = value >= threshold;
  const W = size * s;
  const R = W * 0.42;
  const cx = W / 2;
  const cy = W * 0.55;
  const ang = (x: number) => Math.PI * (1 - x); // 0 在左，1 在右
  const pt = (x: number, r: number) => [cx + Math.cos(ang(x)) * r, cy - Math.sin(ang(x)) * r];
  const arc = (a: number, b: number) => {
    const [x1, y1] = pt(a, R);
    const [x2, y2] = pt(b, R);
    return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`;
  };
  const [nx, ny] = pt(v, R * 0.9);
  const [tx1, ty1] = pt(threshold, R * 0.78);
  const [tx2, ty2] = pt(threshold, R * 1.14);
  const light = settled ? (pass ? brand.colors.success : brand.colors.danger) : brand.colors.border;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", fontFamily: brand.fonts.sans }}>
      {question ? <div style={{ fontSize: 30 * s, color: brand.colors.text, marginBottom: 10 * s }}>「{question}」</div> : null}
      <svg width={W} height={W * 0.66}>
        <path d={arc(0, threshold)} stroke={`${brand.colors.danger}88`} strokeWidth={26 * s} fill="none" strokeLinecap="round" />
        <path d={arc(threshold, 1)} stroke={`${brand.colors.success}88`} strokeWidth={26 * s} fill="none" strokeLinecap="round" />
        <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} stroke="#fff" strokeWidth={4 * s} strokeDasharray={`${6 * s} ${4 * s}`} />
        <text x={tx2} y={ty2 - 8 * s} fill="#fff" fontSize={22 * s} textAnchor="middle">
          及格线 {threshold}
        </text>
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#fff" strokeWidth={7 * s} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={14 * s} fill="#fff" />
        <text x={cx} y={cy + 56 * s} fill={brand.colors.text} fontSize={44 * s} fontWeight={800} textAnchor="middle" fontFamily={brand.fonts.mono}>
          {v.toFixed(2)}
        </text>
      </svg>
      <div style={{ display: "flex", alignItems: "center", gap: 16 * s, marginTop: 6 * s }}>
        <div
          style={{
            width: 34 * s,
            height: 34 * s,
            borderRadius: "50%",
            background: light,
            boxShadow: settled ? `0 0 ${30 * s}px ${light}` : "none",
          }}
        />
        <div
          style={{
            fontSize: 34 * s,
            fontWeight: 700,
            color: settled ? light : brand.colors.muted,
            opacity: interpolate(frame, [at + 40, at + 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          {pass ? passText : failText}
        </div>
      </div>
    </div>
  );
};
