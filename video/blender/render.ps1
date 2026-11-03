# 一键渲染 Blender 镜头（Windows 笔记本，用显卡）。在 video\ 目录下用 PowerShell 运行：
#   .\blender\render.ps1 heart             # 心脏，整段
#   .\blender\render.ps1 skeleton preview  # 骨架，只渲前 5 秒
# Blender 路径不同时先设：$env:BLENDER = "C:\Program Files\Blender Foundation\Blender 4.2\blender.exe"
param([Parameter(Mandatory = $true)][string]$name, [string]$mode = "")
$ErrorActionPreference = "Stop"
$blender = if ($env:BLENDER) { $env:BLENDER } else { "C:\Program Files\Blender Foundation\Blender 4.2\blender.exe" }
$id = "biology.$name.v1"
$cfg = "shotconfigs/$id.json"
$comp = "Blender-" + $name.Substring(0, 1).ToUpper() + $name.Substring(1)
$fr = @(); $rf = @()
if ($mode -eq "preview") { $fr = @("--frames", "0-149"); $rf = @("--frames=0-149") }
node tools/shot.mjs validate $cfg
if ($LASTEXITCODE -ne 0) { exit 1 }
& $blender -b -P "blender/${name}_scene.py" -- --config $cfg --out "public/blender/$id" --device GPU --samples 96 @fr
if ($LASTEXITCODE -ne 0) { exit 1 }
npx remotion render src/index.ts $comp "out/blender-$name.mp4" @rf
Write-Host "完成：out/blender-$name.mp4"
