// 验收镜头 B：人体神经网络激活，15 秒，电影级科学可视化风格。
// 配置：shotconfigs/biology.neural_activation.v1.json；资产：biology.neuron.v1 / biology.axon.v1 / biology.neural_web.v1。
// 分镜：0–2s 微距看一个神经元 → 1s 它被点亮 → 2–5.6s 电信号沿轴突传到第二个神经元（火花、突触爆光）
//       → 6s 起信号分叉传向更多神经元，24 万光点的神经网从那里开始一波波亮起 → 10–15s 镜头拉远看整片网络。
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage} from '../../engine/core/Stage';
import {AssetView} from '../../engine/assets/AssetView';
import type {ShotConfig} from '../../engine/shot';
import cfg from '../../../shotconfigs/biology.neural_activation.v1.json';

export const NEURAL_SHOT = cfg as unknown as ShotConfig; // JSON 已由 tools/shot.mjs validate 按 Schema 校验

export const NeuralActivation: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#02040a'}}>
    <Stage camera={NEURAL_SHOT.camera} post={NEURAL_SHOT.post} background="#02040a">
      <color attach="background" args={['#02040a']} />
      <fog attach="fog" args={['#02040a', 8, 30]} />
      {NEURAL_SHOT.assets.map((a, i) => (
        <AssetView key={i} id={a.id} params={a.params} />
      ))}
    </Stage>
  </AbsoluteFill>
);
