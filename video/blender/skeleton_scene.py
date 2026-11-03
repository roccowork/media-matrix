# Blender 资产 biology.skeleton.v1：全身骨架（Z-Anatomy，CC BY-SA 4.0；真实尺寸，身高约 1.70 米）。
# 读 ShotConfig → 导入 skeleton.glb → 按部件名分骨头 / 牙齿 / 肋软骨三种程序化材质 → 布光 → 逐帧相机（+ 可选自转）→ Cycles 渲染 PNG 序列
# → Remotion 合成 Blender-Skeleton。公共部分见 blender/common.py。
# 用法（video/ 目录下）：
#   blender -b -P blender/skeleton_scene.py -- --config shotconfigs/biology.skeleton.v1.json --out public/blender/biology.skeleton.v1 [选项]
#   python blender/skeleton_scene.py --config ... --out ... --frames 0,150,290 --scale 0.5 --samples 48 --device CPU   # 云端出单帧
# 坐标：资产原点在两脚之间的地面，z 朝上（ShotConfig 里按 three.js 的 y 朝上写：头顶约 y = 1.70）。
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402  （pip 版 bpy 要先 import bpy，mathutils 才能用）
from mathutils import Euler  # noqa: E402
from common import Shot, bump_node, hex_rgb, math_node, mix, noise, ramp, set_input, tone  # noqa: E402

shot = Shot('biology.skeleton.v1', {
    'spin': 0.0, 'bone': '#cdbb98', 'tooth': '#e6e0d0', 'cartilage': '#c9d4d6', 'fstop': 4.0, 'seed': 'skeleton',
    'lumbarStress': 0.0, 'stressAt': 1.0, 'stressRamp': 2.0, 'stressColor': '#ff2410',
})
P = shot.P
parts = shot.import_glb('public/assets/models/anatomy/skeleton.glb')

TEETH = ('tooth', 'incisor', 'canine', 'premolar', 'molar')


def part_kind(name):
    n = name.lower()
    if any(w in n for w in TEETH):
        return 'tooth'
    if 'cartilage' in n or 'disc' in n:
        return 'cartilage'
    return 'bone'


def make_bone(name, color, kind):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    set_input(b, 'Subsurface Weight', {'bone': 0.2, 'tooth': 0.15, 'cartilage': 0.5}[kind])
    set_input(b, 'Subsurface Radius', (1.0, 0.75, 0.5))
    set_input(b, 'Subsurface Scale', 0.004)
    set_input(b, 'Specular IOR Level', 0.35)
    set_input(b, 'Coat Weight', {'bone': 0.0, 'tooth': 0.35, 'cartilage': 0.3}[kind])
    set_input(b, 'Coat Roughness', 0.15)
    # 颜色：大尺度斑驳（偏黄 / 偏褐 / 偏白）
    mot = noise(nt, 18.0, 6, 0.6)
    col = ramp(nt, mot.outputs['Fac'], [
        (0.3, (color[0] * 0.78, color[1] * 0.70, color[2] * 0.55, 1)), (0.55, color), (0.75, tone(color, 1.08)),
    ]).outputs['Color']
    # 凹处压暗：Cycles 的 Pointiness（凸 > 0.5，凹 < 0.5），关节窝、骨缝、孔洞自然变暗
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    cav = ramp(nt, geo.outputs['Pointiness'], [(0.44, (0.35, 0.3, 0.26, 1)), (0.51, (1, 1, 1, 1))]).outputs['Color']
    mm = nt.nodes.new('ShaderNodeMix'); mm.data_type = 'RGBA'; mm.blend_type = 'MULTIPLY'
    mm.inputs[0].default_value = 1.0 if kind == 'bone' else 0.5
    nt.links.new(col, mm.inputs[6]); nt.links.new(cav, mm.inputs[7])
    col = mm.outputs[2]
    # 粗糙度：骨头哑光、有变化；牙齿 / 软骨更光
    rn = noise(nt, 40.0, 3, 0.5)
    base_r = {'bone': 0.5, 'tooth': 0.22, 'cartilage': 0.3}[kind]
    rough = math_node(nt, 'ADD', math_node(nt, 'MULTIPLY', rn.outputs['Fac'], 0.25), base_r - 0.1)
    # 凹凸：骨质细孔（高频）+ 较大的起伏
    pores = noise(nt, 260.0, 2, 0.5)
    ridge = noise(nt, 30.0, 5, 0.6)
    n1 = bump_node(nt, ridge.outputs['Fac'], 0.15, 0.002)
    normal = bump_node(nt, pores.outputs['Fac'], 0.25 if kind == 'bone' else 0.05, 0.0005, n1)
    nt.links.new(col, b.inputs['Base Color'])
    nt.links.new(rough, b.inputs['Roughness'])
    nt.links.new(normal, b.inputs['Normal'])
    return m


MATS = {k: make_bone(k, hex_rgb(P[k]), k) for k in ('bone', 'tooth', 'cartilage')}

# 腰椎受力泛红（1.1.0 新增，默认关）：L1 → L5 越往下越红（L5 承重最大），骶骨次之；亮度按心跳节奏轻微脉动
STRESS_W = {'Vertebra L1': 0.35, 'Vertebra L2': 0.5, 'Vertebra L3': 0.65, 'Vertebra L4': 0.85, 'Vertebra L5': 1.0, 'Sacrum': 0.5}
STRESS = []   # (Emission Strength 输入, 权重)


def stressed_bone(name, w):
    m = make_bone(name, hex_rgb(P['bone']), 'bone')
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Emission Color' if 'Emission Color' in b.inputs else 'Emission'].default_value = hex_rgb(P['stressColor'])
    # 底色也往暗红调（骨头本身米白，只靠发光会显得粉），调色程度每帧随泛红强度变
    nt = m.node_tree
    src = b.inputs['Base Color'].links[0].from_socket
    mx = nt.nodes.new('ShaderNodeMixRGB')
    mx.blend_type = 'MULTIPLY'
    mx.inputs['Color2'].default_value = (0.75, 0.12, 0.07, 1)
    nt.links.new(src, mx.inputs['Color1'])
    nt.links.new(mx.outputs['Color'], b.inputs['Base Color'])
    STRESS.append((b.inputs['Emission Strength'], w, mx.inputs['Fac']))
    return m


for o in parts:
    o.data.materials.clear()
    key = next((k for k in STRESS_W if o.name.startswith(k)), None)
    if key and P['lumbarStress'] > 0:
        o.data.materials.append(stressed_bone(f'stress_{key}', STRESS_W[key]))
        for poly in o.data.polygons:
            poly.use_smooth = True
        continue
    o.data.materials.append(MATS[part_kind(o.name)])
    for poly in o.data.polygons:
        poly.use_smooth = True

pivot = bpy.data.objects.new('skeleton_pivot', None)
shot.scene.collection.objects.link(pivot)
for o in parts:
    o.parent = pivot

# 布光：暖色主光（左前上）、弱补光、两盏冷色轮廓光（后方），深色背景
shot.world((0.003, 0.005, 0.01, 1))
shot.area_light('key', (-2.5, -3.0, 3.0), 420, (1.0, 0.93, 0.85), 2.0, target=(0, 0, 1.0))
shot.area_light('fill', (3.0, -2.5, 1.2), 70, (0.85, 0.9, 1.0), 2.5, target=(0, 0, 0.9))
shot.area_light('rim_a', (2.0, 3.0, 2.4), 700, (0.5, 0.7, 1.0), 1.5, target=(0, 0, 1.0))
shot.area_light('rim_b', (-2.4, 2.6, 1.0), 450, (0.6, 0.6, 1.0), 1.5, target=(0, 0, 0.8))
shot.camera(fstop=P['fstop'])
shot.render_settings(P['seed'])


def apply_frame(f, t):
    pivot.rotation_euler = Euler((0, 0, P['spin'] * t))
    if STRESS:
        k = min(1.0, max(0.0, (t - P['stressAt']) / max(P['stressRamp'], 0.01)))
        k = k * k * (3 - 2 * k)
        beat = 0.8 + 0.2 * math.sin(2 * math.pi * 1.2 * t) ** 2
        for inp, w, tint in STRESS:
            inp.default_value = P['lumbarStress'] * 1.6 * w * w * k * beat   # 平方让 L1 → L5 的差别更明显
            tint.default_value = min(1.0, P['lumbarStress'] * w * k)


shot.run(apply_frame)
