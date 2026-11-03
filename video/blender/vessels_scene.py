# Blender 资产 biology.vessels.v1：全身血管网（Z-Anatomy，CC BY-SA 4.0；真实尺寸，与骨架同一原点）。
# 读 ShotConfig → 导入 vessels.glb（每个部件带 kind：artery / vein / pulmonary_artery / pulmonary_vein / heart）
# → 动脉红、静脉蓝的湿润组织材质 + 可选「血流脉冲」（每次心跳一道光从心脏沿动脉往外传，静脉里一道弱光往回）
# → 可选半透明骨架当参照 → 布光 → 逐帧（脉冲时间 + 相机）→ Cycles 渲染 PNG 序列 → Remotion 合成 Blender-Vessels。
# 血流脉冲：每个顶点存「离心脏中心的距离」（顶点属性 dist），材质里用 Value 节点的时间 t 算 sin 包络，确定性。
# 用法同 skeleton_scene.py（video/ 目录下）：
#   blender -b -P blender/vessels_scene.py -- --config shotconfigs/biology.vessels.v1.json --out public/blender/biology.vessels.v1 [选项]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402
from common import Shot, bump_node, hex_rgb, math_node, mix, noise, ramp, set_input, tone  # noqa: E402

shot = Shot('biology.vessels.v1', {
    'artery': '#a3302c', 'vein': '#34488f', 'heart': '#74181b',
    'pulse': 1.0, 'bpm': 72, 'pulseSpeed': 1.2,
    'skeleton': 0.12, 'fstop': 4.0, 'seed': 'vessels',
})
P = shot.P
parts = shot.import_glb('public/assets/models/anatomy/vessels.glb')

# 心脏中心：所有 heart 部件的包围盒中心（脉冲从这里出发）
hv = [o.matrix_world @ v.co for o in parts if o.get('kind') == 'heart' for v in o.data.vertices]
lo = Vector((min(p.x for p in hv), min(p.y for p in hv), min(p.z for p in hv)))
hi = Vector((max(p.x for p in hv), max(p.y for p in hv), max(p.z for p in hv)))
heart_c = (lo + hi) / 2

# 时间节点：所有血管材质共用一个 Value（每帧在 apply_frame 里改它）
TIME = []


def vessel_mat(name, color, flow):
    # flow：+1 动脉（往外流），-1 静脉（往回流），0 心脏（不加脉冲）
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    set_input(b, 'Subsurface Weight', 0.3)
    set_input(b, 'Subsurface Radius', (1.0, 0.3, 0.18))
    set_input(b, 'Subsurface Scale', 0.004)
    set_input(b, 'Coat Weight', 0.45)
    set_input(b, 'Coat Roughness', 0.1)
    set_input(b, 'Specular IOR Level', 0.4)
    mot = noise(nt, 40.0, 6, 0.6)
    col = ramp(nt, mot.outputs['Fac'], [(0.3, tone(color, 0.7)), (0.55, color), (0.75, tone(color, 1.12))]).outputs['Color']
    rn = noise(nt, 90.0, 3, 0.5)
    rough = math_node(nt, 'ADD', math_node(nt, 'MULTIPLY', rn.outputs['Fac'], 0.25), 0.28)
    normal = bump_node(nt, noise(nt, 300.0, 2, 0.5).outputs['Fac'], 0.15, 0.0005)
    nt.links.new(col, b.inputs['Base Color'])
    nt.links.new(rough, b.inputs['Roughness'])
    nt.links.new(normal, b.inputs['Normal'])
    if flow != 0 and P['pulse'] > 0:
        # 脉冲：phase = dist / 波长 − t × 心率 / 60（动脉）；静脉方向相反、更弱
        tnode = nt.nodes.new('ShaderNodeValue')
        TIME.append(tnode)
        attr = nt.nodes.new('ShaderNodeAttribute'); attr.attribute_name = 'dist'
        lam = P['pulseSpeed'] * 60.0 / max(P['bpm'], 1)          # 一次心跳脉冲走过的距离（米）
        ph = math_node(nt, 'SUBTRACT', math_node(nt, 'DIVIDE', attr.outputs['Fac'], lam * flow),
                       math_node(nt, 'MULTIPLY', tnode.outputs[0], P['bpm'] / 60.0))
        frac = math_node(nt, 'FRACT', ph, 0.0)
        # 窄峰：(1 − frac)^12，离心脏越远越弱
        peak = math_node(nt, 'POWER', math_node(nt, 'SUBTRACT', 1.0, frac), 12.0)
        fade = math_node(nt, 'EXPONENT', math_node(nt, 'MULTIPLY', attr.outputs['Fac'], -1.2), 0.0)
        amt = math_node(nt, 'MULTIPLY', math_node(nt, 'MULTIPLY', peak, fade), P['pulse'] * (6.0 if flow > 0 else 2.0))
        nt.links.new(col, b.inputs['Emission Color'] if 'Emission Color' in b.inputs else b.inputs['Emission'])
        nt.links.new(amt, b.inputs['Emission Strength'])
    return m


MATS = {
    'artery': vessel_mat('artery', hex_rgb(P['artery']), 1),
    'pulmonary_vein': vessel_mat('pulmonary_vein', hex_rgb(P['artery']), -1),
    'vein': vessel_mat('vein', hex_rgb(P['vein']), -1),
    'pulmonary_artery': vessel_mat('pulmonary_artery', hex_rgb(P['vein']), 1),
    'heart': vessel_mat('heart', hex_rgb(P['heart']), 0),
}
for o in parts:
    k = o.get('kind', 'artery')
    o.data.materials.clear()
    o.data.materials.append(MATS[k])
    for poly in o.data.polygons:
        poly.use_smooth = True
    if k != 'heart':
        a = o.data.attributes.new('dist', 'FLOAT', 'POINT')
        mw = o.matrix_world
        a.data.foreach_set('value', [((mw @ v.co) - heart_c).length for v in o.data.vertices])

# 半透明骨架：参照用，浅色、半透明、不投影
if P['skeleton'] > 0:
    before = set(shot.scene.objects)
    shot.import_glb('public/assets/models/anatomy/skeleton.glb')
    bones = [o for o in shot.scene.objects if o not in before and o.type == 'MESH']
    gm = bpy.data.materials.new('ghost_bone')
    gm.use_nodes = True
    nt = gm.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.35, 0.4, 0.48, 1)   # 偏灰蓝，退到后面
    b.inputs['Roughness'].default_value = 0.5
    b.inputs['Alpha'].default_value = P['skeleton']
    try:
        gm.surface_render_method = 'BLENDED'
    except AttributeError:
        pass
    for o in bones:
        o.data.materials.clear()
        o.data.materials.append(gm)
        for poly in o.data.polygons:
            poly.use_smooth = True
        o.visible_shadow = False

shot.world((0.003, 0.005, 0.01, 1))
shot.area_light('key', (-2.5, -3.0, 3.0), 420, (1.0, 0.93, 0.85), 2.0, target=(0, 0, 1.0))
shot.area_light('fill', (3.0, -2.5, 1.2), 70, (0.85, 0.9, 1.0), 2.5, target=(0, 0, 0.9))
shot.area_light('rim_a', (2.0, 3.0, 2.4), 700, (0.5, 0.7, 1.0), 1.5, target=(0, 0, 1.0))
shot.area_light('rim_b', (-2.4, 2.6, 1.0), 450, (0.6, 0.6, 1.0), 1.5, target=(0, 0, 0.8))
shot.camera(fstop=P['fstop'])
shot.render_settings(P['seed'])


def apply_frame(f, t):
    for n in TIME:
        n.outputs[0].default_value = t


shot.run(apply_frame)
