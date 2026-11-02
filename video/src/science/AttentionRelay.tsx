// 镜头：注意力飞线（对标 video-shotcraft 的 orb-flyline-relay，自己实现）——讲「注意力」
// 暗场里三团大光斑缓慢漂移，一句话的每个词是一张玻璃卡；「它」亮起后向其他词射出发光弧线：
// 线越粗越亮 = 注意力越大，弱的先快速射完，最强的两条压轴；光头领跑、身后彗尾渐隐，落点卡描边脉冲 + 冲击环，
// 落点那一帧附近的光斑同帧涨亮（氛围层和事件层共振）；最后弧线消散成细虚线，光斑缓动收敛到静止，停住让人读结论。
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, EASE, FONT, Rise, Stage, clamp01, mix, ramp, rgba } from "./kit";

export const ATTENTION_RELAY_DURATION = 200;

export type AttentionRelayProps = {
  tokens: string[];
  source: number; // 发出注意力的词
  weights: number[]; // 它对每个词的注意力（0~1）
  question: string;
  answer: string;
  answerSub: string;
};
const DEFAULTS: AttentionRelayProps = {
  tokens: ["小猫", "没有", "跳上", "桌子", "因为", "它", "太累了"],
  source: 5,
  weights: [0.87, 0.05, 0.12, 0.18, 0.06, 0, 0.45],
  question: "「它」指的是谁？",
  answer: "每个词，都去看一遍所有的词",
  answerSub: "这就是「注意力机制」",
};

const ROW_Y = 720, CH = 124, FS = 60;
const T_CHIPS = 6, T_Q = 20, T_SRC = 34, T_LINES = 46, T_ANSWER = 140;
const GROW = 22; // 每条线生长帧数

// 每条线的发射时刻：弱的先快速连发，最强的两条压轴
const schedule = (weights: number[], source: number) => {
  const order = weights.map((w, i) => ({ w, i })).filter((x) => x.i !== source).sort((a, b) => a.w - b.w);
  let t = T_LINES;
  return order.map(({ w, i }, k) => {
    const strong = w > 0.3;
    const start = t;
    t += strong ? 28 : 5;
    return { i, w, start: start + (strong && k === order.length - 1 ? 6 : 0), grow: strong ? GROW + 4 : GROW - 6 };
  });
};

const bezierPts = (a: [number, number], b: [number, number], lift: number, n = 90) => {
  const cx = (a[0] + b[0]) / 2, cy = Math.min(a[1], b[1]) - lift;
  return Array.from({ length: n + 1 }, (_, k) => {
    const t = k / n;
    return [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * cx + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * cy + t * t * b[1]] as [number, number];
  });
};
const poly = (pts: [number, number][]) => pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

export const AttentionRelay: React.FC<Partial<AttentionRelayProps>> = (props) => {
  const p = { ...DEFAULTS, ...props };
  const frame = useCurrentFrame();

  // 词卡布局：按字数定宽，整行居中
  const widths = p.tokens.map((t) => t.length * FS + 92);
  const gap = 30;
  const total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
  let x = (1920 - total) / 2;
  const chips = widths.map((w) => {
    const r = { x, w, cx: x + w / 2 };
    x += w + gap;
    return r;
  });
  const top = (i: number): [number, number] => [chips[i].cx, ROW_Y - CH / 2 - 6];

  const lines = schedule(p.weights, p.source).map((l) => ({ ...l, land: l.start + l.grow }));
  const strong = lines.filter((l) => l.w > 0.3);

  // 光斑：三团，双正弦不等周期漂移；最后 40 帧缓动收敛到静止；强线落点同帧涨亮
  const settle = EASE.soft(clamp01((frame - 150) / 40));
  const drift = (f: number, ax: number, ay: number, px: number, py: number) => [Math.sin(f / px) * ax * (1 - settle), Math.cos(f / py) * ay * (1 - settle)];
  const surge = (l: { land: number } | undefined) => (l && frame >= l.land ? Math.exp(-(frame - l.land) / 9) * clamp01((frame - l.land + 1) / 3) : 0);
  const orbs = [
    { at: [chips[0].cx, 520], color: C.gold, size: 900, peak: 0.42, d: drift(frame, 120, 70, 31, 47), s: surge(strong.find((l) => l.i === 0)) },
    { at: [chips[p.tokens.length - 1].cx, 560], color: "#ff7a59", size: 800, peak: 0.3, d: drift(frame, 100, 80, 43, 29), s: surge(strong.find((l) => l.i === p.tokens.length - 1)) },
    { at: [960, 260], color: "#3b6dff", size: 1200, peak: 0.45, d: drift(frame, 160, 60, 53, 37), s: 0 },
  ];
  const orbIn = ramp(frame, 0, 30, EASE.soft);

  const lastStrong = strong[strong.length - 1];
  const dimOthers = lastStrong ? ramp(frame, lastStrong.land, 12) : 0;

  return (
    <Stage keyLight={[0.5, 0.05]} fill={null} intensity={0.5}>
      {orbs.map((o, k) => (
        <div key={k} style={{ position: "absolute", left: o.at[0] + o.d[0] - o.size / 2, top: o.at[1] + o.d[1] - o.size / 2, width: o.size, height: o.size, borderRadius: "50%",
          background: `radial-gradient(circle, ${rgba(o.color, o.peak * orbIn * (1 + 1.6 * o.s))} 0%, ${rgba(o.color, 0.12 * orbIn)} 38%, ${rgba(o.color, 0)} 68%)`,
          transform: `scale(${1 + 0.12 * o.s})`, mixBlendMode: "screen" }} />
      ))}

      {/* 飞线 */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {lines.map((l) => {
          const pts = bezierPts(top(p.source), top(l.i), 160 + Math.abs(chips[l.i].cx - chips[p.source].cx) * 0.42);
          const g = EASE.in(clamp01((frame - l.start) / l.grow));
          if (g <= 0) return null;
          const head = Math.max(1, Math.round(g * (pts.length - 1)));
          const body = pts.slice(0, head + 1);
          const col = l.w > 0.3 ? C.gold : C.cyan;
          const width = 2 + l.w * 9;
          const landed = frame >= l.land;
          const fadeToDots = ramp(frame, l.land + 8, 14, EASE.soft); // 到站后消散成细虚线
          const tail = body.slice(Math.max(0, body.length - 18));
          return (
            <g key={l.i} opacity={mix(1, 0.55, dimOthers * (l === lastStrong ? 0 : 1))}>
              <polyline points={poly(body)} fill="none" stroke={rgba(col, 0.18 * (1 - fadeToDots))} strokeWidth={width * 3.2} strokeLinecap="butt" />
              <polyline points={poly(body)} fill="none" stroke={rgba(col, (0.35 + l.w * 0.5) * (1 - fadeToDots * 0.6))} strokeWidth={width} strokeLinecap="butt" strokeDasharray={fadeToDots > 0 ? `${mix(400, 3, fadeToDots)} ${mix(0, 9, fadeToDots)}` : undefined} />
              {!landed && (
                <>
                  <polyline points={poly(tail)} fill="none" stroke={rgba("#ffffff", 0.9)} strokeWidth={width * 0.6} />
                  <circle cx={body[body.length - 1][0]} cy={body[body.length - 1][1]} r={6 + l.w * 6} fill="#fff" />
                  <circle cx={body[body.length - 1][0]} cy={body[body.length - 1][1]} r={26 + l.w * 30} fill={rgba(col, 0.35)} />
                </>
              )}
              {/* 落点冲击环 */}
              {landed && frame < l.land + 18 && (
                <circle cx={top(l.i)[0]} cy={top(l.i)[1]} r={mix(10, 70 + l.w * 90, EASE.in(clamp01((frame - l.land) / 18)))} fill="none" stroke={rgba(col, 1 - (frame - l.land) / 18)} strokeWidth={3} />
              )}
            </g>
          );
        })}
      </svg>

      {/* 词卡 */}
      {p.tokens.map((t, i) => {
        const inP = ramp(frame, T_CHIPS + i * 2, 18, EASE.in);
        const isSrc = i === p.source;
        const srcLit = isSrc ? ramp(frame, T_SRC, 10, EASE.in) : 0;
        const l = lines.find((q) => q.i === i);
        const pulse = l && frame >= l.land ? Math.exp(-(frame - l.land) / 10) : 0;
        const won = l && l === lastStrong ? ramp(frame, l.land, 8, EASE.in) : 0;
        const lit = Math.max(srcLit, won, (l && frame >= l.land ? l.w : 0) * 0.8);
        const pop = isSrc ? 1 + 0.08 * Math.sin(clamp01((frame - T_SRC) / 12) * Math.PI) : 1 + 0.07 * pulse;
        const dim = !isSrc && !won ? dimOthers * (1 - (l?.w ?? 0)) * 0.5 : 0;
        return (
          <div key={i} style={{ position: "absolute", left: chips[i].x, top: ROW_Y - CH / 2, width: chips[i].w, height: CH, borderRadius: 28,
            display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontSize: FS, fontWeight: 900,
            color: lit > 0.5 ? (isSrc || won ? "#1a1204" : C.ink) : C.ink,
            background: isSrc || won ? `linear-gradient(160deg, ${rgba(C.goldHi, lit)}, ${rgba(C.gold, lit)})` : `linear-gradient(160deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))`,
            border: `2px solid ${rgba(isSrc || won ? C.gold : "#ffffff", 0.25 + lit * 0.6 + pulse * 0.4)}`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), 0 20px 60px rgba(0,0,0,0.45), 0 0 ${30 + 60 * lit}px ${rgba(C.gold, 0.5 * lit)}`,
            backdropFilter: "blur(18px) saturate(1.4)",
            opacity: inP * (1 - dim), transform: `translateY(${(1 - inP) * 60}px) scale(${pop})` }}>
            {t}
          </div>
        );
      })}

      {/* 权重读数：钉在压轴那张卡正上方 */}
      {lastStrong && frame >= lastStrong.land && (
        <div style={{ position: "absolute", left: chips[lastStrong.i].cx - 200, width: 400, top: ROW_Y - CH / 2 - 190, textAlign: "center", fontFamily: FONT,
          opacity: ramp(frame, lastStrong.land + 2, 8), transform: `translateY(${(1 - ramp(frame, lastStrong.land + 2, 14, EASE.settle)) * 30}px)` }}>
          <div style={{ fontSize: 96, fontWeight: 900, color: C.goldHi, textShadow: `0 0 40px ${rgba(C.gold, 0.8)}` }}>{Math.round(lastStrong.w * 100 * ramp(frame, lastStrong.land + 2, 20, EASE.in))}%</div>
          <div style={{ fontSize: 32, color: C.ink, letterSpacing: 4, marginTop: -6 }}>注意力权重</div>
        </div>
      )}

      {/* 字幕：先问，答案出来后换成结论 */}
      <AbsoluteFill style={{ alignItems: "center", fontFamily: FONT, color: C.ink }}>
        {frame < T_ANSWER && (
          <div style={{ marginTop: 170, fontSize: 76, fontWeight: 900, opacity: 1 - ramp(frame, T_ANSWER - 8, 8, EASE.out), textShadow: "0 6px 30px rgba(0,0,0,0.8)" }}>
            <Rise text={p.question} at={T_Q} gap={2} />
          </div>
        )}
        {frame >= T_ANSWER && (
          <div style={{ marginTop: 150, textAlign: "center", textShadow: "0 6px 30px rgba(0,0,0,0.8)" }}>
            <div style={{ fontSize: 72, fontWeight: 900 }}><Rise text={p.answer} at={T_ANSWER} gap={2} /></div>
            <div style={{ marginTop: 18, fontSize: 48, fontWeight: 700, color: C.gold }}><Rise text={p.answerSub} at={T_ANSWER + 16} gap={2} /></div>
          </div>
        )}
      </AbsoluteFill>
    </Stage>
  );
};
