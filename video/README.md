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
