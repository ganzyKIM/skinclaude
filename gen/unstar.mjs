#!/usr/bin/env node
// 컷아웃 PNG 에서 옷자락에 붙어 남은 제미나이 ✦ 워터마크를 지운다(despeck 은 떨어진 섬만 지운다). 파일을 제자리에서 고친다.
//   node gen/unstar.mjs <cut.png> [blue|green]   (배경 크로마: 초텐 blue, 아메 green — 반투명 흰 ✦ 가 그 색으로 물들어 남는다)
// 오른쪽 아래(워터마크 자리)에서 크로마 색이 도는 작은 덩어리를 ✦ 로 보고 지우고, 그 둘레의 반투명 그림자는
// 가장 가까운 불투명 픽셀이 ✦ 일 때만 지운다(옷의 그림자는 남긴다). 2026-10-06 성자 의상 첫 장에서 ✦ 가 옷자락 끝에 닿아 남았다.
import { createRequire } from 'node:module';
import sharp from './sharp.mjs';

const [file, chroma = 'blue'] = process.argv.slice(2);
// gray: ✦ 가 옷 위에 찍혀 회색으로 남은 경우(2026-10-06 아메 성자 컷 — 검은 로브 위 (113,111,118)). 지우지 않고 둘레 옷 색으로 덧칠한다
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
const at = (x, y) => (y * w + x) * 4;
const lum = (p) => (data[p] + data[p + 1] + data[p + 2]) / 3;
const around = (x, y) => { // 둘레(5px) 불투명 픽셀 밝기의 가운데값
  const v = [];
  for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4) continue;
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < w && ny < h && data[at(nx, ny) + 3] >= 250) v.push(lum(at(nx, ny)));
  }
  v.sort((m, n) => m - n); return v.length ? v[v.length >> 1] : 255;
};
const tinted = (p, x, y) => {
  const r = data[p], g = data[p + 1], b = data[p + 2];
  if (chroma === 'gray') return data[p + 3] >= 250 && Math.max(r, g, b) - Math.min(r, g, b) < 25 && lum(p) > 70 && lum(p) < 200 && lum(p) > around(x, y) + 30;
  return chroma === 'green' ? g > 120 && g > r + 50 && g > b + 40 : b > 120 && b > r + 50 && b > g + 40;
};
// 크로마 색이 도는 픽셀을 덩어리로 묶어, 오른쪽 아래의 작고(40px 안) 다부진(30px 넘는) 덩어리 가운데 구석에 가장 가까운 것을 ✦ 로 본다
// (리본·머리카락의 푸른 기는 길게 이어져 있어 걸러진다)
const cand = new Uint8Array(w * h);
for (let y = Math.floor(h * 0.7); y < h; y++) for (let x = Math.floor(w * 0.55); x < w; x++) if (data[at(x, y) + 3] > 40 && tinted(at(x, y), x, y)) cand[y * w + x] = 1;
const seen = new Uint8Array(w * h);
let best = null;
for (let s0 = 0; s0 < w * h; s0++) {
  if (!cand[s0] || seen[s0]) continue;
  const pts = [s0], stack = [s0]; seen[s0] = 1;
  while (stack.length) {
    const q = stack.pop(), x = q % w, y = (q / w) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy, r = ny * w + nx;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && cand[r] && !seen[r]) { seen[r] = 1; stack.push(r); pts.push(r); }
    }
  }
  const xs = pts.map((q) => q % w), ys = pts.map((q) => (q / w) | 0);
  const bx0 = Math.min(...xs), bx1 = Math.max(...xs), by0 = Math.min(...ys), by1 = Math.max(...ys);
  if (pts.length < (chroma === 'gray' ? 15 : 30) || bx1 - bx0 > 40 || by1 - by0 > 40) continue;
  const d = (w - (bx0 + bx1) / 2) ** 2 + (h - (by0 + by1) / 2) ** 2;
  if (!best || d < best.d) best = { pts, d, bx0, bx1, by0, by1 };
}
if (!best) { console.log(`${file}: ✦ 없음`); process.exit(0); }
const star = new Uint8Array(w * h);
for (const q of best.pts) star[q] = 1;
const n = best.pts.length, x0 = best.bx0, x1 = best.bx1, y0 = best.by0, y1 = best.by1;
if (chroma === 'gray') { // 옷 위의 회색 ✦: 둘레 3px 의 ✦ 아닌 불투명 픽셀 평균색으로 덧칠(✦ 의 흐릿한 가장자리까지 1px 넓혀서)
  const grow = new Uint8Array(w * h);
  for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) {
    let hit = false;
    for (let dy = -1; dy <= 1 && !hit; dy++) for (let dx = -1; dx <= 1; dx++) if (star[(y + dy) * w + x + dx]) { hit = true; break; }
    if (hit && data[at(x, y) + 3] >= 250) grow[y * w + x] = 1;
  }
  let sr = 0, sg = 0, sb = 0, sn = 0;
  for (let y = y0 - 4; y <= y1 + 4; y++) for (let x = x0 - 4; x <= x1 + 4; x++) {
    if (x < 0 || y < 0 || x >= w || y >= h || grow[y * w + x]) continue;
    const p = at(x, y); if (data[p + 3] < 250) continue;
    sr += data[p]; sg += data[p + 1]; sb += data[p + 2]; sn++;
  }
  let painted = 0;
  for (let q = 0; q < w * h; q++) if (grow[q]) { const p = q * 4; data[p] = sr / sn; data[p + 1] = sg / sn; data[p + 2] = sb / sn; painted++; }
  await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toFile(`${file}.tmp.png`);
  (await import('node:fs')).renameSync(`${file}.tmp.png`, file);
  console.log(`${file}: 옷 위 회색 ✦ ${n}px (${x0},${y0})~(${x1},${y1}) → 둘레 색으로 ${painted}px 덧칠`);
  process.exit(0);
}
const R = 12, near = (x, y, want) => { // want 1: ✦, 0: 그 밖의 불투명 픽셀 — 가장 가까운 거리²
  let best = Infinity;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const q = ny * w + nx, isStar = star[q] === 1, solid = data[q * 4 + 3] >= 250;
    if (want ? isStar : solid && !isStar) best = Math.min(best, dx * dx + dy * dy);
  }
  return best;
};
let cleared = 0;
for (let y = Math.max(0, y0 - R); y <= Math.min(h - 1, y1 + R); y++) for (let x = Math.max(0, x0 - R); x <= Math.min(w - 1, x1 + R); x++) {
  const p = at(x, y), a = data[p + 3];
  if (!a) continue;
  if (star[y * w + x] || (a < 250 && near(x, y, 1) < near(x, y, 0))) { data[p + 3] = 0; cleared++; }
}
for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (star[y * w + x]) data[at(x, y) + 3] = 0;
await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toFile(`${file}.tmp.png`);
const fs = await import('node:fs');
fs.renameSync(`${file}.tmp.png`, file);
console.log(`${file}: ✦ ${n}px (${x0},${y0})~(${x1},${y1}), 둘레까지 ${cleared}px 지움`);
