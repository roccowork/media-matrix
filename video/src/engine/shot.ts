// 镜头配置（ShotConfig）第一版：AI 以后只生成这种结构化配置，校验通过才交给渲染器执行。
// JSON Schema 见 video/schemas/shot.schema.json（与本类型保持一致）。
export type Vec3 = [number, number, number];

export type CameraKey = {
  /** 秒 */
  t: number;
  pos: Vec3;
  look: Vec3;
  /** 竖直视角（度） */
  fov?: number;
  /** 镜头滚转（度） */
  roll?: number;
};

export type CameraConfig = {
  preset: 'dolly_in' | 'dolly_out' | 'orbit' | 'tracking' | 'fly_through' | 'macro_push' | 'pull_back' | 'keys';
  keys: CameraKey[];
  /** 关键帧之间的缓动：smooth（默认，缓入缓出）/ linear */
  ease?: 'smooth' | 'linear';
};

export type PostConfig = {
  bloom?: {intensity: number; threshold?: number; radius?: number};
  /** 确定性镜头虚化（来自 film/lensblur），cInf = 无穷远处虚化半径（px @1080p） */
  dof?: {cInf: number; focus?: Vec3};
  tone?: 'aces' | 'agx' | 'neutral';
  exposure?: number;
  vignette?: number;
  grain?: number;
  chromatic?: number;
};

export type ShotConfig = {
  id: string;
  renderer: 'threejs' | 'blender' | 'motion';
  style: 'imax_cosmos' | 'cinematic_science' | 'cyber_tech' | 'motion_design' | 'history_geo';
  fps: number;
  duration: number;
  camera: CameraConfig;
  post: PostConfig;
  params?: Record<string, number | string | boolean>;
  version: string;
};
