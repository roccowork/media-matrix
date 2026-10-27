import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { brand } from "../brand";
import { Stamp } from "./Stamp";
import { useScale } from "./useScale";

export type ChatMsg = {
  from: "user" | "ai" | "kb"; // 员工 / 通用 AI / 知识库助手
  text: string;
  start: number; // 第几帧出现
  cps?: number; // 每帧打出几个字，默认 0.8（只对 AI 生效）
  citation?: string; // 出处，打字完成后出现
  stamp?: { text: string; at: number; color?: string };
};

const NAMES = { user: "员工", ai: "通用 AI", kb: "知识库助手" } as const;

// 聊天对话：员工提问，AI 逐字回答，可以带出处和印章
export const ChatThread: React.FC<{ messages: ChatMsg[]; title?: string; width?: number | string; fontSize?: number }> = ({
  messages,
  title,
  width = "100%",
  fontSize = 34,
}) => {
  const frame = useCurrentFrame();
  const s = useScale();
  const fs = fontSize * s;
  const hasStamp = messages.some((m) => m.stamp);
  const color = { user: brand.colors.primary, ai: brand.colors.muted, kb: brand.colors.success };

  return (
    <div
      style={{
        width,
        background: brand.colors.panel,
        border: `${2 * s}px solid ${brand.colors.border}`,
        borderRadius: 24 * s,
        boxShadow: `0 ${24 * s}px ${60 * s}px rgba(0,0,0,0.5)`,
      }}
    >
      {title ? (
        <div
          style={{
            padding: `${16 * s}px ${28 * s}px`,
            background: brand.colors.bgLight,
            borderBottom: `${2 * s}px solid ${brand.colors.border}`,
            borderRadius: `${22 * s}px ${22 * s}px 0 0`,
            fontFamily: brand.fonts.sans,
            fontSize: fs * 0.8,
            fontWeight: 700,
            color: brand.colors.text,
          }}
        >
          {title}
        </div>
      ) : null}
      <div style={{ padding: `${24 * s}px ${28 * s}px ${hasStamp ? 56 * s : 24 * s}px`, display: "flex", flexDirection: "column", gap: hasStamp ? 40 * s : 22 * s }}>
        {messages
          .filter((m) => frame >= m.start)
          .map((m, i) => {
            const local = frame - m.start;
            const isUser = m.from === "user";
            const n = isUser ? m.text.length : Math.min(m.text.length, Math.floor(local * (m.cps ?? 0.8)));
            const done = n >= m.text.length;
            const appear = interpolate(local, [0, 8], [0, 1], { extrapolateRight: "clamp" });
            const citeIn = done ? interpolate(local - m.text.length / (m.cps ?? 0.8), [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isUser ? "flex-end" : "flex-start",
                  opacity: appear,
                  transform: `translateY(${(1 - appear) * 20 * s}px)`,
                }}
              >
                <div style={{ fontFamily: brand.fonts.sans, fontSize: fs * 0.62, color: color[m.from], marginBottom: 6 * s, fontWeight: 700 }}>
                  {NAMES[m.from]}
                </div>
                <div style={{ position: "relative", maxWidth: "85%" }}>
                  <div
                    style={{
                      fontFamily: brand.fonts.sans,
                      fontSize: fs,
                      lineHeight: 1.5,
                      color: isUser ? brand.colors.bg : brand.colors.text,
                      background: isUser ? brand.colors.primary : m.from === "kb" ? "#12301f" : brand.colors.bgLight,
                      border: m.from === "kb" ? `${2 * s}px solid ${brand.colors.success}66` : "none",
                      padding: `${14 * s}px ${22 * s}px`,
                      borderRadius: 18 * s,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {m.text.slice(0, n)}
                    {!done ? <span style={{ opacity: Math.floor(frame / 8) % 2 ? 0 : 1 }}>▍</span> : null}
                    {m.citation && citeIn > 0 ? (
                      <div
                        style={{
                          marginTop: 10 * s,
                          paddingTop: 10 * s,
                          borderTop: `${1.5 * s}px dashed ${brand.colors.success}66`,
                          fontSize: fs * 0.7,
                          color: brand.colors.success,
                          opacity: citeIn,
                        }}
                      >
                        出处：{m.citation}
                      </div>
                    ) : null}
                  </div>
                  {m.stamp ? (
                    <div style={{ position: "absolute", right: -20 * s, bottom: -44 * s }}>
                      <Stamp text={m.stamp.text} at={m.start + m.stamp.at} color={m.stamp.color} size={34} />
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};
