// chromeflow.js — 잡담 답의 크롬 작업 표시를 읽고 가리는지, 크롬 도우미의 확인 요청을 알아채는지 (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDirective, visible, parseAgentResult, pendingNote, composeChat } = require('../chromeflow.js');

test('마지막 줄의 [크롬] 을 새 작업으로 읽고 말풍선 글에서 뺀다', () => {
  const r = parseDirective('[기쁨] 크롬으로 찾아볼게♡\n[크롬] 구글에서 오늘 서울 날씨 검색');
  assert.equal(r.text, '[기쁨] 크롬으로 찾아볼게♡');
  assert.deepEqual(r.directive, { kind: 'start', task: '구글에서 오늘 서울 날씨 검색' });
});

test('[크롬 이어서] 는 기다리던 작업을 사용자 대답과 함께 이어 간다', () => {
  const r = parseDirective('[기본] …알았다. 보낸다.\n[크롬 이어서] 응 보내');
  assert.equal(r.text, '[기본] …알았다. 보낸다.');
  assert.deepEqual(r.directive, { kind: 'resume', reply: '응 보내' });
});

test('[크롬 취소] 는 기다리던 작업을 버린다', () => {
  assert.deepEqual(parseDirective('[기본] …관둔다.\n[크롬 취소]').directive, { kind: 'cancel' });
});

test('표시가 없으면 글을 그대로 둔다', () => {
  assert.deepEqual(parseDirective('[기쁨] P 최고야♡'), { text: '[기쁨] P 최고야♡', directive: null, action: null });
});

test('마지막 줄의 [실행] 은 바로 할 동작으로 읽고 말풍선 글에서 뺀다', () => {
  const r = parseDirective('[기쁨] 파자마로 갈아입을게♡\n[실행] 의상 파자마');
  assert.equal(r.text, '[기쁨] 파자마로 갈아입을게♡');
  assert.equal(r.action, '의상 파자마');
  assert.equal(r.directive, null);
  assert.equal(visible('[기쁨] 갈아입을게♡\n[실'), '[기쁨] 갈아입을게♡');
  assert.equal(visible('[기쁨] 갈아입을게♡\n[실행] 의상'), '[기쁨] 갈아입을게♡');
});

test('스트리밍 중에는 완성된 크롬 줄과 쓰이는 중인 "[크…" 줄을 가리고 감정 태그는 둔다', () => {
  assert.equal(visible('[기쁨] 찾아볼게♡\n[크'), '[기쁨] 찾아볼게♡');
  assert.equal(visible('[기쁨] 찾아볼게♡\n[크롬] 구글에서'), '[기쁨] 찾아볼게♡');
  assert.equal(visible('[기쁨] 찾아볼게♡'), '[기쁨] 찾아볼게♡');
  assert.equal(visible('[기쁨] 크리스마스야♡\n[크리스마스 이벤트]'), '[기쁨] 크리스마스야♡\n[크리스마스 이벤트]');
});

test('크롬 도우미의 [확인 필요] 표시를 떼고 확인 대기로 알린다', () => {
  assert.deepEqual(parseAgentResult('메일을 다 써 뒀어. 받는 사람 a@b.com\n[확인 필요]'), { text: '메일을 다 써 뒀어. 받는 사람 a@b.com', needsConfirm: true, silent: false });
  assert.deepEqual(parseAgentResult('서울은 맑고 24도야.'), { text: '서울은 맑고 24도야.', needsConfirm: false, silent: false });
  // 노래 재생을 확인했으면 보고를 생략한다
  assert.deepEqual(parseAgentResult('[조용히]'), { text: '', needsConfirm: false, silent: true });
  assert.deepEqual(parseAgentResult('틀었어.\n[조용히]'), { text: '틀었어.', needsConfirm: false, silent: true });
  assert.deepEqual(parseAgentResult('[조용히] 아이묭 마리골드 재생 중이야.'), { text: '아이묭 마리골드 재생 중이야.', needsConfirm: false, silent: true });
});

test('확인 대기 메모에는 질문과 이어서·취소 표시 쓰는 법이 들어간다', () => {
  const n = pendingNote('이대로 보낼까?');
  assert.ok(n.includes('이대로 보낼까?') && n.includes('[크롬 이어서]') && n.includes('[크롬 취소]'), n);
});

test('기다리는 확인이 없으면 사용자 말 그대로', () => {
  assert.equal(composeChat({ text: '안녕' }), '안녕');
});

test('확인을 기다리는 중이면 그 메모를 붙인다', () => {
  const m = composeChat({ text: '응 보내', pendingQuestion: '이대로 보낼까?' });
  assert.ok(m.includes('이대로 보낼까?') && m.endsWith('\n응 보내'), m);
});
