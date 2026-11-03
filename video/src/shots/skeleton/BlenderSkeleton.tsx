// Blender 镜头：biology.skeleton.v1（全身骨架）。配置：shotconfigs/biology.skeleton.v1.json；渲染：blender/skeleton_scene.py
// 分镜：从左前方远景看全身 → 绕到正面 → 推近到头骨和胸廓。
import type {ShotConfig} from '../../engine/shot';
import {makeBlenderSequence} from '../blender/BlenderSequence';
import cfg from '../../../shotconfigs/biology.skeleton.v1.json';

export const SKELETON_SHOT = cfg as unknown as ShotConfig; // JSON 已由 tools/shot.mjs validate 校验
export const BlenderSkeleton = makeBlenderSequence(SKELETON_SHOT);
