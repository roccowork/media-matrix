#!/usr/bin/env bash
# 一键渲染 Blender 心脏镜头（Mac / Linux 笔记本，用显卡）。在 video/ 目录下运行：
#   bash blender/render_heart.sh            # 整段 10 秒
#   bash blender/render_heart.sh preview    # 只渲前 5 秒预览
# Blender 不在 PATH 里时：BLENDER=/path/to/blender bash blender/render_heart.sh
set -euo pipefail
BLENDER="${BLENDER:-blender}"
CFG=shotconfigs/biology.heart.v1.json
FR=""; RF=""
if [ "${1:-}" = "preview" ]; then FR="--frames 0-149"; RF="--frames=0-149"; fi
node tools/shot.mjs validate "$CFG"
"$BLENDER" -b -P blender/heart_scene.py -- --config "$CFG" --out public/blender/biology.heart.v1 --device GPU --samples 96 $FR
npx remotion render src/index.ts Blender-Heart out/blender-heart.mp4 $RF
echo "完成：out/blender-heart.mp4"
