#!/usr/bin/env node
// 컷아웃 PNG 에서 캐릭터 본체와 떨어진 작은 알파 섬(제미나이 ✦ 워터마크 등)을 지운다. 파일을 제자리에서 고친다.
//   node gen/despeck.mjs gen/cut/*.png
// txtgame 의 sharp 를 빌려 쓴다.
import { createRequire } from 'node:module';
import sharp from './sharp.mjs';

const MIN_KEEP = 0.02; // 가장 큰 덩어리 대비 이 비율보다 작고, 오른쪽 아래 구석(워터마크 자리)에 있는 섬만 제거

for (const file of process.argv.slice(2)) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const label = new Int32Array(w * h).fill(-1);
  const sizes = [], sx = [], sy = [];
  const stack = [];
  for (let p = 0; p < w * h; p++) {
    if (label[p] !== -1 || data[p * 4 + 3] < 16) continue;
    const id = sizes.length; let n = 0, ax = 0, ay = 0;
    label[p] = id; stack.push(p);
    while (stack.length) {
      const q = stack.pop(); n++;
      const x = q % w, y = (q / w) | 0; ax += x; ay += y;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { // 2px 틈까지는 같은 덩어리
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const r = ny * w + nx;
        if (label[r] === -1 && data[r * 4 + 3] >= 16) { label[r] = id; stack.push(r); }
      }
    }
    sizes.push(n); sx.push(ax / n); sy.push(ay / n);
  }
  const max = Math.max(...sizes);
  let removed = 0;
  for (let p = 0; p < w * h; p++) {
    const id = label[p];
    if (id >= 0 && sizes[id] < max * MIN_KEEP && sx[id] > w * 0.6 && sy[id] > h * 0.75) { data[p * 4 + 3] = 0; removed++; }
  }
  // 알파가 16 미만이라 라벨이 없는 옅은 그림자 픽셀 중, 지운 섬 근처의 것도 정리
  if (removed) {
    for (let p = 0; p < w * h; p++) {
      if (label[p] !== -1 || data[p * 4 + 3] === 0) continue;
      const x = p % w, y = (p / w) | 0; if (x <= w * 0.6 || y <= h * 0.75) continue; let nearMain = false;
      for (let dy = -3; dy <= 3 && !nearMain; dy++) for (let dx = -3; dx <= 3; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const id = label[ny * w + nx]; if (id >= 0 && sizes[id] >= max * MIN_KEEP) { nearMain = true; break; }
      }
      if (!nearMain) data[p * 4 + 3] = 0;
    }
  }
  await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toFile(file + '.tmp');
  const { renameSync } = await import('node:fs'); renameSync(file + '.tmp', file);
  console.log(`${file.split('/').pop()}: ${sizes.length} islands, removed ${removed}px`);
}
