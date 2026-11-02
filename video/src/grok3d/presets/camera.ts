import {interpolate, spring} from 'remotion';

export type CameraMode =
  | 'static'
  | 'orbit'
  | 'dolly-in'
  | 'dolly-out'
  | 'orbit-and-dolly'
  | 'orbit-slow'
  | 'push-arc';

export type CameraPose = {
  position: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
};

type CameraParams = {
  frame: number;
  fps: number;
  durationInFrames: number;
  mode: CameraMode;
  /** Target the camera looks at. Default [0,0,0] */
  target?: [number, number, number];
  /** Base distance from target */
  radius?: number;
  /** Vertical offset */
  height?: number;
  /** FOV in degrees */
  fov?: number;
};

/**
 * Deterministic camera pose driven purely by useCurrentFrame().
 * Never use useFrame() inside Remotion.
 */
export function getCameraPose({
  frame,
  fps,
  durationInFrames,
  mode,
  target = [0, 0, 0],
  radius = 6,
  height = 1.8,
  fov = 45,
}: CameraParams): CameraPose {
  const progress = frame / Math.max(durationInFrames - 1, 1);
  const [tx, ty, tz] = target;

  switch (mode) {
    case 'static': {
      return {
        position: [0, height, radius],
        lookAt: target,
        fov,
      };
    }

    case 'orbit': {
      // Full gentle orbit over the whole duration
      const angle = progress * Math.PI * 1.25;
      return {
        position: [
          Math.sin(angle) * radius,
          height,
          Math.cos(angle) * radius,
        ],
        lookAt: target,
        fov,
      };
    }

    case 'orbit-slow': {
      const angle = progress * Math.PI * 0.7;
      return {
        position: [
          Math.sin(angle) * radius,
          height + Math.sin(progress * Math.PI) * 0.3,
          Math.cos(angle) * radius,
        ],
        lookAt: target,
        fov,
      };
    }

    case 'dolly-in': {
      const r = interpolate(progress, [0, 1], [radius * 1.6, radius * 0.75], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      return {
        position: [0, height * 0.9, r],
        lookAt: target,
        fov: interpolate(progress, [0, 1], [fov, fov - 6]),
      };
    }

    case 'dolly-out': {
      const r = interpolate(progress, [0, 1], [radius * 0.7, radius * 1.5], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      return {
        position: [0, height, r],
        lookAt: target,
        fov: interpolate(progress, [0, 1], [fov - 4, fov + 4]),
      };
    }

    case 'orbit-and-dolly': {
      // Most useful default for science explainers:
      // orbit while slowly pushing in, with a soft spring entrance.
      const enter = spring({
        frame,
        fps,
        config: {damping: 200, stiffness: 40, mass: 1},
      });
      const angle = progress * Math.PI * 1.1;
      const r = interpolate(progress, [0, 1], [radius * 1.35, radius * 0.85]);
      const y = height + Math.sin(progress * Math.PI) * 0.25;

      return {
        position: [
          Math.sin(angle) * r * (0.4 + 0.6 * enter),
          y,
          Math.cos(angle) * r,
        ],
        lookAt: [tx, ty + (1 - enter) * 0.4, tz],
        fov: interpolate(progress, [0, 1], [fov + 4, fov - 3]),
      };
    }

    case 'push-arc': {
      // 新增：缓慢推近 + 小角度弧线移动（-14° → +6°），不会转到背面把字的顺序转反。
      const e = interpolate(progress, [0, 1], [0, 1], {easing: (t) => t * t * (3 - 2 * t)});
      const angle = interpolate(e, [0, 1], [-0.25, 0.1]);
      const r = interpolate(e, [0, 1], [radius * 1.2, radius * 0.82]);
      return {
        position: [tx + Math.sin(angle) * r, ty + height * interpolate(e, [0, 1], [1.05, 0.8]), tz + Math.cos(angle) * r],
        lookAt: target,
        fov: interpolate(e, [0, 1], [fov + 2, fov - 2]),
      };
    }

    default:
      return {
        position: [0, height, radius],
        lookAt: target,
        fov,
      };
  }
}
