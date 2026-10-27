import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { Background } from "./Background";
import { WindowFrame } from "./WindowFrame";
import { useScale } from "./useScale";

export type TermLine =
  | { type: "cmd"; text: string } // 逐字敲出
  | { type: "out"; text: string; color?: "success" | "warning" | "danger" | "muted" }; // 直接出现

export type TerminalProps = {
  lines: TermLine[];
  prompt?: string;
  title?: string;
  charsPerFrame?: number; // 打字速度，默认每帧 1 个字符
};

const START = 10;
const AFTER_CMD = 12; // 回车后等待
const AFTER_OUT = 4;
const HOLD = 45;

// 计算每一行开始和结束的帧
const timeline = (lines: TermLine[], cpf: number) => {
  let t = START;
  return lines.map((l) => {
    const start = t;
    const dur = l.type === "cmd" ? Math.ceil(l.text.length / cpf) : 0;
    t += dur + (l.type === "cmd" ? AFTER_CMD : AFTER_OUT);
    return { start, end: start + dur, next: t };
  });
};

export const getTerminalDuration = (p: TerminalProps) => {
  const tl = timeline(p.lines, p.charsPerFrame ?? 1);
  return (tl.length ? tl[tl.length - 1].next : START) + HOLD;
};

// 终端打字效果：命令逐字敲出，输出直接出现，光标闪烁
export const Terminal: React.FC<TerminalProps> = ({
  lines,
  prompt = "root@server:~$",
  title = "bash",
  charsPerFrame = 1,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const s = useScale();
  const portrait = height > width;
  const tl = timeline(lines, charsPerFrame);
  const cursorOn = Math.floor(frame / 15) % 2 === 0;
  const visible = lines.map((l, i) => ({ l, t: tl[i] })).filter(({ t }) => frame >= t.start);
  const last = visible[visible.length - 1];
  const typing = last && last.l.type === "cmd" && frame < last.t.next;
  // 输出还没结束时不显示新的提示符，避免闪烁
  const upcoming = lines[visible.length];
  const showPrompt = !typing && (!upcoming || upcoming.type === "cmd");
  const colorOf = (c?: string) =>
    c === "success" ? brand.colors.success : c === "warning" ? brand.colors.warning : c === "danger" ? brand.colors.danger : brand.colors.text;

  const cursor = (
    <span style={{ display: "inline-block", width: "0.6em", height: "1.1em", verticalAlign: "text-bottom", background: cursorOn ? brand.colors.text : "transparent" }} />
  );
  const promptEl = <span style={{ color: brand.colors.success }}>{prompt} </span>;

  return (
    <Background>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <WindowFrame title={title} width={portrait ? "92%" : "78%"}>
          <div
            style={{
              padding: `${28 * s}px ${32 * s}px`,
              minHeight: (portrait ? 900 : 560) * s,
              fontFamily: brand.fonts.mono,
              fontSize: (portrait ? 30 : 34) * s,
              lineHeight: 1.6,
              color: brand.colors.text,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {visible.map(({ l, t }, i) => {
              const isLast = i === visible.length - 1;
              if (l.type === "cmd") {
                const n = Math.min(l.text.length, Math.floor((frame - t.start) * charsPerFrame));
                return (
                  <div key={i}>
                    {promptEl}
                    {l.text.slice(0, n)}
                    {isLast && typing ? cursor : null}
                  </div>
                );
              }
              return (
                <div key={i} style={{ color: colorOf(l.color), opacity: l.color === "muted" ? 0.6 : 1 }}>
                  {l.text}
                </div>
              );
            })}
            {showPrompt ? (
              <div>
                {promptEl}
                {cursor}
              </div>
            ) : null}
          </div>
        </WindowFrame>
      </AbsoluteFill>
    </Background>
  );
};
