# 解剖模型（第三方，CC BY-SA 4.0）

| 文件 | 内容 | 来源 | 许可证 |
|---|---|---|---|
| heart.glb | 心脏（四腔、瓣膜、乳头肌、冠状动静脉）+ 升主动脉 / 主动脉弓 / 头臂干、肺动脉干及左右肺动脉、四条肺静脉、上 / 下腔静脉 | [Z-Anatomy](https://github.com/LluisV/Z-Anatomy) `Resources/Models/FBX/CardioVascular41.fbx`，用 `blender/extract_heart.py` 提取（只保留上述部件、去掉材质、居中、放大 10 倍） | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| skeleton.glb | 全身骨架（骨头、牙齿、肋软骨；去掉韧带、肌肉附着区贴片、喉 / 鼻软骨、听小骨），真实尺寸（米，身高约 1.70），原点在两脚之间的地面（见 body_frame.json） | [Z-Anatomy](https://github.com/LluisV/Z-Anatomy) `Resources/Models/FBX/SkeletalSystem100.fbx`，用 `blender/extract_skeleton.py` 提取、减面 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| vessels.glb | 全身血管网：动脉（Arterial system）+ 静脉（Venous system）+ 心脏，每件带 kind 分类（artery / vein / pulmonary_artery / pulmonary_vein / heart），真实尺寸，与骨架同一原点 | [Z-Anatomy](https://github.com/LluisV/Z-Anatomy) `Resources/Models/FBX/CardioVascular41.fbx`，用 `blender/extract_vessels.py` 提取、减面 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |

| neck.glb | 颈胸部：左右迷走神经、升主动脉 / 主动脉弓 / 胸主动脉 / 头臂干 / 颈总动脉 / 锁骨下动脉、肺动脉干及左右肺动脉、上腔静脉 / 头臂静脉、心脏、气管 / 主支气管、甲状 / 环状 / 杓状软骨、会厌、舌骨、食管 / 喉咽、甲状腺；每件带 kind 分类，真实尺寸，与骨架同一原点（喉返神经不在模型里，由 `blender/rln_scene.py` 按解剖走法画） | [Z-Anatomy](https://github.com/LluisV/Z-Anatomy) `Resources/Models/FBX/` NervousSystem100 / CardioVascular41 / VisceralSystem100 / SkeletalSystem100，用 `blender/extract_neck.py` 提取、减面 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |

**署名要求**：用到这些模型的视频，在简介或片尾写「3D 模型：Z-Anatomy（CC BY-SA 4.0）」。
**相同方式共享**：对模型文件本身的修改（如这里的 heart.glb）也按 CC BY-SA 4.0 公开（本仓库是公开仓库，满足要求）。
