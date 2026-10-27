import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { Background } from "./Background";
import { Logo } from "./Logo";
import { useScale } from "./useScale";

export type BrandOutroProps = {
  nextTitle?: string; // 下期预告
  repo?: string; // 本期代码地址
};

// 品牌片尾（约 5 秒）：关注引导 + 代码地址 + 下期预告
export const BrandOutro: React.FC<BrandOutroProps> = ({ nextTitle, repo }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = useScale();
  type Item = { label: string; value: string; color: string };
  const items: Item[] = [];
  if (repo) items.push({ label: "完整资料", value: repo, color: brand.colors.success });
  if (nextTitle) items.push({ label: "下期预告", value: nextTitle, color: brand.colors.accent });

  const head = spring({ frame, fps, config: { damping: 200 } });

  return (
    <Background>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 48 * s }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 * s, opacity: head, transform: `scale(${0.8 + head * 0.2})` }}>
          <Logo size={110 * s} cursorOn={Math.floor(frame / 8) % 2 === 0} />
          <div style={{ fontFamily: brand.fonts.sans, color: brand.colors.text }}>
            <div style={{ fontSize: 64 * s, fontWeight: 800 }}>{brand.name}</div>
            <div style={{ fontSize: 32 * s, color: brand.colors.muted }}>{brand.slogan}</div>
          </div>
        </div>
        {items.map((it, i) => {
          const p = spring({ frame: frame - 15 - i * 10, fps, config: { damping: 200 } });
          return (
            <div
              key={it.label}
              style={{
                display: "flex",
                gap: 20 * s,
                alignItems: "center",
                fontFamily: brand.fonts.sans,
                fontSize: 36 * s,
                opacity: p,
                transform: `translateX(${(1 - p) * -60 * s}px)`,
                maxWidth: "85%",
              }}
            >
              <span style={{ color: it.color, fontWeight: 700, flexShrink: 0 }}>{it.label}</span>
              <span style={{ color: brand.colors.text }}>{it.value}</span>
            </div>
          );
        })}
        <div
          style={{
            marginTop: 20 * s,
            fontFamily: brand.fonts.sans,
            fontSize: 40 * s,
            fontWeight: 700,
            color: brand.colors.bg,
            background: brand.colors.primary,
            padding: `${16 * s}px ${48 * s}px`,
            borderRadius: 999,
            opacity: interpolate(frame, [35, 45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            transform: `scale(${1 + Math.sin(frame / 6) * 0.03})`,
          }}
        >
          关注我，让 AI 替你上班
        </div>
      </AbsoluteFill>
    </Background>
  );
};
