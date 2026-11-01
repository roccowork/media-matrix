// 「AI 前沿」竖屏短视频模板（向晓 AI）：3D 晨光背景 + 品牌栏 + 按配音时间出现的信息卡片 + 逐字高亮字幕 + 配乐和音效。
// 每期只换 episodes/ 下的数据（稿子的时间戳由 tools/frontier_captions.py 从 ElevenLabs 生成）。
import React, { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Caption } from "./types";

// ── 品牌：向晓 AI（深蓝夜空 + 金色晨光），和网站 ops.liuxd.dev 一致 ──
export const dawn = {
  name: "向晓 AI",
  en: "DAWNWARD AI",
  column: "AI 前沿",
  slogan: "向晓而行，终见万丈光芒",
  bg: "#070b14",
  navy: "#0b1220",
  gold: "#fbbf24",
  goldSoft: "#fde68a",
  amber: "#f59e0b",
  text: "#f1f5f9",
  muted: "#94a3b8",
  red: "#f87171",
  font: '"Noto Sans CJK SC", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
};

export const FPS = 30;
export const LEAD = 1.0; // 配音前留 1 秒：片头标题先亮相
export const TAIL = 3.6; // 配音结束后的片尾

// ── 小工具 ──
const sec = (s: number) => Math.round(s * FPS);
const useT = () => useCurrentFrame() / FPS - LEAD; // 以配音开始为 0 的秒数
const ease = (frame: number, at: number, dur = 18) =>
  spring({ frame: frame - sec(at), fps: FPS, config: { damping: 18, stiffness: 120, mass: 0.8 }, durationInFrames: dur });
const fade = (t: number, a: number, b: number) =>
  interpolate(t, [a, a + 0.25, b - 0.25, b], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

// ── 3D 晨光背景：地平线下升起的太阳、三道同心光环（和 Logo 一致）、向上漂浮的光尘 ──
const Particles: React.FC<{ frame: number }> = ({ frame }) => {
  const n = 420;
  const base = useMemo(() => {
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (random(`x${i}`) - 0.5) * 12;
      arr[i * 3 + 1] = (random(`y${i}`) - 0.5) * 20;
      arr[i * 3 + 2] = (random(`z${i}`) - 0.5) * 6;
    }
    return arr;
  }, []);
  const pos = useMemo(() => new Float32Array(n * 3), []);
  for (let i = 0; i < n; i++) {
    const speed = 0.004 + random(`s${i}`) * 0.01;
    pos[i * 3] = base[i * 3] + Math.sin(frame / 40 + i) * 0.05;
    pos[i * 3 + 1] = ((base[i * 3 + 1] + frame * speed + 10) % 20) - 10;
    pos[i * 3 + 2] = base[i * 3 + 2];
  }
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} count={n} />
      </bufferGeometry>
      <pointsMaterial color={dawn.goldSoft} size={0.045} transparent opacity={0.75} depthWrite={false} />
    </points>
  );
};

// 地面的透视网格：竖线汇聚到地平线中心，横线越近越稀，缓慢向镜头移动
const GroundGrid: React.FC<{ frame: number }> = ({ frame }) => {
  const pts: number[] = [];
  for (let i = -12; i <= 12; i++) pts.push(i * 0.35, 0, 0.02, i * 2.6, -6, 0.02);
  const shift = (frame / 45) % 1;
  for (let k = 0; k < 8; k++) {
    const d = Math.pow((k + shift) / 8, 2) * 6; // 0 → 6，越往下间距越大
    pts.push(-15, -d, 0.02, 15, -d, 0.02);
  }
  const arr = new Float32Array(pts);
  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[arr, 3]} count={arr.length / 3} />
      </bufferGeometry>
      <lineBasicMaterial color={dawn.gold} transparent opacity={0.16} depthWrite={false} />
    </lineSegments>
  );
};

const DawnScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const rise = interpolate(frame, [0, sec(2.2)], [-6.4, -3.2], { extrapolateRight: "clamp", easing: (x) => 1 - Math.pow(1 - x, 3) });
  const breathe = 1 + Math.sin(frame / 22) * 0.025;
  return (
    <ThreeCanvas width={width} height={height} camera={{ fov: 50, position: [0, 0, 10] }}>
      <group position={[0, rise, 0]}>
        {/* 太阳：实心 + 两层光晕 */}
        <mesh>
          <circleGeometry args={[1.25, 64]} />
          <meshBasicMaterial color={dawn.gold} />
        </mesh>
        {[1.9, 2.8].map((r, i) => (
          <mesh key={r} scale={breathe}>
            <circleGeometry args={[r, 64]} />
            <meshBasicMaterial color={dawn.amber} transparent opacity={0.16 - i * 0.07} depthWrite={false} />
          </mesh>
        ))}
        {/* 三道光环，慢慢向外扩散 */}
        {[0, 1, 2].map((i) => {
          const r = 2.2 + i * 1.35 + ((frame / 90 + i * 0.33) % 1) * 0.25;
          return (
            <mesh key={i}>
              <ringGeometry args={[r, r + 0.035, 128, 1, 0, Math.PI]} />
              <meshBasicMaterial color={i === 0 ? dawn.gold : dawn.goldSoft} transparent opacity={0.65 - i * 0.18} depthWrite={false} />
            </mesh>
          );
        })}
        {/* 地平线以下：暗色地面挡住太阳下半截，上面有透视网格和太阳的倒影 */}
        <mesh position={[0, -3.2, 0.01]}>
          <planeGeometry args={[30, 6.4]} />
          <meshBasicMaterial color="#0a101d" />
        </mesh>
        <mesh position={[0, -0.45, 0.015]} scale={[1, 0.22, 1]}>
          <circleGeometry args={[1.7, 64]} />
          <meshBasicMaterial color={dawn.amber} transparent opacity={0.13} depthWrite={false} />
        </mesh>
        <GroundGrid frame={frame} />
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[30, 0.035]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
        </mesh>
      </group>
      <Particles frame={frame} />
    </ThreeCanvas>
  );
};

// ── Logo（和网站一致：同心弧日出） ──
export const DawnLogo: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32">
    <rect width="32" height="32" rx="7" fill="#0b1220" />
    <path d="M12.2 21.5a3.8 3.8 0 0 1 7.6 0z" fill="#fbbf24" />
    <path d="M8.6 21.5a7.4 7.4 0 0 1 14.8 0" fill="none" stroke="#fbbf24" strokeWidth="2" />
    <path d="M4.9 21.5a11.1 11.1 0 0 1 22.2 0" fill="none" stroke="#fcd34d" strokeWidth="2" opacity=".7" />
    <path d="M4 21.5h24" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

// ── 线条图标（统一 2px 描边、金色），画面里只用这些，不用表情符号 ──
const Icon: React.FC<{ name: string; size?: number; color?: string }> = ({ name, size = 64, color = dawn.gold }) => {
  const p = { fill: "none", stroke: color, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, React.ReactNode> = {
    calendar: (
      <>
        <rect x="4" y="6" width="24" height="22" rx="4" {...p} />
        <path d="M4 13h24M11 3v6M21 3v6" {...p} />
        <path d="M10 19h4M18 19h4M10 24h4" {...p} />
      </>
    ),
    crown: (
      <>
        <path d="M5 23 7 10l6 6 3-9 3 9 6-6 2 13z" {...p} />
        <path d="M6 27h20" {...p} />
      </>
    ),
    clock: (
      <>
        <circle cx="16" cy="16" r="11" {...p} />
        <path d="M16 9v7l5 3" {...p} />
      </>
    ),
    code: <path d="M11 10 5 16l6 6M21 10l6 6-6 6M18 7l-4 18" {...p} />,
    gauge: (
      <>
        <path d="M5 22a11 11 0 1 1 22 0" {...p} />
        <path d="M16 22l6-7" {...p} />
        <circle cx="16" cy="22" r="1.6" fill={color} />
        <path d="M5 26h22" {...p} />
      </>
    ),
    shield: (
      <>
        <path d="M16 4 26 8v8c0 6-4.3 10.3-10 12C10.3 26.3 6 22 6 16V8z" {...p} />
        <path d="m11 16 3.5 3.5L21 13" {...p} />
      </>
    ),
    quote: (
      <path d="M8 22c0-5 2-9 6-11M18 22c0-5 2-9 6-11M8 22h5v-5H8zM18 22h5v-5h-5z" {...p} />
    ),
    pause: (
      <>
        <circle cx="16" cy="16" r="11" {...p} />
        <path d="M13 11v10M19 11v10" {...p} />
      </>
    ),
    infinity: <path d="M9 12c-3 0-5 2-5 4s2 4 5 4c5 0 9-8 14-8 3 0 5 2 5 4s-2 4-5 4c-5 0-9-8-14-8" {...p} />,
    alert: (
      <>
        <path d="M16 5 29 27H3z" {...p} />
        <path d="M16 13v7M16 24v.5" {...p} />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ filter: `drop-shadow(0 0 10px ${color}66)` }}>
      {paths[name]}
    </svg>
  );
};

// ── 通用卡片：玻璃质感，从下方滑入 ──
const Glass: React.FC<{ children: React.ReactNode; enter: number; style?: React.CSSProperties; glow?: boolean }> = ({ children, enter, style, glow }) => (
  <div
    style={{
      background: "linear-gradient(160deg, rgba(30,41,59,0.62), rgba(11,18,32,0.72))",
      border: `1.5px solid ${glow ? "rgba(251,191,36,0.55)" : "rgba(148,163,184,0.18)"}`,
      boxShadow: glow ? "0 0 60px rgba(251,191,36,0.18), inset 0 1px 0 rgba(255,255,255,0.06)" : "inset 0 1px 0 rgba(255,255,255,0.06)",
      backdropFilter: "blur(14px)",
      borderRadius: 36,
      padding: "44px 52px",
      opacity: enter,
      transform: `translateY(${(1 - enter) * 60}px) scale(${0.96 + enter * 0.04})`,
      ...style,
    }}
  >
    {children}
  </div>
);

// ── 品牌栏 + AI 生成标识 ──
const TopBar: React.FC<{ date: string }> = ({ date }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 96, left: 64, right: 64, display: "flex", alignItems: "center", gap: 22, opacity: o }}>
      <DawnLogo size={72} />
      <div>
        <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: 4, color: dawn.text }}>{dawn.name}</div>
        <div style={{ fontSize: 17, letterSpacing: 7, color: dawn.muted }}>{dawn.en}</div>
      </div>
      <div style={{ marginLeft: 8, padding: "8px 22px", borderRadius: 999, background: "rgba(251,191,36,0.14)", color: dawn.gold, fontSize: 30, fontWeight: 600, letterSpacing: 3 }}>
        {dawn.column}
      </div>
      <div style={{ marginLeft: "auto", textAlign: "right" }}>
        <div style={{ fontSize: 34, fontWeight: 600, color: dawn.text, letterSpacing: 2 }}>{date}</div>
        <div style={{ marginTop: 4, fontSize: 18, color: dawn.muted, border: `1px solid ${dawn.muted}66`, borderRadius: 8, padding: "2px 10px" }}>
          内容由 AI 生成
        </div>
      </div>
    </div>
  );
};

// ── 逐字高亮字幕：说过的字白色，正在说的字金色，还没说的半透明 ──
const Karaoke: React.FC<{ captions: Caption[] }> = ({ captions }) => {
  const t = useT();
  const cap = captions.find((c) => t >= c.start && t < c.end);
  if (!cap) return null;
  const o = interpolate(t, [cap.start, cap.start + 0.12], [0, 1], { extrapolateRight: "clamp" });
  const current = cap.chars.filter((c) => c.t <= t).length - 1;
  return (
    <div style={{ position: "absolute", left: 70, right: 130, top: 1360, display: "flex", justifyContent: "center", opacity: o }}>
      <div
        style={{
          padding: "18px 36px",
          borderRadius: 22,
          background: "rgba(7,11,20,0.62)",
          border: "1px solid rgba(148,163,184,0.16)",
          fontSize: 54,
          fontWeight: 700,
          lineHeight: 1.35,
          textAlign: "center",
          letterSpacing: 1,
        }}
      >
        {cap.chars.map((c, i) => (
          <span key={i} style={{ color: i === current ? dawn.gold : i < current ? "#fff" : "rgba(255,255,255,0.38)", textShadow: i === current ? `0 0 18px ${dawn.gold}aa` : "none" }}>
            {c.c}
          </span>
        ))}
      </div>
    </div>
  );
};

// ── 各个信息画面（按配音时间切换） ──
const Stage: React.FC<{ from: number; to: number; children: (enter: (at: number) => number) => React.ReactNode }> = ({ from, to, children }) => {
  const frame = useCurrentFrame();
  const t = useT();
  if (t < from - 0.05 || t > to + 0.05) return null;
  const out = fade(t, from, to);
  return (
    <div style={{ position: "absolute", left: 64, right: 120, top: 330, height: 980, display: "flex", flexDirection: "column", justifyContent: "center", gap: 34, opacity: out }}>
      {children((at) => ease(frame, at))}
    </div>
  );
};

const Label: React.FC<{ children: React.ReactNode; color?: string; size?: number }> = ({ children, color = dawn.muted, size = 34 }) => (
  <div style={{ fontSize: size, color, letterSpacing: 2, lineHeight: 1.4 }}>{children}</div>
);

export type FrontierProps = { date: string; captions: Caption[]; voiceDuration: number; voice: string };

// 第 1 期（2026-11-01）：Claude 取消 5 小时限制。画面节点的时间（秒）对照 voice.json 里每句话的开始时间
const ClaudeStages: React.FC = () => {
  const frame = useCurrentFrame();
  const t = useT();
  const hookIn = ease(frame, -0.9, 22);
  const gone = ease(frame, 1.44, 14);
  return (
    <>
      {/* 开头标题 */}
      {t < 1.9 && (
        <div style={{ position: "absolute", left: 64, right: 64, top: 520, opacity: fade(t, -1, 1.9) }}>
          <Label color={dawn.gold} size={36}>ANTHROPIC · CLAUDE</Label>
          <div style={{ marginTop: 26, fontSize: 112, fontWeight: 800, lineHeight: 1.15, color: "#fff", opacity: hookIn, transform: `translateY(${(1 - hookIn) * 40}px)` }}>
            Claude 的
            <br />
            <span style={{ color: dawn.gold }}>5 小时限制</span>
          </div>
          <div style={{ marginTop: 30, display: "inline-block", fontSize: 128, fontWeight: 900, color: "#fff", padding: "4px 34px", borderRadius: 24, background: dawn.red, opacity: gone, transform: `scale(${1.6 - gone * 0.6}) rotate(-4deg)` }}>
            没了
          </div>
        </div>
      )}

      <Stage from={1.84} to={3.68}>
        {(e) => (
          <Glass enter={e(1.84)} glow>
            <div style={{ display: "flex", alignItems: "center", gap: 34 }}>
              <Icon name="calendar" size={110} />
              <div>
                <div style={{ fontSize: 120, fontWeight: 800, color: "#fff", lineHeight: 1 }}>10.30</div>
                <Label size={38}>Anthropic 官宣</Label>
              </div>
            </div>
          </Glass>
        )}
      </Stage>

      <Stage from={3.68} to={7.92}>
        {(e) => (
          <Glass enter={e(3.68)} glow>
            <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
              <Icon name="crown" size={96} />
              <Label size={38}>顶配套餐 · 改名</Label>
            </div>
            <div style={{ marginTop: 34, display: "flex", alignItems: "center", gap: 30, fontSize: 92, fontWeight: 800 }}>
              <span style={{ color: dawn.muted, position: "relative" }}>
                Max 20×
                <span style={{ position: "absolute", left: -6, right: -6, top: "52%", height: 8, borderRadius: 4, background: dawn.red, transformOrigin: "left", transform: `scaleX(${e(5.6)})` }} />
              </span>
              <span style={{ color: dawn.gold, opacity: e(6.08), fontSize: 50 }}>→</span>
              <span style={{ color: "#fff", opacity: e(6.08), textShadow: `0 0 40px ${dawn.gold}88` }}>Ultra</span>
            </div>
            <div style={{ marginTop: 30, opacity: e(7.2), display: "flex", gap: 18 }}>
              <span style={{ fontSize: 44, fontWeight: 700, color: dawn.gold }}>$200 / 月</span>
              <span style={{ fontSize: 44, color: dawn.text }}>价格不变</span>
            </div>
          </Glass>
        )}
      </Stage>

      <Stage from={7.92} to={9.84}>
        {(e) => {
          const cut = e(8.5);
          return (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30, opacity: e(7.92) }}>
              <div style={{ position: "relative", width: 380, height: 380 }}>
                <svg width="380" height="380" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" fill="rgba(11,18,32,0.7)" stroke={dawn.gold} strokeWidth="2.5" strokeDasharray="276" strokeDashoffset={276 * (1 - e(7.92))} />
                  <path d="M50 22v28l18 10" fill="none" stroke={dawn.goldSoft} strokeWidth="3" strokeLinecap="round" />
                  <path d="M14 86 86 14" stroke={dawn.red} strokeWidth="6" strokeLinecap="round" strokeDasharray="102" strokeDashoffset={102 * (1 - cut)} />
                </svg>
              </div>
              <div style={{ fontSize: 66, fontWeight: 800, color: "#fff" }}>
                取消 <span style={{ color: dawn.gold }}>5 小时</span> 窗口
              </div>
            </div>
          );
        }}
      </Stage>

      <Stage from={9.84} to={14.24}>
        {(e) => {
          const before = interpolate(t, [9.9, 11.6], [0, 0.72], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const now = interpolate(t, [12.85, 14.1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const row = (icon: string, label: string, fill: number, color: string, note: string, enter: number, flow: boolean) => (
            <Glass enter={enter} glow={flow}>
              <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
                <Icon name={icon} size={64} color={color} />
                <Label size={40} color={dawn.text}>{label}</Label>
                <span style={{ marginLeft: "auto", fontSize: 36, color }}>{note}</span>
              </div>
              <div style={{ marginTop: 26, height: 22, borderRadius: 11, background: "rgba(148,163,184,0.16)", overflow: "hidden", position: "relative" }}>
                <div style={{ width: `${fill * 100}%`, height: "100%", borderRadius: 11, background: flow ? `linear-gradient(90deg, ${dawn.amber}, ${dawn.goldSoft})` : dawn.muted }} />
                {flow && <div style={{ position: "absolute", top: 0, bottom: 0, width: 120, left: `${((frame * 2.2) % 120) - 20}%`, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)" }} />}
              </div>
            </Glass>
          );
          return (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: e(9.84) }}>
                <Icon name="code" size={60} />
                <Label size={40} color={dawn.gold}>高强度写代码</Label>
              </div>
              {row("pause", "以前", before, dawn.muted, before >= 0.72 ? "用满 5 小时 · 停下来等" : "", e(9.9), false)}
              {row("infinity", "现在", now, dawn.gold, now > 0 ? "一口气干下去" : "", e(12.85), true)}
            </>
          );
        }}
      </Stage>

      <Stage from={14.24} to={21.6}>
        {(e) => (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: e(14.24) }}>
              <Icon name="alert" size={66} color={dawn.red} />
              <div style={{ fontSize: 64, fontWeight: 800, color: "#fff" }}>但注意两点</div>
            </div>
            {[
              { at: 15.04, n: "1", icon: "gauge", title: "每周总用量上限还在", sub: "不是无限用" },
              { at: 17.92, n: "2", icon: "shield", title: "先对已验证账号开放", sub: "新用户要等验证完" },
            ].map((x) => (
              <Glass key={x.n} enter={e(x.at)} glow={t >= x.at && t < x.at + 2.8}>
                <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
                  <div style={{ fontSize: 80, fontWeight: 900, color: dawn.gold, width: 60 }}>{x.n}</div>
                  <Icon name={x.icon} size={84} />
                  <div>
                    <div style={{ fontSize: 50, fontWeight: 800, color: "#fff" }}>{x.title}</div>
                    <Label size={36}>{x.sub}</Label>
                  </div>
                </div>
              </Glass>
            ))}
          </>
        )}
      </Stage>

      <Stage from={21.6} to={27.9}>
        {(e) => (
          <Glass enter={e(21.6)} glow style={{ padding: "56px 56px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <Icon name="quote" size={70} />
              <Label size={40} color={dawn.gold}>我的看法</Label>
            </div>
            <div style={{ marginTop: 30, fontSize: 64, fontWeight: 800, lineHeight: 1.45, color: "#fff" }}>
              <span style={{ opacity: e(22.4) }}>重度用户最怕的不是贵，</span>
              <br />
              <span style={{ opacity: e(24.16), color: dawn.gold, textShadow: `0 0 30px ${dawn.gold}77` }}>是被打断。</span>
            </div>
            <div style={{ marginTop: 34, opacity: e(24.88), fontSize: 42, lineHeight: 1.5, color: dawn.text }}>
              去掉 5 小时限制，比加量更懂开发者。
            </div>
          </Glass>
        )}
      </Stage>
    </>
  );
};

// ── 片尾 ──
const Outro: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const t = useT();
  if (t < at) return null;
  const e = ease(frame, at, 24);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 260, background: `rgba(7,11,20,${0.55 * e})` }}>
      <div style={{ transform: `scale(${0.8 + e * 0.2})`, opacity: e, display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
        <DawnLogo size={200} />
        <div style={{ fontSize: 88, fontWeight: 800, letterSpacing: 10, color: "#fff" }}>{dawn.name}</div>
        <div style={{ fontSize: 26, letterSpacing: 12, color: dawn.muted }}>{dawn.en}</div>
        <div style={{ marginTop: 26, fontSize: 46, color: dawn.goldSoft, letterSpacing: 4 }}>{dawn.slogan}</div>
        <div style={{ marginTop: 40, padding: "16px 44px", borderRadius: 999, background: dawn.gold, color: dawn.bg, fontSize: 40, fontWeight: 800 }}>
          关注我 · 每天看懂 AI 的新变化
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const getFrontierDuration = (voiceDuration: number) => sec(LEAD + voiceDuration + TAIL);

export const Frontier: React.FC<FrontierProps> = ({ date, captions, voiceDuration, voice }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const end = LEAD + voiceDuration;
  // 配乐：开头淡入，说话时压低，片尾抬起再淡出
  const bgmVolume = (f: number) => {
    const s = f / FPS;
    const base = s < LEAD + 0.2 ? 0.3 : s < end + 0.2 ? 0.11 : 0.32;
    return base * interpolate(f, [0, 12, durationInFrames - 30, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  };
  const sfx = [1.84, 3.68, 7.92, 9.84, 14.24, 21.6];
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 90% 60% at 50% 85%, #2a1d0b 0%, ${dawn.navy} 45%, ${dawn.bg} 100%)`, fontFamily: dawn.font, color: dawn.text }}>
      <DawnScene />
      {/* 四周压暗，突出中间 */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
      <TopBar date={date} />
      <ClaudeStages />
      <Karaoke captions={captions} />
      {/* 来源：如实标注 */}
      <div style={{ position: "absolute", left: 64, right: 140, top: 1700, fontSize: 27, lineHeight: 1.5, color: "#cbd5e1", opacity: frame > sec(LEAD) && frame < sec(end) ? 0.8 : 0 }}>
        来源：Anthropic 官方公告（2026-10-30），Windows Report、Notebookcheck 等报道
      </div>
      <Outro at={voiceDuration + 0.3} />
      {/* 底部进度条 */}
      <div style={{ position: "absolute", left: 0, bottom: 0, height: 8, width: `${(frame / durationInFrames) * 100}%`, background: `linear-gradient(90deg, ${dawn.amber}, ${dawn.goldSoft})` }} />

      <Audio src={staticFile("frontier/bgm.mp3")} volume={bgmVolume} />
      <Sequence from={sec(LEAD)}>
        <Audio src={staticFile(voice)} />
      </Sequence>
      {sfx.map((s) => (
        <Sequence key={s} from={sec(LEAD + s) - 6} durationInFrames={30}>
          <Audio src={staticFile("frontier/whoosh.mp3")} volume={0.32} />
        </Sequence>
      ))}
      <Sequence from={sec(LEAD + 1.44)} durationInFrames={20}>
        <Audio src={staticFile("frontier/pop.mp3")} volume={0.5} />
      </Sequence>
      <Sequence from={sec(end + 0.3)} durationInFrames={60}>
        <Audio src={staticFile("frontier/chime.mp3")} volume={0.55} />
      </Sequence>
    </AbsoluteFill>
  );
};
