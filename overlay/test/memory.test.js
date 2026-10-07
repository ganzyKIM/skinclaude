// memory.js — 하루 단위 잡담 세션과 장기 기억 요약 (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { dayKey, msUntilNextDay, transcriptPath, extractDialogue, buildPrompt, toCondense, createStore } = require('../memory.js');

test('하루는 새벽 5시에 바뀐다', () => {
  assert.equal(dayKey(new Date(2026, 8, 30, 4, 59)), '2026-09-29');
  assert.equal(dayKey(new Date(2026, 8, 30, 5, 0)), '2026-09-30');
  assert.equal(dayKey(new Date(2026, 9, 1, 0, 30)), '2026-09-30');
});

test('다음 새벽 5시까지 남은 시간', () => {
  assert.equal(msUntilNextDay(new Date(2026, 8, 30, 4, 0)), 3600_000);
  assert.equal(msUntilNextDay(new Date(2026, 8, 30, 23, 0)), 6 * 3600_000);
});

test('세션 기록 경로는 cwd 의 영숫자 아닌 글자를 - 로 바꾼 폴더', () => {
  assert.equal(transcriptPath('/Users/me/.skinclaude/chat', 'abc', '/Users/me'), '/Users/me/.claude/projects/-Users-me--skinclaude-chat/abc.jsonl');
});

test('대화만 뽑고 형식 힌트·메모·감정 태그·크롬 표시는 뺀다', () => {
  const lines = [
    { type: 'system', subtype: 'init' },
    { type: 'user', message: { role: 'user', content: [{ type: 'text', text: "(형식: 첫 글자는 '[' 감정태그, 1~2문장)\n(지금 시각: 2026년 10월 1일 목요일 오전 6시 05분)\n(메모: 크롬 도우미가 생겼어)\n나 내일 병원 가" }] } },
    { type: 'assistant', message: { content: [{ type: 'thinking', thinking: '...' }, { type: 'text', text: '[걱정] 어디 아파 P? 꼭 알려줘\n[크롬] 병원 검색' }] } },
    { type: 'user', message: { role: 'user', content: '커피 좋아해' } },
    'not json',
  ].map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join('\n');
  assert.equal(extractDialogue(lines, '초텐쨩'), '사용자: 나 내일 병원 가\n초텐쨩: 어디 아파 P? 꼭 알려줘\n사용자: 커피 좋아해');
});

test('기억 블록은 오래된 기억 → 날짜순, 없으면 빈 문자열', () => {
  assert.equal(buildPrompt({ old: '', days: [] }), '');
  const p = buildPrompt({ old: '- 커피를 좋아한다', days: [{ day: '2026-09-29', summary: '- 병원 예약' }] });
  assert.ok(p.includes('[오래된 기억]\n- 커피를 좋아한다') && p.includes('[2026-09-29]\n- 병원 예약'), p);
  assert.ok(p.indexOf('오래된 기억]') < p.indexOf('[2026-09-29]'));
});

test('날짜별 요약이 keep 개를 넘으면 앞쪽을 합친다', () => {
  const days = Array.from({ length: 16 }, (_, i) => ({ day: `2026-09-${String(i + 1).padStart(2, '0')}`, summary: `- ${i}` }));
  assert.deepEqual(toCondense({ days }, 14).map((d) => d.day), ['2026-09-01', '2026-09-02']);
  assert.deepEqual(toCondense({ days: days.slice(0, 14) }, 14), []);
});

function tmpStore(summarize, keep) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mem-'));
  const chatCwd = '/tmp/chatcwd';
  const tdir = path.join(home, '.claude', 'projects', chatCwd.replace(/[^a-zA-Z0-9]/g, '-'));
  fs.mkdirSync(tdir, { recursive: true });
  const write = (id, text) => fs.writeFileSync(path.join(tdir, `${id}.jsonl`), JSON.stringify({ type: 'user', message: { role: 'user', content: text } }));
  const store = createStore({ dir: path.join(home, 'memory'), chatCwd, summarize, keep });
  return { store, write, home };
}

test('지난 세션을 요약해 날짜별로 저장하고 프롬프트에 넣는다', async (t) => {
  const origHome = os.homedir; t.after(() => { os.homedir = origHome; });
  const prompts = [];
  const { store, write, home } = tmpStore(async (p) => { prompts.push(p); return '- 사용자는 커피를 좋아한다'; });
  os.homedir = () => home; // transcriptPath 기본 home
  write('s1', '나 커피 좋아해');
  const mem = await store.archive('choten', { sessionId: 's1', day: '2026-09-29' });
  assert.deepEqual(mem.days, [{ day: '2026-09-29', summary: '- 사용자는 커피를 좋아한다' }]);
  assert.ok(prompts[0].includes('사용자: 나 커피 좋아해') && prompts[0].includes('2026-09-29'));
  assert.ok(store.prompt('choten').includes('- 사용자는 커피를 좋아한다'));
});

test('요약이 실패하면 다음에 다시 하도록 남겨 두고, 성공하면 비운다', async (t) => {
  const origHome = os.homedir; t.after(() => { os.homedir = origHome; });
  let fail = true;
  const { store, write, home } = tmpStore(async () => { if (fail) throw new Error('오프라인'); return '- 기억'; });
  os.homedir = () => home;
  write('s1', '안녕');
  let mem = await store.archive('ame', { sessionId: 's1', day: '2026-09-29' });
  assert.deepEqual(mem.pending, [{ sessionId: 's1', day: '2026-09-29' }]);
  assert.deepEqual(mem.days, []);
  fail = false;
  mem = await store.archive('ame', null);
  assert.deepEqual(mem.pending, []);
  assert.deepEqual(mem.days, [{ day: '2026-09-29', summary: '- 기억' }]);
});

test('오래된 날짜는 합쳐서 오래된 기억으로 옮긴다', async (t) => {
  const origHome = os.homedir; t.after(() => { os.homedir = origHome; });
  const { store, write, home } = tmpStore(async (p) => (p.includes('하나의 장기 기억') ? '- 합친 기억' : '- 새 요약'), 2);
  os.homedir = () => home;
  store.save('choten', { old: '', days: [{ day: '2026-09-27', summary: '- a' }, { day: '2026-09-28', summary: '- b' }], pending: [] });
  write('s3', '오늘 얘기');
  const mem = await store.archive('choten', { sessionId: 's3', day: '2026-09-29' });
  assert.equal(mem.old, '- 합친 기억');
  assert.deepEqual(mem.days.map((d) => d.day), ['2026-09-28', '2026-09-29']);
});
