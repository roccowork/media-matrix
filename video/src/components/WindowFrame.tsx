import React from "react";
import { brand } from "../brand";
import { useScale } from "./useScale";

// 带红黄绿按钮的窗口外框，代码和终端共用
export const WindowFrame: React.FC<{ title?: string; width: string | number; children: React.ReactNode }> = ({
  title,
  width,
  children,
}) => {
  const s = useScale();
  const dot = (c: string) => (
    <div style={{ width: 22 * s, height: 22 * s, borderRadius: "50%", background: c }} />
  );
  return (
    <div
      style={{
        width,
        background: brand.colors.panel,
        border: `${2 * s}px solid ${brand.colors.border}`,
        borderRadius: 24 * s,
        overflow: "hidden",
        boxShadow: `0 ${30 * s}px ${80 * s}px rgba(0,0,0,0.55)`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14 * s,
          padding: `${18 * s}px ${24 * s}px`,
          background: brand.colors.bgLight,
          borderBottom: `${2 * s}px solid ${brand.colors.border}`,
        }}
      >
        {dot("#FF5F57")}
        {dot("#FEBC2E")}
        {dot("#28C840")}
        {title ? (
          <div style={{ marginLeft: 16 * s, fontFamily: brand.fonts.mono, fontSize: 26 * s, color: brand.colors.muted }}>
            {title}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
};
