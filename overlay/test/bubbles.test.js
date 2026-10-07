// renderer/bubbles.js — 말풍선 자리(최대 3개)와 최근 대화 기록(20개) 테스트 (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSlots, createLog, clock } = require('../renderer/bubbles.js');

test('세 개까지 쌓이고, 같은 key 는 새로 안 만들고 제자리에서 바뀐다', () => {
  const s = createSlots({ max: 3 });
  assert.equal(s.place('a', 0, 1).action, 'add');
  assert.equal(s.place('b', 0, 2).action, 'add');
  assert.equal(s.place('a', 1, 3).action, 'update');
  assert.equal(s.place('c', 0, 4).action, 'add');
  assert.deepEqual(s.keys(), ['a', 'b', 'c']);
});

test('자리가 없으면 덜 중요하고 오래 안 바뀐 것을 밀어내고 새 것은 맨 아래에 온다', () => {
  const s = createSlots({ max: 3 });
  s.place('chat', 1, 1); s.place('s1', 0, 2); s.place('s2', 0, 3);
  assert.deepEqual(s.place('task', 1, 4), { action: 'replace', victim: 's1' });
  assert.deepEqual(s.keys(), ['chat', 's2', 'task']);
});

test('모두 더 중요한 말이면 새 진행 중계는 띄우지 않는다', () => {
  const s = createSlots({ max: 3 });
  s.place('chat', 1, 1); s.place('task', 1, 2); s.place('s1', 1, 3);
  assert.deepEqual(s.place('s2', 0, 4), { action: 'drop' });
  assert.deepEqual(s.keys(), ['chat', 'task', 's1']);
});

test('같은 중요도끼리는 가장 오래 안 바뀐 것이 밀려난다', () => {
  const s = createSlots({ max: 2 });
  s.place('a', 1, 1); s.place('b', 1, 2); s.place('a', 1, 3);
  assert.deepEqual(s.place('c', 1, 4), { action: 'replace', victim: 'b' });
});

test('weakest 와 remove', () => {
  const s = createSlots();
  s.place('a', 1, 1); s.place('b', 0, 5);
  assert.equal(s.weakest(), 'b');
  s.remove('b');
  assert.deepEqual(s.keys(), ['a']);
  s.clear();
  assert.equal(s.weakest(), null);
});

test('기록은 최근 20개만 남기고 저장한다', () => {
  let saved = null;
  const log = createLog({ max: 20, save: (l) => { saved = l; } });
  for (let i = 0; i < 25; i++) log.add({ text: `말 ${i}`, at: i * 10_000 });
  const l = log.list();
  assert.equal(l.length, 20);
  assert.equal(l[0].text, '말 5');
  assert.equal(l[19].text, '말 24');
  assert.equal(saved.length, 20);
});

test('같은 말이 3초 안에 또 오면 한 번만, 빈 말은 안 남긴다', () => {
  const log = createLog();
  assert.equal(log.add({ text: '끝났어', tag: 'a', at: 1000 }), true);
  assert.equal(log.add({ text: '끝났어', tag: 'a', at: 2500 }), false);
  assert.equal(log.add({ text: '끝났어', tag: 'b', at: 2600 }), true);
  assert.equal(log.add({ text: '끝났어', tag: 'b', at: 9000 }), true);
  assert.equal(log.add({ text: '   ' }), false);
  assert.equal(log.list().length, 3);
});

test('저장해 둔 기록을 불러오고, 깨진 저장값은 무시한다', () => {
  const log = createLog({ load: () => [{ text: '예전 말', who: 'me', tag: '', at: 1 }] });
  assert.equal(log.list()[0].text, '예전 말');
  assert.deepEqual(createLog({ load: () => { throw new Error('bad json'); } }).list(), []);
});

test('기록을 비우면 저장값도 빈다', () => {
  let saved = null;
  const log = createLog({ save: (l) => { saved = l; } });
  log.add({ text: '시험' }); log.clear();
  assert.deepEqual(log.list(), []);
  assert.deepEqual(saved, []);
});

test('시각은 두 자리 시:분', () => {
  assert.equal(clock(new Date(2026, 8, 30, 9, 5).getTime()), '09:05');
});
