// Claude Code CLI(`claude -p`)를 헤드리스로 돌리는 실행기(⚡ 지시·크롬 도우미). 잡담은 상주 프로세스(chatd.js)가 맡는다.
// - runTask: 지정 폴더에서 실제 작업. --session-id 를 미리 정해 두어 그 세션의 훅만 진행 표시로 골라낼 수 있다.
// --output-format json 의 마지막 결과만 쓴다 (진행 상황은 훅으로 온다).
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { claudeEnv } = require('./childenv');

let current = null; // { child, sessionId, kind }

function claudeBin() {
  const candidates = [
    process.env.SKINCLAUDE_CLAUDE_BIN,
    path.join(os.homedir(), '.local', 'bin', 'claude'),
    '/opt/homebrew/bin/claude', '/usr/local/bin/claude',
  ].filter(Boolean);
  return candidates.find(p => { try { fs.accessSync(p, fs.constants.X_OK); return true; } catch { return false; } }) || 'claude';
}

function run(args, { cwd, kind, sessionId, onDone, env = {} }) {
  if (current) return { error: 'busy' };
  const started = Date.now();
  const child = spawn(claudeBin(), args, {
    cwd, stdio: ['ignore', 'pipe', 'pipe'],
    // 부모 Claude Code 세션 변수는 빼고(childenv.js), 작업별 변수를 얹는다. SKINCLAUDE_CHILD: 마스코트가 띄운 실행이라는 표시
    // (hooks/session-note.sh 가 이 실행에는 기록 알림을 넘기지 않는다 — 앱에서 쓰는 대화로 가야 할 것을 여기서 가로채지 않게)
    env: { ...claudeEnv(), SKINCLAUDE_CHILD: '1', ...env },
  });
  current = { child, sessionId, kind };
  let out = '', err = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { err += d; });
  child.on('close', (code, signal) => {
    current = null;
    const durationMs = Date.now() - started;
    if (signal === 'SIGTERM' || signal === 'SIGKILL') return onDone({ ok: false, cancelled: true, sessionId, durationMs });
    let parsed = null;
    try { parsed = JSON.parse(out.trim().split('\n').pop()); } catch {}
    if (parsed && parsed.type === 'result') {
      return onDone({
        ok: !parsed.is_error, text: parsed.result || '', sessionId: parsed.session_id || sessionId,
        costUsd: parsed.total_cost_usd, durationMs, error: parsed.is_error ? (parsed.result || 'error') : undefined,
      });
    }
    onDone({ ok: false, sessionId, durationMs, error: (err || out || `exit ${code}`).trim().slice(0, 400) });
  });
  child.on('error', e => { current = null; onDone({ ok: false, sessionId, error: e.message }); });
  return { sessionId, child };
}

// 지시·크롬 작업의 CLI 인자(test/runner.test.js). resume 이면 같은 세션을 --resume 으로 잇고(크롬은 늘 같은 세션),
// forkId 를 주면 그 세션을 갈래로 이어 새 id(forkId)로 쓴다(--fork-session: 데스크톱 앱에서 지금 쓰는 대화에 끼어들지 않게),
// chrome 이면 Claude in Chrome 연동을 켜고 허용/금지 도구와 추가 지침, 덧붙일 MCP 서버(mcpConfig, JSON 글)를 붙인다.
function taskArgs({ text, sessionId, resume = false, forkId, permissionMode = 'acceptEdits', model, effort, settingSources, hooksUrl, chrome = false, allowedTools, disallowedTools, appendSystemPrompt, mcpConfig }) {
  const args = ['-p', text, '--output-format', 'json', resume ? '--resume' : '--session-id', sessionId];
  if (resume && forkId) args.push('--fork-session', '--session-id', forkId);
  args.push('--permission-mode', permissionMode);
  if (model) args.push('--model', model);
  if (effort) args.push('--effort', effort); // 넘긴 일: 그 대화에 앱에서 고른 effort(projects.runSettings)
  if (settingSources != null) args.push('--setting-sources', settingSources); // 지시 에이전트: 사용자 설정(플러그인·전역 훅)을 싣지 않는다
  if (chrome) args.push('--chrome');
  if (allowedTools?.length) args.push('--allowedTools', allowedTools.join(','));
  if (disallowedTools?.length) args.push('--disallowedTools', disallowedTools.join(','));
  if (appendSystemPrompt) args.push('--append-system-prompt', appendSystemPrompt);
  if (mcpConfig) args.push('--mcp-config', mcpConfig);
  if (hooksUrl) {
    const hook = [{ hooks: [{ type: 'http', url: hooksUrl, timeout: 3 }] }];
    args.push('--settings', JSON.stringify({ hooks: { UserPromptSubmit: hook, PreToolUse: hook, Notification: hook, Stop: hook } }));
  }
  return args;
}

// fork: resumeId 의 대화를 갈래로 이어 새 세션 id 로 쓴다(진행 표시는 그 새 id 의 훅으로 골라낸다)
function runTask({ text, cwd, resumeId, fork = false, onDone, env, ...opts }) {
  const forkId = fork && resumeId ? randomUUID() : undefined;
  const sessionId = forkId || resumeId || randomUUID();
  return run(taskArgs({ text, sessionId: resumeId || sessionId, resume: !!resumeId, forkId, ...opts }), { cwd, kind: 'task', sessionId, onDone, env });
}

// 결과 글을 다른 언어로 옮긴다(넘긴 일이 지시와 다른 언어로 답했을 때 말풍선·소리용 — 2026-10-03 셋 중 둘이 영어로 답했다).
// 작업 하나(current)와 따로 돈다: 짧고(3~6초) 도구도 기록도 없다. 실패하면 { ok: false } — 부른 쪽이 원문을 쓴다.
function translateArgs(text, langName, model = 'haiku') {
  const prompt = `다음 글 전체를 ${langName}로 옮겨 줘. 제목·목록·굵은 글씨 안의 말까지 모든 문장을 빠짐없이 옮겨서 다른 언어 문장이 하나도 남지 않게 해. `
    + `마크다운 모양, 코드·파일 경로·명령·숫자, 따옴표 속 예시 말("초단장"·"頂点" 같은 것)만 그대로 둔다. 옮긴 글만 답하고 다른 말은 붙이지 마.\n\n---\n${text}`;
  return ['-p', prompt, '--output-format', 'json', '--model', model, '--no-session-persistence', '--tools', '', '--setting-sources', ''];
}
function translate({ text, langName, cwd = os.homedir(), timeoutMs = 30_000 }) {
  return new Promise((resolve) => {
    let out = '', done = false;
    // 생각(thinking)을 끈다: 옮기기엔 필요 없고 첫 글자가 늦어진다(잡담과 같은 이유 — chatd)
    const child = spawn(claudeBin(), translateArgs(text, langName), { cwd, stdio: ['ignore', 'pipe', 'ignore'], env: { ...claudeEnv(), SKINCLAUDE_CHILD: '1', MAX_THINKING_TOKENS: '0' } });
    const finish = (r) => { if (!done) { done = true; clearTimeout(timer); resolve(r); } };
    const timer = setTimeout(() => { try { child.kill('SIGTERM'); } catch {} finish({ ok: false, error: 'timeout' }); }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.on('error', (e) => finish({ ok: false, error: e.message }));
    child.on('close', () => {
      let parsed = null;
      try { parsed = JSON.parse(out.trim().split('\n').pop()); } catch {}
      if (parsed?.type === 'result' && !parsed.is_error && parsed.result) finish({ ok: true, text: String(parsed.result).trim() });
      else finish({ ok: false, error: parsed?.result || 'no result' });
    });
  });
}

function cancel() {
  if (!current) return false;
  try { current.child.kill('SIGTERM'); } catch {}
  return true;
}
function busy() { return current ? { kind: current.kind, sessionId: current.sessionId } : null; }

module.exports = { runTask, cancel, busy, taskArgs, translate, translateArgs };
