// 把蒙皮（骨骼动画）网格「烘焙」成普通网格：每帧在 CPU 上算出顶点被骨骼带动后的位置。
// 原因：Remotion 截帧时，只要开了 @react-three/postprocessing 的后期（EffectComposer），蒙皮网格会时有时无。
// 用法：const bake = useMemo(() => makeSkinBaker(root), [root]); ... mixer.setTime(t); bake();
import * as THREE from 'three';

export const makeSkinBaker = (root: THREE.Object3D) => {
  const pairs: {sk: THREE.SkinnedMesh; baked: THREE.Mesh}[] = [];
  const skins: THREE.SkinnedMesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) skins.push(o as THREE.SkinnedMesh);
  });
  for (const sk of skins) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', sk.geometry.attributes.position.clone());
    if (sk.geometry.attributes.uv) g.setAttribute('uv', sk.geometry.attributes.uv);
    if (sk.geometry.index) g.setIndex(sk.geometry.index.clone());
    for (const grp of sk.geometry.groups) g.addGroup(grp.start, grp.count, grp.materialIndex);
    const baked = new THREE.Mesh(g, sk.material);
    baked.position.copy(sk.position);
    baked.quaternion.copy(sk.quaternion);
    baked.scale.copy(sk.scale);
    baked.castShadow = sk.castShadow;
    baked.frustumCulled = false;
    sk.parent!.add(baked);
    sk.visible = false;
    pairs.push({sk, baked});
  }
  const v = new THREE.Vector3();
  return () => {
    root.updateMatrixWorld(true);
    for (const {sk, baked} of pairs) {
      sk.skeleton.update();
      const src = sk.geometry.attributes.position;
      const dst = baked.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < src.count; i++) {
        v.fromBufferAttribute(src, i);
        sk.applyBoneTransform(i, v);
        dst.setXYZ(i, v.x, v.y, v.z);
      }
      dst.needsUpdate = true;
      baked.geometry.computeVertexNormals();
      baked.geometry.computeBoundingSphere();
    }
  };
};
