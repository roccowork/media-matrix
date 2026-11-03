#!/usr/bin/env python3
"""成片自动质量检查（方案第十三节第 4 周「QC」；《方案补充》#26）。

用法：python3 tools/qc.py <成片.mp4> <storyboard.json> [输出目录]
产物：<输出目录>/qc.json（机器读）+ qc.md（中文报告，发 Telegram 用）；有「错误」级问题时退出码 1。

检查项（错误 = 必须修；提醒 = 人看一眼）：
  1. 时长：视频流帧数 = 分镜总帧数（误差超过 2 帧 → 错误）；容器时长差 0.3 秒以上 → 提醒（音轨长短不对）
  2. 黑帧：ffmpeg blackdetect；分镜里有意的黑（开场从黑亮起、eyelid 转场切黑、底噪静音段）标「正常」，其余 → 提醒
  3. 冻帧：ffmpeg freezedetect，画面静止超过 1.5 秒 → 提醒（手册原则 11：任何镜头静止不超过 1.5 秒）
  4. 字卡超框：按 Storyboard.tsx 的字号规则估算一行宽度，超出安全区（左右各留 120px）→ 错误；字多导致字号 < 36px → 提醒
  5. 字卡可读性 / 压主体：取每镜结尾（字卡已淡出）那一帧，量字卡区域的平均亮度和细节量，太亮 → 提醒（白字看不清），细节太多 → 提醒（可能压住主体）
  6. 音频：整体响度（LUFS）、真峰值（dBTP）；峰值 > 0 dBTP → 错误（爆音）、> -1 dBTP → 提醒，响度 < -30 LUFS → 提醒（太低，#25 要求音效不要太低）；
     无声超过 2 秒（有意静音段除外）→ 提醒
依赖：ffmpeg / ffprobe、Pillow、numpy。
"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

W, H, SAFE_X = 1920, 1080, 120


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def probe_duration(video):
    out = run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video]).stdout.strip()
    return float(out)


def probe_frames(video):
    """视频流实际帧数（比容器时长准：容器时长会受音轨长短影响）"""
    out = run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', video]).stdout.strip()
    return int(out.split(',')[0])


def has_audio(video):
    return bool(run(['ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', video]).stdout.strip())


def shot_times(sb):
    fps = sb['fps']
    t, out = 0, []
    for s in sb['shots']:
        n = round(s['config']['duration'] * fps)
        out.append((s, t / fps, (t + n) / fps))
        t += n
    return out, t / fps


def intentional_dark(sb, times):
    """分镜里有意的黑 / 静音区间：开场 1.5 秒、eyelid 转场结尾前后、底噪静音段"""
    zones = [(0.0, 1.5, '开场从黑场亮起')]
    for s, a, b in times:
        if (s.get('transition') or {}).get('type') == 'eyelid':
            zones.append((b - 1.2, b + 0.8, f'第 {s["n"]} 镜 eyelid 转场切黑'))
    amb = (sb.get('audio') or {}).get('ambient') or {}
    for a, b in amb.get('mute', []):
        zones.append((a - 1.0, b + 1.0, '底噪静音段（有意熄灭 / 静默）'))
    return zones


def in_zone(a, b, zones):
    for za, zb, why in zones:
        if a >= za - 0.05 and b <= zb + 0.05:
            return why
    return None


def detect(video, vf, pat):
    err = run(['ffmpeg', '-nostdin', '-v', 'info', '-i', video, '-vf', vf, '-an', '-f', 'null', '-']).stderr
    return re.findall(pat, err)


# ---------- 字卡 ----------
def char_em(c):
    return 0.55 if ord(c) < 0x2E80 else 1.0      # 西文 / 数字约半个汉字宽


def card_box(card):
    """与 Storyboard.tsx TextCard 一致的字号；返回 (宽, 高, 上边 y, 字号)"""
    text = card.get('text', '') or ''
    year = card.get('year', '') or ''
    big = card.get('style') == 'title'
    total = len(text) + (len(year) * 1.0 + 1 if year else 0)
    size = min(96, int(1500 / max(total, 1) / 1.15)) if big else min(56, int(1500 / max(total, 1) / 1.1))
    spacing = 0.14 if big else 0.06
    w = sum(char_em(c) for c in text) * size + len(text) * spacing * size
    if year:
        ys = size * 1.25
        w += sum(char_em(c) for c in year) * ys + len(year) * 0.1 * ys + 0.5 * size
    h = (size * 1.25 if year else size) * 1.3
    pos = card.get('position') or ('center' if big else 'bottom')
    top = 64 if pos == 'top' else (H - 56 - h if pos == 'bottom' else (H - h) / 2)
    return w, h, top, size


def region_stats(png, x0, y0, x1, y1):
    import numpy as np
    from PIL import Image
    im = np.asarray(Image.open(png).convert('L'), dtype=np.float32)
    r = im[int(max(0, y0)):int(min(H, y1)), int(max(0, x0)):int(min(W, x1))]
    if r.size == 0:
        return 0.0, 0.0
    gx = np.abs(np.diff(r, axis=1)).mean() if r.shape[1] > 1 else 0
    gy = np.abs(np.diff(r, axis=0)).mean() if r.shape[0] > 1 else 0
    return float(r.mean()), float(gx + gy)


def main(video, sb_path, out_dir=None):
    sb = json.loads(Path(sb_path).read_text())
    out = Path(out_dir or Path(video).parent)
    out.mkdir(parents=True, exist_ok=True)
    fps = sb['fps']
    times, total = shot_times(sb)
    zones = intentional_dark(sb, times)
    items = []   # {level: 错误/提醒/正常, what, detail, shot?}

    def add(level, what, detail, shot=None):
        items.append({'level': level, 'what': what, 'detail': detail, **({'shot': shot} if shot else {})})

    def shot_at(t):
        for s, a, b in times:
            if a <= t < b:
                return s['n']
        return times[-1][0]['n']

    # 1 时长
    dur = probe_duration(video)
    frames, want = probe_frames(video), round(total * fps)
    if abs(frames - want) > 2:
        add('错误', '时长不对', f'成片 {frames} 帧（{frames / fps:.2f} 秒），分镜应为 {want} 帧（{total:.2f} 秒）')
    else:
        add('正常', '时长', f'{frames} 帧 / {frames / fps:.2f} 秒，与分镜一致')
    if abs(dur - total) > 0.3:
        add('提醒', '音画长度不一', f'容器时长 {dur:.2f} 秒，与分镜 {total:.2f} 秒差 {abs(dur - total):.2f} 秒（多半是音轨长短不对）')

    # 2 黑帧
    blacks = []
    for a, b, _d in detect(video, 'blackdetect=d=0.25:pix_th=0.06', r'black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)'):
        a, b = float(a), float(b)
        blacks.append((a, b))
        why = in_zone(a, b, zones)
        if why:
            add('正常', '黑场（有意）', f'{a:.2f}–{b:.2f} 秒：{why}', shot_at(a))
        else:
            add('提醒', '黑帧', f'{a:.2f}–{b:.2f} 秒画面全黑（{b - a:.2f} 秒），分镜里没有安排', shot_at(a))

    # 3 冻帧
    starts = [float(x) for x in detect(video, 'freezedetect=n=0.0015:d=1.5', r'freeze_start: ([\d.]+)')]
    ends = [float(x) for x in detect(video, 'freezedetect=n=0.0015:d=1.5', r'freeze_end: ([\d.]+)')]
    for k, a in enumerate(starts):
        b = ends[k] if k < len(ends) else dur
        if any(a >= ba - 0.1 and b <= bb + 0.1 for ba, bb in blacks):
            continue          # 全黑当然不动，已在黑帧里报过
        why = in_zone(a, b, zones)
        if why:
            add('正常', '静止（有意）', f'{a:.2f}–{b:.2f} 秒：{why}', shot_at(a))
        else:
            add('提醒', '画面静止', f'{a:.2f}–{b:.2f} 秒画面几乎不动（{b - a:.2f} 秒，手册要求 ≤ 1.5 秒）', shot_at(a))

    # 4 / 5 字卡
    tmp = Path(tempfile.mkdtemp())
    for s, a, b in times:
        card = s.get('onscreen')
        if not card or not (card.get('text') or card.get('year')):
            continue
        w, h, top, size = card_box(card)
        if w > W - 2 * SAFE_X:
            add('错误', '字卡超框', f'「{card.get("year", "")} {card.get("text", "")}」约 {w:.0f}px 宽（{size}px 字），超出安全区 {W - 2 * SAFE_X}px', s['n'])
        if size < 36:
            add('提醒', '字太小', f'字卡字数多，字号被缩到 {size}px（< 36，手机上难读），考虑删字', s['n'])
        x0, x1 = (W - w) / 2, (W + w) / 2
        png = tmp / f'{s["n"]:02d}.png'
        t = max(a, b - 0.05)          # 结尾：字卡已淡出，看的是字卡下面的画面
        run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-ss', f'{t:.3f}', '-i', video, '-frames:v', '1', str(png)])
        if not png.exists():
            continue
        lum, detail = region_stats(png, x0 - 20, top - 10, x1 + 20, top + h + 10)
        if lum > 125:
            add('提醒', '字卡底色太亮', f'字卡区域平均亮度 {lum:.0f}/255，白字可能看不清（考虑换位置 position 或加暗角）', s['n'])
        if detail > 22:
            add('提醒', '字卡可能压住主体', f'字卡区域细节量 {detail:.1f}（>22），下面可能是画面主体（考虑 position 换到空的地方）', s['n'])

    # 6 音频
    if not has_audio(video):
        add('提醒', '没有音轨', '成片没有音频（配乐在抖音里加时可忽略；有音效的分镜应当有音轨）')
    else:
        err = run(['ffmpeg', '-nostdin', '-v', 'info', '-i', video, '-af', 'ebur128=peak=true', '-f', 'null', '-']).stderr
        m_i = re.findall(r'I:\s+(-?[\d.]+) LUFS', err)
        m_p = re.findall(r'Peak:\s+(-?[\d.]+) dBFS', err)
        lufs = float(m_i[-1]) if m_i else None
        peak = float(m_p[-1]) if m_p else None
        if peak is not None and peak > 0:
            add('错误', '爆音', f'真峰值 {peak:.1f} dBTP（> 0），播放时会削波')
        elif peak is not None and peak > -1:
            add('提醒', '峰值偏高', f'真峰值 {peak:.1f} dBTP（> -1），平台转码后可能削波')
        if lufs is not None and lufs < -30:
            add('提醒', '音量偏低', f'整体响度 {lufs:.1f} LUFS（< -30）；#25 要求音效不要太低')
        add('正常', '音量', f'整体响度 {lufs} LUFS，真峰值 {peak} dBTP')
        sil = run(['ffmpeg', '-nostdin', '-v', 'info', '-i', video, '-af', 'silencedetect=noise=-50dB:d=2', '-vn', '-f', 'null', '-']).stderr
        for a, b in zip(re.findall(r'silence_start: ([\d.]+)', sil), re.findall(r'silence_end: ([\d.]+)', sil)):
            a, b = float(a), float(b)
            why = in_zone(a, b, zones)
            if why:
                add('正常', '静音（有意）', f'{a:.2f}–{b:.2f} 秒：{why}', shot_at(a))
            else:
                add('提醒', '长时间无声', f'{a:.2f}–{b:.2f} 秒没有声音（{b - a:.1f} 秒）', shot_at(a))

    errors = [x for x in items if x['level'] == '错误']
    warns = [x for x in items if x['level'] == '提醒']
    report = {'video': str(video), 'storyboard': sb.get('id'), 'duration': dur, 'expected': total,
              'errors': len(errors), 'warnings': len(warns), 'items': items}
    (out / 'qc.json').write_text(json.dumps(report, ensure_ascii=False, indent=1))
    lines = [f'质检《{sb.get("title", sb.get("id"))}》：{"❌" if errors else "✅"} 错误 {len(errors)} · 提醒 {len(warns)}']
    for x in errors + warns:
        lines.append(f'{"❌" if x["level"] == "错误" else "⚠️"} {"第 " + str(x["shot"]) + " 镜 · " if x.get("shot") else ""}{x["what"]}：{x["detail"]}')
    ok = [x for x in items if x['level'] == '正常']
    if ok:
        lines.append('正常：' + '；'.join(f'{x["what"]} {x["detail"]}' for x in ok[:6]))
    (out / 'qc.md').write_text('\n'.join(lines) + '\n')
    print('\n'.join(lines))
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None))
