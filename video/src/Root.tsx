import React from "react";
import { Composition, Folder } from "remotion";
import {
  BrandIntro,
  BrandOutro,
  CodeReveal,
  getCodeRevealDuration,
  getTerminalDuration,
  ServerRack3D,
  Terminal,
  TitleCard,
} from "./components";
import { alertBotCode, alertBotTerminal } from "./compositions/demoData";
import { EPISODE_DEMO_DURATION, EpisodeDemo } from "./compositions/EpisodeDemo";
import { FPS, SIZES } from "./brand";
import { KB_SCENES, KB_SHORT_DURATION, KbShort } from "./compositions/KnowledgeBase";
import { StyleInfo, StyleQuote, StyleTitle } from "./frontier/v2/Style";
import { Frontier, FPS as FRONTIER_FPS, getFrontierDuration } from "./frontier/Frontier";
import { captions as frontier20261101, voiceDuration as frontier20261101Voice } from "./frontier/episodes/2026-11-01.captions";

// 每个组件都注册横屏和竖屏两个版本，方便在 Studio 里预览和单独导出
const variants = [
  { suffix: "", size: SIZES.landscape },
  { suffix: "-Vertical", size: SIZES.portrait },
] as const;

export const RemotionRoot: React.FC = () => (
  <>
    {/* 「AI 前沿」竖屏短视频（向晓 AI），每期一个 */}
    <Folder name="Frontier">
      {/* v2 风格样图（静帧） */}
      <Composition id="Style-Title" component={StyleTitle} durationInFrames={1} fps={30} width={1080} height={1920} />
      <Composition id="Style-Info" component={StyleInfo} durationInFrames={1} fps={30} width={1080} height={1920} />
      <Composition id="Style-Quote" component={StyleQuote} durationInFrames={1} fps={30} width={1080} height={1920} />
      <Composition
        id="Frontier-2026-11-01"
        component={Frontier}
        durationInFrames={getFrontierDuration(frontier20261101Voice)}
        fps={FRONTIER_FPS}
        width={1080}
        height={1920}
        defaultProps={{ date: "2026.11.01", captions: frontier20261101, voiceDuration: frontier20261101Voice, voice: "frontier/2026-11-01/voice.mp3" }}
      />
    </Folder>
    {variants.map(({ suffix, size }) => (
      <Folder key={suffix || "landscape"} name={suffix ? "Vertical" : "Landscape"}>
        <Composition
          id={`EpisodeDemo${suffix}`}
          component={EpisodeDemo}
          durationInFrames={EPISODE_DEMO_DURATION}
          fps={FPS}
          {...size}
        />
        <Composition
          id={`BrandIntro${suffix}`}
          component={BrandIntro}
          durationInFrames={90}
          fps={FPS}
          {...size}
          defaultProps={{ episode: "第 01 期", title: "推送代码就自动上线：我的个人平台是怎么搭的" }}
        />
        <Composition
          id={`BrandOutro${suffix}`}
          component={BrandOutro}
          durationInFrames={150}
          fps={FPS}
          {...size}
          defaultProps={{ repo: "公众号「AI替我上班」回复「上线」领取", nextTitle: "出问题企业微信立刻响，每周一自动收到运维周报" }}
        />
        <Composition
          id={`TitleCard${suffix}`}
          component={TitleCard}
          durationInFrames={60}
          fps={FPS}
          {...size}
          defaultProps={{ kicker: "Step 1", title: "让 AI 写巡检脚本", subtitle: "Python + psutil，不到 20 行" }}
        />
        <Composition
          id={`CodeReveal${suffix}`}
          component={CodeReveal}
          durationInFrames={getCodeRevealDuration(alertBotCode)}
          fps={FPS}
          {...size}
          defaultProps={alertBotCode}
          calculateMetadata={({ props }) => ({ durationInFrames: getCodeRevealDuration(props) })}
        />
        <Composition
          id={`Terminal${suffix}`}
          component={Terminal}
          durationInFrames={getTerminalDuration(alertBotTerminal)}
          fps={FPS}
          {...size}
          defaultProps={alertBotTerminal}
          calculateMetadata={({ props }) => ({ durationInFrames: getTerminalDuration(props) })}
        />
        <Composition
          id={`ServerRack3D${suffix}`}
          component={ServerRack3D}
          durationInFrames={150}
          fps={FPS}
          {...size}
          defaultProps={{ racks: suffix ? 3 : 5, alertRack: suffix ? 1 : 2, alertAt: 45, label: "CPU 100% · web-03" }}
        />
      </Folder>
    ))}
    <Folder name="Ep-KnowledgeBase">
      {KB_SCENES.map((sc) => (
        <Composition key={sc.id} id={sc.id} component={sc.component} durationInFrames={sc.duration} fps={FPS} {...SIZES.landscape} />
      ))}
      <Composition id="KB-Short" component={KbShort} durationInFrames={KB_SHORT_DURATION} fps={FPS} {...SIZES.portrait} />
    </Folder>
  </>
);
