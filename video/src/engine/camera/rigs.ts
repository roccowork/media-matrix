// 相机系统：按秒的关键帧 + 缓动插值；预设函数生成常用运镜（都可直接写成 keys）。
import type {CameraConfig, CameraKey, Vec3} from '../shot';

const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10); // smootherstep
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export type CameraPose = {pos: Vec3; look: Vec3; fov: number; roll: number};

/** 第 t 秒的相机位姿 */
export const poseAt = (cam: CameraConfig, t: number): CameraPose => {
  const k = cam.keys;
  if (t <= k[0].t) return {pos: k[0].pos, look: k[0].look, fov: k[0].fov ?? 40, roll: k[0].roll ?? 0};
  let i = 0;
  while (i < k.length - 2 && t > k[i + 1].t) i++;
  const a = k[i];
  const b = k[i + 1];
  const u0 = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)));
  const u = cam.ease === 'linear' ? u0 : smooth(u0);
  return {
    pos: lerp3(a.pos, b.pos, u),
    look: lerp3(a.look, b.look, u),
    fov: lerp(a.fov ?? 40, b.fov ?? 40, u),
    roll: lerp(a.roll ?? 0, b.roll ?? 0, u),
  };
};

// ── 预设：给出起止参数，生成 keys ──
export const dolly = (from: Vec3, to: Vec3, look: Vec3, dur: number, fov = 40): CameraConfig => ({
  preset: 'dolly_in',
  keys: [
    {t: 0, pos: from, look, fov},
    {t: dur, pos: to, look, fov},
  ],
});

/** 绕 center 的 y 轴环绕：半径 r、高度 h、起止角（度） */
export const orbit = (center: Vec3, r: number, h: number, a0: number, a1: number, dur: number, fov = 40, steps = 8): CameraConfig => ({
  preset: 'orbit',
  ease: 'linear',
  keys: Array.from({length: steps + 1}, (_, i): CameraKey => {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    return {t: (dur * i) / steps, pos: [center[0] + Math.sin(a) * r, center[1] + h, center[2] + Math.cos(a) * r], look: center, fov};
  }),
});

/** tracking：镜头与目标保持相对偏移，跟着目标沿路线走（目标路线用关键点给出，按秒均分） */
export const tracking = (path: Vec3[], offset: Vec3, dur: number, fov = 40): CameraConfig => ({
  preset: 'tracking',
  keys: path.map((p, i): CameraKey => ({t: (dur * i) / (path.length - 1), pos: [p[0] + offset[0], p[1] + offset[1], p[2] + offset[2]], look: p, fov})),
});

/** fly_through：镜头沿一串路点飞行，始终看向前方 lookAhead 个路点之后的位置（最后一段看终点） */
export const flyThrough = (waypoints: Vec3[], dur: number, fov = 45, roll = 0): CameraConfig => ({
  preset: 'fly_through',
  keys: waypoints.map((p, i): CameraKey => {
    const next = waypoints[Math.min(i + 1, waypoints.length - 1)];
    const look: Vec3 = i === waypoints.length - 1 ? [p[0] + (p[0] - waypoints[i - 1][0]), p[1] + (p[1] - waypoints[i - 1][1]), p[2] + (p[2] - waypoints[i - 1][2])] : next;
    return {t: (dur * i) / (waypoints.length - 1), pos: p, look, fov, roll: roll * Math.sin((i / (waypoints.length - 1)) * Math.PI)};
  }),
});
