#!/usr/bin/env python3
"""项目归档：把一条视频「怎么做出来的」全部记进 manifest.json，以后能原样复现（方案第十三节第 4 周；《方案补充》#26）。

用法：
  python3 tools/archive.py <storyboard.json> [--video 成片.mp4] [--qc qc.json] [--run-id N] [--run-url URL]
                           [--parts N] [--gl swangle] [--note 备注]
产物：archives/<分镜 id>/
  manifest.json   机器读：分镜快照哈希、git 提交、每镜资产（版本 / 许可 / 参数 / 种子）、音效清单（含哈希）、渲染记录、成片信息、质检结果、复现命令
  storyboard.json 分镜快照（原样复制）；script.md 文案（有的话）；qc.md 质检报告（有的话）
  README.md       中文摘要
成片文件本身不进仓库（太大），manifest 里记 sha256 / 时长 / 大小，用来核对拿到的文件是不是这一版。
"""
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent      # video/


def sha256(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def git(*args):
    r = subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else None


def registry():
    out = subprocess.run(['node', 'tools/shot.mjs', 'registry'], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def probe(video):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries',
                        'format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,bit_rate',
                        '-of', 'json', str(video)], capture_output=True, text=True, check=True)
    d = json.loads(r.stdout)
    v = next((s for s in d['streams'] if s['codec_type'] == 'video'), {})
    a = next((s for s in d['streams'] if s['codec_type'] == 'audio'), None)
    return {
        'file': Path(video).name, 'sha256': sha256(video), 'bytes': int(d['format']['size']),
        'duration': round(float(d['format']['duration']), 3),
        'video': {'codec': v.get('codec_name'), 'width': v.get('width'), 'height': v.get('height'), 'fps': v.get('r_frame_rate')},
        'audio': {'codec': a.get('codec_name'), 'sample_rate': a.get('sample_rate'), 'bit_rate': a.get('bit_rate')} if a else None,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('storyboard')
    ap.add_argument('--video')
    ap.add_argument('--qc')
    ap.add_argument('--run-id')
    ap.add_argument('--run-url')
    ap.add_argument('--parts', type=int)
    ap.add_argument('--gl')
    ap.add_argument('--note', default='')
    ap.add_argument('--commit', help='补登旧片时填当时渲染用的提交（默认当前 HEAD）')
    ap.add_argument('--out', help='默认 archives/<分镜 id>/')
    a = ap.parse_args()

    sb_path = Path(a.storyboard).resolve()
    sb = json.loads(sb_path.read_text())
    reg = registry()
    assets = reg['assets']
    out = Path(a.out) if a.out else ROOT / 'archives' / sb['id']
    out.mkdir(parents=True, exist_ok=True)
    fps = sb['fps']

    # 每镜：时间、转场、字卡、用到的资产（版本 / 参数 / 种子）
    shots, used, t, problems = [], {}, 0, []
    for s in sb['shots']:
        cfg = s['config']
        n = round(cfg['duration'] * fps)
        items = []
        for x in cfg.get('assets', []):
            meta = assets.get(x['id'])
            if not meta:
                problems.append(f'第 {s["n"]} 镜资产 {x["id"]} 不在登记表里')
                meta = {}
            seeds = {k: x.get('params', {}).get(k, p.get('default')) for k, p in meta.get('params', {}).items() if p['type'] == 'seed'}
            items.append({'id': x['id'], 'version': meta.get('version'), 'params': x.get('params', {}), 'seeds': seeds})
            u = used.setdefault(x['id'], {'name': meta.get('name'), 'version': meta.get('version'), 'renderer': meta.get('renderer'),
                                          'kind': meta.get('kind'), 'license': meta.get('license'), 'source': meta.get('source'), 'shots': []})
            if s['n'] not in u['shots']:
                u['shots'].append(s['n'])
        shots.append({'n': s['n'], 'start': round(t / fps, 3), 'end': round((t + n) / fps, 3), 'frames': n,
                      'config_id': cfg.get('id'), 'renderer': cfg.get('renderer'), 'camera': (cfg.get('camera') or {}).get('preset'),
                      'transition': s.get('transition'), 'onscreen': s.get('onscreen'), 'assets': items})
        t += n

    # 音效 / 底噪：路径 + 哈希（文件换了能发现）
    def sound(src):
        p = ROOT / 'public' / src
        return {'src': src, 'sha256': sha256(p) if p.exists() else None, **({} if p.exists() else {'missing': True})}
    audio = sb.get('audio') or {}
    amb = audio.get('ambient')
    sfx = [{**sound(x['src']), 'at': x['at'], 'volume': x.get('volume', 0.7), **({'note': x['note']} if x.get('note') else {})}
           for x in audio.get('sfx', [])]
    for x in sfx + ([sound(amb['src'])] if amb else []):
        if x.get('missing'):
            problems.append(f'音效文件不存在：public/{x["src"]}')

    commit = git('rev-parse', a.commit or 'HEAD')
    rel_sb = sb_path.relative_to(ROOT) if sb_path.is_relative_to(ROOT) else sb_path
    dirty = None if a.commit else git('status', '--porcelain', '--', 'src', 'tools', 'public', 'schemas', str(rel_sb))
    if a.commit and git('diff', '--quiet', commit, 'HEAD', '--', str(rel_sb)) is None:
        problems.append(f'分镜在 {commit[:7]} 之后改过，快照是当前版本，不是渲染时的版本')
    qc = json.loads(Path(a.qc).read_text()) if a.qc else None
    manifest = {
        'archive_version': 1,
        'id': sb['id'], 'title': sb.get('title'), 'topic': sb.get('topic'),
        'archived_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'note': a.note or None,
        'source': {'repo': 'roccowork/media-matrix', 'commit': commit, 'uncommitted_changes': bool(dirty),
                   'storyboard': str(rel_sb), 'storyboard_sha256': sha256(sb_path), 'engine_major': reg['engine_major'],
                   'storyboard_version': sb.get('version'), 'generator': sb.get('generator')},
        'timeline': {'fps': fps, 'frames': t, 'duration': round(t / fps, 3), 'shots': len(shots)},
        'shots': shots,
        'assets': dict(sorted(used.items())),
        'audio': {'mode': audio.get('mode'), 'ambient': {**sound(amb['src']), 'volume': amb.get('volume'), 'mute': amb.get('mute', [])} if amb else None,
                  'sfx': sfx, 'mixer': 'tools/mix_audio.py（ffmpeg）'},
        'render': {'workflow': 'GitHub Actions', 'run_id': a.run_id, 'run_url': a.run_url, 'parts': a.parts, 'gl': a.gl,
                   'composition': 'Storyboard（inputProps = 分镜）'},
        'output': probe(a.video) if a.video else None,
        'qc': {'errors': qc['errors'], 'warnings': qc['warnings'], 'items': [x for x in qc['items'] if x['level'] != '正常']} if qc else None,
        'publish': [],          # 发布后手动补：{"platform": "抖音", "date": "2026-11-03", "url": "...", "note": "抖音里另加配乐"}
        'reproduce': [
            f'git checkout {commit}',
            'cd video && npm ci',
            f'node tools/shot.mjs validate-storyboard {rel_sb}',
            f'GitHub Actions：produce.yml，storyboard = {rel_sb}（或 preview.yml 渲染 Storyboard 合成）',
            f'python3 tools/mix_audio.py {rel_sb} audio.wav',
            '核对：成片 sha256 应与 output.sha256 一致（渲染逐像素确定；编码器版本不同时比较 qc / 时长 / 帧数）',
        ],
        'problems': problems,
    }
    # 已有的 publish 记录保留（重新归档时不丢）
    old = out / 'manifest.json'
    if old.exists():
        try:
            manifest['publish'] = json.loads(old.read_text()).get('publish', [])
        except json.JSONDecodeError:
            pass
    (out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n')
    shutil.copyfile(sb_path, out / 'storyboard.json')
    if (sb_path.parent / 'script.md').exists():
        shutil.copyfile(sb_path.parent / 'script.md', out / 'script.md')
    if a.qc and (Path(a.qc).parent / 'qc.md').exists():
        shutil.copyfile(Path(a.qc).parent / 'qc.md', out / 'qc.md')

    o = manifest['output']
    lines = [f'# 归档：{sb.get("title", sb["id"])}', '',
             f'- 分镜：`{rel_sb}`（sha256 `{manifest["source"]["storyboard_sha256"][:12]}`），{len(shots)} 镜 {t / fps:.2f} 秒 @ {fps}fps',
             f'- 代码：media-matrix `{(commit or "?")[:7]}`' + ('（归档时有未提交改动！）' if dirty else ''),
             f'- 资产 {len(used)} 个：' + '、'.join(f'{k}@{v["version"]}' for k, v in sorted(used.items())),
             f'- 音效 {len(sfx)} 个' + (f' + 底噪 {amb["src"]}' if amb else ''),
             f'- 渲染：' + (f'[run {a.run_id}]({a.run_url})' if a.run_id else '未记录') + (f'，{a.parts} 台机器' if a.parts else ''),
             f'- 成片：' + (f'{o["file"]}，{o["duration"]} 秒，{o["bytes"] / 1e6:.1f} MB，sha256 `{o["sha256"][:12]}`' if o else '未记录'),
             f'- 质检：' + (f'错误 {qc["errors"]} · 提醒 {qc["warnings"]}（见 qc.md）' if qc else '未记录')]
    if problems:
        lines += ['', '## 归档时发现的问题'] + [f'- {p}' for p in problems]
    lines += ['', '## 复现', ''] + [f'{k + 1}. {c}' for k, c in enumerate(manifest['reproduce'])]
    (out / 'README.md').write_text('\n'.join(lines) + '\n')
    print(f'✓ 归档 → {out.relative_to(ROOT) if out.is_relative_to(ROOT) else out}' + (f'（{len(problems)} 个问题）' if problems else ''))
    for p in problems:
        print('  ✗', p)
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
