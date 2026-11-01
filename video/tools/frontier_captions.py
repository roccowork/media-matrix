"""把 ElevenLabs 的逐字时间戳（voice.json）转成字幕数据：按标点断成短句，每个字带开始时间，用来做逐字高亮。
用法：python3 tools/frontier_captions.py public/frontier/2026-11-01/voice.json src/frontier/episodes/2026-11-01.captions.ts
"""
import json
import sys

src, out = sys.argv[1], sys.argv[2]
a = json.load(open(src))["raw_alignment"]
chars, starts, ends = a["characters"], a["character_start_times_seconds"], a["character_end_times_seconds"]
BREAK = "，。；：！？"
phrases, cur = [], []
for c, s, e in zip(chars, starts, ends):
    cur.append({"c": c, "t": round(s, 3)})
    if c in BREAK:
        phrases.append(cur)
        cur = []
if cur:
    phrases.append(cur)
caps = []
for i, p in enumerate(phrases):
    text = "".join(x["c"] for x in p).strip()
    start = p[0]["t"]
    end = phrases[i + 1][0]["t"] if i + 1 < len(phrases) else ends[-1] + 0.4
    # 句末标点不显示（逗号、句号留在画面上很碍眼），问号叹号保留
    shown = [x for x in p if x["c"] not in "，。；："]
    caps.append({"start": start, "end": round(end, 3), "text": text, "chars": shown})
with open(out, "w") as f:
    f.write("// 自动生成（tools/frontier_captions.py），不要手改\n")
    f.write("import type { Caption } from \"../types\";\n\n")
    f.write(f"export const captions: Caption[] = {json.dumps(caps, ensure_ascii=False)};\n")
    f.write(f"export const voiceDuration = {round(ends[-1], 3)};\n")
print(len(caps), "phrases, voice", ends[-1], "s")
