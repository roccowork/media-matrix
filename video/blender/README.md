# Blender 离线渲染（方案第七节 / 第十三节第 2 周）

Three.js 管实时程序化 3D；**Blender 管复杂模型、真实材质和高质量离线渲染**（人体器官、骨骼等）。
Blender 由 Python 脚本全自动调度，不需要打开界面。

## 流程（以心脏为例）
```
shotconfigs/biology.heart.v1.json   ← 与 Three.js 镜头同一套 ShotConfig（renderer = "blender"），tools/shot.mjs validate 校验
        │
blender/heart_scene.py              ← 导入模型 → 按部件名指定材质 → 布光 → 逐帧心跳 + 相机（与 rigs.ts 同一插值）→ Cycles 渲染
        │
public/blender/biology.heart.v1/frame_0000.png …   （不进 git）
        │
Remotion 合成 Blender-Heart（src/shots/heart/BlenderHeart.tsx）← 逐帧显示 + 叠加 post 的暗角 / 颗粒 → mp4
```

## 文件
| 文件 | 作用 |
|---|---|
| `extract_heart.py` | 从 Z-Anatomy 的心血管 FBX 提取心脏 + 大血管 → `public/assets/models/anatomy/heart.glb`（只需跑一次） |
| `heart_scene.py` | 场景脚本：读 ShotConfig，渲染 PNG 序列；`--determinism 帧号` 做确定性检查 |
| `render_heart.ps1` / `render_heart.sh` | 笔记本一键渲染（Windows / Mac·Linux）：校验 → Blender 渲染 → Remotion 合成 |

## 在笔记本上渲染（需要用户同意后才出片）
1. 装 Blender 4.2 或更新版本（https://www.blender.org/download/ ），装好 Node（video 目录 `npm ci`）
2. 在 `video/` 目录：
   - Windows：`.\blender\render_heart.ps1 preview`（5 秒预览）或不带参数（整段）
   - Mac / Linux：`bash blender/render_heart.sh preview`
3. 结果在 `out/blender-heart.mp4`

参考耗时（6G 显存显卡，1080p、96 采样、OptiX / CUDA）：每帧几秒，5 秒预览约 10 分钟以内。

## 云端会话里（没有显卡）
只出单帧检查画面：`pip install bpy==5.2.3`（Python 3.13；Blender 官网被网络策略挡了，PyPI 可以），然后
```
python blender/heart_scene.py --config shotconfigs/biology.heart.v1.json --out /tmp/heart --frames 0,150,290 --scale 0.5 --samples 48 --device CPU
python blender/heart_scene.py --config shotconfigs/biology.heart.v1.json --out /tmp/x --determinism 150 --scale 0.5 --samples 32 --device CPU
```
半分辨率 48 采样一帧约 15 秒（4 核 CPU）。

## 确定性
心跳、相机都是时间的函数，没有随机数；Cycles 固定 seed、不开动画种子。同一帧渲两次**逐像素一致**（已验证）。
注意 Cycles 会把渲染耗时写进 PNG 元数据，所以文件字节不同，比对要比像素（`--determinism` 就是这样做的）。
不同机器 / CPU 与 GPU 之间会有细微噪点差异，同一视频的帧要在同一台机器上渲完。

## 新增一个 Blender 资产
1. 找开源模型（记录来源和许可证），写提取脚本存成 GLB 放 `public/assets/models/<类别>/`，同目录 README 写署名
2. `src/engine/assets/registry.ts` 登记（kind: 'file'，renderer: 'blender'，params 写清范围）
3. 写场景脚本（可参考 heart_scene.py）、ShotConfig、Remotion 合成，Root.tsx 注册 `Blender-<名字>`
