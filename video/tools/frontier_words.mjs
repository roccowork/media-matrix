// 配音逐字时间戳（ElevenLabs）→ 逐词字幕（给 captions-themes 用）。中文用 Intl.Segmenter 分词，按标点断行
// 用法：node tools/frontier_words.mjs public/frontier/2026-11-01/voice.json src/frontier/episodes/2026-11-01.words.ts
import fs from "node:fs";
const [src, out] = process.argv.slice(2);
const a = JSON.parse(fs.readFileSync(src, "utf8")).raw_alignment;
const chars = a.characters, st = a.character_start_times_seconds, en = a.character_end_times_seconds;
const text = chars.join("");
const seg = new Intl.Segmenter("zh", { granularity: "word" });
const lines = [];
let words = [];
let pos = 0;
for (const { segment, isWordLike } of seg.segment(text)) {
  const i0 = pos, i1 = pos + segment.length - 1;
  pos += segment.length;
  if (/^[，。；：！？,.;:!?]$/.test(segment)) {
    if (words.length) lines.push({ words }), (words = []);
    continue;
  }
  if (!isWordLike || !segment.trim()) continue;
  words.push({ text: segment.trim(), start: +st[i0].toFixed(3), end: +en[i1].toFixed(3) });
}
if (words.length) lines.push({ words });
fs.writeFileSync(out, `// 自动生成（tools/frontier_words.mjs），不要手改\nimport type { CaptionsData } from "../../vendor/captions-themes/types";\n\nexport const words: CaptionsData = ${JSON.stringify({ lines })};\n`);
console.log(lines.length, "lines;", lines.slice(0, 3).map((l) => l.words.map((w) => w.text).join("|")).join(" / "));
