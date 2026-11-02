# 科普视频引擎（第一阶段）

依据：ops-desk `docs/plan/media-matrix/AI科普视频程序化制作引擎-方案(ChatGPT).docx`；审查与设计：同目录 `视频引擎-审查与第一阶段设计.md`。

## 结构
```
src/engine/
  shot.ts            ShotConfig 类型（与 schemas/shot.schema.json 一致）
  camera/rigs.ts     相机：按秒关键帧 + smootherstep；dolly / orbit 预设
  core/Stage.tsx     舞台：ThreeCanvas + 按帧相机 + 可开关后期
                     （确定性镜头虚化、辉光、色散、ACES / AgX、暗角、按帧颗粒）
  assets/            资产库：types.ts（元数据字段）、registry.ts（登记表 + 参数校验）、AssetView.tsx
src/assets/          程序化资产本体（cosmos/blackhole、cosmos/stardust …）
src/shots/           镜头（读取 shotconfigs/*.json，引用资产）
shotconfigs/         镜头配置 JSON（以后 AI 生成的就是这个）
schemas/             shot.schema.json
tools/shot.mjs       validate / keyframes / determinism
public/assets/thumbs 资产缩略图
```

## 用法
```bash
cd video
npm ci
node tools/shot.mjs validate shotconfigs/cosmos.blackhole.v1.json            # 校验配置
node tools/shot.mjs keyframes Shot-BlackHole 0,200,330,440 out/kf             # 关键帧预览（云端默认 --gl=swangle）
node tools/shot.mjs keyframes Shot-BlackHole 0,200,330,440 out/kf --gl=angle  # 有显卡的笔记本
node tools/shot.mjs determinism Shot-BlackHole 330                           # 同一帧渲染两次，逐字节比对
# 以下出视频的命令，需用户同意后才执行：
npx remotion render src/index.ts Shot-BlackHole out/bh-540p.mp4 --scale=0.5 --gl=angle   # 低分辨率预览
npx remotion render src/index.ts Shot-BlackHole out/blackhole.mp4 --gl=angle             # 1080p 成片
```

## 加一个新镜头
1. 需要的资产先在 `src/engine/assets/registry.ts` 登记（程序化资产写组件 + 参数范围；文件资产写路径 + 许可证 + 出处）。
2. 写 `shotconfigs/<id>.json`，跑 `validate`。
3. 在 `src/shots/` 写镜头组件（读 JSON → `<Stage>` + `<AssetView>`），在 `src/Root.tsx` 的 Shots 文件夹注册 Composition。
4. `keyframes` 出 3–5 张关键帧给用户验收；用户同意后才出预览 / 成片。

## 依赖（锁定，不随意升级）
remotion / @remotion/three 4.0.538 · three 0.180.0 · @react-three/fiber 9.4.0 · @react-three/drei 10.7.9 ·
postprocessing 6.38.0 · @react-three/postprocessing 3.0.4 · react 19.2.0 · ajv 8.20.0（校验）

## 已知问题 / 约束
- 不要用 @react-three/postprocessing 的 DepthOfField：Remotion 截帧时焦点变化会让物体整个消失。景深用 `post.dof`（film/lensblur）。
- 开了后期时蒙皮动画模型会时有时无：用 `grok3d/components/bakeSkin.ts` 烘焙。
- 模型 / 贴图 / 字体一律在画布外 `delayRender` 预加载（Suspense 加载完不会重绘）。
- 云端没有显卡：黑洞 1080p 一帧约 35–90 秒（swangle）；整段渲染放用户笔记本（`--gl=angle`）或 Actions 多机并行。
- 随机数一律用 Remotion 的 `random(seed)`；同帧确定性已用 `determinism` 验证（黑洞第 330 帧逐字节一致）。

## 资产（第一批，见 registry.ts）
| id | 类型 | 许可 |
|---|---|---|
| cosmos.blackhole.v1 | 程序化（光线步进 Shader） | 自研 |
| cosmos.stardust.v1 | 程序化（粒子） | 自研 |
| tech.robot.expressive.v1 | 文件（GLB，14 个动作） | CC0 |
| biology.cat.lowpoly.v1 | 文件（FBX） | CC0 |
