"""「AI 科普」一条命令出成片（横屏，默认 1 分钟，最长 5 分钟）：分段配音 → 画面元素按口播对时 → 字幕 → 空镜 → 渲染成片和封面。

输入：public/explainer/<编号>/episode.json（私人助理里发「科普：题目」，Claude 写稿，点「🎬 出片」时传过来；也可以手写）
    {
      "title": "Transformer 是怎么来的",
      "sources": ["Vaswani 等，Attention Is All You Need（2017）"],      # 画面角落的参考资料
      "cover": {"lines": ["Transformer", "是怎么来的"], "hl": "Transformer", "sub": "一篇论文改变了整个 AI"},
      "scenes": [                                                     # 按口播顺序，每段一句到几句口播 + 一个画面
        {"say": "这一段的口播原文", "visual": {"type": "title", "kicker": "AI 科普", "title": "Transformer 是怎么来的"}},
        ...
      ]
    }
  画面（visual.type），列表里的每一项在口播念到它的时候出现（念不到就在这段里按顺序错开）：
    title     {"kicker"?, "title", "sub"?}                                章节标题
    timeline  {"items": [{"when": "1950", "label": "图灵测试"}, ...]}      时间线，2～6 个节点
    flow      {"title"?, "steps": ["输入", "注意力", "输出"]}              流程图，2～5 步，箭头依次点亮
    compare   {"left": {"title", "points": [...]}, "right": {...}}        左右对比
    number    {"value": "1750 亿", "label": "GPT-3 的参数量"}             大数字滚动
    list      {"title", "items": ["...", ...]}                            要点清单，2～5 条
    quote     {"text", "who"?}                                            引言
    broll     {"tags": ["server", "city"], "caption"?}                    实拍空镜（Mixkit，横屏），少用
用法：python3 tools/make_explainer.py <编号> [--no-render | --cover-only]
  配音按段缓存（voice/<序号>-<内容哈希>.mp3）：只改了某一段，重做时只重配那一段，不重复扣 ElevenLabs 积分
"""
import argparse
import base64
import hashlib
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
VOICE = {"voice_id": os.environ.get("ELEVENLABS_VOICE_ID", ""), "model": os.environ.get("ELEVENLABS_MODEL", "eleven_v3")}
CHROMIUM = os.environ.get("REMOTION_BROWSER", "/opt/pw-browsers/chromium")
INTRO, GAP, OUTRO = 3.0, 0.55, 4.5  # 片头秒数、段与段之间停顿、片尾秒数
TYPES = {"title", "timeline", "flow", "compare", "number", "list", "quote", "broll"}


# ── 1. 分段配音（ElevenLabs，带逐字时间戳），按内容哈希缓存 ──
def tts(text: str) -> dict:
    body = json.dumps({"text": text, "model_id": VOICE["model"], "output_format": "mp3_44100_128"}).encode()
    headers = {"Content-Type": "application/json"}
    if key := os.environ.get("ELEVENLABS_API_KEY"):  # GitHub Actions 用 Secret；本地云端环境由代理自动带上
        headers["xi-api-key"] = key
    req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE['voice_id']}/with-timestamps", data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.loads(r.read())


def scene_voice(ep: Path, k: int, say: str) -> tuple[str, dict]:
    """返回（相对 public/ 的 mp3 路径, {"raw_alignment": ...}）"""
    h = hashlib.sha1(f"{VOICE['model']}|{say}".encode()).hexdigest()[:10]
    d = ep / "voice"
    d.mkdir(exist_ok=True)
    mp3, meta = d / f"{k:02d}-{h}.mp3", d / f"{k:02d}-{h}.json"
    if not (mp3.exists() and meta.exists()):
        if not VOICE["voice_id"]:
            sys.exit("没有配音：设置环境变量 ELEVENLABS_VOICE_ID")
        for old in d.glob(f"{k:02d}-*"):  # 这一段改过稿，旧配音删掉
            old.unlink()
        data = tts(say)
        mp3.write_bytes(base64.b64decode(data["audio_base64"]))
        meta.write_text(json.dumps({"text": say, "raw_alignment": data["alignment"]}, ensure_ascii=False))
        print(f"配音 第 {k + 1} 段：生成 {data['alignment']['character_end_times_seconds'][-1]:.1f} 秒")
    return str(mp3.relative_to(ROOT / "public")), json.loads(meta.read_text())


# ── 2. 对时：元素文字在这一段配音里被念到的时刻 ──
class Clock:
    def __init__(self, voice: dict, start: float, end: float):
        self.stream, self.times = broll.voice_index(voice)
        self.start, self.end, self.pos, self.k = start, end, 0, 0

    def at(self, *texts: str) -> float:
        """按顺序往后找（同一段里的元素按出现顺序念）；给几个说法就依次试；都找不到就在这段的前 70% 里错开"""
        hit = None
        for key in (broll.norm(x) for x in texts):
            for n in (6, 3, 2):
                if len(key) >= n and (hit := broll.find_time(self.stream, self.times, key[:n], self.pos)):
                    break
            if hit:
                break
        k, self.k = self.k, self.k + 1
        if hit:
            self.pos = hit[1]
            return round(self.start + hit[0], 2)
        return round(self.start + 0.3 + min(k * 0.9, (self.end - self.start) * 0.7), 2)


def visual_of(v: dict, clock: Clock, used: set[str], lib: list[dict]) -> dict:
    """把稿子里的画面换成带时间的数据；格式不对的退回成标题卡"""
    t = v.get("type") if isinstance(v, dict) else None
    s = lambda x: str(x or "").strip()  # noqa: E731
    first = round(clock.start + 0.15, 2)
    if t == "timeline" and v.get("items"):
        return {"type": t, "items": [{"when": s(i.get("when")), "label": s(i.get("label")), "at": clock.at(s(i.get("when")), s(i.get("label")))} for i in v["items"][:6] if isinstance(i, dict)]}
    if t == "flow" and v.get("steps"):
        return {"type": t, "title": s(v.get("title")), "steps": [{"text": s(x), "at": clock.at(s(x))} for x in v["steps"][:5]]}
    if t == "compare" and isinstance(v.get("left"), dict) and isinstance(v.get("right"), dict):
        side = lambda o: {"title": s(o.get("title")), "at": clock.at(s(o.get("title"))), "points": [{"text": s(p), "at": clock.at(s(p))} for p in (o.get("points") or [])[:4]]}  # noqa: E731
        return {"type": t, "left": side(v["left"]), "right": side(v["right"])}
    if t == "number" and s(v.get("value")):
        m = re.match(r"^(\D*?)([\d.,]+)(.*)$", s(v["value"]))
        if m:
            n = float(m.group(2).replace(",", ""))
            return {"type": t, "prefix": m.group(1), "value": int(n) if n.is_integer() else n, "decimals": len(m.group(2).split(".")[1]) if "." in m.group(2) else 0,
                    "suffix": m.group(3), "label": s(v.get("label")), "at": clock.at(m.group(2))}
        return {"type": "title", "kicker": s(v.get("label")), "title": s(v["value"]), "at": first}
    if t == "list" and v.get("items"):
        return {"type": t, "title": s(v.get("title")), "items": [{"text": s(x), "at": clock.at(s(x))} for x in v["items"][:5]]}
    if t == "quote" and s(v.get("text")):
        return {"type": t, "text": s(v["text"]), "who": s(v.get("who")), "at": first}
    if t == "broll":
        tags = [x.lower().strip() for x in v.get("tags") or [] if str(x).strip()]
        clip, how = broll.choose_clip(tags, lib, used, landscape=True)
        print(f"  空镜 {'/'.join(tags)} → {clip['file'] if clip else '没有'}（{how}）")
        if clip:
            used.add(clip["file"])
            return {"type": t, "src": clip["file"].removesuffix(".mp4"), "caption": s(v.get("caption")), "at": first}
        return {"type": "title", "title": s(v.get("caption")) or "……", "at": first}
    return {"type": "title", "kicker": s(v.get("kicker")) if isinstance(v, dict) else "", "title": s(v.get("title")) if isinstance(v, dict) else "", "sub": s(v.get("sub")) if isinstance(v, dict) else "", "at": first}


# ── 3. 字幕：按标点切成短句，每句用第一个字和最后一个字的时间 ──
def subtitles(say: str, voice: dict, start: float, limit: int = 22) -> list[dict]:
    a = voice["raw_alignment"]
    chars, st, en = a["characters"], a["character_start_times_seconds"], a["character_end_times_seconds"]
    out, cur, i0 = [], "", None
    for i, c in enumerate(chars):
        if c in "，。！？；：,.!?;:…\n" or (len(cur) >= limit and c in "、 "):
            if cur.strip():
                out.append({"from": round(start + st[i0], 2), "to": round(start + en[i - 1], 2), "text": cur.strip()})
            cur, i0 = "", None
            continue
        if i0 is None:
            i0 = i
        cur += c
    if cur.strip() and i0 is not None:
        out.append({"from": round(start + st[i0], 2), "to": round(start + en[-1], 2), "text": cur.strip()})
    return out


def build(slug: str, ep_json: dict) -> dict:
    ep = ROOT / "public" / "explainer" / slug
    lib = json.loads(broll.LIB_FILE.read_text())
    used: set[str] = set()
    t, scenes, subs = INTRO, [], []
    for k, sc in enumerate(ep_json["scenes"]):
        say = str(sc.get("say") or "").strip()
        if not say:
            continue
        audio, voice = scene_voice(ep, k, say)
        dur = voice["raw_alignment"]["character_end_times_seconds"][-1]
        end = round(t + dur + GAP, 2)
        clock = Clock(voice, t, t + dur)
        scenes.append({"from": round(t, 2), "to": end, "audio": audio, "visual": visual_of(sc.get("visual") or {}, clock, used, lib)})
        subs += subtitles(say, voice, t)
        t = end
    c = ep_json.get("cover") or {}
    return {
        "slug": slug, "title": ep_json["title"], "sources": [str(x) for x in ep_json.get("sources") or []][:3],
        "intro": INTRO, "voiceEnd": round(t, 2), "total": round(t + OUTRO, 2), "scenes": scenes, "subs": subs,
        "cover": {"lines": c.get("lines") or [ep_json["title"]], "hl": c.get("hl") or "", "sub": c.get("sub") or ""},
    }


def render(slug: str, props: Path, cover_only: bool = False) -> None:
    out = ROOT / "out"
    out.mkdir(exist_ok=True)
    common = ["--props", str(props), "--gl=swiftshader", *([f"--browser-executable={CHROMIUM}"] if Path(CHROMIUM).exists() else [])]
    subprocess.run(["npx", "remotion", "still", "src/index.ts", "ExplainerCover", str(out / f"explainer-cover-{slug}.png"), *common], cwd=ROOT, check=True)
    if not cover_only:
        crf = os.environ.get("RENDER_CRF", "20")
        subprocess.run(["npx", "remotion", "render", "src/index.ts", "Explainer", str(out / f"explainer-{slug}.mp4"), *common, f"--concurrency={os.cpu_count() or 4}", f"--crf={crf}"], cwd=ROOT, check=True)
    print(f"成片：out/explainer-{slug}.mp4　封面：out/explainer-cover-{slug}.png")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", help="public/explainer/ 下的文件夹名，如 2026-11-02-1")
    ap.add_argument("--no-render", action="store_true", help="只生成成片数据，不渲染")
    ap.add_argument("--cover-only", action="store_true", help="只渲染封面（GitHub Actions 里成片分 8 段并行渲染，见 .github/workflows/explainer.yml）")
    args = ap.parse_args()
    ep = ROOT / "public" / "explainer" / args.slug
    ep_json = json.loads((ep / "episode.json").read_text())
    data = build(args.slug, ep_json)
    props = ep / "auto.json"
    props.write_text(json.dumps(data, ensure_ascii=False))
    print(f"成片数据：{props.relative_to(ROOT)}，{len(data['scenes'])} 段，{data['total']} 秒")
    if not args.no_render:
        render(args.slug, props, args.cover_only)


if __name__ == "__main__":
    main()
