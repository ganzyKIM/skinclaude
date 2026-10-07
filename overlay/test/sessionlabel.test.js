// sessionlabel.js — 훅 이벤트가 어느 세션 얘기인지 말풍선 위 이름표("세션 제목 · 폴더")를 만드는지 (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const { titleFromText, createLabeler } = require('../sessionlabel.js');

const row = (o) => JSON.stringify(o) + '\n';

test('세션 기록에서 가장 최근 customTitle 을 쓴다', () => {
  const t = row({ type: 'custom-title', customTitle: '옛 제목' }) + row({ type: 'user' }) + row({ type: 'custom-title', customTitle: '새 제목' });
  assert.equal(titleFromText(t), '새 제목');
});

test('customTitle 이 없으면 aiTitle 을 쓴다', () => {
  assert.equal(titleFromText(row({ type: 'ai-title', aiTitle: '자동 제목' })), '자동 제목');
});

test('제목의 이스케이프 문자를 푼다', () => {
  assert.equal(titleFromText(row({ type: 'custom-title', customTitle: '"따옴표" 제목' })), '"따옴표" 제목');
});

test('제목이 없으면 빈 문자열', () => {
  assert.equal(titleFromText(row({ type: 'user', message: 'hi' })), '');
});

const ev = (over = {}) => ({ session_id: 's1', cwd: '/Users/x/Desktop/txtgame', transcript_path: '/t/s1.jsonl', ...over });

test('이름표는 "제목 · 폴더"(사이드바에서 알아보는 건 제목), 긴 제목은 20자에서 자른다', () => {
  const label = createLabeler({ read: () => row({ type: 'custom-title', customTitle: '두비덥 태블릿 키오스크 프로젝트 설정과 배포 준비' }) });
  const s = label(ev());
  assert.ok(s.startsWith('두비덥 태블릿'), s);
  assert.ok(s.endsWith('… · txtgame'), s);
  assert.equal(s.length, 20 + 1 + ' · txtgame'.length);
});

test('제목을 못 찾으면 폴더 이름만, 세션 정보가 없으면 빈 문자열', () => {
  const label = createLabeler({ read: () => '' });
  assert.equal(label(ev()), 'txtgame');
  assert.equal(label({ hook_event_name: 'Say' }), '');
});

test('같은 세션은 30초 동안 기록을 다시 읽지 않는다', () => {
  let t = 0, reads = 0;
  const label = createLabeler({ now: () => t, read: () => { reads++; return row({ type: 'custom-title', customTitle: '제목' }); } });
  label(ev()); label(ev()); t = 10_000; label(ev());
  assert.equal(reads, 1);
  t = 40_000; label(ev());
  assert.equal(reads, 2);
});

test('기록 끝부분에 제목이 없으면 더 넓게 읽는다', () => {
  const sizes = [];
  const label = createLabeler({ read: (_, bytes) => { sizes.push(bytes); return sizes.length === 1 ? row({ type: 'user' }) : row({ type: 'ai-title', aiTitle: '앞쪽 제목' }); } });
  assert.equal(label(ev()), '앞쪽 제목 · txtgame');
  assert.ok(sizes[1] > sizes[0]);
});
