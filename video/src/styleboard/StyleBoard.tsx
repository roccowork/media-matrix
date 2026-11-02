// 风格样张（静态单帧）：同一拍内容「它指的是谁？」用 4 种画面风格各画一张，给用户挑方向。
// ① 深色 3D 科技  ② 鲜艳扁平插画  ③ 纸面手绘  ④ 撞色大字海报
import React from "react";
import { AbsoluteFill, random } from "remotion";
import { loadFont as notoSC } from "@remotion/google-fonts/NotoSansSC";
import { loadFont as kuaile } from "@remotion/google-fonts/ZCOOLKuaiLe";
import { loadFont as huangyou } from "@remotion/google-fonts/ZCOOLQingKeHuangYou";
import { loadFont as fredoka } from "@remotion/google-fonts/Fredoka";
import { loadFont as anton } from "@remotion/google-fonts/Anton";
import { loadFont as caveat } from "@remotion/google-fonts/Caveat";

const SC = notoSC("normal", { weights: ["500", "700", "900"], ignoreTooManyRequestsWarning: true }).fontFamily;
const HAND = kuaile("normal", { ignoreTooManyRequestsWarning: true }).fontFamily;
const POSTER = huangyou("normal", { ignoreTooManyRequestsWarning: true }).fontFamily;
const ROUND = fredoka("normal", { weights: ["600", "700"], ignoreTooManyRequestsWarning: true }).fontFamily;
const COND = anton("normal", { ignoreTooManyRequestsWarning: true }).fontFamily;
const SCRIPT = caveat("normal", { weights: ["700"], ignoreTooManyRequestsWarning: true }).fontFamily;

const TOKENS = ["小猫", "没有", "跳上", "桌子", "因为", "它", "太累了"];

// ───────────────────────── ① 深色 3D 科技 ─────────────────────────
export const StyleDarkTech: React.FC = () => {
  const ws = TOKENS.map((t) => t.length * 60 + 88);
  const total = ws.reduce((a, b) => a + b, 0) + 26 * (ws.length - 1);
  const xs = ws.map((w, i) => (1920 - total) / 2 + ws.slice(0, i).reduce((a, b) => a + b + 26, 0) + w / 2);
  const y = 650;
  const arc = (x1: number, x2: number, h: number) => `M ${x1} ${y - 70} Q ${(x1 + x2) / 2} ${y - 70 - h} ${x2} ${y - 70}`;
  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 70% at 50% 35%, #142252 0%, #070b1f 55%, #02030a 100%)", fontFamily: SC, overflow: "hidden" }}>
      {/* 远处的光晕 */}
      <div style={{ position: "absolute", left: 260, top: 220, width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(94,231,255,0.18), transparent 65%)" }} />
      <div style={{ position: "absolute", left: 900, top: 260, width: 800, height: 800, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,184,61,0.16), transparent 65%)" }} />
      {/* 星点 */}
      {Array.from({ length: 140 }, (_, i) => (
        <div key={i} style={{ position: "absolute", left: random(`x${i}`) * 1920, top: random(`y${i}`) * 700, width: 2 + random(`s${i}`) * 3, height: 2 + random(`s${i}`) * 3, borderRadius: 3, background: "#cfe6ff", opacity: 0.25 + random(`o${i}`) * 0.6, filter: random(`b${i}`) > 0.7 ? "blur(2px)" : undefined }} />
      ))}
      {/* 透视网格地面 */}
      <div style={{ position: "absolute", left: -600, right: -600, top: 660, height: 900, transform: "perspective(700px) rotateX(72deg)", transformOrigin: "50% 0%",
        backgroundImage: "linear-gradient(rgba(94,231,255,0.35) 2px, transparent 2px), linear-gradient(90deg, rgba(94,231,255,0.35) 2px, transparent 2px)", backgroundSize: "90px 90px",
        maskImage: "linear-gradient(180deg, black 0%, transparent 75%)", WebkitMaskImage: "linear-gradient(180deg, black 0%, transparent 75%)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 640, height: 60, background: "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(94,231,255,0.45), transparent 70%)", filter: "blur(10px)" }} />
      {/* 光束 */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <filter id="g1" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="8" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <linearGradient id="gold" x1="0" x2="1"><stop offset="0" stopColor="#ffe29a" /><stop offset="1" stopColor="#f5a623" /></linearGradient>
        </defs>
        {[1, 2, 3, 4].map((i) => <path key={i} d={arc(xs[5], xs[i], 120 + (5 - i) * 50)} fill="none" stroke="rgba(94,231,255,0.55)" strokeWidth={3} filter="url(#g1)" />)}
        <path d={arc(xs[5], xs[6], 110)} fill="none" stroke="url(#gold)" strokeWidth={6} filter="url(#g1)" opacity={0.85} />
        <path d={arc(xs[5], xs[0], 420)} fill="none" stroke="url(#gold)" strokeWidth={12} filter="url(#g1)" />
        {[0.25, 0.5, 0.75].map((t) => {
          const x1 = xs[5], x2 = xs[0], cx = (x1 + x2) / 2, cy = y - 70 - 420;
          const px = (1 - t) ** 2 * x1 + 2 * (1 - t) * t * cx + t * t * x2, py = (1 - t) ** 2 * (y - 70) + 2 * (1 - t) * t * cy + t * t * (y - 70);
          return <circle key={t} cx={px} cy={py} r={9} fill="#fff6d8" filter="url(#g1)" />;
        })}
        <circle cx={xs[0]} cy={y - 70} r={90} fill="none" stroke="#f5b83d" strokeWidth={4} opacity={0.8} filter="url(#g1)" />
      </svg>
      {/* 玻璃词卡 */}
      {TOKENS.map((t, i) => {
        const hot = i === 0 || i === 5;
        return (
          <div key={t} style={{ position: "absolute", left: xs[i] - ws[i] / 2, top: y - 64, width: ws[i], height: 128, borderRadius: 28, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 58, fontWeight: 900, color: hot ? "#1a1204" : "#eef4ff",
            background: hot ? "linear-gradient(160deg, #ffe7a8, #f5b83d)" : "linear-gradient(160deg, rgba(255,255,255,0.18), rgba(255,255,255,0.04))",
            border: `2px solid ${hot ? "#ffe29a" : "rgba(160,220,255,0.55)"}`,
            boxShadow: hot ? "0 0 60px rgba(245,184,61,0.7), 0 30px 60px rgba(0,0,0,0.5)" : "0 0 30px rgba(94,231,255,0.25), inset 0 1px 0 rgba(255,255,255,0.4), 0 30px 60px rgba(0,0,0,0.5)",
            backdropFilter: "blur(14px)" }}>
            {t}
            {/* 地面倒影 */}
            <div style={{ position: "absolute", left: 10, right: 10, top: 140, height: 40, borderRadius: 20, background: hot ? "rgba(245,184,61,0.25)" : "rgba(94,231,255,0.12)", filter: "blur(12px)" }} />
          </div>
        );
      })}
      <div style={{ position: "absolute", left: xs[0] - 120, top: 290, fontSize: 120, fontWeight: 900, color: "#ffe29a", textShadow: "0 0 40px rgba(245,184,61,0.9)", fontFamily: COND, letterSpacing: 2 }}>87%</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 70, textAlign: "center" }}>
        <div style={{ fontFamily: "monospace", fontSize: 26, letterSpacing: 12, color: "#5ee7ff" }}>ATTENTION · 注意力</div>
        <div style={{ marginTop: 10, fontSize: 92, fontWeight: 900, color: "#fff", textShadow: "0 0 40px rgba(120,160,255,0.6)" }}>「它」指的是谁？</div>
      </div>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 75% 70% at 50% 45%, transparent 55%, rgba(0,0,0,0.6) 100%)" }} />
    </AbsoluteFill>
  );
};

// ───────────────────────── ② 鲜艳扁平插画（Kurzgesagt 式） ─────────────────────────
const Cat: React.FC = () => (
  <svg width={520} height={360} viewBox="0 0 520 360">
    {/* 长投影 */}
    <ellipse cx={270} cy={320} rx={220} ry={28} fill="#2a1450" opacity={0.55} />
    {/* 尾巴 */}
    <path d="M 410 250 Q 500 230 480 160 Q 470 130 450 150 Q 470 200 400 225 Z" fill="#ff8f3a" />
    {/* 身体（趴着） */}
    <ellipse cx={290} cy={250} rx={150} ry={75} fill="#ff9d47" />
    <ellipse cx={300} cy={268} rx={110} ry={42} fill="#ffc184" />
    {/* 条纹 */}
    {[240, 290, 340].map((x) => <path key={x} d={`M ${x} 182 q 10 25 0 45`} stroke="#e8742a" strokeWidth={10} strokeLinecap="round" fill="none" />)}
    {/* 头 */}
    <circle cx={150} cy={220} r={88} fill="#ff9d47" />
    <path d="M 82 160 L 70 80 L 130 135 Z" fill="#ff9d47" /><path d="M 218 160 L 232 80 L 172 135 Z" fill="#ff9d47" />
    <path d="M 88 150 L 82 102 L 118 135 Z" fill="#ffc1a8" /><path d="M 212 150 L 220 102 L 184 135 Z" fill="#ffc1a8" />
    {/* 困得闭眼 */}
    <path d="M 105 215 q 20 16 40 0" stroke="#3a1d0b" strokeWidth={8} strokeLinecap="round" fill="none" />
    <path d="M 160 215 q 20 16 40 0" stroke="#3a1d0b" strokeWidth={8} strokeLinecap="round" fill="none" />
    <ellipse cx={152} cy={245} rx={10} ry={7} fill="#ff6b6b" />
    <path d="M 152 252 q -12 14 -26 6 M 152 252 q 12 14 26 6" stroke="#3a1d0b" strokeWidth={5} strokeLinecap="round" fill="none" />
    {[-1, 1].map((s) => [0, 14].map((d) => <line key={`${s}${d}`} x1={152 + s * 40} y1={246 + d} x2={152 + s * 100} y2={238 + d * 1.6} stroke="#3a1d0b" strokeWidth={3} strokeLinecap="round" />))}
    {/* 前爪 */}
    <ellipse cx={210} cy={300} rx={34} ry={18} fill="#ffc184" />
  </svg>
);

export const StyleFlat: React.FC = () => (
  <AbsoluteFill style={{ background: "linear-gradient(180deg, #2b1a6e 0%, #4b2a9a 55%, #6a3bb5 100%)", fontFamily: SC, overflow: "hidden" }}>
    {/* 星星和大圆 */}
    {Array.from({ length: 40 }, (_, i) => <div key={i} style={{ position: "absolute", left: random(`fx${i}`) * 1920, top: random(`fy${i}`) * 520, width: 6, height: 6, borderRadius: 3, background: "#ffe8a3", opacity: 0.5 + random(`fo${i}`) * 0.5 }} />)}
    <div style={{ position: "absolute", left: 140, top: 430, width: 220, height: 220, borderRadius: "50%", background: "linear-gradient(140deg, #ffd166, #ff9f43)" }} />
    <div style={{ position: "absolute", left: 185, top: 410, width: 220, height: 220, borderRadius: "50%", background: "#3a2185" }} />
    {/* 层叠山丘 */}
    <div style={{ position: "absolute", left: -200, right: -200, top: 760, height: 600, borderRadius: "50% 50% 0 0", background: "#7c4dcc" }} />
    <div style={{ position: "absolute", left: -400, width: 1400, top: 820, height: 600, borderRadius: "50% 50% 0 0", background: "#5d34a8" }} />
    {/* 桌子 */}
    <div style={{ position: "absolute", left: 1120, top: 560, width: 520, height: 46, borderRadius: 16, background: "#ffb36b" }} />
    <div style={{ position: "absolute", left: 1170, top: 600, width: 34, height: 280, background: "#e8873f" }} />
    <div style={{ position: "absolute", left: 1556, top: 600, width: 34, height: 280, background: "#e8873f" }} />
    {/* 小猫：没跳上去，趴在地上睡着了 */}
    <div style={{ position: "absolute", left: 700, top: 560 }}><Cat /></div>
    <div style={{ position: "absolute", left: 760, top: 470, fontFamily: ROUND, fontSize: 64, fontWeight: 700, color: "#e9dcff", transform: "rotate(-12deg)" }}>z z z</div>
    {/* 句子：圆润的词块 */}
    <div style={{ position: "absolute", left: 0, right: 0, top: 250, display: "flex", justifyContent: "center", gap: 18 }}>
      {TOKENS.map((t, i) => (
        <div key={t} style={{ padding: "18px 32px", borderRadius: 60, fontSize: 52, fontWeight: 900, color: i === 5 ? "#2b1a6e" : i === 0 ? "#2b1a6e" : "#fff",
          background: i === 5 ? "#ffd166" : i === 0 ? "#ff9d47" : "rgba(255,255,255,0.16)", boxShadow: "0 10px 0 rgba(20,8,50,0.35)" }}>{t}</div>
      ))}
    </div>
    {/* 从「它」画到小猫的虚线箭头 */}
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
      <path d="M 1305 380 C 1300 560, 1080 560, 905 650" fill="none" stroke="#ffd166" strokeWidth={8} strokeDasharray="4 22" strokeLinecap="round" />
      <path d="M 905 612 L 900 652 L 940 662" fill="none" stroke="#ffd166" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <div style={{ position: "absolute", left: 1360, top: 420, padding: "14px 30px", borderRadius: 40, background: "#fff", color: "#2b1a6e", fontSize: 46, fontWeight: 900, boxShadow: "0 8px 0 rgba(20,8,50,0.35)" }}>是小猫！</div>
    <div style={{ position: "absolute", left: 0, right: 0, top: 80, textAlign: "center", fontSize: 96, fontWeight: 900, color: "#fff", textShadow: "0 8px 0 rgba(20,8,50,0.35)" }}>「它」是谁？</div>
  </AbsoluteFill>
);

// ───────────────────────── ③ 纸面手绘 ─────────────────────────
const Rough: React.FC<{ d: string; color: string; w?: number }> = ({ d, color, w = 5 }) => (
  <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" filter="url(#rough)" />
);
export const StylePaper: React.FC = () => {
  const xs = [250, 470, 670, 870, 1070, 1270, 1500];
  const w = (t: string) => t.length * 70 + 50;
  return (
    <AbsoluteFill style={{ background: "#f3ede0", fontFamily: HAND, color: "#2a2620", overflow: "hidden" }}>
      {/* 笔记本横线 + 左边红线 + 纸纹 */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(70,110,170,0.14) 2px, transparent 2px)", backgroundSize: "100% 64px", backgroundPositionY: 30 }} />
      <div style={{ position: "absolute", left: 150, top: 0, bottom: 0, width: 3, background: "rgba(214,80,80,0.35)" }} />
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.18, mixBlendMode: "multiply" }}>
        <filter id="paper"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width="100%" height="100%" filter="url(#paper)" />
      </svg>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <defs><filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" /><feDisplacementMap in="SourceGraphic" scale="7" /></filter></defs>
        {/* 每个词的手绘框 */}
        {TOKENS.map((t, i) => {
          const x = xs[i] - w(t) / 2, y = 560;
          return <Rough key={t} d={`M ${x} ${y} L ${x + w(t) + 6} ${y - 4} L ${x + w(t)} ${y + 104} L ${x - 4} ${y + 100} Z`} color="#2a2620" w={4} />;
        })}
        {/* 「它」红圈 */}
        <Rough d={`M ${xs[5] - 70} ${595} C ${xs[5] - 80} ${520}, ${xs[5] + 90} ${515}, ${xs[5] + 80} ${600} C ${xs[5] + 75} ${690}, ${xs[5] - 95} ${690}, ${xs[5] - 60} ${580}`} color="#d9412e" w={7} />
        {/* 红色箭头：它 → 小猫 */}
        <Rough d={`M ${xs[5]} 520 C ${xs[5] - 200} 330, ${xs[0] + 250} 330, ${xs[0] + 40} 520`} color="#d9412e" w={7} />
        <Rough d={`M ${xs[0] + 10} 485 L ${xs[0] + 38} 525 L ${xs[0] + 82} 500`} color="#d9412e" w={7} />
        {/* 下划线 */}
        <Rough d="M 640 222 C 900 210, 1150 230, 1290 214" color="#2a2620" w={6} />
        {/* 小猫简笔画 */}
        <Rough d="M 230 800 C 230 760, 330 760, 330 800 C 330 840, 230 840, 230 800 M 240 770 L 236 735 L 262 760 M 320 770 L 324 735 L 298 760 M 255 795 q 10 8 20 0 M 285 795 q 10 8 20 0 M 330 815 C 420 800, 450 860, 380 880 C 320 895, 250 880, 240 840 M 420 830 q 50 -20 40 -70" color="#2a2620" w={4} />
        {/* 星星涂鸦 */}
        <Rough d="M 1640 260 l 14 32 l 34 4 l -26 22 l 8 34 l -30 -18 l -30 18 l 8 -34 l -26 -22 l 34 -4 Z" color="#e0a32b" w={4} />
      </svg>
      {/* 小猫的黄色荧光笔 */}
      <div style={{ position: "absolute", left: xs[0] - w("小猫") / 2 + 8, top: 590, width: w("小猫") - 16, height: 46, background: "rgba(255,221,64,0.65)", transform: "rotate(-1.5deg)", borderRadius: 6, mixBlendMode: "multiply" }} />
      {TOKENS.map((t, i) => (
        <div key={t} style={{ position: "absolute", left: xs[i] - w(t) / 2, width: w(t), top: 568, textAlign: "center", fontSize: 72, color: i === 5 ? "#d9412e" : "#2a2620", transform: `rotate(${(random(`r${i}`) - 0.5) * 4}deg)` }}>{t}</div>
      ))}
      <div style={{ position: "absolute", left: 0, right: 0, top: 110, textAlign: "center", fontSize: 110 }}>「它」指的是谁？</div>
      <div style={{ position: "absolute", left: 360, top: 790, fontSize: 52, color: "#555", transform: "rotate(-4deg)" }}>zzz…太累了</div>
      {/* 便利贴 */}
      <div style={{ position: "absolute", left: 1220, top: 740, width: 520, padding: "36px 40px", background: "#ffe479", transform: "rotate(3deg)", boxShadow: "0 18px 30px rgba(0,0,0,0.18)", fontSize: 50, lineHeight: 1.4 }}>
        <div style={{ position: "absolute", left: 190, top: -20, width: 140, height: 40, background: "rgba(255,255,255,0.55)", transform: "rotate(-4deg)" }} />
        注意力 =<br />每个词都去看一遍<br />所有的词 ✓
      </div>
      <div style={{ position: "absolute", left: xs[0] - 120, top: 400, fontFamily: SCRIPT, fontSize: 84, color: "#d9412e", transform: "rotate(-8deg)" }}>87%!</div>
    </AbsoluteFill>
  );
};

// ───────────────────────── ④ 撞色大字海报 ─────────────────────────
export const StylePoster: React.FC = () => {
  const blocks = [
    { t: "小猫", bg: "#d4f53c", fg: "#111" }, { t: "没有", bg: "#111", fg: "#fff" }, { t: "跳上", bg: "#111", fg: "#fff" }, { t: "桌子", bg: "#111", fg: "#fff" },
    { t: "因为", bg: "#111", fg: "#fff" }, { t: "它", bg: "#ff3b2f", fg: "#fff" }, { t: "太累了", bg: "#2346ff", fg: "#fff" },
  ];
  return (
    <AbsoluteFill style={{ background: "#f2efe7", fontFamily: SC, color: "#111", overflow: "hidden" }}>
      {/* 版式网格 */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)", backgroundSize: "160px 100%" }} />
      <div style={{ position: "absolute", left: 80, top: 60, fontFamily: "monospace", fontSize: 26, letterSpacing: 6 }}>01 / ATTENTION</div>
      <div style={{ position: "absolute", right: 80, top: 60, fontFamily: "monospace", fontSize: 26, letterSpacing: 6 }}>AI 科普 · 向晓 AI</div>
      {/* 巨型「它」 */}
      <div style={{ position: "absolute", left: 60, top: 70, fontFamily: POSTER, fontSize: 560, lineHeight: 1, color: "#ff3b2f" }}>它</div>
      <div style={{ position: "absolute", left: 640, top: 150, fontFamily: POSTER, fontSize: 190, lineHeight: 1.02 }}>指的<br />是谁？</div>
      {/* 87% 大数字 */}
      <div style={{ position: "absolute", right: 90, top: 170, textAlign: "right" }}>
        <div style={{ fontFamily: COND, fontSize: 250, lineHeight: 0.9, color: "#2346ff" }}>87%</div>
        <div style={{ fontSize: 34, fontWeight: 900, marginTop: 8 }}>注意力给了「小猫」</div>
      </div>
      {/* 粗箭头 */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <path d="M 1407 790 C 1407 990, 200 990, 200 840" fill="none" stroke="#111" strokeWidth={22} strokeLinecap="round" />
        <path d="M 160 880 L 200 822 L 242 878" fill="none" stroke="#111" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {/* 词块 */}
      <div style={{ position: "absolute", left: 80, right: 80, top: 640, display: "flex", gap: 14 }}>
        {blocks.map((b) => (
          <div key={b.t} style={{ flex: b.t.length, padding: "26px 0", textAlign: "center", fontSize: 64, fontWeight: 900, background: b.bg, color: b.fg }}>{b.t}</div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 80, bottom: 50, fontSize: 30, fontWeight: 700 }}>每个词，都去看一遍所有的词——这就是注意力。</div>
    </AbsoluteFill>
  );
};

export const STYLES = [
  { id: "Style-1-DarkTech", C: StyleDarkTech },
  { id: "Style-2-Flat", C: StyleFlat },
  { id: "Style-3-Paper", C: StylePaper },
  { id: "Style-4-Poster", C: StylePoster },
];
