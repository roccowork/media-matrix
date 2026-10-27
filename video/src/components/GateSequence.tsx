import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { useScale } from "./useScale";

export type Gate = { title: string; desc: string };

// 三道关：关卡依次亮起，当前关卡高亮
export const GateSequence: React.FC<{ gates: Gate[]; interval?: number; startAt?: number }> = ({ gates, interval = 45, startAt = 10 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = useScale();
  const portrait = height > width;
  const active = Math.min(gates.length - 1, Math.max(-1, Math.floor((frame - startAt) / interval)));

  return (
    <div style={{ display: "flex", flexDirection: portrait ? "column" : "row", gap: 30 * s, alignItems: "stretch", justifyContent: "center", width: "90%" }}>
      {gates.map((g, i) => {
        const p = spring({ frame: frame - startAt - i * interval, fps, config: { damping: 14 } });
        const on = i <= active;
        const cur = i === active;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              opacity: 0.25 + p * 0.75,
              transform: `translateY(${(1 - p) * 40 * s}px) scale(${cur ? 1.04 : 1})`,
              background: brand.colors.panel,
              border: `${3 * s}px solid ${on ? brand.colors.primary : brand.colors.border}`,
              borderRadius: 24 * s,
              padding: `${30 * s}px ${28 * s}px`,
              boxShadow: cur ? `0 0 ${40 * s}px ${brand.colors.primary}66` : "none",
              fontFamily: brand.fonts.sans,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 * s, marginBottom: 14 * s }}>
              <div
                style={{
                  width: 56 * s,
                  height: 56 * s,
                  borderRadius: 14 * s,
                  background: on ? brand.colors.primary : brand.colors.border,
                  color: brand.colors.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  fontSize: 32 * s,
                }}
              >
                {i + 1}
              </div>
              <div style={{ fontSize: 36 * s, fontWeight: 800, color: brand.colors.text }}>{g.title}</div>
            </div>
            <div style={{ fontSize: 28 * s, lineHeight: 1.6, color: brand.colors.muted }}>{g.desc}</div>
          </div>
        );
      })}
    </div>
  );
};
