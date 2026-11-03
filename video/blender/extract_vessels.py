# 从 Z-Anatomy（CC BY-SA 4.0）的心血管系统 FBX 提取全身血管网 → public/assets/models/anatomy/vessels.glb。只需跑一次。
# 用法：python blender/extract_vessels.py <CardioVascular41.fbx> public/assets/models/anatomy/vessels.glb
# 模型来源：https://github.com/LluisV/Z-Anatomy  Resources/Models/FBX/CardioVascular41.fbx
# 处理：
#   - 全身动脉（Arterial system）+ 静脉（Venous system）+ 心脏；去掉标注用的两点线
#   - 每个部件写一个附加属性 kind（glTF extras，场景脚本按它配色）：
#       artery 动脉（红）/ vein 静脉（蓝）/ pulmonary_artery 肺动脉（缺氧血，蓝）/ pulmonary_vein 肺静脉（含氧血，红）/ heart 心脏本体
#   - 减面（每件最多 MAX_VERTS 个顶点），不导出法线和贴图坐标，控制文件大小
#   - 真实尺寸（米），原点与骨架相同（读 body_frame.json 的 offset_m），两者可以直接叠在一起
import json
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
src, out = argv[0], argv[1]
MAX_VERTS = 1500
frame = json.load(open(os.path.join(os.path.dirname(out), 'body_frame.json')))
offset = Vector(frame['offset_m'])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src)


def ancestors(o):
    while o.parent:
        o = o.parent
        yield o.name


def kind_of(o):
    anc = list(ancestors(o))
    n = o.name.lower()
    if 'Heart.g' in anc:
        return 'heart'
    if 'Pulmonary arteries.g' in anc or ('pulmonary' in n and 'arter' in n) or 'pulmonary trunk' in n:
        return 'pulmonary_artery'
    if 'Pulmonary veins.g' in anc or ('pulmonary' in n and 'vein' in n):
        return 'pulmonary_vein'
    if 'Venous system.g' in anc:
        return 'vein'
    return 'artery'


keep = [o for o in bpy.data.objects if o.type == 'MESH' and len(o.data.vertices) > 10]
kinds = {o.name: kind_of(o) for o in keep}
print('保留', len(keep), '件，减面前', sum(len(o.data.vertices) for o in keep), '个顶点')
for o in keep:
    mw = o.matrix_world.copy()
    o.parent = None
    o.data = o.data.copy()
    o.data.transform(mw)
    o.matrix_world.identity()
for o in list(bpy.data.objects):
    if o not in keep:
        bpy.data.objects.remove(o, do_unlink=True)

for o in keep:
    n = len(o.data.vertices)
    if n > MAX_VERTS:
        m = o.modifiers.new('dec', 'DECIMATE')
        m.decimate_type = 'COLLAPSE'
        m.ratio = MAX_VERTS / n
        with bpy.context.temp_override(object=o, active_object=o):
            bpy.ops.object.modifier_apply(modifier=m.name)
    for v in o.data.vertices:
        v.co -= offset
    o.data.update()
    o.data.materials.clear()
    o['kind'] = kinds[o.name]
print('减面后', sum(len(o.data.vertices) for o in keep), '个顶点')
from collections import Counter
print('分类', dict(Counter(kinds.values())))
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_materials='NONE', export_yup=True, export_apply=True,
                          export_normals=False, export_texcoords=False, export_extras=True)
print('写出', out)
