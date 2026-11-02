// 「AI 科普」自己的镜头库（原理见 HANDBOOK.md，参考 video-shotcraft，代码自己写）
// 镜头目录：type → 组件 + 时长适配信息。稿子里每段的 shot.type 就是这里的键，shot.props 原样传给组件。
// 新增镜头：写组件（用 useShotFrame 取帧、导出 *_META），在这里登记，再同步 ops-desk 的 personal/assistant/explainer.py 里的写稿说明。
import type React from "react";
import type { ShotMeta } from "./kit";
import { SHARD_OPEN_META, ShardOpen } from "./ShardOpen";
import { LAYER_EXPLODE_META, LayerExplode } from "./LayerExplode";
import { ATTENTION_RELAY_META, AttentionRelay } from "./AttentionRelay";
import { TITLE_CARD_META, TitleCard } from "./TitleCard";
import { READOUT_META, Readout } from "./Readout";
import { TIMELINE_TRAVEL_META, TimelineTravel } from "./TimelineTravel";
import { VERSUS_SLAM_META, VersusSlam } from "./VersusSlam";
import { POINT_DEAL_META, PointDeal } from "./PointDeal";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SHOTS: Record<string, { C: React.FC<any>; meta: ShotMeta; zh: string }> = {
  open: { C: ShardOpen, meta: SHARD_OPEN_META, zh: "碎片聚合开场" },
  title: { C: TitleCard, meta: TITLE_CARD_META, zh: "章节标题" },
  layers: { C: LayerExplode, meta: LAYER_EXPLODE_META, zh: "分层爆炸图" },
  relay: { C: AttentionRelay, meta: ATTENTION_RELAY_META, zh: "注意力飞线" },
  readout: { C: Readout, meta: READOUT_META, zh: "数字读数" },
  timeline: { C: TimelineTravel, meta: TIMELINE_TRAVEL_META, zh: "时间轴穿行" },
  versus: { C: VersusSlam, meta: VERSUS_SLAM_META, zh: "左右对比" },
  points: { C: PointDeal, meta: POINT_DEAL_META, zh: "要点清单" },
};

export { ShardOpen, LayerExplode, AttentionRelay, TitleCard, Readout, TimelineTravel, VersusSlam, PointDeal };
export const sciDuration = (type: string) => SHOTS[type]?.meta.duration ?? 120;
