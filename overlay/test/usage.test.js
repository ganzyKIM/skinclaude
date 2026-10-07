// usage.js — Claude 사용량 읽기: 응답 요약·초기화 시각 글·캐시·토큰 보호 (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('../usage.js');

const SAMPLE = { // 2026-10-07 실제 응답의 꼴(값은 예)
  five_hour: { utilization: 90.0, resets_at: '2026-10-07T13:39:59.683287+00:00', limit_dollars: null },
  seven_day: { utilization: 16.4, resets_at: '2026-10-12T07:59:59.683314+00:00' },
  seven_day_opus: null, seven_day_sonnet: null, tangelo: null,
  iguana_necktie: { utilization: 21.1, resets_at: '2026-11-05T07:59:00+00:00', limit_dollars: 250 },
};

test('아는 창만 골라 백분율로 요약한다(코드명 창은 뺀다)', () => {
  assert.deepEqual(U.summarize(SAMPLE), [
    { key: 'five_hour', label: '5시간', pct: 90, resetsAt: '2026-10-07T13:39:59.683287+00:00' },
    { key: 'seven_day', label: '주간 · 전체', pct: 16, resetsAt: '2026-10-12T07:59:59.683314+00:00' },
  ]);
  assert.deepEqual(U.summarize({ five_hour: { utilization: 123 } }), [{ key: 'five_hour', label: '5시간', pct: 100, resetsAt: null }]);
  assert.deepEqual(U.summarize(null), []);
});

test('초기화까지 남은 시간 글', () => {
  const now = Date.parse('2026-10-07T09:27:00Z');
  assert.equal(U.resetText('2026-10-07T13:39:59Z', now), '4시간 12분 뒤 초기화');
  assert.equal(U.resetText('2026-10-12T07:59:59Z', now), '4일 22시간 뒤 초기화');
  assert.equal(U.resetText('2026-10-07T09:40:00Z', now), '13분 뒤 초기화');
  assert.equal(U.resetText('2026-10-07T09:00:00Z', now), '곧 초기화');
  assert.equal(U.resetText(null, now), '');
});

test('60초 캐시, 토큰이 없으면 오류, 결과에 토큰이 섞이지 않는다', async () => {
  let t = 0, reads = 0, fetches = 0;
  const get = U.createUsage({ now: () => t, read: async () => { reads++; return 'tok-secret'; }, fetch: async (token) => { fetches++; assert.equal(token, 'tok-secret'); return SAMPLE; } });
  const a = await get(); assert.equal(a.ok, true); assert.equal(a.windows.length, 2);
  assert.ok(!JSON.stringify(a).includes('tok-secret'));
  t = 30_000; await get(); assert.equal(fetches, 1);
  t = 61_000; await get(); assert.equal(fetches, 2); assert.equal(reads, 2);
  const none = U.createUsage({ now: () => t, read: async () => null, fetch: async () => { throw new Error('안 불려야 함'); } });
  assert.deepEqual(await none(), { ok: false, error: 'Claude Code 로그인 정보를 못 읽음' });
  const bad = U.createUsage({ now: () => t, read: async () => 'x', fetch: async () => { throw new Error('HTTP 401'); } });
  assert.deepEqual(await bad(), { ok: false, error: 'HTTP 401' });
});
