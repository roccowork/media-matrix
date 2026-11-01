import React from "react";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SNAPPY } from "./springs";

// 改动（向晓 AI）：去掉 zod 校验，字体改成参数；Line 导出，方便按配音时间单独使用。中文词之间用空格分开传进来
const INTER = '"Inter Display", "Inter", "Noto Sans SC", sans-serif';

type KineticLine = { text: string; emphasis?: boolean };
export type KineticTextProps = { lines: KineticLine[]; backgroundColor: string; textColor: string; emphasisColor: string };

export const kineticTextDefaultProps: KineticTextProps = {
  lines: [
    { text: "You don't need" },
    { text: "an editor." },
    { text: "You need", },
    { text: "code.", emphasis: true },
  ],
  backgroundColor: "#09090B",
  textColor: "#FAFAFA",
  emphasisColor: "#60A5FA",
};

// --- Timeline math -----------------------------------------------------------
// A single function computes where every line sits on the timeline. Both
// `calculateMetadata` (to set duration before render) and the component (to
// place Sequences) call it, so they can never drift out of sync — the classic
// mistake is computing duration one way and rendering another.

const STAGGER = 4; // frames between consecutive words entering
const SETTLE = 16; // extra frames for the last word to settle
const HOLD = 42; // frames the finished line stays on screen
const EXIT = 14; // fade-out frames

type Segment = { start: number; duration: number; wordCount: number };

const lineDuration = (wordCount: number): number =>
  wordCount * STAGGER + SETTLE + HOLD + EXIT;

export const layoutKinetic = (
  lines: KineticTextProps["lines"],
): { segments: Segment[]; totalDuration: number } => {
  let cursor = 0;
  const segments: Segment[] = lines.map((line) => {
    const wordCount = line.text.trim().split(/\s+/).filter(Boolean).length || 1;
    const duration = lineDuration(wordCount);
    const seg: Segment = { start: cursor, duration, wordCount };
    cursor += duration;
    return seg;
  });
  return { segments, totalDuration: Math.max(1, cursor) };
};

export const kineticTextCalculateMetadata: CalculateMetadataFunction<
  KineticTextProps
> = ({ props }) => {
  const { totalDuration } = layoutKinetic(props.lines);
  return { durationInFrames: totalDuration };
};

// --- Rendering ---------------------------------------------------------------

export const Line: React.FC<{
  fontFamily?: string;
  sizes?: [number, number];
  text: string;
  emphasis: boolean;
  duration: number;
  textColor: string;
  emphasisColor: string;
}> = ({ text, emphasis, duration, textColor, emphasisColor, fontFamily = INTER, sizes = [104, 150] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.trim().split(/\s+/).filter(Boolean);

  const exitStart = duration - EXIT;
  const lineOpacity = interpolate(frame, [exitStart, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: lineOpacity,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: emphasis ? 24 : 20,
          maxWidth: "82%",
        }}
      >
        {words.map((word, i) => {
          // Per-word stagger: each word's spring is delayed by its index.
          const enter = spring({
            frame,
            fps,
            config: SNAPPY,
            delay: i * STAGGER,
          });
          const y = interpolate(enter, [0, 1], [46, 0]);
          const scale = emphasis
            ? interpolate(enter, [0, 1], [0.7, 1])
            : interpolate(enter, [0, 1], [0.9, 1]);

          return (
            <span
              key={i}
              style={{
                fontFamily,
                fontWeight: emphasis ? 800 : 700,
                fontSize: emphasis ? sizes[1] : sizes[0],
                lineHeight: 1,
                color: emphasis ? emphasisColor : textColor,
                opacity: enter,
                transform: `translateY(${y}px) scale(${scale})`,
                display: "inline-block",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const KineticText: React.FC<KineticTextProps> = ({
  lines,
  backgroundColor,
  textColor,
  emphasisColor,
}) => {
  const { segments } = layoutKinetic(lines);

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {lines.map((line, i) => {
        const seg = segments[i];
        return (
          <Sequence
            key={i}
            from={seg.start}
            durationInFrames={seg.duration}
            name={`Line ${i + 1}`}
          >
            <Line
              text={line.text}
              emphasis={Boolean(line.emphasis)}
              duration={seg.duration}
              textColor={textColor}
              emphasisColor={emphasisColor}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
