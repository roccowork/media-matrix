"""阿里云百炼配音：千问声音复刻（qwen3-tts-vc，向晓的声音），逐句合成。

用法：python3 tools/voice_bailian.py storyboards/2026-11-17-hot-streak [--only 1-3]
  --only：只配这几句（试听用，如 1-3 或 1,5,7）
  读  <分镜目录>/narration.json（lines: [{i, say}]）
  写  public/voice/<分镜目录名>/NN-哈希.mp3 和 voice.json（每句的文件和时长，排时间轴用）
  按句缓存：文本和声音没变的句子不重配，不重复扣费。

环境变量：DASHSCOPE_API_KEY（百炼 Key）、BAILIAN_VOICE_ID（复刻出来的音色 id）
  模型可用 BAILIAN_TTS_MODEL 覆盖，默认 qwen3-tts-vc-realtime-2026-01-15（要和建音色时的 target_model 一致）
  复刻：python3 tools/voice_bailian.py --enroll 参考录音.mp3 （10～20 秒、单声道、≥24kHz），打印音色 id
为什么走 WebSocket：复刻音色只有实时接口能合成；会话虚拟机的代理会弄坏 WebSocket，所以在 GitHub Actions（voice.yml）或本机跑。
"""
import asyncio, base64, hashlib, json, os, subprocess, sys, urllib.request, uuid
from pathlib import Path

MODEL = os.environ.get("BAILIAN_TTS_MODEL", "qwen3-tts-vc-realtime-2026-01-15")
ROOT = Path(__file__).resolve().parent.parent


def key() -> str:
    k = os.environ.get("DASHSCOPE_API_KEY")
    if not k:
        sys.exit("没有 DASHSCOPE_API_KEY")
    return k


def enroll(audio: str, name: str = "xiangxiao") -> None:
    b = base64.b64encode(Path(audio).read_bytes()).decode()
    body = {"model": "qwen-voice-enrollment", "input": {"action": "create", "target_model": MODEL, "preferred_name": name,
                                                       "audio": {"data": f"data:audio/mpeg;base64,{b}"}}}
    req = urllib.request.Request("https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization", json.dumps(body).encode(),
                                 {"Content-Type": "application/json", "Authorization": f"Bearer {key()}"})
    print(json.load(urllib.request.urlopen(req, timeout=120))["output"])


async def synth(ws, text: str) -> bytes:
    await ws.send(json.dumps({"event_id": "e" + uuid.uuid4().hex, "type": "input_text_buffer.append", "text": text}))
    await ws.send(json.dumps({"event_id": "e" + uuid.uuid4().hex, "type": "input_text_buffer.commit"}))
    pcm = bytearray()
    while True:
        ev = json.loads(await asyncio.wait_for(ws.recv(), 120))
        t = ev.get("type")
        if t == "response.audio.delta":
            pcm += base64.b64decode(ev["delta"])
        elif t == "response.done":
            return bytes(pcm)
        elif t == "error":
            sys.exit(f"合成失败：{ev}")


def to_mp3(pcm: bytes, out: Path) -> float:
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", "-",
                    "-ar", "48000", "-b:a", "192k", str(out)], input=pcm, check=True)
    return round(len(pcm) / 2 / 24000, 3)


def parse_only(spec: str | None) -> set[int] | None:
    if not spec:
        return None
    got = set()
    for part in spec.split(","):
        a, _, b = part.partition("-")
        got |= set(range(int(a), int(b or a) + 1))
    return got


async def main(board: str, only: set[int] | None = None) -> None:
    import websockets
    voice = os.environ.get("BAILIAN_VOICE_ID") or sys.exit("没有 BAILIAN_VOICE_ID")
    src = ROOT / board
    lines = json.loads((src / "narration.json").read_text(encoding="utf-8"))["lines"]
    if only:
        lines = [x for x in lines if x["i"] in only]
    out = ROOT / "public" / "voice" / src.name
    out.mkdir(parents=True, exist_ok=True)
    meta_f = out / "voice.json"
    old = {x["file"]: x for x in json.loads(meta_f.read_text())["lines"]} if meta_f.exists() else {}
    todo, result = [], []
    for ln in lines:
        h = hashlib.sha1(f"{MODEL}|{voice}|{ln['say']}".encode()).hexdigest()[:10]
        f = f"{ln['i']:02d}-{h}.mp3"
        result.append({"i": ln["i"], "say": ln["say"], "file": f, "dur": old.get(f, {}).get("dur")})
        if not (out / f).exists() or f not in old:
            todo.append(result[-1])
    if todo:
        async with websockets.connect(f"wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model={MODEL}",
                                      additional_headers={"Authorization": f"Bearer {key()}"}, max_size=None) as ws:
            await ws.send(json.dumps({"event_id": "e" + uuid.uuid4().hex, "type": "session.update", "session": {
                "voice": voice, "mode": "commit", "response_format": "pcm", "sample_rate": 24000, "language_type": "Chinese"}}))
            for r in todo:
                r["dur"] = to_mp3(await synth(ws, r["say"]), out / r["file"])
                print(f"{r['i']:02d} {r['dur']:5.2f}s {r['say']}")
            await ws.send(json.dumps({"event_id": "e" + uuid.uuid4().hex, "type": "session.finish"}))
    if only is None:  # 全量时才清掉旧句子
        keep = {r["file"] for r in result}
        for p in out.glob("*.mp3"):
            if p.name not in keep:
                p.unlink()
    meta_f.write_text(json.dumps({"model": MODEL, "total": round(sum(r["dur"] for r in result), 2), "lines": result},
                                 ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"共 {len(result)} 句，{sum(r['dur'] for r in result):.1f} 秒；新配 {len(todo)} 句")


if __name__ == "__main__":
    if sys.argv[1:2] == ["--enroll"]:
        enroll(sys.argv[2])
    else:
        a = sys.argv[1:]
        asyncio.run(main(a[0], parse_only(a[a.index("--only") + 1]) if "--only" in a else None))
