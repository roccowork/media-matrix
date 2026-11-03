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

# ---------- 按真实比例校正血管直径（《方案补充》#12：真实的东西按正常成人比例） ----------
# 直径实测：管壁每个顶点沿法线往里打射线，打到对面管壁的距离的中位数（弯管也适用）。
# 只有超出正常成人范围的才调整（调到范围中点），做法是每个顶点沿法线移动 (目标 − 现在) / 2。
# 正常范围（mm，成人，影像学常用参考值）：
NORMAL_MM = {
    'Ascending aorta': (28, 34), 'Aortic arch': (22, 30), 'Brachiocephalic trunk': (10, 14),
    'Pulmonary trunk': (22, 29), 'Bifurcation of pulmonary trunk': (22, 29),
    'Left pulmonary artery': (15, 21), 'Right pulmonary artery': (15, 21),
    'Superior vena cava': (16, 22), 'Inferior vena cava (thoracic part)': (18, 25),
}
# 肺静脉不自动调整：看得见的管口属于左心房网格（粗细正常，约 12–15 mm），单独的肺静脉物体只是插在里面的细段，
# 射线测出来 6–7 mm 是假的；而且沿法线加粗会把短管口撑得坑坑洼洼（2026-11-03 试过）。
TOLERANCE = 0.10   # 测量误差：超出范围 10% 以内算正常
import statistics
from mathutils.bvhtree import BVHTree
MM = SCALE / 1000.0   # 1 mm 在放大后的模型里是多少单位
dg = bpy.context.evaluated_depsgraph_get()
for o in keep:
    rng = NORMAL_MM.get(o.name)
    if not rng:
        continue
    o.data.update()
    bvh = BVHTree.FromObject(o, dg)
    ds = []
    for v in o.data.vertices:
        n = v.normal.normalized()
        hit = bvh.ray_cast(v.co - n * 1e-4, -n)
        if hit[0] is not None:
            ds.append(hit[3])
    d_mm = statistics.median(ds) / MM
    if rng[0] * (1 - TOLERANCE) <= d_mm <= rng[1] * (1 + TOLERANCE):
        print(f'  {o.name}: {d_mm:.0f} mm，正常范围 {rng[0]}–{rng[1]}，不改')
        continue
    target = (rng[0] + rng[1]) / 2
    delta = (target - d_mm) / 2 * MM
    for v in o.data.vertices:
        v.co = v.co + v.normal.normalized() * delta
    o.data.update()
    print(f'  {o.name}: {d_mm:.0f} mm → {target:.1f} mm（正常范围 {rng[0]}–{rng[1]}）')

bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_materials='NONE', export_yup=True, export_apply=True)
print('写出', out)
