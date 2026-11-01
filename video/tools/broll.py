"""自动配空镜：按口播稿给每段画面找一段空镜（实拍素材视频），生成视频要用的镜头表。

输入（每期一个）：public/frontier/<日期>/shots.json，按口播顺序列出每段画面
    [{"text": "口播稿里的原文片段", "tags": ["hourglass", "time"]}, ...]
  text 用来在配音的逐字时间戳里定位这段画面从第几秒开始；tags 是 2～3 个英文名词（素材站的分类词），
  由流水线写稿时一起生成（ops-desk 的 frontier.py），也可以手写。
做法：
  1. 先查本地素材库 public/broll/library.json（用过的空镜都记在这里，带标签），同一期里不重复用
  2. 库里没有，就按标签去 Mixkit（免费商用、无需署名）找，下载后裁成竖屏 1080×1920、截 6 秒，入库
  3. 还找不到，用库里标了 abstract 的抽象画面兜底，保证流程不会卡住
输出：src/frontier/episodes/<日期>.shots.ts（自动生成，Episode 组件直接读）

用法：python3 tools/broll.py 2026-11-01 [--total 30.5]   （--total 是成片总秒数，最后一个镜头一直放到结尾）
"""
import argparse
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIB_DIR = ROOT / "public" / "broll"
LIB_FILE = LIB_DIR / "library.json"
UA = {"User-Agent": "Mozilla/5.0 (dawnward-broll)"}
CLIP_SECONDS = 6
PUNCT = re.compile(r"[\s，。；：！？、,.;:!?\"'“”‘’（）()《》]")


def norm(s: str) -> str:
    return PUNCT.sub("", s).lower()


def locate(shots: list[dict], voice: dict) -> list[float]:
    """每段画面的开始时间：在配音的逐字时间戳里按顺序找到它的第一个字"""
    a = voice["raw_alignment"]
    chars = [(c.lower(), t) for c, t in zip(a["characters"], a["character_start_times_seconds"]) if norm(c)]
    stream = "".join(c for c, _ in chars)
    starts, pos = [], 0
    for s in shots:
        key = norm(s["text"])[:6]
        i = stream.find(key, pos)
        if i < 0:
            sys.exit(f"配音里找不到这段口播：{s['text']}（shots.json 的 text 要和口播稿原文一致）")
        starts.append(round(chars[i][1], 2))
        pos = i + len(key)
    starts[0] = 0.0
    return starts


def http(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()


def mixkit_ids(tag: str) -> list[int]:
    """Mixkit 的分类页（单个英文词），返回视频编号，按页面顺序"""
    try:
        page = http(f"https://mixkit.co/free-stock-video/{tag}/").decode("utf-8", "ignore")
    except Exception:
        return []
    ids = []
    for m in re.finditer(r'href="/free-stock-video/[a-z0-9-]+-(\d+)/"', page):
        i = int(m.group(1))
        if i not in ids:
            ids.append(i)
    return ids


def fetch_mixkit(vid: int) -> Path | None:
    """下载一段 Mixkit 视频，裁成竖屏、截 6 秒、去掉声音"""
    raw = LIB_DIR / f".raw-{vid}.mp4"
    for q in (1080, 720):
        try:
            raw.write_bytes(http(f"https://assets.mixkit.co/videos/{vid}/{vid}-{q}.mp4"))
            break
        except Exception:
            continue
    else:
        return None
    out = LIB_DIR / f"mx{vid}.mp4"
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(raw)], capture_output=True, text=True).stdout or 0)
    ss = 1 if dur > CLIP_SECONDS + 1 else 0
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-ss", str(ss), "-i", str(raw), "-t", str(CLIP_SECONDS), "-an",
         "-vf", "crop='min(iw,ih*9/16)':ih,scale=1080:1920:flags=lanczos,fps=30", "-c:v", "libx264", "-crf", "23", "-preset", "slow", str(out)],
        check=True,
    )
    raw.unlink()
    return out


def pick(tags: list[str], lib: list[dict], used: set[str]) -> dict | None:
    for t in tags:
        for c in lib:
            if t in c["tags"] and c["file"] not in used:
                return c
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("date")
    ap.add_argument("--total", type=float, default=0, help="成片总秒数（默认：配音结束 + 3 秒片尾）")
    args = ap.parse_args()
    ep = ROOT / "public" / "frontier" / args.date
    shots = json.loads((ep / "shots.json").read_text())
    voice = json.loads((ep / "voice.json").read_text())
    lib = json.loads(LIB_FILE.read_text())
    starts = locate(shots, voice)
    total = args.total or round(voice["raw_alignment"]["character_end_times_seconds"][-1] + 3, 2)

    used: set[str] = set()
    out = []
    for n, s in enumerate(shots):
        tags = [t.lower().strip() for t in s.get("tags", []) if t.strip()]
        clip, how = pick(tags, lib, used), "素材库"
        if not clip:
            known = {c.get("id") for c in lib}
            for t in tags:
                vid = next((i for i in mixkit_ids(t) if i not in known), None)
                if vid and (f := fetch_mixkit(vid)):
                    clip = {"file": f.name, "tags": tags, "source": "mixkit", "id": vid}
                    lib.append(clip)
                    LIB_FILE.write_text(json.dumps(lib, ensure_ascii=False, indent=2) + "\n")
                    how = f"Mixkit #{vid}"
                    break
        if not clip:
            clip, how = pick(["abstract"], lib, used) or pick(["abstract"], lib, set()), "兜底（抽象画面）"
        used.add(clip["file"])
        end = starts[n + 1] if n + 1 < len(starts) else total
        out.append({"from": starts[n], "to": end, "src": clip["file"].removesuffix(".mp4"), **({"temp": clip["temp"]} if "temp" in clip else {})})
        print(f"{starts[n]:6.2f}s  {s['text'][:16]:<16}  {'/'.join(tags):<28} → {clip['file']}（{how}）")

    target = ROOT / "src" / "frontier" / "episodes" / f"{args.date}.shots.ts"
    target.write_text(
        "// 自动生成（tools/broll.py），不要手改\n"
        'import type { Shot } from "../broll/types";\n\n'
        f"export const shots: Shot[] = {json.dumps(out, ensure_ascii=False)};\n"
        f"export const totalSeconds = {total};\n"
    )
    print(f"写入 {target.relative_to(ROOT)}，共 {len(out)} 个镜头，总长 {total} 秒")


if __name__ == "__main__":
    main()
