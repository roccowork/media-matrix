# 从 Z-Anatomy（CC BY-SA 4.0）的心血管系统 FBX 里提取心脏 + 相连的大血管，存成 GLB 给 heart_scene.py 用。
# 只需要跑一次（结果已提交到 public/assets/models/anatomy/heart.glb）；换模型源时重跑。
# 用法（Blender 4.2+ 或 pip 装的 bpy 都行）：
#   blender -b -P blender/extract_heart.py -- <CardioVascular41.fbx> public/assets/models/anatomy/heart.glb
#   python blender/extract_heart.py <fbx> <out.glb>        # 用 pip 的 bpy 时
# 模型来源：https://github.com/LluisV/Z-Anatomy  Resources/Models/FBX/CardioVascular41.fbx
import sys
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
src, out = argv[0], argv[1]

# 心脏本体整组取；血管只取贴着心脏的那几段（其余全身血管不要）
GROUPS = ['Heart.g', 'Arteries of heart.g', 'Cardiac veins.g']
VESSELS = [
    'Ascending aorta', 'Aortic arch', 'Brachiocephalic trunk',
    'Pulmonary trunk', 'Bifurcation of pulmonary trunk', 'Left pulmonary artery', 'Right pulmonary artery',
    'Left superior pulmonary vein', 'Left inferior pulmonary vein', 'Right superior pulmonary vein', 'Right inferior pulmonary vein',
    'Superior vena cava', 'Inferior vena cava (thoracic part)',
]
SCALE = 10.0  # 原模型单位是米（心脏约 0.12），放大到约 1.2，方便镜头和灯光取整数

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src)


def ancestors(o):
    while o.parent:
        o = o.parent
        yield o.name


keep = []
for o in bpy.data.objects:
    if o.type != 'MESH' or len(o.data.vertices) <= 10:   # .j / .t 是标注用的两点线，不要
        continue
    if o.name in VESSELS or any(a in GROUPS for a in ancestors(o)):
        keep.append(o)
print('保留', len(keep), '个部件，', sum(len(o.data.vertices) for o in keep), '个顶点')

# 保留物体的世界变换烘进网格，断开父子关系，删掉其余物体
mats = {o.name: o.matrix_world.copy() for o in keep}
for o in keep:
    o.parent = None
    o.data = o.data.copy()
    o.data.transform(mats[o.name])
    o.matrix_world.identity()
for o in list(bpy.data.objects):
    if o not in keep:
        bpy.data.objects.remove(o, do_unlink=True)

# 以心脏本体（四个腔）的包围盒中心为原点，放大
cham = [o for o in keep if o.name in ('Left atrium', 'Right atrium', 'Left ventricle', 'Right ventricle')]
lo = Vector((1e9, 1e9, 1e9)); hi = Vector((-1e9, -1e9, -1e9))
for o in cham:
    for v in o.data.vertices:
        lo = Vector(map(min, lo, v.co)); hi = Vector(map(max, hi, v.co))
c = (lo + hi) / 2
for o in keep:
    for v in o.data.vertices:
        v.co = (v.co - c) * SCALE
    o.data.update()
    o.data.materials.clear()   # 材质由 heart_scene.py 按部件名重新指定
print('心脏尺寸', tuple(round(x * SCALE, 3) for x in (hi - lo)))

bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_materials='NONE', export_yup=True, export_apply=True)
print('写出', out)
