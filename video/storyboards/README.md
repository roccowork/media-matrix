# 分镜（Storyboard）——方案第十三节第 3 周「AI 分镜」

一条视频一个目录：`<日期-选题英文短名>/`
- `storyboard.json`：分镜（Schema：`schemas/storyboard.schema.json`）= 选题 + 待核验事实 + 首尾相接的镜头，每镜一个完整 ShotConfig
- `script.md`：给人审的旁白稿（镜号 / 秒数 / 旁白 / 画面 / 资产 / 示意说明）+ 待核验事实清单
- `preview/`：每镜关键帧和总览图（不进 git）
- `generator.by`：`ai` = 模型生成（`tools/storyboard.py`）；`hand` = 人工手写

## 流程
1. **生成**（主要方式：**直接和 Claude Code 对话**——给选题，Claude 写分镜 JSON、当场校验和出预览，见 ops-desk《方案补充》#16；下面两种是备用）
   - GitHub Actions → `storyboard` 工作流 → 填选题 → 自动生成、校验、出总览图、提交回仓库、发 Telegram
   - 本地：`OPENROUTER_API_KEY=… python3 tools/storyboard.py --topic "选题"`
2. **审稿**：看 `script.md`（旁白、事实逐条核对）和总览图；要改就直接改 `storyboard.json`（改完 `generator.by` 改成 `hand`）
3. **校验**：`node tools/shot.mjs validate-storyboard storyboards/<id>/storyboard.json`
   （Schema、每镜 3–8 秒、总长 60–90 秒、旁白 ≤ 5 字每秒、资产 id、参数范围、渲染器能力、版本、真实比例示意须写 note）
4. **预览**：`node tools/shot.mjs storyboard-preview storyboards/<id>/storyboard.json`
5. **单镜重渲**：`node tools/shot.mjs storyboard-shot storyboards/<id>/storyboard.json 5`（只重渲第 5 镜）
6. **一键出片（需用户同意才触发）**：GitHub Actions → `produce` 工作流 → 填 `storyboard`（如 `storyboards/<id>/storyboard.json`），自动：
   校验分镜 → 按帧拆给最多 20 台机器渲染 `Storyboard` 合成 → 拼接 → `tools/mix_audio.py` 混音 → `tools/qc.py` 质检 → `tools/archive.py` 归档提交回 main（`archives/<id>/`）→ 成片 + 质检报告发 Telegram（成片在 Actions 产物里保留 7 天）
   - 只是看几个新镜头效果，用 `preview` 工作流；Blender 镜头用 `blender/<名字>_scene.py` 按该镜 config 在笔记本上渲染
7. **质检**（本地也能跑）：`python3 tools/qc.py 成片.mp4 storyboards/<id>/storyboard.json [输出目录]`
   - 错误（退出码 1）：时长帧数对不上、字卡超框、真峰值 > 0 dBTP（爆音）
   - 提醒：分镜没安排的黑帧、画面静止 > 1.5 秒、字号 < 36px、字卡底色太亮 / 可能压住主体、峰值 > -1 dBTP、响度 < -30 LUFS、无声 > 2 秒
   - 分镜里有意的黑场 / 静音（开场 1.5 秒、eyelid 转场、`audio.ambient.mute`）只记「正常」
8. **归档**：见 `archives/README.md`；发布后在 manifest 的 `publish` 里补平台 / 日期 / 链接

## 生成器怎么保证不乱来
- 模型只输出 JSON（不写代码）；资产只能从 `node tools/shot.mjs catalog` 导出的目录里选（含每个资产的参考镜头）
- 不通过校验就把错误原样交回模型修，最多 2 轮；仍不通过则失败，分镜留给人看
- 事实一律标「待核验」，用户审过才进入制作

`2026-11-03-heart-circulation/` 是**手写示例**（方案第十五节第 10 条「示例配置」），不是模型输出。
