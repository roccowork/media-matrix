// 单镜头工具（方案第六 / 十二节：关键帧预览、确定性复现、配置校验）
//   node tools/shot.mjs validate shotconfigs/cosmos.blackhole.v1.json
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

const validate = (file) => {
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'schemas/shot.schema.json'), 'utf8'));
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ajv = new Ajv({allErrors: true});
  const ok = ajv.validate(schema, cfg);
  const errs = ok ? [] : ajv.errors.map((e) => `${e.instancePath || '/'} ${e.message}`);
  // 资产 id 必须在资产库里登记过
  const reg = fs.readFileSync(path.join(root, 'src/engine/assets/registry.ts'), 'utf8');
  const ids = [...reg.matchAll(/asset_id: '([^']+)'/g)].map((m) => m[1]);
  for (const a of cfg.assets ?? []) if (!ids.includes(a.id)) errs.push(`/assets 资产库里没有 ${a.id}`);
  // 关键帧时间递增、覆盖整段
  const keys = cfg.camera?.keys ?? [];
  for (let i = 1; i < keys.length; i++) if (keys[i].t <= keys[i - 1].t) errs.push(`/camera/keys/${i} 时间必须递增`);
  if (keys.length && keys[keys.length - 1].t < cfg.duration) errs.push(`/camera/keys 最后一个关键帧（${keys.at(-1).t}s）没覆盖到结尾（${cfg.duration}s）`);
  console.log(errs.length ? `✗ ${file}\n  ` + errs.join('\n  ') : `✓ ${file} 校验通过（资产参数范围在渲染时再按资产库校验一次）`);
  process.exitCode = errs.length ? 1 : 0;
};

const renderFrames = async (comp, frames, out) => {
  const {bundle} = await import('@remotion/bundler');
  const {renderStill, selectComposition} = await import('@remotion/renderer');
  const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.ts')});
  const browserExecutable = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
  const composition = await selectComposition({serveUrl, id: comp, browserExecutable});
  fs.mkdirSync(out, {recursive: true});
  const files = [];
  for (const f of frames) {
    const output = path.join(out, `${comp}-${f}.png`);
    const t0 = Date.now();
    await renderStill({serveUrl, composition, frame: f, output, browserExecutable, timeoutInMilliseconds: 900000, chromiumOptions: {gl}, onBrowserLog: (l) => { if (!l.text.includes('fonts.gstatic') && (process.env.SHOT_DEBUG || l.type === 'error' || l.text.includes('THREE'))) console.log('  [浏览器错误]', l.text.slice(0, 400)); }});
    console.log(`✓ ${output}（${((Date.now() - t0) / 1000).toFixed(0)} 秒）`);
    files.push(output);
  }
  return files;
};

const pixelHash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

if (cmd === 'validate') validate(a1);
else if (cmd === 'keyframes') await renderFrames(a1, a2.split(',').map(Number), a3 ?? path.join(root, 'out/keyframes'));
else if (cmd === 'determinism') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'det-'));
  const [x] = await renderFrames(a1, [Number(a2)], path.join(dir, 'a'));
  const [y] = await renderFrames(a1, [Number(a2)], path.join(dir, 'b'));
  const same = pixelHash(x) === pixelHash(y);
  console.log(same ? `✓ 确定性：${a1} 第 ${a2} 帧两次渲染逐字节一致` : `✗ 确定性：两次渲染不一致（${x} vs ${y}）`);
  process.exitCode = same ? 0 : 1;
} else console.log('用法见文件开头注释');
