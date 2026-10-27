# 协作约定

## GitHub Actions 省着用（免费额度每月 2000 分钟）
- 本仓库目前**没有** Actions 工作流，push 不消耗额度
- 以后如果要加工作流：
  - 只在必要时触发：限定 `paths`、只对 main 分支触发，或者改成手动触发（`workflow_dispatch`）
  - 能合并的步骤合并到一个 job 里，缓存依赖（比如 `actions/cache`）
  - 视频渲染这类耗时任务放在本地跑，不放进 Actions
- 提交时尽量攒一批改动再一起 push，避免零碎的提交

## Notion
- 修改 Notion 不用先问，改完告诉结果即可

## 方案文档
- 大的方向调整先给方案，用户确认后再改 `docs/总体方案.md`
