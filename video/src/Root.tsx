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
import { STYLES } from "./styleboard/StyleBoard";
import { BlackHole, BLACKHOLE_SHOT } from "./shots/blackhole/BlackHole";
import { NeuralActivation, NEURAL_SHOT } from "./shots/neural/NeuralActivation";
import { AIChip, CHIP_SHOT } from "./shots/chip/AIChip";
import { Nebula, NEBULA_SHOT } from "./shots/nebula/Nebula";
import { Planet, PLANET_SHOT } from "./shots/planet/Planet";
import { DataStream, DATASTREAM_SHOT } from "./shots/datastream/DataStream";
import { Galaxy, GALAXY_SHOT } from "./shots/galaxy/Galaxy";
import { MilkyWay, MILKYWAY_SHOT } from "./shots/milkyway/MilkyWay";
import { Star, STAR_SHOT } from "./shots/star/Star";
import { Dna, DNA_SHOT } from "./shots/dna/Dna";
import { Hud, HUD_SHOT } from "./shots/hud/Hud";
import { Virus, VIRUS_SHOT } from "./shots/virus/Virus";
import { Cell, CELL_SHOT } from "./shots/cell/Cell";
import { Eye, EYE_SHOT } from "./shots/eye/Eye";
import { Retina, RETINA_SHOT } from "./shots/retina/Retina";
import { BloodFlow, BLOODFLOW_SHOT } from "./shots/bloodflow/BloodFlow";
import { Lightning, LIGHTNING_SHOT } from "./shots/lightning/Lightning";
import { FieldLines, FIELDLINES_SHOT } from "./shots/fieldlines/FieldLines";
import { EnergyField, ENERGYFIELD_SHOT } from "./shots/energyfield/EnergyField";
import { BlenderHeart, HEART_SHOT } from "./shots/heart/BlenderHeart";
import { BlenderSkeleton, SKELETON_SHOT } from "./shots/skeleton/BlenderSkeleton";
import { BlenderVessels, VESSELS_SHOT } from "./shots/vessels/BlenderVessels";
import { SBShotView, StoryboardView, type StoryboardData } from "./shots/storyboard/Storyboard";
import demoStoryboard from "../storyboards/2026-11-03-heart-circulation/storyboard.json";
import ai100Storyboard from "../storyboards/2026-11-03-ai-100-years/storyboard.json";
import { ScienceDemo as GrokDemo } from "./grok3d/scenes/ScienceDemo";
import { AttentionTest as GrokAttention } from "./grok3d/scenes/AttentionTest";
import { ATTENTION10_DURATION, Attention10s } from "./grok3d/scenes/Attention10s";
import { CatPhoto } from "./grok3d/scenes/CatPhoto";
import { FUTURE100_DURATION, Future100 } from "./grok3d/scenes/Future100";
import { SEE_IMAGE_DURATION, SeeImage10s } from "./grok3d/scenes/SeeImage10s";
import { MASCOT_INTRO_DURATION, MascotIntro } from "./science/three/MascotIntro";
import { ATTENTION_SPACE_DURATION, AttentionSpace } from "./science/three/AttentionSpace";
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
      <Composition id="Sci3D-AttentionSpace" component={AttentionSpace} durationInFrames={ATTENTION_SPACE_DURATION} fps={30} width={1920} height={1080} />
      <Composition id="Sci3D-MascotIntro" component={MascotIntro} durationInFrames={MASCOT_INTRO_DURATION} fps={30} width={1920} height={1080} />
      {Object.entries(SHOTS).map(([type, s]) => (
        <Composition key={type} id={`Sci-${type}`} component={s.C} durationInFrames={s.meta.duration} fps={30} width={1920} height={1080} />
      ))}
    </Folder>
    {/* 视频引擎第一阶段：验收镜头 */}
    <Folder name="Shots">
      <Composition id="Asset-Star" component={Star} durationInFrames={STAR_SHOT.duration * STAR_SHOT.fps} fps={STAR_SHOT.fps} width={1920} height={1080} />
      <Composition id="Asset-Galaxy" component={Galaxy} durationInFrames={GALAXY_SHOT.duration * GALAXY_SHOT.fps} fps={GALAXY_SHOT.fps} width={1920} height={1080} />
      <Composition id="Asset-MilkyWay" component={MilkyWay} durationInFrames={MILKYWAY_SHOT.duration * MILKYWAY_SHOT.fps} fps={MILKYWAY_SHOT.fps} width={1920} height={1080} />
      <Composition id="Asset-DataStream" component={DataStream} durationInFrames={DATASTREAM_SHOT.duration * DATASTREAM_SHOT.fps} fps={DATASTREAM_SHOT.fps} width={1920} height={1080} />
      <Composition id="Asset-HUD" component={Hud} durationInFrames={HUD_SHOT.duration * HUD_SHOT.fps} fps={HUD_SHOT.fps} width={1920} height={1080} />
      <Composition id="Asset-Virus" component={Virus} durationInFrames={VIRUS_SHOT.duration * VIRUS_SHOT.fps} fps={VIRUS_SHOT.fps} width={1920} height={1080} />
      <Composition id="Asset-Cell" component={Cell} durationInFrames={CELL_SHOT.duration * CELL_SHOT.fps} fps={CELL_SHOT.fps} width={1920} height={1080} />
      <Composition id="Asset-Eye" component={Eye} durationInFrames={EYE_SHOT.duration * EYE_SHOT.fps} fps={EYE_SHOT.fps} width={1920} height={1080} />
      <Composition id="Asset-Retina" component={Retina} durationInFrames={RETINA_SHOT.duration * RETINA_SHOT.fps} fps={RETINA_SHOT.fps} width={1920} height={1080} />
      <Composition id="Asset-BloodFlow" component={BloodFlow} durationInFrames={BLOODFLOW_SHOT.duration * BLOODFLOW_SHOT.fps} fps={BLOODFLOW_SHOT.fps} width={1920} height={1080} />
      <Composition id="Asset-Lightning" component={Lightning} durationInFrames={LIGHTNING_SHOT.duration * LIGHTNING_SHOT.fps} fps={LIGHTNING_SHOT.fps} width={1920} height={1080} />
      <Composition id="Asset-FieldLines" component={FieldLines} durationInFrames={FIELDLINES_SHOT.duration * FIELDLINES_SHOT.fps} fps={FIELDLINES_SHOT.fps} width={1920} height={1080} />
      <Composition id="Asset-EnergyField" component={EnergyField} durationInFrames={ENERGYFIELD_SHOT.duration * ENERGYFIELD_SHOT.fps} fps={ENERGYFIELD_SHOT.fps} width={1920} height={1080} />
      <Composition id="Blender-Heart" component={BlenderHeart} durationInFrames={HEART_SHOT.duration * HEART_SHOT.fps} fps={HEART_SHOT.fps} width={1920} height={1080} />
      <Composition id="Blender-Skeleton" component={BlenderSkeleton} durationInFrames={SKELETON_SHOT.duration * SKELETON_SHOT.fps} fps={SKELETON_SHOT.fps} width={1920} height={1080} />
      <Composition id="Blender-Vessels" component={BlenderVessels} durationInFrames={VESSELS_SHOT.duration * VESSELS_SHOT.fps} fps={VESSELS_SHOT.fps} width={1920} height={1080} />
      {/* AI 分镜：单镜（单镜重渲染）/ 整条（inputProps 传分镜；默认用手写示例） */}
      <Composition id="SB-Shot" component={SBShotView} defaultProps={{config: (demoStoryboard as unknown as StoryboardData).shots[0].config, annotate: false}} calculateMetadata={({ props }) => ({ durationInFrames: Math.round(props.config.duration * props.config.fps), fps: props.config.fps })} durationInFrames={180} fps={30} width={1920} height={1080} />
      {/* 《一百年后的 AI》第三版整条（无标注；preview.yml 渲染用） */}
      <Composition id="AI100" component={StoryboardView} defaultProps={{storyboard: ai100Storyboard as unknown as StoryboardData, annotate: false}} calculateMetadata={({ props }) => ({ durationInFrames: props.storyboard.shots.reduce((a, s) => a + Math.round(s.config.duration * props.storyboard.fps), 0), fps: props.storyboard.fps })} durationInFrames={1950} fps={30} width={1920} height={1080} />
      <Composition id="Storyboard" component={StoryboardView} defaultProps={{storyboard: demoStoryboard as unknown as StoryboardData, annotate: true}} calculateMetadata={({ props }) => ({ durationInFrames: props.storyboard.shots.reduce((a, s) => a + Math.round(s.config.duration * props.storyboard.fps), 0), fps: props.storyboard.fps })} durationInFrames={1800} fps={30} width={1920} height={1080} />
      <Composition id="Asset-DNA" component={Dna} durationInFrames={DNA_SHOT.duration * DNA_SHOT.fps} fps={DNA_SHOT.fps} width={1920} height={1080} />
      <Composition id="Asset-Planet" component={Planet} durationInFrames={PLANET_SHOT.duration * PLANET_SHOT.fps} fps={PLANET_SHOT.fps} width={1920} height={1080} />
      <Composition id="Asset-Nebula" component={Nebula} durationInFrames={NEBULA_SHOT.duration * NEBULA_SHOT.fps} fps={NEBULA_SHOT.fps} width={1920} height={1080} />
      <Composition id="Shot-AIChip" component={AIChip} durationInFrames={CHIP_SHOT.duration * CHIP_SHOT.fps} fps={CHIP_SHOT.fps} width={1920} height={1080} />
      <Composition id="Shot-Neural" component={NeuralActivation} durationInFrames={NEURAL_SHOT.duration * NEURAL_SHOT.fps} fps={NEURAL_SHOT.fps} width={1920} height={1080} />
      <Composition id="Shot-BlackHole" component={BlackHole} durationInFrames={BLACKHOLE_SHOT.duration * BLACKHOLE_SHOT.fps} fps={BLACKHOLE_SHOT.fps} width={1920} height={1080} />
    </Folder>
    {/* 画面风格样张（静态单帧） */}
    <Folder name="StyleBoard">
      {STYLES.map((s) => (
        <Composition key={s.id} id={s.id} component={s.C} durationInFrames={1} fps={30} width={1920} height={1080} />
      ))}
    </Folder>
    {/* 试验：Grok 做的 3D 骨架（science-3d-skeleton） */}
    <Folder name="Grok3D">
      <Composition id="Grok-Demo" component={GrokDemo} durationInFrames={180} fps={30} width={1920} height={1080} />
      <Composition id="Grok-SeeImage10s" component={SeeImage10s} durationInFrames={SEE_IMAGE_DURATION} fps={30} width={1920} height={1080} />
      <Composition id="Grok-SeeImage10s-Film" component={SeeImage10s} defaultProps={{ look: "film" as const }} durationInFrames={SEE_IMAGE_DURATION} fps={30} width={1920} height={1080} />
      <Composition id="Grok-Future100" component={Future100} durationInFrames={FUTURE100_DURATION} fps={30} width={1920} height={1080} />
      <Composition id="Grok-CatPhoto" component={CatPhoto} durationInFrames={1} fps={30} width={800} height={600} />
      <Composition id="Grok-Attention10s" component={Attention10s} durationInFrames={ATTENTION10_DURATION} fps={30} width={1920} height={1080} />
      <Composition id="Grok-Attention" component={GrokAttention} durationInFrames={180} fps={30} width={1920} height={1080} />
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
