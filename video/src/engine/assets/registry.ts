// 资产库登记表：所有可复用资产都在这里登记（id → 元数据 + 组件 / 文件路径）。
// 镜头通过 asset_id 引用资产；AI 生成的 ShotConfig 只能引用这里有的 id，参数必须在 params 范围内（validateAssetParams）。
// 第三方文件资产必须写清许可证和出处。
import type React from 'react';
import type {AssetMeta} from './types';
import {BlackHoleAsset} from '../../assets/cosmos/blackhole/BlackHoleAsset';
import {StardustAsset} from '../../assets/cosmos/stardust/StardustAsset';
import {NeuronAsset} from '../../assets/biology/neuron/NeuronAsset';
import {AxonAsset} from '../../assets/biology/axon/AxonAsset';
import {NeuralWebAsset} from '../../assets/biology/neural_web/NeuralWebAsset';
import {ChipAsset} from '../../assets/tech/chip/ChipAsset';

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
      seed: {type: 'seed', default: 0, desc: '种子：每个视频用不同的值（星云形状、吸积盘纹理随之变化；同一值永远同一画面）'},
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
      from: {type: 'vec3', default: [14, 46, 52], desc: '路线起点'},
      to: {type: 'vec3', default: [-3, 15, 16], desc: '路线终点'},
      seed: {type: 'seed', default: 'dust', desc: '种子：形状 / 布局 / 纹理随之变化（同一种子画面永远不变；每个视频用自己的种子，如视频编号）'},
    },
    effects: ['particle_field'],
    thumbnail: 'assets/thumbs/cosmos.blackhole.v1.jpg',
    license: 'own',
    version: '1.0.0',
    notes: '需要传 from / to（镜头路线起止点）',
  },
  {
    asset_id: 'biology.neuron.v1',
    asset_name: '神经元（凹凸胞体 + 分叉树突，可激活）',
    category: 'biology',
    kind: 'procedural',
    renderer: 'threejs',
    component: C(NeuronAsset),
    params: {
      position: {type: 'vec3', default: [0, 0, 0], desc: '位置'},
      radius: {type: 'number', default: 0.55, min: 0.1, max: 3, desc: '胞体半径'},
      dendrites: {type: 'number', default: 9, min: 2, max: 24, desc: '树突数量'},
      reach: {type: 'number', default: 3.2, min: 0.5, max: 10, desc: '树突长度'},
      activateAt: {type: 'number', default: -1, min: -1, max: 600, desc: '激活时刻（秒，-1 不激活）'},
      membrane: {type: 'color', default: '#4f8fff', desc: '膜的颜色'},
      glow: {type: 'color', default: '#ffae42', desc: '激活辉光颜色'},
      seed: {type: 'seed', default: 'n0', desc: '种子：形状 / 布局 / 纹理随之变化（同一种子画面永远不变；每个视频用自己的种子，如视频编号）'},
    },
    effects: ['fresnel_membrane', 'activation_glow', 'dendrite_pulse'],
    license: 'own',
    version: '1.0.0',
  },
  {
    asset_id: 'biology.axon.v1',
    asset_name: '轴突信号（电脉冲 + 火花 + 突触爆光）',
    category: 'biology',
    kind: 'procedural',
    renderer: 'threejs',
    component: C(AxonAsset),
    params: {
      from: {type: 'vec3', default: [0, 0, 0], desc: '起点（发出信号的神经元）'},
      to: {type: 'vec3', default: [4, 0, 0], desc: '终点（接收信号的神经元）'},
      start: {type: 'number', default: 1, min: 0, max: 600, desc: '信号出发时刻（秒）'},
      duration: {type: 'number', default: 3, min: 0.2, max: 30, desc: '传到终点用时（秒）'},
      thickness: {type: 'number', default: 0.07, min: 0.01, max: 0.5, desc: '粗细'},
      membrane: {type: 'color', default: '#4f8fff', desc: '膜的颜色'},
      glow: {type: 'color', default: '#ffae42', desc: '信号颜色'},
      seed: {type: 'seed', default: 'ax', desc: '种子：形状 / 布局 / 纹理随之变化（同一种子画面永远不变；每个视频用自己的种子，如视频编号）'},
    },
    effects: ['signal_pulse', 'sparks', 'synapse_burst'],
    license: 'own',
    version: '1.0.0',
  },
  {
    asset_id: 'biology.neural_web.v1',
    asset_name: 'GPU 粒子神经网（24 万光点，激活波）',
    category: 'biology',
    kind: 'procedural',
    renderer: 'threejs',
    component: C(NeuralWebAsset),
    params: {
      center: {type: 'vec3', default: [0, 0, 0], desc: '中心'},
      radius: {type: 'number', default: 8, min: 1, max: 60, desc: '范围半径'},
      fibers: {type: 'number', default: 480, min: 20, max: 4000, desc: '纤维条数'},
      perFiber: {type: 'number', default: 500, min: 50, max: 2000, desc: '每条纤维的光点数'},
      waveOrigin: {type: 'vec3', default: [0, 0, 0], desc: '激活波起点'},
      waveStart: {type: 'number', default: 0, min: 0, max: 600, desc: '激活波出发时刻（秒）'},
      waveSpeed: {type: 'number', default: 2.5, min: 0.1, max: 50, desc: '激活波速度（单位/秒）'},
      size: {type: 'number', default: 0.045, min: 0.005, max: 0.5, desc: '光点大小'},
      warm: {type: 'color', default: '#ff9a3c', desc: '激活后的暖色'},
      cool: {type: 'color', default: '#3b7bff', desc: '静息的冷色'},
      seed: {type: 'seed', default: 'web', desc: '种子：形状 / 布局 / 纹理随之变化（同一种子画面永远不变；每个视频用自己的种子，如视频编号）'},
    },
    effects: ['gpu_particles', 'activation_wave'],
    license: 'own',
    version: '1.0.0',
    notes: '粒子位置全部在顶点着色器里按时间计算（GPU 粒子），CPU 零开销',
  },
  {
    asset_id: 'tech.chip.v1',
    asset_name: 'AI 芯片（电路板 + 封装 + 硅晶片 + 金线 + 数据脉冲）',
    category: 'tech',
    kind: 'procedural',
    renderer: 'threejs',
    component: C(ChipAsset),
    params: {
      pulseSpeed: {type: 'number', default: 0.35, min: 0, max: 3, desc: '数据脉冲流速'},
      dieGlow: {type: 'color', default: '#5ee7ff', desc: '晶片上数据脉冲颜色'},
      pcbGlow: {type: 'color', default: '#ffb347', desc: '电路板上数据脉冲颜色'},
      activateAt: {type: 'number', default: 0, min: 0, max: 600, desc: '数据脉冲开始流动（秒）'},
      beams: {type: 'boolean', default: true, desc: '顶光光束'},
      seed: {type: 'seed', default: 'chip', desc: '种子：形状 / 布局 / 纹理随之变化（同一种子画面永远不变；每个视频用自己的种子，如视频编号）'},
    },
    effects: ['pbr_metal', 'iridescence', 'circuit_pulse', 'light_beams'],
    lighting_preset: '需要 StudioEnv 环境反射 + 主光 / 轮廓光',
    license: 'own',
    version: '1.0.0',
    notes: '尺寸：封装 4×4，晶片 2.4×2.4（中心原点，晶片表面 y≈0.31）；电路版图随 seed 变化',
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
      errs.push(`${id}: 未登记的参数 ${k}`);
      continue;
    }
    if (spec.type === 'number' && (typeof v !== 'number' || v < spec.min || v > spec.max)) errs.push(`${id}.${k} = ${String(v)}，应在 ${spec.min}–${spec.max}`);
    if (spec.type === 'boolean' && typeof v !== 'boolean') errs.push(`${id}.${k} 应为 true / false`);
    if (spec.type === 'vec3' && !(Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number'))) errs.push(`${id}.${k} 应为 [x, y, z]`);
    if (spec.type === 'seed' && !(typeof v === 'string' || typeof v === 'number')) errs.push(`${id}.${k} 应为字符串或数字`);
    if (spec.type === 'color' && !(typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v))) errs.push(`${id}.${k} 应为 #rrggbb`);
  }
  return errs;
};
