// 品牌配置：账号名、配色、字体都在这里统一修改
export const brand = {
  // 艺名，各平台账号名统一
  name: "AI替我上班",
  slogan: "把工作留给 AI，把时间还给生活",
  github: "github.com/robort6688",
  colors: {
    bg: "#0B1020",
    bgLight: "#141B33",
    panel: "#0F172A",
    border: "#1E293B",
    primary: "#22D3EE",
    accent: "#A78BFA",
    success: "#4ADE80",
    warning: "#FBBF24",
    danger: "#F87171",
    text: "#E5E7EB",
    muted: "#94A3B8",
  },
  fonts: {
    sans: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "WenQuanYi Zen Hei", sans-serif',
    mono: '"JetBrains Mono", "Fira Code", Consolas, "WenQuanYi Zen Hei Mono", monospace',
  },
} as const;

export const FPS = 30;

export const SIZES = {
  landscape: { width: 1920, height: 1080 }, // B站、公众号
  portrait: { width: 1080, height: 1920 }, // 抖音、视频号、小红书
} as const;
