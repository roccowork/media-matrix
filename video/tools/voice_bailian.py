"""阿里云百炼配音：qwen-audio-3.1-tts-plus（影视配音向）+ 复刻音色（向晓），逐句合成，全走 HTTP。

用法：python3 tools/voice_bailian.py storyboards/2026-11-17-hot-streak [--only 1-3]
  读  <分镜目录>/narration.json（lines: [{i, say}]）
  写  public/voice/<分镜目录名>/NN-哈希.mp3 和 voice.json（每句的文件和时长，排时间轴用）
  --only：只配这几句（试听用，如 1-3 或 1,5,7）
  按句缓存：文本、声音、模型没变的句子不重配，不重复扣费。

环境变量：DASHSCOPE_API_KEY（百炼 Key；会话里由代理注入，填 proxy-injected 即可）
          BAILIAN_VOICE_ID（复刻音色 id，见 ops-desk voice/README.md）
          BAILIAN_TTS_MODEL（默认 qwen-audio-3.1-tts-plus，必须和建音色时的 target_model 一致）
复刻：python3 tools/voice_bailian.py --enroll 参考录音.mp3（10～20 秒、单声道、≥24kHz），打印音色 id
下载音频要能访问 dashscope-result-bj.oss-cn-beijing.aliyuncs.com（会话环境已放行）。
"""
import base64, hashlib, json, os, subprocess, sys, time, urllib.request
from pathlib import Path

MODEL = os.environ.get("BAILIAN_TTS_MODEL", "qwen-audio-3.1-tts-plus")
API = "https://dashscope.aliyuncs.com/api/v1/services/audio/tts"
ROOT = Path(__file__).resolve().parent.parent


def post(path: str, body: dict) -> dict:
    k = os.environ.get("DASHSCOPE_API_KEY") or sys.exit("没有 DASHSCOPE_API_KEY")
    req = urllib.request.Request(f"{API}/{path}", json.dumps(body).encode(),
                                 {"Content-Type": "application/json", "Authorization": f"Bearer {k}"})
    for n in range(3):
        try:
            return json.load(urllib.request.urlopen(req, timeout=120))
        except Exception as e:  # noqa: BLE001  偶发网络错误重试两次
            if n == 2:
                raise
            print("重试：", e)
            time.sleep(3)


def enroll(audio: str, prefix: str = "xiangxiao") -> None:
    b = base64.b64encode(Path(audio).read_bytes()).decode()
    out = post("customization", {"model": "voice-enrollment", "input": {
        "action": "create_voice", "target_model": MODEL, "prefix": prefix, "audio": f"data:audio/mpeg;base64,{b}"}})
    print(out["output"]["voice_id"])


def synth(text: str, voice: str, out: Path) -> float:
    r = post("SpeechSynthesizer", {"model": MODEL, "input": {"text": text, "voice": voice, "format": "mp3", "sample_rate": 24000}})
    url = r["output"]["audio"]["url"].replace("http://", "https://", 1)
    raw = out.with_suffix(".raw.mp3")
    raw.write_bytes(urllib.request.urlopen(url, timeout=120).read())
    # 统一成 48kHz，去掉首尾静音外的多余空白交给排时间轴时处理
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-ar", "48000", "-ac", "1", "-b:a", "192k", str(out)], check=True)
    raw.unlink()
    d = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(out)],
                       capture_output=True, text=True, check=True).stdout
    return round(float(d), 3)


def parse_only(spec: str | None) -> set[int] | None:
    if not spec:
        return None
    got = set()
    for part in spec.split(","):
        a, _, b = part.partition("-")
        got |= set(range(int(a), int(b or a) + 1))
    return got


def main(board: str, only: set[int] | None = None) -> None:
    voice = os.environ.get("BAILIAN_VOICE_ID") or sys.exit("没有 BAILIAN_VOICE_ID")
    src = ROOT / board
    lines = json.loads((src / "narration.json").read_text(encoding="utf-8"))["lines"]
    out = ROOT / "public" / "voice" / src.name
    out.mkdir(parents=True, exist_ok=True)
    meta_f = out / "voice.json"
    old = {x["file"]: x for x in json.loads(meta_f.read_text())["lines"]} if meta_f.exists() else {}
    result, new = [], 0
    for ln in lines:
        if only and ln["i"] not in only:
            if (prev := next((x for x in old.values() if x["i"] == ln["i"]), None)):
                result.append(prev)
            continue
        h = hashlib.sha1(f"{MODEL}|{voice}|{ln['say']}".encode()).hexdigest()[:10]
        f = f"{ln['i']:02d}-{h}.mp3"
        if (out / f).exists() and f in old:
            result.append(old[f])
            continue
        dur = synth(ln["say"], voice, out / f)
        result.append({"i": ln["i"], "say": ln["say"], "file": f, "dur": dur})
        new += 1
        print(f"{ln['i']:02d} {dur:5.2f}s {ln['say']}")
    keep = {r["file"] for r in result}
    for p in out.glob("*.mp3"):
        if p.name not in keep:
            p.unlink()
    result.sort(key=lambda r: r["i"])
    meta_f.write_text(json.dumps({"model": MODEL, "total": round(sum(r["dur"] for r in result), 2), "lines": result},
                                 ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"共 {len(result)} 句，{sum(r['dur'] for r in result):.1f} 秒；新配 {new} 句")


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[:1] == ["--enroll"]:
        enroll(a[1])
    else:
        main(a[0], parse_only(a[a.index("--only") + 1]) if "--only" in a else None)
