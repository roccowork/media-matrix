// 环境光照（方案「Lighting：HDRI」）：用 three.js 自带的程序化影棚环境（RoomEnvironment）生成 PMREM 反射贴图，
// 让金属、玻璃、硅片有真实的环境反射。以后可换成 Poly Haven 的 CC0 HDRI（需要放行域名）。
import {useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';

export const StudioEnv: React.FC<{intensity?: number; background?: string}> = ({intensity = 1, background = '#03050c'}) => {
  const {gl, scene} = useThree();
  useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = intensity;
    scene.background = new THREE.Color(background);
    pmrem.dispose();
  }, [gl, scene, intensity, background]);
  return null;
};
