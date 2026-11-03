// Blender 镜头：biology.heart.v1（心脏）。配置：shotconfigs/biology.heart.v1.json；渲染：blender/heart_scene.py
import type {ShotConfig} from '../../engine/shot';
import {makeBlenderSequence} from '../blender/BlenderSequence';
import cfg from '../../../shotconfigs/biology.heart.v1.json';

export const HEART_SHOT = cfg as unknown as ShotConfig; // JSON 已由 tools/shot.mjs validate 校验
export const BlenderHeart = makeBlenderSequence(HEART_SHOT);
