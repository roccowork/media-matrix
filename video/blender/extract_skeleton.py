# 从 Z-Anatomy（CC BY-SA 4.0）的骨骼系统 FBX 提取全身骨架 → public/assets/models/anatomy/skeleton.glb。只需跑一次。
# 用法：python blender/extract_skeleton.py <SkeletalSystem100.fbx> public/assets/models/anatomy/skeleton.glb
#      （或 blender -b -P blender/extract_skeleton.py -- <fbx> <out.glb>）
# 模型来源：https://github.com/LluisV/Z-Anatomy  Resources/Models/FBX/SkeletalSystem100.fbx
# 处理：
#   - 保留骨头、牙齿、肋软骨；去掉韧带、肌肉附着区贴片、喉软骨、鼻软骨、听小骨（藏在里面看不见）
#   - 面数很高的部件用 Collapse 减面（每件最多约 MAX_VERTS 个顶点；确定性算法），控制文件大小
#   - 真实尺寸（1 单位 = 1 米，不缩放）；原点放在两脚之间的地面上，写进 body_frame.json，血管网用同一个原点对齐
import json
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
src, out = argv[0], argv[1]
DROP_GROUPS = {'Laryngeal cartilages.g', 'Nasal cartilages.g', 'Auditory ossicles.g'}
DROP_WORDS = ('ligament', 'muscle', 'tendon')   # muscle / tendon：贴在骨面上的肌肉附着区贴片，不是骨头
MAX_VERTS = 1500

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src)


def ancestors(o):
    while o.parent:
        o = o.parent
        yield o.name


keep = [o for o in bpy.data.objects if o.type == 'MESH' and len(o.data.vertices) > 10
        and not any(a in DROP_GROUPS for a in ancestors(o)) and not any(w in o.name.lower() for w in DROP_WORDS)]
print('保留', len(keep), '件，减面前', sum(len(o.data.vertices) for o in keep), '个顶点')

# 世界变换烘进网格、断开父子关系、删掉其余
for o in keep:
    mw = o.matrix_world.copy()
    o.parent = None
    o.data = o.data.copy()
    o.data.transform(mw)
    o.matrix_world.identity()
for o in list(bpy.data.objects):
    if o not in keep:
        bpy.data.objects.remove(o, do_unlink=True)

# 减面
dg = bpy.context.evaluated_depsgraph_get()
for o in keep:
    n = len(o.data.vertices)
    if n <= MAX_VERTS:
        continue
    m = o.modifiers.new('dec', 'DECIMATE')
    m.decimate_type = 'COLLAPSE'
    m.ratio = MAX_VERTS / n
    bpy.context.view_layer.objects.active = o
    with bpy.context.temp_override(object=o, active_object=o):
        bpy.ops.object.modifier_apply(modifier=m.name)
print('减面后', sum(len(o.data.vertices) for o in keep), '个顶点')

# 原点：两脚之间的地面（x、y 取包围盒中心，z 取最低点）
lo = Vector((1e9, 1e9, 1e9)); hi = Vector((-1e9, -1e9, -1e9))
for o in keep:
    for v in o.data.vertices:
        lo = Vector(map(min, lo, v.co)); hi = Vector(map(max, hi, v.co))
offset = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
for o in keep:
    for v in o.data.vertices:
        v.co -= offset
    o.data.update()
    o.data.materials.clear()
size = hi - lo
print('骨架尺寸（米）：宽 %.3f  前后 %.3f  身高 %.3f' % tuple(size))
json.dump({'offset_m': list(offset), 'height_m': size.z, 'note': '原 FBX 坐标减去 offset_m 得到资产坐标（米，z 朝上，原点在两脚之间的地面）'},
          open(os.path.join(os.path.dirname(out), 'body_frame.json'), 'w'), indent=2)
# 不导出法线和贴图坐标（场景脚本里按平滑着色自动重算法线；没有贴图），文件小约四成。
# 不用 Draco 压缩：pip 版 bpy 没带 Draco 库，云端读不了
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_materials='NONE', export_yup=True, export_apply=True,
                          export_normals=False, export_texcoords=False)
print('写出', out)
