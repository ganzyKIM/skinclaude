#!/usr/bin/env node
// 제미나이 원본(raw)의 ✦ 워터마크를 거꾸로 섞어(reverse alpha blending) 지운다 — 캐릭터 옷 위에 찍혀 컷아웃 뒤에도 남는 경우용.
//   node gen/unmark.mjs <raw.png> [기준 raw]      → <raw> 를 고치고 원래 것은 <raw 이름>.orig.png 로 둔다
// 워터마크는 높이 1024 원본에서 오른쪽·아래 끝에서 75~111px 자리에 같은 모양으로 찍힌다(2026-10-06 실측: 617·572 폭 모두).
// 반투명 흰색이라 찍힌 색 = α·255 + (1−α)·원래 색. 평평한 크로마 배경 위에 찍힌 기준 원본에서 α 를 재고(배경 R·G 가 낮은 파란 배경),
// 원래 색 = (찍힌 색 − α·255) / (1 − α) 로 되돌린다. 2026-10-06 아메 성자 의상 첫 장에서 검은 로브 위에 회색 ✦ 가 남았다.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import sharp from './sharp.mjs';

const [file, ref = new URL('raw/choten_swim.png', import.meta.url).pathname] = process.argv.slice(2);
const OFF = 111, SIZE = 37; // 오른쪽·아래 끝에서 111px 안쪽부터 37px 정사각형
const load = async (f) => { const { data, info } = await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height }; };

const R = await load(ref);
const bgp = ((R.h - 4) * R.w + (R.w - 4)) * 3, bg = [R.data[bgp], R.data[bgp + 1], R.data[bgp + 2]];
const alpha = new Float32Array(SIZE * SIZE);
for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) {
  const p = ((R.h - OFF + j) * R.w + (R.w - OFF + i)) * 3;
  // 배경이 낮은 채널(R·G)로 잰다: 찍힌 값 = α·255 + (1−α)·배경
  const a = ((R.data[p] - bg[0]) / (255 - bg[0]) + (R.data[p + 1] - bg[1]) / (255 - bg[1])) / 2;
  alpha[j * SIZE + i] = Math.max(0, Math.min(0.95, a < 0.02 ? 0 : a));
}
const orig = file.replace(/\.png$/, '.orig.png');
if (!fs.existsSync(orig)) fs.copyFileSync(file, orig);
const T = await load(orig); // 늘 원래 것에서 시작한다(다시 돌려도 같은 결과)
if (T.h !== R.h) { console.log(`${file}: 높이가 기준(${R.h})과 달라(${T.h}) 하지 않음`); process.exit(1); }
// 폭이 다른 원본은 ✦ 자리가 1~2px 어긋날 수 있다(572 폭에서 가장자리에 호가 남았다) → 둘레 ±8px 를 옮겨 보며
// 되돌린 자리의 매끈함(이웃 픽셀 차이의 합)이 가장 작은 곳을 고른다
const fix = (dx, dy, apply) => {
  const out = new Float32Array(SIZE * SIZE * 3);
  for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) {
    const a = alpha[j * SIZE + i], p = ((T.h - OFF + j + dy) * T.w + (T.w - OFF + i + dx)) * 3;
    for (let c = 0; c < 3; c++) out[(j * SIZE + i) * 3 + c] = a ? Math.max(0, Math.min(255, (T.data[p + c] - a * 255) / (1 - a))) : T.data[p + c];
    if (apply && a) for (let c = 0; c < 3; c++) T.data[p + c] = Math.round(out[(j * SIZE + i) * 3 + c]);
  }
  let tv = 0;
  for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) for (let c = 0; c < 3; c++) {
    const v = out[(j * SIZE + i) * 3 + c];
    if (i + 1 < SIZE) tv += Math.abs(v - out[(j * SIZE + i + 1) * 3 + c]);
    if (j + 1 < SIZE) tv += Math.abs(v - out[((j + 1) * SIZE + i) * 3 + c]);
  }
  return tv;
};
// 기준과 폭이 같으면 자리도 같다. 폭이 다르면 ✦ 모양(α)을 이미지의 '둘레보다 밝은 정도'에 맞춰 보아(템플릿 매칭) 가장 잘 맞는 자리를 고른다.
// (처음엔 되돌린 자리의 매끈함으로 골랐는데, 무늬 있는 옷 위에서 -8,-8 처럼 엉뚱한 자리를 골라 검은 별 자국을 냈다 — 2026-10-06 아메 기쁨 컷)
const lumT = (x, y) => { const p = (y * T.w + x) * 3; return (T.data[p] + T.data[p + 1] + T.data[p + 2]) / 3; };
const hp = (x, y) => { // 둘레 9×9 평균보다 얼마나 밝은가
  let s = 0, n = 0;
  for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) { const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < T.w && yy < T.h) { s += lumT(xx, yy); n++; } }
  return lumT(x, y) - s / n;
};
const match = (dx, dy) => {
  let sc = 0;
  for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) {
    const a = alpha[j * SIZE + i]; if (!a) continue;
    const x = T.w - OFF + i + dx, y = T.h - OFF + j + dy;
    if (x >= 0 && y >= 0 && x < T.w && y < T.h) sc += a * hp(x, y);
  }
  return sc;
};
let pick = { tv: 0, dx: 0, dy: 0, score: match(0, 0) };
if (T.w !== R.w) for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++) { const sc = match(dx, dy); if (sc > pick.score) pick = { tv: 0, dx, dy, score: sc }; }
fix(pick.dx, pick.dy, true);
const changed = alpha.filter((a) => a).length;
await sharp(T.data, { raw: { width: T.w, height: T.h, channels: 3 } }).png().toFile(`${file}.tmp.png`);
fs.renameSync(`${file}.tmp.png`, file);
console.log(`${file}: ✦ ${changed}px 되돌림 (자리 ${pick.dx},${pick.dy}px 옮김, α 최대 ${Math.max(...alpha).toFixed(2)}, 원래 것은 ${orig})`);
