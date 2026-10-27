import React from "react";
import { brand } from "../brand";

// 终端风格的 Logo：圆角方块里一个 >_
export const Logo: React.FC<{ size: number; cursorOn?: boolean }> = ({ size, cursorOn = true }) => {
  const { primary, accent, bg } = brand.colors;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        background: `linear-gradient(135deg, ${primary}, ${accent})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 0 ${size * 0.5}px ${primary}55`,
      }}
    >
      <span style={{ fontFamily: brand.fonts.mono, fontWeight: 800, fontSize: size * 0.42, color: bg }}>
        {">"}
        <span style={{ opacity: cursorOn ? 1 : 0 }}>_</span>
      </span>
    </div>
  );
};
