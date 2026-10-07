// hookdedupe.js — 전역 훅과 지시 세션 자체 훅이 같은 이벤트를 두 번 보낼 때 하나만 통과시키는지 (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const { createDeduper } = require('../hookdedupe.js');

const ev = (over = {}) => ({ session_id: 's1', hook_event_name: 'PreToolUse', tool_name: 'Read', tool_use_id: 't1', tool_input: { file_path: '/a/b.js' }, ...over });

test('같은 이벤트가 짧은 간격으로 두 번 오면 두 번째는 중복', () => {
  let t = 0; const dup = createDeduper(3000, () => t);
  assert.equal(dup(ev()), false);
  t = 50; assert.equal(dup(ev()), true);
});

test('도구 호출이 다르면 중복이 아니다', () => {
  let t = 0; const dup = createDeduper(3000, () => t);
  dup(ev());
  assert.equal(dup(ev({ tool_use_id: 't2', tool_input: { file_path: '/a/c.js' } })), false);
});

test('시간이 지나면 같은 이벤트도 다시 통과한다', () => {
  let t = 0; const dup = createDeduper(3000, () => t);
  dup(ev());
  t = 5000; assert.equal(dup(ev()), false);
});

test('세션이 다르면 중복이 아니다', () => {
  let t = 0; const dup = createDeduper(3000, () => t);
  dup(ev());
  assert.equal(dup(ev({ session_id: 's2' })), false);
});

test('완료 이벤트도 같은 마지막 답이면 중복', () => {
  let t = 0; const dup = createDeduper(3000, () => t);
  const stop = { session_id: 's1', hook_event_name: 'Stop', last_assistant_message: '끝났어요' };
  assert.equal(dup(stop), false);
  t = 10; assert.equal(dup({ ...stop }), true);
});
