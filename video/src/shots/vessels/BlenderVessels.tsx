// Blender 镜头：biology.vessels.v1（全身血管网 + 半透明骨架）。配置：shotconfigs/biology.vessels.v1.json；渲染：blender/vessels_scene.py
// 分镜：远景看全身血管 → 绕到正面 → 推近胸口（心脏、主动脉弓），每次心跳一道光沿动脉往外传。
import type {ShotConfig} from '../../engine/shot';
import {makeBlenderSequence} from '../blender/BlenderSequence';
import cfg from '../../../shotconfigs/biology.vessels.v1.json';

export const VESSELS_SHOT = cfg as unknown as ShotConfig; // JSON 已由 tools/shot.mjs validate 校验
export const BlenderVessels = makeBlenderSequence(VESSELS_SHOT);
