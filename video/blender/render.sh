#!/usr/bin/env bash
# 一键渲染 Blender 镜头（Mac / Linux 笔记本，用显卡）。在 video/ 目录下运行：
#   bash blender/render.sh heart             # 心脏，整段
#   bash blender/render.sh skeleton preview  # 骨架，只渲前 5 秒
# 名字 → 场景脚本 blender/<名字>_scene.py、配置 shotconfigs/biology.<名字>.v1.json、Remotion 合成 Blender-<名字首字母大写>
# Blender 不在 PATH 里时：BLENDER=/path/to/blender bash blender/render.sh heart
set -euo pipefail
NAME="${1:?用法：bash blender/render.sh <heart|skeleton|vessels> [preview]}"
BLENDER="${BLENDER:-blender}"
ID="biology.${NAME}.v1"
CFG="shotconfigs/${ID}.json"
COMP="Blender-$(echo "${NAME:0:1}" | tr a-z A-Z)${NAME:1}"
FR=""; RF=""
if [ "${2:-}" = "preview" ]; then FR="--frames 0-149"; RF="--frames=0-149"; fi
node tools/shot.mjs validate "$CFG"
"$BLENDER" -b -P "blender/${NAME}_scene.py" -- --config "$CFG" --out "public/blender/${ID}" --device GPU --samples 96 $FR
npx remotion render src/index.ts "$COMP" "out/blender-${NAME}.mp4" $RF
echo "完成：out/blender-${NAME}.mp4"
