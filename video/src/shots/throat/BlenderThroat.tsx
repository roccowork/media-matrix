// Blender 镜头：biology.throat.v1（咽喉正中矢状剖面）。配置：shotconfigs/biology.throat.v1.json；渲染：blender/throat_scene.py
// 分镜（第 12 镜）：从中线剖开的头颈部（鼻腔、口腔、咽、喉、气管、食管）；蓝白色气流从鼻子进来往下钻进气管，琥珀色的食物从舌背往后滑进食管——两条路在咽部交叉。
import type {ShotConfig} from '../../engine/shot';
import {makeBlenderSequence} from '../blender/BlenderSequence';
import cfg from '../../../shotconfigs/biology.throat.v1.json';

export const THROAT_SHOT = cfg as unknown as ShotConfig; // JSON 已由 tools/shot.mjs validate 校验
export const BlenderThroat = makeBlenderSequence(THROAT_SHOT);
