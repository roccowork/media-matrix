#!/usr/bin/env python3
"""在用户笔记本上一键出整片（《方案补充》#31）：Blender 镜头 + three.js 镜头 → 拼接 → 混音 → 质检 → 归档。

用法（video/ 目录，需要 Blender 4.2+、Node（npm ci 过）、Python 3、ffmpeg；Windows / Mac / Linux 都行）：
  python tools/render_film.py storyboards/2026-11-03-designed-body/storyboard.json
  选项：--blender <blender 路径>  --samples 96  --gl angle  --preview（半分辨率、少采样，先看一遍）
        --skip-blender（已经渲好的 Blender 帧不重渲；默认也会跳过帧数齐全的镜头）

步骤：
  1. 分镜里 renderer = blender 的镜头：逐镜把 config 写成临时 ShotConfig，调 blender/<场景>_scene.py 用显卡渲到
     public/blender/<分镜 id>/<镜号 NN>/frame_0000.png …（帧数齐全的镜头自动跳过，中断后可续跑）
  2. Remotion 渲整条 Storyboard 合成（props：分镜 + blenderDir），three.js 镜头现场渲、Blender 镜头读上一步的帧
  3. tools/mix_audio.py 按分镜混音（底噪 + 音效）→ 替换音轨
  4. tools/qc.py 质检 → tools/archive.py 归档（archives/<分镜 id>/，记得提交）
成片：out/film/<分镜 id>/final.mp4
"""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCENE = {  # 资产 id → Blender 场景脚本
    'biology.heart.v1': 'heart_scene.py', 'biology.skeleton.v1': 'skeleton_scene.py', 'biology.vessels.v1': 'vessels_scene.py',
    'biology.rln.v1': 'rln_scene.py', 'biology.throat.v1': 'throat_scene.py',
}


def run(cmd, **kw):
    print('›', ' '.join(str(c) for c in cmd), flush=True)
    subprocess.run([str(c) for c in cmd], check=True, cwd=ROOT, **kw)


def tool(name):
    p = shutil.which(name) or shutil.which(name + '.cmd')
    if not p:
        sys.exit(f'找不到 {name}，请先安装并加入 PATH')
    return p


def find_blender(given):
    """找 Blender：先看 PATH / 给定路径，再找 Windows / Mac 的常见安装位置（取版本号最大的）"""
    p = shutil.which(given)
    if p:
        return p
    if Path(given).exists():
        return given
    import glob
    cands = glob.glob(r'C:\Program Files\Blender Foundation\*\blender.exe') + glob.glob(r'D:\Program Files\Blender Foundation\*\blender.exe') \
        + glob.glob(str(Path.home() / 'AppData/Local/Programs/Blender Foundation/*/blender.exe')) + glob.glob('/Applications/Blender*.app/Contents/MacOS/Blender')
    if cands:
        print('找到 Blender：', sorted(cands)[-1])
        return sorted(cands)[-1]
    sys.exit('找不到 Blender：请用 --blender "blender.exe 的完整路径" 指定')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('storyboard')
    ap.add_argument('--blender', default='blender')
    ap.add_argument('--samples', type=int, default=96)
    ap.add_argument('--gl', default='angle')
    ap.add_argument('--preview', action='store_true')
    ap.add_argument('--skip-blender', action='store_true')
    a = ap.parse_args()

    sb_path = (ROOT / a.storyboard).resolve()
    sb = json.loads(sb_path.read_text(encoding='utf-8'))
    sid, fps = sb['id'], sb['fps']
    work = ROOT / 'out' / 'film' / sid
    work.mkdir(parents=True, exist_ok=True)
    blender_rel = f'blender/{sid}'
    scale = '0.5' if a.preview else '1'
    samples = str(32 if a.preview else a.samples)

    # 1. Blender 镜头
    blender = find_blender(a.blender)
    shots_b = [s for s in sb['shots'] if s['config']['renderer'] == 'blender']
    print(f'Blender 镜头 {len(shots_b)} 个：' + '、'.join(str(s['n']) for s in shots_b))
    for s in shots_b:
        cfg = s['config']
        n_frames = round(cfg['duration'] * fps)
        out = ROOT / 'public' / blender_rel / f"{s['n']:02d}"
        done = out.exists() and len(list(out.glob('frame_*.png'))) >= n_frames
        if done or a.skip_blender:
            print(f"  第 {s['n']} 镜：已有 {n_frames} 帧，跳过")
            continue
        scene = SCENE.get(cfg['assets'][0]['id'])
        if not scene:
            sys.exit(f"第 {s['n']} 镜的资产 {cfg['assets'][0]['id']} 没有对应的 Blender 场景脚本")
        cfg_file = work / f"shot_{s['n']:02d}.json"
        cfg_file.write_text(json.dumps(cfg, ensure_ascii=False), encoding='utf-8')
        run([blender, '-b', '-P', ROOT / 'blender' / scene, '--', '--config', cfg_file, '--out', out,
             '--device', 'GPU', '--samples', samples, '--scale', scale])

    # 2. Remotion 渲整条
    props = work / 'props.json'
    props.write_text(json.dumps({'storyboard': sb, 'annotate': False, 'blenderDir': blender_rel}, ensure_ascii=False), encoding='utf-8')
    video = work / 'video.mp4'
    cmd = [tool('npx'), 'remotion', 'render', 'src/index.ts', 'Storyboard', video, f'--props={props}', f'--gl={a.gl}', '--crf=18', '--timeout=600000']
    if a.preview:
        cmd.append('--scale=0.5')
    run(cmd)

    # 3. 混音 + 合成
    ffmpeg = tool('ffmpeg')
    audio = work / 'audio.wav'
    run([sys.executable, 'tools/mix_audio.py', sb_path, audio])
    final = work / 'final.mp4'
    run([ffmpeg, '-nostdin', '-v', 'error', '-y', '-i', video, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
         '-shortest', '-movflags', '+faststart', final])

    # 4. 质检 + 归档（质检有错误也照样归档，报告里写着）
    qc = subprocess.run([sys.executable, 'tools/qc.py', final, sb_path, work], cwd=ROOT)
    run([sys.executable, 'tools/archive.py', sb_path, '--video', final, '--qc', work / 'qc.json', '--gl', a.gl,
         '--note', '笔记本出片（tools/render_film.py）' + ('，预览版（半分辨率）' if a.preview else '')])
    print(f'\n✓ 成片：{final}\n  质检：{work / "qc.md"}（{"有错误" if qc.returncode else "通过"}）\n  归档：archives/{sid}/（记得 git add + commit + push）')


if __name__ == '__main__':
    main()
