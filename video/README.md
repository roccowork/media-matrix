# 视频组件库（Remotion + Three.js）

自媒体矩阵统一使用的视频动画组件。方案说明见 [视频技术栈](../docs/视频技术栈.md)。

## 快速开始

```bash
cd video
npm install
npm run dev          # 打开 Remotion Studio 预览，可以直接在界面里改参数
```

## 导出

```bash
# 导出完整示例（横屏）
npx remotion render src/index.ts EpisodeDemo out/EpisodeDemo.mp4

# 导出竖屏版（抖音、视频号）
npx remotion render src/index.ts EpisodeDemo-Vertical out/EpisodeDemo-Vertical.mp4

# 导出单个组件，并修改参数
npx remotion render src/index.ts BrandIntro out/intro.mp4 \
  --props='{"episode":"第 03 期","title":"让 AI 读懂 Nginx 日志"}'

# 导出封面或截图
npx remotion still src/index.ts BrandIntro out/cover.png --frame=70
```

**没有显卡的服务器**上渲染 3D 时，加 `--gl=swangle`。

## 「AI 前沿」竖屏短视频（向晓 AI）

**一条命令出成片**（`tools/make_episode.py`）：

1. 在 ops-desk 流水线网页上，展开选中那条的「📋 成片数据」，原样存成 `public/frontier/<日期>/episode.json`（口播稿、分段、每段的画面关键词和文字模板、封面）。改稿的话直接改里面的 `script`
2. `python3 tools/make_episode.py <日期>`，依次自动完成：
   - ElevenLabs 配音（声音「向晓 AI 主讲」，带逐字时间戳；已有 `voice.mp3` 就跳过，不重复扣积分）
   - 逐词字幕（`words.json`）
   - 配空镜（`tools/broll.py`：先查素材库，没有就去 Mixkit 下载、裁成竖屏入库，再没有用抽象画面兜底；改过稿子对不上的段落并到上一段）
   - 画面文字：每段一个模板（标题 / 盖章 / 数字滚动 / 新旧替换 / 玻璃卡片），每个词在配音念到它的时候弹出
   - 渲染成片 `out/ai-frontier-<日期>.mp4` 和封面 `out/cover-<日期>.png`（通用组件 `src/frontier/auto/Auto.tsx`，数据是 `public/frontier/<日期>/auto.json`）

加 `--no-render` 只生成数据，可以先在 Studio 里预览（`Auto` 组件）。渲染用的是系统里的 Chromium，30 秒的视频在 4 核机器上约 10 分钟。

`src/frontier/broll/Episode.tsx` 是第一期手工写的版本，留作参考。

空镜都来自 Mixkit（免费商用、无需署名），来源记录在 `public/broll/library.json` 和 `LICENSE.md`。用得越多，素材库越全，下载越少。

配乐 `public/frontier/bgm.mp3` 和音效（whoosh、pop、chime）都是 ElevenLabs 现场生成的原创音频。

## 「AI 科普」横屏科普（向晓 AI，默认 1 分钟，最长 5 分钟）

**流程**：在私人助理（ops-desk）里发「科普：题目」→ Claude 写口播稿和分镜 → 我在 Telegram 里审稿（「改稿：意见」修改）→ 点「🎬 出片」→ 工作流 `.github/workflows/explainer.yml`：

1. `prepare`：分段配音（ElevenLabs，按段缓存，只改一段就只重配一段）、配横屏空镜、画面元素按口播对时、封面，配音和数据提交回仓库
2. `render`：**8 台机器并行**，各渲染 1/8 的画面（一台机器每分钟成片要渲染约 5 分钟）；第 0 台顺便渲染整条音轨
3. `merge`：ffmpeg 拼接、合成音轨，成片（超过 50MB 才压缩）和封面直接发到 Telegram。**成片不放 GitHub**（不发 Release、不留成片 Artifact）

本地出片：`public/explainer/<编号>/episode.json` 写好后 `python3 tools/make_explainer.py <编号>`（加 `--no-render` 只生成数据，在 Studio 里看 `Explainer`）。格式和画面类型见脚本开头的说明。

- 组件：`src/explainer/Explainer.tsx`（成片）、`ExplainerCover`（16:9 封面）。画面类型：标题、时间线、流程图、左右对比、数字滚动、清单、引言、实拍空镜
- 渲染用 `--gl=swiftshader`，比 `swangle` 快 3 倍以上；画面里不要用 WebGL 特效（`@remotion/effects`）、`backdrop-filter` 和大面积模糊，软件渲染下非常慢
- 横屏空镜存在素材库里，文件名带 `-h`，`library.json` 里标 `"orient": "h"`
- 样片：`public/explainer/sample/`（Studio 的默认数据）

## 镜头库：video-shotcraft（2026-11-02 起）

画面特效统一用 [video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft)（1.6 万星，Apache-2.0）的镜头，**不自己手写特效**。整库在 `src/vendor/shotcraft/`（说明和与上游的差异见那里的 README），在线画廊：https://vincentwei1021.github.io/video-shotcraft/ 。
用法：镜头的运动（缓动、时长、运镜）不改，只换文案、颜色、字体。

## 组件一览

| 组件 | 用途 | 主要参数 |
|---|---|---|
| `BrandIntro` | 品牌片头（3 秒） | `episode`, `title` |
| `BrandOutro` | 品牌片尾（5 秒） | `repo`, `nextTitle` |
| `TitleCard` | 章节标题卡 | `kicker`, `title`, `subtitle` |
| `CodeReveal` | 代码逐行出现，自动适配字号，可高亮重点行 | `code`, `language`, `filename`, `highlightLines` |
| `Terminal` | 终端打字效果 | `lines`（`cmd` 逐字敲出 / `out` 直接显示）, `prompt` |
| `ServerRack3D` | 3D 机房，可以让某个机柜变红告警 | `racks`, `alertRack`, `alertAt`, `label` |
| `Captions` | 字幕条，叠加在任意画面上 | `cues`（单位：秒） |
| `ChatThread` | 聊天对话：员工提问、AI 逐字回答，可带出处和印章 | `messages`, `title`, `fontSize` |
| `Stamp` | 红色印章，从大到小盖下来 | `text`, `at`, `color` |
| `DocChunking` | 文档被切成几段，分开并标色 | `title`, `chunks`, `splitAt` |
| `VectorSearch3D` | 3D 向量空间：提问光点找到最近的几个片段 | `queryAt`, `searchAt`, `k` |
| `SimilarityGauge` | 相似度仪表盘：及格线、红绿灯 | `value`, `threshold`, `at` |
| `CitationHighlight` | 回答 + 原文，依据所在的行高亮 | `answer`, `lines`, `highlight` |
| `SplitCompare` | 左右（竖屏为上下）分屏对比 | `left`, `right` |
| `GateSequence` | 几道关卡依次亮起 | `gates`, `interval` |
| `Background` / `WindowFrame` / `Logo` | 基础元素 | — |

所有组件都同时支持横屏（1920×1080）和竖屏（1080×1920）。

## 目录结构

```
src/
├── brand.ts              # 账号名、配色、字体（改品牌只改这里）
├── Root.tsx              # 注册所有 Composition（横屏 / 竖屏）
├── components/           # 可复用组件
└── compositions/         # 成片示例
    ├── demoData.ts       # 示例数据（第 2 期告警机器人）
    ├── EpisodeDemo.tsx   # 把组件串成一期视频的动画部分
    └── KnowledgeBase.tsx # 知识库问答这期：9 个横屏场景（KB-01～KB-09）+ 竖屏短视频（KB-Short）
```

## 每期视频怎么做

1. 在 `src/compositions/` 下新建 `EpXX.tsx`，参考 `EpisodeDemo.tsx` 用 `<Series>` 拼接组件
2. 在 `Root.tsx` 里注册
3. 导出 mp4 后放进剪映，和录屏、口播一起剪辑
4. 需要新的效果时，就在 `components/` 里新增一个组件，并更新上面的表格

## 注意

- **账号名和口号**：在 `src/brand.ts` 中修改
- **字体**：默认使用系统字体（Noto Sans SC、苹方、微软雅黑等），建议安装 [JetBrains Mono](https://www.jetbrains.com/lp/mono/) 显示代码
- **动画必须由帧驱动**：只用 `useCurrentFrame()`，不要用 CSS 动画或 Three.js 的 `useFrame`，否则导出的画面会抖动或错乱
- **许可证**：Remotion 对个人免费，公司超过 3 人需要购买许可（见官网）
