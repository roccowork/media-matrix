// 「AI 前沿」单期封面（1080×1920）。抖音主页网格会裁成 3:4（只看中间 1080×1440），所以文字都放在中间这块安全区里。
import React from "react";
import { AbsoluteFill } from "remotion";
import { Header, v2 } from "../v2/Style";
import { Broll } from "./BrollSample";

export const Cover20261101: React.FC = () => (
  <AbsoluteFill style={{ fontFamily: v2.font, color: v2.white, background: "#000" }}>
    <Broll src="broll/hourglass.mp4" push={[1.12, 1.12]} temperature={-0.1} />
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.65) 75%)" }} />
    <Header date="2026.11.01" />
    <div style={{ position: "absolute", left: 80, right: 80, top: 360, textShadow: "0 6px 40px rgba(0,0,0,0.8)" }}>
      <div style={{ display: "inline-block", fontSize: 40, fontWeight: 800, letterSpacing: 6, color: v2.bg0, background: v2.gold, padding: "10px 30px", borderRadius: 40 }}>AI 前沿 · 11.01</div>
      <div style={{ marginTop: 50, fontSize: 170, fontWeight: 900, lineHeight: 1.05, letterSpacing: -2 }}>Claude</div>
      <div style={{ fontSize: 170, fontWeight: 900, lineHeight: 1.15, letterSpacing: -2 }}>
        <span style={{ background: v2.gold, color: v2.bg0, padding: "0 16px", borderRadius: 14, textShadow: "none" }}>5 小时</span>限制
      </div>
      <div style={{ marginTop: 40, display: "inline-block", fontSize: 250, fontWeight: 900, color: "#fff", background: "#ef4444", padding: "0 50px", borderRadius: 36, rotate: "-5deg", boxShadow: "0 30px 90px rgba(239,68,68,0.55)", textShadow: "none" }}>没了！</div>
      <div style={{ marginTop: 70, fontSize: 50, fontWeight: 700, lineHeight: 1.5, color: "rgba(255,255,255,0.92)" }}>
        $200 顶配改名 Ultra
        <br />
        <span style={{ color: v2.gold }}>但每周上限还在</span>
      </div>
    </div>
  </AbsoluteFill>
);
