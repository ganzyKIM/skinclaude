// 표정 컷 크기 보정: 세트(폼×의상)마다 기본 컷에 맞춰 캐릭터 키·발끝·발 중심을 맞춘다. 계산은 normalize-lib.mjs.
//   node gen/normalize.mjs          → overlay/assets/char 전체 보정(원본은 gen/orig 에 백업, 다시 돌려도 같은 결과)
//   node gen/normalize.mjs --check  → 바꿀 컷과 확대율·이동량만 출력
// 새 컷을 assets/char 에 넣은 뒤(ingest.sh 는 자동으로) 다시 돌리면 된다.
// 원본 판단: gen/orig/manifest.json 에 적힌 결과 해시와 지금 파일이 같으면 gen/orig 의 원본에서 다시 계산하고,
//   다르면(새로 만들거나 바꾼 컷) 지금 파일을 새 원본으로 백업한다.
// 기준 컷(<form>_default, <form>_<의상>)은 크기를 바꾸지 않고, 폼의 좌우 여백이 모자라면(초텐의 리본 머리) 폼의 모든 컷을
//   양옆으로 같은 만큼 넓힌다. 화면에선 높이(300px)로 크기가 정해지므로 캐릭터 크기는 그대로다.
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { measure, plan, isNoop, placement, sidePad } from './normalize-lib.mjs';
import sharp from './sharp.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const CHAR = ROOT + 'overlay/assets/char/', ORIG = ROOT + 'gen/orig/', MANIFEST = ORIG + 'manifest.json';
const COSTUMES = ['kimono', 'bunny', 'pajama', 'casual', 'summer', 'lounge', 'knit', 'nurse', 'swim'];
const check = process.argv.includes('--check');

const md5 = (buf) => createHash('md5').update(buf).digest('hex');
const formOf = (name) => name.split('_')[0];
const refOf = (name) => { const [form, second] = name.split('_'); return COSTUMES.includes(second) ? `${form}_${second}` : `${form}_default`; };
async function metrics(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { m: measure({ data, width: info.width, height: info.height, channels: info.channels }), W: info.width, H: info.height };
}
async function render(c, W, p) {
  const pl = placement({ srcW: c.W, srcH: c.H, W, H: c.H }, p.scale, p.left, p.top);
  const scaled = p.scale === 1 ? c.src : await sharp(c.src).resize(pl.scaledW, pl.scaledH, { kernel: 'lanczos3' }).png().toBuffer();
  const piece = await sharp(scaled).extract(pl.extract).png().toBuffer();
  return sharp({ create: { width: W, height: c.H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: piece, left: pl.at.left, top: pl.at.top }]).png().toBuffer();
}

mkdirSync(ORIG, { recursive: true });
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const names = readdirSync(CHAR).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)).sort();

// 1) 컷마다 원본을 정하고 잰다
const cuts = {};
for (const name of names) {
  const cur = readFileSync(CHAR + name + '.png');
  const fromOrig = manifest[name]?.out === md5(cur) && existsSync(ORIG + name + '.png');
  const src = fromOrig ? readFileSync(ORIG + name + '.png') : cur;
  cuts[name] = { cur, fromOrig, src, ...(await metrics(src)) };
}
const hasRef = (name) => name !== refOf(name) && cuts[refOf(name)];

// 2) 폼마다 양옆을 얼마나 넓힐지(모든 컷이 좌우까지 맞는 최소값)
const pads = {};
for (const form of new Set(names.map(formOf))) {
  const bySet = {};
  for (const n of names.filter((n) => formOf(n) === form && hasRef(n))) (bySet[refOf(n)] ??= []).push(cuts[n].m);
  const sets = Object.entries(bySet).map(([ref, ms]) => ({ ref: cuts[ref].m, cuts: ms }));
  pads[form] = sidePad(sets, { width: cuts[`${form}_default`]?.W ?? 400 });
}
console.log('양옆 여백:', Object.entries(pads).map(([f, e]) => `${f} ${e}px`).join(', '));

// 3) 그리고 바뀐 것만 쓴다
let changed = 0, same = 0;
const notes = [];
for (const name of names) {
  const c = cuts[name], e = pads[formOf(name)], W = c.W + 2 * e;
  const p = hasRef(name)
    ? plan(c.m, { ...cuts[refOf(name)].m, fx: cuts[refOf(name)].m.fx + e }, { width: W })
    : { scale: 1, left: e, top: 0, clamped: false, offCenter: 0 }; // 기준 컷: 양옆만 넓힌다
  const out = W === c.W && isNoop(p) ? c.src : await render(c, W, p);
  if (md5(out) === md5(c.cur)) { same++; continue; }
  if (p.clamped) notes.push(`${name}(틀에 맞춰 덜 키움)`);
  if (p.offCenter > 1) notes.push(`${name}(좌우 ${p.offCenter.toFixed(0)}px 덜 옮김)`);
  console.log(`${check ? '[바꿀 것]' : '[보정]'} ${name.padEnd(24)} ×${p.scale.toFixed(3)}  이동 ${(p.left - e).toFixed(1)}, ${p.top.toFixed(1)}  폭 ${W}`);
  changed++;
  if (check) continue;
  if (!c.fromOrig) copyFileSync(CHAR + name + '.png', ORIG + name + '.png');
  writeFileSync(CHAR + name + '.png', out);
  manifest[name] = { out: md5(out), scale: +p.scale.toFixed(4), left: +p.left.toFixed(1), top: +p.top.toFixed(1), width: W };
}
if (!check) writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
console.log(`${check ? '바꿀 컷' : '보정한 컷'} ${changed}장, 이미 맞는 컷 ${same}장${notes.length ? `\n덜 맞춘 컷: ${notes.join(' ')}` : ''}`);
