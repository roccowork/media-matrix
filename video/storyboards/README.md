# 分镜（Storyboard）

一条视频一个目录：`<日期-选题英文短名>/storyboard.json`（Schema：`schemas/storyboard.schema.json`）。
- `generator.by = "hand"`：人工手写（示例 / 修改稿）；`"ai"`：AI 生成（`tools/storyboard.py`）
- 校验：`node tools/shot.mjs validate-storyboard storyboards/<id>/storyboard.json`
- 制作前用户先审：旁白稿 + `facts`（待核验事实）+ 预览总览图

`2026-11-03-heart-circulation/` 是**手写示例**（方案第十五节第 10 条「示例配置」），不是模型输出，用来验证校验、预览和单镜重渲染。
