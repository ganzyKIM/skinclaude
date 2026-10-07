// normalize-lib.mjs — 표정 컷의 캐릭터 크기·위치를 세트 기본 컷에 맞추는 계산 (node --test gen/test/)
import test from 'node:test';
import assert from 'node:assert/strict';
import { measure, plan, isNoop, placement, sidePad } from '../normalize-lib.mjs';

// W×H 투명 격자에 불투명 사각형들을 칠한다
function grid(W, H, rects) {
  const data = new Uint8Array(W * H * 4);
  for (const [x0, y0, x1, y1] of rects) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) data[(y * W + x) * 4 + 3] = 255;
  return { data, width: W, height: H, channels: 4 };
}

test('머리 꼭대기는 발 중심 근처 띠에서 재서 옆으로 든 팔은 무시한다', () => {
  // 몸통 x15~24 y10~55, 왼쪽에 머리보다 높이 든 팔 x3~5 y2~20
  const m = measure(grid(40, 60, [[15, 10, 24, 55], [3, 2, 5, 20]]), { band: 3, feetRows: 3 });
  assert.equal(m.feet, 55);
  assert.equal(m.head, 10);
  assert.equal(m.h, 45);
  assert.ok(Math.abs(m.fx - 19.5) <= 0.5, String(m.fx));
  assert.deepEqual([m.top, m.minx, m.maxx], [2, 3, 24]);
});

test('빈 이미지는 null', () => {
  assert.equal(measure(grid(10, 10, [])), null);
});

const M = (o) => ({ feet: 55, fx: 20, head: 10, h: 45, top: 10, minx: 15, maxx: 24, ...o });

test('기본 컷과 같으면 그대로 둔다', () => {
  const p = plan(M(), M(), { width: 40, height: 60 });
  assert.equal(p.scale, 1);
  assert.ok(isNoop(p));
});

test('작은 캐릭터는 키를 맞추고 발끝·발 중심을 기본 컷 자리로 옮긴다', () => {
  const src = M({ feet: 50, fx: 18, head: 10, h: 40, top: 10, minx: 13, maxx: 23 });
  const p = plan(src, M({ h: 44 }), { width: 40, height: 60 });
  assert.ok(Math.abs(p.scale - 1.1) < 1e-9);
  assert.ok(Math.abs(p.top - (55 - 50 * 1.1)) < 1e-9);
  assert.ok(Math.abs(p.left - (20 - 18 * 1.1)) < 1e-9);
  assert.equal(p.clamped, false);
  assert.ok(!isNoop(p));
});

test('키를 맞추면 틀 위로 삐져나갈 때는 틀 안에 들어오는 만큼만 키운다', () => {
  // 위로 든 소품 때문에 윤곽 꼭대기(top)가 머리보다 훨씬 위
  const src = M({ feet: 50, head: 20, h: 30, top: 2 });
  const p = plan(src, M(), { width: 40, height: 60, pad: 2 });
  assert.equal(p.clamped, true);
  assert.ok(p.scale < 45 / 30);
  assert.ok(Math.abs(p.top + src.top * p.scale - 2) < 1e-9, '윤곽 꼭대기가 여백 2에 닿아야 함');
});

test('옆으로 옮길 자리가 모자라면 키는 맞추고 좌우는 틀 안에서 가능한 만큼만 옮긴다', () => {
  // 리본 머리가 틀 폭을 거의 다 차지(minx 1, maxx 38) — 발 중심을 20→24 로 옮기면 오른쪽이 넘친다
  const src = M({ fx: 20, minx: 1, maxx: 38 });
  const p = plan(src, M({ fx: 24 }), { width: 40, pad: 1 });
  assert.equal(p.scale, 1);
  assert.equal(p.clamped, false);
  assert.ok(Math.abs(p.left + 38 - (40 - 1 - 1)) < 1e-9, '오른쪽 끝이 여백에 닿을 때까지만 옮김');
  assert.equal(p.offCenter, 4);
});

test('키운 그림에서 틀 안에 들어오는 부분만 잘라 제자리에 놓는다', () => {
  const pl = placement({ srcW: 40, srcH: 60, W: 40, H: 60 }, 1.1, -3.4, 5);
  assert.deepEqual(pl, { scaledW: 44, scaledH: 66, extract: { left: 3, top: 0, width: 40, height: 55 }, at: { left: 0, top: 5 } });
});

test('줄인 그림은 자를 것 없이 오른쪽 아래로 옮겨 놓는다', () => {
  const pl = placement({ srcW: 40, srcH: 60, W: 40, H: 60 }, 0.9, 2.2, 6.4);
  assert.deepEqual(pl, { scaledW: 36, scaledH: 54, extract: { left: 0, top: 0, width: 36, height: 54 }, at: { left: 2, top: 6 } });
});

test('양옆을 넓힌 틀에는 원본 크기 그대로 가운데에 놓을 수 있다', () => {
  const pl = placement({ srcW: 40, srcH: 60, W: 60, H: 60 }, 1, 10, 0);
  assert.deepEqual(pl, { scaledW: 40, scaledH: 60, extract: { left: 0, top: 0, width: 40, height: 60 }, at: { left: 10, top: 0 } });
});

test('폼마다 모든 컷이 좌우까지 맞도록 필요한 만큼만 양옆을 넓힌다', () => {
  // 리본이 틀을 채운 컷(발 중심 20, 윤곽 1~38)을 기준 컷(발 중심 24)에 맞추려면 오른쪽에 4px 이상 더 필요
  const sets = [{ ref: M({ fx: 24 }), cuts: [M({ fx: 20, minx: 1, maxx: 38 })] }];
  assert.equal(sidePad(sets, { width: 40, pad: 1, step: 5 }), 5);
  assert.equal(sidePad([{ ref: M(), cuts: [M()] }], { width: 40, step: 5 }), 0);
});
