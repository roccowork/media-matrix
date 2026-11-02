// 「照片」素材：用小猫模型在暖色室内光下渲染一张 4:3 的图，导出到 public/science3d/cat-photo.png，
// 给「AI 是怎么看懂一张图的？」当被识别的照片（像素方块、线稿、局部小窗都从这张图里取，不用网上图片）。
import React from 'react';
import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {useThree} from '@react-three/fiber';
import {QuaterniusCat, useCatModel} from '../components/QuaterniusCat';

const ORANGE = {Grey: '#e8984f'};

const Cam: React.FC = () => {
  const {camera} = useThree();
  camera.position.set(1.4, 1.6, 4.6);
  camera.lookAt(0.15, 0.75, 0);
  return null;
};

export const CatPhoto: React.FC = () => {
  const {width, height} = useVideoConfig();
  const cat = useCatModel();
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg, #f3d9b1 0%, #e8b98a 58%, #b9784a 100%)'}}>
      <ThreeCanvas width={width} height={height} shadows camera={{fov: 35, position: [2.2, 1.5, 4.2]}} gl={{antialias: true, alpha: true}}>
        <Cam />
        <ambientLight intensity={0.9} color="#ffe9d0" />
        <hemisphereLight args={['#fff4e0', '#8a5530', 1.2]} />
        <directionalLight position={[3, 5, 4]} intensity={2.6} color="#fff1dc" castShadow shadow-mapSize={[2048, 2048]} />
        <directionalLight position={[-4, 2, -2]} intensity={1.2} color="#ffd29a" />
        {/* 木地板 */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[30, 30]} />
          <meshStandardMaterial color="#b67a4b" roughness={0.8} />
        </mesh>
        {/* 背后的墙 + 一块地毯 */}
        <mesh position={[0, 3, -3]}>
          <planeGeometry args={[30, 8]} />
          <meshStandardMaterial color="#f1d7b0" roughness={1} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow>
          <circleGeometry args={[1.9, 64]} />
          <meshStandardMaterial color="#7f9bb3" roughness={1} />
        </mesh>
        {cat && (
          <group rotation={[0, -0.75, 0]} position={[0.1, 0, 0.2]}>
            <QuaterniusCat model={cat} scale={0.0032} offset={Number(process.env.REMOTION_CATOFF ?? 315)} color={ORANGE} />
          </group>
        )}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
