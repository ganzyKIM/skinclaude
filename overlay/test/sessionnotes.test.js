// sessionnotes.js·hooks/session-note.sh·hooks/install-hook.js — 마스코트가 대신 돌린 일의 기록을 그 대화 화면에 남기기 (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const N = require('../sessionnotes.js');

const ID = '082ae5d7-fe11-4010-811f-86e7c6cae343';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'skinclaude-notes-'));

test('그 대화를 데스크톱 앱이나 터미널이 들고 있는지 ps 목록에서 본다', () => {
  const app = `/Users/x/Library/Application Support/Claude/claude-code/2.1.286/f/claude.app/Contents/MacOS/claude --output-format stream-json --verbose --input-format stream-json --effort max --model claude-opus-5-5 --permission-prompt-tool stdio --resume=${ID} --replay-user-messages`;
  assert.equal(N.heldIn(`/usr/sbin/cfprefsd agent\n${app}\n`, ID), true);
  assert.equal(N.heldIn(`/Users/x/.local/bin/claude --resume ${ID}`, ID), true);
  assert.equal(N.heldIn(`/Users/x/.local/bin/claude -r ${ID}`, ID), true);
  assert.equal(N.heldIn(app.replace(ID, 'fca5ec09-94ce-49ea-8818-03a12dd26f9a'), ID), false);
  assert.equal(N.heldIn(`/bin/zsh -c grep ${ID}`, ID), false); // claude 가 아닌 것
  assert.equal(N.heldIn(app, ''), false);
});

test('기록을 쌓아 훅 출력(JSON)으로 써 두고, 훅이 가져간 뒤에는 새로 시작한다', () => {
  const dir = tmp();
  const item = (n) => ({ at: Date.UTC(2026, 9, 3, 10, 15), via: '음성', who: '초텐', heard: `초텐짱 ${n}번 해 줘`, instruction: `${n}번 해 줘`, ok: true, text: `${n}번 했어요.` });
  const out = N.addNote(dir, ID, item(1));
  N.addNote(dir, ID, item(2));
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(j.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  const ctx = j.hookSpecificOutput.additionalContext;
  assert.match(ctx, /### 음성 지시 작업 기록/);
  assert.match(ctx, /1\) .*음성 · 초텐[\s\S]*받아쓴 말: 초텐짱 1번 해 줘[\s\S]*넘긴 지시: 1번 해 줘[\s\S]*1번 했어요\./);
  assert.match(ctx, /2\) [\s\S]*2번 했어요\./);
  // 훅이 가져가면(<id>.json 이 없어지면) 앞의 것은 다시 싣지 않는다
  fs.renameSync(out, path.join(dir, 'taken.json'));
  N.addNote(dir, ID, item(3));
  const ctx2 = JSON.parse(fs.readFileSync(out, 'utf8')).hookSpecificOutput.additionalContext;
  assert.doesNotMatch(ctx2, /1번 했어요/);
  assert.match(ctx2, /1\) [\s\S]*3번 했어요/);
  assert.equal(N.addNote(dir, '', item(4)), null);
});

const HOOK = path.join(__dirname, '..', 'hooks', 'session-note.sh');
const runHook = (home, input, env = {}) => execFileSync('/bin/sh', [HOOK], { input, env: { PATH: '/usr/bin:/bin', HOME: home, ...env } }).toString();

test('훅은 그 대화의 기록이 있을 때만 한 번 내보내고 치운다', () => {
  const home = tmp(), dir = path.join(home, '.skinclaude', 'session-notes');
  const input = JSON.stringify({ session_id: ID, transcript_path: '/x.jsonl', hook_event_name: 'UserPromptSubmit', prompt: '안녕' });
  assert.equal(runHook(home, input), ''); // 폴더가 없으면 조용히
  N.addNote(dir, ID, { at: Date.now(), via: '음성', instruction: '해 줘', ok: true, text: '했어요.' });
  assert.equal(runHook(home, input, { SKINCLAUDE_CHILD: '1' }), ''); // 마스코트가 띄운 실행에는 안 준다
  assert.equal(runHook(home, JSON.stringify({ session_id: 'other-id' })), ''); // 다른 대화
  const out = JSON.parse(runHook(home, input));
  assert.match(out.hookSpecificOutput.additionalContext, /했어요\./);
  assert.equal(fs.existsSync(path.join(dir, `${ID}.json`)), false);
  assert.equal(fs.existsSync(path.join(dir, `${ID}.items.json`)), false);
  assert.equal(fs.readdirSync(path.join(dir, 'sent')).length, 1);
  assert.equal(runHook(home, input), ''); // 두 번은 안 준다
});

test('설치는 ~/.claude/settings.json 에 훅을 한 번만 합쳐 달고, --remove 로 뗀다', () => {
  const home = tmp(), file = path.join(home, '.claude', 'settings.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const before = { env: { CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: '80' }, hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo stop' }] }] } };
  fs.writeFileSync(file, JSON.stringify(before), { mode: 0o600 });
  const run = (...args) => execFileSync(process.execPath, [path.join(__dirname, '..', 'hooks', 'install-hook.js'), ...args], { env: { ...process.env, HOME: home } }).toString();
  run(); run();
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(s.env, before.env);
  assert.deepEqual(s.hooks.Stop, before.hooks.Stop);
  assert.equal(s.hooks.UserPromptSubmit.length, 1);
  assert.match(s.hooks.UserPromptSubmit[0].hooks[0].command, /session-note\.sh/);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600); // 권한을 지킨다
  run('--remove');
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), before);
});
