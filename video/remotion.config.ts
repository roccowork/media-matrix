import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Three.js 需要 WebGL。本地有显卡用 "angle"；无显卡的服务器渲染时加 --gl=swangle
Config.setChromiumOpenGlRenderer("angle");
