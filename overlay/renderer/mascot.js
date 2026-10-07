// 마스코트 동작 — 훅 이벤트를 표정·대사로 바꾸고, 입력 패널로 잡담·지시를 보낸다.
// 톤 규칙은 txtgame mascotLines.ts와 같다. 초텐쨩: 밝고 호들갑, ♡, 유저를 "P". 아메: 건조·"…"·츤데레, 이모지 없음.
// 이미지 카탈로그: assets/char 에 실제로 있는 파일 이름(확장자 제외). 새 이미지를 넣으면 여기에 추가한다.
let FILES = new Set(); // main 이 assets/char 폴더를 읽어 config.files 로 보내준다
// 감정 키 → 파일 접미사 후보(앞에서부터 있는 것을 쓴다). 새 표정 파일이 생기면 후보 맨 앞에 넣기만 하면 된다.
const EMO_FILES = {
  idle:      ['default'],
  joy:       ['joy', 'dere', 'peace'],
  shy:       ['shy', 'dere'],
  pout:      ['pout', 'angry', 'contempt', 'yandere'],
  worried:   ['worried', 'thinking', 'default'],
  jealous:   ['jealous', 'angry', 'yandere', 'contempt'],
  sleepy:    ['sleepy', 'default'],   // 의상에선 기본 컷(파자마=베개 안은 졸린 컷)
  surprised: ['surprised', 'shy', 'default'],
  smug:      ['smug', 'smirk', 'peace', 'contempt'],
  sad:       ['sad', 'thinking', 'default'],
  laugh:     ['laugh', 'joy', 'dere'],
  love:      ['love', 'dere', 'shy'],
  thinking:  ['thinking', 'vape', 'smoke', 'smoking', 'default'],
  wave:      ['wave', 'joy', 'dere', 'default'],
  cheer:     ['cheer', 'joy', 'dere'],
  rude:      ['rude', 'contempt', 'pout', 'angry'],
  smoke:     ['smoke', 'smoking', 'vape', 'heat'],
  // 터치 대사용(touch.js)
  peace:     ['peace', 'joy'],
  dere:      ['dere', 'love', 'shy'],
  contempt:  ['contempt', 'smirk', 'pout'],
  smirk:     ['smirk', 'smug', 'contempt'],
  angry:     ['angry', 'pout', 'rude'],
  yandere:   ['yandere', 'jealous', 'pout'],
  // 훅 이벤트용
  think:     ['thinking', 'vape', 'smoke', 'smoking', 'default'],
  tool:      ['peace', 'smirk', 'default'],
  done:      ['cheer', 'joy', 'dere'],
  alert:     ['angry', 'yandere', 'contempt', 'default'],
};
const TAG_EMO = { '기쁨': 'joy', '부끄러움': 'shy', '삐짐': 'pout', '걱정': 'worried', '질투': 'jealous', '졸림': 'sleepy', '놀람': 'surprised',
  '자신만만': 'smug', '슬픔': 'sad', '웃음': 'laugh', '사랑': 'love', '생각': 'thinking', '인사': 'wave', '응원': 'cheer', '짜증': 'rude', '담배': 'smoke', '기본': 'idle' };
let costume = 'base';
function resolveImage(f, key) {
  let cands = EMO_FILES[key] || EMO_FILES.idle;
  if (key === 'smoke') cands = [...cands].sort(() => Math.random() - 0.5); // 연초·액상·궐련형 중 있는 것을 번갈아
  if (costume !== 'base') {
    // 의상 전용 표정 → 의상 기본 컷. 기본복 표정으로 넘어가면 옷이 바뀌어 보이므로 그보다 먼저 의상 기본 컷을 쓴다.
    for (const c of cands) if (FILES.has(`${f}_${costume}_${c}`)) return `${f}_${costume}_${c}`;
    if (FILES.has(`${f}_${costume}`)) return `${f}_${costume}`;
  }
  for (const c of cands) if (FILES.has(`${f}_${c}`)) return `${f}_${c}`;
  return `${f}_default`;
}
const LINES = {
  choten: {
    hello:  ['P! 초텐쨩 강림~♡ 오늘도 코딩 파이팅!', '짜잔~ 여기 있었지? 나야 나♡', '젤방와~ P♡ 인터넷 엔젤 등장!'],
    done:   ['다 했어~♡ 확인해봐 P!', '짜잔! 어때 어때?', '끝! 칭찬해줘♡', '완성~! P 최고야♡ †승천†'],
    perm:   ['P! 허락 좀 해줘~♡ 기다리고 있어!', '똑똑! 승인 필요해♡'],
    idle:   ['P… 심심해… 놀아줘♡', '가만히 있으면 잠들 것 같아~'],
    poke:   ['히익!? 간지럽잖아♡', 'P 왜~ 뭐 필요해?', '초텐쨩 여기 있어~♡'],
    listen: ['응응, 말해봐 P♡', '뭐든 들어줄게~!', '지시야 잡담이야? 둘 다 좋아♡'],
    relay:  ['오케이~ 클로드한테 넘길게♡ 폴더는 {cwd}!', '접수! 클로드 출동~♡'],
    cancel: ['에엥, 취소했어… 다음엔 끝까지 하자♡'],
    fail:   ['으앙, 안 됐어… {err}', '실패했어 P… {err}'],
    transform: ['…아메로 바꿀 거야? 흥, 금방 돌아올 거지?'],
  },
  ame: {
    hello:  ['…왔다.', '…뭐. 보고 있을 테니까.', '…왔어, P쨩. 늦었잖아.'],
    done:   ['…끝났다. 확인해.', '…됐다. 딱히 너 때문은 아니고.', '…봐.', '…끝. 칭찬은 받아 줄게.'],
    perm:   ['…허락. 기다린다.', '…네 결정이다. 빨리.'],
    idle:   ['…', '…심심하지 않다. 착각하지 마.'],
    poke:   ['…건드리지 마.', '…뭐.', '…왜.'],
    listen: ['…말해.', '…듣고 있다.'],
    relay:  ['…클로드에게 넘긴다. {cwd}.', '…전달했다.'],
    cancel: ['…취소했다.'],
    fail:   ['…실패. {err}', '…안 됐다. {err}'],
    transform: ['…초텐으로 돌아간다. 아쉬워하지 마.'],
  },
};
// 여러 세션이 동시에 떠들어도 말풍선이 따로 뜨니, 읽어야 하는 말(끝난 세션 요약·잡담 답·허락 요청)은 넉넉히 둔다
const HELLO_HOLD = 3400, LINE_HOLD = 3200, DONE_HOLD = 20000, CHAT_HOLD = 20000, TASK_HOLD = 30000;
// 이름은 Claude 앱의 권한 선택과 같게(사용자 2026-10-07 "클로드 앱과 동일한 표현으로": 자동 수락·권한 무시)
const PERM_LABEL = { acceptEdits: '자동 수락', plan: '계획 모드', bypassPermissions: '권한 무시', auto: '자동' };

const $ = (id) => document.getElementById(id);
const root = $('mascot'), img = $('img'), stack = $('bubbles');
const costumeSel = $('costume');
const panel = $('panel'), input = $('input'), modeBtn = $('mode'), folderEl = $('folder'), permSel = $('perm'), goBtn = $('go'), cancelBtn = $('cancel'), barFoot = $('bar-foot');
const logEl = $('log'), logList = $('log-list'), settingsEl = $('settings');

let form = 'choten', config = {};
let sendMode = 'chat';          // 'chat' | 'task'
let running = null;             // { kind, sessionId }
let idleTimer = null;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function setImg(kind) { img.src = `../assets/char/${resolveImage(form, kind)}.png`; }
function line(kind, vars = {}) {
  const t = pick(LINES[form][kind] || LINES[form].idle);
  return t.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}
/* ── 말풍선: 말하는 쪽(key)마다 하나씩 최대 3개를 캐릭터 위로 쌓는다(bubbles.js) ──
   key: 's:<세션 id>'(다른 Claude Code 세션), 'task'(입력창·크롬 지시), 'chat'(잡담), 'self'(인사·터치 등 마스코트 자신).
   prio 1 = 읽어야 하는 말(잡담 답·작업 결과·끝난 세션 요약·허락 요청·터치 반응), 0 = 진행 중계·혼잣말.
   자리가 없으면 덜 중요하고 오래 안 바뀐 말풍선부터 비운다. */
const slots = BUBBLES.createSlots({ max: 3 });
const HAS_KANA = /[\u3040-\u30ff]/; // 히라가나·가타카나가 있으면 일본어로 본다
const bubbles = new Map(); // key → { item, box, textEl, tagEl, openEl, timer }
function makeBubble() {
  const item = document.createElement('div'); item.className = 'bubble-item';
  const tagEl = document.createElement('div'); tagEl.className = 'bubble-tag'; tagEl.hidden = true;
  const box = document.createElement('div'); box.className = 'mascot-bubble';
  const textEl = document.createElement('span'); textEl.className = 'bubble-text';
  const openEl = document.createElement('button'); openEl.className = 'bubble-btn'; openEl.textContent = '앱에서 열기'; openEl.hidden = true;
  openEl.addEventListener('click', () => { if (openEl.dataset.session) window.overlay.openInApp(openEl.dataset.session); });
  box.append(textEl, openEl); item.append(tagEl, box);
  return { item, box, textEl, tagEl, openEl, timer: null };
}
function dropBubble(key, { now = false } = {}) {
  const b = bubbles.get(key); if (!b) return;
  clearTimeout(b.timer); bubbles.delete(key); slots.remove(key);
  if (now) { b.item.remove(); return; }
  b.item.classList.add('leaving');
  setTimeout(() => { b.item.remove(); fitBubbles(); }, 180);
}
function clearBubbles() { for (const key of [...bubbles.keys()]) dropBubble(key, { now: true }); }
// tag: 말풍선 위 이름표("세션 제목 · 폴더"). Claude Code 세션 얘기일 때만 주고, 그냥 대화는 비워 둔다.
function say(text, holdMs = LINE_HOLD, { key = 'self', prio = 0, openSession = null, sticky = false, pop = true, tag = '' } = {}) {
  if (!text) return;
  const r = slots.place(key, prio, Date.now());
  if (r.action === 'drop') return; // 더 중요한 말풍선 셋이 떠 있다
  if (r.victim) dropBubble(r.victim);
  let b = bubbles.get(key);
  if (!b) { b = makeBubble(); bubbles.set(key, b); stack.appendChild(b.item); pop = true; }
  b.textEl.textContent = text;
  b.textEl.lang = HAS_KANA.test(text) ? 'ja' : 'ko'; // 일본어면 글자 사이 줄바꿈(style.css)
  b.tagEl.textContent = tag; b.tagEl.hidden = !tag;
  b.box.classList.toggle('long', text.length > 80);
  b.openEl.hidden = !openSession; b.openEl.dataset.session = openSession || '';
  fitBubbles();
  if (pop) { b.box.classList.remove('pop'); void b.box.offsetWidth; b.box.classList.add('pop'); }
  clearTimeout(b.timer);
  b.timer = sticky ? null : setTimeout(() => dropBubble(key), holdMs);
  bumpIdle();
}
// 말풍선 묶음이 창 가장자리에서 잘리면 안쪽으로 민다(--shift). 맨 아래 꼬리는 반대로 밀어(--tail) 캐릭터를 계속 가리키게 하되
// 몸통 모서리 밖으론 안 나가게. 위로 창을 넘으면 덜 중요한 것부터 뺀다.
function fitBubbles() {
  if (!bubbles.size) return;
  const pad = 6;
  for (let i = 0; i < 3 && bubbles.size > 1 && stack.getBoundingClientRect().top < pad; i++) dropBubble(slots.weakest(), { now: true });
  stack.style.setProperty('--shift', '0px'); stack.style.setProperty('--tail', '0px');
  const r = stack.getBoundingClientRect(); // 이름표까지 들어 있는 묶음 전체
  let s = 0;
  if (r.right > innerWidth - pad) s = innerWidth - pad - r.right;
  if (r.left + s < pad) s = pad - r.left;
  const last = stack.lastElementChild?.querySelector('.mascot-bubble');
  const w = last ? last.offsetWidth : 0, p0 = w / 2; // 꼬리 기본 위치: style.css 의 left:50%
  const t = Math.max(22 - p0, Math.min(w - 22 - p0, -s));
  stack.style.setProperty('--shift', s + 'px'); stack.style.setProperty('--tail', t + 'px');
}

/* ── 최근 대화 기록(📜): 읽어야 하는 말과 내가 보낸 말을 20개까지, 재시작해도 남게 localStorage 에 ── */
const LOG_KEY = 'skinclaude.log';
const LOG = BUBBLES.createLog({
  max: 20,
  load: () => JSON.parse(localStorage.getItem(LOG_KEY) || '[]'),
  save: (list) => localStorage.setItem(LOG_KEY, JSON.stringify(list)),
});
function remember(text, tag = '', who = 'mascot') {
  if (LOG.add({ text, tag, who, form }) && !logEl.hidden) renderLog();
}
function renderLog() {
  const items = LOG.list();
  if (!items.length) {
    const li = document.createElement('li'); li.className = 'log-empty'; li.textContent = '아직 기록이 없어.';
    return logList.replaceChildren(li);
  }
  logList.replaceChildren(...items.map((e) => {
    const li = document.createElement('li'); li.className = e.who === 'me' ? 'log-item me' : 'log-item';
    const who = e.who === 'me' ? (e.tag ? `나 · ${e.tag}` : '나') : (e.tag || (e.form === 'ame' ? '아메' : '초텐쨩'));
    const meta = document.createElement('div'); meta.className = 'log-meta'; meta.textContent = `${BUBBLES.clock(e.at)} · ${who}`;
    const body = document.createElement('div'); body.className = 'log-text'; body.textContent = e.text;
    body.lang = HAS_KANA.test(e.text) ? 'ja' : 'ko';
    li.append(meta, body);
    return li;
  }));
  logList.scrollTop = logList.scrollHeight;
}
// 기록(📜)·설정(⚙)은 캐릭터 왼쪽 같은 자리에 뜨니 하나만 연다. 왼쪽에 자리가 없으면(왼쪽 끝으로 끌어다 놓았으면) 오른쪽에
function placeSide(el) { el.classList.remove('flip'); if (el.getBoundingClientRect().left < 4) el.classList.add('flip'); }
function toggleLog(open = logEl.hidden) {
  logEl.hidden = !open;
  if (!open) return;
  settingsEl.hidden = true; renderLog(); placeSide(logEl);
}
function toggleSettings(open = settingsEl.hidden) {
  settingsEl.hidden = !open;
  SETTINGS_UI.watchUsage(open); // 열려 있는 동안만 Claude 사용량을 읽는다
  if (!open) return;
  logEl.hidden = true; placeSide(settingsEl);
}
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !settingsEl.hidden) toggleSettings(false); });
// 캐릭터 크기(설정): 창 높이에 안 들어가면 그만큼 줄여 쓴다. 바꾼 뒤 끌어 놓은 자리를 창 안으로 당긴다
function applyScale(s) {
  const cap = Math.max(0.6, (innerHeight - 160) / 300);
  root.style.setProperty('--scale', String(Math.min(Number(s) || 1, cap)));
  clampPosition();
}
// 창(=Claude 창 크기)이 줄어들면 드래그해 둔 마스코트가 밖으로 나가지 않게 안쪽으로 당긴다
function clampPosition() {
  if (!root.style.left) return;
  root.style.left = Math.max(0, Math.min(innerWidth - root.offsetWidth, parseFloat(root.style.left))) + 'px';
  root.style.top = Math.max(0, Math.min(innerHeight - root.offsetHeight, parseFloat(root.style.top))) + 'px';
}
function resetPosition() { root.style.left = ''; root.style.top = ''; root.style.right = ''; root.style.bottom = ''; fitBubbles(); reportHit(); }
let soundsOn = true; // 설정 '효과음'(띠링·또롱·진행음)
window.addEventListener('resize', () => {
  clampPosition(); applyScale(config.scale);
  fitBubbles();
});
function bumpIdle() { // 한참 조용하면 기본 컷, 가끔(30%) 담배 컷
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!running) { setImg(Math.random() < 0.3 ? 'smoke' : 'idle'); root.classList.remove('thinking'); say(line('idle')); } }, 90_000);
}
function shortenPath(p) { return (p || '').replace(/^\/Users\/[^/]+/, '~'); }

// 마크다운 응답을 말풍선용 짧은 문장으로
// 음성으로 맡긴 일의 답 끝에 붙는 '음성 지시 작업 기록'(voice.js RECORD_HEAD)은 그 대화에 남기는 것이라 말풍선에는 싣지 않는다
const RECORD_HEAD = /^\s{0,3}#{1,6}\s*(?:음성 지시 작업 기록|音声指示の作業記録|Voice task record)/mi;
function summarize(md, max = 150) {
  if (!md) return '';
  let t = String(md).split(RECORD_HEAD)[0]
    .replace(/```[\s\S]*?```/g, ' ').replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|[-*+]|\d+\.)\s+/gm, '').replace(/\*\*|__|~~/g, '')
    .replace(/\s+/g, ' ').trim();
  if (t.length > max) {
    const cut = t.slice(0, max);
    const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('다. '), cut.lastIndexOf('요. '));
    t = (stop > max * 0.4 ? cut.slice(0, stop + 1) : cut).trim() + '…';
  }
  return t;
}

/* ── 훅 이벤트 ── */
// 전역 훅(~/.claude/settings.json)으로 모든 Claude Code 세션의 작업이 들어온다. 무엇을 하는지는 narrate.js 가 대사로 만들고,
// 세션마다 따로 둔 pacer 가 한 줄을 최소 1.5초 보여 준 뒤 그사이 쌓인 것 중 가장 최근 것만 잇는다. 작업 중엔 그 세션의
// 말풍선을 띄워 둔 채 글만 바꾸고, 세션마다 말풍선이 따로라 한 세션의 중계가 다른 세션의 결과를 덮지 않는다.
const NARRATE_GAP = 1500, WORK_HOLD = 45_000, ASK_HOLD = 20_000, PERM_HOLD = 20_000, NOTE_HOLD = 8000;
const ACT_IMG = { read: 'think', search: 'think', find: 'think', web: 'think', fetch: 'think', ask: 'wave', plan: 'wave', fail: 'surprised' }; // 나머지는 tool
const pacers = new Map(); // 말풍선 key → pacer
function pacerFor(key) {
  let p = pacers.get(key);
  if (!p) {
    p = NARRATE.createPacer({ gap: NARRATE_GAP, show: (x) => { setImg(x.img); say(x.text, x.hold, { key: x.key, prio: x.prio, pop: x.pop, tag: x.tag }); } });
    pacers.set(key, p);
    if (pacers.size > 30) pacers.delete(pacers.keys().next().value);
  }
  return p;
}

function onHook(p) {
  const ev = p.hook_event_name;
  if (ev === 'Say') return say(p.text, 5000, { prio: 1 });
  const tag = p.session_label || ''; // main.js 가 붙인 "세션 제목 · 폴더" — 말풍선 위 이름표
  const key = p.source === 'task' ? 'task' : `s:${p.session_id || tag}`; // 입력창·크롬 지시의 중계는 그 결과가 뜰 말풍선 자리에
  const pacer = pacerFor(key);
  const now = (text, hold, img, prio = 1) => pacer.push({ text, hold, img, tag, key, prio, pop: true }, { urgent: true });
  // 지시 세션(source 'task')의 시작·알림·완료는 입력창 흐름(run-done)이 따로 보여 준다
  if (ev === 'UserPromptSubmit') {
    if (p.source === 'task') return;
    root.classList.add('thinking');
    now(NARRATE.lineFor(form, 'prompt'), WORK_HOLD, 'think', 0);
  } else if (ev === 'PreToolUse' || ev === 'PostToolUseFailure') {
    const { act, what } = NARRATE.actionOf(p);
    const kind = ev === 'PostToolUseFailure' ? 'fail' : act;
    const text = NARRATE.lineFor(form, kind, what);
    if (kind === 'ask' || kind === 'plan') { remember(text, tag); return now(text, ASK_HOLD, ACT_IMG[kind]); } // 사용자가 답해야 하니 바로, 오래
    pacer.push({ text, hold: WORK_HOLD, img: ACT_IMG[kind] || 'tool', tag, key, prio: 0 });
  } else if (ev === 'Notification') {
    if (p.source === 'task') return;
    root.classList.remove('thinking');
    if (p.notification_type === 'permission_prompt') { remember(p.message || line('perm'), tag); now(line('perm'), PERM_HOLD, 'alert'); }
    else if (p.notification_type === 'idle_prompt') now(line('idle'), LINE_HOLD, 'alert', 0);
    else { remember(p.message || line('perm'), tag); now(p.message || line('perm'), NOTE_HOLD, 'alert'); }
  } else if (ev === 'Stop') {
    if (p.source === 'task') return;
    root.classList.remove('thinking');
    const body = summarize(p.last_assistant_message);
    remember(body ? summarize(p.last_assistant_message, 500) : line('done'), tag); // 기록에는 말풍선보다 길게
    now(body ? `${line('done')}\n${body}` : line('done'), DONE_HOLD, 'done');
  }
}

/* ── 감정 태그: 답 맨 앞의 [태그]를 떼어 표정으로 바꾼다 ── */
// 문단마다 태그를 붙이기도 한다("[삐짐] …\n\n[응원] …"). 사용자 2026-10-07 "[사랑] [응원] 등의 감정상태가 표시되는데 가려지는 게 좋겠다" →
// 글 속의 태그도 모두 떼고, 표정은 지금까지 온 마지막 태그를 따른다(문단이 바뀌면 표정도 바뀐다). 아는 태그는 어디서든, 모르는 태그는
// 줄 머리의 짧은 [한글]만 뗀다("[여기](링크)" 같은 글은 둔다). 흘러오는 중 끝에 덜 온 "[응"도 감춘다
const TAG_IN_TEXT = new RegExp(`\\[(${Object.keys(TAG_EMO).join('|')})\\] ?|(?<=^|\\n)[ \\t]*\\[([가-힣]{1,6})\\](?!\\() ?`, 'g');
function splitEmotion(text) {
  const src = text || '';
  if (/^\s*\[[^\]\n]{0,6}$/.test(src)) return { emo: null, text: '', partial: true }; // "[기" 처럼 맨 앞 태그가 아직 다 안 온 상태
  const m = /^\s*\[([^\]\n]{1,6})\]\s*/.exec(src);
  let emo = m ? TAG_EMO[m[1]] || null : null;
  const body = (m ? src.slice(m[0].length) : src)
    .replace(TAG_IN_TEXT, (all, known, other) => { emo = TAG_EMO[known || other] || emo; return ''; })
    .replace(/\[[^\]\n]{0,6}$/, '');
  return { emo, text: body, partial: false };
}
let lastEmo = null;
// 태그가 빠진 답을 위한 대략적 추정 (모델이 규칙을 놓쳤을 때만)
function guessEmotion(t) {
  if (/질투|누구야|다른 (여자|사람|애)|딴 (여자|사람|애)/.test(t)) return 'jealous';
  if (/졸려|잠|자자|하암|피곤/.test(t)) return 'sleepy';
  if (/걱정|괜찬|괜찮아\?|무리|아프|힘들/.test(t)) return 'worried';
  if (/흥|삐|몰라|치사|안 놀아/.test(t)) return 'pout';
  if (/ㅋㅋ|하하|웃|푸흡|풉/.test(t)) return 'laugh';
  if (/좋아해|사랑|♡♡|보고 싶|곁에/.test(t)) return 'love';
  if (/부끄|뭘 봐|착각|시끄러|…뭐\./.test(t)) return 'shy';
  if (/\?!|!\?|헉|뭐\?|진짜\?/.test(t)) return 'surprised';
  if (/최고|짱|잘했|축하|대단|♡/.test(t)) return 'joy';
  if (/슬퍼|눈물|외로|서운/.test(t)) return 'sad';
  if (/당연|내가 누군데|맡겨|봤지\?/.test(t)) return 'smug';
  if (/^…|생각/.test(t)) return 'thinking';
  return null;
}
function showChatText(raw, hold, sticky) {
  let { emo, text, partial } = splitEmotion(CHROMEFLOW.visible(raw)); // 끝줄의 "[크롬] 할 일" 표시는 말풍선에 안 보인다
  if (partial) return;                       // "[기" 처럼 태그가 아직 다 안 온 상태
  if (!emo && !sticky) emo = guessEmotion(text); // 최종 답에만 추정 적용
  if (emo && emo !== lastEmo) { lastEmo = emo; setImg(emo); }
  if (text.trim()) say(text.trim(), hold, { sticky, key: 'chat', prio: 1, pop: false }); // 스트리밍 글자마다 튀지 않게(처음 뜰 때만 pop)
  return text.trim();
}

/* ── 실행 결과 ── */
// 입력창으로 맡긴 지시는 Claude Code 세션이라 이름표를 단다(잡담은 말풍선만)
const taskTag = (cwd) => { const p = NARRATE.projectOf(cwd); return `지시 · ${p === 'chrome' ? '크롬' : p}`; };
function onRunStart(r) {
  running = r; lastEmo = null;
  panel.classList.add('busy'); cancelBtn.hidden = false; goBtn.hidden = true; input.readOnly = true; // disabled 는 포커스를 잃게 해 직전 앱으로 돌아가 버린다
  setImg('think'); root.classList.add('thinking');
  workBeep(true);
  input.placeholder = r.kind === 'task' ? `클로드 작업 중… (${shortenPath(r.cwd)})` : '생각 중…';
  if (r.kind === 'task') say(line('relay', { cwd: shortenPath(r.cwd) }), 6000, { key: 'task', prio: 1, tag: taskTag(r.cwd) });
  else say('…', 0, { sticky: true, key: 'chat', prio: 1 }); // 첫 글자가 오면 바로 갈아치운다
}
function onRunDone(r) {
  const tag = r.kind === 'task' ? taskTag(running?.cwd || config.taskCwd) : '';
  const key = r.kind === 'task' ? 'task' : 'chat';
  running = null;
  workBeep(false);
  panel.classList.remove('busy'); cancelBtn.hidden = true; goBtn.hidden = false; input.readOnly = false;
  root.classList.remove('thinking'); input.placeholder = '말 걸기…';
  if (r.cancelled) { setImg('alert'); return say(line('cancel'), LINE_HOLD, { key, prio: 1, tag }); }
  if (!r.ok) {
    setImg('alert');
    const text = line('fail', { err: (r.error || '').slice(0, 160) });
    remember(text, tag);
    return say(text, 12000, { key, prio: 1, tag });
  }
  // 노래 재생처럼 결과가 바로 들리는 크롬 작업은 보고를 생략한다(사용자 2026-10-01). 진행 말풍선만 치우고 기록에만 남긴다.
  if (r.silent) { setImg('done'); dropBubble('task'); remember('♪ 재생 시작', tag); return; }
  if (r.kind === 'chat') {
    lastEmo = null; const { emo } = splitEmotion(r.text); if (!emo) setImg('done');
    remember(showChatText(r.text, CHAT_HOLD, false));
  } else {
    setImg('done');
    remember(summarize(r.text, 500), tag);
    say(`${line('done')}\n${summarize(r.text, 220)}`, TASK_HOLD, { key, prio: 1, openSession: r.sessionId, tag });
  }
  if (inputFocused) input.focus();
}

/* ── 입력 바: 늘 보이고, 포커스가 있을 때만 '열린' 것이다(main 의 inputOpen). 포커스를 잃으면 main 이 직전 앱으로 돌려준다 ── */
let inputFocused = false;
function openInput() { input.focus(); }
function closeInput() { if (document.activeElement === input) input.blur(); }
input.addEventListener('focus', () => {
  if (inputFocused) return;
  inputFocused = true; root.classList.add('typing'); window.overlay.setInputState(true);
  console.log('[input] 포커스', document.hasFocus() ? '(창도 포커스)' : '(창은 포커스 없음)');
  if (!running) { setImg('idle'); say(line('listen'), 4000, { prio: 1 }); }
});
input.addEventListener('blur', () => {
  if (!inputFocused) return;
  inputFocused = false; root.classList.remove('typing'); window.overlay.setInputState(false);
  console.log('[input] 포커스 잃음', document.hasFocus() ? '(창은 포커스 있음)' : '(창도 포커스 없음)', document.activeElement?.id || document.activeElement?.tagName || '');
});
function autoGrow() { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 62)}px`; } // 글이 길면 3줄까지
input.addEventListener('input', autoGrow);
function setSendMode(m) {
  sendMode = m;
  window.overlay.setSendMode(m); // 음성으로 한 말도 이 선택(잡담/지시)대로 보낸다
  modeBtn.textContent = m === 'task' ? '⚡' : '💬'; barFoot.hidden = m !== 'task'; // ⚡ 일 때만 입력칸 아래에 지시 폴더
  modeBtn.classList.toggle('task', m === 'task');
}
function submit(rawText, forced) {
  let text = rawText.trim(); if (!text) return;
  lastSeenAt = Date.now(); // 말을 걸고 있었으면 다음 터치에 "오랜만" 대사가 나오지 않게
  let kind = forced || sendMode;
  if (text.startsWith('>')) { kind = 'task'; text = text.slice(1).trim(); }
  if (!text) return;
  input.value = ''; autoGrow();
  remember(text, kind === 'task' ? '지시' : '', 'me');
  window.overlay.send({ text, mode: kind, form });
}
input.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.preventDefault(); closeInput(); }
  else if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!running) submit(input.value); }
});
modeBtn.addEventListener('click', () => setSendMode(sendMode === 'task' ? 'chat' : 'task'));
window.overlay.onSendModeSet?.((m) => setSendMode(m === 'task' ? 'task' : 'chat')); // 말로 바꿨을 때(main → 여기)
$('pick').addEventListener('click', () => window.overlay.pickFolder());
permSel.addEventListener('change', () => window.overlay.setPermissionMode(permSel.value));
costumeSel.addEventListener('change', () => { costume = costumeSel.value; window.overlay.setCostume(costume); setImg(lastEmo || 'idle'); });
cancelBtn.addEventListener('click', () => window.overlay.cancel());
goBtn.addEventListener('click', () => { if (!running) submit(input.value); input.focus(); });
$('logbtn').addEventListener('click', () => toggleLog());
$('settingsbtn').addEventListener('click', () => toggleSettings());
SETTINGS_UI.init({
  setSetting: (k, v) => window.overlay.setSetting(k, v), pickFolder: () => window.overlay.pickFolder(),
  onScale: applyScale, onSounds: (on) => { soundsOn = on; }, resetPosition, close: () => toggleSettings(false), shortenPath,
  getUsage: () => window.overlay.getUsage?.(),
});
$('log-close').addEventListener('click', () => toggleLog(false));

function applyConfig(c) {
  config = c || {};
  micBtn.classList.toggle('on', !!config.voice?.on);
  if (config.voice?.lang) vlangSel.value = config.voice.lang;
  if (Array.isArray(config.files) && config.files.length) { FILES = new Set(config.files); setImg(lastEmo || 'idle'); }
  // 긴 경로는 앞을 줄이려고 direction:rtl 로 보이는데, 그러면 맨 앞 "~/" 가 뒤로 가서 LRM(‎)으로 감싼다
  folderEl.textContent = `‎${shortenPath(config.taskCwd || '~')}‎`;
  folderEl.parentElement.title = `지시 폴더: ${config.taskCwd}`;
  if (config.permissionMode && PERM_LABEL[config.permissionMode]) permSel.value = config.permissionMode;
  if (config.costume && config.costume !== costume) { costume = config.costume; costumeSel.value = costume; setImg('idle'); }
  if ((config.sendMode === 'task' ? 'task' : 'chat') !== sendMode) setSendMode(config.sendMode === 'task' ? 'task' : 'chat'); // 다시 켜도 고른 방식 그대로
  if (config.form && config.form !== form) setForm(config.form, false);
  applyScale(config.scale); soundsOn = config.sounds !== false;
  SETTINGS_UI.apply(config);
}

/* ── 변신 ── */
function setForm(next, announce = true) {
  form = next;
  root.classList.toggle('form-ame', form === 'ame');
  root.classList.toggle('form-choten', form === 'choten');
  img.alt = form === 'ame' ? '아메' : '초텐쨩';
  setImg('idle');
  if (announce) say(line('hello'), HELLO_HOLD, { prio: 1 });
}
// to 를 주면 그 캐릭터로(이미 그 캐릭터면 그대로), 안 주면 번갈아. 연출 중에 다른 목표가 오면("초텐짱, 아메로 변신해") 목표만 바꾼다.
let transformTo = null;
function transform(to) {
  if (root.classList.contains('transforming')) { if (to) transformTo = to; return; }
  const next = to || (form === 'choten' ? 'ame' : 'choten');
  if (next === form) return;
  transformTo = next;
  root.classList.add('transforming'); clearBubbles();
  setTimeout(() => { const t = transformTo; if (t !== form) setForm(t); window.overlay.setForm(t); }, 480);
  setTimeout(() => root.classList.remove('transforming'), 1300);
}

/* ── 마우스: 클릭 영역 알리기, 드래그 이동 ──
   창은 평소 마우스를 통과시키고, main 이 커서 위치를 이 사각형들과 비교해 캐릭터·버튼·말풍선·입력창·기록 창 위에서만
   마우스를 받는다(hittest.js). 예전처럼 mouseenter 에 기대면 macOS 가 마우스 이동을 가끔 안 넘겨줘서 못 누르는 순간이 있었다. */
$('transform').addEventListener('click', () => transform()); // 버튼은 번갈아(클릭 이벤트를 목표로 넘기지 않게)
$('quit').addEventListener('click', () => window.overlay.quit());
const ctl = root.querySelector('.mascot-ctl');
let dragging = false, dx = 0, dy = 0, sx = 0, sy = 0, moved = false, lastHit = '';
function reportHit() {
  const rects = [img, ctl, panel, barFoot, logEl, settingsEl, ...stack.children]
    .filter((el) => el && !el.hidden)
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => [Math.floor(r.left), Math.floor(r.top), Math.ceil(r.width) + 1, Math.ceil(r.height) + 1]);
  const key = JSON.stringify([rects, dragging]);
  if (key === lastHit) return;
  lastHit = key;
  window.overlay.setHitRects({ rects, dragging });
}
setInterval(reportHit, 200); // 말풍선·패널·애니메이션으로 바뀌는 영역을 따라간다(바뀐 때만 보낸다)
// 클릭하는 손이 조금 떨려도(트랙패드) 터치로 본다. 예전엔 1px만 움직여도 끌기로 쳐서 터치 반응이 가끔 안 나왔다.
const DRAG_START = 5;
img.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  dragging = true; moved = false; sx = e.clientX; sy = e.clientY;
  const r = root.getBoundingClientRect(); dx = e.clientX - r.left; dy = e.clientY - r.top;
  reportHit();
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) < DRAG_START) return;
  if (!moved) { moved = true; root.classList.add('dragging'); }
  const x = Math.max(0, Math.min(window.innerWidth - root.offsetWidth, e.clientX - dx));
  const y = Math.max(0, Math.min(window.innerHeight - root.offsetHeight, e.clientY - dy));
  root.style.left = x + 'px'; root.style.top = y + 'px'; root.style.right = 'auto'; root.style.bottom = 'auto';
  fitBubbles(); reportHit();
});
window.addEventListener('mouseup', () => {
  if (!dragging) return; dragging = false; root.classList.remove('dragging');
  reportHit();
  if (!moved) poke(); // 입력창은 💬 버튼·단축키로 연다
});

/* ── 터치 반응: 의상별 [표정, 대사] (touch.js). 6초 안에 4번 이상 찌르면 spam, 30분 만이면 welcome,
      작업 중이면 절반은 working, 그 밖엔 30% 확률로 시간대·주말 대사(TOUCH_SITUATION) ── */
let pokeTimes = [], pokeRecent = [], pokeTimer = null, lastSeenAt = Date.now();
function situationLines(S, now) {
  const d = new Date(now), h = d.getHours();
  const tod = h < 5 ? 'dawn' : h < 10 ? 'morning' : h === 10 ? '' : h < 14 ? 'lunch' : h < 18 ? 'afternoon' : h < 22 ? 'evening' : 'night';
  return [...(S[tod] || []), ...((d.getDay() === 0 || d.getDay() === 6) && S.weekend || [])];
}
function poke() {
  const now = Date.now();
  pokeTimes = pokeTimes.filter((t) => now - t < 6000); pokeTimes.push(now);
  const T = TOUCH[form] || {}, S = TOUCH_SITUATION[form] || {};
  const away = now - lastSeenAt > 30 * 60e3; lastSeenAt = now;
  const sit = situationLines(S, now), dressPool = T[costume] || T.base || [];
  let pool = (pokeTimes.length >= 4 && T.spam)
    || (away && S.welcome)
    || (running && Math.random() < 0.5 && S.working)
    || (sit.length && Math.random() < 0.25 && sit)
    || dressPool;
  let fresh = pool.filter(([, t]) => !pokeRecent.includes(t)); // 최근 6마디는 피한다
  if (!fresh.length && pool !== dressPool) { pool = dressPool; fresh = pool.filter(([, t]) => !pokeRecent.includes(t)); } // 짧은 상황 풀을 다 썼으면 의상 대사로
  if (!pool.length) return;
  const [emo, text] = pick(fresh.length ? fresh : pool);
  pokeRecent = [text, ...pokeRecent.filter((t) => t !== text)].slice(0, 6);
  setImg(emo); say(text, LINE_HOLD, { prio: 1 });
  clearTimeout(pokeTimer);
  pokeTimer = setTimeout(() => { if (!running) setImg('idle'); }, LINE_HOLD + 800);
}

/* ── 음성 모드(main.js: sttd 가 듣고 ttsd 가 말한다) ──
   🎙 로 켜고 끄며, 입력창의 언어 선택이 듣기·말하기 언어를 같이 정한다. "쵸텐짱"·"아메짱"으로 불러야 대답하고,
   부른 캐릭터가 지금 모습과 다르면 변신한다. 대답 직후 잠깐은 이름 없이 이어 말해도 된다(버튼이 깜빡인다). */
const micBtn = $('mic'), vlangSel = $('vlang');
let voiceWasOn = false;
micBtn.addEventListener('click', () => window.overlay.setVoice({ on: !config.voice?.on }));
vlangSel.addEventListener('change', () => window.overlay.setVoice({ lang: vlangSel.value }));
const VOICE_HELLO = {
  choten: { ko: "🎙 음성 모드 켰어! '쵸텐짱' 하고 부르면 대답할게♡", ja: '🎙 音声モードON！「超てんちゃん」って呼んでね♡', en: '🎙 Voice mode on! Call me "Choten-chan"♡' },
  ame: { ko: "🎙 …'아메짱'이라고 부르면 듣는다.", ja: '🎙 …「あめちゃん」って呼べば、聞く。', en: '🎙 …Say "Ame-chan". I\'ll listen.' },
};
function onVoiceState(s) {
  const on = s.state !== 'off';
  micBtn.classList.toggle('on', on);
  micBtn.classList.toggle('awake', s.state === 'awake');
  micBtn.classList.toggle('speaking', s.state === 'speaking');
  micBtn.classList.toggle('error', s.state === 'error');
  micBtn.title = !on ? "음성 모드 켜기 — '쵸텐짱'·'아메짱'이라고 부르면 대답해요"
    : s.state === 'awake' ? '듣고 있어요(이름 없이 이어 말해도 돼요)' : s.state === 'speaking' ? '말하는 중(이땐 안 들어요)' : '음성 모드 켜짐 — 누르면 꺼요';
  if (s.state === 'error') say(`🎙 ${s.message}`, 10000, { prio: 1 });
  if (s.state === 'listening' && !voiceWasOn) say((VOICE_HELLO[form] || VOICE_HELLO.choten)[s.lang] || VOICE_HELLO.choten.ko, 6000, { prio: 1 });
  voiceWasOn = on;
  if (!on) workBeep(false);
}
// 소리는 WebAudio 컨텍스트 하나로 낸다(띠링·또롱과 목소리). 열어 둔 채면 조용해도 렌더러가 계속 무음을 계산해 대기 CPU 가
// 2~3% 올라서(2026-10-01 측정), 소리를 낼 때만 돌리고 끝나면 잠깐 뒤 멈춘다.
let audio = null, audioIdle = null;
function audioOn() {
  audio ??= new AudioContext();
  clearTimeout(audioIdle);
  if (audio.state === 'suspended') audio.resume();
  return audio;
}
function audioOffSoon(ms) { clearTimeout(audioIdle); audioIdle = setTimeout(() => { if (!vs) audio?.suspend(); }, ms); }
// 생각 중·진행 중 신호(사용자 요청 2026-10-01: "생각 중이거나 진행 중일 때는 똔 똔 똔 하는 비프음이 조그맣게"). 음성 모드가 켜져 있을 때만
// 0.75초마다 살짝 내려앉는 낮은 음을 띠링·또롱의 절반 크기(0.08)로 낸다(1/4 은 너무 작다고 했다). 캐릭터가 말하는 동안은 쉬고, 답이 오기 시작하거나 일이 끝나면 멈춘다.
const WORK_TICK_MS = 750;
let workTimer = null, workFirst = null;
function workTick() {
  if (!soundsOn) return; // 설정 '효과음' 끔
  if (vs && vs.next > 0) return; // 말하는 중엔 울리지 않는다(목소리가 나오기 시작한 뒤부터 — 답을 기다리는 동안은 울린다)
  try {
    const ctx = audioOn(), t = ctx.currentTime + 0.01;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, t); osc.frequency.exponentialRampToValueAtTime(392, t + 0.09); // C5 → G4, "똔"
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(g).connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.16);
  } catch {}
}
function workBeep(on) {
  if (on && voiceWasOn) {
    if (workTimer) return;
    workFirst = setTimeout(workTick, 400); // 또롱과 겹치지 않게 조금 뒤부터
    workTimer = setInterval(workTick, WORK_TICK_MS);
  } else if (workTimer) {
    clearTimeout(workFirst); clearInterval(workTimer); workTimer = null;
    if (!vs) audioOffSoon(400);
  }
}
// 띠링(start): 밝게 올라가는 두 음 — 이름을 알아듣고 듣는 중. 또롱(done): 둥글게 내려앉는 두 음 — 말을 다 알아들음.
// 소리 파일 없이 WebAudio 로 짧게 만든다.
const CHIMES = {
  start: { type: 'sine', notes: [[1318.5, 0, 0.12], [1760, 0.07, 0.26]] },      // E6 → A6
  done: { type: 'triangle', notes: [[1568, 0, 0.12], [1046.5, 0.08, 0.34]] },  // G6 → C6
};
function chime(kind) {
  const c = CHIMES[kind]; if (!c || !soundsOn) return; // 설정 '효과음' 끔
  try {
    const ctx = audioOn();
    const t0 = ctx.currentTime + 0.01;
    let end = 0;
    for (const [freq, at, dur] of c.notes) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = c.type; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + at);
      gain.gain.exponentialRampToValueAtTime(0.16, t0 + at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + at); osc.stop(t0 + at + dur + 0.02);
      end = Math.max(end, at + dur);
    }
    if (!vs) audioOffSoon((end + 0.3) * 1000);
  } catch {}
}
// 목소리 키우기(boost.js): main 이 말하는 동안 맥 음량을 낮추면(다른 소리를 줄이려고) 그만큼 목소리를 키워 튼다(voice-boost 는 배수).
let voiceBoost = 1;
const boostState = { env: 0 };
window.overlay.onVoiceBoost?.((g) => { voiceBoost = Math.max(1, Math.min(4, Number(g) || 1)); });
// 목소리는 약 0.5초 조각으로 흘러온다(main speakOne: start → chunk… → end). 받는 대로 WebAudio 로 틈 없이 이어 예약하고,
// end 뒤 마지막 조각까지 다 틀면 main 에 알린다(그때 다시 듣기 시작한다). quiet(시험)면 소리 크기 0으로 튼다.
let vs = null; // 지금 흘러오는 말 { out, next, live, ended, srcs }
function voiceStream(m) {
  try {
    if (m.type === 'start' || m.type === 'stop') {
      if (vs) { for (const s of vs.srcs) try { s.stop(); } catch {} vs = null; }
      if (m.type === 'stop') return audioOffSoon(300);
      const ctx = audioOn();
      const out = ctx.createGain(); out.gain.value = m.quiet ? 0 : 1; out.connect(ctx.destination);
      vs = { out, next: 0, live: 0, ended: false, srcs: [], g: null }; // g: 앞 조각 끝의 목소리 배수
      return;
    }
    const cur = vs;
    // 조각을 틀다가 오류로 흐름을 접었으면 끝 신호에는 바로 답한다(안 그러면 main 이 말 길이 + 5초를 기다린다)
    if (!cur) { if (m.type === 'end') window.overlay.voicePlayed(); return; }
    if (m.type === 'chunk') {
      const bytes = new Uint8Array(m.pcm); // 새로 복사해 2바이트 정렬된 버퍼로
      const pcm = new Int16Array(bytes.buffer, 0, bytes.byteLength >> 1);
      const buf = audio.createBuffer(1, pcm.length, m.sr || 24000);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
      // 목소리 배수(main 이 말마다 크기를 재서 정한다 × 사용자가 고른 배수)는 조각마다 조금씩 달라진다: 앞 조각 끝 값에서 이번 값까지 고르게 바꾼다
      const g = Math.max(0.2, Math.min(8, Number(m.gain) || 1));
      BOOST.apply(ch, m.sr || 24000, voiceBoost * g, boostState, voiceBoost * (cur.g ?? g)); // 넘치는 대목은 눌러 준다
      cur.g = g;
      // 조각마다 제 음량 손잡이를 둔다: 문장이 끝난 걸 알았을 때(rest) 앞 조각의 맨 끝 12ms 를 부드럽게 내려 딱 끊기는 소리를 없앤다
      const src = audio.createBufferSource(), fade = audio.createGain(); src.buffer = buf; src.connect(fade).connect(cur.out);
      if (m.rest && cur.lastFade && cur.lastEnd - 0.012 > audio.currentTime) {
        cur.lastFade.gain.setValueAtTime(1, cur.lastEnd - 0.012); cur.lastFade.gain.linearRampToValueAtTime(0, cur.lastEnd);
      }
      const at = Math.max(audio.currentTime + 0.05, cur.next); // 늦게 온 조각은 지금부터(짧은 틈)
      cur.lastFade = m.rest ? null : fade; cur.lastEnd = at + buf.duration;
      src.start(at); cur.next = at + buf.duration; cur.live++; cur.srcs.push(src);
      src.onended = () => { cur.live--; if (cur === vs && cur.ended && !cur.live) voiceDone(); };
    } else if (m.type === 'end') { cur.ended = true; if (!cur.live) voiceDone(); }
  } catch { voiceDone(); }
}
function voiceDone() { vs = null; audioOffSoon(300); window.overlay.voicePlayed(); }

/* ── 배선 ── */
window.overlay.onVoiceState(onVoiceState);
window.overlay.onVoiceStream(voiceStream);
window.overlay.onVoiceChime(chime);
window.overlay.onVoiceCall(({ who }) => transform(who)); // 이름으로 불렀거나 "○○로 변신"이라고 했을 때(main → 여기)
window.overlay.onVoiceHeard(({ text }) => remember(text, '음성', 'me'));
window.overlay.onHook(onHook);
window.overlay.onRunStart(onRunStart);
window.overlay.onRunDone(onRunDone);
window.overlay.onChatDelta((t) => { if (running?.kind === 'chat' && t) { root.classList.remove('thinking'); workBeep(false); showChatText(t, 0, true); } });
window.overlay.onVoiceWork?.((on) => workBeep(!!on)); // run-start 없이 도는 일(탭에서 바로 재생 등)
window.overlay.onConfig(applyConfig);
window.overlay.onUsage?.((u) => SETTINGS_UI.showUsage(u));
window.overlay.onOpenInput(openInput);
window.overlay.onCloseInput(closeInput);
window.overlay.onDebugSend(({ text, mode: m }) => { openInput(); submit(text, m); });
window.overlay.onTrack(() => {});
window.overlay.getConfig();
// 입력 방식(💬/⚡)은 main 이 설정에 적어 둔 것을 따른다(applyConfig). 여기서 잡담으로 되돌리지 않는다.

root.classList.add('descending');
setTimeout(() => root.classList.remove('descending'), 700);
say(line('hello'), HELLO_HOLD, { prio: 1 });
bumpIdle();
