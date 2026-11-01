# 协作约定

## GitHub Actions
- 公开仓库的 Actions 免费，但也别浪费：只在需要时触发
- 以后如果要加工作流：
  - 只在必要时触发：限定 `paths`、只对 main 分支触发，或者改成手动触发（`workflow_dispatch`）
  - 能合并的步骤合并到一个 job 里，缓存依赖（比如 `actions/cache`）
  - 视频渲染放在 Actions 里跑（公开仓库免费），只在需要出片时触发
- 提交时尽量攒一批改动再一起 push，避免零碎的提交

## Notion
- 修改 Notion 不用先问，改完告诉结果即可

## 这是公开仓库
- 只放视频代码和公开素材。**私人的东西（方案、收入和求职计划、声音样本、个人信息）一律放私有仓库 `roccowork/ops-desk`**（自媒体方案在那边的 `docs/plan/media-matrix/`）
- 密钥只放 GitHub Secrets（ELEVENLABS_API_KEY、ELEVENLABS_VOICE_ID 等），不进代码
- 大的方向调整先给方案，用户确认后再改 ops-desk 里的 `docs/plan/media-matrix/总体方案.md`
