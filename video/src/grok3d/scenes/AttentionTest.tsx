// 试验：只用 Grok 骨架（science-3d-skeleton）自带的组件，搭「它指的是谁？」这一拍。
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ScienceScene} from '../components/ScienceScene';
import {Highlight} from '../components/Highlight';
import {Label3D} from '../components/Label3D';
import {ConnectionLine} from '../components/ConnectionLine';
import {PathFlow} from '../components/PathFlow';
import {PulseWave} from '../components/PulseWave';
import {FocusReticle} from '../components/FocusReticle';
import {Caption} from '../components/Caption';

const WORDS = ['小猫', '没有', '跳上', '桌子', '因为', '它', '太累了'];
const POS: [number, number, number][] = WORDS.map((_, i) => [(i - 3) * 1.25, 0.6, Math.abs(i - 3) * -0.25]);
const IT = 5;
const CAT = 0;

export const AttentionTest: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#0a0e17'}}>
    <ScienceScene lighting="tech" camera="orbit-slow" radius={8.5} height={2.6} lookAt={[0, 0.6, 0]} ground particles>
      {WORDS.map((w, i) => {
        const hot = i === CAT || i === IT;
        const node = (
          <mesh position={i === CAT ? [0, 0, 0] : POS[i]} castShadow>
            <sphereGeometry args={[hot ? 0.32 : 0.22, 32, 32]} />
            <meshStandardMaterial color={hot ? '#f5b83d' : '#7e9cff'} emissive={hot ? '#f5b83d' : '#3d5bd9'} emissiveIntensity={hot ? 0.8 : 0.35} metalness={0.3} roughness={0.35} />
          </mesh>
        );
        return (
          <React.Fragment key={w}>
            {i === CAT ? <group position={POS[i]}><Highlight from={40} to={170} color="#ffd166" intensity={0.8}>{node}</Highlight></group> : node}
            <Label3D position={POS[i]} text={w} from={5 + i * 4} fontSize={34} offsetY={-62} color={hot ? '#1a1204' : '#fff'} background={hot ? 'rgba(245,184,61,0.95)' : 'rgba(10,14,23,0.75)'} />
          </React.Fragment>
        );
      })}
      {/* 「它」看向每个词：细线 */}
      {WORDS.map((_, i) => (i === IT ? null : <ConnectionLine key={i} from={POS[IT]} to={POS[i]} color="#4fc3f7" radius={0.012} appearAt={20 + i * 3} />))}
      {/* 注意力最集中的那条：粒子沿弧线从「它」流向「小猫」 */}
      <PathFlow points={[POS[IT], [(POS[IT][0] + POS[CAT][0]) / 2, 2.6, -0.4], POS[CAT]]} color="#ffd166" tubeColor="#f5b83d" tubeOpacity={0.45} tubeRadius={0.04} size={0.12} count={30} />
      <PulseWave position={POS[CAT]} color="#ffd166" />
      <FocusReticle position={POS[CAT]} from={50} color="#ffd166" />
    </ScienceScene>
    <Caption text="「它」指的是谁？" sub="注意力：每个词都去看一遍所有的词" from={0} to={180} position="top" fontSize={64} />
  </AbsoluteFill>
);
