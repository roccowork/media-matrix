// 一个镜头：从第 from 秒到第 to 秒，放 public/broll/<src>.mp4；temp 是色温（-1 冷 ~ 1 暖）
export type Shot = { from: number; to: number; src: string; temp?: number };
