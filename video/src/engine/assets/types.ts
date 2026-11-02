// 资产库的元数据（对应方案第五节「资产元数据字段」）。
// 两类资产：
//   procedural：程序化资产（Shader / 粒子 / 代码生成几何），没有模型文件，本体是一个可配置参数的 React 组件；
//   file：文件资产（.glb / .fbx 模型、贴图、HDRI、音效），本体是 public/ 下的文件。
import type React from 'react';

export type AssetCategory = 'cosmos' | 'biology' | 'tech' | 'history_geo' | 'physics_nature' | 'common';

export type ParamSpec = {type: 'number'; default: number; min: number; max: number; desc: string} | {type: 'boolean'; default: boolean; desc: string};

export type AssetMeta = {
  asset_id: string; // 如 cosmos.blackhole.v1
  asset_name: string; // 中文名
  category: AssetCategory;
  kind: 'procedural' | 'file';
  renderer: 'threejs' | 'blender' | 'motion';
  /** 程序化资产：组件；文件资产：public/ 下的路径 */
  component?: React.FC<Record<string, unknown>>;
  model_path?: string;
  /** 可调参数（AI 生成 ShotConfig 时只能在这些范围内取值，校验用） */
  params?: Record<string, ParamSpec>;
  effects?: string[];
  camera_presets?: string[];
  lighting_preset?: string;
  /** 缩略图（public/ 下） */
  thumbnail?: string;
  license: string; // 自研代码写 own；第三方写许可证 + 出处
  source?: string;
  version: string;
  dependencies?: string[];
  notes?: string;
};
