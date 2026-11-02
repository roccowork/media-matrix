"""「AI 科普」一条命令出成片（横屏，默认 1 分钟，最长 5 分钟）：分段配音 → 每段配一个镜头（src/science/ 镜头库）→ 字幕 → 渲染成片和封面。

输入：public/explainer/<编号>/episode.json（私人助理里点「🎬 出片」时传过来，或者在对话里写好直接触发 explainer.yml）
    {
      "title": "Transformer 是怎么来的",
      "sources": ["Vaswani 等，Attention Is All You Need（2017）"],
      "cover": {"lines": ["Transformer", "是怎么来的"], "hl": "Transformer", "sub": "一篇论文改变了整个 AI"},
      "scenes": [                      # 按口播顺序，每段口播配一个镜头
        {"say": "这一段的口播原文", "shot": {"type": "open", "props": {"title": "Transformer", "sub": "..."}}},
        ...
      ]
    }
  镜头类型和参数见 src/science/index.ts 的 SHOTS 和各组件的 Props（open / title / layers / relay / readout / timeline / versus / points），
  原理见 src/science/HANDBOOK.md。镜头按这段配音的长度自动拉伸停留段或压缩。
用法：python3 tools/make_explainer.py <编号> [--no-render | --cover-only]
  配音按段缓存（voice/<序号>-<内容哈希>.mp3）：只改了某一段，重做时只重配那一段，不重复扣 ElevenLabs 积分
"""
import argparse
import base64
import hashlib
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
VOICE = {"voice_id": os.environ.get("ELEVENLABS_VOICE_ID", ""), "model": os.environ.get("ELEVENLABS_MODEL", "eleven_v3")}
CHROMIUM = os.environ.get("REMOTION_BROWSER", "/opt/pw-browsers/chromium")
GAP, OUTRO = 0.6, 4.5  # 段与段之间停顿（让镜头的退场和停留有时间）、片尾秒数
SHOT_TYPES = {"open", "title", "layers", "relay", "readout", "timeline", "versus", "points"}  # 与 src/science/index.ts 的 SHOTS 一致


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
    t, scenes, subs = 0.0, [], []
    for k, sc in enumerate(ep_json["scenes"]):
        say = str(sc.get("say") or "").strip()
        if not say:
            continue
        shot = sc.get("shot") if isinstance(sc.get("shot"), dict) else {}
        if shot.get("type") not in SHOT_TYPES:
            shot = {"type": "title", "props": {"title": ep_json["title"]}}  # 类型写错就用章节标题兜底
        audio, voice = scene_voice(ep, k, say)
        lead = 0.5 if k == 0 else 0.25  # 镜头先入场一点再开口
        dur = voice["raw_alignment"]["character_end_times_seconds"][-1]
        end = round(t + lead + dur + GAP, 2)
        scenes.append({"from": round(t, 2), "to": end, "audio": "", "voiceAt": round(t + lead, 2), "voice": audio, "shot": {"type": shot["type"], "props": shot.get("props") or {}}})
        subs += subtitles(say, voice, t + lead)
        t = end
    c = ep_json.get("cover") or {}
    return {
        "slug": slug, "title": ep_json["title"], "sources": [str(x) for x in ep_json.get("sources") or []][:3],
        "voiceEnd": round(t, 2), "total": round(t + OUTRO, 2), "scenes": scenes, "subs": subs,
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
