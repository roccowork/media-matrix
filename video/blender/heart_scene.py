# Blender 最小自动化示例（方案第七节 / 第十三节第 2 周）：
#   读 ShotConfig（JSON，与 Three.js 镜头同一套 Schema，renderer = "blender"）
#   → Python 自动建场景：导入心脏模型（Z-Anatomy，CC BY-SA 4.0）、按部件名指定程序化材质、三点布光 + 轮廓光、相机
#   → 逐帧设置心跳和相机位姿 → Cycles 渲染 PNG 图片序列
#   → Remotion 的 Blender-Heart 合成读取这些 PNG（src/shots/heart/BlenderHeart.tsx）。
# 确定性：没有任何随机数（心跳、相机都是时间的函数），Cycles 固定 seed、不开动画种子；同一台机器同样参数重渲结果一致。
# 公共部分（参数、相机、渲染设置、确定性检查）在 blender/common.py。
#
# 用法（在 video/ 目录下）：
#   blender -b -P blender/heart_scene.py -- --config shotconfigs/biology.heart.v1.json --out public/blender/biology.heart.v1 [选项]
#   python blender/heart_scene.py --config ... --out ...          # 用 pip 装的 bpy（云端会话里出单帧检查用）
# 选项：--frames 0-299 | 0,150,290；--scale 0.5；--samples 128；--device GPU|CPU；--determinism 帧号
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mathutils import Euler  # noqa: E402
from common import Shot, hex_rgb, kdtree, math_node as _math, mix as _mix, noise as _noise, ramp as _ramp, set_input as _set, tone as shade_tone  # noqa: E402

shot = Shot('biology.heart.v1', {
    'bpm': 72, 'beat': 1.0, 'spin': 0.0,
    'myocardium': '#74181b', 'artery': '#963431', 'vein': '#3b4683', 'valve': '#e6c3ae',
    'fstop': 2.8, 'seed': 'heart', 'fat': 1.0, 'fatReach': 0.05, 'embed': 0.15, 'coronaryArtery': '#7c2624', 'coronaryVein': '#3c3c70',
})
P = shot.P
scene = shot.scene


# ---------- 场景 ----------
parts = shot.import_glb('public/assets/models/anatomy/heart.glb')

# 部件 → 材质类别（教科书配色：含氧血红、缺氧血蓝）
CORONARY_WORDS = ('coronary', 'cardiac vein', 'interventricular', 'circumflex', 'sinus', 'inferolateral', 'septal branches', 'vein of left ventricle')


def is_coronary(name):
    n = name.lower()
    return any(w in n for w in CORONARY_WORDS)


def part_kind(name):
    n = name.lower()
    if is_coronary(name):
        # 冠状血管单独一类：半埋在心肌 / 脂肪里，颜色更暗、反光更弱
        return 'coronary_vein' if ('vein' in n or 'sinus' in n) else 'coronary_artery'
    if 'leaflet' in n:
        return 'valve'
    if 'vein' in n or 'sinus' in n or 'vena cava' in n:
        return 'pulmonary_vein' if 'pulmonary' in n else 'vein'
    if 'pulmonary' in n:
        return 'pulmonary_artery'
    if 'artery' in n or 'aort' in n or 'trunk' in n or 'branches' in n:
        return 'artery'
    return 'myocardium'


def make_tissue(name, color, kind):
    # 湿润生物组织：颜色斑驳（不均匀）、次表面透光、粗糙度有变化、清漆层带细碎凹凸（高光一闪一闪，不是一层亮漆）
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    _set(b, 'Subsurface Weight', 0.4 if kind == 'muscle' else 0.3)
    _set(b, 'Subsurface Radius', (1.0, 0.3, 0.18))
    _set(b, 'Subsurface Scale', 0.06)
    _set(b, 'Coat Weight', {'muscle': 0.7, 'vessel': 0.45, 'coronary': 0.3}[kind])
    _set(b, 'Coat Roughness', 0.07)
    _set(b, 'Coat IOR', 1.38)
    _set(b, 'Specular IOR Level', 0.4)
    # 颜色斑驳：大尺度噪声在深 / 浅 / 偏紫之间变化
    mot = _noise(nt, 2.2, 8, 0.6)
    col = _ramp(nt, mot.outputs['Fac'], [
        (0.30, shade_tone(color, 0.55)), (0.5, color), (0.62, shade_tone(color, 1.15)),
        (0.78, (color[0] * 0.75, color[1] * 0.6, color[2] * 1.5 + 0.01, 1.0)),
    ]).outputs['Color']
    # 肌纤维：沿一个方向拉长的细噪声，压一点深浅
    fib = _noise(nt, 6.0, 4, 0.5, stretch=(18, 18, 60) if kind == 'muscle' else (6, 6, 30))
    col = _mix(nt, col, shade_tone(color, 0.7), _math(nt, 'MULTIPLY', fib.outputs['Fac'], 0.35))
    rough_n = _noise(nt, 9.0, 3, 0.5)
    rough = _math(nt, 'ADD', _math(nt, 'MULTIPLY', rough_n.outputs['Fac'], 0.35), 0.3)
    # 清漆层的细碎凹凸：湿润表面的闪点
    wet = _noise(nt, 70.0, 2, 0.5)
    wb = nt.nodes.new('ShaderNodeBump'); wb.inputs['Strength'].default_value = 0.35; wb.inputs['Distance'].default_value = 0.002
    nt.links.new(wet.outputs['Fac'], wb.inputs['Height'])
    if 'Coat Normal' in b.inputs:
        nt.links.new(wb.outputs['Normal'], b.inputs['Coat Normal'])
    # 底层凹凸：纤维 + 斑驳
    bb = nt.nodes.new('ShaderNodeBump'); bb.inputs['Strength'].default_value = 0.3; bb.inputs['Distance'].default_value = 0.01
    nt.links.new(fib.outputs['Fac'], bb.inputs['Height'])
    normal = bb.outputs['Normal']
    if kind == 'muscle':
        # 心外膜脂肪：顶点属性 fat（离冠状血管越近越大，见下方 bake_fat），叠上团块状噪声，混成黄白色、更凹凸
        attr = nt.nodes.new('ShaderNodeAttribute'); attr.attribute_name = 'fat'
        lump = _noise(nt, 14.0, 5, 0.6)
        fat_f = _math(nt, 'MULTIPLY', attr.outputs['Fac'], _math(nt, 'ADD', _math(nt, 'MULTIPLY', lump.outputs['Fac'], 2.4), -0.85))
        fat_f = _math(nt, 'MINIMUM', _math(nt, 'MAXIMUM', fat_f, 0.0), 1.0)
        fat_col = _ramp(nt, lump.outputs['Fac'], [(0.35, (0.62, 0.42, 0.13, 1)), (0.65, (0.85, 0.66, 0.30, 1))]).outputs['Color']
        col = _mix(nt, col, fat_col, fat_f)
        rough = _mix(nt, rough, (0.45, 0.45, 0.45, 1), fat_f)
        fb = nt.nodes.new('ShaderNodeBump'); fb.inputs['Strength'].default_value = 0.6; fb.inputs['Distance'].default_value = 0.03
        nt.links.new(_math(nt, 'MULTIPLY', lump.outputs['Fac'], fat_f), fb.inputs['Height'])
        nt.links.new(normal, fb.inputs['Normal'])
        normal = fb.outputs['Normal']
    nt.links.new(col, b.inputs['Base Color'])
    nt.links.new(rough, b.inputs['Roughness'])
    nt.links.new(normal, b.inputs['Normal'])
    return m


MATS = {
    'myocardium': make_tissue('myocardium', hex_rgb(P['myocardium']), 'muscle'),
    'artery': make_tissue('artery', hex_rgb(P['artery']), 'vessel'),
    'pulmonary_vein': make_tissue('pulmonary_vein', hex_rgb(P['artery']), 'vessel'),
    'vein': make_tissue('vein', hex_rgb(P['vein']), 'vessel'),
    'pulmonary_artery': make_tissue('pulmonary_artery', hex_rgb(P['vein']), 'vessel'),
    'valve': make_tissue('valve', hex_rgb(P['valve']), 'vessel'),
    'coronary_artery': make_tissue('coronary_artery', hex_rgb(P['coronaryArtery']), 'coronary'),
    'coronary_vein': make_tissue('coronary_vein', hex_rgb(P['coronaryVein']), 'coronary'),
}
for o in parts:
    o.data.materials.clear()
    o.data.materials.append(MATS[part_kind(o.name)])
    for poly in o.data.polygons:
        poly.use_smooth = True


def bake_fat():
    # 每个心肌顶点到最近冠状血管（动脉 + 心静脉）的距离 → 顶点属性 fat（0–1）。确定性：纯几何计算
    vessels = [o for o in parts if is_coronary(o.name)]
    kd = kdtree([o.matrix_world @ v.co for o in vessels for v in o.data.vertices])
    reach = P.get('fatReach', 0.05)
    for o in parts:
        if part_kind(o.name) != 'myocardium':
            continue
        attr = o.data.attributes.new('fat', 'FLOAT', 'POINT')
        mw = o.matrix_world
        vals = []
        for v in o.data.vertices:
            _, _, d = kd.find(mw @ v.co)
            x = max(0.0, 1.0 - d / reach)
            vals.append(x * x * (3 - 2 * x) * P.get('fat', 1.0))
        attr.data.foreach_set('value', vals)
    print('心外膜脂肪：参考', len(vessels), '条冠状血管')


def embed_coronaries():
    # 冠状血管在原模型里整根浮在心肌表面、显得太粗太突兀：每个顶点往最近的心肌表面拉 embed 比例
    # → 管子朝外的一侧压下去，变细、半埋进心肌，走向不变。确定性：纯几何计算
    k = P['embed']
    if k <= 0:
        return
    myo = [o for o in parts if part_kind(o.name) == 'myocardium']
    kd = kdtree([o.matrix_world @ v.co for o in myo for v in o.data.vertices])
    for o in parts:
        if not is_coronary(o.name):
            continue
        mw = o.matrix_world
        inv = mw.inverted()
        for v in o.data.vertices:
            w = mw @ v.co
            near, _, _ = kd.find(w)
            v.co = inv @ (w + (near - w) * k)
        o.data.update()


embed_coronaries()
bake_fat()

# 所有部件挂到一个空物体下：心跳 / 自转都作用在它上面（冠状血管贴着心肌，一起动）
pivot = bpy.data.objects.new('heart_pivot', None)
scene.collection.objects.link(pivot)
for o in parts:
    o.parent = pivot

# 世界：深色；主光（左上前，暖）、补光（右前，弱）、两盏轮廓光（后方，冷蓝 + 洋红）把心脏从暗背景里勾出来
shot.world()
shot.area_light('key', (-2.2, -2.4, 2.4), 260, (1.0, 0.92, 0.85), 1.6)
shot.area_light('fill', (2.6, -2.0, 0.4), 60, (0.85, 0.9, 1.0), 2.0)
shot.area_light('rim_a', (1.8, 2.6, 1.6), 320, (0.45, 0.65, 1.0), 1.2)
shot.area_light('rim_b', (-2.2, 2.2, -0.8), 200, (1.0, 0.45, 0.6), 1.2)
shot.camera(fstop=P['fstop'])
shot.render_settings(P['seed'])


# ---------- 每帧：心跳（相机由 shot.run 统一设置） ----------
def bump(x, c, w):
    # 心动周期里的一次收缩（周期性高斯）
    d = (x - c + 0.5) % 1.0 - 0.5
    return math.exp(-(d * d) / (2 * w * w))


def heartbeat(t):
    # 一次心跳两下：心房收缩（小）→ 心室收缩（大）；舒张期慢慢回弹
    ph = (t * P['bpm'] / 60.0) % 1.0
    atr = bump(ph, 0.05, 0.05)
    ven = bump(ph, 0.3, 0.09)
    k = P['beat']
    s = 1 - k * (0.02 * atr + 0.06 * ven)
    sz = 1 - k * (0.01 * atr + 0.035 * ven)   # 竖向收得少一点
    twist = k * 0.035 * ven                    # 心室收缩时轻微扭转
    return s, sz, twist


def apply_frame(f, t):
    s, sz, twist = heartbeat(t)
    pivot.scale = (s, s, sz)
    pivot.rotation_euler = Euler((0, 0, twist + P['spin'] * t))


shot.run(apply_frame)
