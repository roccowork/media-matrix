# 从 Z-Anatomy（CC BY-SA 4.0）提取颈胸部结构 → public/assets/models/anatomy/neck.glb，给喉返神经资产（biology.rln.v1）用。只需跑一次。
# 用法（video/ 目录）：
#   python blender/extract_neck.py <NervousSystem100.fbx> <CardioVascular41.fbx> <VisceralSystem100.fbx> <SkeletalSystem100.fbx> public/assets/models/anatomy/neck.glb
# 模型来源：https://github.com/LluisV/Z-Anatomy  Resources/Models/FBX/
# 提取的部件（每件写 glTF extras 属性 kind，场景脚本按它配色）：
#   nerve      左右迷走神经（Z-Anatomy 的迷走神经没有喉返支——喉返神经由场景脚本按解剖走法、卡在这些结构的真实位置上画，《方案补充》#28）
#   artery     升主动脉、主动脉弓、胸主动脉、头臂干、左右颈总动脉、左右锁骨下动脉
#   pulmonary  肺动脉干、左右肺动脉（缺氧血）
#   vein       上腔静脉、左右头臂静脉
#   heart      心脏（Heart.g 下全部部件）
#   airway     气管、左右主支气管；cartilage 甲状软骨、环状软骨、杓状软骨、会厌；bone 舌骨
#   oesophagus 食管、喉咽；gland 甲状腺
# 真实尺寸（米），原点与骨架 / 血管网相同（读 body_frame.json 的 offset_m），可以叠在一起。
import json
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
srcs, out = argv[:-1], argv[-1]
MAX_VERTS = 2500
frame = json.load(open(os.path.join(os.path.dirname(out), 'body_frame.json')))
offset = Vector(frame['offset_m'])

KIND = {
    'Vagus nerve (X).l': 'nerve', 'Vagus nerve (X).r': 'nerve',
    'Ascending aorta': 'artery', 'Aortic arch': 'artery', 'Thoracic aorta': 'artery', 'Brachiocephalic trunk': 'artery',
    'Left common carotid artery': 'artery', 'Right common carotid artery': 'artery',
    'Left subclavian artery': 'artery', 'Right subclavian artery': 'artery',
    'Pulmonary trunk': 'pulmonary', 'Bifurcation of pulmonary trunk': 'pulmonary', 'Left pulmonary artery': 'pulmonary', 'Right pulmonary artery': 'pulmonary',
    'Superior vena cava': 'vein', 'Left brachiocephalic vein': 'vein', 'Right brachiocephalic vein': 'vein',
    'Trachea': 'airway', 'Left main bronchus': 'airway', 'Right main bronchus': 'airway',
    'Thyroid cartilage': 'cartilage', 'Cricoid cartilage': 'cartilage', 'Arytenoid cartilage.l': 'cartilage', 'Arytenoid cartilage.r': 'cartilage',
    'Epiglottis': 'cartilage', 'Hyoid bone': 'bone',
    'Oesophagus': 'oesophagus', 'Laryngopharynx': 'oesophagus', 'Thyroid gland': 'gland',
}

bpy.ops.wm.read_factory_settings(use_empty=True)
for s in srcs:
    bpy.ops.import_scene.fbx(filepath=s)


def ancestors(o):
    while o.parent:
        o = o.parent
        yield o.name


keep, kinds = [], {}
for o in bpy.data.objects:
    if o.type != 'MESH' or len(o.data.vertices) <= 20 or o.name in kinds:
        continue
    k = KIND.get(o.name)
    if k is None and 'Heart.g' in ancestors(o):
        k = 'heart'
    if k:
        keep.append(o)
        kinds[o.name] = k
missing = [n for n in KIND if n not in kinds]
print('保留', len(keep), '件；缺少', missing)

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

from collections import Counter  # noqa: E402
print('减面后', sum(len(o.data.vertices) for o in keep), '个顶点；分类', dict(Counter(kinds.values())))
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_materials='NONE', export_yup=True, export_apply=True,
                          export_normals=False, export_texcoords=False, export_extras=True)
print('写出', out)
