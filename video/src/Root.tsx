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
import { PREVIEW_DURATION, StylePreview } from "./frontier/v2/Preview";
import { FrontierSample, SAMPLE_DURATION } from "./frontier/v3/Sample";
import { MOTION_SAMPLE_DURATION, MotionSample } from "./frontier/motion/MotionSample";
import { FX3D_DURATION, Fx3D } from "./frontier/fx/Fx3D";
import { BROLL_SAMPLE_DURATION, BrollSample } from "./frontier/broll/BrollSample";
import { EPISODE_SECONDS, Episode20261101 } from "./frontier/broll/Episode";
import { Cover20261101 } from "./frontier/broll/Cover";
import { Auto, AutoCover, type AutoData } from "./frontier/auto/Auto";
import { EXPLAINER_DEMO, Explainer, ExplainerCover } from "./explainer/Explainer";
import { SHOTCRAFT_ORIGINALS } from "./showcase/shotcraft-originals";
import { SHOTS } from "./science";
import { MASCOT_INTRO_DURATION, MascotIntro } from "./science/three/MascotIntro";
import sampleAuto from "../public/frontier/2026-11-01/auto.json";
import { Frontier, FPS as FRONTIER_FPS, getFrontierDuration } from "./frontier/Frontier";
import { captions as frontier20261101, voiceDuration as frontier20261101Voice } from "./frontier/episodes/2026-11-01.captions";

// 每个组件都注册横屏和竖屏两个版本，方便在 Studio 里预览和单独导出
const variants = [
  { suffix: "", size: SIZES.landscape },
  { suffix: "-Vertical", size: SIZES.portrait },
] as const;

export const RemotionRoot: React.FC = () => (
  <>
    {/* 「AI 科普」横屏（默认 1 分钟）：数据由 tools/make_explainer.py 生成，渲染时 --props 传入；默认数据是一条短样片，方便在 Studio 里预览 */}
    {/* 「AI 科普」自己的镜头库（src/science/） */}
    <Folder name="Science">
      <Composition id="Sci3D-MascotIntro" component={MascotIntro} durationInFrames={MASCOT_INTRO_DURATION} fps={30} width={1920} height={1080} />
      {Object.entries(SHOTS).map(([type, s]) => (
        <Composition key={type} id={`Sci-${type}`} component={s.C} durationInFrames={s.meta.duration} fps={30} width={1920} height={1080} />
      ))}
    </Folder>
    {/* video-shotcraft 原版镜头（Apache-2.0，src/vendor/shotcraft/） */}
    <Folder name="Shotcraft">
      {SHOTCRAFT_ORIGINALS.map((s) => (
        <Composition key={s.id} id={s.id} component={s.component} durationInFrames={s.frames} fps={30} width={1920} height={1080} />
      ))}
    </Folder>
    <Folder name="Explainer">
      <Composition id="Explainer" component={Explainer} defaultProps={EXPLAINER_DEMO} calculateMetadata={({ props }) => ({ durationInFrames: Math.round(props.total * 30) })} durationInFrames={900} fps={30} width={1920} height={1080} />
      <Composition id="ExplainerCover" component={ExplainerCover} defaultProps={EXPLAINER_DEMO} durationInFrames={1} fps={30} width={1920} height={1080} />
    </Folder>
    {/* 「AI 前沿」竖屏短视频（向晓 AI），每期一个 */}
    <Folder name="Frontier">
      {/* v2 风格样图（静帧） */}
      {["hustle", "beast", "kinetic-01"].map((t) => (
        <Composition key={t} id={`Sample-${t}`} component={FrontierSample} durationInFrames={SAMPLE_DURATION} fps={30} width={1080} height={1920} defaultProps={{ theme: t }} />
      ))}
      {/* 通用成片：数据由 tools/make_episode.py 生成，渲染时 --props 传入；这里的默认数据是 2026-11-01 那期，方便在 Studio 里预览 */}
      <Composition id="Auto" component={Auto} defaultProps={sampleAuto as AutoData} calculateMetadata={({ props }) => ({ durationInFrames: Math.round(props.total * 30) })} durationInFrames={900} fps={30} width={1080} height={1920} />
      <Composition id="AutoCover" component={AutoCover} defaultProps={sampleAuto as AutoData} durationInFrames={1} fps={30} width={1080} height={1920} />
      <Composition id="Cover-2026-11-01" component={Cover20261101} durationInFrames={1} fps={30} width={1080} height={1920} />
      <Composition id="Episode-2026-11-01" component={Episode20261101} durationInFrames={Math.round(EPISODE_SECONDS * 30)} fps={30} width={1080} height={1920} />
      <Composition id="Broll-Sample" component={BrollSample} durationInFrames={BROLL_SAMPLE_DURATION} fps={30} width={1080} height={1920} />
      <Composition id="Fx3D-Sample" component={Fx3D} durationInFrames={FX3D_DURATION} fps={30} width={1080} height={1920} />
      <Composition id="Motion-Sample" component={MotionSample} durationInFrames={MOTION_SAMPLE_DURATION} fps={30} width={1080} height={1920} />
      <Composition id="Style-Preview" component={StylePreview} durationInFrames={PREVIEW_DURATION} fps={30} width={1080} height={1920} />
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
