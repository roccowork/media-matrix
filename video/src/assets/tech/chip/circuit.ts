// 程序化电路版图（确定性，按 seed）：曼哈顿走线 + 存储阵列 + 逻辑块 + 焊盘。
// 生成两张贴图：
//   albedo：硅片 / 电路板的底色和走线（给 PBR 材质）；
//   pulse ：R = 走线掩码，G = 沿走线的相位 0→1（Shader 用它让数据脉冲沿线流动）。
import * as THREE from 'three';
import {random} from 'remotion';

export type CircuitOpts = {size: number; seed: string; kind: 'die' | 'pcb'; traces: number};

export const makeCircuit = ({size, seed, kind, traces}: CircuitOpts) => {
  const r = (k: string) => random(`${seed}:${k}`);
  const A = document.createElement('canvas');
  A.width = A.height = size;
  const P = document.createElement('canvas');
  P.width = P.height = size;
  const a = A.getContext('2d')!;
  const p = P.getContext('2d')!;
  p.fillStyle = '#000';
  p.fillRect(0, 0, size, size);
  const g = size / 256; // 网格单位
  if (kind === 'die') {
    // 硅片底色 + 功能块（存储阵列是细密网格、逻辑块是杂乱小方块）
    a.fillStyle = '#16182a';
    a.fillRect(0, 0, size, size);
    for (let b = 0; b < 26; b++) {
      const x = Math.floor(r(`bx${b}`) * 220) * g, y = Math.floor(r(`by${b}`) * 220) * g;
      const w = (16 + Math.floor(r(`bw${b}`) * 48)) * g, h = (16 + Math.floor(r(`bh${b}`) * 48)) * g;
      const mem = r(`bk${b}`) > 0.5;
      a.fillStyle = mem ? '#22264a' : '#1d2a3a';
      a.fillRect(x, y, w, h);
      a.strokeStyle = mem ? 'rgba(140,160,255,0.35)' : 'rgba(120,220,255,0.25)';
      a.lineWidth = Math.max(1, g * 0.35);
      const step = mem ? g * 1.2 : g * 3;
      for (let k = x; k < x + w; k += step) { a.beginPath(); a.moveTo(k, y); a.lineTo(k, y + h); a.stroke(); }
      if (mem) for (let k = y; k < y + h; k += step) { a.beginPath(); a.moveTo(x, k); a.lineTo(x + w, k); a.stroke(); }
      else for (let k = 0; k < (w * h) / (g * g * 30); k++) { a.fillStyle = `rgba(${150 + r(`c${b}${k}`) * 100},${120 + r(`d${b}${k}`) * 80},255,0.35)`; a.fillRect(x + r(`e${b}${k}`) * w, y + r(`f${b}${k}`) * h, g * 1.5, g * 1.5); }
    }
  } else {
    a.fillStyle = '#04080d';
    a.fillRect(0, 0, size, size);
    // 成组的平行总线（真实电路板的样子）
    for (let b = 0; b < 18; b++) {
      const horiz = r(`bh${b}`) > 0.5;
      const x0 = r(`bx${b}`) * 256, y0 = r(`by${b}`) * 256, len = 30 + r(`bl${b}`) * 120, n = 6 + Math.floor(r(`bn${b}`) * 14);
      a.strokeStyle = '#6b5322';
      a.lineWidth = 0.45 * g;
      for (let k = 0; k < n; k++) {
        a.beginPath();
        if (horiz) { a.moveTo(x0 * g, (y0 + k * 1.6) * g); a.lineTo((x0 + len) * g, (y0 + k * 1.6) * g); }
        else { a.moveTo((x0 + k * 1.6) * g, y0 * g); a.lineTo((x0 + k * 1.6) * g, (y0 + len) * g); }
        a.stroke();
      }
    }
  }
  // 走线：从边缘或随机点出发的折线，只走水平 / 竖直 / 45°
  const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  for (let t = 0; t < traces; t++) {
    let x = Math.floor(r(`tx${t}`) * 256), y = Math.floor(r(`ty${t}`) * 256);
    let d = Math.floor(r(`td${t}`) * 4);
    const pts: [number, number][] = [[x, y]];
    const segs = 3 + Math.floor(r(`ts${t}`) * 6);
    for (let s = 0; s < segs; s++) {
      const len = 6 + Math.floor(r(`tl${t}-${s}`) * 40);
      x = Math.max(2, Math.min(253, x + dirs[d][0] * len));
      y = Math.max(2, Math.min(253, y + dirs[d][1] * len));
      pts.push([x, y]);
      d = r(`tt${t}-${s}`) > 0.92 ? 4 + Math.floor(r(`tq${t}-${s}`) * 4) : Math.floor(r(`tr${t}-${s}`) * 4);
    }
    const width = (kind === 'pcb' ? 0.35 + r(`tw${t}`) * 0.5 : 0.14 + r(`tw${t}`) * 0.22) * g;
    a.strokeStyle = kind === 'pcb' ? '#7d6128' : '#5d6fae';
    a.lineWidth = width;
    a.lineCap = 'round';
    a.lineJoin = 'round';
    a.beginPath();
    pts.forEach(([px, py], i) => (i ? a.lineTo(px * g, py * g) : a.moveTo(px * g, py * g)));
    a.stroke();
    // 相位：沿折线从 0 渐变到 1（分段画，每段颜色递增）
    let total = 0;
    const lens = pts.slice(1).map(([qx, qy], i) => Math.hypot(qx - pts[i][0], qy - pts[i][1]));
    const L = lens.reduce((m, v) => m + v, 0) || 1;
    const off = r(`to${t}`);
    for (let i = 0; i < lens.length; i++) {
      const n = Math.max(2, Math.ceil(lens[i] / 2));
      for (let k = 0; k < n; k++) {
        const u0 = k / n, u1 = (k + 1) / n;
        const ph = (total + lens[i] * (u0 + u1) * 0.5) / L;
        p.strokeStyle = `rgb(255,${Math.floor(((ph + off) % 1) * 255)},${Math.floor(r(`tb${t}`) * 255)})`;
        p.lineWidth = width * 1.2;
        p.beginPath();
        p.moveTo((pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u0) * g, (pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u0) * g);
        p.lineTo((pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u1) * g, (pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u1) * g);
        p.stroke();
      }
      total += lens[i];
    }
    // 走线端点的过孔 / 焊点
    a.fillStyle = kind === 'pcb' ? '#a88a45' : '#8ea4ee';
    for (const [px, py] of [pts[0], pts[pts.length - 1]]) { a.beginPath(); a.arc(px * g, py * g, width * 1.6, 0, Math.PI * 2); a.fill(); }
  }
  const mk = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.generateMipmaps = true;
    return t;
  };
  return {albedo: mk(A, true), pulse: mk(P, false)};
};
