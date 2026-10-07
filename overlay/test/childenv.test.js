// childenv.js — 자식 claude 에 부모 Claude Code 세션 변수가 새지 않게 (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const { claudeEnv } = require('../childenv.js');

test('부모 세션 변수는 빼고 나머지는 둔다', () => {
  const env = claudeEnv({
    HOME: '/Users/me', PATH: '/usr/bin:/bin', LANG: 'ko_KR.UTF-8', SKINCLAUDE_CLAUDE_BIN: '/x/claude',
    CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: 'abc', CLAUDE_CODE_MESSAGING_SOCKET: '/tmp/s.sock', CLAUDE_AGENT_SDK_VERSION: '0.3',
    CLAUDE_PID: '1', AI_AGENT: 'x', ANTHROPIC_BASE_URL: 'https://api.anthropic.com', MCP_CONNECTION_NONBLOCKING: 'true',
  }, '/Users/me');
  assert.deepEqual(Object.keys(env).sort(), ['HOME', 'LANG', 'PATH', 'SKINCLAUDE_CLAUDE_BIN']);
});

test('PATH 에 claude 설치 위치를 더한다', () => {
  assert.equal(claudeEnv({ PATH: '/usr/bin' }, '/Users/me').PATH, '/usr/bin:/Users/me/.local/bin:/opt/homebrew/bin:/usr/local/bin');
  assert.ok(claudeEnv({}, '/Users/me').PATH.startsWith('/usr/bin:/bin:/usr/sbin:/sbin:'));
});
