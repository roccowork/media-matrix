// 镜头：时间轴穿行（原理：timeline-travel 加速掠过 + 弹立短停 + 末刻度急停推近）——讲历史、演进
// 一条很长的发光时间轴横贯画面，镜头沿轴向右移动：每到一个节点停一小拍，节点卡片从轴上弹簧弹立（带过冲）；
// 段间移动先慢后快（越往后越急），最后一个节点急停（指数减速）、镜头推近，节点变金色发光；末段留足静止让人读。
import React from "react";
import { spring, useVideoConfig } from "remotion";
import { C, EASE, Rise, SpeedBlur, Stage, clamp01, mix, ramp, rgba, useShotFrame, type ShotMeta } from "./kit";

export const TIMELINE_TRAVEL_DURATION = 190;
export const TIMELINE_TRAVEL_META: ShotMeta = { duration: TIMELINE_TRAVEL_DURATION, holdAt: 150, holdEnd: 189, sfx: [{ at: 20, kind: "pop", vol: 0.35 }, { at: 60, kind: "pop", vol: 0.35 }, { at: 92, kind: "pop", vol: 0.35 }, { at: 120, kind: "whip", vol: 0.45 }, { at: 136, kind: "impact", vol: 0.45 }] };

export type TimelineTravelProps = { items: { when: string; label: string }[]; title?: string };
const DEFAULTS: TimelineTravelProps = {
  title: "从翻译到对话",
  items: [
    { when: "2014", label: "循环神经网络做翻译" },
    { when: "2017", label: "Transformer 诞生" },
    { when: "2018", label: "BERT、GPT 出现" },
    { when: "2020", label: "GPT-3：1750 亿参数" },
    { when: "2022", label: "ChatGPT 上线" },
  ],
};

const GAP = 640; // 节点间距（世界坐标）
const AXIS_Y = 640;

export const TimelineTravel: React.FC<Partial<TimelineTravelProps>> = (props) => {
  const p = { ...DEFAULTS, ...props } as TimelineTravelProps;
  const items = p.items.slice(0, 6);
  const n = items.length;
  const frame = useShotFrame();
  const { fps } = useVideoConfig();

  // 每个节点的到达帧：段时长越来越短（加速），最后一段急停
  const arrive: number[] = [];
  let t = 24;
  for (let i = 0; i < n; i++) {
    arrive.push(t);
    t += Math.max(14, 30 - i * 5) + 10; // 移动 + 停留 10 帧
  }
  const lastArrive = arrive[n - 1];
  // 相机 x：在两个到达帧之间用 in-out 移动；最后一段用强 ease-out（急停）
  const camAt = (f: number) => {
    if (f <= arrive[0]) return mix(-260, 0, EASE.in(clamp01(f / arrive[0])));
    for (let i = 1; i < n; i++) {
      const start = arrive[i - 1] + 10;
      if (f < arrive[i]) {
        const ease = i === n - 1 ? EASE.in : EASE.move;
        return (i - 1 + ease(clamp01((f - start) / (arrive[i] - start)))) * GAP;
      }
    }
    return (n - 1) * GAP;
  };
  const cam = camAt(frame);
  const v = camAt(frame) - camAt(frame - 1);
  const push = mix(1, 1.08, ramp(frame, lastArrive, 30, EASE.soft));
  const worldX = 960 - cam;

  return (
    <Stage keyLight={[0.5, 0.08]} horizon={0.6} intensity={0.8}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${push})`, transformOrigin: `960px ${AXIS_Y}px` }}>
        <SpeedBlur id="tl" vx={v} k={0.25} max={14} style={{ position: "absolute", inset: 0 }}>
          {/* 轴：已走过的部分是金色 */}
          <div style={{ position: "absolute", left: worldX - 900, top: AXIS_Y - 2, width: (n - 1) * GAP + 1800, height: 4, background: C.line }} />
          <div style={{ position: "absolute", left: worldX - 900, top: AXIS_Y - 3, width: 900 + cam, height: 6, background: `linear-gradient(90deg, transparent, ${C.gold})`, boxShadow: `0 0 18px ${rgba(C.gold, 0.7)}` }} />
          {/* 刻度 */}
          {Array.from({ length: (n + 2) * 8 }, (_, k) => (
            <div key={k} style={{ position: "absolute", left: worldX - 640 + k * (GAP / 8), top: AXIS_Y + 10, width: 2, height: k % 8 === 0 ? 22 : 10, background: C.line }} />
          ))}
          {items.map((it, i) => {
            const pop = spring({ frame: frame - (arrive[i] - 4), fps, config: { damping: 12, stiffness: 160 } });
            const last = i === n - 1;
            const glow = last ? ramp(frame, lastArrive, 12) : 0;
            const x = worldX + i * GAP;
            return (
              <div key={i} style={{ position: "absolute", left: x, top: AXIS_Y }}>
                <div style={{ position: "absolute", left: -14, top: -14, width: 28, height: 28, borderRadius: 14, background: frame >= arrive[i] - 4 ? C.gold : C.bg1, border: `3px solid ${C.gold}`, boxShadow: `0 0 ${20 + glow * 30}px ${rgba(C.gold, 0.6 + glow * 0.4)}` }} />
                {/* 弹立的卡片：从轴上立起（绕底边旋转），带过冲 */}
                <div style={{ position: "absolute", left: -230, width: 460, bottom: 40, textAlign: "center", transformOrigin: "50% 100%", transform: `perspective(900px) rotateX(${(1 - Math.min(pop, 1.1)) * 80}deg) scale(${0.8 + 0.2 * pop})`, opacity: clamp01(pop * 1.5) }}>
                  <div style={{ fontSize: last ? 120 : 96, fontWeight: 900, letterSpacing: -2, color: last ? C.goldHi : C.ink, textShadow: last ? `0 0 40px ${rgba(C.gold, 0.6 * glow + 0.2)}` : "0 4px 20px rgba(0,0,0,0.6)" }}>{it.when}</div>
                  <div style={{ marginTop: 8, fontSize: 46, fontWeight: 700, color: last ? C.ink : C.dim, lineHeight: 1.3 }}>{it.label}</div>
                </div>
              </div>
            );
          })}
        </SpeedBlur>
      </div>
      {p.title && <div style={{ position: "absolute", left: 0, right: 0, top: 90, textAlign: "center", fontSize: 60, fontWeight: 900 }}><Rise text={p.title} at={2} gap={2} /></div>}
    </Stage>
  );
};
