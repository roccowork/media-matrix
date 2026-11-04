# Blender 场景脚本的公共部分（心脏、骨架、血管网等共用）：
#   命令行参数、读 ShotConfig、颜色换算、坐标换算（three.js y 朝上 → Blender z 朝上）、
#   相机插值（与 src/engine/camera/rigs.ts 的 poseAt 完全相同）、世界 / 灯光 / 相机、Cycles 渲染设置、
#   材质节点小工具、逐帧渲染 + 逐像素确定性检查。
# 各资产的场景脚本：先 shot = Shot('资产 id', 默认参数)，建好物体和材质，最后 shot.run(每帧回调)。
import argparse
import hashlib
import json
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

VIDEO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def hex_rgb(h):
    h = h.lstrip('#')
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, 1.0)


def three_to_blender(v):
    # three.js：y 朝上、镜头默认看 -z；Blender：z 朝上
    return Vector((v[0], -v[2], v[1]))


def smoother(t):
    return t * t * t * (t * (t * 6 - 15) + 10)


class Shot:
    def __init__(self, asset_id, defaults):
        argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
        ap = argparse.ArgumentParser()
        ap.add_argument('--config', required=True)
        ap.add_argument('--out', required=True)
        ap.add_argument('--frames', default='', help='0-299 或 0,150,290；默认整段')
        ap.add_argument('--scale', type=float, default=1.0, help='分辨率倍数（1 = 1920×1080）')
        ap.add_argument('--samples', type=int, default=128, help='Cycles 采样数（开降噪）')
        ap.add_argument('--device', default='GPU', help='GPU 自动选 OPTIX / CUDA / HIP / METAL / ONEAPI；或 CPU')
        ap.add_argument('--backend', default='auto', help='GPU 后端：auto（按 OPTIX → CUDA → HIP → METAL → ONEAPI 找）或指定一个，如 CUDA（OptiX 内核编译失败时用）')
        ap.add_argument('--determinism', type=int, default=-1, help='同一帧渲两次、逐像素比对（不写正式输出）')
        self.args = ap.parse_args(argv)
        self.cfg = json.load(open(self.args.config, encoding='utf-8'))
        assert self.cfg['renderer'] == 'blender', 'ShotConfig 的 renderer 必须是 blender'
        asset = next(a for a in self.cfg['assets'] if a['id'] == asset_id)
        self.P = {**defaults, **asset.get('params', {})}
        self.fps = self.cfg['fps']
        self.n_frames = int(round(self.cfg['duration'] * self.fps))
        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.scene = bpy.context.scene

    # ---------- 场景 ----------
    def import_glb(self, rel_path):
        bpy.ops.import_scene.gltf(filepath=os.path.join(VIDEO, rel_path))
        return [o for o in self.scene.objects if o.type == 'MESH']

    def world(self, color=(0.004, 0.006, 0.012, 1), strength=1.0):
        w = bpy.data.worlds.new('world')
        self.scene.world = w
        w.use_nodes = True
        bg = w.node_tree.nodes['Background']
        bg.inputs['Color'].default_value = color
        bg.inputs['Strength'].default_value = strength
        return w

    def area_light(self, name, loc, energy, color, size, target=(0, 0, 0)):
        d = bpy.data.lights.new(name, 'AREA')
        d.energy = energy
        d.color = color
        d.size = size
        o = bpy.data.objects.new(name, d)
        self.scene.collection.objects.link(o)
        o.location = loc
        o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        return o

    def camera(self, fstop=None):
        self.cam_data = bpy.data.cameras.new('cam')
        self.cam = bpy.data.objects.new('cam', self.cam_data)
        self.scene.collection.objects.link(self.cam)
        self.scene.camera = self.cam
        self.cam_data.sensor_fit = 'VERTICAL'
        if fstop:
            self.cam_data.dof.use_dof = True
            self.cam_data.dof.aperture_fstop = fstop
        return self.cam

    # ---------- 渲染设置 ----------
    def render_settings(self, seed):
        s = self.scene
        a = self.args
        s.render.engine = 'CYCLES'
        s.cycles.samples = a.samples
        s.cycles.use_denoising = True
        s.cycles.seed = int(hashlib.md5(str(seed).encode()).hexdigest()[:6], 16)
        s.cycles.use_animated_seed = False
        s.render.resolution_x = int(1920 * a.scale)
        s.render.resolution_y = int(1080 * a.scale)
        s.render.resolution_percentage = 100
        s.render.fps = self.fps
        s.render.image_settings.file_format = 'PNG'
        s.render.film_transparent = False
        # PNG 里尽量不写日期等元数据（Cycles 仍会写渲染耗时，所以确定性检查比对的是像素，不是文件字节）
        for attr in dir(s.render):
            if attr.startswith('use_stamp'):
                setattr(s.render, attr, False)
        try:
            s.view_settings.view_transform = 'AgX'
            s.view_settings.look = 'AgX - Medium High Contrast'
        except TypeError:
            s.view_settings.view_transform = 'Filmic'
        if a.device.upper() == 'GPU':
            prefs = bpy.context.preferences.addons['cycles'].preferences
            picked = None
            kinds = ('OPTIX', 'CUDA', 'HIP', 'METAL', 'ONEAPI') if a.backend == 'auto' else (a.backend.upper(),)
            for kind in kinds:
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
                s.cycles.device = 'GPU'
                print('Cycles 使用 GPU：', picked)
            else:
                print('没找到可用 GPU，改用 CPU')
                s.cycles.device = 'CPU'
        else:
            s.cycles.device = 'CPU'

    # ---------- 相机 ----------
    def pose_at(self, t):
        # 与 src/engine/camera/rigs.ts 的 poseAt 完全相同
        k = self.cfg['camera']['keys']
        if t <= k[0]['t']:
            a = b = k[0]
            u = 0.0
        else:
            i = 0
            while i < len(k) - 2 and t > k[i + 1]['t']:
                i += 1
            a, b = k[i], k[i + 1]
            u0 = min(1.0, max(0.0, (t - a['t']) / (b['t'] - a['t'])))
            u = u0 if self.cfg['camera'].get('ease') == 'linear' else smoother(u0)
        lerp = lambda x, y: x + (y - x) * u
        return (
            [lerp(a['pos'][j], b['pos'][j]) for j in range(3)],
            [lerp(a['look'][j], b['look'][j]) for j in range(3)],
            lerp(a.get('fov', 40), b.get('fov', 40)),
            lerp(a.get('roll', 0), b.get('roll', 0)),
        )

    def apply_camera(self, t):
        pos, look, fov, roll = self.pose_at(t)
        p = three_to_blender(pos)
        l = three_to_blender(look)
        self.cam.location = p
        q = (l - p).to_track_quat('-Z', 'Y')
        self.cam.rotation_euler = (q.to_matrix().to_4x4() @ Matrix.Rotation(math.radians(roll), 4, 'Z')).to_euler()
        self.cam_data.angle = math.radians(fov)
        if self.cam_data.dof.use_dof:
            self.cam_data.dof.focus_distance = (l - p).length

    # ---------- 渲染 ----------
    def frames(self):
        s = self.args.frames
        if not s:
            return list(range(self.n_frames))
        if '-' in s and ',' not in s:
            a, b = s.split('-')
            return list(range(int(a), int(b) + 1))
        return [int(x) for x in s.split(',')]

    def run(self, apply_frame):
        """apply_frame(f, t)：设置第 f 帧（t 秒）的动画；相机由这里统一设置"""
        def render_to(f, path):
            self.scene.frame_set(f)
            apply_frame(f, f / self.fps)
            self.apply_camera(f / self.fps)
            self.scene.render.filepath = path
            bpy.ops.render.render(write_still=True)

        if self.args.determinism >= 0:
            import tempfile
            tmp = tempfile.mkdtemp()
            px = []
            for k in range(2):
                p = os.path.join(tmp, f'det{k}.png')
                render_to(self.args.determinism, p)
                px.append(list(bpy.data.images.load(p).pixels))
            same = px[0] == px[1]
            print(('✓ 确定性：第 %d 帧两次渲染逐像素一致' if same else '✗ 第 %d 帧两次渲染像素不同') % self.args.determinism)
            sys.exit(0 if same else 1)
        os.makedirs(self.args.out, exist_ok=True)
        for f in self.frames():
            path = os.path.join(os.path.abspath(self.args.out), f'frame_{f:04d}.png')
            render_to(f, path)
            print('渲染完成', path)


# ---------- 材质节点小工具 ----------
def set_input(b, key, val):
    if key in b.inputs:
        b.inputs[key].default_value = val


def noise(nt, scale, detail=6.0, rough=0.55, coord='Object', stretch=(1, 1, 1)):
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


def ramp(nt, fac_socket, stops):
    r = nt.nodes.new('ShaderNodeValToRGB')
    els = r.color_ramp.elements
    els[0].position, els[0].color = stops[0]
    els[1].position, els[1].color = stops[-1]
    for pos, col in stops[1:-1]:
        e = els.new(pos)
        e.color = col
    nt.links.new(fac_socket, r.inputs['Fac'])
    return r


def mix(nt, a, b, fac):
    m = nt.nodes.new('ShaderNodeMix')
    m.data_type = 'RGBA'
    nt.links.new(fac, m.inputs[0])
    for sock, v in ((m.inputs[6], a), (m.inputs[7], b)):
        if isinstance(v, tuple):
            sock.default_value = v
        else:
            nt.links.new(v, sock)
    return m.outputs[2]


def math_node(nt, op, a, b):
    m = nt.nodes.new('ShaderNodeMath')
    m.operation = op
    for sock, v in ((m.inputs[0], a), (m.inputs[1], b)):
        if isinstance(v, (int, float)):
            sock.default_value = v
        else:
            nt.links.new(v, sock)
    return m.outputs[0]


def tone(c, k):
    return (c[0] * k, c[1] * k, c[2] * k, 1.0)


def bump_node(nt, height_socket, strength, distance, normal_socket=None):
    b = nt.nodes.new('ShaderNodeBump')
    b.inputs['Strength'].default_value = strength
    b.inputs['Distance'].default_value = distance
    nt.links.new(height_socket, b.inputs['Height'])
    if normal_socket is not None:
        nt.links.new(normal_socket, b.inputs['Normal'])
    return b.outputs['Normal']


def kdtree(points):
    from mathutils.kdtree import KDTree
    kd = KDTree(len(points))
    for i, p in enumerate(points):
        kd.insert(p, i)
    kd.balance()
    return kd
