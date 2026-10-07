// 오버레이가 띄우는 claude CLI(잡담·지시·크롬·기억 요약)에 넘길 환경 변수(test/childenv.test.js).
// 오버레이를 Claude Code 세션 안에서 켜면(개발 중 Bash 도구로 overlay-ctl start 등) 그 세션의 CLAUDECODE·CLAUDE_CODE_*
// 변수가 물려 들어온다. 그러면 자식 claude 가 자기를 그 세션의 하위 세션으로 알고 부모와 통신하려다 시작에서 멈췄다(2026-10-01).
// 이런 "부모 세션" 변수는 빼고, PATH 에 claude 가 설치되는 곳을 더한다.
const os = require('node:os');
const path = require('node:path');

const PARENT_SESSION = /^(CLAUDECODE$|CLAUDE_CODE_|CLAUDE_AGENT_SDK_|CLAUDE_PID$|CLAUDE_EFFORT$|CLAUDE_AUTOCOMPACT_|CLAUDE_PREVIEW_|AI_AGENT$|ANTHROPIC_BASE_URL$|API_TIMEOUT_MS$|BAGGAGE$|MCP_CONNECTION_|MCP_SERVER_CONNECTION_|USE_LOCAL_OAUTH$|USE_STAGING_OAUTH$|DISABLE_AUTOUPDATER$|DISABLE_MICROCOMPACT$)/;

function claudeEnv(env = process.env, home = os.homedir()) {
  const out = {};
  for (const [k, v] of Object.entries(env)) if (!PARENT_SESSION.test(k)) out[k] = v;
  out.PATH = `${env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin'}:${path.join(home, '.local', 'bin')}:/opt/homebrew/bin:/usr/local/bin`;
  return out;
}

module.exports = { claudeEnv };
