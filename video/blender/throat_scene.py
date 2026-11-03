# Blender 资产 biology.throat.v1：咽喉正中矢状剖面——吃饭和呼吸走同一个路口（Z-Anatomy，CC BY-SA 4.0；真实尺寸，与骨架同一原点）。
# 读 ShotConfig → 导入 throat.glb（kind：bone / tooth / cartilage / epiglottis / mucosa / tongue / palate / airway / oesophagus / gland）
# → 正中矢状切开：材质按物体空间 x 把切面一侧（x > cut）变透明，切口里看到的内壁用较深的「剖面色」
# → 两条路线（起点 / 拐点都从模型里量）：
#     空气（蓝白，流动的光纹）：鼻腔 → 鼻咽 → 口咽 → 喉口 → 气管
#     食物（琥珀色光团 + 余光）：口腔（舌背上方）→ 口咽 → 喉咽 → 食管
#   两条路线在口咽交叉——「吃饭和呼吸走同一条路」
# → 布光 → 逐帧（路线动画 + 相机）→ Cycles 渲染 PNG 序列 → Remotion 合成 Blender-Throat。
# 用法同其他场景（video/ 目录下）：
#   blender -b -P blender/throat_scene.py -- --config shotconfigs/biology.throat.v1.json --out public/blender/biology.throat.v1 [选项]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402
from common import Shot, bump_node, hex_rgb, kdtree, math_node, noise, ramp, set_input, tone  # noqa: E402

shot = Shot('biology.throat.v1', {
    'cut': 0.0, 'air': 1.0, 'airAt': 0.5, 'airSpeed': 0.12, 'food': 1.0, 'foodAt': 1.5, 'foodSpeed': 0.07,
    'airColor': '#8fd8ff', 'foodColor': '#ffb347', 'fstop': 5.6, 'seed': 'throat',
})
P = shot.P
parts = shot.import_glb('public/assets/models/anatomy/throat.glb')


def verts(o):
    mw = o.matrix_world
    return [mw @ v.co for v in o.data.vertices]


def find(name):
    return next(o for o in parts if o.name.startswith(name))


def centroid(pts):
    return sum(pts, Vector()) / max(len(pts), 1)


def band(pts, lo, hi, axis=2):
    return [p for p in pts if lo <= p[axis] <= hi]


def mid(pts, w=0.006):
    """只取靠近正中面的点（|x| < w）"""
    m = [p for p in pts if abs(p.x) < w]
    return m or pts


def catmull(pts, n_per=10):
    out = []
    P_ = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(P_) - 2):
        p0, p1, p2, p3 = P_[i - 1], P_[i], P_[i + 1], P_[i + 2]
        for k in range(n_per):
            t = k / n_per
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(pts[-1])
    return out


# ---------- 从模型量出两条路线（前方 = −y，后方 = +y，上方 = +z） ----------
nasal = verts(find('Mucosa of nasal cavity'))
naso = verts(find('Nasopharynx'))
oro = verts(find('Oropharynx'))
laryngo = verts(find('Laryngopharynx'))
tongue = verts(find('Tongue'))
trachea = verts(find('Trachea'))
oeso = verts(find('Oesophagus'))
epi = verts(find('Epiglottis'))


def lumen(pts, z, h=0.004):
    """某高度上管腔中心（正中面附近的点在这一高度的平均）"""
    b = band(mid(pts, 0.012), z - h, z + h)
    return centroid(b) if b else None


def zr(pts):
    return min(p.z for p in pts), max(p.z for p in pts)


# 空气：鼻孔附近（鼻腔前下部）→ 鼻腔中部 → 鼻咽 → 口咽 → 喉口（会厌后方偏前）→ 气管上段 → 气管中段
nz0, nz1 = zr(nasal)
nasal_mid = mid(nasal, 0.01)
front_y = min(p.y for p in nasal_mid)
nose_in = centroid([p for p in nasal_mid if p.y < front_y + 0.012 and p.z < nz0 + (nz1 - nz0) * 0.45]) + Vector((0, -0.01, 0))
nasal_c = centroid([p for p in nasal_mid if p.z < nz0 + (nz1 - nz0) * 0.5])
air = [nose_in, nasal_c]
for src in (naso, oro):
    z0, z1 = zr(src)
    for f in (0.75, 0.35):
        c = lumen(src, z0 + (z1 - z0) * f)
        if c:
            air.append(c)
ez0, ez1 = zr(epi)
lar_in = centroid(band(mid(epi, 0.01), ez0, ez0 + (ez1 - ez0) * 0.4)) + Vector((0, 0.008, 0))   # 喉口：会厌根部后方
tz0, tz1 = zr(trachea)
air += [lar_in, lumen(trachea, tz1 - 0.01) or centroid(trachea), lumen(trachea, tz1 - 0.05) or centroid(trachea)]
air = [p.copy() for p in air if p is not None]
for p in air:
    p.x = P['cut'] - 0.002                                   # 画在切面上（略靠里一点）

# 食物：门牙后方、舌背上方 → 沿舌背往后 → 口咽（靠后壁）→ 喉咽 → 食管上段 → 食管
tm = mid(tongue, 0.01)
ty0, ty1 = min(p.y for p in tm), max(p.y for p in tm)
dorsum = []
for f in (0.08, 0.35, 0.6, 0.85):
    y = ty0 + (ty1 - ty0) * f
    sl = [p for p in tm if abs(p.y - y) < 0.004]
    if sl:
        top = max(sl, key=lambda p: p.z)
        dorsum.append(Vector((0, top.y, top.z + 0.006)))
food = dorsum[:]
oz0, oz1 = zr(oro)
for f in (0.6, 0.25):
    c = lumen(oro, oz0 + (oz1 - oz0) * f)
    if c:
        food.append(c + Vector((0, 0.006, 0)))                 # 靠后壁走
lz0, lz1 = zr(laryngo)
for f in (0.6, 0.2):
    c = lumen(laryngo, lz0 + (lz1 - lz0) * f)
    if c:
        food.append(c + Vector((0, 0.006, 0)))
_, ez1o = zr(oeso)
food += [lumen(oeso, ez1o - 0.01) or centroid(oeso), lumen(oeso, ez1o - 0.05) or centroid(oeso)]
food = [p.copy() for p in food if p is not None]
for p in food:
    p.x = P['cut'] - 0.002
if os.environ.get('THROAT_DEBUG'):
    print('AIR', [tuple(round(c, 4) for c in p) for p in air])
    print('FOOD', [tuple(round(c, 4) for c in p) for p in food])

# ---------- 材质 ----------
CUT = P['cut']


def tissue(name, color, cap, sss=0.25, coat=0.35, rough=0.4, bumpk=0.1):
    """组织材质 + 矢状切开：x > cut 的部分透明；从切口看到的内壁（背面）用剖面色 cap"""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    set_input(b, 'Subsurface Weight', sss)
    set_input(b, 'Subsurface Radius', (1.0, 0.35, 0.2))
    set_input(b, 'Subsurface Scale', 0.002)
    set_input(b, 'Coat Weight', coat)
    set_input(b, 'Coat Roughness', 0.15)
    mot = noise(nt, 150.0, 5, 0.6)
    col = ramp(nt, mot.outputs['Fac'], [(0.3, tone(color, 0.78)), (0.55, color), (0.78, tone(color, 1.1))]).outputs['Color']
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    mixc = nt.nodes.new('ShaderNodeMixRGB')
    nt.links.new(geo.outputs['Backfacing'], mixc.inputs['Fac'])
    nt.links.new(col, mixc.inputs['Color1'])
    mixc.inputs['Color2'].default_value = cap
    nt.links.new(mixc.outputs['Color'], b.inputs['Base Color'])
    rn = noise(nt, 400.0, 3, 0.5)
    nt.links.new(math_node(nt, 'ADD', math_node(nt, 'MULTIPLY', rn.outputs['Fac'], 0.2), rough), b.inputs['Roughness'])
    nt.links.new(bump_node(nt, noise(nt, 1200.0, 2, 0.5).outputs['Fac'], bumpk, 0.0002), b.inputs['Normal'])
    # 切开：物体空间 x（场景里物体变换是单位阵，等于世界 x）
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(geo.outputs['Position'], sep.inputs[0])
    keep = math_node(nt, 'LESS_THAN', sep.outputs['X'], CUT)
    nt.links.new(keep, b.inputs['Alpha'])
    return m


def glow_path(name, color, mode):
    """mode = 'air'：一串向前流动的光纹；'food'：一个光团 + 走过的余光"""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL':
            nt.nodes.remove(n)
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    tnode = nt.nodes.new('ShaderNodeValue')
    TIME.append(tnode)
    attr = nt.nodes.new('ShaderNodeAttribute')
    attr.attribute_name = 'dist'
    if mode == 'air':
        s = math_node(nt, 'MULTIPLY', math_node(nt, 'SUBTRACT', tnode.outputs[0], P['airAt']), P['airSpeed'])
        on = math_node(nt, 'LESS_THAN', attr.outputs['Fac'], s)                           # 气流前锋已经到达的部分
        ph = math_node(nt, 'FRACT', math_node(nt, 'DIVIDE', math_node(nt, 'SUBTRACT', attr.outputs['Fac'], s), 0.02), 0.0)
        stripe = math_node(nt, 'POWER', math_node(nt, 'SUBTRACT', 1.0, ph), 6.0)
        amt = math_node(nt, 'MULTIPLY', on, math_node(nt, 'ADD', math_node(nt, 'MULTIPLY', stripe, 16.0), 1.5))
        amt = math_node(nt, 'MULTIPLY', amt, P['air'])
    else:
        s = math_node(nt, 'MULTIPLY', math_node(nt, 'SUBTRACT', tnode.outputs[0], P['foodAt']), P['foodSpeed'])
        d = math_node(nt, 'SUBTRACT', attr.outputs['Fac'], s)
        w = 0.012
        peak = math_node(nt, 'EXPONENT', math_node(nt, 'MULTIPLY', math_node(nt, 'MULTIPLY', d, d), -1.0 / (w * w)), 0.0)
        passed = math_node(nt, 'LESS_THAN', d, 0.0)
        amt = math_node(nt, 'MULTIPLY', math_node(nt, 'ADD', math_node(nt, 'MULTIPLY', peak, 60.0), math_node(nt, 'MULTIPLY', passed, 2.5)), P['food'])
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = color
    nt.links.new(amt, em.inputs['Strength'])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    vis = math_node(nt, 'GREATER_THAN', amt, 0.05)
    mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(vis, mx.inputs['Fac'])
    nt.links.new(tr.outputs[0], mx.inputs[1])
    nt.links.new(em.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], out.inputs['Surface'])
    return m


TIME = []
CAP_SOFT = (0.55, 0.16, 0.14, 1)   # 软组织剖面：深粉红
CAP_BONE = (0.78, 0.7, 0.55, 1)    # 骨剖面：骨松质的米黄
MATS = {
    'bone': tissue('bone', hex_rgb('#e6dac2'), CAP_BONE, sss=0.15, coat=0.1, rough=0.6),
    'tooth': tissue('tooth', hex_rgb('#f2ece0'), CAP_BONE, sss=0.2, coat=0.6, rough=0.2),
    'cartilage': tissue('cartilage', hex_rgb('#d9dccf'), (0.75, 0.75, 0.7, 1), sss=0.45),
    'epiglottis': tissue('epiglottis', hex_rgb('#d9cdbf'), (0.75, 0.7, 0.65, 1), sss=0.45),
    'mucosa': tissue('mucosa', hex_rgb('#c86a6a'), CAP_SOFT, sss=0.4, coat=0.55, rough=0.3),
    'tongue': tissue('tongue', hex_rgb('#c25560'), CAP_SOFT, sss=0.45, coat=0.5, rough=0.32),
    'palate': tissue('palate', hex_rgb('#c86870'), CAP_SOFT, sss=0.4, coat=0.5, rough=0.3),
    'airway': tissue('airway', hex_rgb('#d7d0cc'), (0.7, 0.62, 0.6, 1), sss=0.4),
    'oesophagus': tissue('oesophagus', hex_rgb('#c27a76'), CAP_SOFT, sss=0.4, coat=0.5, rough=0.3),
    'gland': tissue('gland', hex_rgb('#a8483f'), CAP_SOFT),
}
# 颅底里布满气房的薄骨（筛骨、蝶骨）剖开后全是空洞，画面杂乱、和这一镜无关，不渲染
HIDE = ('Ethmoid bone', 'Anterior cells of ethmoid', 'Middle cells of ethmoid', 'Posterior cells of ethmoid', 'Sphenoid bone', 'Sinus of sphenoid')
for o in parts:
    if o.name.startswith(HIDE):
        o.hide_render = True
for o in parts:
    k = o.get('kind', 'bone')
    o.data.materials.clear()
    o.data.materials.append(MATS[k])
    for poly in o.data.polygons:
        poly.use_smooth = True

# 路线管子：转成网格，写 dist（沿路线的弧长）
R_PATH = 0.0026


def path_obj(name, pts, mat):
    pts = catmull(pts)
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = R_PATH
    cu.bevel_resolution = 3
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (p.x, p.y, p.z, 1)
    ob = bpy.data.objects.new(name, cu)
    shot.scene.collection.objects.link(ob)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.convert(target='MESH')
    ob = bpy.context.view_layer.objects.active
    arc = [0.0]
    for i in range(1, len(pts)):
        arc.append(arc[-1] + (pts[i] - pts[i - 1]).length)
    kd = kdtree(pts)
    a = ob.data.attributes.new('dist', 'FLOAT', 'POINT')
    a.data.foreach_set('value', [arc[kd.find(v.co)[1]] for v in ob.data.vertices])
    ob.data.materials.append(mat)
    ob.visible_shadow = False
    print(f'{name}：长 {arc[-1] * 100:.1f} cm')
    return ob


if P['air'] > 0:
    path_obj('air', air, glow_path('air_glow', hex_rgb(P['airColor']), 'air'))
if P['food'] > 0:
    path_obj('food', food, glow_path('food_glow', hex_rgb(P['foodColor']), 'food'))

shot.world((0.004, 0.006, 0.012, 1))
c = centroid(oro)
shot.area_light('key', (0.9, -0.7, c.z + 0.6), 70, (1.0, 0.93, 0.85), 0.5, target=c)
shot.area_light('fill', (0.8, 0.6, c.z - 0.1), 18, (0.85, 0.9, 1.0), 0.6, target=c)
shot.area_light('rim', (-0.3, 0.8, c.z + 0.4), 60, (0.5, 0.7, 1.0), 0.4, target=c)
shot.camera(fstop=P['fstop'])
shot.render_settings(P['seed'])


def apply_frame(f, t):
    for n in TIME:
        n.outputs[0].default_value = t


shot.run(apply_frame)
