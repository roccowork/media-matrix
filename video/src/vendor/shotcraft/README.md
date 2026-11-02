# video-shotcraft 镜头（第三方，Apache-2.0）

来源：https://github.com/Vincentwei1021/video-shotcraft （commit 1266a3ec4831289c4d893d42dd5102723658039a）的 `demos/`，作者 Vincent Wei，许可证见同目录 `LICENSE`（Apache-2.0）。

- `_fixtures/` 和各镜头目录按原样复制；**动效（缓动、时长、运镜）不改**，只在我们自己的场景文件里换文案、颜色、字体（改动处会注明）
- 在线画廊（每个镜头的效果预览）：https://vincentwei1021.github.io/video-shotcraft/
- 新加镜头：从上游 `demos/<分类>/<镜头名>/` 复制到这里的同名路径，连同它用到的 `_fixtures`

## 和上游的差异（Apache-2.0 第 4 条要求注明修改）

- 整库复制了 `demos/` 下除 `_legacy/` 以外的全部镜头；`_textures/` 里的截图放在 `video/public/textures/live/`，`live-layout.json` 放在 `_textures/`
- `ui-entrance/clipcard-looping/ClipCardLooping.tsx`：import 路径改成 `../../_assets_lib/ClipCard`（上游在 `assets/lib/`）
- 8 个文件首行加了 `// @ts-nocheck`：只有未使用变量的类型告警，源码不改
- 其余文件与上游一致

## 怎么看

- Studio（`npm run dev`）里的 **Shotcraft** 文件夹：全部原版镜头（`SC-组件名`），以及挑出来的 32 个高能镜头串成的样片 `Shotcraft-Reel`（`src/showcase/ShotcraftReel.tsx`，左下角标编号）
