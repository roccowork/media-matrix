// CPU 端的确定性 3D 值噪声（建几何时用；按 seed 生成，同一 seed 结果永远一样）
import {random} from 'remotion';

export const createNoise3D = (seed: string) => {
  const h = (x: number, y: number, z: number) => random(`${seed}:${x},${y},${z}`) * 2 - 1;
  const s = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number, z: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = s(x - xi), yf = s(y - yi), zf = s(z - zi);
    const L = (a: number, b: number, t: number) => a + (b - a) * t;
    const c = (dx: number, dy: number, dz: number) => h(xi + dx, yi + dy, zi + dz);
    return L(L(L(c(0, 0, 0), c(1, 0, 0), xf), L(c(0, 1, 0), c(1, 1, 0), xf), yf), L(L(c(0, 0, 1), c(1, 0, 1), xf), L(c(0, 1, 1), c(1, 1, 1), xf), yf), zf);
  };
};
