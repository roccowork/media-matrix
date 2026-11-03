# 项目归档

每条视频一个目录 `archives/<分镜 id>/`，由 `tools/archive.py` 生成（一键出片工作流 produce.yml 会自动生成并提交）：

| 文件 | 内容 |
|---|---|
| manifest.json | 分镜快照哈希、git 提交、每镜资产（版本 / 许可 / 参数 / 种子）、音效清单（含哈希）、渲染记录、成片 sha256 / 时长 / 大小、质检结果、发布记录、复现命令 |
| storyboard.json | 分镜快照 |
| script.md / qc.md | 文案、质检报告（有的话） |
| README.md | 中文摘要 |

成片文件不进仓库；拿到一个视频文件时，用 `sha256sum` 对 manifest 里的 `output.sha256` 核对是不是这一版。
发布后在 manifest 的 `publish` 里补平台、日期、链接（重新归档时会保留）。

补登旧片：`python3 tools/archive.py <storyboard.json> --commit <当时的提交> --run-id <Actions run> --note "..."`
