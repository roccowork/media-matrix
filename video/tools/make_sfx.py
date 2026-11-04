#!/usr/bin/env python3
"""按清单用 ElevenLabs Sound Effects 生成音效（《方案补充》#25 #30）。在 GitHub Actions 的 sfx.yml 里跑（密钥在 Secrets）。

用法：[ELEVENLABS_API_KEY=…] python3 tools/make_sfx.py public/sfx/<目录>/spec.json [--force]
清单格式：[{"file": "heartbeat.mp3", "prompt": "英文提示词", "duration": 2.0, "influence": 0.6}, …]
已经存在的文件默认跳过（不重复扣额度）；--force 重新生成。并发最多 4 个（账号上限 5，见踩坑记录）。
生成完把提示词写进同目录 README.md 的表格（来源记录）。
"""
import json
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

API = 'https://api.elevenlabs.io/v1/sound-generation'


def gen(item, out_dir, key):
    path = out_dir / item['file']
    body = json.dumps({'text': item['prompt'], 'duration_seconds': item['duration'], 'prompt_influence': item.get('influence', 0.6)}).encode()
    for attempt in range(3):
        try:
            h = {'Content-Type': 'application/json', 'Accept': 'audio/mpeg', **({'xi-api-key': key} if key else {})}
            req = urllib.request.Request(API, data=body, headers=h)
            with urllib.request.urlopen(req, timeout=120) as r:
                path.write_bytes(r.read())
            return f'✓ {item["file"]}（{item["duration"]} 秒）'
        except Exception as e:  # 429 并发超限等：重试
            err = e
    return f'✗ {item["file"]}：{err}'


def main():
    spec_path = Path(sys.argv[1])
    force = '--force' in sys.argv
    key = os.environ.get('ELEVENLABS_API_KEY')   # 没有时：云端会话的网络密钥会由代理自动加上 xi-api-key 请求头
    items = json.loads(spec_path.read_text())
    out_dir = spec_path.parent
    todo = [x for x in items if force or not (out_dir / x['file']).exists()]
    print(f'清单 {len(items)} 个，要生成 {len(todo)} 个')
    with ThreadPoolExecutor(max_workers=4) as ex:
        for line in ex.map(lambda x: gen(x, out_dir, key), todo):
            print(line)
    rows = ['| 文件 | 时长 | 用途 | 提示词 |', '|---|---|---|---|'] + [f'| {x["file"]} | {x["duration"]} s | {x.get("use", "")} | {x["prompt"]} |' for x in items]
    (out_dir / 'README.md').write_text(f'# 音效（ElevenLabs Sound Effects，`/v1/sound-generation`）\n\n清单：`spec.json`；生成：`tools/make_sfx.py`（Actions：sfx.yml）\n\n' + '\n'.join(rows) + '\n')
    if any(not (out_dir / x['file']).exists() for x in items):
        sys.exit(1)


if __name__ == '__main__':
    main()
