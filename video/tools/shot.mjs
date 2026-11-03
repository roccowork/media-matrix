// 单镜头工具（方案第六 / 十二节：关键帧预览、确定性复现、配置校验）
//   node tools/shot.mjs validate shotconfigs/cosmos.blackhole.v1.json
//   node tools/shot.mjs validate-storyboard storyboards/<id>/storyboard.json   分镜校验（时长、旁白语速、资产、渲染器能力、版本、示意）
//   node tools/shot.mjs catalog [输出.json]                                    导出资产目录（给 AI 分镜用）
//   node tools/shot.mjs storyboard-preview storyboards/<id>/storyboard.json   镜头预览：每镜中间一帧 + 总览图 preview/preview.jpg
//   node tools/shot.mjs storyboard-shot storyboards/<id>/storyboard.json 5 [帧号,帧号]   单镜头重渲染（只渲第 5 镜）
//   node tools/shot.mjs keyframes Shot-BlackHole 0,200,330,440 [输出目录] [--gl=angle]
//   node tools/shot.mjs determinism Shot-BlackHole 330 [--gl=angle]   同一帧渲染两次，逐像素比对
// 云端会话没有显卡：--gl=swangle（默认）；在有显卡的笔记本上用 --gl=angle，快很多。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import Ajv from 'ajv';

const [cmd, a1, a2, a3] = process.argv.slice(2).filter((x) => !x.startsWith('--'));
const gl = (process.argv.find((x) => x.startsWith('--gl=')) ?? '--gl=swangle').slice(5);
const root = path.dirname(new URL(import.meta.url).pathname) + '/..';

// ---------- 资产库（从 registry.ts 解析；资产目录导出、参数 / 能力校验共用） ----------
const loadRegistry = () => {
  const reg = fs.readFileSync(path.join(root, 'src/engine/assets/registry.ts'), 'utf8');
  const out = {};
  const starts = [...reg.matchAll(/asset_id: '([^']+)'/g)];
  for (const m of starts) {
    const block = reg.slice(m.index, reg.indexOf('\n  },\n', m.index));
    const str = (k) => (block.match(new RegExp(`^ {4}${k}: '((?:[^'\\\\]|\\\\.)*)'`, 'm')) ?? [])[1];
    const params = {};
    for (const p of block.matchAll(/^ {6}(\w+): \{type: '(\w+)', default: (.*?), (?:min: (-?[\d.]+), max: (-?[\d.]+), )?desc: '((?:[^'\\]|\\.)*)'\}/gm))
      params[p[1]] = {type: p[2], default: JSON.parse(p[3].replace(/'/g, '"')), ...(p[4] !== undefined ? {min: Number(p[4]), max: Number(p[5])} : {}), desc: p[6]};
    const rr = {};
    const rrm = block.match(/real_range: \{([^}]*)\}/);
    if (rrm) for (const q of rrm[1].matchAll(/(\w+): \[(-?[\d.]+), (-?[\d.]+)\]/g)) rr[q[1]] = [Number(q[2]), Number(q[3])];
    const presets = (block.match(/camera_presets: \[([^\]]*)\]/) ?? [, ''])[1].match(/'([^']*)'/g)?.map((x) => x.slice(1, -1)) ?? [];
    out[m[1]] = {
      id: m[1], name: str('asset_name'), category: str('category'), kind: str('kind'), renderer: str('renderer'), version: str('version'),
      params, camera_presets: presets, notes: str('notes'), no_dof: /^ {4}no_dof: true/m.test(block), real_range: rr,
    };
  }
  return out;
};

const ENGINE_MAJOR = 1; // ShotConfig 主版本号；引擎不兼容升级时改这里
const POST_BLENDER = ['tone', 'vignette', 'grain']; // Blender 镜头的 post 只在 Remotion 里叠暗角 / 颗粒（色调由 Blender AgX 负责）

// 校验一个 ShotConfig（对象），返回错误列表；at = 错误路径前缀。notes：该镜的 note（示意参数要写）
const validateShot = (cfg, reg, at = '', note = '') => {
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'schemas/shot.schema.json'), 'utf8'));
  const ajv = new Ajv({allErrors: true});
  const errs = ajv.validate(schema, cfg) ? [] : ajv.errors.map((e) => `${at}${e.instancePath || '/'} ${e.message}`);
  // 版本
  const major = Number(String(cfg.version ?? '').split('.')[0]);
  if (major !== ENGINE_MAJOR) errs.push(`${at}/version ${cfg.version} 与引擎配置主版本 ${ENGINE_MAJOR} 不兼容`);
  // 关键帧时间递增、覆盖整段
  const keys = cfg.camera?.keys ?? [];
  for (let i = 1; i < keys.length; i++) if (keys[i].t <= keys[i - 1].t) errs.push(`${at}/camera/keys/${i} 时间必须递增`);
  if (keys.length && keys[keys.length - 1].t < cfg.duration) errs.push(`${at}/camera/keys 最后一个关键帧（${keys.at(-1).t}s）没覆盖到结尾（${cfg.duration}s）`);
  (cfg.assets ?? []).forEach((a, i) => {
    const A = reg[a.id];
    if (!A) { errs.push(`${at}/assets/${i} 资产库里没有 ${a.id}`); return; }
    // 渲染器能力
    if (A.renderer !== cfg.renderer) errs.push(`${at}/assets/${i} ${a.id} 是 ${A.renderer} 资产，不能放进 renderer = ${cfg.renderer} 的镜头`);
    if (A.no_dof && cfg.post?.dof) errs.push(`${at}/post/dof ${a.id} 是加色、不写深度的资产，开 dof 会把整张图一起虚化`);
    // 参数类型 / 范围
    for (const [k, v] of Object.entries(a.params ?? {})) {
      const sp = A.params[k];
      const pa = `${at}/assets/${i}/params/${k}`;
      if (!sp) { errs.push(`${pa} 资产库里 ${a.id} 没有这个参数`); continue; }
      if (sp.type === 'number' && (typeof v !== 'number' || v < sp.min || v > sp.max)) errs.push(`${pa} = ${v}，应在 ${sp.min}–${sp.max}`);
      if (sp.type === 'boolean' && typeof v !== 'boolean') errs.push(`${pa} 应为 true / false`);
      if (sp.type === 'color' && !/^#[0-9a-fA-F]{6}$/.test(v)) errs.push(`${pa} 应为 #rrggbb 颜色`);
      if (sp.type === 'vec3' && !(Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number'))) errs.push(`${pa} 应为 [x, y, z]`);
      if (sp.type === 'seed' && !['string', 'number'].includes(typeof v)) errs.push(`${pa} 种子只接受字符串或数字`);
      // 真实比例：超出正常范围的「示意」值必须在 note 里写明（《方案补充》#12 #14）
      const rr = A.real_range[k];
      if (rr && typeof v === 'number' && (v < rr[0] || v > rr[1]) && !/示意|慢放/.test(note)) errs.push(`${pa} = ${v} 超出真实范围 ${rr[0]}–${rr[1]}，note 里要写「示意」或「慢放」`);
    }
    // 没写的参数用默认值，默认值也要过真实比例检查
    for (const [k, rr] of Object.entries(A.real_range)) if (!(k in (a.params ?? {}))) {
      const d = A.params[k]?.default;
      if (typeof d === 'number' && (d < rr[0] || d > rr[1]) && !/示意|慢放/.test(note)) errs.push(`${at}/assets/${i}/params/${k} 默认值 ${d} 超出真实范围 ${rr[0]}–${rr[1]}，note 里要写「示意」或「慢放」`);
    }
  });
  if (cfg.renderer === 'blender') {
    if ((cfg.assets ?? []).length !== 1) errs.push(`${at}/assets Blender 镜头只能有一个资产`);
    for (const k of Object.keys(cfg.post ?? {})) if (!POST_BLENDER.includes(k)) errs.push(`${at}/post/${k} Blender 镜头不支持（只支持 ${POST_BLENDER.join(' / ')}）`);
  }
  return errs;
};

const validate = (file) => {
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  // 单镜验收配置没有 note 字段：示意值写在 cfg.note（可选）
  const errs = validateShot(cfg, loadRegistry(), '', cfg.note ?? '');
  console.log(errs.length ? `✗ ${file}\n  ` + errs.join('\n  ') : `✓ ${file} 校验通过（Schema + 资产库登记 + 参数类型 / 范围 + 渲染器能力 + 版本）`);
  process.exitCode = errs.length ? 1 : 0;
};

// ---------- 分镜 ----------
const SB = {minShot: 3, maxShot: 8, minTotal: 60, maxTotal: 90, maxCharsPerSec: 5}; // 《方案补充》#15；中文旁白约 4–5 字 / 秒
const narrationChars = (t) => [...(t ?? '')].filter((c) => /[\p{L}\p{N}]/u.test(c)).length;
const validateStoryboard = (file, quiet = false) => {
  const sb = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ajv = new Ajv({allErrors: true});
  ajv.addSchema(JSON.parse(fs.readFileSync(path.join(root, 'schemas/shot.schema.json'), 'utf8')));
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'schemas/storyboard.schema.json'), 'utf8'));
  const errs = ajv.validate(schema, sb) ? [] : ajv.errors.map((e) => `${e.instancePath || '/'} ${e.message}`);
  if (!errs.length) {
    const reg = loadRegistry();
    let total = 0;
    sb.shots.forEach((s, i) => {
      const at = `/shots/${i}`;
      const d = s.config.duration;
      total += d;
      if (s.n !== i + 1) errs.push(`${at}/n 镜号应为 ${i + 1}（按顺序编号）`);
      if (d < SB.minShot || d > SB.maxShot) errs.push(`${at}/config/duration ${d}s，每镜应在 ${SB.minShot}–${SB.maxShot} 秒`);
      if (s.config.fps !== sb.fps) errs.push(`${at}/config/fps ${s.config.fps} 与分镜 fps ${sb.fps} 不一致`);
      const rate = narrationChars(s.narration) / d;
      if (rate > SB.maxCharsPerSec) errs.push(`${at}/narration ${narrationChars(s.narration)} 字 / ${d} 秒 = ${rate.toFixed(1)} 字每秒，超过 ${SB.maxCharsPerSec}（念不完）`);
      errs.push(...validateShot(s.config, reg, `${at}/config`, s.note ?? ''));
    });
    if (total < SB.minTotal || total > SB.maxTotal) errs.push(`/shots 总时长 ${total} 秒，应在 ${SB.minTotal}–${SB.maxTotal} 秒`);
  }
  if (!quiet) console.log(errs.length ? `✗ ${file}（${errs.length} 处问题）\n  ` + errs.join('\n  ') : `✓ ${file} 分镜校验通过（${sb.shots.length} 镜，${sb.shots.reduce((a, s) => a + s.config.duration, 0)} 秒）`);
  process.exitCode = errs.length ? 1 : 0;
  return errs;
};

// 资产目录：给模型看的（只含模型需要的信息）
const catalog = (out) => {
  const reg = loadRegistry();
  // 每个资产附一个参考镜头（资产验收配置：相机距离、后期、参数怎么写），给模型照着写
  const examples = {};
  for (const f of fs.readdirSync(path.join(root, 'shotconfigs'))) {
    const c = JSON.parse(fs.readFileSync(path.join(root, 'shotconfigs', f), 'utf8'));
    for (const x of c.assets ?? []) if (!examples[x.id]) examples[x.id] = {renderer: c.renderer, style: c.style, camera: c.camera, post: c.post, assets: c.assets, note: c.note};
  }
  const list = Object.values(reg).filter((a) => a.kind === 'procedural' || a.renderer === 'blender').map((a) => ({
    id: a.id, name: a.name, category: a.category, renderer: a.renderer, version: a.version, camera_presets: a.camera_presets,
    no_dof: a.no_dof || undefined, real_range: Object.keys(a.real_range).length ? a.real_range : undefined, notes: a.notes, params: a.params,
    example_shot: examples[a.id],
  }));
  const json = JSON.stringify({engine_major: ENGINE_MAJOR, blender_post: POST_BLENDER, storyboard_rules: SB, assets: list}, null, 1);
  if (out) { fs.writeFileSync(out, json); console.log(`✓ 资产目录 ${list.length} 个 → ${out}`); } else console.log(json);
};

const renderFrames = async (comp, frames, out, inputProps = undefined, name = comp) => {
  const {bundle} = await import('@remotion/bundler');
  const {renderStill, selectComposition} = await import('@remotion/renderer');
  const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.ts')});
  const browserExecutable = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
  const composition = await selectComposition({serveUrl, id: comp, browserExecutable, inputProps});
  fs.mkdirSync(out, {recursive: true});
  const files = [];
  for (const f of frames) {
    const output = path.join(out, `${name}-${f}.png`);
    const t0 = Date.now();
    await renderStill({serveUrl, composition, frame: f, output, browserExecutable, inputProps, timeoutInMilliseconds: 900000, chromiumOptions: {gl}, onBrowserLog: (l) => { if (!l.text.includes('fonts.gstatic') && (process.env.SHOT_DEBUG || l.type === 'error' || l.text.includes('THREE'))) console.log('  [浏览器错误]', l.text.slice(0, 400)); }});
    console.log(`✓ ${output}（${((Date.now() - t0) / 1000).toFixed(0)} 秒）`);
    files.push(output);
  }
  return files;
};

const pixelHash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

if (cmd === 'validate') validate(a1);
else if (cmd === 'validate-storyboard') validateStoryboard(a1);
else if (cmd === 'catalog') catalog(a1);
else if (cmd === 'keyframes') await renderFrames(a1, a2.split(',').map(Number), a3 ?? path.join(root, 'out/keyframes'));
else if (cmd === 'determinism') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'det-'));
  const [x] = await renderFrames(a1, [Number(a2)], path.join(dir, 'a'));
  const [y] = await renderFrames(a1, [Number(a2)], path.join(dir, 'b'));
  const same = pixelHash(x) === pixelHash(y);
  console.log(same ? `✓ 确定性：${a1} 第 ${a2} 帧两次渲染逐字节一致` : `✗ 确定性：两次渲染不一致（${x} vs ${y}）`);
  process.exitCode = same ? 0 : 1;
} else if (cmd === 'storyboard-preview') {
  // 镜头预览：先校验，再每镜渲中间一帧（叠镜号 + 旁白），最后拼成一张总览图
  if (validateStoryboard(a1).length) process.exit(1);
  const sb = JSON.parse(fs.readFileSync(a1, 'utf8'));
  const out = a2 ?? path.join(path.dirname(a1), 'preview');
  const files = [];
  for (const s of sb.shots) {
    const mid = Math.floor((s.config.duration * sb.fps) / 2);
    const [f] = await renderFrames('SB-Shot', [mid], out, {config: s.config, n: s.n, narration: s.narration, note: s.note, annotate: true}, `shot${String(s.n).padStart(2, '0')}`);
    files.push(f);
  }
  const sheet = path.join(out, 'preview.jpg');
  const {execFileSync} = await import('node:child_process');
  execFileSync('python3', [path.join(root, 'tools/storyboard_sheet.py'), sheet, sb.title, ...files], {stdio: 'inherit'});
} else if (cmd === 'storyboard-shot') {
  // 单镜头重渲染：只渲第 n 镜的指定帧（默认首 / 中 / 尾），不动其他镜
  const sb = JSON.parse(fs.readFileSync(a1, 'utf8'));
  const s = sb.shots.find((x) => x.n === Number(a2));
  if (!s) { console.log(`✗ 没有第 ${a2} 镜`); process.exit(1); }
  const errs = validateShot(s.config, loadRegistry(), `/shots/${s.n - 1}/config`, s.note ?? '');
  if (errs.length) { console.log('✗ ' + errs.join('\n  ')); process.exit(1); }
  const last = Math.round(s.config.duration * sb.fps) - 1;
  const frames = a3 ? a3.split(',').map(Number) : [0, Math.floor(last / 2), last];
  await renderFrames('SB-Shot', frames, path.join(path.dirname(a1), 'preview'), {config: s.config, n: s.n, narration: s.narration, note: s.note, annotate: false}, `shot${String(s.n).padStart(2, '0')}`);
} else console.log('用法见文件开头注释');
