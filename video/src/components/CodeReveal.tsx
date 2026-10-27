import React from "react";
import { Highlight, themes } from "prism-react-renderer";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { Background } from "./Background";
import { WindowFrame } from "./WindowFrame";
import { useScale } from "./useScale";

export type CodeRevealProps = {
  code: string;
  language?: string; // python / typescript / yaml / json / sql / go ...
  filename?: string;
  framesPerLine?: number; // 每行出现间隔，默认 6 帧
  highlightLines?: number[]; // 全部出现后高亮的行（从 1 开始）
};

const START = 10;
const HOLD = 60;

// 按行数和最长行自动缩小字号，保证代码完整放进画面
const LINE_HEIGHT = 1.55;
const fitFontSize = (lines: string[], width: number, height: number, portrait: boolean, s: number) => {
  const base = (portrait ? 30 : 34) * s;
  const boxW = width * (portrait ? 0.92 : 0.8) - 64 * s;
  const boxH = height * (portrait ? 0.7 : 0.82) - 120 * s;
  // 中文等宽字符约占 2 个英文字符宽
  const maxCols = Math.max(...lines.map((l) => [...l].reduce((n, c) => n + (c.charCodeAt(0) > 0x2e80 ? 2 : 1), 0)));
  const byWidth = boxW / ((maxCols + 4) * 0.6); // +4 是行号宽度
  const byHeight = boxH / (lines.length * LINE_HEIGHT);
  // 竖屏画面窄，宁可长行换行也要保证字看得清
  if (portrait) return Math.max(24 * s, Math.min(base, byHeight));
  return Math.max(16 * s, Math.min(base, byWidth, byHeight));
};

export const getCodeRevealDuration = (p: CodeRevealProps) =>
  START + p.code.trim().split("\n").length * (p.framesPerLine ?? 6) + HOLD + (p.highlightLines?.length ? 45 : 0);

// 代码逐行出现，最后可以高亮重点行
export const CodeReveal: React.FC<CodeRevealProps> = ({
  code,
  language = "python",
  filename,
  framesPerLine = 6,
  highlightLines = [],
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const s = useScale();
  const portrait = height > width;
  const lines = code.trim().split("\n");
  const allShown = START + lines.length * framesPerLine;
  const hl = interpolate(frame, [allShown + 10, allShown + 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fontSize = fitFontSize(lines, width, height, portrait, s);

  return (
    <Background>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <WindowFrame title={filename} width={portrait ? "92%" : "80%"}>
          <Highlight code={code.trim()} language={language} theme={themes.nightOwl}>
            {({ tokens, getLineProps, getTokenProps }) => (
              <pre
                style={{
                  margin: 0,
                  padding: `${28 * s}px ${32 * s}px`,
                  fontFamily: brand.fonts.mono,
                  fontSize,
                  lineHeight: LINE_HEIGHT,
                  background: "transparent",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {tokens.map((line, i) => {
                  const appear = START + i * framesPerLine;
                  const p = interpolate(frame, [appear, appear + 8], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  });
                  const isHl = highlightLines.includes(i + 1);
                  const dim = highlightLines.length && !isHl ? 1 - hl * 0.6 : 1;
                  const { key: _k, ...lineProps } = getLineProps({ line });
                  return (
                    <div
                      key={i}
                      {...lineProps}
                      style={{
                        ...lineProps.style,
                        display: "flex",
                        opacity: p * dim,
                        transform: `translateX(${(1 - p) * 30 * s}px)`,
                        background: isHl ? `rgba(34,211,238,${0.14 * hl})` : undefined,
                        borderLeft: `${4 * s}px solid ${isHl && hl > 0 ? brand.colors.primary : "transparent"}`,
                        paddingLeft: 12 * s,
                      }}
                    >
                      <span style={{ width: 2.4 * fontSize, flexShrink: 0, color: brand.colors.muted, opacity: 0.5, userSelect: "none" }}>
                        {i + 1}
                      </span>
                      <span>
                        {line.map((token, j) => {
                          const { key: _tk, ...tokenProps } = getTokenProps({ token });
                          return <span key={j} {...tokenProps} />;
                        })}
                      </span>
                    </div>
                  );
                })}
              </pre>
            )}
          </Highlight>
        </WindowFrame>
      </AbsoluteFill>
    </Background>
  );
};
