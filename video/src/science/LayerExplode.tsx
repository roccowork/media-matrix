// 镜头：分层爆炸图（对标 video-shotcraft 的 exploded-view，自己实现）——讲「它由哪几层组成」
// 一块 Transformer 模块平躺在轴测视角里，先是压实的一整块；各层沿法线错峰弹开、悬停，相机缓慢环绕让层间视差读出纵深；
// 每层的标注活在同一个三维空间里（跟着相机转、始终正对镜头），引线从层的外缘水平引出；
// 读完后标注先撤、各层逆序合体，落座时整块下沉一下再回弹、地面接触影收紧，一道扫光掠过顶面。
import React from "react";
import { AbsoluteFill, spring, useVideoConfig } from "remotion";
import { C, EASE, FONT, Rise, Stage, mix, ramp, rgba , useShotFrame, type ShotMeta } from "./kit";

export const LAYER_EXPLODE_DURATION = 200;
export const LAYER_EXPLODE_META: ShotMeta = { duration: LAYER_EXPLODE_DURATION, holdAt: 100, holdEnd: 126 };

const LW = 720, LH = 430; // 每层的尺寸
const T_EXPLODE = 26, T_LABEL = 52, T_RETRACT = 128, T_COLLAPSE = 136, T_CAPTION = 158;

type Layer = { name: string; en: string; draw: "tokens" | "waves" | "heat" | "bars" | "neurons" };
export type LayerExplodeProps = { layers: Layer[]; caption: string; hl?: string };
const DEFAULTS: LayerExplodeProps = {
  layers: [
    { name: "词元嵌入", en: "Embedding", draw: "tokens" },
    { name: "位置编码", en: "Positional Encoding", draw: "waves" },
    { name: "多头注意力", en: "Multi-Head Attention", draw: "heat" },
    { name: "残差与归一化", en: "Add & Norm", draw: "bars" },
    { name: "前馈网络", en: "Feed Forward", draw: "neurons" },
  ],
  caption: "一层一层，叠出一个 Transformer",
  hl: "Transformer",
};

// 每层面板上的小示意图（都是简单几何，靠形状一眼区分）
const Diagram: React.FC<{ kind: Layer["draw"]; lit: number }> = ({ kind, lit }) => {
  const col = (a: number) => rgba(C.cyan, a * (0.55 + lit * 0.45));
  if (kind === "tokens")
    return (
      <div style={{ position: "absolute", inset: 60, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 16 }}>
        {Array.from({ length: 18 }, (_, i) => <div key={i} style={{ borderRadius: 10, background: col(0.18 + ((i * 37) % 10) / 30), border: `1.5px solid ${col(0.6)}` }} />)}
      </div>
    );
  if (kind === "waves")
    return (
      <svg viewBox="0 0 600 300" style={{ position: "absolute", inset: 60 }}>
        {[0, 1, 2, 3].map((k) => (
          <path key={k} d={Array.from({ length: 61 }, (_, i) => `${i ? "L" : "M"}${i * 10},${150 + Math.sin(i / (2 + k * 1.5)) * (90 - k * 18)}`).join(" ")} fill="none" stroke={k === 0 ? rgba(C.gold, 0.9) : col(0.7 - k * 0.12)} strokeWidth={4 - k * 0.6} />
        ))}
      </svg>
    );
  if (kind === "heat")
    return (
      <div style={{ position: "absolute", inset: 50, display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6 }}>
        {Array.from({ length: 64 }, (_, i) => {
          const r = Math.floor(i / 8), c = i % 8;
          const v = r === c ? 0.9 : Math.max(0.05, 0.75 - Math.abs(r - c) * 0.22 + ((r * 7 + c * 3) % 5) / 25);
          return <div key={i} style={{ borderRadius: 4, background: rgba(v > 0.6 ? C.gold : C.cyan, v * (0.5 + lit * 0.5)) }} />;
        })}
      </div>
    );
  if (kind === "bars")
    return (
      <div style={{ position: "absolute", inset: 70, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        {[0.92, 0.7, 0.84, 0.55, 0.76].map((w, i) => <div key={i} style={{ height: 26, width: `${w * 100}%`, borderRadius: 13, background: `linear-gradient(90deg, ${col(0.85)}, ${col(0.2)})` }} />)}
      </div>
    );
  return (
    <svg viewBox="0 0 600 300" style={{ position: "absolute", inset: 60 }}>
      {[0, 1, 2].map((l) =>
        Array.from({ length: 5 }, (_, i) =>
          l < 2 ? Array.from({ length: 5 }, (_, j) => <line key={`${l}${i}${j}`} x1={80 + l * 220} y1={30 + i * 60} x2={300 + l * 220} y2={30 + j * 60} stroke={col(0.22)} strokeWidth={1.5} />) : null,
        ),
      )}
      {[0, 1, 2].map((l) => Array.from({ length: 5 }, (_, i) => <circle key={`n${l}${i}`} cx={80 + l * 220} cy={30 + i * 60} r={14} fill={l === 1 && i === 2 ? rgba(C.gold, 0.95) : col(0.75)} />))}
    </svg>
  );
};

export const LayerExplode: React.FC<Partial<LayerExplodeProps>> = (props) => {
  const p = { ...DEFAULTS, ...props };
  const frame = useShotFrame();
  const { fps } = useVideoConfig();
  const n = p.layers.length;

  // 进场：整块从下方升起落定
  const enter = ramp(frame, 0, 22, EASE.in);
  // 落锤：合体最后一层到位的那一帧，整组下沉 10px 再阻尼回弹
  const landAt = T_COLLAPSE + (n - 1) * 3 + 14;
  const dip = frame >= landAt ? -10 * Math.exp(-(frame - landAt) * 0.25) * Math.cos((frame - landAt) * 0.6) : 0;
  // 相机：轴测平躺；炸开后拉远一点给层堆留画面，悬停期环绕 +12°、俯角收 4°
  const open = ramp(frame, T_EXPLODE, 40, EASE.move) * (1 - ramp(frame, T_COLLAPSE, 30, EASE.move));
  const orbit = ramp(frame, T_EXPLODE + 10, T_COLLAPSE - T_EXPLODE, EASE.move) * 12;
  const RX = 56 - open * 4, RZ = -36 + orbit;
  const scale = mix(0.86, 0.7, open) * mix(0.9, 1, enter);

  const layers = p.layers.map((L, i) => {
    // 炸开：弹簧，从顶层开始错峰（顶层飞得最高），合体：逆序 ease-in
    const sp = spring({ frame: frame - (T_EXPLODE + (n - 1 - i) * 5), fps, config: { damping: 15, stiffness: 120 } });
    const back = ramp(frame, T_COLLAPSE + (n - 1 - i) * 3, 14, EASE.out);
    const zOpen = 50 + i * 125, zClosed = i * 16;
    const z = mix(zClosed, zOpen, Math.min(sp, 1.15) * (1 - back)) + dip;
    const lit = Math.min(1, sp) * (1 - back);
    // 标注：描线 8 帧 + 文字升起，错峰 6 帧；合体前先撤
    const la = ramp(frame, T_LABEL + i * 6, 10, EASE.soft) * (1 - ramp(frame, T_RETRACT, 8, EASE.out));
    const side = i % 2 === 0 ? 1 : -1; // 左右交替出标注，避免互相遮挡
    return (
      <div key={i} style={{ position: "absolute", left: -LW / 2, top: -LH / 2, width: LW, height: LH, transformStyle: "preserve-3d", transform: `translateZ(${z}px)` }}>
        {/* 厚度边：层底下一片暗色，让它像一块板而不是一张纸 */}
        <div style={{ position: "absolute", inset: 0, borderRadius: 26, background: "#02040c", transform: "translateZ(-10px)", boxShadow: `0 0 0 1px ${rgba(C.cyan, 0.25)}` }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: 26, overflow: "hidden",
          background: `linear-gradient(145deg, ${rgba("#1d2a5c", 0.96)} 0%, ${rgba("#0b1230", 0.96)} 100%)`,
          border: `2px solid ${rgba(i === 2 ? C.gold : C.cyan, 0.35 + lit * 0.5)}`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 0 ${40 * lit}px ${rgba(i === 2 ? C.gold : C.cyan, 0.35 * lit)}` }}>
          <Diagram kind={L.draw} lit={lit} />
          {/* 合体落座后的扫光，只给顶层一次 */}
          {i === n - 1 && (
            <div style={{ position: "absolute", top: 0, bottom: 0, width: 260, left: mix(-300, LW + 300, ramp(frame, landAt + 2, 22, EASE.move)),
              background: `linear-gradient(100deg, transparent, ${rgba(C.goldHi, 0.35)}, transparent)` }} />
          )}
        </div>
        {/* 标注：从层外缘引出，在层平面里画引线，文字反向旋转正对镜头 */}
        {la > 0.01 && (
          <div style={{ position: "absolute", top: side > 0 ? LH - 40 : 40, left: side > 0 ? LW : 0, transformStyle: "preserve-3d", transform: "translateZ(2px)" }}>
            <div style={{ position: "absolute", top: -1.5, left: side > 0 ? 0 : -150 * la, width: 150 * la, height: 3, background: rgba(C.gold, 0.9), boxShadow: `0 0 12px ${rgba(C.gold, 0.8)}` }} />
            <div style={{ position: "absolute", left: side * 160, top: 0, transformStyle: "preserve-3d", transform: `rotateZ(${-RZ}deg) rotateX(${-RX}deg)` }}>
              <div style={{ position: "absolute", [side > 0 ? "left" : "right"]: 0, bottom: 0, whiteSpace: "nowrap", textAlign: side > 0 ? "left" : "right", opacity: la, transform: `translateY(${(1 - la) * 20}px)`, fontFamily: FONT }}>
                <div style={{ fontSize: 26, color: C.gold, fontWeight: 700, letterSpacing: 2 }}>0{i + 1} · {L.en}</div>
                <div style={{ fontSize: 58, fontWeight: 900, color: C.ink, textShadow: "0 4px 24px rgba(0,0,0,0.8)" }}>{L.name}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  });

  // 地面接触影：层越高越虚越淡；合体落座时收紧变实
  const shadows = p.layers.map((_, i) => {
    const sp = Math.min(1, spring({ frame: frame - (T_EXPLODE + (n - 1 - i) * 5), fps, config: { damping: 15, stiffness: 120 } })) * (1 - ramp(frame, T_COLLAPSE + (n - 1 - i) * 3, 14, EASE.out));
    return <div key={i} style={{ position: "absolute", left: -LW / 2 + sp * 40, top: -LH / 2 + sp * 40, width: LW, height: LH, borderRadius: 30, background: "rgba(0,0,0,0.55)", filter: `blur(${14 + sp * 30}px)`, opacity: 0.6 - sp * 0.35 }} />;
  });

  return (
    <Stage keyLight={[0.3, 0.08]} fill={[0.8, 0.85]} horizon={0.92} intensity={0.9}>
      <AbsoluteFill style={{ perspective: 2400, perspectiveOrigin: "50% 40%" }}>
        <div style={{ position: "absolute", left: "50%", top: "62%", transformStyle: "preserve-3d", opacity: enter,
          transform: `translateY(${(1 - enter) * 120 + open * 70}px) scale(${scale}) rotateX(${RX}deg) rotateZ(${RZ}deg)` }}>
          {/* 地面：点阵 + 构件插槽虚线 */}
          <div style={{ position: "absolute", left: -1100, top: -900, width: 2200, height: 1800, backgroundImage: `radial-gradient(${rgba(C.cyan, 0.35)} 1.6px, transparent 1.8px)`, backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 30%, transparent 75%)", WebkitMaskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 30%, transparent 75%)" }} />
          <div style={{ position: "absolute", left: -LW / 2 - 20, top: -LH / 2 - 20, width: LW + 40, height: LH + 40, borderRadius: 34, border: `2px dashed ${rgba(C.gold, 0.4 * open)}` }} />
          {shadows}
          {layers}
        </div>
      </AbsoluteFill>
      {/* 收尾字幕：合体落定后出现并停住 */}
      {frame >= T_CAPTION && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 70, textAlign: "center", fontSize: 64, fontWeight: 900, textShadow: "0 6px 30px rgba(0,0,0,0.85)" }}>
          <Rise text={p.caption} at={T_CAPTION} gap={2} hl={p.hl} />
        </div>
      )}
      {/* 合体前的「这块东西是什么」提示，开场读一下 */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 80, textAlign: "center", fontSize: 30, letterSpacing: 10, color: C.gold, fontWeight: 700, opacity: ramp(frame, 6, 14) * (1 - ramp(frame, T_LABEL, 10)) }}>
        拆开一个 TRANSFORMER 模块
      </div>
    </Stage>
  );
};
