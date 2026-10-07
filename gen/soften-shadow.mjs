// 컷에 구워진 드롭섀도를 텍스트게임 초기 원본 컷(REFS) 수준으로 옅게 만든다. 계산은 shadow-lib.mjs.
//   node gen/soften-shadow.mjs          → overlay/assets/char 전체 적용(처음 한 번 gen/backup/char-before-shadow 에 백업)
//   node gen/soften-shadow.mjs --check  → 컷마다 바뀔 픽셀 수와 거리별 농도만 출력
//   node gen/soften-shadow.mjs --out DIR → 결과를 DIR 에만 써서 미리 본다
// 캐릭터(알파 250 이상)와 1px 가장자리는 그대로이고, 다시 돌려도 결과가 같다. 텍스트게임에서 컷을 새로 가져오면 다시 돌린다.
import { createRequire } from 'node:module';
import { readdirSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { edt, bodyMask, profile, soften, averageProfile } from './shadow-lib.mjs';
import sharp from './sharp.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const CHAR = ROOT + 'overlay/assets/char/', BACKUP = ROOT + 'gen/backup/char-before-shadow/';
// 텍스트게임 92d9766 의 처음 컷들 — 사용자가 "딱 좋다"고 한 그림자 농도
const REFS = ['choten_default', 'choten_angry', 'choten_dere', 'choten_peace', 'choten_vape',
  'ame_default', 'ame_dere', 'ame_drug', 'ame_smoking', 'ame_yandere'];
const check = process.argv.includes('--check');
const outIdx = process.argv.indexOf('--out'), OUT = outIdx > 0 ? process.argv[outIdx + 1].replace(/\/?$/, '/') : null;

async function load(name) {
  const { data, info } = await sharp(CHAR + name + '.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}
const fmt = (p) => p.slice(2, 10).map((v) => String(Math.round(v)).padStart(3)).join(' ');

const target = averageProfile(await Promise.all(REFS.map(async (n) => {
  const { data, w, h } = await load(n);
  return profile(data, edt(bodyMask(data, w, h), w, h), w, h);
})));
console.log('목표 농도(2~9px)'.padEnd(26), fmt(target));

// 기준 컷은 그대로 둔다
const names = readdirSync(CHAR).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)).filter((n) => !REFS.includes(n)).sort();
if (OUT) mkdirSync(OUT, { recursive: true });
if (!check && !OUT && !existsSync(BACKUP)) {
  mkdirSync(BACKUP, { recursive: true });
  for (const f of readdirSync(CHAR).filter((f) => f.endsWith('.png'))) copyFileSync(CHAR + f, BACKUP + f);
  console.log('백업:', BACKUP);
}
let touched = 0;
for (const n of names) {
  const { data, w, h } = await load(n);
  const r = soften({ data, w, h, target });
  if (!r.changed) continue;
  touched++;
  console.log(n.padEnd(26), fmt(r.before), '→', fmt(r.after), ` (${r.changed}px)`);
  if (!check) await sharp(r.data, { raw: { width: w, height: h, channels: 4 } }).png({ compressionLevel: 9 }).toFile((OUT || CHAR) + n + '.png');
}
console.log(`${check ? '바뀔' : '바꾼'} 컷 ${touched} / ${names.length}`);
