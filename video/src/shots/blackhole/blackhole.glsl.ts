// 黑洞：全屏光线步进（单位：史瓦西半径 rs = 1）。
// 1. 光线在黑洞引力下弯折：用光子在史瓦西度规下的近似加速度 a = -1.5 · h² · x / r⁵（h = |x × v|，守恒的角动量）。
//    这一步自动产生：引力透镜（背景星空被扭曲）、光子环、吸积盘背面被「翻」到黑洞上方和下方的经典形状。
// 2. 吸积盘：y≈0 平面附近的薄体积，密度 = 径向分布 × 竖直高斯 × 极坐标里随角速度（开普勒 ∝ r^-1.5）旋转的分形噪声。
//    颜色 = 温度色（内热外冷）；多普勒：迎面转来的一侧更亮更蓝，远离的一侧更暗更红。
// 3. 光线落进视界（r < 1）→ 纯黑；逃逸到远处 → 采样星空 + 星云（方向函数，也被透镜扭曲）。
// 输出线性 HDR，交给后期做辉光和 ACES 色调映射。全部由 uTime（= 帧 / fps）驱动，确定性。
export const BLACKHOLE_VERT = /* glsl */ `
varying vec2 vNdc;
void main() {
  vNdc = position.xy;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

export const BLACKHOLE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vNdc;
uniform float uTime;
uniform vec3 uCamPos;
uniform mat4 uCamWorld;
uniform mat4 uProjInv;
uniform float uDiskGain;   // 吸积盘亮度
uniform float uSpin;       // 盘的转速倍数
uniform int uSteps;        // 最大步数（性能 / 质量）

// ── 噪声 ──
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3) { p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float a = .5, s = 0.; for (int i = 0; i < 6; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
float ridged(vec2 p) { float a = .5, s = 0.; for (int i = 0; i < 6; i++) { float n = 1. - abs(2. * vnoise(p) - 1.); s += a * n * n; p = p * 2.07 + 9.7; a *= .52; } return s; }
float vnoise3(vec3 p) {
  vec3 i = floor(p), f = fract(p); vec3 u = f * f * (3. - 2. * f);
  float n000 = hash13(i), n100 = hash13(i + vec3(1,0,0)), n010 = hash13(i + vec3(0,1,0)), n110 = hash13(i + vec3(1,1,0));
  float n001 = hash13(i + vec3(0,0,1)), n101 = hash13(i + vec3(1,0,1)), n011 = hash13(i + vec3(0,1,1)), n111 = hash13(i + vec3(1,1,1));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
float fbm3(vec3 p) { float a = .5, s = 0.; for (int i = 0; i < 5; i++) { s += a * vnoise3(p); p = p * 2.02 + 7.3; a *= .5; } return s; }

// ── 温度 → 颜色（近似黑体，单位任意，t∈[0,1] 从暗红到蓝白） ──
vec3 tempColor(float t) {
  vec3 c = mix(vec3(1.0, 0.25, 0.05), vec3(1.0, 0.62, 0.22), smoothstep(0.0, 0.35, t));
  c = mix(c, vec3(1.0, 0.92, 0.78), smoothstep(0.35, 0.75, t));
  c = mix(c, vec3(0.75, 0.85, 1.0), smoothstep(0.75, 1.0, t));
  return c;
}

// ── 背景：星空 + 星云（方向函数） ──
vec3 sky(vec3 d) {
  vec3 col = vec3(0.0);
  vec3 w = vec3(fbm3(d * 1.6 + 1.3), fbm3(d * 1.6 + 7.7), fbm3(d * 1.6 - 4.1));   // 域扭曲
  vec3 q = d * 2.6 + w * 1.8;
  float gas = fbm3(q);
  float fil = pow(1.0 - abs(2.0 * fbm3(q * 2.3 + 3.0) - 1.0), 4.0);              // 细丝
  float dust = smoothstep(0.42, 0.62, fbm3(q * 1.7 - 5.0));                     // 暗尘埃带
  float warmMask = smoothstep(0.35, 0.75, fbm3(d * 1.2 + vec3(0.0, 2.0, 5.0)));
  vec3 warm = vec3(1.0, 0.42, 0.08), cool = vec3(0.12, 0.55, 1.0);
  vec3 neb = mix(cool, warm, warmMask);
  col += neb * (pow(gas, 4.0) * 0.9 + pow(fil, 2.0) * 0.35) * (1.0 - 0.95 * dust) * smoothstep(0.2, 0.6, gas);
  col += vec3(1.0, 0.7, 0.35) * pow(fil, 5.0) * warmMask * smoothstep(0.3, 0.6, gas) * 1.5;                 // 发亮的暖色气体边缘
  for (int l = 0; l < 3; l++) {
    float sc = l == 0 ? 120.0 : (l == 1 ? 300.0 : 700.0);
    vec3 g = d * sc; vec3 id = floor(g); vec3 fr = fract(g) - 0.5;
    float h = hash13(id + float(l) * 13.0);
    if (h > (l == 2 ? 0.7 : 0.82)) {
      vec3 o = vec3(hash13(id + 1.7), hash13(id + 4.3), hash13(id + 9.1)) - 0.5;
      float dist = length(fr - o * 0.6);
      float b = pow(hash13(id + 2.9), 5.0) * (l == 0 ? 14.0 : 4.0) + 0.3;
      vec3 tint = mix(vec3(0.65, 0.8, 1.0), vec3(1.0, 0.82, 0.55), hash13(id + 5.5));
      col += tint * b * (smoothstep(0.1, 0.0, dist) + 0.15 * smoothstep(0.45, 0.0, dist)) * (l == 2 ? 0.5 : 1.0) * (0.4 + 0.6 * (1.0 - dust));
    }
  }
  return col;
}

void main() {
  // 由 NDC 反推世界空间光线
  vec4 v = uProjInv * vec4(vNdc, 1.0, 1.0);
  vec3 dir = normalize((uCamWorld * vec4(normalize(v.xyz / v.w), 0.0)).xyz);
  vec3 pos = uCamPos;

  float h2 = dot(cross(pos, dir), cross(pos, dir));
  vec3 acc = vec3(0.0);   // 吸积盘累积颜色
  float trans = 1.0;      // 透射率
  bool captured = false;

  for (int i = 0; i < 400; i++) {
    if (i >= uSteps) break;
    float r = length(pos);
    if (r < 1.0) { captured = true; break; }
    if (r > 80.0 && dot(pos, dir) > 0.0) break;
    // 步长：远处大步、近处 / 盘附近小步
    float dt = clamp(0.06 * r, 0.02, 2.5);
    if (abs(pos.y) < 1.5 && r < 31.0) dt = min(dt, 0.07 + 0.02 * r);

    // 吸积盘体积采样
    if (r > 2.4 && r < 30.0) {
      float hgt = 0.05 + 0.03 * r;
      float vy = exp(-pos.y * pos.y / (hgt * hgt));
      if (vy > 0.002) {
        float rad = smoothstep(2.4, 3.0, r) * exp(-(r - 3.0) / 8.0) * smoothstep(30.0, 18.0, r);
        float ang = atan(pos.z, pos.x);
        float omega = uSpin * 1.6 * pow(r, -1.5);
        float a2 = ang + uTime * omega * 6.2831;
        float lr = log(r);
        float spiral = a2 + 2.4 * lr;                                    // 对数螺旋臂
        vec2 sp = vec2(spiral, lr * 4.0);
        vec2 warp = vec2(fbm(sp * 1.3 + 2.0), fbm(sp * 1.3 - 5.0));
        float arms = 0.5 + 0.5 * cos(spiral * 3.0 + warp.x * 4.0);      // 3 条主臂
        float fil = ridged(vec2(spiral * 6.0, lr * 18.0) + warp * 3.0);  // 细丝
        float lanes = smoothstep(0.3, 0.7, fbm(vec2(spiral * 4.0, lr * 10.0) + warp * 2.0));
        float dens = rad * vy * (0.08 + 1.6 * fil * (0.35 + 0.65 * arms)) * (0.25 + 0.75 * lanes);
        float temp = clamp(1.2 - (r - 2.4) / 7.0, 0.0, 1.0);
        vec3 vel = normalize(vec3(-pos.z, 0.0, pos.x)) * clamp(sqrt(0.5 / r) * 1.1, 0.0, 0.6);
        float dop = 1.0 / (1.0 - dot(vel, -dir));
        float beam = pow(dop, 2.5);
        float coolMix = smoothstep(0.45, 0.75, fbm(sp * 0.7 + 11.0)) * smoothstep(4.0, 10.0, r);
        vec3 hot = tempColor(clamp(temp * (0.75 + 0.35 * dop), 0.0, 1.0)) * (1.0 + 3.0 * temp * temp);
        vec3 c = mix(hot * vec3(1.0, 0.72, 0.32) * 1.4, vec3(0.2, 0.65, 1.0) * 1.2, coolMix * (1.0 - temp) * 0.8);
        float k = dens * dt * 3.0;
        acc += trans * c * k * beam * uDiskGain;
        float dk = rad * vy * (1.0 - lanes) * 0.6 * dt;                  // 暗尘埃：只吸收不发光
        trans *= exp(-k * 0.8 - dk);
        if (trans < 0.01) break;
      }
    }

    // 光子在史瓦西度规下的弯折
    vec3 a = -1.5 * h2 * pos / pow(r, 5.0);
    dir = normalize(dir + a * dt);
    pos += dir * dt;
  }

  vec3 col = acc;
  if (!captured) col += trans * sky(dir);
  // 视界边缘一圈极细的光子环（落入前绕了很多圈的光）
  gl_FragColor = vec4(col, 1.0);
}`;
