// 잡담용 상주 프로세스. `claude -p --input-format stream-json` 한 프로세스를 폼(초텐/아메)별로 살려 두고
// 메시지를 흘려 넣는다. 매번 CLI를 새로 띄우던 방식보다 시작 비용(~1.5초)이 사라지고,
// --include-partial-messages 로 첫 글자가 나오는 대로 말풍선에 흘린다.
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { claudeEnv } = require('./childenv');
const { PERSONA, timeNote } = require('./persona');

const CHAT_CWD = path.join(os.homedir(), '.skinclaude', 'chat');
const IDLE_KILL_MS = 15 * 60 * 1000;
const TURN_STALL_MS = 60 * 1000; // 한 턴에서 글자가 이만큼 안 오면 멎은 것으로 본다(잡담은 보통 1~3초 안에 첫 글자가 온다)
// 사용자 설정(플러그인·훅)을 잡담 세션에 끌어오지 않는다 — 시작이 느려지고 컨텍스트만 커진다
const SETTING_SOURCES = 'project,local';

function claudeBin() {
  const c = [process.env.SKINCLAUDE_CLAUDE_BIN, path.join(os.homedir(), '.local', 'bin', 'claude'), '/opt/homebrew/bin/claude', '/usr/local/bin/claude'].filter(Boolean);
  return c.find(p => { try { fs.accessSync(p, fs.constants.X_OK); return true; } catch { return false; } }) || 'claude';
}

class ChatProc {
  constructor(form, { model, sessionId, onSession, extraPrompt = '' }) {
    this.form = form; this.model = model; this.sessionId = sessionId || null; this.onSession = onSession;
    this.extraPrompt = extraPrompt; // 지난 대화 기억(memory.js) — 새로 띄울 때 시스템 프롬프트 뒤에 붙인다
    this.child = null; this.buf = ''; this.turn = null; this.idleTimer = null; this.turnTimer = null; this.ready = false;
  }
  alive() { return !!this.child && this.child.exitCode === null; }
  spawn() {
    if (this.alive()) return;
    fs.mkdirSync(CHAT_CWD, { recursive: true });
    const resume = !!this.sessionId;
    const id = this.sessionId || randomUUID();
    const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--include-partial-messages', '--verbose',
      '--model', this.model, '--tools', '', '--setting-sources', SETTING_SOURCES,
      '--append-system-prompt', (PERSONA[this.form] || PERSONA.choten) + (this.extraPrompt || ''),
      resume ? '--resume' : '--session-id', id];
    const child = this.child = spawn(claudeBin(), args, {
      cwd: CHAT_CWD, stdio: ['pipe', 'pipe', 'pipe'],
      // 부모 Claude Code 세션 변수는 빼고(childenv.js), 잡담 요청엔 생각(thinking) 설정을 싣지 않는다(MAX_THINKING_TOKENS=0 이면
      // 요청에서 thinking 이 빠진다 — 2026-10-01 로컬 중계로 확인. 기본은 {type:'adaptive'}).
      // 실측(페르소나 그대로): 켜 두면 haiku 는 매 턴 3~14초, sonnet 도 부탁 말에 2초 넘게 생각한 뒤에야 첫 글자가 나왔다. 끄면 잡담 첫 글자
      // 0.6~1.1초, 말투와 [크롬] 판단은 그대로. sonnet 은 그래도 웹 부탁 등에선 가끔 스스로 짧게 생각한다(+0.6~0.9초).
      // --effort low 는 더 빠르지 않아 쓰지 않는다. 깊이 생각할 일은 ⚡ 지시(runner)가 맡는다.
      env: { ...claudeEnv(), MAX_THINKING_TOKENS: '0' },
    });
    this.buf = ''; this.ready = false; this.liveModel = this.model;
    let err = '';
    child.stdout.on('data', d => { if (this.child === child) this.onData(d); });
    child.stderr.on('data', d => { err += d; });
    child.on('close', () => {
      // --resume 실패(세션 기록이 없음)면 기억을 버리고 새로 시작한다. (전에는 오류 글에 "resume" 한 낱말만 있어도 세션을 버렸다)
      if (/No conversation found/i.test(err)) { this.sessionId = null; this.onSession?.(this.form, null); }
      // 내린 직후 다시 띄웠으면(취소하고 바로 말을 걸었을 때) 옛 프로세스의 종료가 뒤늦게 온다: 새 프로세스와 새 턴을 건드리지 않는다
      if (this.child !== child) return;
      const t = this.turn; this.turn = null; this.child = null; clearTimeout(this.turnTimer);
      if (t) t.onDone({ ok: false, error: (err || '잡담 프로세스가 끊겼어').trim().slice(0, 300) });
    });
    this.touch();
  }
  touch() {
    clearTimeout(this.idleTimer);
    if (keepWarm) return; // 음성 모드 중엔 부르자마자 답하도록 내리지 않는다
    this.idleTimer = setTimeout(() => { if (!this.turn) this.kill(); }, IDLE_KILL_MS);
  }
  kill() { clearTimeout(this.idleTimer); if (this.alive()) { try { this.child.stdin.end(); this.child.kill('SIGTERM'); } catch {} } this.child = null; }
  send(text, { onDelta, onDone, model }) {
    if (this.turn) return false;
    this.spawn();
    // 이 턴의 모델(config.voiceChatModel 을 따로 정했을 때의 음성 잡담 등). 띄운 채로 set_model 제어 요청으로 바꾼다(2026-10-01 실측: 받아들여짐)
    if (model && model !== this.liveModel) {
      this.child.stdin.write(JSON.stringify({ type: 'control_request', request_id: `m${Date.now()}`, request: { subtype: 'set_model', model } }) + '\n');
      this.liveModel = model;
    }
    this.turn = { onDelta, onDone, text: '', started: Date.now() };
    this.watch();
    // 이어지는 세션은 예전 답 형식을 따라가려 해서, 매 턴 짧은 형식 힌트를 앞에 붙인다 (화면에는 보이지 않는다)
    // 도구가 없어 시계를 못 보니 현재 시각도 매 턴 알려 준다(persona.js 의 ★ 시각 규칙)
    const framed = `(형식: 첫 글자는 '[' 감정태그, 1~2문장)\n${timeNote()}\n${text}`;
    this.child.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: framed }] } }) + '\n');
    this.touch();
    return true;
  }
  cancel() { if (this.turn) { const t = this.turn; this.kill(); this.turn = null; clearTimeout(this.turnTimer); t.onDone({ ok: false, cancelled: true }); } }
  // 대답이 멎었을 때(글자가 TURN_STALL_MS 동안 안 옴): 턴을 실패로 끝낸다. 음성 잡담은 답을 기다리는 동안 듣기를 멈춰 두니,
  // 끝나지 않는 턴 하나가 음성 모드 전체를 멈춘다(취소 버튼을 누를 때까지).
  watch() {
    clearTimeout(this.turnTimer);
    const t = this.turn; if (!t) return;
    this.turnTimer = setTimeout(() => {
      if (this.turn !== t) return;
      this.kill(); this.turn = null;
      t.onDone({ ok: false, error: '대답이 오지 않았어(시간 초과)' });
    }, TURN_STALL_MS);
  }
  onData(d) {
    this.buf += d;
    let i;
    while ((i = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, i); this.buf = this.buf.slice(i + 1);
      if (!line.trim()) continue;
      let m; try { m = JSON.parse(line); } catch { continue; }
      this.onEvent(m);
    }
  }
  onEvent(m) {
    if (m.type === 'system' && m.subtype === 'init') {
      this.ready = true;
      if (m.session_id && m.session_id !== this.sessionId) { this.sessionId = m.session_id; this.onSession?.(this.form, m.session_id); }
      return;
    }
    const t = this.turn; if (!t) return;
    if (m.type === 'stream_event') {
      const ev = m.event;
      if (ev?.type === 'content_block_delta' && typeof ev.delta?.text === 'string') { t.text += ev.delta.text; this.watch(); t.onDelta(t.text); }
    } else if (m.type === 'assistant') {
      // 전체 메시지: 델타를 놓쳤어도 여기서 맞춘다
      const full = (m.message?.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
      // 생각(thinking)만 든 조각이 먼저 오기도 한다(haiku 실측) — 글이 든 조각이 와야 끝으로 본다
      if (!full) return;
      if (full !== t.text) { t.text = full; t.onDelta(full); }
      // result 는 post_turn_summary 뒤에 1초쯤 늦게 오므로 여기서 바로 끝낸 것으로 본다
      this.finish({ ok: true });
    } else if (m.type === 'result') {
      if (this.turn) this.finish({ ok: !m.is_error, error: m.is_error ? m.result : undefined });
    }
  }
  finish(extra) {
    const t = this.turn; if (!t) return; this.turn = null;
    clearTimeout(this.turnTimer);
    this.touch();
    t.onDone({ ...extra, text: t.text.trim(), sessionId: this.sessionId, durationMs: Date.now() - t.started });
  }
}

const procs = {};
function get(form, opts) {
  if (!procs[form]) procs[form] = new ChatProc(form, opts);
  else {
    procs[form].model = opts.model;
    if (!procs[form].alive()) { if (opts.sessionId) procs[form].sessionId = opts.sessionId; procs[form].extraPrompt = opts.extraPrompt || ''; }
  }
  return procs[form];
}
// 하루가 바뀌면(memory.js) 그 폼의 상주 프로세스를 내리고 다음엔 새 세션으로 띄운다
function reset(form) { const p = procs[form]; if (p) { p.kill(); p.sessionId = null; } }
function warm(form, opts) { const p = get(form, opts); if (!p.alive()) p.spawn(); }
function send(form, text, opts, handlers) { return get(form, opts).send(text, handlers); }
function cancel() { Object.values(procs).forEach(p => p.cancel()); }
function busy() { const p = Object.values(procs).find(p => p.turn); return p ? { kind: 'chat', form: p.form } : null; }
function killAll() { Object.values(procs).forEach(p => p.kill()); }
// 음성 모드 동안은 두 캐릭터의 잡담 프로세스를 내리지 않는다(부르면 바로 답하게). 끄면 다시 쉬면 내린다.
let keepWarm = false;
function setKeepWarm(on) { keepWarm = !!on; Object.values(procs).forEach((p) => { if (p.alive()) p.touch(); }); }

module.exports = { warm, send, cancel, busy, killAll, reset, setKeepWarm, CHAT_CWD };
