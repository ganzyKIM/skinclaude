// renderer/boost.js — 캐릭터 목소리 키우기(넘침 방지) (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const { apply, LIM } = require('../renderer/boost.js');

const tone = (n, amp, sr = 24000, hz = 220) => Float32Array.from({ length: n }, (_, i) => amp * Math.sin(2 * Math.PI * hz * i / sr));
const peak = (a) => a.reduce((m, x) => Math.max(m, Math.abs(x)), 0);

test('키우지 않을 땐 그대로', () => {
  const a = tone(1000, 0.5), b = Float32Array.from(a);
  apply(a, 24000, 1, { env: 0 });
  assert.deepEqual(a, b);
});

test('작은 소리는 정확히 gain 배가 된다', () => {
  const a = tone(2400, 0.1);
  apply(a, 24000, 3.16, { env: 0 });
  assert.ok(Math.abs(peak(a) - 0.316) < 0.005, String(peak(a)));
});

test('큰 소리는 넘치지 않게 눌린다', () => {
  const a = tone(4800, 0.8);
  apply(a, 24000, 3.16, { env: 0 });
  assert.ok(peak(a) <= LIM + 1e-4, String(peak(a)));
  assert.ok(peak(a) > LIM - 0.05); // 그렇다고 필요 이상으로 줄이지도 않는다
});

test('큰 소리 뒤에는 서서히 풀리고, 조각 사이에도 상태가 이어진다', () => {
  const sr = 24000, st = { env: 0 };
  const loud = tone(2400, 0.9, sr), quiet1 = tone(240, 0.1, sr), quiet2 = tone(12000, 0.1, sr);
  apply(loud, sr, 3, st);
  apply(quiet1, sr, 3, st);               // 바로 뒤 10ms: 아직 눌려 있다
  assert.ok(peak(quiet1) < 0.25, String(peak(quiet1)));
  apply(quiet2, sr, 3, st);               // 0.5초 뒤엔 다 풀려 3배
  assert.ok(Math.abs(peak(quiet2.slice(-2400)) - 0.3) < 0.01, String(peak(quiet2.slice(-2400))));
});

test('1 보다 작은 배수는 그대로 곱한다(목소리를 줄여 둔 경우)', () => {
  const ch = Float32Array.from([0.5, -0.4, 0.2]);
  apply(ch, 24000, 0.5, { env: 0 });
  assert.ok(Math.abs(ch[0] - 0.25) < 1e-6 && Math.abs(ch[1] + 0.2) < 1e-6 && Math.abs(ch[2] - 0.1) < 1e-6);
});

test('조각 안에서 배수를 고르게 바꾼다(앞 조각 끝 값 → 이번 값)', () => {
  const ch = new Float32Array(1000).fill(0.1);
  apply(ch, 24000, 3, { env: 0 }, 1);
  assert.ok(Math.abs(ch[0] - 0.1) < 1e-3, `처음 ${ch[0]}`);       // 처음은 앞 값(1배)
  assert.ok(Math.abs(ch[500] - 0.2) < 1e-3, `가운데 ${ch[500]}`); // 가운데는 2배
  assert.ok(ch[999] > 0.29 && ch[999] <= 0.3, `끝 ${ch[999]}`);    // 끝은 거의 3배
  for (let i = 1; i < 1000; i++) assert.ok(ch[i] >= ch[i - 1], '툭 바뀌는 데가 없다');
});

