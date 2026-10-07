// announce.js — 앱 대화창의 완료 알림: 언제 말하고 무엇을 말하나 (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../announce.js');

const ON = { on: true, mode: 'line', minSec: 30 };
const hook = (ev, over = {}) => ({ hook_event_name: ev, session_id: 's1', cwd: '/Users/me/Desktop/portfolio', ...over });

test('말 보낸 때부터 끝난 때까지가 기준을 넘으면 말한다', () => {
  let t = 0; const a = A.createAnnouncer({ stateDir: '/Users/me/.skinclaude', now: () => t });
  a.prompt(hook('UserPromptSubmit'));
  t = 31_000;
  const d = a.stop(hook('Stop'), ON);
  assert.equal(d.speak, true); assert.equal(d.durationMs, 31_000);
});

test('짧은 턴·시작을 모르는 턴·꺼짐·마스코트 자신의 세션은 말하지 않는다', () => {
  let t = 0; const a = A.createAnnouncer({ stateDir: '/Users/me/.skinclaude', now: () => t });
  a.prompt(hook('UserPromptSubmit')); t = 10_000;
  assert.equal(a.stop(hook('Stop'), ON).speak, false);
  assert.equal(a.stop(hook('Stop', { session_id: 's9' }), ON).why, '시작을 모름');
  a.prompt(hook('UserPromptSubmit', { session_id: 's2' })); t = 100_000;
  assert.equal(a.stop(hook('Stop', { session_id: 's2' }), { ...ON, on: false }).why, '꺼짐');
  a.prompt(hook('UserPromptSubmit', { session_id: 's3', cwd: '/Users/me/.skinclaude/chat' })); t = 200_000;
  assert.equal(a.stop(hook('Stop', { session_id: 's3', cwd: '/Users/me/.skinclaude/chat' }), ON).why, '마스코트 세션');
  // 기준 0 이면 모든 턴
  a.prompt(hook('UserPromptSubmit', { session_id: 's4' })); t = 200_500;
  assert.equal(a.stop(hook('Stop', { session_id: 's4' }), { ...ON, minSec: 0 }).speak, true);
  // 한 번 끝난 세션은 다시 시작을 알아야 한다
  assert.equal(a.stop(hook('Stop', { session_id: 's4' }), { ...ON, minSec: 0 }).why, '시작을 모름');
});

test('shouldSpeak 은 글로 요청한 지시에도 같은 기준으로 쓴다(cwd 없으면 제외 안 함)', () => {
  const a = A.createAnnouncer({ stateDir: '/Users/me/.skinclaude' });
  assert.equal(a.shouldSpeak({ durationMs: 45_000 }, ON).speak, true);
  assert.equal(a.shouldSpeak({ durationMs: 5_000 }, ON).speak, false);
  assert.equal(a.shouldSpeak({ durationMs: 45_000, cwd: '/Users/me/.skinclaude/크롬' }, ON).speak, false);
});

test('이름표에서 제목만 떼고, 말할 글은 한 마디 또는 요약까지', () => {
  assert.equal(A.titleOf('포트폴리오 사이트 · portfolio', '/Users/me/Desktop/portfolio'), '포트폴리오 사이트');
  assert.equal(A.titleOf('portfolio', '/Users/me/Desktop/portfolio'), '');
  assert.equal(A.titleOf('', '/x/y'), '');
  const line = A.text({ who: 'choten', lang: 'ko', mode: 'line', title: '포트폴리오 사이트', folder: '/x/portfolio', summary: '팝업을 고쳤습니다. 배포도 했습니다.' });
  assert.equal(line, 'P, 포트폴리오 사이트 끝났어♡ 확인해 봐!');
  const full = A.text({ who: 'ame', lang: 'ko', mode: 'summary', title: '', folder: '/x/portfolio', summary: '팝업을 **고쳤습니다**. 배포도 했습니다.\n\n세부 내용은 아래.' }); // spokenSummary 는 첫 문단만(제목 줄이 있으면 그 글자도 읽는다)
  assert.equal(full, '…portfolio, 끝났어. 봐 봐. 팝업을 고쳤습니다. 배포도 했습니다.');
});
