// renderer/narrate.js — 훅 이벤트를 캐릭터 대사로 바꾸는 순수 로직 테스트 (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const { actionOf, lineFor, createPacer, projectOf, ACTS } = require('../renderer/narrate.js');

const pre = (tool_name, tool_input = {}) => ({ hook_event_name: 'PreToolUse', tool_name, tool_input });

test('파일 읽기는 파일 이름으로 알린다', () => {
  assert.deepEqual(actionOf(pre('Read', { file_path: '/Users/x/proj/src/main.js' })), { act: 'read', what: 'main.js' });
});

test('파일 수정 도구는 모두 edit, 노트북은 notebook_path 를 쓴다', () => {
  assert.deepEqual(actionOf(pre('Edit', { file_path: '/a/b/style.css' })), { act: 'edit', what: 'style.css' });
  assert.deepEqual(actionOf(pre('MultiEdit', { file_path: '/a/b/app.ts' })), { act: 'edit', what: 'app.ts' });
  assert.deepEqual(actionOf(pre('NotebookEdit', { notebook_path: '/a/n.ipynb' })), { act: 'edit', what: 'n.ipynb' });
});

test('새 파일 쓰기는 write', () => {
  assert.deepEqual(actionOf(pre('Write', { file_path: '/a/new.md' })), { act: 'write', what: 'new.md' });
});

test('명령은 Claude 가 붙인 설명을 쓴다', () => {
  assert.deepEqual(actionOf(pre('Bash', { command: 'npm test', description: '테스트 실행' })), { act: 'bash', what: '테스트 실행' });
});

test('설명이 없는 명령은 첫 줄을 짧게 자른다', () => {
  const r = actionOf(pre('Bash', { command: 'cd /Users/dobedub/Desktop/skinclaude && python3 some_really_long_script_name.py --flag\necho done' }));
  assert.equal(r.act, 'bash');
  assert.ok(r.what.length <= 37, r.what);
  assert.ok(r.what.endsWith('…'));
  assert.ok(!r.what.includes('\n'));
});

test('검색은 찾는 말로 알린다', () => {
  assert.deepEqual(actionOf(pre('Grep', { pattern: 'onHook' })), { act: 'search', what: 'onHook' });
  assert.deepEqual(actionOf(pre('Glob', { pattern: '**/*.js' })), { act: 'find', what: '**/*.js' });
  assert.deepEqual(actionOf(pre('WebSearch', { query: '제미나이 한도' })), { act: 'web', what: '제미나이 한도' });
  assert.deepEqual(actionOf(pre('WebFetch', { url: 'https://docs.anthropic.com/en/hooks' })), { act: 'fetch', what: 'docs.anthropic.com' });
});

test('서브에이전트는 설명으로, 스킬은 플러그인 이름을 뗀다', () => {
  assert.deepEqual(actionOf(pre('Agent', { description: '코드 찾기' })), { act: 'agent', what: '코드 찾기' });
  assert.deepEqual(actionOf(pre('Task', { description: '리뷰' })), { act: 'agent', what: '리뷰' });
  assert.deepEqual(actionOf(pre('Skill', { skill: 'superpowers:brainstorming' })), { act: 'skill', what: 'brainstorming' });
});

test('할 일 정리·질문·계획 승인', () => {
  assert.equal(actionOf(pre('TodoWrite')).act, 'todo');
  assert.equal(actionOf(pre('TaskCreate')).act, 'todo');
  assert.equal(actionOf(pre('AskUserQuestion')).act, 'ask');
  assert.equal(actionOf(pre('ExitPlanMode')).act, 'plan');
});

test('브라우저 MCP 는 browser, 다른 MCP 는 도구 이름만', () => {
  assert.deepEqual(actionOf(pre('mcp__claude-in-chrome__navigate')), { act: 'browser', what: 'navigate' });
  assert.equal(actionOf(pre('mcp__Claude_Browser__computer')).act, 'browser');
  assert.deepEqual(actionOf(pre('mcp__drive__search_files')), { act: 'mcp', what: 'search_files' });
  assert.deepEqual(actionOf(pre('mcp__skinclaude__show_tab')), { act: 'browser', what: '창 앞으로' }); // 크롬 도우미가 재생 전에 창을 올림
});

test('모르는 도구는 도구 이름 그대로', () => {
  assert.deepEqual(actionOf(pre('ToolSearch')), { act: 'tool', what: 'ToolSearch' });
});

test('모든 작업 종류에 두 캐릭터 대사가 있고 자리표시자가 남지 않는다', () => {
  const need = ['prompt', 'read', 'edit', 'write', 'bash', 'search', 'find', 'web', 'fetch', 'agent', 'skill', 'todo', 'ask', 'plan', 'browser', 'mcp', 'tool', 'fail'];
  for (const act of need) assert.ok(ACTS.includes(act), `ACTS 에 ${act} 없음`);
  for (const form of ['choten', 'ame']) for (const act of ACTS) {
    for (const what of ['main.js', '']) {
      const s = lineFor(form, act, what, (arr) => arr[0]);
      assert.ok(s && !s.includes('{') && s === s.trim(), `${form}/${act}/"${what}" → "${s}"`);
    }
  }
});

test('대사에 작업 대상이 들어간다', () => {
  assert.ok(lineFor('ame', 'read', 'main.js', (arr) => arr[0]).includes('main.js'));
  assert.ok(lineFor('choten', 'bash', '테스트 실행', (arr) => arr[0]).includes('테스트 실행'));
});

test('폴더 경로의 마지막 이름을 프로젝트 이름으로 쓴다', () => {
  assert.equal(projectOf('/Users/x/Desktop/txtgame'), 'txtgame');
  assert.equal(projectOf('/Users/x/Desktop/txtgame/'), 'txtgame');
  assert.equal(projectOf(''), '');
});

// 가짜 시계: 타이머를 직접 흘려 보낸다
function fakeClock() {
  let t = 0; const timers = [];
  return {
    now: () => t,
    setTimer: (fn, ms) => { const h = { at: t + ms, fn }; timers.push(h); return h; },
    clearTimer: (h) => { const i = timers.indexOf(h); if (i >= 0) timers.splice(i, 1); },
    advance(ms) { t += ms; for (const h of timers.filter((x) => x.at <= t)) { this.clearTimer(h); h.fn(); } },
  };
}

test('첫 대사는 바로, 간격 안에 온 대사는 간격이 끝난 뒤 보인다', () => {
  const c = fakeClock(), shown = [];
  const p = createPacer({ gap: 1500, show: (x) => shown.push(x), ...c });
  p.push('a'); assert.deepEqual(shown, ['a']);
  c.advance(500); p.push('b'); assert.deepEqual(shown, ['a']);
  c.advance(1000); assert.deepEqual(shown, ['a', 'b']);
});

test('간격 안에 여러 개가 오면 가장 최근 것만 보인다', () => {
  const c = fakeClock(), shown = [];
  const p = createPacer({ gap: 1500, show: (x) => shown.push(x), ...c });
  p.push('a'); c.advance(100); p.push('b'); p.push('c'); p.push('d');
  c.advance(2000);
  assert.deepEqual(shown, ['a', 'd']);
});

test('급한 대사는 간격을 무시하고 밀려 있던 대사를 버린다', () => {
  const c = fakeClock(), shown = [];
  const p = createPacer({ gap: 1500, show: (x) => shown.push(x), ...c });
  p.push('a'); c.advance(100); p.push('b'); p.push('done', { urgent: true });
  c.advance(3000);
  assert.deepEqual(shown, ['a', 'done']);
});
