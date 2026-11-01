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


def norm(s: str) -> str:
    """只留文字和数字（去掉标点、空格、$ 之类的符号），用来在配音里按文字找位置"""
    return re.sub(r"[\W_]+", "", s).lower()


def voice_index(voice: dict) -> tuple[str, list[float]]:
    """配音的逐字时间戳 → (去掉标点的小写文字, 每个字的开始时间)，用来按文字找时间"""
    a = voice["raw_alignment"]
    chars = [(c.lower(), t) for c, t in zip(a["characters"], a["character_start_times_seconds"]) if norm(c)]
    return "".join(c for c, _ in chars), [t for _, t in chars]


def find_time(stream: str, times: list[float], text: str, pos: int = 0) -> tuple[float, int] | None:
    """text 在配音里从第 pos 个字往后第一次出现的时间，和出现后的位置；找不到返回 None"""
    key = norm(text)[:6]
    i = stream.find(key, pos) if key else -1
    return (round(times[i], 2), i + len(key)) if i >= 0 else None


def locate(shots: list[dict], voice: dict) -> list[float | None]:
    """每段画面的开始时间：在配音里按顺序找到它的第一个字。找不到的（稿子录音前改过）返回 None，调用方并到上一段"""
    stream, times = voice_index(voice)
    starts, pos = [], 0
    for s in shots:
        hit = find_time(stream, times, s["text"], pos)
        if hit:
            starts.append(hit[0])
            pos = hit[1]
        else:
            print(f"⚠️ 配音里找不到这段口播，并到上一段：{s['text']}")
            starts.append(None)
    if starts:
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


def choose_clip(tags: list[str], lib: list[dict], used: set[str]) -> tuple[dict, str]:
    """先查素材库，没有就去 Mixkit 下载入库，还没有用抽象画面兜底。返回 (素材, 来源说明)"""
    clip = pick(tags, lib, used)
    if clip:
        return clip, "素材库"
    known = {c.get("id") for c in lib}
    for t in tags:
        vid = next((i for i in mixkit_ids(t) if i not in known), None)
        if vid and (f := fetch_mixkit(vid)):
            clip = {"file": f.name, "tags": tags, "source": "mixkit", "id": vid}
            lib.append(clip)
            LIB_FILE.write_text(json.dumps(lib, ensure_ascii=False, indent=2) + "\n")
            return clip, f"Mixkit #{vid}"
    return pick(["abstract"], lib, used) or pick(["abstract"], lib, set()), "兜底（抽象画面）"


def plan(shots: list[dict], voice: dict, total: float) -> list[dict]:
    """镜头表：[{from, to, src, temp?, i（对应 shots 里第几段）}]，找不到时间的段并到上一段"""
    lib = json.loads(LIB_FILE.read_text())
    starts = locate(shots, voice)
    keep = [(n, t) for n, t in enumerate(starts) if t is not None]
    used: set[str] = set()
    out = []
    for k, (n, start) in enumerate(keep):
        s = shots[n]
        tags = [t.lower().strip() for t in s.get("tags", []) if t.strip()]
        clip, how = choose_clip(tags, lib, used)
        used.add(clip["file"])
        end = keep[k + 1][1] if k + 1 < len(keep) else total
        out.append({"from": start, "to": end, "src": clip["file"].removesuffix(".mp4"), **({"temp": clip["temp"]} if "temp" in clip else {}), "i": n})
        print(f"{start:6.2f}s  {s['text'][:16]:<16}  {'/'.join(tags):<28} → {clip['file']}（{how}）")
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("date")
    ap.add_argument("--total", type=float, default=0, help="成片总秒数（默认：配音结束 + 3 秒片尾）")
    args = ap.parse_args()
    ep = ROOT / "public" / "frontier" / args.date
    shots = json.loads((ep / "shots.json").read_text())
    voice = json.loads((ep / "voice.json").read_text())
    total = args.total or round(voice["raw_alignment"]["character_end_times_seconds"][-1] + 3, 2)
    out = [{k: v for k, v in s.items() if k != "i"} for s in plan(shots, voice, total)]
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
