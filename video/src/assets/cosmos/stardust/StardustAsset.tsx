// 资产 cosmos.stardust.v1：沿镜头路线散布的发光星尘（镜头穿过时产生视差和速度感）。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {random} from 'remotion';
import type {Vec3} from '../../../engine/shot';

export type StardustProps = {
  from?: Vec3; // 路线起点（一般 = 镜头起点）
  to?: Vec3; // 路线终点
  count?: number;
  spread?: number; // 路线两侧的散布宽度
  size?: number;
  warmRatio?: number; // 暖色粒子占比
  seed?: string;
};

export const StardustAsset: React.FC<StardustProps> = ({from = [14, 46, 52], to = [-3, 15, 16], count = 2600, spread = 16, size = 0.06, warmRatio = 0.5, seed = 'dust'}) => {
  const {geom, tex} = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const t = random(`${seed}t${i}`);
      pos[i * 3] = from[0] + (to[0] - from[0]) * t + (random(`${seed}x${i}`) - 0.5) * spread;
      pos[i * 3 + 1] = from[1] + (to[1] - from[1]) * t + (random(`${seed}y${i}`) - 0.5) * spread * 0.55;
      pos[i * 3 + 2] = from[2] + (to[2] - from[2]) * t + (random(`${seed}z${i}`) - 0.5) * spread;
      const warm = random(`${seed}c${i}`) < warmRatio;
      const b = 0.4 + random(`${seed}b${i}`) * 1.6;
      col.set(warm ? [1.0 * b, 0.7 * b, 0.4 * b] : [0.45 * b, 0.75 * b, 1.0 * b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d')!;
    const r = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = r;
    x.fillRect(0, 0, 64, 64);
    return {geom: g, tex: new THREE.CanvasTexture(c)};
  }, [from, to, count, spread, warmRatio, seed]);
  return (
    <points geometry={geom} frustumCulled={false}>
      <pointsMaterial map={tex} size={size} sizeAttenuation vertexColors transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
    </points>
  );
};
