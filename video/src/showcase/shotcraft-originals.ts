// video-shotcraft 镜头库全部原版镜头（未改动，Apache-2.0，src/vendor/shotcraft/），在 Studio 的 Shotcraft 文件夹里逐个预览
import type React from "react";
import { Basic3DScene, BASIC_3D_SCENE_DURATION } from "../vendor/shotcraft/camera/basic-3d-scene/Basic3DScene";
import { CursorFlyover, CURSOR_FLYOVER_DURATION } from "../vendor/shotcraft/camera/cursor-flyover/CursorFlyover";
import { GrazeFaceTour, GRAZE_FACE_TOUR_DURATION } from "../vendor/shotcraft/camera/graze-face-tour/GrazeFaceTour";
import { OverheadTabletopDrop, OVERHEAD_TABLETOP_DROP_DURATION } from "../vendor/shotcraft/camera/overhead-camera-moves/OverheadTabletopDrop";
import { TiltReveal, TILT_REVEAL_DURATION } from "../vendor/shotcraft/camera/overhead-camera-moves/TiltReveal";
import { DroneDiveLanding, DRONE_DIVE_LANDING_DURATION } from "../vendor/shotcraft/camera/space-camera-moves/DroneDiveLanding";
import { ExplodedView, EXPLODED_VIEW_DURATION } from "../vendor/shotcraft/camera/space-camera-moves/ExplodedView";
import { SteepTiltGlide, STEEP_TILT_GLIDE_DURATION } from "../vendor/shotcraft/camera/steep-tilt-glide/SteepTiltGlide";
import { BulletTimeFreezeOrbit, BULLET_TIME_FREEZE_ORBIT_DURATION } from "../vendor/shotcraft/camera/tension-camera-moves/BulletTimeFreezeOrbit";
import { PullBackIsolation, PULL_BACK_ISOLATION_DURATION } from "../vendor/shotcraft/camera/tension-camera-moves/PullBackIsolation";
import { Terminal3D, TERMINAL_3D_DURATION } from "../vendor/shotcraft/camera/terminal-3d/Terminal3D";
import { BeforeAfterSliderScrub, BEFORE_AFTER_SLIDER_SCRUB_DURATION } from "../vendor/shotcraft/data/before-after-slider-scrub/BeforeAfterSliderScrub";
import { AxisRescaleShockV2, AXIS_RESCALE_SHOCK_V2_DURATION } from "../vendor/shotcraft/data/chart-live-moves/AxisRescaleShockV2";
import { OscilloscopeStreamV2, OSCILLOSCOPE_STREAM_V2_DURATION } from "../vendor/shotcraft/data/chart-live-moves/OscilloscopeStreamV2";
import { UnitDotSwarmRegroupV2, UNIT_DOT_SWARM_REGROUP_V2_DURATION } from "../vendor/shotcraft/data/chart-live-moves/UnitDotSwarmRegroupV2";
import { NeedleSweepSelftest, NEEDLE_SWEEP_SELFTEST_DURATION } from "../vendor/shotcraft/data/gauge-readout-moves/NeedleSweepSelftest";
import { TapeScrollFixedPointer, TAPE_SCROLL_FIXED_POINTER_DURATION } from "../vendor/shotcraft/data/gauge-readout-moves/TapeScrollFixedPointer";
import { BrakeReticleLock, BRAKE_RETICLE_LOCK_DURATION } from "../vendor/shotcraft/data/scroll-brake-moves/BrakeReticleLock";
import { ChangelogScrollBrake, CHANGELOG_SCROLL_BRAKE_DURATION } from "../vendor/shotcraft/data/scroll-brake-moves/ChangelogScrollBrake";
import { TimelineTravel, TIMELINE_TRAVEL_DURATION } from "../vendor/shotcraft/data/timeline-travel/TimelineTravel";
import { AssembleThenTypeFlyin, ASSEMBLE_THEN_TYPE_FLYIN_DURATION } from "../vendor/shotcraft/effects/assemble-then-type-flyin/AssembleThenTypeFlyin";
import { AuroraBloomBgFlip, AURORA_BLOOM_BG_FLIP_DURATION } from "../vendor/shotcraft/effects/aurora-bloom-bg-flip/AuroraBloomBgFlip";
import { BrandFrameSnap, BRAND_FRAME_SNAP_DURATION } from "../vendor/shotcraft/effects/brand-frame-snap/BrandFrameSnap";
import { ReticleLockOn, RETICLE_LOCK_ON_DURATION } from "../vendor/shotcraft/effects/fui-hud-moves/ReticleLockOn";
import { FlylineArc, FLYLINE_ARC_DURATION } from "../vendor/shotcraft/effects/glow-flyline-moves/FlylineArc";
import { GlowOrbAmbient, GLOW_ORB_AMBIENT_DURATION } from "../vendor/shotcraft/effects/glow-flyline-moves/GlowOrbAmbient";
import { OrbFlylineRelay, ORB_FLYLINE_RELAY_DURATION } from "../vendor/shotcraft/effects/glow-flyline-moves/OrbFlylineRelay";
import { AttentionBounce, ATTENTION_BOUNCE_DURATION } from "../vendor/shotcraft/effects/icon-performance-moves/AttentionBounce";
import { AnimeImpact, ANIME_IMPACT_DURATION } from "../vendor/shotcraft/effects/impact-feedback/AnimeImpact";
import { HitCounter, HIT_COUNTER_DURATION } from "../vendor/shotcraft/effects/impact-feedback/HitCounter";
import { SheenSweepRetry, SHEEN_SWEEP_RETRY_DURATION } from "../vendor/shotcraft/effects/light-play-moves/SheenSweepRetry";
import { SpotlightSweepReveal, SPOTLIGHT_SWEEP_REVEAL_DURATION } from "../vendor/shotcraft/effects/light-play-moves/SpotlightSweepReveal";
import { RadialRipplePhoneChips, RADIAL_RIPPLE_PHONE_CHIPS_DURATION } from "../vendor/shotcraft/effects/radial-ripple-phone-chips/RadialRipplePhoneChips";
import { RisoMisregistrationHit, RISO_MISREGISTRATION_HIT_DURATION } from "../vendor/shotcraft/effects/riso-print-hits/RisoMisregistrationHit";
import { ScanBracketSweep, SCAN_BRACKET_SWEEP_DURATION } from "../vendor/shotcraft/effects/scan-bracket-sweep/ScanBracketSweep";
import { ScanlineAnnotateFocus, SCANLINE_ANNOTATE_FOCUS_DURATION } from "../vendor/shotcraft/effects/scanline-annotate-focus/ScanlineAnnotateFocus";
import { ScanlineAssembleFlyin, SCANLINE_ASSEMBLE_FLYIN_DURATION } from "../vendor/shotcraft/effects/scanline-assemble-flyin/ScanlineAssembleFlyin";
import { ImpactBurstKit, IMPACT_BURST_KIT_DURATION } from "../vendor/shotcraft/effects/slam-entrance-moves/ImpactBurstKit";
import { KanadaPerspectiveSnap, KANADA_PERSPECTIVE_SNAP_DURATION } from "../vendor/shotcraft/effects/slam-entrance-moves/KanadaPerspectiveSnap";
import { ScoreSlam, SCORE_SLAM_DURATION } from "../vendor/shotcraft/effects/slam-entrance-moves/ScoreSlam";
import { CornerSpotlightReveal, CORNER_SPOTLIGHT_REVEAL_DURATION } from "../vendor/shotcraft/effects/spotlight-sweep-moves/CornerSpotlightReveal";
import { GlowWakeSleepPanel, GLOW_WAKE_SLEEP_PANEL_DURATION } from "../vendor/shotcraft/effects/spotlight-sweep-moves/GlowWakeSleepPanel";
import { SlideSpotlightPan, SLIDE_SPOTLIGHT_PAN_DURATION } from "../vendor/shotcraft/effects/spotlight-sweep-moves/SlideSpotlightPan";
import { AutolayoutGapDial, AUTOLAYOUT_GAP_DIAL_DURATION } from "../vendor/shotcraft/interaction/autolayout-gap-dial/AutolayoutGapDial";
import { DiagramCascadeBuild, DIAGRAM_CASCADE_BUILD_DURATION } from "../vendor/shotcraft/interaction/canvas-materialize-moves/DiagramCascadeBuild";
import { PanelToCanvasMaterialize, PANEL_TO_CANVAS_MATERIALIZE_DURATION } from "../vendor/shotcraft/interaction/canvas-materialize-moves/PanelToCanvasMaterialize";
import { ChipGridSingleSelectBlackout, CHIP_GRID_SINGLE_SELECT_BLACKOUT_DURATION } from "../vendor/shotcraft/interaction/chip-grid-single-select-blackout/ChipGridSingleSelectBlackout";
import { CursorCastEnsemble, CURSOR_CAST_ENSEMBLE_DURATION } from "../vendor/shotcraft/interaction/collab-cursor-moves/CursorCastEnsemble";
import { GlassPillDictationTyping, GLASS_PILL_DICTATION_TYPING_DURATION } from "../vendor/shotcraft/interaction/glass-pill-dictation-typing/GlassPillDictationTyping";
import { HashtagToPillMaterialize, HASHTAG_TO_PILL_MATERIALIZE_DURATION } from "../vendor/shotcraft/interaction/hashtag-to-pill-materialize/HashtagToPillMaterialize";
import { PickerCarouselFeatureCycle, PICKER_CAROUSEL_FEATURE_CYCLE_DURATION } from "../vendor/shotcraft/interaction/picker-carousel-feature-cycle/PickerCarouselFeatureCycle";
import { SegmentedThumbHero, SEGMENTED_THUMB_HERO_DURATION } from "../vendor/shotcraft/interaction/segmented-thumb-hero/SegmentedThumbHero";
import { PaletteThemeRipple, PALETTE_THEME_RIPPLE_DURATION } from "../vendor/shotcraft/interaction/theme-switch-moves/PaletteThemeRipple";
import { ThemeSweepToggle, THEME_SWEEP_TOGGLE_DURATION } from "../vendor/shotcraft/interaction/theme-switch-moves/ThemeSweepToggle";
import { TypeAndFilter, TYPE_AND_FILTER_DURATION } from "../vendor/shotcraft/interaction/type-and-filter/TypeAndFilter";
import { VoiceWaveformLive, VOICE_WAVEFORM_LIVE_DURATION } from "../vendor/shotcraft/interaction/voice-waveform-live/VoiceWaveformLive";
import { CraneRiseReveal, CRANE_RISE_REVEAL_DURATION } from "../vendor/shotcraft/opening/crane-rise-reveal/CraneRiseReveal";
import { DatavizLandscapeOpen, DATAVIZ_LANDSCAPE_OPEN_DURATION } from "../vendor/shotcraft/opening/dataviz-landscape-open/DatavizLandscapeOpen";
import { Fracture, FRACTURE_DURATION } from "../vendor/shotcraft/opening/fracture/Fracture";
import { IconFieldColorize, ICON_FIELD_COLORIZE_DURATION } from "../vendor/shotcraft/opening/icon-field-colorize/IconFieldColorize";
import { LetterspaceMaterialize, LETTERSPACE_MATERIALIZE_DURATION } from "../vendor/shotcraft/opening/letterspace-materialize/LetterspaceMaterialize";
import { MagicianCardFlourish, MAGICIAN_CARD_FLOURISH_DURATION } from "../vendor/shotcraft/opening/magician-card-flourish/MagicianCardFlourish";
import { OrbitRingTitleOpen, ORBIT_RING_TITLE_OPEN_DURATION } from "../vendor/shotcraft/opening/orbit-ring-title-open/OrbitRingTitleOpen";
import { SpotlightHeroCard, SPOTLIGHT_HERO_CARD_DURATION } from "../vendor/shotcraft/opening/spotlight-hero-card/SpotlightHeroCard";
import { StrokeSegmentBuild, STROKE_SEGMENT_BUILD_DURATION } from "../vendor/shotcraft/opening/stroke-segment-build/StrokeSegmentBuild";
import { TextAsMask, TEXT_AS_MASK_DURATION } from "../vendor/shotcraft/opening/text-as-mask/TextAsMask";
import { GrainDissolve, GRAIN_DISSOLVE_DURATION } from "../vendor/shotcraft/outro/grain-dissolve/GrainDissolve";
import { LogoShrinkWordmarkLockup, LOGO_SHRINK_WORDMARK_LOCKUP_DURATION } from "../vendor/shotcraft/outro/logo-shrink-wordmark-lockup/LogoShrinkWordmarkLockup";
import { NeonTripleMarquee, NEON_TRIPLE_MARQUEE_DURATION } from "../vendor/shotcraft/outro/neon-triple-marquee/NeonTripleMarquee";
import { OutroGroupPhotoLaunch, OUTRO_GROUP_PHOTO_LAUNCH_DURATION } from "../vendor/shotcraft/outro/outro-group-photo-launch/OutroGroupPhotoLaunch";
import { UiStripAwayOutro, UI_STRIP_AWAY_OUTRO_DURATION } from "../vendor/shotcraft/outro/ui-strip-away-outro/UiStripAwayOutro";
import { IconFlipBloomLogo, ICON_FLIP_BLOOM_LOGO_DURATION } from "../vendor/shotcraft/outro/ui-to-brand-morph/IconFlipBloomLogo";
import { InputMorphsIntoLogo, INPUT_MORPHS_INTO_LOGO_DURATION } from "../vendor/shotcraft/outro/ui-to-brand-morph/InputMorphsIntoLogo";
import { PaparazziFlash, PAPARAZZI_FLASH_DURATION } from "../vendor/shotcraft/rhythm/beat-cut-moves/PaparazziFlash";
import { BeatStepListThemeCycle, BEAT_STEP_LIST_THEME_CYCLE_DURATION } from "../vendor/shotcraft/rhythm/beat-step-list-theme-cycle/BeatStepListThemeCycle";
import { ComicPanelSplit, COMIC_PANEL_SPLIT_DURATION } from "../vendor/shotcraft/rhythm/panel-grid-moves/ComicPanelSplit";
import { QuadSplitParallelScenes, QUAD_SPLIT_PARALLEL_SCENES_DURATION } from "../vendor/shotcraft/rhythm/quad-split-parallel-scenes/QuadSplitParallelScenes";
import { JumpCutPunchIn, JUMP_CUT_PUNCH_IN_DURATION } from "../vendor/shotcraft/rhythm/rhythm-interrupt-moves/JumpCutPunchIn";
import { SakugaTimingShift, SAKUGA_TIMING_SHIFT_DURATION } from "../vendor/shotcraft/rhythm/sakuga-timing-shift/SakugaTimingShift";
import { TrailerBumper, TRAILER_BUMPER_DURATION } from "../vendor/shotcraft/rhythm/trailer-grammar-moves/TrailerBumper";
import { BottomPushStackWipe, BOTTOM_PUSH_STACK_WIPE_DURATION } from "../vendor/shotcraft/transition/bottom-push-stack-wipe/BottomPushStackWipe";
import { CardFlipReveal, CARD_FLIP_REVEAL_DURATION } from "../vendor/shotcraft/transition/card-flip-reveal/CardFlipReveal";
import { CardFlockTumble, CARD_FLOCK_TUMBLE_DURATION } from "../vendor/shotcraft/transition/card-flock-tumble/CardFlockTumble";
import { CircleMatchIris, CIRCLE_MATCH_IRIS_DURATION } from "../vendor/shotcraft/transition/circle-match-iris/CircleMatchIris";
import { GradientTransition, GRADIENT_TRANSITION_DURATION } from "../vendor/shotcraft/transition/gradient-transition/GradientTransition";
import { LineCarryTransition, LINE_CARRY_TRANSITION_DURATION } from "../vendor/shotcraft/transition/line-carry-transition/LineCarryTransition";
import { MosaicReframe, MOSAIC_REFRAME_DURATION } from "../vendor/shotcraft/transition/mosaic-reframe/MosaicReframe";
import { BarnDoorSplit, BARN_DOOR_SPLIT_DURATION } from "../vendor/shotcraft/transition/page-turn-transitions/BarnDoorSplit";
import { InkBleedReveal, INK_BLEED_REVEAL_DURATION } from "../vendor/shotcraft/transition/print-texture-transitions/InkBleedReveal";
import { PortalWipeV2, PORTAL_WIPE_V2_DURATION } from "../vendor/shotcraft/transition/shot-transitions/PortalWipeV2";
import { GlitchDisplace, GLITCH_DISPLACE_DURATION } from "../vendor/shotcraft/transition/tear-streak-transitions/GlitchDisplace";
import { InvisibleCut, INVISIBLE_CUT_DURATION } from "../vendor/shotcraft/transition/transition-hidden-cut/InvisibleCut";
import { LightLeakBurn, LIGHT_LEAK_BURN_DURATION } from "../vendor/shotcraft/transition/transition-hidden-cut/LightLeakBurn";
import { VersusSlam, VERSUS_SLAM_DURATION } from "../vendor/shotcraft/transition/transition-hidden-cut/VersusSlam";
import { LetterformZoom, LETTERFORM_ZOOM_DURATION } from "../vendor/shotcraft/transition/transition-travel/LetterformZoom";
import { WhiteFlashLogoSimplifyCut, WHITE_FLASH_LOGO_SIMPLIFY_CUT_DURATION } from "../vendor/shotcraft/transition/white-flash-logo-simplify-cut/WhiteFlashLogoSimplifyCut";
import { BlindsSlice, BLINDS_SLICE_DURATION } from "../vendor/shotcraft/transition/wipe-transitions/BlindsSlice";
import { BlurSlide, BLUR_SLIDE_DURATION } from "../vendor/shotcraft/typography/blur-slide/BlurSlide";
import { BraceExpand, BRACE_EXPAND_DURATION } from "../vendor/shotcraft/typography/brace-expand/BraceExpand";
import { BrandInkOpen, BRAND_INK_OPEN_DURATION } from "../vendor/shotcraft/typography/brand-ink-open/BrandInkOpen";
import { CountdownArcScatter, COUNTDOWN_ARC_SCATTER_DURATION } from "../vendor/shotcraft/typography/countdown-arc-scatter/CountdownArcScatter";
import { FlyingWords, FLYING_WORDS_DURATION } from "../vendor/shotcraft/typography/flying-words/FlyingWords";
import { GlitchCycle, GLITCH_CYCLE_DURATION } from "../vendor/shotcraft/typography/glitch-cycle/GlitchCycle";
import { GradientWordSweep, GRADIENT_WORD_SWEEP_DURATION } from "../vendor/shotcraft/typography/gradient-word-sweep/GradientWordSweep";
import { LeadWordZoomAssemble, LEAD_WORD_ZOOM_ASSEMBLE_DURATION } from "../vendor/shotcraft/typography/lead-word-zoom-assemble/LeadWordZoomAssemble";
import { MarkerUnderlineTitle, MARKER_UNDERLINE_TITLE_DURATION } from "../vendor/shotcraft/typography/marker-underline-title/MarkerUnderlineTitle";
import { OutlineWordFill, OUTLINE_WORD_FILL_DURATION } from "../vendor/shotcraft/typography/outline-word-fill/OutlineWordFill";
import { PaperTitleCard, PAPER_TITLE_CARD_DURATION } from "../vendor/shotcraft/typography/paper-title-card/PaperTitleCard";
import { PillChipSlotCycleHandled, PILL_CHIP_SLOT_CYCLE_HANDLED_DURATION } from "../vendor/shotcraft/typography/pill-chip-slot-cycle-handled/PillChipSlotCycleHandled";
import { PillSlotCycle, PILL_SLOT_CYCLE_DURATION } from "../vendor/shotcraft/typography/pill-slot-cycle/PillSlotCycle";
import { TextColumnConverge, TEXT_COLUMN_CONVERGE_DURATION } from "../vendor/shotcraft/typography/text-column-converge/TextColumnConverge";
import { TitleDemoteToLabel, TITLE_DEMOTE_TO_LABEL_DURATION } from "../vendor/shotcraft/typography/title-demote-to-label/TitleDemoteToLabel";
import { LetterformDriftAssembly, LETTERFORM_DRIFT_ASSEMBLY_DURATION } from "../vendor/shotcraft/typography/type-assembly-moves/LetterformDriftAssembly";
import { SplitTextStagger, SPLIT_TEXT_STAGGER_DURATION } from "../vendor/shotcraft/typography/type-assembly-moves/SplitTextStagger";
import { TextOnPath, TEXT_ON_PATH_DURATION } from "../vendor/shotcraft/typography/type-assembly-moves/TextOnPath";
import { LetterDropPhysics, LETTER_DROP_PHYSICS_DURATION } from "../vendor/shotcraft/typography/type-entrance-moves/LetterDropPhysics";
import { FontWeightPump, FONT_WEIGHT_PUMP_DURATION } from "../vendor/shotcraft/typography/type-rhythm-sync/FontWeightPump";
import { KaraokeFillSync, KARAOKE_FILL_SYNC_DURATION } from "../vendor/shotcraft/typography/type-rhythm-sync/KaraokeFillSync";
import { TypewriterErrorRetype, TYPEWRITER_ERROR_RETYPE_DURATION } from "../vendor/shotcraft/typography/typewriter-moves/TypewriterErrorRetype";
import { VerticalWordRollBlurCycle, VERTICAL_WORD_ROLL_BLUR_CYCLE_DURATION } from "../vendor/shotcraft/typography/vertical-word-roll-blur-cycle/VerticalWordRollBlurCycle";
import { WordRelayFilmstrip, WORD_RELAY_FILMSTRIP_DURATION } from "../vendor/shotcraft/typography/word-relay-filmstrip/WordRelayFilmstrip";
import { WordRelayGeometry, WORD_RELAY_GEOMETRY_DURATION } from "../vendor/shotcraft/typography/word-relay-geometry/WordRelayGeometry";
import { AvatarBracketCarousel, AVATAR_BRACKET_CAROUSEL_DURATION } from "../vendor/shotcraft/ui-entrance/avatar-bracket-carousel/AvatarBracketCarousel";
import { BezierSourceConvergeMerge, BEZIER_SOURCE_CONVERGE_MERGE_DURATION } from "../vendor/shotcraft/ui-entrance/bezier-source-converge-merge/BezierSourceConvergeMerge";
import { CardStack, CARD_STACK_DURATION } from "../vendor/shotcraft/ui-entrance/card-stack/CardStack";
import { Carousel3D, CAROUSEL_3D_DURATION } from "../vendor/shotcraft/ui-entrance/carousel-3d/Carousel3D";
import { ClipCardLooping, CLIPCARD_LOOPING_DURATION } from "../vendor/shotcraft/ui-entrance/clipcard-looping/ClipCardLooping";
import { ClonerDepthEcho, CLONER_DEPTH_ECHO_DURATION } from "../vendor/shotcraft/ui-entrance/cloner-depth-echo/ClonerDepthEcho";
import { DeckDealFlyin, DECK_DEAL_FLYIN_DURATION } from "../vendor/shotcraft/ui-entrance/deck-deal-flyin/DeckDealFlyin";
import { DocParkLeftPillDeal, DOC_PARK_LEFT_PILL_DEAL_DURATION } from "../vendor/shotcraft/ui-entrance/doc-park-left-pill-deal/DocParkLeftPillDeal";
import { DocumentTypewriterReveal, DOCUMENT_TYPEWRITER_REVEAL_DURATION } from "../vendor/shotcraft/ui-entrance/document-typewriter-reveal/DocumentTypewriterReveal";
import { DrawSvgTrace, DRAW_SVG_TRACE_DURATION } from "../vendor/shotcraft/ui-entrance/draw-svg-trace/DrawSvgTrace";
import { ContactShadowLift, CONTACT_SHADOW_LIFT_DURATION } from "../vendor/shotcraft/ui-entrance/element-body-moves/ContactShadowLift";
import { IntegrationHubMap, INTEGRATION_HUB_MAP_DURATION } from "../vendor/shotcraft/ui-entrance/integration-hub-map/IntegrationHubMap";
import { ListReveal, LIST_REVEAL_DURATION } from "../vendor/shotcraft/ui-entrance/list-reveal/ListReveal";
import { ListStackPress, LIST_STACK_PRESS_DURATION } from "../vendor/shotcraft/ui-entrance/list-stack-press/ListStackPress";
import { NeonFrameForerun, NEON_FRAME_FORERUN_DURATION } from "../vendor/shotcraft/ui-entrance/neon-frame-forerun/NeonFrameForerun";
import { NeonFrameForerunOrbit, NEON_FRAME_FORERUN_ORBIT_DURATION } from "../vendor/shotcraft/ui-entrance/neon-frame-orbit-drop/NeonFrameForerunOrbit";
import { PageWaterfallWall, PAGE_WATERFALL_WALL_DURATION } from "../vendor/shotcraft/ui-entrance/page-waterfall-wall/PageWaterfallWall";
import { ProductCardProgressiveAssemble, PRODUCT_CARD_PROGRESSIVE_ASSEMBLE_DURATION } from "../vendor/shotcraft/ui-entrance/product-card-progressive-assemble/ProductCardProgressiveAssemble";
import { RadialWave, RADIAL_WAVE_DURATION } from "../vendor/shotcraft/ui-entrance/radial-wave/RadialWave";
import { ResearchCardStackScroll, RESEARCH_CARD_STACK_SCROLL_DURATION } from "../vendor/shotcraft/ui-entrance/research-card-stack-scroll/ResearchCardStackScroll";
import { RowEmbed, ROW_EMBED_DURATION } from "../vendor/shotcraft/ui-entrance/row-embed/RowEmbed";
import { ValueStaggerGradient, VALUE_STAGGER_GRADIENT_DURATION } from "../vendor/shotcraft/ui-entrance/value-stagger-gradient/ValueStaggerGradient";
import { BentoLightUp, BENTO_LIGHT_UP_DURATION } from "../vendor/shotcraft/ui-entrance/wall-reveal-moves/BentoLightUp";
import { WireframeDrawOn, WIREFRAME_DRAW_ON_DURATION } from "../vendor/shotcraft/ui-entrance/wall-reveal-moves/WireframeDrawOn";

export const SHOTCRAFT_ORIGINALS: { id: string; component: React.FC; frames: number }[] = [
  { id: "SC-Basic3DScene", component: Basic3DScene, frames: BASIC_3D_SCENE_DURATION },
  { id: "SC-CursorFlyover", component: CursorFlyover, frames: CURSOR_FLYOVER_DURATION },
  { id: "SC-GrazeFaceTour", component: GrazeFaceTour, frames: GRAZE_FACE_TOUR_DURATION },
  { id: "SC-OverheadTabletopDrop", component: OverheadTabletopDrop, frames: OVERHEAD_TABLETOP_DROP_DURATION },
  { id: "SC-TiltReveal", component: TiltReveal, frames: TILT_REVEAL_DURATION },
  { id: "SC-DroneDiveLanding", component: DroneDiveLanding, frames: DRONE_DIVE_LANDING_DURATION },
  { id: "SC-ExplodedView", component: ExplodedView, frames: EXPLODED_VIEW_DURATION },
  { id: "SC-SteepTiltGlide", component: SteepTiltGlide, frames: STEEP_TILT_GLIDE_DURATION },
  { id: "SC-BulletTimeFreezeOrbit", component: BulletTimeFreezeOrbit, frames: BULLET_TIME_FREEZE_ORBIT_DURATION },
  { id: "SC-PullBackIsolation", component: PullBackIsolation, frames: PULL_BACK_ISOLATION_DURATION },
  { id: "SC-Terminal3D", component: Terminal3D, frames: TERMINAL_3D_DURATION },
  { id: "SC-BeforeAfterSliderScrub", component: BeforeAfterSliderScrub, frames: BEFORE_AFTER_SLIDER_SCRUB_DURATION },
  { id: "SC-AxisRescaleShockV2", component: AxisRescaleShockV2, frames: AXIS_RESCALE_SHOCK_V2_DURATION },
  { id: "SC-OscilloscopeStreamV2", component: OscilloscopeStreamV2, frames: OSCILLOSCOPE_STREAM_V2_DURATION },
  { id: "SC-UnitDotSwarmRegroupV2", component: UnitDotSwarmRegroupV2, frames: UNIT_DOT_SWARM_REGROUP_V2_DURATION },
  { id: "SC-NeedleSweepSelftest", component: NeedleSweepSelftest, frames: NEEDLE_SWEEP_SELFTEST_DURATION },
  { id: "SC-TapeScrollFixedPointer", component: TapeScrollFixedPointer, frames: TAPE_SCROLL_FIXED_POINTER_DURATION },
  { id: "SC-BrakeReticleLock", component: BrakeReticleLock, frames: BRAKE_RETICLE_LOCK_DURATION },
  { id: "SC-ChangelogScrollBrake", component: ChangelogScrollBrake, frames: CHANGELOG_SCROLL_BRAKE_DURATION },
  { id: "SC-TimelineTravel", component: TimelineTravel, frames: TIMELINE_TRAVEL_DURATION },
  { id: "SC-AssembleThenTypeFlyin", component: AssembleThenTypeFlyin, frames: ASSEMBLE_THEN_TYPE_FLYIN_DURATION },
  { id: "SC-AuroraBloomBgFlip", component: AuroraBloomBgFlip, frames: AURORA_BLOOM_BG_FLIP_DURATION },
  { id: "SC-BrandFrameSnap", component: BrandFrameSnap, frames: BRAND_FRAME_SNAP_DURATION },
  { id: "SC-ReticleLockOn", component: ReticleLockOn, frames: RETICLE_LOCK_ON_DURATION },
  { id: "SC-FlylineArc", component: FlylineArc, frames: FLYLINE_ARC_DURATION },
  { id: "SC-GlowOrbAmbient", component: GlowOrbAmbient, frames: GLOW_ORB_AMBIENT_DURATION },
  { id: "SC-OrbFlylineRelay", component: OrbFlylineRelay, frames: ORB_FLYLINE_RELAY_DURATION },
  { id: "SC-AttentionBounce", component: AttentionBounce, frames: ATTENTION_BOUNCE_DURATION },
  { id: "SC-AnimeImpact", component: AnimeImpact, frames: ANIME_IMPACT_DURATION },
  { id: "SC-HitCounter", component: HitCounter, frames: HIT_COUNTER_DURATION },
  { id: "SC-SheenSweepRetry", component: SheenSweepRetry, frames: SHEEN_SWEEP_RETRY_DURATION },
  { id: "SC-SpotlightSweepReveal", component: SpotlightSweepReveal, frames: SPOTLIGHT_SWEEP_REVEAL_DURATION },
  { id: "SC-RadialRipplePhoneChips", component: RadialRipplePhoneChips, frames: RADIAL_RIPPLE_PHONE_CHIPS_DURATION },
  { id: "SC-RisoMisregistrationHit", component: RisoMisregistrationHit, frames: RISO_MISREGISTRATION_HIT_DURATION },
  { id: "SC-ScanBracketSweep", component: ScanBracketSweep, frames: SCAN_BRACKET_SWEEP_DURATION },
  { id: "SC-ScanlineAnnotateFocus", component: ScanlineAnnotateFocus, frames: SCANLINE_ANNOTATE_FOCUS_DURATION },
  { id: "SC-ScanlineAssembleFlyin", component: ScanlineAssembleFlyin, frames: SCANLINE_ASSEMBLE_FLYIN_DURATION },
  { id: "SC-ImpactBurstKit", component: ImpactBurstKit, frames: IMPACT_BURST_KIT_DURATION },
  { id: "SC-KanadaPerspectiveSnap", component: KanadaPerspectiveSnap, frames: KANADA_PERSPECTIVE_SNAP_DURATION },
  { id: "SC-ScoreSlam", component: ScoreSlam, frames: SCORE_SLAM_DURATION },
  { id: "SC-CornerSpotlightReveal", component: CornerSpotlightReveal, frames: CORNER_SPOTLIGHT_REVEAL_DURATION },
  { id: "SC-GlowWakeSleepPanel", component: GlowWakeSleepPanel, frames: GLOW_WAKE_SLEEP_PANEL_DURATION },
  { id: "SC-SlideSpotlightPan", component: SlideSpotlightPan, frames: SLIDE_SPOTLIGHT_PAN_DURATION },
  { id: "SC-AutolayoutGapDial", component: AutolayoutGapDial, frames: AUTOLAYOUT_GAP_DIAL_DURATION },
  { id: "SC-DiagramCascadeBuild", component: DiagramCascadeBuild, frames: DIAGRAM_CASCADE_BUILD_DURATION },
  { id: "SC-PanelToCanvasMaterialize", component: PanelToCanvasMaterialize, frames: PANEL_TO_CANVAS_MATERIALIZE_DURATION },
  { id: "SC-ChipGridSingleSelectBlackout", component: ChipGridSingleSelectBlackout, frames: CHIP_GRID_SINGLE_SELECT_BLACKOUT_DURATION },
  { id: "SC-CursorCastEnsemble", component: CursorCastEnsemble, frames: CURSOR_CAST_ENSEMBLE_DURATION },
  { id: "SC-GlassPillDictationTyping", component: GlassPillDictationTyping, frames: GLASS_PILL_DICTATION_TYPING_DURATION },
  { id: "SC-HashtagToPillMaterialize", component: HashtagToPillMaterialize, frames: HASHTAG_TO_PILL_MATERIALIZE_DURATION },
  { id: "SC-PickerCarouselFeatureCycle", component: PickerCarouselFeatureCycle, frames: PICKER_CAROUSEL_FEATURE_CYCLE_DURATION },
  { id: "SC-SegmentedThumbHero", component: SegmentedThumbHero, frames: SEGMENTED_THUMB_HERO_DURATION },
  { id: "SC-PaletteThemeRipple", component: PaletteThemeRipple, frames: PALETTE_THEME_RIPPLE_DURATION },
  { id: "SC-ThemeSweepToggle", component: ThemeSweepToggle, frames: THEME_SWEEP_TOGGLE_DURATION },
  { id: "SC-TypeAndFilter", component: TypeAndFilter, frames: TYPE_AND_FILTER_DURATION },
  { id: "SC-VoiceWaveformLive", component: VoiceWaveformLive, frames: VOICE_WAVEFORM_LIVE_DURATION },
  { id: "SC-CraneRiseReveal", component: CraneRiseReveal, frames: CRANE_RISE_REVEAL_DURATION },
  { id: "SC-DatavizLandscapeOpen", component: DatavizLandscapeOpen, frames: DATAVIZ_LANDSCAPE_OPEN_DURATION },
  { id: "SC-Fracture", component: Fracture, frames: FRACTURE_DURATION },
  { id: "SC-IconFieldColorize", component: IconFieldColorize, frames: ICON_FIELD_COLORIZE_DURATION },
  { id: "SC-LetterspaceMaterialize", component: LetterspaceMaterialize, frames: LETTERSPACE_MATERIALIZE_DURATION },
  { id: "SC-MagicianCardFlourish", component: MagicianCardFlourish, frames: MAGICIAN_CARD_FLOURISH_DURATION },
  { id: "SC-OrbitRingTitleOpen", component: OrbitRingTitleOpen, frames: ORBIT_RING_TITLE_OPEN_DURATION },
  { id: "SC-SpotlightHeroCard", component: SpotlightHeroCard, frames: SPOTLIGHT_HERO_CARD_DURATION },
  { id: "SC-StrokeSegmentBuild", component: StrokeSegmentBuild, frames: STROKE_SEGMENT_BUILD_DURATION },
  { id: "SC-TextAsMask", component: TextAsMask, frames: TEXT_AS_MASK_DURATION },
  { id: "SC-GrainDissolve", component: GrainDissolve, frames: GRAIN_DISSOLVE_DURATION },
  { id: "SC-LogoShrinkWordmarkLockup", component: LogoShrinkWordmarkLockup, frames: LOGO_SHRINK_WORDMARK_LOCKUP_DURATION },
  { id: "SC-NeonTripleMarquee", component: NeonTripleMarquee, frames: NEON_TRIPLE_MARQUEE_DURATION },
  { id: "SC-OutroGroupPhotoLaunch", component: OutroGroupPhotoLaunch, frames: OUTRO_GROUP_PHOTO_LAUNCH_DURATION },
  { id: "SC-UiStripAwayOutro", component: UiStripAwayOutro, frames: UI_STRIP_AWAY_OUTRO_DURATION },
  { id: "SC-IconFlipBloomLogo", component: IconFlipBloomLogo, frames: ICON_FLIP_BLOOM_LOGO_DURATION },
  { id: "SC-InputMorphsIntoLogo", component: InputMorphsIntoLogo, frames: INPUT_MORPHS_INTO_LOGO_DURATION },
  { id: "SC-PaparazziFlash", component: PaparazziFlash, frames: PAPARAZZI_FLASH_DURATION },
  { id: "SC-BeatStepListThemeCycle", component: BeatStepListThemeCycle, frames: BEAT_STEP_LIST_THEME_CYCLE_DURATION },
  { id: "SC-ComicPanelSplit", component: ComicPanelSplit, frames: COMIC_PANEL_SPLIT_DURATION },
  { id: "SC-QuadSplitParallelScenes", component: QuadSplitParallelScenes, frames: QUAD_SPLIT_PARALLEL_SCENES_DURATION },
  { id: "SC-JumpCutPunchIn", component: JumpCutPunchIn, frames: JUMP_CUT_PUNCH_IN_DURATION },
  { id: "SC-SakugaTimingShift", component: SakugaTimingShift, frames: SAKUGA_TIMING_SHIFT_DURATION },
  { id: "SC-TrailerBumper", component: TrailerBumper, frames: TRAILER_BUMPER_DURATION },
  { id: "SC-BottomPushStackWipe", component: BottomPushStackWipe, frames: BOTTOM_PUSH_STACK_WIPE_DURATION },
  { id: "SC-CardFlipReveal", component: CardFlipReveal, frames: CARD_FLIP_REVEAL_DURATION },
  { id: "SC-CardFlockTumble", component: CardFlockTumble, frames: CARD_FLOCK_TUMBLE_DURATION },
  { id: "SC-CircleMatchIris", component: CircleMatchIris, frames: CIRCLE_MATCH_IRIS_DURATION },
  { id: "SC-GradientTransition", component: GradientTransition, frames: GRADIENT_TRANSITION_DURATION },
  { id: "SC-LineCarryTransition", component: LineCarryTransition, frames: LINE_CARRY_TRANSITION_DURATION },
  { id: "SC-MosaicReframe", component: MosaicReframe, frames: MOSAIC_REFRAME_DURATION },
  { id: "SC-BarnDoorSplit", component: BarnDoorSplit, frames: BARN_DOOR_SPLIT_DURATION },
  { id: "SC-InkBleedReveal", component: InkBleedReveal, frames: INK_BLEED_REVEAL_DURATION },
  { id: "SC-PortalWipeV2", component: PortalWipeV2, frames: PORTAL_WIPE_V2_DURATION },
  { id: "SC-GlitchDisplace", component: GlitchDisplace, frames: GLITCH_DISPLACE_DURATION },
  { id: "SC-InvisibleCut", component: InvisibleCut, frames: INVISIBLE_CUT_DURATION },
  { id: "SC-LightLeakBurn", component: LightLeakBurn, frames: LIGHT_LEAK_BURN_DURATION },
  { id: "SC-VersusSlam", component: VersusSlam, frames: VERSUS_SLAM_DURATION },
  { id: "SC-LetterformZoom", component: LetterformZoom, frames: LETTERFORM_ZOOM_DURATION },
  { id: "SC-WhiteFlashLogoSimplifyCut", component: WhiteFlashLogoSimplifyCut, frames: WHITE_FLASH_LOGO_SIMPLIFY_CUT_DURATION },
  { id: "SC-BlindsSlice", component: BlindsSlice, frames: BLINDS_SLICE_DURATION },
  { id: "SC-BlurSlide", component: BlurSlide, frames: BLUR_SLIDE_DURATION },
  { id: "SC-BraceExpand", component: BraceExpand, frames: BRACE_EXPAND_DURATION },
  { id: "SC-BrandInkOpen", component: BrandInkOpen, frames: BRAND_INK_OPEN_DURATION },
  { id: "SC-CountdownArcScatter", component: CountdownArcScatter, frames: COUNTDOWN_ARC_SCATTER_DURATION },
  { id: "SC-FlyingWords", component: FlyingWords, frames: FLYING_WORDS_DURATION },
  { id: "SC-GlitchCycle", component: GlitchCycle, frames: GLITCH_CYCLE_DURATION },
  { id: "SC-GradientWordSweep", component: GradientWordSweep, frames: GRADIENT_WORD_SWEEP_DURATION },
  { id: "SC-LeadWordZoomAssemble", component: LeadWordZoomAssemble, frames: LEAD_WORD_ZOOM_ASSEMBLE_DURATION },
  { id: "SC-MarkerUnderlineTitle", component: MarkerUnderlineTitle, frames: MARKER_UNDERLINE_TITLE_DURATION },
  { id: "SC-OutlineWordFill", component: OutlineWordFill, frames: OUTLINE_WORD_FILL_DURATION },
  { id: "SC-PaperTitleCard", component: PaperTitleCard, frames: PAPER_TITLE_CARD_DURATION },
  { id: "SC-PillChipSlotCycleHandled", component: PillChipSlotCycleHandled, frames: PILL_CHIP_SLOT_CYCLE_HANDLED_DURATION },
  { id: "SC-PillSlotCycle", component: PillSlotCycle, frames: PILL_SLOT_CYCLE_DURATION },
  { id: "SC-TextColumnConverge", component: TextColumnConverge, frames: TEXT_COLUMN_CONVERGE_DURATION },
  { id: "SC-TitleDemoteToLabel", component: TitleDemoteToLabel, frames: TITLE_DEMOTE_TO_LABEL_DURATION },
  { id: "SC-LetterformDriftAssembly", component: LetterformDriftAssembly, frames: LETTERFORM_DRIFT_ASSEMBLY_DURATION },
  { id: "SC-SplitTextStagger", component: SplitTextStagger, frames: SPLIT_TEXT_STAGGER_DURATION },
  { id: "SC-TextOnPath", component: TextOnPath, frames: TEXT_ON_PATH_DURATION },
  { id: "SC-LetterDropPhysics", component: LetterDropPhysics, frames: LETTER_DROP_PHYSICS_DURATION },
  { id: "SC-FontWeightPump", component: FontWeightPump, frames: FONT_WEIGHT_PUMP_DURATION },
  { id: "SC-KaraokeFillSync", component: KaraokeFillSync, frames: KARAOKE_FILL_SYNC_DURATION },
  { id: "SC-TypewriterErrorRetype", component: TypewriterErrorRetype, frames: TYPEWRITER_ERROR_RETYPE_DURATION },
  { id: "SC-VerticalWordRollBlurCycle", component: VerticalWordRollBlurCycle, frames: VERTICAL_WORD_ROLL_BLUR_CYCLE_DURATION },
  { id: "SC-WordRelayFilmstrip", component: WordRelayFilmstrip, frames: WORD_RELAY_FILMSTRIP_DURATION },
  { id: "SC-WordRelayGeometry", component: WordRelayGeometry, frames: WORD_RELAY_GEOMETRY_DURATION },
  { id: "SC-AvatarBracketCarousel", component: AvatarBracketCarousel, frames: AVATAR_BRACKET_CAROUSEL_DURATION },
  { id: "SC-BezierSourceConvergeMerge", component: BezierSourceConvergeMerge, frames: BEZIER_SOURCE_CONVERGE_MERGE_DURATION },
  { id: "SC-CardStack", component: CardStack, frames: CARD_STACK_DURATION },
  { id: "SC-Carousel3D", component: Carousel3D, frames: CAROUSEL_3D_DURATION },
  { id: "SC-ClipCardLooping", component: ClipCardLooping, frames: CLIPCARD_LOOPING_DURATION },
  { id: "SC-ClonerDepthEcho", component: ClonerDepthEcho, frames: CLONER_DEPTH_ECHO_DURATION },
  { id: "SC-DeckDealFlyin", component: DeckDealFlyin, frames: DECK_DEAL_FLYIN_DURATION },
  { id: "SC-DocParkLeftPillDeal", component: DocParkLeftPillDeal, frames: DOC_PARK_LEFT_PILL_DEAL_DURATION },
  { id: "SC-DocumentTypewriterReveal", component: DocumentTypewriterReveal, frames: DOCUMENT_TYPEWRITER_REVEAL_DURATION },
  { id: "SC-DrawSvgTrace", component: DrawSvgTrace, frames: DRAW_SVG_TRACE_DURATION },
  { id: "SC-ContactShadowLift", component: ContactShadowLift, frames: CONTACT_SHADOW_LIFT_DURATION },
  { id: "SC-IntegrationHubMap", component: IntegrationHubMap, frames: INTEGRATION_HUB_MAP_DURATION },
  { id: "SC-ListReveal", component: ListReveal, frames: LIST_REVEAL_DURATION },
  { id: "SC-ListStackPress", component: ListStackPress, frames: LIST_STACK_PRESS_DURATION },
  { id: "SC-NeonFrameForerun", component: NeonFrameForerun, frames: NEON_FRAME_FORERUN_DURATION },
  { id: "SC-NeonFrameForerunOrbit", component: NeonFrameForerunOrbit, frames: NEON_FRAME_FORERUN_ORBIT_DURATION },
  { id: "SC-PageWaterfallWall", component: PageWaterfallWall, frames: PAGE_WATERFALL_WALL_DURATION },
  { id: "SC-ProductCardProgressiveAssemble", component: ProductCardProgressiveAssemble, frames: PRODUCT_CARD_PROGRESSIVE_ASSEMBLE_DURATION },
  { id: "SC-RadialWave", component: RadialWave, frames: RADIAL_WAVE_DURATION },
  { id: "SC-ResearchCardStackScroll", component: ResearchCardStackScroll, frames: RESEARCH_CARD_STACK_SCROLL_DURATION },
  { id: "SC-RowEmbed", component: RowEmbed, frames: ROW_EMBED_DURATION },
  { id: "SC-ValueStaggerGradient", component: ValueStaggerGradient, frames: VALUE_STAGGER_GRADIENT_DURATION },
  { id: "SC-BentoLightUp", component: BentoLightUp, frames: BENTO_LIGHT_UP_DURATION },
  { id: "SC-WireframeDrawOn", component: WireframeDrawOn, frames: WIREFRAME_DRAW_ON_DURATION },
];
