# 协作约定

## 先问再做（2026-11-02 用户明确要求）
- **触发任何出片 / 渲染工作流（explainer.yml、render.yml、preview.yml、adu.yml 等）、开始制作视频之前，必须先得到用户明确同意**。写好稿子、方案，先给用户看，用户说可以了才触发；不能因为“顺理成章”就自己触发

## GitHub Actions
- 公开仓库的 Actions 免费，但也别浪费：只在需要时触发
- 以后如果要加工作流：
  - 只在必要时触发：限定 `paths`、只对 main 分支触发，或者改成手动触发（`workflow_dispatch`）
  - 能合并的步骤合并到一个 job 里，缓存依赖（比如 `actions/cache`）
  - 视频渲染放在 Actions 里跑（公开仓库免费），只在需要出片时触发
- **渲染一律用 GitHub Actions，按镜头 / 帧段拆成多台机器并行**（2026-11-02 用户明确要求）：成片、样片、测试片都一样，不在会话的虚拟机里渲染视频（只有 4 核，慢几倍，白白耽误时间）。会话里最多渲染几张单帧静图（`remotion still`）检查画面。看现成镜头效果直接用 video-shotcraft 的在线画廊，不重复渲染。现成的工作流：`explainer.yml`（AI 科普）、`render.yml`（AI 前沿）、`preview.yml`（渲染指定的几个镜头拼起来发 Telegram，看新镜头效果用）
- 提交时尽量攒一批改动再一起 push，避免零碎的提交

## 画面特效（2026-11-02 用户确定的方向）
- **做视频前先读 `video/src/science/HANDBOOK.md`（动效原理手册）**，按内容现场设计镜头，代码自己写在 `video/src/science/`
- 原理学自 video-shotcraft（整库在 `video/src/vendor/shotcraft/`，只当参考源码看原理，不在它的模板上改字）
- 只用 Remotion + 代码（three.js / CSS 3D / SVG），不用收费的视频生成模型
- 新学到的手法、踩过的坑，回写进手册

## Notion
- 修改 Notion 不用先问，改完告诉结果即可

## 这是公开仓库
- 只放视频代码和公开素材。**私人的东西（方案、收入和求职计划、声音样本、个人信息）一律放私有仓库 `roccowork/ops-desk`**（自媒体方案在那边的 `docs/plan/media-matrix/`）
- 密钥只放 GitHub Secrets（ELEVENLABS_API_KEY、ELEVENLABS_VOICE_ID 等），不进代码
- 大的方向调整先给方案，用户确认后再改 ops-desk 里的 `docs/plan/media-matrix/总体方案.md`

## 仓库可见性：公开

- 原因：出片要在 GitHub Actions 里渲染，公开仓库免费（私有仓库一条视频约 20 分钟，额度不够）。这里只放视频代码和公开素材；私人方案和声音资料在 ops-desk，2026-11-01 已清理过 git 历史。
- **改变可见性（私有↔公开）前必须先问用户**，不能顺手改；改公开前还要检查文件和 git 历史里有没有私人信息和密钥
