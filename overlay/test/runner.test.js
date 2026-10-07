// runner.js 의 taskArgs — 지시·크롬 작업을 띄우는 claude CLI 인자 (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const { taskArgs } = require('../runner.js');

test('보통 지시는 지금과 같은 인자', () => {
  assert.deepEqual(taskArgs({ text: '고쳐줘', sessionId: 's1', permissionMode: 'acceptEdits' }),
    ['-p', '고쳐줘', '--output-format', 'json', '--session-id', 's1', '--permission-mode', 'acceptEdits']);
});

test('이어서 할 때는 --resume 으로 같은 세션을 쓴다', () => {
  const a = taskArgs({ text: '응 보내', sessionId: 's1', resume: true, permissionMode: 'default' });
  assert.deepEqual(a.slice(4, 6), ['--resume', 's1']);
  assert.ok(!a.includes('--session-id'));
});

test('크롬 작업은 크롬 연동·허용/금지 도구·추가 지침을 붙인다', () => {
  const a = taskArgs({ text: '날씨 검색', sessionId: 's2', permissionMode: 'default', chrome: true,
    allowedTools: ['mcp__claude-in-chrome__*'], disallowedTools: ['Bash', 'Edit'], appendSystemPrompt: '규칙' });
  assert.ok(a.includes('--chrome'));
  assert.equal(a[a.indexOf('--allowedTools') + 1], 'mcp__claude-in-chrome__*');
  assert.equal(a[a.indexOf('--disallowedTools') + 1], 'Bash,Edit');
  assert.equal(a[a.indexOf('--append-system-prompt') + 1], '규칙');
  assert.ok(!a.includes('--mcp-config'));
});

test('크롬 작업에 덧붙일 MCP 서버 설정을 넘긴다', () => {
  const cfg = JSON.stringify({ mcpServers: { skinclaude: { command: '/x/Electron', args: ['/x/chromefront-mcp.js'] } } });
  const a = taskArgs({ text: '노래 틀어', sessionId: 's4', resume: true, chrome: true, mcpConfig: cfg });
  assert.equal(a[a.indexOf('--mcp-config') + 1], cfg);
  assert.deepEqual(a.slice(4, 6), ['--resume', 's4']);
});

test('훅 주소가 있으면 진행 표시용 훅 설정을 넣는다', () => {
  const a = taskArgs({ text: 'x', sessionId: 's3', hooksUrl: 'http://127.0.0.1:47831/hook' });
  const s = JSON.parse(a[a.indexOf('--settings') + 1]);
  assert.deepEqual(Object.keys(s.hooks).sort(), ['Notification', 'PreToolUse', 'Stop', 'UserPromptSubmit']);
  assert.equal(s.hooks.PreToolUse[0].hooks[0].url, 'http://127.0.0.1:47831/hook');
});

test('갈래로 이어 쓰면 --fork-session 과 새 세션 id 를 붙인다(데스크톱 앱에서 쓰는 중인 대화에 끼어들지 않게)', () => {
  const a = taskArgs({ text: '헤더 고쳐', sessionId: 'orig', resume: true, forkId: 'new1', permissionMode: 'bypassPermissions', model: 'opus' });
  assert.deepEqual(a.slice(0, 10), ['-p', '헤더 고쳐', '--output-format', 'json', '--resume', 'orig', '--fork-session', '--session-id', 'new1', '--permission-mode']);
  assert.equal(a[a.indexOf('--model') + 1], 'opus');
  // 갈래 없이 이어 쓰면 --session-id 를 붙이지 않는다(CLI 가 거부한다: "--session-id can only be used with --continue or --resume if --fork-session")
  const b = taskArgs({ text: 'x', sessionId: 'orig', resume: true });
  assert.ok(!b.includes('--session-id') && !b.includes('--fork-session'));
  // 새 세션에는 forkId 를 줘도 무시한다
  assert.ok(!taskArgs({ text: 'x', sessionId: 's9', forkId: 'z' }).includes('--fork-session'));
});

test('결과 옮기기는 도구·기록 없이 haiku 로 한 번만 돈다', () => {
  const { translateArgs } = require('../runner.js');
  const a = translateArgs('Done.', '한국어');
  assert.equal(a[0], '-p');
  assert.match(a[1], /한국어로 옮겨/);
  assert.match(a[1], /---\nDone\.$/);
  assert.deepEqual(a.slice(2), ['--output-format', 'json', '--model', 'haiku', '--no-session-persistence', '--tools', '', '--setting-sources', '']);
});

test('넘긴 일은 그 대화의 모델·effort 로 이어 돈다', () => {
  const a = taskArgs({ text: '고쳐', sessionId: 's1', resume: true, permissionMode: 'bypassPermissions', model: 'claude-fable-5-1', effort: 'high' });
  assert.deepEqual(a.slice(a.indexOf('--model'), a.indexOf('--model') + 4), ['--model', 'claude-fable-5-1', '--effort', 'high']);
  assert.equal(taskArgs({ text: 'x', sessionId: 's1' }).includes('--effort'), false);
});

test('지시 에이전트는 사용자 설정(플러그인·전역 훅)을 싣지 않을 수 있다', () => {
  const a = taskArgs({ text: 'x', sessionId: 's1', model: 'sonnet', settingSources: 'project,local' });
  assert.deepEqual(a.slice(a.indexOf('--setting-sources'), a.indexOf('--setting-sources') + 2), ['--setting-sources', 'project,local']);
  assert.equal(taskArgs({ text: 'x', sessionId: 's1' }).includes('--setting-sources'), false);
});
