// 资产库登记表：所有可复用资产都在这里登记（id → 元数据 + 组件 / 文件路径）。
// 镜头通过 asset_id 引用资产；AI 生成的 ShotConfig 只能引用这里有的 id，参数必须在 params 范围内（validateAssetParams）。
// 第三方文件资产必须写清许可证和出处。
import type React from 'react';
import type {AssetMeta} from './types';
import {BlackHoleAsset} from '../../assets/cosmos/blackhole/BlackHoleAsset';
import {StardustAsset} from '../../assets/cosmos/stardust/StardustAsset';

const C = <P,>(c: React.FC<P>) => c as unknown as React.FC<Record<string, unknown>>;

export const ASSETS: AssetMeta[] = [
  {
    asset_id: 'cosmos.blackhole.v1',
    asset_name: '黑洞（吸积盘 + 引力透镜）',
    category: 'cosmos',
    kind: 'procedural',
    renderer: 'threejs',
    component: C(BlackHoleAsset),
    params: {
      diskGain: {type: 'number', default: 0.55, min: 0.05, max: 2, desc: '吸积盘亮度'},
      spin: {type: 'number', default: 1, min: 0, max: 4, desc: '吸积盘转速倍数'},
      steps: {type: 'number', default: 320, min: 120, max: 400, desc: '光线步进步数（越大越精细越慢）'},
      nearDimming: {type: 'boolean', default: true, desc: '镜头靠近时自动压亮度'},
    },
    effects: ['accretion_disk', 'gravitational_lensing', 'nebula', 'starfield'],
    camera_presets: ['fly_through（俯看飞入）', 'orbit（盘面上方环绕）'],
    lighting_preset: '自发光（无需灯光）',
    thumbnail: 'assets/thumbs/cosmos.blackhole.v1.jpg',
    license: 'own（自研 Shader）',
    version: '1.0.0',
    notes: '画面约定：黑洞 rs = 1，盘在 y=0 平面、半径 2.4–30；镜头距离 10–80 效果最好',
  },
  {
    asset_id: 'cosmos.stardust.v1',
    asset_name: '前景星尘（视差速度感）',
    category: 'cosmos',
    kind: 'procedural',
    renderer: 'threejs',
    component: C(StardustAsset),
    params: {
      count: {type: 'number', default: 2600, min: 200, max: 20000, desc: '粒子数'},
      spread: {type: 'number', default: 16, min: 2, max: 60, desc: '路线两侧散布宽度'},
      size: {type: 'number', default: 0.06, min: 0.01, max: 0.5, desc: '粒子大小'},
      warmRatio: {type: 'number', default: 0.5, min: 0, max: 1, desc: '暖色粒子占比'},
    },
    effects: ['particle_field'],
    thumbnail: 'assets/thumbs/cosmos.blackhole.v1.jpg',
    license: 'own',
    version: '1.0.0',
    notes: '需要传 from / to（镜头路线起止点）',
  },
  {
    asset_id: 'tech.robot.expressive.v1',
    asset_name: '卡通机器人（14 个动作）',
    category: 'tech',
    kind: 'file',
    renderer: 'threejs',
    model_path: 'models/RobotExpressive.glb',
    effects: ['skeletal_animation'],
    license: 'CC0（Tomás Laulhé / Quaternius，three.js 示例模型）',
    source: 'https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive',
    version: '1.0.0',
    notes: '动作：Dance Death Idle Jump No Punch Running Sitting Standing ThumbsUp Walking WalkJump Wave Yes；渲染时用 bakeSkin 烘焙',
  },
  {
    asset_id: 'biology.cat.lowpoly.v1',
    asset_name: '低多边形小猫（Idle / Walking）',
    category: 'biology',
    kind: 'file',
    renderer: 'threejs',
    model_path: 'models/quaternius/Cat.fbx',
    license: 'CC0（Quaternius Animal Pack Vol.2）',
    source: 'https://opengameart.org/content/animated-animales-low-poly',
    version: '1.0.0',
  },
];

export const getAsset = (id: string): AssetMeta => {
  const a = ASSETS.find((x) => x.asset_id === id);
  if (!a) throw new Error(`资产库里没有 ${id}`);
  return a;
};

/** 校验镜头给资产的参数：未登记的参数、超范围、类型不对都报错（AI 生成的配置必须先过这一关） */
export const validateAssetParams = (id: string, params: Record<string, unknown> = {}): string[] => {
  const a = getAsset(id);
  const errs: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    const spec = a.params?.[k];
    if (!spec) {
      if (!['from', 'to', 'seed'].includes(k)) errs.push(`${id}: 未登记的参数 ${k}`);
      continue;
    }
    if (spec.type === 'number' && (typeof v !== 'number' || v < spec.min || v > spec.max)) errs.push(`${id}.${k} = ${String(v)}，应在 ${spec.min}–${spec.max}`);
    if (spec.type === 'boolean' && typeof v !== 'boolean') errs.push(`${id}.${k} 应为 true / false`);
  }
  return errs;
};
