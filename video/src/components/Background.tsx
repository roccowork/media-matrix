import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { brand } from "../brand";
import { useScale } from "./useScale";

// 深色渐变 + 缓慢移动的网格，作为所有画面的统一底色
export const Background: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const s = useScale();
  const grid = 60 * s;
  const offset = (frame * 0.5 * s) % grid;
  const { bg, bgLight, border } = brand.colors;

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 30% 20%, ${bgLight} 0%, ${bg} 70%)` }}>
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${border} 1px, transparent 1px), linear-gradient(90deg, ${border} 1px, transparent 1px)`,
          backgroundSize: `${grid}px ${grid}px`,
          backgroundPosition: `${offset}px ${offset}px`,
          opacity: 0.35,
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
        }}
      />
      {children}
    </AbsoluteFill>
  );
};
