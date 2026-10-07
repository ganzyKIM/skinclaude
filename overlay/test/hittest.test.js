// hittest.js — 커서가 렌더러가 알려 준 클릭 영역 위에 있는지 (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const { isOver } = require('../hittest.js');

const bounds = { x: 100, y: 50, width: 800, height: 600 };
const rects = [[600, 300, 180, 300], [620, 610, 120, 24]]; // 캐릭터, 버튼 줄

test('창 위치를 빼서 창 안 좌표로 비교한다', () => {
  assert.equal(isOver(rects, { x: 100 + 650, y: 50 + 400 }, bounds), true);
  assert.equal(isOver(rects, { x: 650, y: 400 }, bounds), false);
});

test('사각형 경계: 왼쪽·위는 포함, 오른쪽·아래는 제외', () => {
  assert.equal(isOver(rects, { x: 700, y: 350 }, bounds), true);   // (600,300) 모서리
  assert.equal(isOver(rects, { x: 880, y: 350 }, bounds), false);  // x = 600+180
  assert.equal(isOver(rects, { x: 750, y: 683 }, bounds), true);   // 버튼 줄 안
});

test('끄는 중이면 커서가 벗어나도 마우스를 받는다', () => {
  assert.equal(isOver(rects, { x: 0, y: 0 }, bounds, true), true);
});

test('영역이 없으면 통과', () => {
  assert.equal(isOver([], { x: 700, y: 400 }, bounds), false);
  assert.equal(isOver(undefined, { x: 700, y: 400 }, bounds), false);
});
