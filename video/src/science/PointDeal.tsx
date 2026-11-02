// 镜头：要点清单（原理：deck-deal 发牌式越来越快 + list-stack-press 落地压弹 + 唯一高亮）——讲「几个要点」「三个关键词」
// 标题先到；要点卡像发牌一样从右下画外甩进各自槽位，间隔越来越短（砰——砰—砰），每张落地整列下压几像素再弹回；
// 全部落定停一拍后，重点那一条（默认最后一条）抬起、金色描边、编号点亮，其余退暗到 55%（不退到 0）；停住。
import React from "react";
import { spring, useVideoConfig } from "remotion";
import { C, EASE, FONT, Rise, SpeedBlur, Stage, clamp01, mix, ramp, rgba, useShotFrame, type ShotMeta } from "./kit";

export const POINT_DEAL_DURATION = 130;
export const POINT_DEAL_META: ShotMeta = { duration: POINT_DEAL_DURATION, holdAt: 90, holdEnd: 129 };

export type PointDealProps = { title: string; items: string[]; focus?: number };
const DEFAULTS: PointDealProps = { title: "记住三个词", items: ["注意力：每个词看所有词", "并行：显卡一起算", "能堆大：越大越聪明"], focus: 2 };

export const PointDeal: React.FC<Partial<PointDealProps>> = (props) => {
  const p = { ...DEFAULTS, ...props } as PointDealProps;
  const items = p.items.slice(0, 5);
  const n = items.length;
  const frame = useShotFrame();
  const { fps } = useVideoConfig();
  const focus = Math.min(n - 1, p.focus ?? n - 1);
  const rowH = n > 3 ? 120 : 150;
  const top0 = 540 - ((n - 1) * rowH) / 2 + 40;
  // 起跳帧：间隔先大后小
  const starts = items.map((_, i) => 14 + Math.round(36 * (1 - (1 - i / Math.max(1, n - 1)) ** 1.8) * (n > 1 ? 1 : 0)));
  const land = starts.map((s) => s + 12);
  const press = land.reduce((acc, l) => acc + (frame >= l ? 6 * Math.exp(-(frame - l) / 3) * Math.sin(Math.min(Math.PI, (frame - l) / 2)) : 0), 0);
  const hl = ramp(frame, land[n - 1] + 16, 14, EASE.in);
  return (
    <Stage keyLight={[0.3, 0.08]} intensity={0.85}>
      <div style={{ position: "absolute", left: 300, top: top0 - 190, fontSize: 64, fontWeight: 900 }}><Rise text={p.title} at={2} gap={2} /></div>
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${press}px)` }}>
        {items.map((it, i) => {
          const f0 = starts[i];
          const sp = spring({ frame: frame - f0, fps, config: { damping: 14, stiffness: 170 } });
          const pos = (f: number) => (f < f0 ? 1 : 1 - Math.min(1, spring({ frame: f - f0, fps, config: { damping: 14, stiffness: 170 } })));
          const x = pos(frame) * 900, y = pos(frame) * 420;
          const vx = (pos(frame) - pos(frame - 1)) * 900;
          const isF = i === focus;
          const lift = isF ? hl : 0;
          const dim = !isF ? hl * 0.45 : 0;
          return (
            <SpeedBlur key={i} id={`pd${i}`} vx={vx} vy={vx * 0.47} k={0.25} max={20}
              style={{ position: "absolute", left: 300, top: top0 + i * rowH, width: 1320, height: rowH - 26, opacity: clamp01(sp * 2) * (1 - dim),
                transform: `translate(${x}px, ${y - lift * 10}px) rotate(${pos(frame) * 9}deg) scale(${1 + lift * 0.03})` }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: 26, display: "flex", alignItems: "center", fontFamily: FONT,
                background: isF ? `linear-gradient(100deg, ${rgba(C.gold, 0.16 * lift)}, rgba(255,255,255,0.05))` : "linear-gradient(100deg, rgba(255,255,255,0.09), rgba(255,255,255,0.03))",
                border: `2px solid ${isF ? rgba(C.gold, 0.25 + 0.7 * lift) : C.line}`,
                boxShadow: `0 ${20 + lift * 20}px ${50 + lift * 30}px rgba(0,0,0,0.45), 0 0 ${60 * lift}px ${rgba(C.gold, 0.35)}` }}>
                <div style={{ width: 84, height: 84, marginLeft: 26, borderRadius: 42, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, fontWeight: 900,
                  background: isF ? mixColor(lift) : "rgba(255,255,255,0.12)", color: isF && lift > 0.5 ? "#140d02" : C.ink }}>{i + 1}</div>
                <div style={{ marginLeft: 34, fontSize: n > 3 ? 50 : 56, fontWeight: 800 }}>{it}</div>
              </div>
            </SpeedBlur>
          );
        })}
      </div>
    </Stage>
  );
};

const mixColor = (t: number) => `rgba(${Math.round(mix(255, 245, t))},${Math.round(mix(255, 184, t))},${Math.round(mix(255, 61, t))},${mix(0.12, 1, t)})`;
