// 「电影感」后期链（照搬 claude-animated-shorts 的 Bridge.tsx 顺序）：
//   描边 InkPass → 镜头虚化 pre + main（薄透镜景深）→ 辉光（只给自发光）→ NEUTRAL 色调映射 → 调色。
// 这套景深是自己写的确定性 gather，不像 @react-three/postprocessing 的 DepthOfField 那样在截帧时把物体弄丢。
// 原版按 1080x1920 竖屏调参并按输出高度缩放；我们是 1920x1080 横屏，线宽等按高度自动缩到 0.56 倍。
import React, {useEffect, useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {EffectComposer} from '@react-three/postprocessing';
import {BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode} from 'postprocessing';
import {InkPass, noInkFallback, type InkOptions} from './ink';
import {LensBlur} from './lensblur';
import {GradeEffect, GRADES} from './grade';

export type FilmOptions = {
  /** 无穷远处的虚化半径（px，按 1080 高算）；0 = 不虚化。原版：特写 12–16，中景 10–12，远景 0 */
  cInf: number;
  /** 对焦点（世界坐标），默认相机看的点 */
  focus?: [number, number, number];
  ink?: boolean;
  inkOptions?: InkOptions;
  grade?: 'day' | 'golden';
  bloom?: number;
};

const fwd = new THREE.Vector3();
const fpt = new THREE.Vector3();

export const FilmPost: React.FC<FilmOptions & {lookAt: [number, number, number]}> = ({cInf, focus, ink = true, inkOptions, grade = 'day', bloom = 0.5, lookAt}) => {
  const {camera, scene} = useThree();
  const fx = useMemo(() => {
    const b = new BloomEffect({blendFunction: BlendFunction.ADD, intensity: bloom, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6});
    return {
      ink: new InkPass(scene, camera as THREE.PerspectiveCamera, inkOptions),
      lens: new LensBlur({maxCoC: 24, nearScale: 1.2}),
      bloom: b,
      tone: new ToneMappingEffect({mode: ToneMappingMode.NEUTRAL}),
      grade: new GradeEffect(GRADES[grade], 1),
    };
  }, [camera, scene, inkOptions, grade, bloom]);
  useEffect(() => () => fx.ink.dispose(), [fx]);
  noInkFallback(scene);
  const cam = camera as THREE.PerspectiveCamera;
  cam.getWorldDirection(fwd);
  fpt.set(...(focus ?? lookAt));
  fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = cInf;
  return (
    <EffectComposer multisampling={4}>
      {ink ? <primitive object={fx.ink} dispose={null} /> : <></>}
      <primitive object={fx.lens.pre} dispose={null} />
      <primitive object={fx.lens.main} dispose={null} />
      <primitive object={fx.bloom} dispose={null} />
      <primitive object={fx.tone} dispose={null} />
      <primitive object={fx.grade} dispose={null} />
    </EffectComposer>
  );
};
