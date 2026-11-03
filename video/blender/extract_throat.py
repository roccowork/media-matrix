# 从 Z-Anatomy（CC BY-SA 4.0）提取头颈部结构 → public/assets/models/anatomy/throat.glb，给咽喉剖面资产（biology.throat.v1）用。只需跑一次。
# 用法（video/ 目录）：
#   python blender/extract_throat.py <VisceralSystem100.fbx> <SkeletalSystem100.fbx> public/assets/models/anatomy/throat.glb
# 模型来源：https://github.com/LluisV/Z-Anatomy  Resources/Models/FBX/
# 每件写 glTF extras 属性 kind（场景脚本按它配色）：
#   bone 颅骨各块、下颌骨、舌骨、颈椎；tooth 牙齿；cartilage 甲状 / 环状 / 杓状软骨、会厌（epiglottis 单独标出，场景里要动）
#   mucosa 鼻腔黏膜、鼻咽、口咽、喉咽；tongue 舌；palate 软腭、悬雍垂；airway 气管；oesophagus 食管；gland 甲状腺
# 真实尺寸（米），原点与骨架 / 血管网相同（body_frame.json 的 offset_m）。
import json
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
srcs, out = argv[:-1], argv[-1]
MAX_VERTS = 3000
frame = json.load(open(os.path.join(os.path.dirname(out), 'body_frame.json')))
offset = Vector(frame['offset_m'])

KIND = {
    'Mucosa of nasal cavity': 'mucosa', 'Nasopharynx': 'mucosa', 'Oropharynx': 'mucosa', 'Laryngopharynx': 'mucosa',
    'Tongue': 'tongue', 'Soft palate': 'palate', 'Uvula of palate': 'palate', 'Epiglottis': 'epiglottis',
    'Trachea': 'airway', 'Oesophagus': 'oesophagus', 'Thyroid gland': 'gland',
    'Thyroid cartilage': 'cartilage', 'Cricoid cartilage': 'cartilage', 'Arytenoid cartilage.l': 'cartilage', 'Arytenoid cartilage.r': 'cartilage',
    'Hyoid bone': 'bone', 'Mandible': 'bone', 'Frontal bone': 'bone', 'Parietal bone.l': 'bone', 'Parietal bone.r': 'bone', 'Occipital bone': 'bone',
    'Sphenoid bone': 'bone', 'Ethmoid bone': 'bone', 'Temporal bone.l': 'bone', 'Temporal bone.r': 'bone', 'Maxilla.l': 'bone', 'Maxilla.r': 'bone',
    'Palatine bone.l': 'bone', 'Palatine bone.r': 'bone', 'Nasal bone.l': 'bone', 'Nasal bone.r': 'bone', 'Vomer': 'bone',
    'Zygomatic bone.l': 'bone', 'Zygomatic bone.r': 'bone',
}
GROUPS = {'Cervical vertebrae.g': 'bone', 'Teeth.g': 'tooth', 'Permanent teeth.g': 'tooth'}
SKIP = ('muscle', 'ligament', 'tendon', '.o', '.e', '.j', '.t', 'profile')

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
    if k is None and not any(x in o.name.lower() for x in SKIP):
        for g in ancestors(o):
            if g in GROUPS:
                k = GROUPS[g]
                break
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
