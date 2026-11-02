// 体积星云 + 星空背景（全屏光线步进）。
// 背景：三层疏密不同的星星（方向函数）。星云：中心 uCenter、半径 uRadius 的球形区域内，
// 域扭曲的 3D 分形噪声决定气体密度，两种主色按另一层噪声分区，暗尘埃只吸收不发光；内部几颗亮星照亮周围的气体。
// 光线从相机出发，与星云球求交，在交段内步进累积发光和透射率；镜头可以在星云外面看，也可以飞进去。
export const NEBULA_VERT = /* glsl */ `
varying vec2 vNdc;
void main() { vNdc = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export const NEBULA_FRAG = /* glsl */ `
precision highp float;
varying vec2 vNdc;
uniform vec3 uCamPos; uniform mat4 uCamWorld; uniform mat4 uProjInv;
uniform float uTime;
uniform vec3 uCenter; uniform float uRadius;
uniform vec3 uWarm; uniform vec3 uCool;
uniform float uDensity; uniform float uDust; uniform float uGain; uniform float uStars;
uniform vec3 uSeed; uniform int uSteps;

float hash13(vec3 p3) { p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise3(vec3 p) {
  vec3 i = floor(p), f = fract(p); vec3 u = f * f * (3. - 2. * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), u.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), u.x), u.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), u.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), u.x), u.y), u.z);
}
float fbm(vec3 p) { float a = .5, s = 0.; for (int i = 0; i < 5; i++) { s += a * vnoise3(p); p = p * 2.03 + 7.1; a *= .5; } return s; }
float fbmLo(vec3 p) { float a = .5, s = 0.; for (int i = 0; i < 3; i++) { s += a * vnoise3(p); p = p * 2.03 + 3.3; a *= .5; } return s; }

vec3 stars(vec3 d) {
  vec3 col = vec3(0.0);
  for (int l = 0; l < 3; l++) {
    float sc = l == 0 ? 110.0 : (l == 1 ? 280.0 : 650.0);
    vec3 g = d * sc; vec3 id = floor(g); vec3 fr = fract(g) - 0.5;
    float h = hash13(id + float(l) * 13.0 + uSeed);
    if (h > (l == 2 ? 1.0 - 0.3 * uStars : 1.0 - 0.18 * uStars)) {
      vec3 o = vec3(hash13(id + 1.7), hash13(id + 4.3), hash13(id + 9.1)) - 0.5;
      float dist = length(fr - o * 0.6);
      float b = pow(hash13(id + 2.9), 5.0) * (l == 0 ? 12.0 : 3.0) + 0.15;
      vec3 tint = mix(vec3(0.65, 0.8, 1.0), vec3(1.0, 0.82, 0.55), hash13(id + 5.5));
      col += tint * b * (smoothstep(0.1, 0.0, dist) + 0.15 * smoothstep(0.45, 0.0, dist)) * (l == 2 ? 0.35 : 0.8);
    }
  }
  return col;
}

// 星云在某点的「气体密度、尘埃、颜色分区」
void sampleNebula(vec3 p, out float gas, out float dust, out float warmMix, out float fil) {
  vec3 q = (p - uCenter) / uRadius;                       // 归一化到 [-1,1] 球
  vec3 qs = q * vec3(0.75, 1.35, 1.0);                       // 压扁拉长，不是正球
  float edge = length(qs) + (fbmLo(q * 2.2 + uSeed + 9.0) - 0.5) * 0.7;  // 边缘被噪声撕开
  float fall = smoothstep(1.0, 0.2, edge);
  vec3 w = vec3(fbmLo(q * 1.6 + uSeed), fbmLo(q * 1.6 + uSeed + 5.2), fbmLo(q * 1.6 + uSeed - 3.7));
  vec3 s = q * 2.4 + w * 1.6 + uSeed;
  float n = fbm(s);
  fil = pow(1.0 - abs(2.0 * fbm(s * 1.9 + 4.0) - 1.0), 5.0);  // 发亮的细丝
  gas = pow(max(0.0, n - 0.45) * 2.2, 1.6) * fall * uDensity;
  dust = smoothstep(0.5, 0.72, fbmLo(s * 1.3 - 2.0)) * fall * uDust;
  warmMix = smoothstep(0.42, 0.52, fbmLo(q * 1.4 + uSeed + 11.0));
}

void main() {
  vec4 v = uProjInv * vec4(vNdc, 1.0, 1.0);
  vec3 rd = normalize((uCamWorld * vec4(normalize(v.xyz / v.w), 0.0)).xyz);
  vec3 ro = uCamPos;
  vec3 col = vec3(0.0);
  float trans = 1.0;
  // 与星云球求交
  vec3 oc = ro - uCenter;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - uRadius * uRadius;
  float disc = b * b - c;
  if (disc > 0.0) {
    float sq = sqrt(disc);
    float t0 = max(0.0, -b - sq), t1 = -b + sq;
    if (t1 > 0.0) {
      float len = t1 - t0;
      float dt = len / float(uSteps);
      float jitter = hash13(vec3(vNdc * 913.0, uTime)) * dt;     // 抖动起点，消除分层条纹（按帧固定）
      for (int i = 0; i < 160; i++) {
        if (i >= uSteps) break;
        float t = t0 + jitter + dt * float(i);
        vec3 p = ro + rd * t;
        float gas, dust, warmMix, fil;
        sampleNebula(p, gas, dust, warmMix, fil);
        vec3 tint = mix(uCool, uWarm, warmMix);
        vec3 emit = tint * tint * 1.4 * gas * (0.12 + 2.6 * fil) + vec3(1.0, 0.8, 0.6) * pow(fil, 3.0) * gas * 1.5;
        // 内部的几颗亮星照亮周围气体
        for (int k = 0; k < 4; k++) {
          vec3 sp = uCenter + (vec3(hash13(uSeed + float(k)), hash13(uSeed + float(k) + 3.1), hash13(uSeed + float(k) + 7.7)) - 0.5) * uRadius * 0.9;
          float d2 = dot(p - sp, p - sp) / (uRadius * uRadius);
          emit += mix(tint, vec3(1.0, 0.9, 0.8), 0.5) * gas * 0.015 / (d2 + 0.01);
        }
        col += trans * emit * dt * uGain * (1.0 / uRadius) * 4.0;
        trans *= exp(-(gas * 0.6 + dust * 2.5) * dt / uRadius * 6.0);
        if (trans < 0.02) break;
      }
    }
  }
  col = col / (1.0 + 0.35 * max(col.r, max(col.g, col.b)));   // 压住大片气体叠加出的灰雾，保留对比
  col += trans * stars(rd);
  gl_FragColor = vec4(col, 1.0);
}`;
