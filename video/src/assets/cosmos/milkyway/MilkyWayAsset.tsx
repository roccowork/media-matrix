// 资产 cosmos.milkyway.v1：银河天穹（全片固定背景）。参数见 registry.ts。
// 画在一个始终跟着镜头的大球内侧（onBeforeRender 把球心挪到镜头位置）→ 无论镜头飞到哪，星空都在无穷远处，不会穿帮。
// 外观按真实银河（《方案补充》#12 真实的东西按真实比例 / 样子）：
//   - 银河带：沿银道面的高斯带，靠近银心方向变厚变亮（核球），颜色由银心的暖黄过渡到外侧的冷白
//   - 星云状的星团纹理：方向空间里的 3D fbm（没有经度接缝）
//   - 暗尘埃带：沿银道中线的「大裂缝」+ 零散暗斑，乘法吸收（压暗星光）
//   - 粉红电离氢区：零星分布在银河带里
//   - 星点：方向空间分格哈希，三层不同密度和亮度，越靠近银河带越密；颜色按温度（蓝 / 白 / 黄 / 橙）；按像素角宽画，始终锐利
//   - 「星光一颗颗亮起」：每颗星一个随机亮起时刻（revealAt 之后 revealDuration 秒内），银河带随后浮现
// 全部在片元着色器里按方向计算，同帧确定。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import {NOISE_GLSL} from '../../../engine/shaders/noise.glsl';

export type MilkyWayProps = {
  centerAzimuth?: number; // 银心方向（度）：0 = 镜头默认前方（-z），90 = 右
  centerElevation?: number; // 银心仰角（度）
  tilt?: number; // 银河带绕银心方向的倾斜（度）：0 = 水平
  drift?: number; // 整个天穹缓慢转动（度 / 秒）
  brightness?: number;
  stars?: number; // 星星密度倍数
  dust?: number; // 尘埃带浓度
  warmColor?: string; // 银心颜色
  coolColor?: string; // 外侧颜色
  revealAt?: number; // 秒；-1 = 一开始就全亮
  revealDuration?: number; // 秒
  seed?: string | number;
};

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w * 0.99999;   // 永远在最远处
}`;

const FRAG = /* glsl */ `
uniform vec3 uC; uniform vec3 uY; uniform vec3 uP;   // 银道坐标系：银心方向、银道面内垂直方向、银极
uniform float uSeedF; uniform float uBright; uniform float uStars; uniform float uDust; uniform float uReveal;
uniform vec3 uWarm; uniform vec3 uCool;
varying vec3 vDir;
${NOISE_GLSL}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * snoise(p); p = p * 2.03 + 1.7; a *= 0.5; } return s * 0.5 + 0.5; }
float h13(vec3 p) { p = fract(p * vec3(443.897, 441.423, 437.195) + uSeedF * 0.013); p += dot(p, p.yzx + 19.19); return fract((p.x + p.y) * p.z); }
vec3 h33(vec3 p) { return vec3(h13(p), h13(p + 17.31), h13(p + 41.77)); }
// 一层星点：方向乘 scale 分格，每格最多一颗星（位置在格子中间区域，基本不会被格子边界截断）
vec3 starLayer(vec3 d, float scale, float density, float mag, float px, float bandF) {
  vec3 p = d * scale; vec3 c = floor(p); vec3 f = fract(p);
  vec3 h = h33(c);
  float dens = density * (0.4 + 1.4 * bandF);
  if (h.x > dens) return vec3(0.0);
  vec3 sp = 0.25 + 0.5 * h33(c + 7.0);
  float dist = length(f - sp) / scale;                 // 角距离（弧度）
  float bright = mag * pow(h.y, 4.0);
  float appear = h13(c + 3.3);                          // 亮起时刻（0–1）
  float vis = smoothstep(appear, appear + 0.08, uReveal);
  float sz = px * (0.7 + 1.2 * pow(h.y, 8.0));
  float core = exp(-dist * dist / (sz * sz));
  float t = h.z;                                        // 色温
  vec3 col = t < 0.15 ? vec3(0.65, 0.78, 1.0) : t < 0.6 ? vec3(1.0, 0.98, 0.95) : t < 0.88 ? vec3(1.0, 0.88, 0.7) : vec3(1.0, 0.7, 0.5);
  return col * core * bright * vis;
}
void main() {
  vec3 d = normalize(vDir);
  vec3 g = vec3(dot(d, uC), dot(d, uY), dot(d, uP));   // 银道坐标
  float b = asin(clamp(g.z, -1.0, 1.0));
  float l = atan(g.y, g.x);
  float px = max(length(fwidth(d)), 1e-5);
  // 银河带 + 核球
  float w = 0.055 + 0.05 * exp(-l * l / 0.6);
  float band = exp(-(b * b) / (2.0 * w * w));
  float bulge = exp(-(l * l / 0.30 + b * b / 0.035));
  vec3 q = g * 3.5 + uSeedF * 0.01;
  float n1 = fbm(q), n2 = fbm(g * 11.0 + 3.1 + uSeedF * 0.02);
  // 星云团：对比度拉高（亮的成团、暗的透黑），外围一圈很淡的冷色光晕
  float cl = pow(n1, 2.2) * (0.5 + 0.9 * pow(n2, 1.5));
  float clouds = band * cl * 1.6 + bulge * (0.6 + 0.9 * cl) + exp(-(b * b) / (2.0 * (w * 2.6) * (w * 2.6))) * 0.06;
  // 尘埃：大裂缝（沿中线、略有起伏）+ 零散暗斑
  // 丝缕状尘埃：中线大裂缝（宽窄起伏）+ 用高频噪声撕成丝 + 零散暗云
  float wr = 0.022 + 0.018 * exp(-l * l / 0.5) + 0.01 * snoise(vec3(l * 4.0, 1.0, uSeedF));
  float wisp = smoothstep(0.35, 0.65, fbm(g * 14.0 + 5.0)) * (0.6 + 0.4 * fbm(g * 40.0 + 2.0));
  float rift = exp(-pow((b - 0.01 * sin(l * 3.0 + uSeedF)) / wr, 2.0)) * wisp;
  float patches = smoothstep(0.55, 0.8, fbm(g * 10.0 + 9.0)) * band * (0.5 + 0.5 * fbm(g * 30.0));
  float absorb = clamp(uDust * (0.9 * rift + 0.55 * patches), 0.0, 0.95);
  vec3 col = mix(uCool, uWarm, clamp(bulge * 1.4 + 0.25 * band, 0.0, 1.0)) * clouds * 0.2;
  float hii = smoothstep(0.78, 0.93, fbm(g * 22.0 + 13.0)) * band;
  col += vec3(0.95, 0.3, 0.42) * hii * 0.08;
  col *= 1.0 - absorb;
  col *= smoothstep(0.35, 1.0, uReveal);                // 银河带在星星之后浮现
  // 星点（三层）：暗而密 / 中 / 亮而稀；被尘埃挡住一部分
  vec3 st = starLayer(d, 480.0, 0.32 * uStars, 0.35, px, band)
          + starLayer(d, 170.0, 0.16 * uStars, 0.9, px, band)
          + starLayer(d, 60.0, 0.07 * uStars, 2.6, px, band * 0.4);
  st *= 1.0 - 0.7 * absorb;
  // 极淡的星际背景光，避免纯黑
  col += vec3(0.004, 0.005, 0.009);
  gl_FragColor = vec4((col + st) * uBright, 1.0);
}`;

const rad = (d: number) => (d * Math.PI) / 180;

export const MilkyWayAsset: React.FC<MilkyWayProps> = ({
  centerAzimuth = 0,
  centerElevation = 10,
  tilt = 28,
  drift = 0.15,
  brightness = 1,
  stars = 1,
  dust = 1,
  warmColor = '#ffd9a8',
  coolColor = '#b9c8ff',
  revealAt = -1,
  revealDuration = 3,
  seed = 'milkyway',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const S = String(seed);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false,
        uniforms: {
          uC: {value: new THREE.Vector3()}, uY: {value: new THREE.Vector3()}, uP: {value: new THREE.Vector3()},
          uSeedF: {value: random(`mw-${S}`) * 1000}, uBright: {value: brightness}, uStars: {value: stars}, uDust: {value: dust},
          uReveal: {value: 1}, uWarm: {value: new THREE.Color(warmColor)}, uCool: {value: new THREE.Color(coolColor)},
        },
      }),
    [S, brightness, stars, dust, warmColor, coolColor],
  );
  // 银道坐标系（随时间缓慢转动）
  const az = rad(centerAzimuth + drift * t), el = rad(centerElevation);
  const c = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const p0 = up.clone().sub(c.clone().multiplyScalar(up.dot(c))).normalize();
  const p = p0.applyAxisAngle(c, rad(tilt)).normalize();
  const y = new THREE.Vector3().crossVectors(p, c).normalize();
  mat.uniforms.uC.value.copy(c);
  mat.uniforms.uY.value.copy(y);
  mat.uniforms.uP.value.copy(p);
  mat.uniforms.uReveal.value = revealAt < 0 ? 1 : Math.min(1, Math.max(0, (t - revealAt) / Math.max(revealDuration, 0.01)));
  return (
    <mesh
      material={mat}
      frustumCulled={false}
      renderOrder={-1000}
      // 球心每次绘制前跟到镜头位置（此时镜头已就位）
      ref={(m) => {
        if (m) m.onBeforeRender = (_r, _s, camera) => { m.position.copy(camera.position); m.updateMatrixWorld(); };
      }}
    >
      <sphereGeometry args={[900, 64, 32]} />
    </mesh>
  );
};
