// 사용자가 이 맥에서 Claude 와 작업해 온 프로젝트·대화 세션 목록(~/.claude/projects 의 세션 기록에서 읽는다, test/projects.test.js).
// 마스코트의 ⚡ 지시가 "포트폴리오 사이트 고쳐 줘"처럼 그 가운데 한 프로젝트의 일이면, 지시 에이전트가 이 목록을 보고 그 폴더의 그 대화 세션에
// 지시를 넘긴다(projects-mcp.js delegate → main.js startProjectTask). 사용자 요청 2026-10-02: "적절한 맥의 폴더를 찾고 클로드 대화 세션에
// 명령을 내릴 수 있도록 하라".
// 기록 파일은 수십~수백 MB 라(데스크톱 앱 세션) 앞 64KB 와 끝 512KB 만 읽는다.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(os.homedir(), '.claude', 'projects');
const HEAD = 64 * 1024, TAIL = 512 * 1024;

// Claude Code 가 세션 기록을 두는 폴더 이름: 작업 폴더 경로에서 영문자·숫자가 아닌 글자를 모두 '-' 로 바꾼 것
// ("/Users/a/.skinclaude/크롬" → "-Users-a--skinclaude---")
const encodeCwd = (p) => String(p).replace(/[^A-Za-z0-9]/g, '-');

function readRange(file, start, len) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(len);
    const n = fs.readSync(fd, buf, 0, len, start);
    return buf.subarray(0, n).toString('utf8');
  } finally { fs.closeSync(fd); }
}
const unq = (raw) => { try { return JSON.parse(`"${raw}"`); } catch { return raw; } };
function lastField(text, name) {
  const re = new RegExp(`"${name}":"((?:[^"\\\\]|\\\\.)*)"`, 'g');
  let m, v = null;
  while ((m = re.exec(text))) v = m[1];
  return v === null ? null : unq(v);
}
// 사용자가 처음 한 말(제목이 없는 세션의 이름 대신). 명령·도구 결과·시스템 메모는 건너뛴다
function firstPrompt(head) {
  for (const line of head.split('\n')) {
    if (!line.includes('"type":"user"')) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    if (o.type !== 'user' || o.isMeta || o.isSidechain) continue;
    let c = o.message?.content;
    if (Array.isArray(c)) c = c.filter((x) => x?.type === 'text').map((x) => x.text).join(' ');
    c = String(c || '').trim();
    if (!c || /^[<(\[]|^Caveat:/.test(c)) continue;
    return c.replace(/\s+/g, ' ');
  }
  return '';
}

// 세션 기록 하나 → { id, cwd, title, first, last, at, size } (이어 쓸 폴더를 못 찾으면 null).
// cwd 는 기록 폴더 이름과 맞는 것을 고른다: 세션 도중 cd 로 옮겨 다녀도 --resume 은 처음 폴더에서 해야 기록을 찾는다
// (txtgame 세션은 기록의 첫 cwd 가 skinclaude 였다 — 거기서 이어 쓰면 "No conversation found").
function readSession(file, dirName, { read = readRange, stat = fs.statSync } = {}) {
  let st; try { st = stat(file); } catch { return null; }
  const head = read(file, 0, Math.min(HEAD, st.size));
  const tail = st.size > HEAD ? read(file, Math.max(HEAD, st.size - TAIL), Math.min(TAIL, st.size - HEAD)) : '';
  const text = `${head}\n${tail}`;
  let cwd = null;
  for (const m of text.matchAll(/"cwd":"((?:[^"\\]|\\.)*)"/g)) { const c = unq(m[1]); if (encodeCwd(c) === dirName) { cwd = c; break; } }
  if (!cwd) return null;
  const title = lastField(tail, 'customTitle') || lastField(head, 'customTitle') || lastField(tail, 'aiTitle') || lastField(head, 'aiTitle') || '';
  return {
    id: path.basename(file, '.jsonl'), cwd, title,
    first: firstPrompt(head), last: lastField(tail, 'lastPrompt') || lastField(head, 'lastPrompt') || '',
    at: st.mtimeMs, size: st.size, model: lastModel(tail) || lastModel(head),
  };
}
// 그 대화에서 마지막으로 답한 모델(assistant 줄의 "model"). 도구 결과 속 글자는 따옴표가 \" 로 적혀 걸리지 않는다. "<synthetic>" 은 뺀다
function lastModel(text) {
  let m = null;
  for (const x of String(text || '').matchAll(/"model":"(claude-[^"\\]+)"/g)) m = x[1];
  return m;
}

// 넘긴 일은 그 대화의 설정대로 돌린다(사용자 2026-10-04 "그 지시를 받은 각 세션이 오퍼스나 페이블 등 설정되어 있는 세션으로 작업하면 된다").
// 데스크톱 앱 대화면 앱에서 고른 모델·effort — 앱이 대화마다 적어 두는 claude-code-sessions/<계정>/<조직>/local_<id>.json 을 cliSessionId 로 찾는다
// (앱은 그 값으로 `claude --model … --effort …` 를 띄운다). 앱에 없는 대화(터미널)면 그 대화가 마지막으로 쓴 모델. 둘 다 없으면(새 대화) CLI 기본값.
const APP_SESSIONS = path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude-code-sessions');
function appSettings(sessionId, { root = APP_SESSIONS } = {}) {
  if (!sessionId) return null;
  const dirs = (p) => { try { return fs.readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; } };
  for (const acct of dirs(root)) for (const org of dirs(path.join(root, acct))) {
    const dir = path.join(root, acct, org);
    let files = [];
    try { files = fs.readdirSync(dir).filter((f) => /^local_.+\.json$/.test(f)); } catch { continue; }
    for (const f of files) {
      let j = null;
      try { j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
      if (j?.cliSessionId === sessionId) return { model: j.model || null, effort: j.effort || null };
    }
  }
  return null;
}
function runSettings(sessionId, { model = null, root } = {}) {
  const app = appSettings(sessionId, root ? { root } : {});
  if (app?.model) return { model: app.model, effort: app.effort || null, from: 'app' };
  if (model) return { model, effort: null, from: 'log' };
  return { model: null, effort: null, from: null };
}

const under = (p, dir) => { const a = path.resolve(p), b = path.resolve(dir); return a === b || a.startsWith(b.endsWith(path.sep) ? b : b + path.sep); };

// 프로젝트(작업 폴더)별로 묶은 목록, 최근 순. exclude: 목록에서 뺄 폴더(그 아래 전부) — 오버레이 자신의 잡담·지시·크롬 세션, 임시 폴더.
// 제목도 첫 말도 없는 세션(빈 세션)과 도구·시험이 남긴 제목 없는 작은 세션은 뺀다.
function scan({ root = ROOT, exclude = [], home = os.homedir(), readSessionFn = readSession } = {}) {
  let dirs = [];
  try { dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; }
  const byCwd = new Map();
  for (const dirName of dirs) {
    let files = [];
    try { files = fs.readdirSync(path.join(root, dirName)).filter((f) => f.endsWith('.jsonl')); } catch { continue; }
    for (const f of files) {
      const s = readSessionFn(path.join(root, dirName, f), dirName);
      if (!s || exclude.some((x) => x && under(s.cwd, x))) continue;
      if (!s.title && !s.first) continue;
      // 제목 없는 작은 세션(100KB 안)은 도구·시험이 남긴 한두 마디짜리다. 홈 폴더 바로 아래의 제목 없는 세션도 마찬가지
      if (!s.title && (s.size < 100 * 1024 || path.resolve(s.cwd) === path.resolve(home))) continue;
      if (!byCwd.has(s.cwd)) byCwd.set(s.cwd, []);
      byCwd.get(s.cwd).push(s);
    }
  }
  return [...byCwd.entries()].map(([cwd, sessions]) => {
    sessions.sort((a, b) => b.at - a.at);
    return { cwd, name: path.basename(cwd) || cwd, sessions, at: sessions[0].at };
  }).sort((a, b) => b.at - a.at);
}

// 30초 동안은 다시 읽지 않는다(⚡ 지시마다 부른다)
let cache = null;
function listProjects(opts = {}, now = Date.now()) {
  const key = JSON.stringify([opts.root || ROOT, opts.exclude || []]);
  if (cache && cache.key === key && now - cache.at < 30_000) return cache.list;
  const list = scan(opts);
  cache = { key, at: now, list };
  return list;
}
const forget = () => { cache = null; };

// 그 폴더의 세션: idPrefix 를 주면 그걸로 시작하는 세션, 아니면 가장 최근 것
function findSession(projects, folder, idPrefix = '') {
  const p = projects.find((x) => path.resolve(x.cwd) === path.resolve(folder));
  if (!p) return null;
  const want = String(idPrefix || '').trim().toLowerCase();
  if (!want) return p.sessions[0] || null;
  return p.sessions.find((s) => s.id.toLowerCase().startsWith(want)) || null;
}

// 방금까지 기록이 바뀌고 있었으면(데스크톱 앱이나 터미널에서 그 대화를 쓰는 중) 그 대화에 끼어들지 않는다 — main 이 갈래로 이어 간다
const ACTIVE_MS = 90_000;
const isActive = (s, now = Date.now()) => !!s && now - s.at < ACTIVE_MS;

const pad = (n) => String(n).padStart(2, '0');
const stamp = (ms) => { const d = new Date(ms); return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const clip = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };
const sessionName = (s) => s.title || clip(s.first, 30);

// 지시 에이전트에게 주는 목록 글. 폴더마다 최근 대화 몇 개(제목·id 앞 8자리·마지막 쓴 때·마지막 지시)
function catalogText(projects, { maxProjects = 12, maxSessions = 3, now = Date.now() } = {}) {
  const lines = [];
  for (const p of projects.slice(0, maxProjects)) {
    lines.push(`- ${p.cwd}`);
    for (const s of p.sessions.slice(0, maxSessions)) {
      const busy = isActive(s, now) ? ', 지금 쓰는 중' : '';
      const last = s.last ? ` · 마지막 지시 "${clip(s.last, 40)}"` : '';
      lines.push(`    · "${sessionName(s)}" 대화 ${s.id.slice(0, 8)} (${stamp(s.at)}${busy})${last}`);
    }
    if (p.sessions.length > maxSessions) lines.push(`    · …그 밖에 대화 ${p.sessions.length - maxSessions}개`);
  }
  if (projects.length > maxProjects) lines.push(`(그 밖의 폴더 ${projects.length - maxProjects}개는 list_projects 로 본다)`);
  return lines.join('\n');
}

// ⚡ 지시 에이전트에게 주는 규칙과 목록(main.js 가 --append-system-prompt 로 붙인다). route: 마스코트가 최근에 넘긴 곳 { folder, sessionId, title, at },
// lastDispatch: 직전 ⚡ 지시와 에이전트의 답 { text, answer, at } — 어느 프로젝트냐고 되물었으면 다음 지시가 그 대답이다
function rulesText({ projects = [], route = null, lastDispatch = null, now = Date.now() } = {}) {
  const lines = [
    '[마스코트 ⚡ 지시 처리 규칙]',
    '너는 사용자의 데스크톱 마스코트(초텐·아메)가 넘긴 지시를 처리한다. 사용자는 이 맥에서 여러 프로젝트를 Claude 대화 세션으로 작업해 왔다(아래 목록).',
    '- 지시가 그 가운데 한 프로젝트의 일(그 프로젝트의 코드·글·디자인·설정을 고치거나, 하던 작업을 이어 가거나, 그 프로젝트에 대해 묻는 것)이면 네가 직접 하지 말고',
    '  mcp__skinclaude__delegate 로 그 폴더의 대화 세션에 넘긴 뒤 바로 끝낸다. 그 세션의 Claude 가 지난 대화와 맥락을 갖고 일하고, 진행과 결과는 마스코트가 알린다.',
    '  · instruction 에는 사용자가 한 말을 그대로 담는다(받아쓰기 오타만 바로잡는다). 네가 지어낸 세부 요구를 덧붙이지 않는다.',
    '  · 음성은 받아쓰기라 이름이 딴 말로 적혀 오기도 한다(예: "ポットフォリオ" → 포트폴리오). 소리나 뜻이 목록과 가까우면 그 프로젝트다.',
    '  · 어느 프로젝트인지 분명하지 않으면 넘기지 말고, 후보를 들어 한 문장으로 되묻는다.',
    '  · 목록에 없는 프로젝트면 폴더를 찾아(ls ~/Desktop ~/Documents ~/Developer, mdfind "kMDItemFSName == \'이름\'") mode "new" 로 넘긴다.',
    '  · "새 대화로"·"새 세션에서"라고 하면 mode "new". 한 폴더에 대화가 여럿이면 지시와 맞는 제목의 대화를 고른다.',
    '- 프로젝트와 상관없는 일(웹 검색·계산·질문에 답하기·이 폴더에서 하는 작은 일)은 지금처럼 네가 직접 한다.',
    '',
    '프로젝트 목록(최근 순, 대화 id 는 앞 8자리):',
    catalogText(projects, { now }) || '(기록 없음)',
  ];
  if (route && now - route.at < 6 * 3600_000) {
    lines.push('', `최근 마스코트가 넘긴 곳: "${route.title || path.basename(route.folder)}" (${route.folder}, 대화 ${String(route.sessionId || '').slice(0, 8)}, ${Math.round((now - route.at) / 60000)}분 전). `
      + '"이어서 해"·"그거"처럼 대상을 말하지 않은 이어지는 지시면 여기로 넘긴다(session_id 없이 folder 만 주면 이 대화로 간다).');
  }
  if (lastDispatch && now - lastDispatch.at < 5 * 60_000) {
    lines.push('', `직전 지시: "${clip(lastDispatch.text, 120)}" → 네 답: "${clip(lastDispatch.answer, 160)}" (되물었던 거면 이번 지시가 그 대답이다)`);
  }
  return lines.join('\n');
}

module.exports = { ROOT, encodeCwd, readSession, firstPrompt, lastModel, appSettings, runSettings, scan, listProjects, forget, findSession, isActive, ACTIVE_MS, catalogText, rulesText, sessionName, under };
