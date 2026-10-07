// persona.js — 잡담 캐릭터에게 매 턴 알려 주는 현재 시각 (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const { PERSONA, timeNote } = require('../persona.js');

test('현재 시각은 날짜·요일·오전/오후 시각으로 적는다', () => {
  assert.equal(timeNote(new Date(2026, 9, 1, 6, 5)), '(지금 시각: 2026년 10월 1일 목요일 오전 6시 05분)');
  assert.equal(timeNote(new Date(2026, 9, 1, 0, 30)), '(지금 시각: 2026년 10월 1일 목요일 오전 12시 30분)');
  assert.equal(timeNote(new Date(2026, 9, 4, 13, 0)), '(지금 시각: 2026년 10월 4일 일요일 오후 1시 00분)');
});

test('두 캐릭터 모두 시각 메모를 믿고 답하라는 규칙이 있다', () => {
  for (const f of ['choten', 'ame']) assert.ok(PERSONA[f].includes('(지금 시각: …)') && PERSONA[f].includes('모른다고 하지 않는다'), f);
});
