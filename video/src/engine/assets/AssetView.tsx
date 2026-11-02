// 按 asset_id 渲染一个程序化资产（文件资产由各自的加载组件处理）。
import React from 'react';
import {getAsset, validateAssetParams} from './registry';

export const AssetView: React.FC<{id: string; params?: Record<string, unknown>}> = ({id, params = {}}) => {
  const a = getAsset(id);
  const errs = validateAssetParams(id, params);
  if (errs.length) throw new Error(errs.join('\n'));
  if (a.kind !== 'procedural' || !a.component) throw new Error(`${id} 不是程序化资产`);
  const Comp = a.component;
  return <Comp {...params} />;
};
