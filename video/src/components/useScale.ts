import { useVideoConfig } from "remotion";

// 以短边 1080 为基准缩放，横屏和竖屏共用一套尺寸
export const useScale = () => {
  const { width, height } = useVideoConfig();
  return Math.min(width, height) / 1080;
};
