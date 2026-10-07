// 마스코트가 다른 대화 세션에 대신 돌린 일(음성·⚡ 지시)의 기록을, 그 대화를 열어 둔 화면(데스크톱 앱·터미널)에 글로 남기게 한다(test/sessionnotes.test.js).
// 사용자 2026-10-03: "구두로 지시하고 이루어진 업무들도 정리해서 세션에 텍스트로 남겨두어라".
// 왜: 넘긴 일은 `claude -p --resume <id>` 로 돌아 그 대화의 기록(jsonl)에 턴으로 붙는다. 그런데 데스크톱 앱이 그 대화를 열어 둔 채면
// (앱이 `--resume=<id>` 프로세스를 계속 들고 있다) 앱은 그 턴을 모르고, 사용자가 앱에 다음 말을 치면 자기가 알던 마지막 말에 이어 붙인다 —
// 마스코트의 턴은 곁가지로 빠져 화면에 안 보인다(2026-10-03 이 프로젝트의 대화에서 음성 지시 셋이 그렇게 사라졌다). 갈래로 돌린 일은 처음부터 안 보인다.
// 그래서 그런 때는 기록을 ~/.skinclaude/session-notes/<세션 id>.json 에 UserPromptSubmit 훅 출력 그대로 써 둔다. 사용자가 그 대화에 다음 말을 치면
// 훅(hooks/session-note.sh)이 그걸 Claude 에게 건네고 치운다 → Claude 가 답 맨 앞에 정리해 적는다.
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

const MAX_ITEMS = 6, MAX_TEXT = 2500;

// 우리 말고 그 대화를 들고 있는 claude 프로세스가 있나(ps 의 명령 줄 목록에서). 데스크톱 앱은 `--resume=<id>`, 터미널은 `--resume <id>`·`-r <id>`.
function heldIn(psText, sessionId) {
  if (!sessionId) return false;
  const id = sessionId.replace(/[^0-9A-Za-z-]/g, '');
  const re = new RegExp(`(?:--resume[= ]|\\s-r )${id}(?:\\s|$)`);
  return String(psText || '').split('\n').some((line) => /claude/i.test(line) && re.test(line));
}
function heldElsewhere(sessionId) {
  return new Promise((resolve) => {
    execFile('/bin/ps', ['-axww', '-o', 'command='], { maxBuffer: 8 << 20, timeout: 3000 }, (err, out) => resolve(!err && heldIn(out, sessionId)));
  });
}

const clip = (s, n) => { const t = String(s || '').trim(); return t.length > n ? `${t.slice(0, n)}…(줄임)` : t; };
const hhmm = (at) => { const d = new Date(at); return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

// 훅이 Claude 에게 건넬 글. items: [{ at, via('음성'|'⚡ 입력'), who, heard, instruction, ok, text, forkId }]
function noteText(items) {
  const lines = [
    '[마스코트 알림] 사용자가 데스크톱 마스코트(초텐·아메)로 이 대화에 맡긴 일이 따로 실행(claude -p --resume)되어 끝났다. 그 턴들은 지금 이 화면의 대화 흐름에 이어지지 않아 사용자에게 보이지 않는다.',
    '사용자는 그런 일도 이 대화에 글로 정리해 남겨 두기를 원했다(2026-10-03). 이번 답의 맨 앞에 "### 음성 지시 작업 기록" 제목으로 아래 일들을 짧게 정리해 적은 뒤(시각, 받은 지시, 한 일·바꾼 것, 결과·남은 일), 사용자의 지금 말에 답해라. 사용자가 쓰는 언어로.',
    '그 일에서 바꾼 파일은 이미 디스크에 반영돼 있다 — 다시 하지 말고, 필요하면 지금 파일을 읽어 확인해라.',
    '',
  ];
  items.forEach((it, i) => {
    lines.push(`${i + 1}) ${hhmm(it.at)} · ${it.via || '음성'}${it.who ? ` · ${it.who}` : ''}${it.ok === false ? ' · 실패' : ''}${it.forkId ? ` · 갈래 세션 ${it.forkId}` : ''}`);
    if (it.heard && it.heard !== it.instruction) lines.push(`받아쓴 말: ${clip(it.heard, 400)}`);
    lines.push(`넘긴 지시: ${clip(it.instruction, 1200)}`);
    lines.push(`결과(그 실행의 마지막 답):\n${clip(it.text, MAX_TEXT)}`, '');
  });
  return lines.join('\n').trim();
}
const hookOutput = (items) => JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: noteText(items) } });

// 한 건 더 쌓는다. 훅이 앞의 것을 이미 내보냈으면(<id>.json 이 없으면) 새로 시작한다.
function addNote(dir, sessionId, item) {
  const id = String(sessionId || '').replace(/[^0-9A-Za-z-]/g, ''); // 훅(session-note.sh)이 읽는 글자와 같게
  if (!id) return null;
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${id}.json`), list = path.join(dir, `${id}.items.json`);
  let items = [];
  if (fs.existsSync(out)) { try { items = JSON.parse(fs.readFileSync(list, 'utf8')); } catch { items = []; } }
  items = [...(Array.isArray(items) ? items : []), item].slice(-MAX_ITEMS);
  fs.writeFileSync(list, JSON.stringify(items));
  fs.writeFileSync(`${out}.tmp`, hookOutput(items));
  fs.renameSync(`${out}.tmp`, out); // 훅이 반쯤 쓴 파일을 읽지 않게
  return out;
}

module.exports = { heldIn, heldElsewhere, noteText, hookOutput, addNote };
