#!/usr/bin/env python3
"""按分镜 storyboard.json 的 audio 字段，用 ffmpeg 把底噪 + 音效混成整段音频（与 Storyboard.tsx 的 StoryboardAudio 逻辑一致）。

为什么不用 Remotion 渲音频：分多台机器渲染时各段音频拼接会断音；而 Remotion 只渲音频也要逐帧跑 three.js，
既慢又要 WebGL。音频只取决于 storyboard.json，直接按同一套规则混。

用法：python3 tools/mix_audio.py storyboards/<id>/storyboard.json out/audio.wav
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main(sb_path: str, out: str) -> None:
    sb = json.loads(Path(sb_path).read_text())
    fps = sb['fps']
    total = sum(round(s['config']['duration'] * fps) for s in sb['shots']) / fps
    audio = sb.get('audio') or {}
    inputs: list[str] = []
    chains: list[str] = []
    labels: list[str] = []

    amb = audio.get('ambient')
    if amb:
        inputs += ['-stream_loop', '-1', '-i', str(ROOT / 'public' / amb['src'])]
        v = amb.get('volume', 0.4)
        # 首尾各 2 秒淡入淡出；静音区间 [a, b]：a 之前 0.8 秒淡出，b 之后 1.2 秒淡回（同 Storyboard.tsx）
        expr = f"{v}*min(1,min(t/2,({total}-t)/2))"
        for a, b in amb.get('mute', []):
            expr += f"*if(lt(t,{a}),min(1,({a}-t)/0.8),if(gt(t,{b}),min(1,(t-{b})/1.2),0))"
        chains.append(f"[0:a]atrim=0:{total},asetpts=N/SR/TB,volume='max(0,{expr})':eval=frame[amb]")
        labels.append('[amb]')

    for k, x in enumerate(audio.get('sfx', [])):
        idx = inputs.count('-i')
        inputs += ['-i', str(ROOT / 'public' / x['src'])]
        ms = int(round(x['at'] * 1000))
        chains.append(f"[{idx}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume={x.get('volume', 0.7)},adelay={ms}|{ms}[s{k}]")
        labels.append(f'[s{k}]')

    if not labels:
        sys.exit('分镜里没有 audio.ambient / audio.sfx')
    # normalize=0：各轨按原音量叠加（amix 默认会按轨数压低音量）
    # 4 倍过采样后限幅再降回 48k（先限幅后重采样会让峰值冒过限幅点），限到 -2 dBFS，给 AAC 编码留余量 → 成片真峰值 ≤ -1 dBTP（qc.py 检查）
    chains.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0:duration=longest,atrim=0:{total},aresample=192000,alimiter=limit=0.79:attack=2:level=false,aresample=48000[out]")
    cmd = ['ffmpeg', '-nostdin', '-v', 'error', '-y', *inputs, '-filter_complex', ';'.join(chains), '-map', '[out]', '-ar', '48000', out]
    subprocess.run(cmd, check=True)
    print(f'✓ {out}（{total:.2f} 秒，{len(labels)} 轨）')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
