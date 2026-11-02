// Quaternius 免费小猫模型（CC0，public/models/quaternius/Cat.fbx），带 Idle / Walking 动画。
// 注意：模型要在画布外用 delayRender 先加载完再交给 3D 场景（Suspense 加载完后 Remotion 不会重绘，截帧里会缺模型）。
import React, {useEffect, useMemo, useState} from 'react';
import * as THREE from 'three';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

const COLORS: Record<string, string> = {Grey: '#8d94a6', White: '#f4f1ea', Pink: '#ff9eb5'};

export const useCatModel = () => {
  const [obj, setObj] = useState<THREE.Group | null>(null);
  const [h] = useState(() => delayRender('小猫模型'));
  useEffect(() => {
    new FBXLoader().load(staticFile('models/quaternius/Cat.fbx'), (o) => {
      setObj(o);
      continueRender(h);
    });
  }, [h]);
  return obj;
};

/** 模型原始尺寸约 5.7 × 4.5（单位）；scale=0.004 时身长约 2.3、高约 1.8。脚底在 y=0，头朝 +x */
export const QuaterniusCat: React.FC<{
  model: THREE.Group;
  scale?: number;
  clip?: 'Idle' | 'Walking';
  /** 动画时间偏移（帧） */
  offset?: number;
  color?: Record<string, string>;
}> = ({model, scale = 0.004, clip = 'Idle', offset = 0, color}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {root, mixer, sk, baked} = useMemo(() => {
    const r = SkeletonUtils.clone(model) as THREE.Group;
    const cols = {...COLORS, ...color};
    r.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.frustumCulled = false; // 蒙皮网格缩放后包围盒不准，会被误裁掉
      const mats = (Array.isArray(m.material) ? m.material : [m.material]).map(
        (old) => new THREE.MeshStandardMaterial({color: cols[old.name] ?? '#cccccc', roughness: 0.55, metalness: 0.05}),
      );
      m.material = Array.isArray(m.material) ? mats : mats[0];
    });
    const mx = new THREE.AnimationMixer(r);
    const a = model.animations.find((x) => x.name.includes(clip)) ?? model.animations[0];
    if (a) mx.clipAction(a).play();
    // 骨骼动画「烘焙」成普通网格：后期的景深（DepthOfField）处理不了蒙皮网格，焦点离得远时小猫会整个消失。
    // 做法：每帧在 CPU 上算出每个顶点被骨骼带动后的位置，写进一个普通 Mesh；原蒙皮网格隐藏。
    let sk: THREE.SkinnedMesh | null = null;
    r.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh && !sk) sk = o as THREE.SkinnedMesh;
    });
    let baked: THREE.Mesh | null = null;
    if (sk) {
      const s0 = sk as THREE.SkinnedMesh;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', s0.geometry.attributes.position.clone());
      if (s0.geometry.index) g.setIndex(s0.geometry.index.clone());
      for (const grp of s0.geometry.groups) g.addGroup(grp.start, grp.count, grp.materialIndex);
      baked = new THREE.Mesh(g, s0.material);
      baked.position.copy(s0.position);
      baked.quaternion.copy(s0.quaternion);
      baked.scale.copy(s0.scale);
      baked.castShadow = true;
      baked.frustumCulled = false;
      s0.parent!.add(baked);
      s0.visible = false;
    }
    return {root: r, mixer: mx, sk: sk as THREE.SkinnedMesh | null, baked};
  }, [model, clip, color]);
  mixer.setTime((frame + offset) / fps);
  if (sk && baked) {
    root.updateMatrixWorld(true);
    sk.skeleton.update();
    const src = sk.geometry.attributes.position;
    const dst = baked.geometry.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < src.count; i++) {
      v.fromBufferAttribute(src, i);
      sk.applyBoneTransform(i, v);
      dst.setXYZ(i, v.x, v.y, v.z);
    }
    dst.needsUpdate = true;
    baked.geometry.computeVertexNormals();
    baked.geometry.computeBoundingSphere();
  }
  return (
    <group scale={scale}>
      <primitive object={root} />
    </group>
  );
};
