# Blender 资产 biology.rln.v1：喉返神经的「绕远路」（Z-Anatomy 颈胸部结构 + 按解剖走法画的喉返神经；真实尺寸，与骨架同一原点）。
# 读 ShotConfig → 导入 neck.glb（kind：nerve / artery / pulmonary / vein / heart / airway / cartilage / bone / oesophagus / gland）
# → 按模型里的真实位置算出喉返神经路径（《方案补充》#28）：
#     左侧：从左迷走神经在主动脉弓外侧分出 → 从主动脉弓下方钩过 → 绕到弓的后面 → 沿气管与食管之间的沟上行 → 在环状软骨后方入喉
#     右侧：从右迷走神经在右锁骨下动脉前方分出 → 从右锁骨下动脉下方钩过 → 沿右侧气管食管沟上行 → 入喉
#   粗细按真实值（直径约 1.8 mm）
# → 光脉冲：从迷走神经上端往下走，到分叉处拐进喉返神经，绕过血管再折回喉咙；走过的喉返神经留一条余光
# → 布光 → 逐帧（脉冲 + 相机）→ Cycles 渲染 PNG 序列 → Remotion 合成 Blender-Rln。
# 用法同其他场景（video/ 目录下）：
#   blender -b -P blender/rln_scene.py -- --config shotconfigs/biology.rln.v1.json --out public/blender/biology.rln.v1 [选项]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402
from common import Shot, bump_node, hex_rgb, kdtree, math_node, noise, ramp, set_input, tone  # noqa: E402

shot = Shot('biology.rln.v1', {
    'left': True, 'right': True, 'heart': True,
    'pulse': 1.0, 'pulseAt': 1.0, 'pulseSpeed': 0.08, 'trail': 0.5,
    'nerveColor': '#f2cf63', 'halo': 1.0, 'vesselAlpha': 1.0, 'fstop': 5.6, 'seed': 'rln',
})
P = shot.P
parts = shot.import_glb('public/assets/models/anatomy/neck.glb')
by_name = {o.name: o for o in parts}


def verts(o):
    mw = o.matrix_world
    return [mw @ v.co for v in o.data.vertices]


def find(prefix):
    for n, o in by_name.items():
        if n.startswith(prefix):
            return o
    raise KeyError(prefix)


def band(pts, axis, lo, hi):
    return [p for p in pts if lo <= p[axis] <= hi]


def centroid(pts):
    return sum(pts, Vector()) / max(len(pts), 1)


trachea = verts(find('Trachea'))
cricoid = verts(find('Cricoid cartilage'))
z_end = min(p.z for p in cricoid) + 0.004          # 喉返神经在环状软骨下缘附近入喉


def groove(side, z):
    """该高度上气管食管沟的位置：气管外侧缘往里一点、气管后壁高度（前方是 −y，后方是 +y）"""
    ring = band(trachea, 2, z - 0.004, z + 0.004)
    if not ring:
        ring = band(trachea, 2, z - 0.01, z + 0.01)
    xs = [p.x for p in ring]
    edge = max(xs) if side > 0 else min(xs)
    back = max(p.y for p in ring)
    return Vector((edge - side * 0.002, back - 0.001, z))


def catmull(pts, n_per=12):
    out = []
    P_ = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(P_) - 2):
        p0, p1, p2, p3 = P_[i - 1], P_[i], P_[i + 1], P_[i + 2]
        for k in range(n_per):
            t = k / n_per
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(pts[-1])
    return out


def rln_path(side):
    """side = +1 左（+x），−1 右。返回 (分叉点在迷走神经上的高度 z_b, 路径点列)"""
    vag = [p for p in verts(find('Vagus nerve (X).l' if side > 0 else 'Vagus nerve (X).r')) if p.x * side > 0]
    hook = verts(find('Aortic arch' if side > 0 else 'Right subclavian artery'))
    # 迷走神经跨过血管的那一处：先找迷走神经在血管顶面高度的位置 B0，再只取 B0 附近（前后 ±1.2 cm、左右 ±0.8 cm）的血管截面
    #（主动脉弓是从前往后走的一段弯管，只看 x 会把整段弓都算进来）
    ztop = max(p.z for p in hook)
    B0 = centroid(band(vag, 2, ztop - 0.004, ztop + 0.004))
    near = [p for p in hook if abs(p.x - B0.x) < 0.008 and abs(p.y - B0.y) < 0.012]
    if len(near) < 8:
        near = sorted(hook, key=lambda p: (p.x - B0.x) ** 2 + (p.y - B0.y) ** 2)[:40]
    zmin, zmax = min(p.z for p in near), max(p.z for p in near)
    ymax = max(p.y for p in near)
    zb = zmax - 0.002                                   # 在血管顶面高度从迷走神经分出
    B = centroid(band(vag, 2, zb - 0.003, zb + 0.003))
    pts = [
        B,
        Vector((B.x + side * 0.002, B.y - 0.002, (zmin + zmax) / 2)),        # 贴着血管外侧往下
        Vector((B.x - side * 0.002, B.y + 0.003, zmin - 0.004)),             # 从血管正下方钩过
        Vector((B.x - side * 0.007, ymax + 0.002, (zmin + zmax) / 2)),       # 绕到血管后内侧，开始往上
    ]
    z = zmax + 0.012
    while z < z_end - 0.006:
        pts.append(groove(side, z))
        z += 0.012
    g = groove(side, z_end)
    pts.append(g)
    pts.append(Vector((g.x - side * 0.003, g.y - 0.002, z_end + 0.006)))       # 入喉（环状软骨后方）
    if os.environ.get('RLN_DEBUG'):
        print('PATH', side, [tuple(round(c, 4) for c in p) for p in pts])
    return zb, catmull(pts)


# ---------- 材质 ----------
TIME = []


def tissue(name, color, sss=0.25, coat=0.35, rough=0.38, alpha=1.0, bump=0.12):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    set_input(b, 'Subsurface Weight', sss)
    set_input(b, 'Subsurface Radius', (1.0, 0.35, 0.2))
    set_input(b, 'Subsurface Scale', 0.002)
    set_input(b, 'Coat Weight', coat)
    set_input(b, 'Coat Roughness', 0.12)
    mot = noise(nt, 120.0, 5, 0.6)
    col = ramp(nt, mot.outputs['Fac'], [(0.3, tone(color, 0.75)), (0.55, color), (0.78, tone(color, 1.12))]).outputs['Color']
    nt.links.new(col, b.inputs['Base Color'])
    rn = noise(nt, 300.0, 3, 0.5)
    nt.links.new(math_node(nt, 'ADD', math_node(nt, 'MULTIPLY', rn.outputs['Fac'], 0.2), rough), b.inputs['Roughness'])
    nt.links.new(bump_node(nt, noise(nt, 900.0, 2, 0.5).outputs['Fac'], bump, 0.0002), b.inputs['Normal'])
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        try:
            m.surface_render_method = 'BLENDED'
        except AttributeError:
            pass
    return m, nt, b, col


def pulse_amount(nt, glow_base, trail, peak_k):
    """attribute dist（沿神经从迷走神经上端量起的长度，米）；脉冲位置 s = (t − pulseAt) × 速度；返回发光强度节点输出"""
    tnode = nt.nodes.new('ShaderNodeValue')
    TIME.append(tnode)
    attr = nt.nodes.new('ShaderNodeAttribute')
    attr.attribute_name = 'dist'
    s = math_node(nt, 'MULTIPLY', math_node(nt, 'SUBTRACT', tnode.outputs[0], P['pulseAt']), P['pulseSpeed'])
    d = math_node(nt, 'SUBTRACT', attr.outputs['Fac'], s)                       # < 0：脉冲已经走过
    w = 0.018                                                                   # 光团长度约 2 cm
    peak = math_node(nt, 'EXPONENT', math_node(nt, 'MULTIPLY', math_node(nt, 'MULTIPLY', d, d), -1.0 / (w * w)), 0.0)
    passed = math_node(nt, 'LESS_THAN', d, 0.0)
    return math_node(nt, 'ADD', math_node(nt, 'MULTIPLY', peak, peak_k * P['pulse']),
                     math_node(nt, 'ADD', glow_base, math_node(nt, 'MULTIPLY', passed, trail * P['trail'])))


def nerve_mat(name, color, glow_base, trail, peak_k):
    m, nt, b, col = tissue(name, color, sss=0.15, coat=0.5, rough=0.3)
    if P['pulse'] <= 0 and glow_base <= 0:
        return m
    amt = pulse_amount(nt, glow_base, trail, peak_k)
    nt.links.new(col, b.inputs['Emission Color'] if 'Emission Color' in b.inputs else b.inputs['Emission'])
    nt.links.new(amt, b.inputs['Emission Strength'])
    return m


def halo_mat(name, color):
    """光晕（示意，帮助看清 1.8 mm 粗的神经）：半透明发光外壳，亮度跟着脉冲"""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL':
            nt.nodes.remove(n)
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    amt = pulse_amount(nt, P['halo'] * 0.8, 2.0 * P['halo'], 40.0)
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = color
    nt.links.new(amt, em.inputs['Strength'])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    lw = nt.nodes.new('ShaderNodeLayerWeight')                                  # 边缘淡、中间实
    lw.inputs['Blend'].default_value = 0.5
    fac = math_node(nt, 'MULTIPLY', math_node(nt, 'SUBTRACT', 1.0, lw.outputs['Facing']), 0.55)
    mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(fac, mx.inputs['Fac'])
    nt.links.new(tr.outputs[0], mx.inputs[1])
    nt.links.new(em.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], out.inputs['Surface'])
    try:
        m.surface_render_method = 'BLENDED'
    except AttributeError:
        pass
    return m


NC = hex_rgb(P['nerveColor'])
MATS = {
    'nerve': nerve_mat('vagus', tone(NC, 0.85), 0.15, 0.0, 120.0),
    # 血管 / 心脏可调成半透明（示意，透过去看清被挡住的喉返神经）
    'artery': tissue('artery', hex_rgb('#a3302c'), alpha=P['vesselAlpha'])[0],
    'pulmonary': tissue('pulmonary', hex_rgb('#4a3f8f'), alpha=P['vesselAlpha'])[0],
    'vein': tissue('vein', hex_rgb('#34488f'), alpha=P['vesselAlpha'])[0],
    'heart': tissue('heart', hex_rgb('#7a1d1f'), alpha=min(1.0, P['vesselAlpha'] + 0.25))[0],
    'airway': tissue('airway', hex_rgb('#d7d9df'), sss=0.4, coat=0.3, rough=0.45)[0],
    'cartilage': tissue('cartilage', hex_rgb('#e3dccb'), sss=0.4, coat=0.3, rough=0.45)[0],
    'bone': tissue('bone', hex_rgb('#e6d9bf'), sss=0.2, coat=0.1, rough=0.6)[0],
    'oesophagus': tissue('oesophagus', hex_rgb('#c4807b'), sss=0.35, coat=0.45, rough=0.32)[0],
    'gland': tissue('gland', hex_rgb('#a8483f'), alpha=0.28)[0],
}

# 迷走神经上端（脉冲起点）
vag_all = [p for o in parts if o.get('kind') == 'nerve' for p in verts(o)]
z_top = max(p.z for p in vag_all)

for o in parts:
    k = o.get('kind', 'artery')
    if k == 'heart' and not P['heart']:
        o.hide_render = True
        continue
    o.data.materials.clear()
    o.data.materials.append(MATS[k])
    for poly in o.data.polygons:
        poly.use_smooth = True
    if k == 'nerve':
        a = o.data.attributes.new('dist', 'FLOAT', 'POINT')
        a.data.foreach_set('value', [z_top - p.z for p in verts(o)])
    if k == 'gland' or (k in ('artery', 'pulmonary', 'vein', 'heart') and P['vesselAlpha'] < 1):
        o.visible_shadow = False

# ---------- 喉返神经 ----------
R_NERVE = 0.0009     # 半径 0.9 mm（直径约 1.8 mm）
rln_mat = nerve_mat('rln', NC, 1.5, 4.0, 160.0)
halo = halo_mat('rln_halo', NC)
R_HALO = 0.0032    # 光晕半径 3.2 mm（示意）
for side, on in ((1, P['left']), (-1, P['right'])):
    if not on:
        continue
    zb, path = rln_path(side)
    cu = bpy.data.curves.new(f'rln_{side}', 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = R_NERVE
    cu.bevel_resolution = 4
    sp = cu.splines.new('POLY')
    sp.points.add(len(path) - 1)
    for i, p in enumerate(path):
        sp.points[i].co = (p.x, p.y, p.z, 1)
    ob = bpy.data.objects.new(f'rln_{side}', cu)
    shot.scene.collection.objects.link(ob)
    # 转成网格，写 dist：分叉点以上的迷走神经长度 + 沿路径的弧长
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.convert(target='MESH')
    ob = bpy.context.view_layer.objects.active
    arc = [0.0]
    for i in range(1, len(path)):
        arc.append(arc[-1] + (path[i] - path[i - 1]).length)
    kd = kdtree(path)
    base = z_top - zb
    a = ob.data.attributes.new('dist', 'FLOAT', 'POINT')
    a.data.foreach_set('value', [base + arc[kd.find(v.co)[1]] for v in ob.data.vertices])
    ob.data.materials.clear()
    ob.data.materials.append(rln_mat)
    for poly in ob.data.polygons:
        poly.use_smooth = True
    if P['halo'] > 0:
        hc = cu.copy()
        hc.bevel_depth = R_HALO
        ho = bpy.data.objects.new(f'rln_halo_{side}', hc)
        shot.scene.collection.objects.link(ho)
        bpy.ops.object.select_all(action='DESELECT')
        bpy.context.view_layer.objects.active = ho
        ho.select_set(True)
        bpy.ops.object.convert(target='MESH')
        ho = bpy.context.view_layer.objects.active
        ha = ho.data.attributes.new('dist', 'FLOAT', 'POINT')
        ha.data.foreach_set('value', [base + arc[kd.find(v.co)[1]] for v in ho.data.vertices])
        ho.data.materials.clear()
        ho.data.materials.append(halo)
        ho.visible_shadow = False
        for poly in ho.data.polygons:
            poly.use_smooth = True
    print(f'喉返神经（{"左" if side > 0 else "右"}）：长 {arc[-1] * 100:.1f} cm，分叉处离迷走神经上端 {base * 100:.1f} cm')

shot.world((0.004, 0.006, 0.012, 1))
shot.area_light('key', (-0.6, -0.9, 1.9), 60, (1.0, 0.93, 0.85), 0.5, target=(0, 0, 1.42))
shot.area_light('fill', (0.8, -0.6, 1.3), 12, (0.85, 0.9, 1.0), 0.6, target=(0, 0, 1.40))
shot.area_light('rim_a', (0.5, 0.8, 1.7), 90, (0.5, 0.7, 1.0), 0.4, target=(0, 0, 1.42))
shot.area_light('rim_b', (-0.7, 0.6, 1.3), 50, (0.6, 0.6, 1.0), 0.4, target=(0, 0, 1.38))
shot.camera(fstop=P['fstop'])
shot.render_settings(P['seed'])


def apply_frame(f, t):
    for n in TIME:
        n.outputs[0].default_value = t


shot.run(apply_frame)
