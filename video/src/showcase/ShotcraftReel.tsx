// video-shotcraft 镜头样片：从镜头库（Apache-2.0，src/vendor/shotcraft/）挑出的高能镜头原样串起来，
// 左下角标编号、中文名和镜头卡名，方便挑选。镜头本身一帧没改。
import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { TrailerBumper, TRAILER_BUMPER_DURATION } from "../vendor/shotcraft/rhythm/trailer-grammar-moves/TrailerBumper";
import { Fracture, FRACTURE_DURATION } from "../vendor/shotcraft/opening/fracture/Fracture";
import { MagicianCardFlourish, MAGICIAN_CARD_FLOURISH_DURATION } from "../vendor/shotcraft/opening/magician-card-flourish/MagicianCardFlourish";
import { FlyingWords, FLYING_WORDS_DURATION } from "../vendor/shotcraft/typography/flying-words/FlyingWords";
import { DatavizLandscapeOpen, DATAVIZ_LANDSCAPE_OPEN_DURATION } from "../vendor/shotcraft/opening/dataviz-landscape-open/DatavizLandscapeOpen";
import { ExplodedView, EXPLODED_VIEW_DURATION } from "../vendor/shotcraft/camera/space-camera-moves/ExplodedView";
import { DroneDiveLanding, DRONE_DIVE_LANDING_DURATION } from "../vendor/shotcraft/camera/space-camera-moves/DroneDiveLanding";
import { BulletTimeFreezeOrbit, BULLET_TIME_FREEZE_ORBIT_DURATION } from "../vendor/shotcraft/camera/tension-camera-moves/BulletTimeFreezeOrbit";
import { CardFlockTumble, CARD_FLOCK_TUMBLE_DURATION } from "../vendor/shotcraft/transition/card-flock-tumble/CardFlockTumble";
import { GradientWordSweep, GRADIENT_WORD_SWEEP_DURATION } from "../vendor/shotcraft/typography/gradient-word-sweep/GradientWordSweep";
import { OrbFlylineRelay, ORB_FLYLINE_RELAY_DURATION } from "../vendor/shotcraft/effects/glow-flyline-moves/OrbFlylineRelay";
import { ImpactBurstKit, IMPACT_BURST_KIT_DURATION } from "../vendor/shotcraft/effects/slam-entrance-moves/ImpactBurstKit";
import { KanadaPerspectiveSnap, KANADA_PERSPECTIVE_SNAP_DURATION } from "../vendor/shotcraft/effects/slam-entrance-moves/KanadaPerspectiveSnap";
import { ReticleLockOn, RETICLE_LOCK_ON_DURATION } from "../vendor/shotcraft/effects/fui-hud-moves/ReticleLockOn";
import { IntegrationHubMap, INTEGRATION_HUB_MAP_DURATION } from "../vendor/shotcraft/ui-entrance/integration-hub-map/IntegrationHubMap";
import { Carousel3D, CAROUSEL_3D_DURATION } from "../vendor/shotcraft/ui-entrance/carousel-3d/Carousel3D";
import { NeonFrameForerunOrbit, NEON_FRAME_FORERUN_ORBIT_DURATION } from "../vendor/shotcraft/ui-entrance/neon-frame-orbit-drop/NeonFrameForerunOrbit";
import { Basic3DScene, BASIC_3D_SCENE_DURATION } from "../vendor/shotcraft/camera/basic-3d-scene/Basic3DScene";
import { Terminal3D, TERMINAL_3D_DURATION } from "../vendor/shotcraft/camera/terminal-3d/Terminal3D";
import { UnitDotSwarmRegroupV2, UNIT_DOT_SWARM_REGROUP_V2_DURATION } from "../vendor/shotcraft/data/chart-live-moves/UnitDotSwarmRegroupV2";
import { NeedleSweepSelftest, NEEDLE_SWEEP_SELFTEST_DURATION } from "../vendor/shotcraft/data/gauge-readout-moves/NeedleSweepSelftest";
import { TimelineTravel, TIMELINE_TRAVEL_DURATION } from "../vendor/shotcraft/data/timeline-travel/TimelineTravel";
import { RadialWave, RADIAL_WAVE_DURATION } from "../vendor/shotcraft/ui-entrance/radial-wave/RadialWave";
import { GlitchDisplace, GLITCH_DISPLACE_DURATION } from "../vendor/shotcraft/transition/tear-streak-transitions/GlitchDisplace";
import { LetterformZoom, LETTERFORM_ZOOM_DURATION } from "../vendor/shotcraft/transition/transition-travel/LetterformZoom";
import { BlindsSlice, BLINDS_SLICE_DURATION } from "../vendor/shotcraft/transition/wipe-transitions/BlindsSlice";
import { CircleMatchIris, CIRCLE_MATCH_IRIS_DURATION } from "../vendor/shotcraft/transition/circle-match-iris/CircleMatchIris";
import { OutlineWordFill, OUTLINE_WORD_FILL_DURATION } from "../vendor/shotcraft/typography/outline-word-fill/OutlineWordFill";
import { TextAsMask, TEXT_AS_MASK_DURATION } from "../vendor/shotcraft/opening/text-as-mask/TextAsMask";
import { GrainDissolve, GRAIN_DISSOLVE_DURATION } from "../vendor/shotcraft/outro/grain-dissolve/GrainDissolve";
import { NeonTripleMarquee, NEON_TRIPLE_MARQUEE_DURATION } from "../vendor/shotcraft/outro/neon-triple-marquee/NeonTripleMarquee";
import { OutroGroupPhotoLaunch, OUTRO_GROUP_PHOTO_LAUNCH_DURATION } from "../vendor/shotcraft/outro/outro-group-photo-launch/OutroGroupPhotoLaunch";

export const REEL: { C: React.FC; frames: number; name: string; card: string }[] = [
  { C: TrailerBumper, frames: TRAILER_BUMPER_DURATION, name: "预告片速剪钩子", card: "trailer-grammar-moves" },
  { C: Fracture, frames: FRACTURE_DURATION, name: "碎片聚合开场", card: "fracture" },
  { C: MagicianCardFlourish, frames: MAGICIAN_CARD_FLOURISH_DURATION, name: "星芒闪现 · 卡片飞出", card: "magician-card-flourish" },
  { C: FlyingWords, frames: FLYING_WORDS_DURATION, name: "关键词穿梭", card: "flying-words" },
  { C: DatavizLandscapeOpen, frames: DATAVIZ_LANDSCAPE_OPEN_DURATION, name: "数据流线地景", card: "dataviz-landscape-open" },
  { C: ExplodedView, frames: EXPLODED_VIEW_DURATION, name: "爆炸分解视图", card: "space-camera-moves" },
  { C: DroneDiveLanding, frames: DRONE_DIVE_LANDING_DURATION, name: "无人机俯冲降落", card: "space-camera-moves" },
  { C: BulletTimeFreezeOrbit, frames: BULLET_TIME_FREEZE_ORBIT_DURATION, name: "子弹时间环绕", card: "tension-camera-moves" },
  { C: CardFlockTumble, frames: CARD_FLOCK_TUMBLE_DURATION, name: "卡片翻飞 · 烟环爆散", card: "card-flock-tumble" },
  { C: GradientWordSweep, frames: GRADIENT_WORD_SWEEP_DURATION, name: "关键词彩光充能", card: "gradient-word-sweep" },
  { C: OrbFlylineRelay, frames: ORB_FLYLINE_RELAY_DURATION, name: "光球飞线接力", card: "glow-flyline-moves" },
  { C: ImpactBurstKit, frames: IMPACT_BURST_KIT_DURATION, name: "冲击砸入", card: "slam-entrance-moves" },
  { C: KanadaPerspectiveSnap, frames: KANADA_PERSPECTIVE_SNAP_DURATION, name: "金田透视急停", card: "slam-entrance-moves" },
  { C: ReticleLockOn, frames: RETICLE_LOCK_ON_DURATION, name: "HUD 准星锁定", card: "fui-hud-moves" },
  { C: IntegrationHubMap, frames: INTEGRATION_HUB_MAP_DURATION, name: "中枢连线 · 光管脉冲", card: "integration-hub-map" },
  { C: Carousel3D, frames: CAROUSEL_3D_DURATION, name: "3D 圆环轮播", card: "carousel-3d" },
  { C: NeonFrameForerunOrbit, frames: NEON_FRAME_FORERUN_ORBIT_DURATION, name: "霓虹框 · 环绕落版", card: "neon-frame-orbit-drop" },
  { C: Basic3DScene, frames: BASIC_3D_SCENE_DURATION, name: "3D 空间飞行演示", card: "basic-3d-scene" },
  { C: Terminal3D, frames: TERMINAL_3D_DURATION, name: "3D 终端飞行", card: "terminal-3d" },
  { C: UnitDotSwarmRegroupV2, frames: UNIT_DOT_SWARM_REGROUP_V2_DURATION, name: "点阵集群重组", card: "chart-live-moves" },
  { C: NeedleSweepSelftest, frames: NEEDLE_SWEEP_SELFTEST_DURATION, name: "仪表扫针", card: "gauge-readout-moves" },
  { C: TimelineTravel, frames: TIMELINE_TRAVEL_DURATION, name: "时间轴穿行", card: "timeline-travel" },
  { C: RadialWave, frames: RADIAL_WAVE_DURATION, name: "点阵波纹", card: "radial-wave" },
  { C: GlitchDisplace, frames: GLITCH_DISPLACE_DURATION, name: "故障撕裂转场", card: "tear-streak-transitions" },
  { C: LetterformZoom, frames: LETTERFORM_ZOOM_DURATION, name: "钻进字形转场", card: "transition-travel" },
  { C: BlindsSlice, frames: BLINDS_SLICE_DURATION, name: "3D 百叶窗转场", card: "wipe-transitions" },
  { C: CircleMatchIris, frames: CIRCLE_MATCH_IRIS_DURATION, name: "圆心光圈切", card: "circle-match-iris" },
  { C: OutlineWordFill, frames: OUTLINE_WORD_FILL_DURATION, name: "空心字收缩填色", card: "outline-word-fill" },
  { C: TextAsMask, frames: TEXT_AS_MASK_DURATION, name: "文字遮罩冲入", card: "text-as-mask" },
  { C: GrainDissolve, frames: GRAIN_DISSOLVE_DURATION, name: "颗粒爆散凝聚", card: "grain-dissolve" },
  { C: NeonTripleMarquee, frames: NEON_TRIPLE_MARQUEE_DURATION, name: "霓虹跑马灯", card: "neon-triple-marquee" },
  { C: OutroGroupPhotoLaunch, frames: OUTRO_GROUP_PHOTO_LAUNCH_DURATION, name: "全员合影 · 发布会收场", card: "outro-group-photo-launch" },
];
export const REEL_DURATION = REEL.reduce((a, s) => a + s.frames, 0);

const Label: React.FC<{ n: number; name: string; card: string }> = ({ n, name, card }) => (
  <div style={{ position: "absolute", left: 28, bottom: 24, display: "flex", alignItems: "center", gap: 14, padding: "8px 18px", borderRadius: 10, background: "rgba(0,0,0,0.55)", color: "#fff", fontFamily: '"Noto Sans SC", "WenQuanYi Zen Hei", sans-serif' }}>
    <span style={{ fontSize: 34, fontWeight: 900, color: "#f5b83d" }}>{String(n).padStart(2, "0")}</span>
    <span style={{ fontSize: 28, fontWeight: 700 }}>{name}</span>
    <span style={{ fontSize: 20, opacity: 0.6, fontFamily: "monospace" }}>{card}</span>
  </div>
);

export const ShotcraftReel: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <Series>
      {REEL.map(({ C, frames, name, card }, i) => (
        <Series.Sequence key={i} durationInFrames={frames}>
          <C />
          <Label n={i + 1} name={name} card={card} />
        </Series.Sequence>
      ))}
    </Series>
  </AbsoluteFill>
);
