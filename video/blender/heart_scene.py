# Blender 最小自动化示例（方案第七节 / 第十三节第 2 周）：
#   读 ShotConfig（JSON，与 Three.js 镜头同一套 Schema，renderer = "blender"）
#   → Python 自动建场景：导入心脏模型（Z-Anatomy，CC BY-SA 4.0）、按部件名指定程序化材质、三点布光 + 轮廓光、相机
#   → 逐帧设置心跳和相机位姿 → Cycles 渲染 PNG 图片序列
#   → Remotion 的 Blender-Heart 合成读取这些 PNG（src/shots/heart/BlenderHeart.tsx）。
# 确定性：没有任何随机数（心跳、相机都是时间的函数），Cycles 固定 seed、不开动画种子；同一台机器同样参数重渲结果一致。
#
# 用法（在 video/ 目录下）：
#   blender -b -P blender/heart_scene.py -- --config shotconfigs/biology.heart.v1.json --out public/blender/biology.heart.v1 [选项]
#   python blender/heart_scene.py --config ... --out ...          # 用 pip 装的 bpy（云端会话里出单帧检查用）
# 选项：
#   --frames 0-299 | 0,150,290   渲染哪些帧（默认整段）
#   --scale 0.5                  分辨率倍数（1 = 1920×1080）
#   --samples 128                Cycles 采样数（开降噪，64–128 够用）
#   --device GPU|CPU             GPU 自动选 OPTIX / CUDA / HIP / METAL / ONEAPI 中能用的
import argparse
import hashlib
import json
import math
import os
import sys

import bpy
from mathutils import Euler, Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.dirname(HERE)

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('--config', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--frames', default='')
ap.add_argument('--scale', type=float, default=1.0)
ap.add_argument('--samples', type=int, default=128)
ap.add_argument('--device', default='GPU')
ap.add_argument('--determinism', type=int, default=-1, help='同一帧渲两次、逐像素比对（不写正式输出）')
args = ap.parse_args(argv)

cfg = json.load(open(args.config, encoding='utf-8'))
assert cfg['renderer'] == 'blender', 'ShotConfig 的 renderer 必须是 blender'
asset = next(a for a in cfg['assets'] if a['id'] == 'biology.heart.v1')
P = {
    'bpm': 72, 'beat': 1.0, 'spin': 0.0,
    'myocardium': '#74181b', 'artery': '#963431', 'vein': '#3b4683', 'valve': '#e6c3ae',
    'fstop': 2.8, 'seed': 'heart', 'fat': 1.0, 'fatReach': 0.05,
    **asset.get('params', {}),
}
fps = cfg['fps']
n_frames = int(round(cfg['duration'] * fps))


def hex_rgb(h):
    h = h.lstrip('#')
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, 1.0)


def three_to_blender(v):
    # three.js：y 朝上、镜头默认看 -z；Blender：z 朝上
    return Vector((v[0], -v[2], v[1]))


# ---------- 场景 ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=os.path.join(VIDEO, 'public/assets/models/anatomy/heart.glb'))
parts = [o for o in scene.objects if o.type == 'MESH']

# 部件 → 材质类别（教科书配色：含氧血红、缺氧血蓝）
def part_kind(name):
    n = name.lower()
    if 'leaflet' in n:
        return 'valve'
    if 'vein' in n or 'sinus' in n or 'vena cava' in n:
        return 'pulmonary_vein' if 'pulmonary' in n else 'vein'
    if 'pulmonary' in n:
        return 'pulmonary_artery'
    if 'artery' in n or 'aort' in n or 'trunk' in n or 'branches' in n:
        return 'artery'
    return 'myocardium'


def _set(b, key, val):
    if key in b.inputs:
        b.inputs[key].default_value = val


def _noise(nt, scale, detail=6.0, rough=0.55, coord='Object', stretch=(1, 1, 1)):
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = stretch
    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = scale
    nz.inputs['Detail'].default_value = detail
    nz.inputs['Roughness'].default_value = rough
    nt.links.new(tc.outputs[coord], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], nz.inputs['Vector'])
    return nz


def _ramp(nt, fac_socket, stops):
    r = nt.nodes.new('ShaderNodeValToRGB')
    els = r.color_ramp.elements
    els[0].position, els[0].color = stops[0]
    els[1].position, els[1].color = stops[-1]
    for pos, col in stops[1:-1]:
        e = els.new(pos)
        e.color = col
    nt.links.new(fac_socket, r.inputs['Fac'])
    return r


def _mix(nt, a, b, fac):
    m = nt.nodes.new('ShaderNodeMix')
    m.data_type = 'RGBA'
    nt.links.new(fac, m.inputs[0])
    for sock, v in ((m.inputs[6], a), (m.inputs[7], b)):
        if isinstance(v, tuple):
            sock.default_value = v
        else:
            nt.links.new(v, sock)
    return m.outputs[2]


def _math(nt, op, a, b):
    m = nt.nodes.new('ShaderNodeMath')
    m.operation = op
    for sock, v in ((m.inputs[0], a), (m.inputs[1], b)):
        if isinstance(v, (int, float)):
            sock.default_value = v
        else:
            nt.links.new(v, sock)
    return m.outputs[0]


def shade_tone(c, k):
    return (c[0] * k, c[1] * k, c[2] * k, 1.0)


def make_tissue(name, color, kind):
    # 湿润生物组织：颜色斑驳（不均匀）、次表面透光、粗糙度有变化、清漆层带细碎凹凸（高光一闪一闪，不是一层亮漆）
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    _set(b, 'Subsurface Weight', 0.4 if kind == 'muscle' else 0.3)
    _set(b, 'Subsurface Radius', (1.0, 0.3, 0.18))
    _set(b, 'Subsurface Scale', 0.06)
    _set(b, 'Coat Weight', 0.7 if kind == 'muscle' else 0.45)
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
}
for o in parts:
    o.data.materials.clear()
    o.data.materials.append(MATS[part_kind(o.name)])
    for poly in o.data.polygons:
        poly.use_smooth = True


def bake_fat():
    # 每个心肌顶点到最近冠状血管（动脉 + 心静脉）的距离 → 顶点属性 fat（0–1）。确定性：纯几何计算
    from mathutils.kdtree import KDTree
    vessels = [o for o in parts if part_kind(o.name) in ('artery', 'vein') and ('coronary' in o.name.lower() or 'cardiac' in o.name.lower()
               or 'interventricular' in o.name.lower() or 'circumflex' in o.name.lower() or 'sinus' in o.name.lower()
               or 'inferolateral' in o.name.lower() or 'septal' in o.name.lower() or 'ventricle' in o.name.lower())]
    pts = [o.matrix_world @ v.co for o in vessels for v in o.data.vertices]
    kd = KDTree(len(pts))
    for i, p in enumerate(pts):
        kd.insert(p, i)
    kd.balance()
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


bake_fat()

# 所有部件挂到一个空物体下：心跳 / 自转都作用在它上面（冠状血管贴着心肌，一起动）
pivot = bpy.data.objects.new('heart_pivot', None)
scene.collection.objects.link(pivot)
for o in parts:
    o.parent = pivot

# 世界：深色，带一点冷色环境光
world = bpy.data.worlds.new('world')
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.004, 0.006, 0.012, 1)
bg.inputs['Strength'].default_value = 1.0


def area_light(name, loc, energy, color, size):
    d = bpy.data.lights.new(name, 'AREA')
    d.energy = energy
    d.color = color
    d.size = size
    o = bpy.data.objects.new(name, d)
    scene.collection.objects.link(o)
    o.location = loc
    direction = Vector((0, 0, 0)) - Vector(loc)
    o.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    return o


# 主光（左上前，暖）、补光（右前，弱）、两盏轮廓光（后方，冷蓝 + 洋红）把心脏从暗背景里勾出来
area_light('key', (-2.2, -2.4, 2.4), 260, (1.0, 0.92, 0.85), 1.6)
area_light('fill', (2.6, -2.0, 0.4), 60, (0.85, 0.9, 1.0), 2.0)
area_light('rim_a', (1.8, 2.6, 1.6), 320, (0.45, 0.65, 1.0), 1.2)
area_light('rim_b', (-2.2, 2.2, -0.8), 200, (1.0, 0.45, 0.6), 1.2)

cam_data = bpy.data.cameras.new('cam')
cam = bpy.data.objects.new('cam', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
cam_data.sensor_fit = 'VERTICAL'
cam_data.dof.use_dof = True
cam_data.dof.aperture_fstop = P['fstop']

# ---------- 渲染设置 ----------
scene.render.engine = 'CYCLES'
scene.cycles.samples = args.samples
scene.cycles.use_denoising = True
scene.cycles.seed = int(hashlib.md5(str(P['seed']).encode()).hexdigest()[:6], 16)
scene.cycles.use_animated_seed = False
scene.render.resolution_x = int(1920 * args.scale)
scene.render.resolution_y = int(1080 * args.scale)
scene.render.resolution_percentage = 100
scene.render.fps = fps
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
# PNG 里尽量不写日期等元数据（Cycles 仍会写渲染耗时，所以确定性检查比对的是像素，不是文件字节）
for attr in dir(scene.render):
    if attr.startswith('use_stamp'):
        setattr(scene.render, attr, False)
try:
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
except TypeError:
    scene.view_settings.view_transform = 'Filmic'

if args.device.upper() == 'GPU':
    prefs = bpy.context.preferences.addons['cycles'].preferences
    picked = None
    for kind in ('OPTIX', 'CUDA', 'HIP', 'METAL', 'ONEAPI'):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            if any(d.type == kind for d in prefs.devices):
                picked = kind
                break
        except TypeError:
            continue
    if picked:
        for d in prefs.devices:
            d.use = d.type == picked
        scene.cycles.device = 'GPU'
        print('Cycles 使用 GPU：', picked)
    else:
        print('没找到可用 GPU，改用 CPU')
        scene.cycles.device = 'CPU'
else:
    scene.cycles.device = 'CPU'


# ---------- 每帧：心跳 + 相机 ----------
def smoother(t):
    return t * t * t * (t * (t * 6 - 15) + 10)


def pose_at(t):
    # 与 src/engine/camera/rigs.ts 的 poseAt 完全相同
    k = cfg['camera']['keys']
    if t <= k[0]['t']:
        a = b = k[0]; u = 0.0
    else:
        i = 0
        while i < len(k) - 2 and t > k[i + 1]['t']:
            i += 1
        a, b = k[i], k[i + 1]
        u0 = min(1.0, max(0.0, (t - a['t']) / (b['t'] - a['t'])))
        u = u0 if cfg['camera'].get('ease') == 'linear' else smoother(u0)
    lerp = lambda x, y: x + (y - x) * u
    return (
        [lerp(a['pos'][j], b['pos'][j]) for j in range(3)],
        [lerp(a['look'][j], b['look'][j]) for j in range(3)],
        lerp(a.get('fov', 40), b.get('fov', 40)),
        lerp(a.get('roll', 0), b.get('roll', 0)),
    )


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


def apply_frame(f):
    t = f / fps
    s, sz, twist = heartbeat(t)
    pivot.scale = (s, s, sz)
    pivot.rotation_euler = Euler((0, 0, twist + P['spin'] * t))
    pos, look, fov, roll = pose_at(t)
    p = three_to_blender(pos)
    l = three_to_blender(look)
    cam.location = p
    q = (l - p).to_track_quat('-Z', 'Y')
    cam.rotation_euler = (q.to_matrix().to_4x4() @ Matrix.Rotation(math.radians(roll), 4, 'Z')).to_euler()
    cam_data.angle = math.radians(fov)
    cam_data.dof.focus_distance = (l - p).length


def parse_frames(s):
    if not s:
        return list(range(n_frames))
    if '-' in s and ',' not in s:
        a, b = s.split('-')
        return list(range(int(a), int(b) + 1))
    return [int(x) for x in s.split(',')]


def render_to(f, path):
    scene.frame_set(f)
    apply_frame(f)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


if args.determinism >= 0:
    import tempfile
    tmp = tempfile.mkdtemp()
    px = []
    for k in range(2):
        p = os.path.join(tmp, f'det{k}.png')
        render_to(args.determinism, p)
        img = bpy.data.images.load(p)
        px.append(list(img.pixels))
    same = px[0] == px[1]
    print(('✓ 确定性：第 %d 帧两次渲染逐像素一致' if same else '✗ 第 %d 帧两次渲染像素不同') % args.determinism)
    sys.exit(0 if same else 1)

os.makedirs(args.out, exist_ok=True)
for f in parse_frames(args.frames):
    scene.frame_set(f)
    apply_frame(f)
    scene.render.filepath = os.path.join(os.path.abspath(args.out), f'frame_{f:04d}.png')
    bpy.ops.render.render(write_still=True)
    print('渲染完成', scene.render.filepath)
