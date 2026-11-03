# 一键渲染 Blender 心脏镜头（Windows 笔记本，用显卡）。在 video\ 目录下用 PowerShell 运行：
#   .\blender\render_heart.ps1            # 整段 10 秒
#   .\blender\render_heart.ps1 preview    # 只渲前 5 秒预览
# Blender 路径不同时先设：$env:BLENDER = "C:\Program Files\Blender Foundation\Blender 4.2\blender.exe"
param([string]$mode = "")
$ErrorActionPreference = "Stop"
$blender = if ($env:BLENDER) { $env:BLENDER } else { "C:\Program Files\Blender Foundation\Blender 4.2\blender.exe" }
$cfg = "shotconfigs/biology.heart.v1.json"
$fr = @(); $rf = @()
if ($mode -eq "preview") { $fr = @("--frames", "0-149"); $rf = @("--frames=0-149") }
node tools/shot.mjs validate $cfg
if ($LASTEXITCODE -ne 0) { exit 1 }
& $blender -b -P blender/heart_scene.py -- --config $cfg --out public/blender/biology.heart.v1 --device GPU --samples 96 @fr
if ($LASTEXITCODE -ne 0) { exit 1 }
npx remotion render src/index.ts Blender-Heart out/blender-heart.mp4 @rf
Write-Host "完成：out/blender-heart.mp4"
