// 잡담 기억(사용자 지시 2026-09-30): "하루 대화는 확실히 기억하고, 그 뒤는 장기 기억으로 요약해 보존".
// - 캐릭터(폼)마다 잡담 세션을 하루(새벽 5시 기준) 하나씩 쓴다. 그날 대화는 세션에 그대로 있어 정확히 기억한다.
// - 날이 바뀌면 지난 세션의 대화를 기록 파일(jsonl)에서 뽑아 요약하고 ~/.skinclaude/memory/<폼>.json 에 날짜별로 남긴다.
// - 날짜별 요약이 KEEP_DAYS 를 넘으면 오래된 것들을 "오래된 기억" 하나로 합쳐 프롬프트가 끝없이 커지지 않게 한다.
// - 새 세션을 띄울 때 이 기억을 시스템 프롬프트 뒤에 붙인다(chatd.js).
// 순수 함수는 test/memory.test.js, 요약은 claude -p(haiku)를 쓴다.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { claudeEnv } = require('./childenv');
const { spawn } = require('node:child_process');

const DAY_START_HOUR = 5;   // 새벽 5시에 하루가 바뀐다(밤새 이어지는 대화가 자정에 끊기지 않게)
const KEEP_DAYS = 14;       // 날짜별 요약을 이만큼 두고, 더 오래된 것은 "오래된 기억"으로 합친다
const MAX_DIALOGUE = 60_000; // 요약에 넣는 대화 글자 수 상한(뒤쪽 = 최근 것을 남긴다)
const NAMES = { choten: '초텐쨩', ame: '아메' };

// 새벽 5시 기준 날짜 'YYYY-MM-DD'(현지 시각)
function dayKey(date = new Date(), startHour = DAY_START_HOUR) {
  const d = new Date(date.getTime() - startHour * 3600_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 다음 하루 시작(새벽 5시)까지 남은 ms
function msUntilNextDay(date = new Date(), startHour = DAY_START_HOUR) {
  const next = new Date(date);
  next.setHours(startHour, 0, 0, 0);
  if (next <= date) next.setDate(next.getDate() + 1);
  return next - date;
}

// Claude Code 가 세션 기록을 두는 곳: ~/.claude/projects/<cwd 의 영숫자 아닌 글자를 '-'로>/<세션 id>.jsonl
function transcriptPath(cwd, sessionId, home = os.homedir()) {
  return path.join(home, '.claude', 'projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'), `${sessionId}.jsonl`);
}

// 세션 기록(jsonl)에서 사람이 읽을 대화만 뽑는다. 매 턴 붙이는 형식 힌트·메모, 감정 태그, 크롬 표시 줄은 뺀다.
function extractDialogue(jsonl, name = '마스코트') {
  const out = [];
  const clean = (t) => String(t || '').split('\n')
    .filter((l) => !/^\s*\((형식|메모|지금 시각):/.test(l) && !/^\s*\[(크롬|크롬 이어서|크롬 취소|확인 필요)\]/.test(l))
    .join('\n').replace(/^\s*\[[^\]\n]{1,6}\]\s*/, '').trim();
  for (const line of String(jsonl || '').split('\n')) {
    let m; try { m = JSON.parse(line); } catch { continue; }
    const c = m?.message?.content;
    const texts = typeof c === 'string' ? [c] : Array.isArray(c) ? c.filter((b) => b?.type === 'text').map((b) => b.text) : [];
    const text = clean(texts.join('\n'));
    if (!text) continue;
    if (m.type === 'user') out.push(`사용자: ${text}`);
    else if (m.type === 'assistant') out.push(`${name}: ${text}`);
  }
  const all = out.join('\n');
  return all.length > MAX_DIALOGUE ? all.slice(-MAX_DIALOGUE) : all;
}

const emptyMemory = () => ({ old: '', days: [], pending: [] });

// 새 세션 시스템 프롬프트 뒤에 붙일 기억 블록. 기억이 없으면 빈 문자열.
function buildPrompt(mem) {
  const parts = [];
  if (mem?.old) parts.push(`[오래된 기억]\n${mem.old}`);
  for (const d of mem?.days || []) parts.push(`[${d.day}]\n${d.summary}`);
  if (!parts.length) return '';
  return `\n★ 지난 대화 기억: 사용자와 예전에 나눈 대화를 날짜별로 정리한 것이다. 네가 직접 겪은 일처럼 자연스럽게 기억하고, 관련된 말이 나오면 떠올려 이어 간다. "요약"이나 "기록"이라는 말은 꺼내지 않는다. 오늘 대화는 이 세션에 그대로 있다.\n${parts.join('\n')}`;
}

// 날짜별 요약이 keep 개를 넘으면 합칠 오래된 날들(앞쪽)을 돌려준다
function toCondense(mem, keep = KEEP_DAYS) {
  const days = mem?.days || [];
  return days.length > keep ? days.slice(0, days.length - keep) : [];
}

const dailyPrompt = (name, day, dialogue) => `아래는 데스크톱 마스코트 "${name}"과 사용자(P)가 ${day}에 나눈 대화다. 마스코트가 오래 기억할 수 있게 요약해라.
- 사용자에 대해 알게 된 것(호칭·취향·하는 일·일정·건강·기분), 약속이나 부탁, 둘 사이에 있었던 일, 다음에 이어 갈 이야기를 먼저 적는다.
- 한국어로 3~10줄, 한 줄에 한 가지, "- "로 시작한다. 인사·되풀이된 잡담·말투 흉내는 뺀다.
- 대화에 있는 것만 적고 지어내지 않는다. 평가나 훈계 없이 있었던 일만 담담하게 적는다. 요약 줄만 출력한다.

대화:
${dialogue}`;

const condensePrompt = (name, old, days) => `아래는 데스크톱 마스코트 "${name}"이 사용자(P)와 나눈 지난 대화의 기억이다. 하나의 장기 기억으로 합쳐라.
- 계속 유효한 사실(사용자 정보·취향·관계·약속)과 중요한 사건은 남기고, 지난 일정·사소한 잡담은 뺀다. 날짜가 중요한 사건은 날짜를 붙인다.
- 평가나 훈계 없이 담담하게, 한국어로 15줄 이내, "- "로 시작한다. 요약 줄만 출력한다.

${old ? `[이전 장기 기억]\n${old}\n\n` : ''}${days.map((d) => `[${d.day}]\n${d.summary}`).join('\n\n')}`;

/* ── 파일·요약 실행(입출력) ── */
function claudeBin() {
  const c = [process.env.SKINCLAUDE_CLAUDE_BIN, path.join(os.homedir(), '.local', 'bin', 'claude'), '/opt/homebrew/bin/claude', '/usr/local/bin/claude'].filter(Boolean);
  return c.find((p) => { try { fs.accessSync(p, fs.constants.X_OK); return true; } catch { return false; } }) || 'claude';
}

// 도구 없이 haiku 로 한 번 요약한다(세션 기록은 남기지 않는다). 프롬프트는 stdin 으로 넣는다.
function runSummary(prompt, { cwd = os.tmpdir(), timeoutMs = 120_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(claudeBin(), ['-p', '--model', 'haiku', '--tools', '', '--setting-sources', 'project,local', '--no-session-persistence', '--output-format', 'text'], {
      cwd, stdio: ['pipe', 'pipe', 'pipe'],
      env: claudeEnv(), // 부모 Claude Code 세션 변수는 빼고(childenv.js)
    });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('요약 시간 초과')); }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      const text = out.trim();
      if (code === 0 && text) resolve(text); else reject(new Error((err || out || `exit ${code}`).trim().slice(0, 300)));
    });
    child.stdin.end(prompt);
  });
}

function createStore({ dir = path.join(os.homedir(), '.skinclaude', 'memory'), chatCwd, summarize = runSummary, keep = KEEP_DAYS } = {}) {
  const file = (form) => path.join(dir, `${form}.json`);
  const load = (form) => { try { return { ...emptyMemory(), ...JSON.parse(fs.readFileSync(file(form), 'utf8')) }; } catch { return emptyMemory(); } };
  const save = (form, mem) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file(form), JSON.stringify(mem, null, 2)); };

  // 지난 세션 하나를 요약해 기억에 넣는다. 실패하면 pending 에 두고 다음에 다시 한다(대화를 잃지 않게).
  async function archiveOne(form, mem, { sessionId, day }) {
    const name = NAMES[form] || form;
    let jsonl = '';
    try { jsonl = fs.readFileSync(transcriptPath(chatCwd, sessionId), 'utf8'); } catch { return true; } // 기록이 없으면 남길 것도 없다
    const dialogue = extractDialogue(jsonl, name);
    if (!dialogue) return true;
    const summary = await summarize(dailyPrompt(name, day, dialogue));
    const i = mem.days.findIndex((d) => d.day === day);
    if (i >= 0) mem.days[i] = { day, summary: `${mem.days[i].summary}\n${summary}` }; // 같은 날 세션이 둘이면 이어 붙인다
    else { mem.days.push({ day, summary }); mem.days.sort((a, b) => a.day.localeCompare(b.day)); }
    return true;
  }

  // 날이 바뀐 세션(과 예전에 실패한 것들)을 요약해 저장하고, 오래된 날짜는 합친다
  async function archive(form, old) {
    const mem = load(form);
    const queue = [...(mem.pending || []), ...(old?.sessionId ? [old] : [])];
    mem.pending = [];
    for (const item of queue) {
      try { await archiveOne(form, mem, item); } catch (e) { mem.pending.push(item); console.error('[memory] 요약 실패', form, item.day, e.message); }
    }
    const merge = toCondense(mem, keep);
    if (merge.length) {
      try {
        mem.old = await summarize(condensePrompt(NAMES[form] || form, mem.old, merge));
        mem.days = mem.days.slice(merge.length);
      } catch (e) { console.error('[memory] 합치기 실패', form, e.message); }
    }
    save(form, mem);
    return mem;
  }

  return { load, save, archive, prompt: (form) => buildPrompt(load(form)) };
}

module.exports = { dayKey, msUntilNextDay, transcriptPath, extractDialogue, buildPrompt, toCondense, createStore, dailyPrompt, KEEP_DAYS };
