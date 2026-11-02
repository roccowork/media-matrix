// 镜头：碎片聚合开场（对标 video-shotcraft 的 fracture，自己实现）
// 一张标题海报切成 6×4 块。碎片带着三维姿态散在空间里，按离中心的距离一圈圈飞回原位（中心先到、四角最后），
// 每块落位有一下阻尼小摆（「咔哒」）；拼齐后亮出标题、停一拍让人读，整面极缓推近；最后每块背离中心加速旋转飞出画面。
// 退场是飞走不是淡出；碎片按朝向打明暗（越侧对镜头越暗），快速段按速度加方向模糊。
import React from "react";
import { AbsoluteFill } from "remotion";
import { C, EASE, FONT, Rise, SpeedBlur, Stage, clamp01, mix, ramp, rgba, rnd, wobble , useShotFrame, type ShotMeta } from "./kit";

export const SHARD_OPEN_DURATION = 170;
export const SHARD_OPEN_META: ShotMeta = { duration: SHARD_OPEN_DURATION, holdAt: 100, holdEnd: 126 };

const COLS = 6, ROWS = 4;
const W = 1500, H = 840; // 海报尺寸
const TW = W / COLS, TH = H / ROWS;
const X0 = (1920 - W) / 2, Y0 = (1080 - H) / 2;
const ASSEMBLE = 6; // 第一块开始归位
const RING = 5; // 每圈错峰帧
const FLY = 26; // 每块归位时长
const TITLE = 62; // 标题亮起
const LEAVE = 128; // 开始飞散

export type ShardOpenProps = { kicker: string; title: string; sub: string; hl?: string };
const DEFAULTS: ShardOpenProps = { kicker: "AI 科普 · 第 01 期", title: "Transformer", sub: "大模型的心脏，是怎么跳动的", hl: "心脏" };

// 被切开的那张海报（每块碎片里放一整张，用偏移只露出自己那一格）
const Poster: React.FC<ShardOpenProps & { frame: number }> = ({ kicker, title, sub, hl, frame }) => (
  <div style={{ position: "absolute", width: W, height: H, overflow: "hidden", borderRadius: 4, background: `linear-gradient(160deg, ${C.bg2} 0%, ${C.bg1} 45%, #050816 100%)` }}>
    {/* 海报自己的光：左上柔光 + 底部发光地平线弧 */}
    <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 55% 60% at 22% 18%, ${rgba("#8fa8ff", 0.28)} 0%, transparent 70%)` }} />
    <div style={{ position: "absolute", left: -200, right: -200, top: 600, height: 700, borderRadius: "50%", border: `2px solid ${rgba(C.gold, 0.55)}`, boxShadow: `0 -10px 80px ${rgba(C.gold, 0.35)}, inset 0 10px 60px ${rgba(C.gold, 0.18)}` }} />
    <div style={{ position: "absolute", left: 0, right: 0, top: 560, height: 200, background: `radial-gradient(ellipse 45% 40% at 50% 70%, ${rgba(C.gold, 0.25)} 0%, transparent 70%)` }} />
    {/* 细网格：给海报一点「图纸」质感 */}
    <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px)`, backgroundSize: "60px 60px", opacity: 0.35 }} />
    <div style={{ position: "absolute", left: 0, right: 0, top: 230, textAlign: "center", fontFamily: FONT }}>
      <div style={{ fontSize: 30, letterSpacing: 14, color: C.gold, fontWeight: 700 }}>{frame >= TITLE - 4 ? <Rise text={kicker} at={TITLE - 4} gap={1} /> : null}</div>
      <div style={{ marginTop: 18, fontSize: 168, fontWeight: 900, letterSpacing: -3, lineHeight: 1.05, color: C.ink, textShadow: `0 0 50px ${rgba(C.goldHi, 0.35)}` }}>
        {frame >= TITLE ? <Rise text={title} at={TITLE} gap={3} dur={18} /> : null}
      </div>
      <div style={{ marginTop: 26, fontSize: 56, fontWeight: 500, color: C.dim }}>{frame >= TITLE + 12 ? <Rise text={sub} at={TITLE + 12} gap={1} hl={hl} /> : null}</div>
    </div>
  </div>
);

export const ShardOpen: React.FC<Partial<ShardOpenProps>> = (props) => {
  const p = { ...DEFAULTS, ...props };
  const frame = useShotFrame();
  const push = mix(1, 1.035, ramp(frame, TITLE, LEAVE - TITLE, EASE.move)); // hold 段整面极缓推近
  const tiles = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const id = `${r}-${c}`;
      // 离中心的「圈数」（曼哈顿距离），中心先到
      const ring = Math.abs(c - (COLS - 1) / 2) + Math.abs(r - (ROWS - 1) / 2);
      const start = ASSEMBLE + ring * RING + rnd(`j${id}`, 0, 3);
      const tin = ramp(frame, start, FLY, EASE.land);
      // 初始姿态：散在三维空间
      const sx = rnd(`x${id}`, -520, 520), sy = rnd(`y${id}`, -340, 340), sz = rnd(`z${id}`, -300, 600);
      const rx = rnd(`rx${id}`, -170, 170), ry = rnd(`ry${id}`, -170, 170), rz = rnd(`rz${id}`, -90, 90);
      // 退场：背离中心方向飞出，外圈先走
      const cx = X0 + (c + 0.5) * TW - 960, cy = Y0 + (r + 0.5) * TH - 540;
      const ang = Math.atan2(cy, cx) + rnd(`a${id}`, -0.5, 0.5);
      const outStart = LEAVE + (4 - ring) * 2 + rnd(`o${id}`, 0, 3);
      const tout = ramp(frame, outStart, 22, EASE.out);
      const dist = rnd(`d${id}`, 900, 1300);
      const pos = (f: number) => {
        const a = EASE.land(clamp01((f - start) / FLY)), o = EASE.out(clamp01((f - outStart) / 22));
        return [(1 - a) * sx + o * Math.cos(ang) * dist, (1 - a) * sy + o * Math.sin(ang) * dist];
      };
      const [x, y] = pos(frame);
      const [px, py] = pos(frame - 1);
      const z = (1 - tin) * sz + tout * 500;
      const click = wobble(frame, start + FLY, 3); // 落位的阻尼小摆
      const RX = (1 - tin) * rx + click + tout * rnd(`orx${id}`, -150, 150);
      const RY = (1 - tin) * ry + tout * rnd(`ory${id}`, -150, 150);
      const RZ = (1 - tin) * rz + tout * rnd(`orz${id}`, -60, 60);
      // 朝向越偏，越暗
      const facing = Math.abs(Math.cos((RX * Math.PI) / 180) * Math.cos((RY * Math.PI) / 180));
      const shade = 0.75 * (1 - facing);
      const opacity = clamp01(tin * 3 + (frame >= start ? 0.15 : 0));
      tiles.push(
        <div key={id} style={{ position: "absolute", left: X0 + c * TW, top: Y0 + r * TH, width: TW, height: TH, opacity, transformStyle: "preserve-3d",
          transform: `translate3d(${x}px, ${y}px, ${z}px) rotateX(${RX}deg) rotateY(${RY}deg) rotateZ(${RZ}deg)` }}>
          <SpeedBlur id={`s${id}`} vx={x - px} vy={y - py} k={0.3} style={{ position: "absolute", inset: 0, overflow: "hidden", outline: `0.5px solid ${rgba("#000", 0.5)}` }}>
            <div style={{ position: "absolute", left: -c * TW, top: -r * TH }}>
              <Poster {...p} frame={frame} />
            </div>
            <div style={{ position: "absolute", inset: 0, background: `rgba(2,4,12,${shade})` }} />
            {/* 侧光：碎片翻转时边缘掠过的一道高光 */}
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(${RY > 0 ? 100 : 280}deg, ${rgba(C.goldHi, 0.18 * (1 - facing))} 0%, transparent 40%)` }} />
          </SpeedBlur>
        </div>,
      );
    }
  }
  return (
    <Stage keyLight={[0.5, 0.1]} horizon={0.88} intensity={0.8}>
      <AbsoluteFill style={{ perspective: 1100, perspectiveOrigin: "50% 48%" }}>
        <AbsoluteFill style={{ transformStyle: "preserve-3d", transform: `scale(${push})` }}>{tiles}</AbsoluteFill>
      </AbsoluteFill>
    </Stage>
  );
};
