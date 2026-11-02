// 资产 tech.chip.v1：AI 芯片（电路板 + 封装基板 + 金色焊盘 + 硅晶片 + 金线键合）+ 沿电路流动的数据脉冲 + 顶光光束和浮尘。
// 材质：MeshPhysicalMaterial（金属度 / 粗糙度 / 清漆 / 薄膜干涉彩虹色），配合 StudioEnv 的环境反射。
// 电路版图由 circuit.ts 按 seed 程序生成；数据脉冲由 Shader 按「沿走线的相位」随时间流动（确定性）。
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import {makeCircuit} from './circuit';

export type ChipProps = {
  seed?: string;
  pulseSpeed?: number;
  dieGlow?: string;
  pcbGlow?: string;
  activateAt?: number; // 秒：数据脉冲开始流动
  beams?: boolean;
};

const PULSE_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const PULSE_FRAG = /* glsl */ `
uniform sampler2D uPulse; uniform float uTime; uniform float uSpeed; uniform vec3 uColor; uniform float uOn;
varying vec2 vUv;
void main() {
  vec4 p = texture2D(uPulse, vUv);
  float mask = p.r;
  float ph = fract(p.g * 2.0 - uTime * uSpeed - p.b);
  float head = exp(-pow((1.0 - ph) * 18.0, 2.0)) + exp(-pow(ph * 60.0, 2.0)) * 0.6;   // 亮头 + 短尾
  float tail = smoothstep(0.0, 0.35, ph) * (1.0 - smoothstep(0.35, 0.999, ph)) * 0.12;
  float k = mask * (head * 1.6 + tail * 0.6 + 0.015) * uOn;
  gl_FragColor = vec4(uColor * k, 1.0);
}`;
const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor; varying vec2 vUv;
void main() { float a = pow(1.0 - vUv.y, 1.6) * 0.07 * (0.6 + 0.4 * sin(vUv.x * 6.2831 * 3.0)); gl_FragColor = vec4(uColor * a, 1.0); }`;

export const ChipAsset: React.FC<ChipProps> = ({seed = 'chip', pulseSpeed = 0.35, dieGlow = '#5ee7ff', pcbGlow = '#ffb347', activateAt = 0, beams = true}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const res = useMemo(() => {
    const die = makeCircuit({size: 2048, seed: `${seed}-die`, kind: 'die', traces: 900});
    const pcb = makeCircuit({size: 2048, seed: `${seed}-pcb`, kind: 'pcb', traces: 260});
    const pulseMat = (tex: THREE.Texture, color: string) =>
      new THREE.ShaderMaterial({vertexShader: PULSE_VERT, fragmentShader: PULSE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: {uPulse: {value: tex}, uTime: {value: 0}, uSpeed: {value: pulseSpeed}, uColor: {value: new THREE.Color(color).multiplyScalar(2.2)}, uOn: {value: 0}}});
    // 封装四周的金色焊盘
    const pads: [number, number][] = [];
    for (let s = 0; s < 4; s++) for (let k = 0; k < 18; k++) {
      const u = -1.65 + (k / 17) * 3.3;
      pads.push(s === 0 ? [u, -1.82] : s === 1 ? [u, 1.82] : s === 2 ? [-1.82, u] : [1.82, u]);
    }
    // 金线：从晶片边缘拱起落到焊盘
    const wires = pads.map(([px, pz], i) => {
      const dx = Math.sign(px) * Math.min(Math.abs(px), 1.15) * (Math.abs(px) > 1.7 ? 1 : 0) || px * 0.66;
      const dz = Math.sign(pz) * Math.min(Math.abs(pz), 1.15) * (Math.abs(pz) > 1.7 ? 1 : 0) || pz * 0.66;
      const a = new THREE.Vector3(dx, 0.315, dz);
      const b = new THREE.Vector3(px, 0.27, pz);
      const m = a.clone().lerp(b, 0.4).add(new THREE.Vector3(0, 0.22 + random(`${seed}w${i}`) * 0.08, 0));
      return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, m, b), 24, 0.006, 6, false);
    });
    const dust = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) {
      dust[i * 3] = (random(`${seed}dx${i}`) - 0.5) * 7;
      dust[i * 3 + 1] = random(`${seed}dy${i}`) * 4;
      dust[i * 3 + 2] = (random(`${seed}dz${i}`) - 0.5) * 7;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3));
    return {
      die, pcb, pads, wires, dustGeo,
      diePulse: pulseMat(die.pulse, dieGlow),
      pcbPulse: pulseMat(pcb.pulse, pcbGlow),
      beamMat: new THREE.ShaderMaterial({vertexShader: PULSE_VERT, fragmentShader: BEAM_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: {uColor: {value: new THREE.Color(dieGlow)}}}),
      padGeo: new THREE.BoxGeometry(0.11, 0.02, 0.2),
    };
  }, [seed, pulseSpeed, dieGlow, pcbGlow]);
  const on = Math.min(1, Math.max(0, (t - activateAt) / 1.2));
  for (const m of [res.diePulse, res.pcbPulse]) {
    m.uniforms.uTime.value = t;
    m.uniforms.uOn.value = on;
  }
  return (
    <group>
      {/* 电路板 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, 16]} />
        <meshPhysicalMaterial map={res.pcb.albedo} roughness={0.42} metalness={0.35} clearcoat={0.6} clearcoatRoughness={0.3} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} material={res.pcbPulse}>
        <planeGeometry args={[16, 16]} />
      </mesh>
      {/* 封装基板 */}
      <mesh position={[0, 0.125, 0]}>
        <boxGeometry args={[4, 0.25, 4]} />
        <meshPhysicalMaterial color="#14161d" roughness={0.38} metalness={0.2} clearcoat={0.8} clearcoatRoughness={0.2} />
      </mesh>
      {/* 焊盘 */}
      {res.pads.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.26, z]} rotation={[0, Math.abs(x) > 1.7 ? Math.PI / 2 : 0, 0]} geometry={res.padGeo}>
          <meshPhysicalMaterial color="#e2b65c" metalness={1} roughness={0.22} />
        </mesh>
      ))}
      {/* 硅晶片：彩虹薄膜 + 清漆 */}
      <mesh position={[0, 0.28, 0]}>
        <boxGeometry args={[2.4, 0.06, 2.4]} />
        <meshPhysicalMaterial color="#2a2f45" roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.3105, 0]}>
        <planeGeometry args={[2.36, 2.36]} />
        <meshPhysicalMaterial map={res.die.albedo} roughness={0.38} metalness={0.6} clearcoat={0.35} clearcoatRoughness={0.35} iridescence={0.8} iridescenceIOR={1.6} iridescenceThicknessRange={[200, 700]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.312, 0]} material={res.diePulse}>
        <planeGeometry args={[2.36, 2.36]} />
      </mesh>
      {/* 金线 */}
      {res.wires.map((w, i) => (
        <mesh key={i} geometry={w}>
          <meshPhysicalMaterial color="#f0c46a" metalness={1} roughness={0.18} />
        </mesh>
      ))}
      {/* 顶光光束 + 浮尘 */}
      {beams &&
        [[-0.9, -0.6], [0.7, 0.4], [0.1, -1.4]].map(([x, z], i) => (
          <mesh key={i} position={[x, 2.2, z]} material={res.beamMat}>
            <cylinderGeometry args={[0.08, 0.7, 4.4, 32, 1, true]} />
          </mesh>
        ))}
      <points geometry={res.dustGeo}>
        <pointsMaterial size={0.012} color={new THREE.Color(dieGlow).multiplyScalar(1.5)} transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <pointLight position={[0, 1.2, 0]} intensity={on * 1.5} distance={4} color={dieGlow} />
    </group>
  );
};
