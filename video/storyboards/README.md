# 分镜（Storyboard）——方案第十三节第 3 周「AI 分镜」

一条视频一个目录：`<日期-选题英文短名>/`
- `storyboard.json`：分镜（Schema：`schemas/storyboard.schema.json`）= 选题 + 待核验事实 + 首尾相接的镜头，每镜一个完整 ShotConfig
- `script.md`：给人审的旁白稿（镜号 / 秒数 / 旁白 / 画面 / 资产 / 示意说明）+ 待核验事实清单
- `preview/`：每镜关键帧和总览图（不进 git）
- `generator.by`：`ai` = 模型生成（`tools/storyboard.py`）；`hand` = 人工手写

## 流程
1. **生成**（二选一）
   - GitHub Actions → `storyboard` 工作流 → 填选题 → 自动生成、校验、出总览图、提交回仓库、发 Telegram
   - 本地：`OPENROUTER_API_KEY=… python3 tools/storyboard.py --topic "选题"`
2. **审稿**：看 `script.md`（旁白、事实逐条核对）和总览图；要改就直接改 `storyboard.json`（改完 `generator.by` 改成 `hand`）
3. **校验**：`node tools/shot.mjs validate-storyboard storyboards/<id>/storyboard.json`
   （Schema、每镜 3–8 秒、总长 60–90 秒、旁白 ≤ 5 字每秒、资产 id、参数范围、渲染器能力、版本、真实比例示意须写 note）
4. **预览**：`node tools/shot.mjs storyboard-preview storyboards/<id>/storyboard.json`
5. **单镜重渲**：`node tools/shot.mjs storyboard-shot storyboards/<id>/storyboard.json 5`（只重渲第 5 镜）
6. 出视频（需用户同意）：Remotion 合成 `Storyboard`（整条）/ `SB-Shot`（单镜），`--props` 传分镜；Blender 镜头用 `blender/<名字>_scene.py` 按该镜 config 在笔记本上渲染

## 生成器怎么保证不乱来
- 模型只输出 JSON（不写代码）；资产只能从 `node tools/shot.mjs catalog` 导出的目录里选（含每个资产的参考镜头）
- 不通过校验就把错误原样交回模型修，最多 2 轮；仍不通过则失败，分镜留给人看
- 事实一律标「待核验」，用户审过才进入制作

`2026-11-03-heart-circulation/` 是**手写示例**（方案第十五节第 10 条「示例配置」），不是模型输出。
