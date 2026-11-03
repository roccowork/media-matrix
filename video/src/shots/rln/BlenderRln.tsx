// Blender 镜头：biology.rln.v1（喉返神经的绕远路）。配置：shotconfigs/biology.rln.v1.json；渲染：blender/rln_scene.py
// 分镜：从左前方看颈部和上胸部（喉、气管、食管、主动脉弓、心脏）→ 一道光沿迷走神经往下 → 拐进喉返神经，从主动脉弓下面钩过 → 折回往上，沿气管旁边回到喉咙；镜头绕到左侧看清这段弯路。
import type {ShotConfig} from '../../engine/shot';
import {makeBlenderSequence} from '../blender/BlenderSequence';
import cfg from '../../../shotconfigs/biology.rln.v1.json';

export const RLN_SHOT = cfg as unknown as ShotConfig; // JSON 已由 tools/shot.mjs validate 校验
export const BlenderRln = makeBlenderSequence(RLN_SHOT);
