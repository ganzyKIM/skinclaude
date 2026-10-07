// shadow-lib.mjs — 컷에 구워진 그림자만 원본 농도로 옅게 만드는 계산 (node --test "gen/test/*.test.mjs")
import test from 'node:test';
import assert from 'node:assert/strict';
import { edt, bodyMask, profile, factors, soften, isShadowColor, MAX_D } from '../shadow-lib.mjs';

// W×H 투명 격자: 가운데 불투명 사각형(몸) + 주어진 픽셀들
function img(W, H, body, pixels = []) {
  const data = Buffer.alloc(W * H * 4);
  const [x0, y0, x1, y1] = body;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) data.set([200, 150, 220, 255], (y * W + x) * 4);
  for (const [x, y, rgba] of pixels) data.set(rgba, (y * W + x) * 4);
  return data;
}

test('거리 변환은 몸에서의 유클리드 거리를 낸다', () => {
  const mask = new Uint8Array(25); mask[12] = 1; // 5×5 가운데
  const d = edt(mask, 5, 5);
  assert.equal(d[12], 0);
  assert.equal(d[13], 1);
  assert.ok(Math.abs(d[18] - Math.SQRT2) < 1e-9);
  assert.equal(d[14], 2);
  assert.ok(Math.abs(d[0] - Math.sqrt(8)) < 1e-9);
});

test('몸이 없으면 거리는 무한대', () => {
  assert.equal(edt(new Uint8Array(9), 3, 3)[4], Infinity);
});

test('그림자 색은 검정~남색만, 머리카락 끝 같은 밝거나 붉은 색은 아니다', () => {
  assert.ok(isShadowColor(0, 0, 0) && isShadowColor(21, 20, 37));
  assert.ok(!isShadowColor(255, 180, 220) && !isShadowColor(60, 20, 30) && !isShadowColor(40, 10, 10));
});

test('배율은 1px 가장자리에서 1, 그 밖은 목표/현재이고 늘리지는 않는다', () => {
  const F = factors([0, 190, 120, 90, 10, 0], [0, 170, 45, 30, 20, 0]);
  assert.deepEqual(F, [1, 1, 45 / 120, 30 / 90, 1, 1]);
});

test('목표와 10% 안쪽 차이는 반올림 오차로 보고 그대로 둔다', () => {
  assert.deepEqual(factors([0, 0, 26, 40], [0, 0, 25, 30]), [1, 1, 1, 30 / 40]);
});

test('그림자 색 반투명 픽셀만 거리 배율로 줄고, 몸·가장자리·밝은 반투명 픽셀은 그대로다', () => {
  const W = 30, H = 30;
  const shadow = [21, 20, 37, 120], tip = [255, 190, 230, 120];
  const data = img(W, H, [10, 10, 19, 19], [
    [20, 15, shadow],          // 거리 1 — 가장자리
    [22, 15, shadow],          // 거리 3 — 그림자
    [15, 22, tip],             // 거리 3 — 밝은 머리카락 끝
  ]);
  const target = new Array(MAX_D + 1).fill(0);
  const { data: out, changed } = soften({ data, w: W, h: H, target });
  assert.equal(changed, 1);
  const at = (x, y) => [...out.subarray((y * W + x) * 4, (y * W + x) * 4 + 4)];
  assert.deepEqual(at(22, 15), [21, 20, 37, 0]);     // 목표 농도 0 → 사라짐
  assert.deepEqual(at(20, 15), shadow);
  assert.deepEqual(at(15, 22), tip);
  for (let y = 10; y <= 19; y++) for (let x = 10; x <= 19; x++) assert.deepEqual(at(x, y), [200, 150, 220, 255]);
});

test('목표보다 옅은 그림자는 그대로 두고, 다시 돌려도 결과가 같다', () => {
  const W = 30, H = 30;
  const data = img(W, H, [10, 10, 19, 19], [[22, 15, [0, 0, 0, 40]], [23, 15, [0, 0, 0, 20]]]);
  const dist = edt(bodyMask(data, W, H), W, H);
  const target = profile(data, dist, W, H).map((v) => v * 2);
  const once = soften({ data, w: W, h: H, target });
  assert.equal(once.changed, 0);
  const heavy = img(W, H, [10, 10, 19, 19], [[22, 15, [0, 0, 0, 160]], [23, 15, [0, 0, 0, 90]]]);
  const a = soften({ data: heavy, w: W, h: H, target: profile(data, dist, W, H) });
  const b = soften({ data: a.data, w: W, h: H, target: profile(data, dist, W, H) });
  assert.ok(a.changed > 0);
  assert.equal(b.changed, 0);
});
