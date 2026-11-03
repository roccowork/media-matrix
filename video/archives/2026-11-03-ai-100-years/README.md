# 归档：一百年后的 AI

- 分镜：`storyboards/2026-11-03-ai-100-years/storyboard.json`（sha256 `dd5e0b71d82d`），14 镜 65.00 秒 @ 30fps
- 代码：media-matrix `e05f724`
- 资产 13 个：cosmos.dysonswarm.v1@1.0.0、cosmos.galaxy.v1@1.0.0、cosmos.galaxyeye.v1@1.0.0、cosmos.galaxynet.v1@1.0.0、cosmos.milkyway.v1@1.0.0、cosmos.mooncore.v1@1.0.0、cosmos.planet.v1@1.0.0、cosmos.seedburst.v1@1.0.0、cosmos.star.v1@1.0.0、tech.citychip.v1@1.0.0、tech.citynet.v1@1.0.0、tech.skyring.v1@1.0.0、tech.thinkearth.v1@1.0.0
- 音效 15 个 + 底噪 sfx/ai100/ambient.mp3
- 渲染：[run 41609749840](https://github.com/roccowork/media-matrix/actions/runs/41609749840)，20 台机器
- 成片：未记录
- 质检：未记录

## 复现

1. git checkout e05f7243f3d750a617b776bccc7fd8a756d93d50
2. cd video && npm ci
3. node tools/shot.mjs validate-storyboard storyboards/2026-11-03-ai-100-years/storyboard.json
4. GitHub Actions：produce.yml，storyboard = storyboards/2026-11-03-ai-100-years/storyboard.json（或 preview.yml 渲染 Storyboard 合成）
5. python3 tools/mix_audio.py storyboards/2026-11-03-ai-100-years/storyboard.json audio.wav
6. 核对：成片 sha256 应与 output.sha256 一致（渲染逐像素确定；编码器版本不同时比较 qc / 时长 / 帧数）
