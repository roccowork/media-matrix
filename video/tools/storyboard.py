#!/usr/bin/env python3
# AI 分镜生成器（方案第十三节第 3 周：脚本和分镜生成、资产匹配；《方案补充》#15）
#   选题 → ① 旁白稿（分句 + 待核验事实）→ ② 分镜（每镜从资产目录选资产、填参数、写相机，输出完整 ShotConfig）
#   → ③ 校验（node tools/shot.mjs validate-storyboard）→ 不通过就把错误交回模型修，最多 2 轮 → 写出
# AI 只输出结构化 JSON（方案第十五节第 4 条），不写代码；所有内容经校验才落盘。
#
# 用法（video/ 目录下）：
#   OPENROUTER_API_KEY=... python3 tools/storyboard.py --topic "心脏怎样把血液送遍全身" [--id 2026-11-05-heart] [--model anthropic/claude-sonnet-5.5]
# 产物：storyboards/<id>/storyboard.json（分镜）+ script.md（给人审的旁白稿和待核验事实）
# 之后：node tools/shot.mjs storyboard-preview storyboards/<id>/storyboard.json   出预览总览图
import argparse
import datetime
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL = os.environ.get('STORYBOARD_MODEL', 'anthropic/claude-sonnet-5.5')
API = 'https://openrouter.ai/api/v1/chat/completions'
MAX_REPAIR = 2


def chat(messages, model, max_tokens=16000):
    key = os.environ.get('OPENROUTER_API_KEY')
    if not key:
        sys.exit('缺少环境变量 OPENROUTER_API_KEY（GitHub Actions 里放在仓库 Secrets）')
    body = json.dumps({'model': model, 'messages': messages, 'max_tokens': max_tokens, 'temperature': 0.4}).encode()
    req = urllib.request.Request(API, body, {'Authorization': f'Bearer {key}', 'Content-Type': 'application/json',
                                            'X-Title': 'media-matrix storyboard'})
    with urllib.request.urlopen(req, timeout=600) as r:
        data = json.load(r)
    return data['choices'][0]['message']['content'], data.get('model', model)


def extract_json(text):
    # 模型偶尔会包一层 ```json；取第一个 { 到最后一个 }
    m = re.search(r'\{.*\}', text, re.S)
    if not m:
        raise ValueError('模型没有返回 JSON')
    return json.loads(m.group(0))


def node(*args):
    p = subprocess.run(['node', os.path.join(ROOT, 'tools/shot.mjs'), *args], cwd=ROOT, capture_output=True, text=True)
    return p.returncode, (p.stdout + p.stderr).strip()


def load(path):
    return json.load(open(os.path.join(ROOT, path), encoding='utf-8'))


SYSTEM = """你是 AI 科普视频的编剧兼分镜师，服务于一个程序化视频引擎。
硬性规则：
1. 只输出一个 JSON 对象，不要任何解释文字。
2. 科学内容必须准确；每个事实性说法都要列进 facts，写清依据（教科书 / 指南 / 论文），status 一律写「待核验」。不确定的不要写。
3. 真实的东西按真实比例（尺寸、数量、速度）；资产参数默认就是真实值。为了看清楚而改成非真实值（如调稀、慢放、示意速度）时，这一镜必须写 note，含「示意」或「慢放」字样。
4. 中文旁白口语化、短句；每镜旁白不超过 4.5 字每秒（按汉字和数字计）。
5. 视频总长 60–90 秒，每镜 3–8 秒，共 10–20 镜；节奏：每 2–3 秒一个视觉变化，开场 3 秒内抓人。"""


def step_script(topic, model):
    prompt = f"""选题：{topic}
先写旁白稿，输出 JSON：
{{"title": "视频标题（吸引人、准确）", "slug": "英文短名，小写字母数字和连字符，如 heart-circulation",
 "facts": [{{"claim": "...", "basis": "...", "status": "待核验"}}],
 "beats": [{{"narration": "这一镜的旁白", "seconds": 3到8的整数, "visual_idea": "想要的画面"}}]}}
beats 总秒数 60–90，10–20 个。"""
    text, used = chat([{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': prompt}], model, 6000)
    return extract_json(text), used


def step_storyboard(topic, script, sb_id, catalog, example, model):
    shot_schema = load('schemas/shot.schema.json')
    prompt = f"""根据旁白稿写分镜。每个 beat 一镜（可以合并或拆分，但总长仍 60–90 秒、每镜 3–8 秒）。
每镜输出一个完整 ShotConfig（必须符合下面的 ShotConfig Schema），只能用资产目录里的资产：
- renderer 必须等于所用资产的 renderer；Blender 资产（renderer=blender）一镜只能放一个，post 只能用 {catalog['blender_post']}
- no_dof=true 的资产所在镜头不能写 post.dof
- 参数只能用目录里列出的参数，数值在 min–max 内；超出 real_range 的必须在该镜 note 里写「示意」/「慢放」
- 相机：参考每个资产的 example_shot（坐标系、距离、fov 已经调好），按这一镜内容改机位和运动；keys 的 t 从 0 递增，最后一个 t 等于 duration；同一资产在不同镜头里机位要有变化
- 种子：所有 seed 参数写成 "{sb_id}-s<镜号>"（每个视频用自己的种子）
- config.id 用所用资产的 id；config.version 写 "1.0.0"；config.fps 写 30
输出 JSON：{{"shots": [{{"n": 1, "narration": "...", "visual": "画面说明", "note": "（仅在需要时）", "config": {{ShotConfig}}}}]}}

选题：{topic}
旁白稿：{json.dumps(script, ensure_ascii=False)}

ShotConfig Schema：{json.dumps(shot_schema, ensure_ascii=False)}

资产目录（engine_major={catalog['engine_major']}）：{json.dumps(catalog['assets'], ensure_ascii=False)}

参考分镜（人工手写示例的前 3 镜，看格式和写法）：{json.dumps(example['shots'][:3], ensure_ascii=False)}"""
    text, used = chat([{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': prompt}], model)
    return extract_json(text)['shots'], used


def repair(sb, errors, catalog, model):
    prompt = f"""下面的分镜没通过校验，请逐条修正后输出完整的分镜 JSON（同样格式：{{"shots": [...]}}，只改有问题的地方，旁白和事实不要乱改）。
校验错误：
{errors}

当前分镜：{json.dumps({'shots': sb['shots']}, ensure_ascii=False)}

资产目录（参数范围在这里查）：{json.dumps(catalog['assets'], ensure_ascii=False)}"""
    text, _ = chat([{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': prompt}], model)
    return extract_json(text)['shots']


def write_script_md(sb, path):
    lines = [f"# {sb['title']}", '', f"选题：{sb['topic']}　｜　{len(sb['shots'])} 镜　｜　{sum(s['config']['duration'] for s in sb['shots'])} 秒　｜　生成：{sb['generator'].get('model', '')}", '',
             '## 旁白稿' if sb.get('audio', {}).get('mode') != 'music' else f"## 画面文字稿（配乐：{sb['audio'].get('music', '待定')}）", '', '| 镜 | 秒 | 旁白 | 画面 | 资产 | 说明 |', '|---|---|---|---|---|---|']
    music = sb.get('audio', {}).get('mode') == 'music'
    if music:
        lines[lines.index('| 镜 | 秒 | 旁白 | 画面 | 资产 | 说明 |')] = '| 镜 | 秒 | 画面文字（无配音，《方案补充》#17） | 画面 | 资产 | 说明 |'
    for s in sb['shots']:
        o = s.get('onscreen', {})
        words = ' / '.join(x for x in (o.get('year'), o.get('text'), f"〔{o['tag']}〕" if o.get('tag') else None) if x) if music else s.get('narration', '')
        lines.append(f"| {s['n']} | {s['config']['duration']} | {words} | {s['visual']} | {', '.join(a['id'] for a in s['config']['assets'])} | {s.get('note', '')} |")
    lines += ['', '## 待核验事实（制作前请逐条核对）', '']
    for f in sb['facts']:
        lines.append(f"- [ ] {f['claim']} —— 依据：{f['basis']}")
    open(path, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--topic', required=True)
    ap.add_argument('--id', default='')
    ap.add_argument('--model', default=MODEL)
    args = ap.parse_args()

    tmp = tempfile.mkdtemp()
    cat_path = os.path.join(tmp, 'catalog.json')
    code, out = node('catalog', cat_path)
    if code:
        sys.exit(out)
    catalog = json.load(open(cat_path, encoding='utf-8'))
    example = load('storyboards/2026-11-03-heart-circulation/storyboard.json')

    print('① 写旁白稿…', flush=True)
    script, used = step_script(args.topic, args.model)
    today = datetime.date.today().isoformat()
    sb_id = args.id or f"{today}-{re.sub(r'[^a-z0-9-]', '', script.get('slug', 'video').lower())[:40] or 'video'}"
    print(f'   《{script["title"]}》{len(script["beats"])} 段，{sum(b["seconds"] for b in script["beats"])} 秒；id = {sb_id}', flush=True)

    print('② 写分镜（选资产、填参数、写相机）…', flush=True)
    shots, used = step_storyboard(args.topic, script, sb_id, catalog, example, args.model)
    sb = {'id': sb_id, 'topic': args.topic, 'title': script['title'], 'fps': 30,
          'generator': {'by': 'ai', 'model': used, 'date': today, 'repair_rounds': 0},
          'facts': script['facts'], 'shots': shots, 'version': '1.0.0'}

    out_dir = os.path.join(ROOT, 'storyboards', sb_id)
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, 'storyboard.json')
    for rnd in range(MAX_REPAIR + 1):
        json.dump(sb, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        code, msg = node('validate-storyboard', path)
        print(('③ 校验' if rnd == 0 else f'   第 {rnd} 轮修正后校验') + '：' + msg.splitlines()[0], flush=True)
        if code == 0:
            break
        if rnd == MAX_REPAIR:
            print(msg)
            sys.exit(f'✗ 修了 {MAX_REPAIR} 轮仍未通过校验，分镜留在 {path} 供人工查看')
        print('   交回模型修正…', flush=True)
        sb['shots'] = repair(sb, msg, catalog, args.model)
        sb['generator']['repair_rounds'] = rnd + 1
    write_script_md(sb, os.path.join(out_dir, 'script.md'))
    print(f'✓ 分镜：{path}\n✓ 审稿用：{os.path.join(out_dir, "script.md")}')
    gh = os.environ.get('GITHUB_OUTPUT')
    if gh:
        open(gh, 'a').write(f'id={sb_id}\n')


if __name__ == '__main__':
    main()
