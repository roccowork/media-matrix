import React from "react";
import { AbsoluteFill, Series } from "remotion";
import {
  BrandIntro,
  BrandOutro,
  Captions,
  CodeReveal,
  getCodeRevealDuration,
  getTerminalDuration,
  ServerRack3D,
  Terminal,
  TitleCard,
} from "../components";
import { alertBotCode, alertBotTerminal, demoCues } from "./demoData";

export const DURATIONS = {
  intro: 90,
  rack: 150,
  title: 60,
  code: getCodeRevealDuration(alertBotCode),
  terminal: getTerminalDuration(alertBotTerminal),
  outro: 150,
};

export const EPISODE_DEMO_DURATION = Object.values(DURATIONS).reduce((a, b) => a + b, 0);

// 示例：把所有组件串成一期视频的动画部分
export const EpisodeDemo: React.FC = () => (
  <AbsoluteFill>
    <Series>
      <Series.Sequence durationInFrames={DURATIONS.intro}>
        <BrandIntro episode="第 02 期" title="30 分钟用 AI 写一个服务器告警机器人" />
      </Series.Sequence>
      <Series.Sequence durationInFrames={DURATIONS.rack}>
        <ServerRack3D alertAt={30} />
        <Captions cues={demoCues} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={DURATIONS.title}>
        <TitleCard kicker="Step 1" title="让 AI 写巡检脚本" subtitle="Python + psutil，不到 20 行" />
      </Series.Sequence>
      <Series.Sequence durationInFrames={DURATIONS.code}>
        <CodeReveal {...alertBotCode} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={DURATIONS.terminal}>
        <Terminal {...alertBotTerminal} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={DURATIONS.outro}>
        <BrandOutro repo="公众号「AI替我上班」回复「告警」领取" nextTitle="让 AI 读懂 Nginx 日志，自动找出异常 IP" />
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
);
