"""「AI 前沿」一条命令出成片：配音 → 逐词字幕 → 自动配空镜 → 画面文字 → 渲染成片和封面。

输入：public/frontier/<日期>/episode.json（ops-desk 流水线网页上每条选题的「成片数据」，原样复制；也可以手写）
    {
      "title": "Claude 的 5 小时限制，没了",       # 中文标题（发布用）
      "source": "Anthropic 官方公告",             # 画面底部的来源
      "script": "口播稿全文",
      "shots": [                                  # 按口播顺序分段，每段一个空镜 + 一个文字模板
        {"text": "口播原文片段", "tags": ["hourglass", "time"],
         "overlay": {"type": "stamp", "lines": ["Claude 的", "5 小时限制"], "hl": "5 小时", "text": "没了！"}},
        ...
      ],
      "cover": {"lines": ["Claude", "5 小时限制"], "hl": "5 小时", "stamp": "没了！", "sub": ["$200 顶配改名 Ultra", "但每周上限还在"]}
    }
  文字模板（overlay.type）：
    title  {"kicker"?: "我的看法", "lines": ["重度用户", "最怕的不是贵"], "hl"?: "是被打断"}   大字标题，逐词弹入
    stamp  {"lines"?: [...], "hl"?: "...", "text": "没了！"}                                  标题 + 盖章（带画面冲击）
    number {"value": "$200", "label": "顶配套餐 · 每月"}                                      数字滚动
    swap   {"from": "Max 20×", "to": "Ultra", "note"?: "价格不变"}                           旧的划掉、新的弹出
    card   {"num"?: "1", "title": "每周总用量上限", "value": "还在", "note"?: "不是无限用"}    玻璃卡片
  文字出现的时间：在配音里找到这几个字被念出来的时刻；找不到（比如画面写「5 小时」、口播念「五小时」）就按顺序错开出现。

用法：python3 tools/make_episode.py 2026-11-01 [--no-render]
  已有 voice.mp3 就不再生成配音（ElevenLabs 按字数扣积分）；要重配就先删掉 voice.mp3 和 voice.json
"""
import argparse
import base64
import json
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import broll  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
# 配音的声音（ElevenLabs 设计的「向晓 AI 主讲」）：voice_id 放在环境变量 / GitHub Secrets，不进公开仓库
VOICE = {"voice_id": os.environ.get("ELEVENLABS_VOICE_ID", ""), "model": os.environ.get("ELEVENLABS_MODEL", "eleven_v3")}
OUTRO = 2.9  # 片尾品牌卡的秒数
CHROMIUM = "/opt/pw-browsers/chromium"


# ── 1. 配音（ElevenLabs，带逐字时间戳）──
def make_voice(ep: Path, script: str) -> dict:
    mp3, meta = ep / "voice.mp3", ep / "voice.json"
    if mp3.exists() and meta.exists():
        print("配音：已有，跳过")
        return json.loads(meta.read_text())
    if not VOICE["voice_id"]:
        sys.exit("没有配音：设置环境变量 ELEVENLABS_VOICE_ID（声音资料在私有仓库 ops-desk 的 docs/plan/media-matrix/voice/）")
    body = json.dumps({"text": script, "model_id": VOICE["model"], "output_format": "mp3_44100_128"}).encode()
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE['voice_id']}/with-timestamps",
        data=body, headers={"Content-Type": "application/json"}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as r:
        data = json.loads(r.read())
    mp3.write_bytes(base64.b64decode(data["audio_base64"]))
    out = {"model": VOICE["model"], "text": script, "alignment": data.get("normalized_alignment"), "raw_alignment": data["alignment"]}
    meta.write_text(json.dumps(out, ensure_ascii=False))
    print(f"配音：生成完成，{data['alignment']['character_end_times_seconds'][-1]:.1f} 秒")
    return out


# ── 2. 文字出现的时间 ──
class Clock:
    """按文字在配音里找时间；找不到就在这段里按顺序错开"""

    def __init__(self, voice: dict):
        self.stream, self.times = broll.voice_index(voice)

    def pos_at(self, t: float) -> int:
        return next((i for i, x in enumerate(self.times) if x >= t - 0.01), len(self.times))

    def at(self, text: str, start: float, end: float, k: int) -> float:
        pos = self.pos_at(start)
        # 先按前 6 个字找，找不到再只用前 3 个字（画面上的字常常是口播的缩写）
        hit = broll.find_time(self.stream, self.times, text, pos) or (broll.find_time(self.stream, self.times, broll.norm(text)[:3], pos) if len(broll.norm(text)) >= 4 else None)
        fallback = min(start + 0.15 + k * 0.4, max(start, end - 0.6))
        return hit[0] if hit and start - 0.05 <= hit[0] < end else round(fallback, 2)


def size_of(text: str) -> int:
    """按一行的宽度定字号：汉字算 1 个宽度，字母数字算半个多，一行最宽约 900 像素"""
    units = sum(1 if ord(ch) > 0x2E80 else 0.3 if ch == " " else 0.66 for ch in text) or 1
    return max(70, min(150, int(820 / units)))  # 留出弹入时放大回弹的余量


def lines_of(texts: list[str], hl: str | None, clock: Clock, start: float, end: float, k0: int = 0) -> list[dict]:
    """几行字 → 带时间的词：高亮的词单独拆出来；每个词在念到时弹出"""
    out, k = [], k0
    for line in texts:
        parts = [line] if not hl or hl not in line else [p for p in re.split(f"({re.escape(hl)})", line) if p.strip()]
        toks = []
        for p in parts:
            toks.append({"text": p.strip(), "at": clock.at(p, start, end, k), **({"hl": True} if p == hl else {})})
            k += 1
        out.append({"size": size_of(line), "toks": toks})
    return out


def overlay_of(o: dict | None, clock: Clock, start: float, end: float) -> dict | None:
    if not isinstance(o, dict):
        return None
    t = o.get("type")
    txt = lambda key: str(o.get(key) or "").strip()  # noqa: E731
    if t == "title" and o.get("lines"):
        kicker = {"text": txt("kicker"), "at": round(start + 0.05, 2)} if txt("kicker") else None
        return {"type": "title", **({"kicker": kicker} if kicker else {}), "lines": lines_of(o["lines"], o.get("hl"), clock, start, end)}
    if t == "stamp" and txt("text"):
        lines = lines_of(o.get("lines") or [], o.get("hl"), clock, start, end)
        return {"type": "stamp", "lines": lines, "text": txt("text"), "at": clock.at(txt("text"), start, end, len(lines) + 1)}
    if t == "number":
        m = re.match(r"^(\D*?)([\d.,]+)(.*)$", txt("value"))
        if not m:  # 不是数字，当标题用
            return overlay_of({"type": "title", "lines": [txt("value"), txt("label")]}, clock, start, end)
        num = float(m.group(2).replace(",", ""))
        return {"type": "number", "prefix": m.group(1), "value": int(num) if num.is_integer() else num, "suffix": m.group(3), "label": txt("label"), "at": clock.at(m.group(2), start, end, 0)}
    if t == "swap" and txt("from") and txt("to"):
        r = {"type": "swap", "from": txt("from"), "to": txt("to"), "at": round(start + 0.05, 2), "toAt": clock.at(txt("to"), start, end, 1)}
        if txt("note"):
            r |= {"note": txt("note"), "noteAt": clock.at(txt("note"), start, end, 2)}
        return r
    if t == "card" and txt("value"):
        r = {"type": "card", "num": txt("num"), "title": txt("title"), "value": txt("value"), "at": round(start + 0.05, 2), "valueAt": clock.at(txt("value"), start, end, 1)}
        if txt("note"):
            r |= {"note": txt("note"), "noteAt": clock.at(txt("note"), start, end, 2)}
        return r
    return None


# ── 3. 组装成片数据 ──
def build(date: str, ep_json: dict, voice: dict, words: dict) -> dict:
    voice_end = round(voice["raw_alignment"]["character_end_times_seconds"][-1], 2)
    total = round(voice_end + OUTRO, 2)
    plan = broll.plan(ep_json["shots"], voice, total)
    clock = Clock(voice)
    shots = []
    for k, s in enumerate(plan):
        end = plan[k + 1]["from"] if k + 1 < len(plan) else voice_end
        ov = overlay_of(ep_json["shots"][s["i"]].get("overlay"), clock, s["from"], end)
        shots.append({"from": s["from"], "to": round(end, 2) if k + 1 < len(plan) else total, "src": s["src"], **({"temp": s["temp"]} if "temp" in s else {}), "overlay": ov})
    impacts = [o["at"] for o in (s["overlay"] for s in shots) if o and o["type"] == "stamp"]
    leaks = [s["from"] for k, s in enumerate(shots) if k in (1, 2) or (k > 2 and k % 3 == 0)] + [voice_end]
    c = ep_json.get("cover") or {}
    cover = {"kicker": f"AI 前沿 · {date[5:].replace('-', '.')}", "lines": c.get("lines") or [ep_json["title"]], "hl": c.get("hl"), "stamp": c.get("stamp"), "sub": c.get("sub") or []}
    return {"date": date, "source": ep_json.get("source", ""), "voiceEnd": voice_end, "total": total, "shots": shots, "words": words, "impacts": impacts, "leaks": leaks, "cover": cover}


def render(date: str, props: Path) -> None:
    out = ROOT / "out"
    common = ["--props", str(props), "--gl=swangle", f"--browser-executable={CHROMIUM}"]
    subprocess.run(["npx", "remotion", "still", "src/index.ts", "AutoCover", str(out / f"cover-{date}.png"), *common], cwd=ROOT, check=True)
    subprocess.run(["npx", "remotion", "render", "src/index.ts", "Auto", str(out / f"ai-frontier-{date}.mp4"), *common, "--concurrency=4", "--crf=18"], cwd=ROOT, check=True)
    print(f"成片：out/ai-frontier-{date}.mp4　封面：out/cover-{date}.png")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("date")
    ap.add_argument("--no-render", action="store_true", help="只生成成片数据，不渲染")
    args = ap.parse_args()
    ep = ROOT / "public" / "frontier" / args.date
    ep_json = json.loads((ep / "episode.json").read_text())
    voice = make_voice(ep, ep_json["script"])
    words_file = ep / "words.json"
    subprocess.run(["node", "tools/frontier_words.mjs", str(ep / "voice.json"), str(words_file)], cwd=ROOT, check=True)
    data = build(args.date, ep_json, voice, json.loads(words_file.read_text()))
    props = ep / "auto.json"
    props.write_text(json.dumps(data, ensure_ascii=False))
    print(f"成片数据：{props.relative_to(ROOT)}，{len(data['shots'])} 个镜头，{data['total']} 秒")
    if not args.no_render:
        render(args.date, props)


if __name__ == "__main__":
    main()
