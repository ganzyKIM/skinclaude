# 오버레이 UI 정돈 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 입력칸을 항상 보이게 하고, 설정 패널(캐릭터 크기·목소리 크기·효과음·완료 알림·언어·지시 폴더·권한·오버레이 끄기)을 더하고, 앱의 모든 대화창 작업 완료를 목소리로 알린다.

**Architecture:** 렌더러는 입력 바 + 버튼 줄 + 옆에 뜨는 설정 패널(`renderer/settings.js`)로 재배치하고, main 은 설정 검사(`settings.js`)와 완료 알림 판단(`announce.js`)을 순수 모듈로 두고 IPC `set-setting` 하나로 설정을 받는다. 완료 알림은 훅 서버의 UserPromptSubmit→Stop 시간을 재서 `utterance(..., { announce: true })` 로 음성 모드가 꺼져 있어도 말한다.

**Tech Stack:** Electron(렌더러 바닐라 JS·CSS), Node 22 `node --test`, 기존 sttd/ttsd 음성 경로.

**Spec:** `docs/superpowers/specs/2026-10-07-overlay-ui-renewal-design.md`

## Global Constraints

- 저장소는 git 이 아니다 → 커밋 단계 없음. 대신 각 Task 끝에 `npm test`(overlay 폴더) 통과를 확인한다.
- 사용자에게 보이는 글·로그·주석은 한국어.
- 설정 키와 범위(spec §4): `scale` 0.6~1.4(기본 1), `voice.gain` 0.5~3(기본 1), `sounds` bool(기본 true), `announce.on` bool(기본 true), `announce.mode` 'line'|'summary'(기본 'line'), `announce.minSec` 0|10|30|60|180(기본 30), `voice.lang` ko|ja|en, `permissionMode` acceptEdits|auto|bypassPermissions|plan, `costume` 소문자 영문.
- 오버레이 재시작은 쉬는 틈에 한 번만(`/status` busy 없음, 마지막 말함 뒤 다 말함, 최근 들음·intent 12초 이상 지남). 소스 수정 후 `bash bin/overlay-ctl.sh install`.
- 마스코트 자신의 세션(`~/.skinclaude/` 아래 cwd)은 알리지 않는다. 음성으로 요청한 일은 결과를 읽으니 알림을 겹치지 않는다.

---

### Task 1: main 쪽 설정 검사 모듈 `settings.js`

**Files:**
- Create: `overlay/settings.js`
- Test: `overlay/test/settings.test.js`

**Interfaces:**
- Produces: `SETTINGS.DEFAULTS` (객체), `SETTINGS.withDefaults(config) → config`(얕은 복사 + 빠진 기본값 채움), `SETTINGS.apply(config, key, value) → config | null`(허용 목록·범위 검사, 통과하면 새 config, 아니면 null). Task 4 의 `set-setting` IPC 와 `loadConfig` 가 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// overlay/test/settings.test.js — 설정 패널에서 오는 값의 허용 목록·범위 검사 (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../settings.js');

test('기본값을 채운다(있는 값은 그대로)', () => {
  const c = S.withDefaults({ form: 'ame', voice: { on: true, lang: 'ja', gain: 2 } });
  assert.equal(c.scale, 1);
  assert.equal(c.sounds, true);
  assert.deepEqual(c.announce, { on: true, mode: 'line', minSec: 30 });
  assert.deepEqual(c.voice, { on: true, lang: 'ja', gain: 2 });
  assert.equal(c.form, 'ame');
});

test('범위 안의 값은 받고 밖이면 null', () => {
  const base = S.withDefaults({});
  assert.equal(S.apply(base, 'scale', 1.4).scale, 1.4);
  assert.equal(S.apply(base, 'scale', 0.6).scale, 0.6);
  assert.equal(S.apply(base, 'scale', 1.5), null);
  assert.equal(S.apply(base, 'scale', 'abc'), null);
  assert.equal(S.apply(base, 'voice.gain', 3).voice.gain, 3);
  assert.equal(S.apply(base, 'voice.gain', 0.4), null);
  assert.equal(S.apply(base, 'announce.minSec', 60).announce.minSec, 60);
  assert.equal(S.apply(base, 'announce.minSec', 45), null);
  assert.equal(S.apply(base, 'announce.mode', 'summary').announce.mode, 'summary');
  assert.equal(S.apply(base, 'announce.mode', 'long'), null);
  assert.equal(S.apply(base, 'announce.on', false).announce.on, false);
  assert.equal(S.apply(base, 'sounds', false).sounds, false);
  assert.equal(S.apply(base, 'sounds', 'no'), null);
  assert.equal(S.apply(base, 'voice.lang', 'en').voice.lang, 'en');
  assert.equal(S.apply(base, 'voice.lang', 'fr'), null);
  assert.equal(S.apply(base, 'permissionMode', 'plan').permissionMode, 'plan');
  assert.equal(S.apply(base, 'costume', 'saint').costume, 'saint');
  assert.equal(S.apply(base, 'costume', '../x'), null);
  assert.equal(S.apply(base, 'chatModel', 'opus'), null); // 허용 목록 밖
});

test('원본은 건드리지 않고 다른 하위 값은 남긴다', () => {
  const base = S.withDefaults({ voice: { on: true, lang: 'ko', gain: 1, aec: 'ref' } });
  const next = S.apply(base, 'voice.gain', 2);
  assert.equal(base.voice.gain, 1);
  assert.deepEqual(next.voice, { on: true, lang: 'ko', gain: 2, aec: 'ref' });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/dobedub/Desktop/skinclaude/overlay && node --test test/settings.test.js`
Expected: FAIL — `Cannot find module '../settings.js'`

- [ ] **Step 3: 구현**

```js
// settings.js — 설정 패널(renderer/settings.js)에서 오는 값의 허용 목록과 범위. main 은 통과한 값만 config 에 넣는다(test/settings.test.js).
// 키는 'voice.gain' 처럼 점으로 하위 객체를 가리킨다. 범위 밖·모르는 키면 null 을 돌려주고 main 이 로그만 남긴다.
const DEFAULTS = { scale: 1, sounds: true, announce: { on: true, mode: 'line', minSec: 30 } };
const RULES = {
  scale: (v) => typeof v === 'number' && v >= 0.6 && v <= 1.4,
  sounds: (v) => typeof v === 'boolean',
  'voice.gain': (v) => typeof v === 'number' && v >= 0.5 && v <= 3,
  'voice.lang': (v) => ['ko', 'ja', 'en'].includes(v),
  'announce.on': (v) => typeof v === 'boolean',
  'announce.mode': (v) => ['line', 'summary'].includes(v),
  'announce.minSec': (v) => [0, 10, 30, 60, 180].includes(v),
  permissionMode: (v) => ['acceptEdits', 'auto', 'bypassPermissions', 'plan'].includes(v),
  costume: (v) => typeof v === 'string' && /^[a-z]+$/.test(v),
};
function withDefaults(config) {
  const c = { ...DEFAULTS, ...(config || {}) };
  c.announce = { ...DEFAULTS.announce, ...(config?.announce || {}) };
  return c;
}
function apply(config, key, value) {
  const ok = RULES[key];
  if (!ok || !ok(value)) return null;
  const next = { ...config };
  const [head, sub] = String(key).split('.');
  if (sub) next[head] = { ...(config[head] || {}), [sub]: value };
  else next[head] = value;
  return next;
}
module.exports = { DEFAULTS, withDefaults, apply };
```

- [ ] **Step 4: 통과 확인**

Run: `node --test test/settings.test.js`
Expected: PASS (3 tests)

---

### Task 2: 완료 알림 대사 `VOICE.doneLine`

**Files:**
- Modify: `overlay/voice.js` (DELEGATE/delegateLine 바로 아래, module.exports)
- Test: `overlay/test/voice.test.js` (끝에 추가)

**Interfaces:**
- Produces: `doneLine(who, lang, { title, folder }) → string`. Task 3 의 `announce.text` 가 쓴다. 제목 규칙은 `delegateLine` 과 같다(ko 면 제목, ja/en 에서 한글 제목이면 폴더 이름, 20자 자름, 둘 다 없으면 '작업'/'作業'/'the task').

- [ ] **Step 1: 실패하는 테스트 작성**

```js
test('완료 알림 한 마디: 캐릭터·언어, 제목 없으면 폴더, 일본어·영어는 한글 제목 대신 폴더(2026-10-07 설정 "완료 알림")', () => {
  const V = require('../voice.js');
  assert.equal(V.doneLine('choten', 'ko', { title: '포트폴리오 사이트', folder: '/Users/me/Desktop/portfolio' }), 'P, 포트폴리오 사이트 끝났어♡ 확인해 봐!');
  assert.equal(V.doneLine('ame', 'ko', { title: '', folder: '/Users/me/Desktop/portfolio' }), '…portfolio, 끝났어. 봐 봐.');
  assert.equal(V.doneLine('ame', 'ko', {}), '…작업, 끝났어. 봐 봐.');
  assert.equal(V.doneLine('choten', 'ja', { title: '포트폴리오', folder: '/x/portfolio' }), 'P、portfolio終わったよ♡ 見てみて！');
  assert.equal(V.doneLine('ame', 'en', { title: 'Site revamp', folder: '/x/site' }), '…Site revamp is done. Go look.');
  assert.equal(V.doneLine('choten', 'ko', { title: '아주아주아주아주아주아주아주아주아주아주 긴 제목', folder: '' }), 'P, 아주아주아주아주아주아주아주아주아주아주 끝났어♡ 확인해 봐!');
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test test/voice.test.js 2>&1 | grep -E "^not ok|doneLine"`
Expected: `V.doneLine is not a function`

- [ ] **Step 3: 구현** — `delegateLine` 함수 바로 뒤에 추가하고 exports 에 `doneLine` 을 넣는다.

```js
// 앱의 대화창에서 오래 걸린 턴이 끝났을 때(설정 '완료 알림', main announce.js): 어느 대화가 끝났는지 한 마디.
// 제목 규칙은 delegateLine 과 같다(한국어면 제목, 일본어·영어 목소리는 한글 제목을 못 읽어 폴더 이름)
const DONE = {
  choten: { ko: 'P, {t} 끝났어♡ 확인해 봐!', ja: 'P、{t}終わったよ♡ 見てみて！', en: 'P, {t} is done♡ Go check!' },
  ame: { ko: '…{t}, 끝났어. 봐 봐.', ja: '…{t}、終わった。見て。', en: '…{t} is done. Go look.' },
};
function doneLine(who, lang, { title = '', folder = '' } = {}) {
  const name = String(folder || '').split('/').filter(Boolean).pop() || '';
  let t = lang === 'ko' && title ? title : (/[가-힣]/.test(title) || !title ? name : title);
  if (t.length > 20) t = t.slice(0, 20);
  const set = DONE[who] || DONE.choten;
  return (set[lang] || set.ko).replace('{t}', t || (lang === 'ja' ? '作業' : lang === 'en' ? 'the task' : '작업'));
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test test/voice.test.js 2>&1 | grep -E "^# (pass|fail)"`
Expected: fail 0

---

### Task 3: 완료 알림 판단 모듈 `announce.js`

**Files:**
- Create: `overlay/announce.js`
- Test: `overlay/test/announce.test.js`

**Interfaces:**
- Consumes: `VOICE.doneLine`, `VOICE.spokenSummary`(voice.js).
- Produces: `createAnnouncer({ stateDir, now }) → { prompt(p), stop(p, announce) → { speak, why, durationMs }, shouldSpeak({ durationMs, cwd }, announce) → { speak, why } }`, `titleOf(label, cwd) → string`, `text({ who, lang, mode, title, folder, summary }) → string`. Task 4 가 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// overlay/test/announce.test.js — 앱 대화창의 완료 알림: 언제 말하고 무엇을 말하나 (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../announce.js');

const ON = { on: true, mode: 'line', minSec: 30 };
const hook = (ev, over = {}) => ({ hook_event_name: ev, session_id: 's1', cwd: '/Users/me/Desktop/portfolio', ...over });

test('말 보낸 때부터 끝난 때까지가 기준을 넘으면 말한다', () => {
  let t = 0; const a = A.createAnnouncer({ stateDir: '/Users/me/.skinclaude', now: () => t });
  a.prompt(hook('UserPromptSubmit'));
  t = 31_000;
  const d = a.stop(hook('Stop'), ON);
  assert.equal(d.speak, true); assert.equal(d.durationMs, 31_000);
});

test('짧은 턴·시작을 모르는 턴·꺼짐·마스코트 자신의 세션은 말하지 않는다', () => {
  let t = 0; const a = A.createAnnouncer({ stateDir: '/Users/me/.skinclaude', now: () => t });
  a.prompt(hook('UserPromptSubmit')); t = 10_000;
  assert.equal(a.stop(hook('Stop'), ON).speak, false);
  assert.equal(a.stop(hook('Stop', { session_id: 's9' }), ON).why, '시작을 모름');
  a.prompt(hook('UserPromptSubmit', { session_id: 's2' })); t = 100_000;
  assert.equal(a.stop(hook('Stop', { session_id: 's2' }), { ...ON, on: false }).why, '꺼짐');
  a.prompt(hook('UserPromptSubmit', { session_id: 's3', cwd: '/Users/me/.skinclaude/chat' })); t = 200_000;
  assert.equal(a.stop(hook('Stop', { session_id: 's3', cwd: '/Users/me/.skinclaude/chat' }), ON).why, '마스코트 세션');
  // 기준 0 이면 모든 턴
  a.prompt(hook('UserPromptSubmit', { session_id: 's4' })); t = 200_500;
  assert.equal(a.stop(hook('Stop', { session_id: 's4' }), { ...ON, minSec: 0 }).speak, true);
  // 한 번 끝난 세션은 다시 시작을 알아야 한다
  assert.equal(a.stop(hook('Stop', { session_id: 's4' }), { ...ON, minSec: 0 }).why, '시작을 모름');
});

test('shouldSpeak 은 글로 요청한 지시에도 같은 기준으로 쓴다(cwd 없으면 제외 안 함)', () => {
  const a = A.createAnnouncer({ stateDir: '/Users/me/.skinclaude' });
  assert.equal(a.shouldSpeak({ durationMs: 45_000 }, ON).speak, true);
  assert.equal(a.shouldSpeak({ durationMs: 5_000 }, ON).speak, false);
  assert.equal(a.shouldSpeak({ durationMs: 45_000, cwd: '/Users/me/.skinclaude/크롬' }, ON).speak, false);
});

test('이름표에서 제목만 떼고, 말할 글은 한 마디 또는 요약까지', () => {
  assert.equal(A.titleOf('포트폴리오 사이트 · portfolio', '/Users/me/Desktop/portfolio'), '포트폴리오 사이트');
  assert.equal(A.titleOf('portfolio', '/Users/me/Desktop/portfolio'), '');
  assert.equal(A.titleOf('', '/x/y'), '');
  const line = A.text({ who: 'choten', lang: 'ko', mode: 'line', title: '포트폴리오 사이트', folder: '/x/portfolio', summary: '팝업을 고쳤습니다. 배포도 했습니다.' });
  assert.equal(line, 'P, 포트폴리오 사이트 끝났어♡ 확인해 봐!');
  const full = A.text({ who: 'ame', lang: 'ko', mode: 'summary', title: '', folder: '/x/portfolio', summary: '## 결과\n팝업을 **고쳤습니다**. 배포도 했습니다.\n\n세부 내용은 아래.' });
  assert.equal(full, '…portfolio, 끝났어. 봐 봐. 팝업을 고쳤습니다. 배포도 했습니다.');
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test test/announce.test.js`
Expected: FAIL — `Cannot find module '../announce.js'`

- [ ] **Step 3: 구현**

```js
// announce.js — 앱의 모든 대화창에서 오래 걸린 턴이 끝나면 목소리로 알린다(설정 '완료 알림', 사용자 2026-10-07 "대화로 요청한 게 아니더라도
// 음성으로 완료를 안내해 주는 옵션… 매 대화창"). 훅 서버가 UserPromptSubmit 에서 시작 시각을 적고 Stop 에서 걸린 시간을 잰다(test/announce.test.js).
// 마스코트 자신의 세션(잡담·크롬 도우미 — ~/.skinclaude/ 아래에서 돈다)은 빼고, 글로 요청한 지시(main 의 onDone)는 shouldSpeak 만 같이 쓴다.
const VOICE = require('./voice');

function createAnnouncer({ stateDir = '', now = () => Date.now() } = {}) {
  const started = new Map(); // session_id → 말 보낸 시각
  const mine = (cwd) => !!stateDir && String(cwd || '').startsWith(stateDir.replace(/\/+$/, '') + '/');
  function shouldSpeak({ durationMs, cwd }, announce) {
    if (!announce?.on) return { speak: false, why: '꺼짐' };
    if (mine(cwd)) return { speak: false, why: '마스코트 세션' };
    if (!(durationMs >= 0)) return { speak: false, why: '시작을 모름' };
    if (durationMs < (Number(announce.minSec) || 0) * 1000) return { speak: false, why: `짧음(${Math.round(durationMs / 1000)}초)` };
    return { speak: true, why: '' };
  }
  return {
    prompt(p) { if (p.session_id) started.set(p.session_id, now()); if (started.size > 200) started.delete(started.keys().next().value); },
    stop(p, announce) {
      const at = started.get(p.session_id); started.delete(p.session_id);
      const durationMs = at === undefined ? -1 : now() - at;
      return { ...shouldSpeak({ durationMs, cwd: p.cwd }, announce), durationMs };
    },
    shouldSpeak,
  };
}
// sessionlabel.js 의 이름표("제목 · 폴더" 또는 "폴더")에서 제목만
function titleOf(label, cwd) {
  const project = String(cwd || '').replace(/\/+$/, '').split('/').pop() || '';
  const s = String(label || '');
  if (project && s.endsWith(` · ${project}`)) return s.slice(0, -(project.length + 3));
  return s === project ? '' : s;
}
function text({ who, lang, mode, title, folder, summary }) {
  const line = VOICE.doneLine(who, lang, { title, folder });
  if (mode !== 'summary') return line;
  const more = VOICE.spokenSummary(summary, 100);
  return more ? `${line} ${more}` : line;
}
module.exports = { createAnnouncer, titleOf, text };
```

- [ ] **Step 4: 통과 확인**

Run: `node --test test/announce.test.js`
Expected: PASS (4 tests). `spokenSummary` 가 마크다운을 걷고 첫 문단만 쓰는지 마지막 단언으로 확인된다 — 어긋나면 기대 문자열이 아니라 `spokenSummary` 의 실제 출력을 보고 테스트의 입력을 다듬는다(함수는 바꾸지 않는다).

---

### Task 4: main.js 연결 — 설정 IPC, 완료 알림, 음성 모드 꺼져도 말하기, 단축키 토글

**Files:**
- Modify: `overlay/main.js` — `loadConfig`(72~80), IPC 묶음(282~284), 훅 서버(166~176), `utterance`(1004~1019), `speakOne`(1040~1046 부근 `voiceState('speaking')`), 결과 onDone 세 곳(크롬 589~592, 지시 670~671, 넘긴 일 782~783), 단축키(1521)
- Modify: `overlay/preload.js` — `setSetting`

**Interfaces:**
- Consumes: Task 1 `SETTINGS`, Task 3 `ANNOUNCE`.
- Produces: IPC `set-setting` `{ key, value }`; preload `window.overlay.setSetting(key, value)`; config 에 `scale`·`sounds`·`announce` 가 늘 들어 있다(렌더러 Task 5 가 읽는다).

- [ ] **Step 1: 설정 기본값과 IPC**

`main.js` 머리의 require 묶음에 추가:
```js
const SETTINGS = require('./settings');
const ANNOUNCE = require('./announce');
```
`loadConfig` 의 `return c;` 를 `return SETTINGS.withDefaults(c);` 로 바꾼다.

`ipcMain.on('set-permission-mode', …)` 줄 아래에:
```js
// 설정 패널(renderer/settings.js): 키는 'voice.gain' 꼴, 허용 목록·범위는 settings.js. 통과한 값만 저장하고 렌더러에 다시 보낸다
ipcMain.on('set-setting', (_e, s) => {
  const next = SETTINGS.apply(config, s?.key, s?.value);
  if (!next) return console.log('[settings] 받지 않음', s?.key, JSON.stringify(s?.value));
  const was = config; config = next; saveConfig(); sendConfig();
  console.log('[settings]', s.key, '→', JSON.stringify(s.value));
  if (s.key === 'voice.lang' && config.voice.on && was.voice?.lang !== config.voice.lang) startVoice(); // 듣는 언어도 바꾼다(set-voice 와 같게)
});
```

`preload.js` 의 `setCostume` 줄 아래에:
```js
  setSetting: (key, value) => ipcRenderer.send('set-setting', { key, value }), // 설정 패널(settings.js 허용 목록)
```

- [ ] **Step 2: 음성 모드가 꺼져 있어도 알림은 말하기**

`utterance` 를:
```js
// announce: 완료 알림(announce.js) — 음성 모드가 꺼져 있어도 말한다. 알림은 듣기로 이어지지 않는다(follow:false 로 부른다)
function utterance(who, lang, { quiet = false, follow = true, announce = false } = {}) {
  if (!(config.voice.on || voiceTesting || announce)) { if (!speaking) voiceListenAgain(); return { push() {}, close() {} }; }
```
`speakOne(who, lang, quiet, next, follow = true)` 를 `speakOne(who, lang, quiet, next, follow = true, announce = false)` 로 바꾸고, `utterance` 의 `speakChain = speakChain.then(() => speakOne(who, lang, quiet || voiceQuiet, next, follow))` 에 `, announce` 를 넘긴다. `speakOne` 안에서:
- 목소리 준비 대기 `setTimeout(() => r('timeout'), 4000)` 을 `announce ? 20000 : 4000` 으로(알림은 기다려도 된다 — 음성 모드가 꺼져 있으면 ttsd 가 아직 안 떠 있어 첫 알림이 10초쯤 늦을 수 있다. ttsd 는 한 번 뜨면 종료까지 산다).
- `voiceState('speaking')` 을 `if (config.voice.on || voiceTesting) voiceState('speaking');` 로(음성 모드가 꺼져 있을 때 🎙 버튼을 켠 것처럼 보이지 않게).

- [ ] **Step 3: 훅 서버에서 완료 알림**

음성 변수 묶음(`let sttd = null, ttsd = null, …`) 근처에:
```js
const announcer = ANNOUNCE.createAnnouncer({ stateDir: STATE_DIR });
// 완료 알림 한 마디(또는 요약까지). 지금 캐릭터가 지금 음성 언어로 말한다. 이어 듣기 창은 열지 않는다
function speakAnnounce({ title = '', folder = '', summary = '' }) {
  const who = config.form, lang = config.voice?.lang || 'ko';
  const text = ANNOUNCE.text({ who, lang, mode: config.announce?.mode, title, folder, summary });
  console.log('[announce]', JSON.stringify(text.slice(0, 60)));
  const u = utterance(who, lang, { follow: false, announce: true }); u.push(text); u.close();
}
```
훅 서버의 `p.session_label = sessionLabel(p);` 다음 줄에:
```js
        if (p.source !== 'task') { // 앱의 대화창(마스코트의 ⚡ 지시는 onDone 에서 따로): 오래 걸린 턴이 끝나면 목소리로
          if (p.hook_event_name === 'UserPromptSubmit') announcer.prompt(p);
          else if (p.hook_event_name === 'Stop') {
            const d = announcer.stop(p, config.announce);
            if (d.speak) speakAnnounce({ title: ANNOUNCE.titleOf(p.session_label, p.cwd), folder: p.cwd, summary: p.last_assistant_message });
            else if (d.durationMs >= 0) console.log('[announce] 안 함:', d.why);
          }
        }
```

- [ ] **Step 4: 글로 요청한 지시·크롬·넘긴 일도 같은 기준으로**

`speakAnnounce` 아래에:
```js
// 글로 요청한 지시(입력창)의 결과: 음성으로 요청한 것은 결과를 읽으니 겹치지 않게, 글이면 오래 걸렸을 때만 한 마디
function announceTaskDone({ voice, startedAt, title = '', folder = '', ok = true, text = '' }) {
  if (voice || !ok) return;
  const d = announcer.shouldSpeak({ durationMs: Date.now() - startedAt }, config.announce);
  if (d.speak) speakAnnounce({ title, folder, summary: text }); else console.log('[announce] 지시 결과 안 읽음:', d.why);
}
```
세 곳의 `if (voice) { … speak(…) … }` 바로 다음 줄에 넣는다(각 함수 시작부에 `const startedAt = Date.now();` 를 둔다 — 크롬은 `startChromeTask`, 지시는 `startTask`(⚡ 지시 에이전트를 띄우는 함수), 넘긴 일은 `startProjectTask`):
- 크롬: `announceTaskDone({ voice, startedAt, title: '크롬', folder: '', ok: result.ok && !silent, text: body });`
- 지시: `announceTaskDone({ voice, startedAt, title: '', folder: config.taskCwd, ok: result.ok, text: shown });`
- 넘긴 일: `announceTaskDone({ voice, startedAt, title: d.title, folder: d.folder, ok: result.ok, text: shown });`

- [ ] **Step 5: 단축키는 토글**

`globalShortcut.register(sc, openInput)` 을 `globalShortcut.register(sc, () => (inputOpen ? win?.webContents.send('close-input') : openInput()))` 로. (렌더러 Task 5 에서 `close-input` 은 입력칸 blur → 직전 앱으로 포커스 되돌림.)

- [ ] **Step 6: 문법·테스트 확인**

Run: `node --check main.js && node --check preload.js && npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: fail 0

---

### Task 5: 렌더러 — 입력 바·버튼 줄·설정 패널

**Files:**
- Modify: `overlay/renderer/index.html` (전체 구조)
- Modify: `overlay/renderer/style.css` (`.panel` 묶음 교체, `.mascot-img` 크기, 버튼 줄, 설정 패널)
- Modify: `overlay/renderer/mascot.js` (84 요소 참조, 300~362 실행 시작·끝·입력창, 386~392 배선, 395~404 applyConfig, 186~199 기록 창·resize, 433~447 클릭 영역, 557~575 chime, 529~540 workTick, 505~506 마이크·언어)
- Create: `overlay/renderer/settings.js`

**Interfaces:**
- Consumes: `window.overlay.setSetting(key, value)`(Task 4), config 의 `scale`·`sounds`·`announce`·`voice.gain`.
- Produces: `SETTINGS_UI.init(api)`, `SETTINGS_UI.apply(config)`; mascot.js 의 `toggleSettings(open)`, `applyScale(scale)`, `resetPosition()`.

- [ ] **Step 1: index.html**

`<div id="mascot">` 안을 다음으로 바꾼다(말풍선·그림 부분은 그대로):
```html
    <!-- 입력 바: 늘 보인다(사용자 2026-10-07 "채팅을 치는 칸이 좀더 간단하게 항상 보이면"). 포커스 없으면 흐리게, 클릭·⌥⇧Space 로 포커스 -->
    <div id="panel" class="bar">
      <button id="mode" class="chip chip-mode" title="잡담/지시 전환 (문장 앞에 > 를 붙이면 그 한 번만 지시)">💬</button>
      <textarea id="input" rows="1" placeholder="말 걸기…"></textarea>
      <button id="go" class="mascot-talk go" title="보내기 (Enter)">↵</button>
      <button id="cancel" class="mascot-talk go cancel" title="취소" hidden>⏹</button>
    </div>
    <!-- ⚡ 지시 모드일 때만: 지시 폴더(누르면 선택) -->
    <div id="bar-foot" class="bar-foot" hidden><button id="pick" class="bar-folder" title="지시를 실행할 폴더 선택"><span id="folder">폴더</span></button></div>

    <div id="log" class="log-panel" hidden>
      <div class="log-head"><span>최근 대화</span><button id="log-close" class="mascot-quit" title="닫기">×</button></div>
      <ol id="log-list" class="log-list"></ol>
    </div>

    <!-- 설정(⚙): 가끔만 만지는 것(renderer/settings.js). 오버레이 끄기는 여기 맨 아래 — 동작 버튼과 떨어뜨려 잘못 누르지 않게 -->
    <div id="settings" class="log-panel settings-panel" hidden>
      <div class="log-head"><span>⚙ 설정</span><button id="settings-close" class="mascot-quit" title="닫기">×</button></div>
      <div class="settings-body">
        <div class="set-sec"><h4>모습</h4>
          <div class="set-row"><label for="set-scale">캐릭터 크기</label><input id="set-scale" type="range" min="60" max="140" step="10" value="100"><span id="set-scale-v" class="set-val">100%</span></div>
          <div class="set-row"><label for="costume">의상</label>
            <select id="costume" class="chip chip-perm set-sel" title="의상">
              <option value="base">기본</option><option value="kimono">기모노</option><option value="bunny">바니</option><option value="pajama">파자마</option>
              <option value="casual">사복</option><option value="summer">여름 원피스</option><option value="lounge">룸웨어</option><option value="knit">니트</option>
              <option value="nurse">간호사</option><option value="swim">수영복</option><option value="saint">성자·흑미사</option>
            </select></div>
          <div class="set-row"><label>자리</label><button id="set-reset" class="chip">오른쪽 아래로 되돌리기</button></div>
        </div>
        <div class="set-sec"><h4>소리</h4>
          <div class="set-row"><label for="set-gain">목소리 크기</label><input id="set-gain" type="range" min="50" max="300" step="10" value="100"><span id="set-gain-v" class="set-val">100%</span></div>
          <div class="set-row"><label for="set-sounds">효과음</label><input id="set-sounds" type="checkbox" class="set-toggle" checked><span class="set-note">띠링·또롱·진행음</span></div>
          <div class="set-row"><label for="vlang">음성 언어</label>
            <select id="vlang" class="chip chip-perm set-sel" title="음성 모드 언어(듣기·말하기 같이)">
              <option value="ko">🎙 한국어</option><option value="ja">🎙 日本語</option><option value="en">🎙 English</option>
            </select></div>
        </div>
        <div class="set-sec"><h4>완료 알림 <small>(앱의 모든 대화)</small></h4>
          <div class="set-row"><label for="set-announce">목소리로 알림</label><input id="set-announce" type="checkbox" class="set-toggle" checked></div>
          <div class="set-row"><label for="set-announce-mode">내용</label>
            <select id="set-announce-mode" class="chip chip-perm set-sel"><option value="line">한 마디만</option><option value="summary">요약까지</option></select></div>
          <div class="set-row"><label for="set-announce-min">기준</label>
            <select id="set-announce-min" class="chip chip-perm set-sel">
              <option value="0">모든 턴</option><option value="10">10초 넘게 걸린 턴만</option><option value="30">30초 넘게 걸린 턴만</option>
              <option value="60">1분 넘게 걸린 턴만</option><option value="180">3분 넘게 걸린 턴만</option>
            </select></div>
        </div>
        <div class="set-sec"><h4>지시</h4>
          <div class="set-row"><label>폴더</label><button id="set-folder" class="chip chip-folder" title="지시를 실행할 폴더 선택"><span id="set-folder-v">폴더</span></button></div>
          <div class="set-row"><label for="perm">실행 권한</label>
            <select id="perm" class="chip chip-perm set-sel" title="지시 실행 권한">
              <option value="acceptEdits">파일수정 자동</option><option value="auto">자동 판단</option><option value="bypassPermissions">전부 허용</option><option value="plan">계획만</option>
            </select></div>
        </div>
      </div>
      <div class="settings-quit"><span class="set-hint">⌥⇧Space 입력칸 · Esc 되돌아가기</span><button id="quit" class="chip chip-quit" title="오버레이 종료">오버레이 끄기</button></div>
    </div>

    <div class="mascot-ctl">
      <button id="transform" class="mascot-transform" title="변신">✞ 변신 ✞</button>
      <div class="ctl-right">
        <button id="mic" class="mascot-talk mic" title="음성 모드 켜기 — '쵸텐짱'·'아메짱'이라고 부르면 대답해요">🎙</button>
        <button id="logbtn" class="mascot-talk" title="최근 대화 기록 (20개)">📜</button>
        <button id="settingsbtn" class="mascot-talk" title="설정">⚙</button>
      </div>
    </div>
```
스크립트 줄에 `<script src="settings.js"></script>` 를 `mascot.js` 앞에 넣는다.

- [ ] **Step 2: style.css**

`.mascot-img{ height:300px; …}` 를 `height:calc(300px * var(--scale, 1));` 로. `/* ── 입력 패널 ── */` 묶음(`.panel` ~ `.hint`, `.form-ame .hint`)을 지우고 다음으로 바꾼다. `.mascot-ctl{ display:flex; gap:6px; align-items:center; }` 는 `width:320px; justify-content:space-between;` 를 더한다.
```css
/* ── 입력 바(항상 보임): 포커스 없으면 흐리게, 포커스 오면(.typing) 또렷하고 자홍 외곽선 ── */
.bar{
  width:320px; display:flex; align-items:center; gap:6px; padding:4px 6px;
  background:#ffe6f7; color:var(--ink); opacity:.72; transition:opacity .15s;
  border:2px solid; border-color:var(--bevel-lt) var(--bevel-dk2) var(--bevel-dk2) var(--bevel-lt);
  box-shadow:3px 3px 0 rgba(180,40,140,.3);
}
.mascot.typing .bar, .bar:hover{ opacity:1; }
.mascot.typing .bar{ box-shadow:0 0 0 2px var(--magenta), 3px 3px 0 rgba(180,40,140,.3); }
.form-ame .bar{ background:#241428; color:#ecd8f8; border-color:#4a2a55 #08030c #08030c #4a2a55; }
.bar textarea{
  flex:1; min-width:0; font-family:inherit; font-size:13px; line-height:1.4; resize:none; padding:4px 6px; max-height:62px;
  color:var(--ink); background:#fff; border:2px solid; border-color:var(--bevel-dk2) var(--bevel-lt) var(--bevel-lt) var(--bevel-dk2); outline:none;
}
.form-ame .bar textarea{ background:#160d1e; color:#ecd8f8; border-color:#08030c #4a2a55 #4a2a55 #08030c; }
.bar.busy textarea{ opacity:.6; }
.bar .chip{ padding:2px 6px; }
.bar .go{ width:26px; height:22px; flex:0 0 auto; }
.bar .go.cancel{ background:linear-gradient(#ffb3b3,#ff6a6a); color:#fff; }
.bar-foot{ width:320px; display:flex; justify-content:flex-start; margin-top:-2px; }
.bar-folder{ font-family:inherit; font-size:11px; color:var(--ink-soft); background:none; border:0; padding:0 4px; cursor:pointer; max-width:100%; }
.bar-folder span{ display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; direction:rtl; }
.form-ame .bar-folder{ color:#c0a0d8; }
.chip{
  font-family:inherit; font-size:11px; font-weight:bold; cursor:pointer; padding:2px 8px; color:var(--ink); white-space:nowrap;
  background:linear-gradient(var(--pink-1),var(--pink-3));
  border:2px solid; border-color:var(--bevel-lt) var(--bevel-dk2) var(--bevel-dk2) var(--bevel-lt);
}
.chip:active{ transform:translateY(1px); }
.chip-mode.task{ background:linear-gradient(#ffe9a8,#ffc94d); }
.chip-folder{ flex:1; min-width:0; text-align:left; }
.chip-folder span{ display:block; overflow:hidden; text-overflow:ellipsis; direction:rtl; }
.chip-perm{ appearance:none; -webkit-appearance:none; padding-right:8px; }
.ctl-right{ display:flex; gap:6px; }
.ctl-right > button{ position:relative; box-shadow:var(--shadow-box); }

/* ── 설정 패널(⚙): 기록 창과 같은 자리·모양. 오버레이 끄기는 맨 아래 빨간 글자 버튼 ── */
.settings-panel{ font-size:12px; max-height:min(560px, calc(100vh - 60px)); }
.settings-body{ overflow:auto; padding:0 0 4px; }
.set-sec{ padding:4px 10px 6px; border-top:1px solid #f3bfe3; }
.set-sec h4{ margin:0 0 4px; font-size:11px; color:var(--ink-soft); font-weight:normal; letter-spacing:.5px; }
.set-sec h4 small{ font-size:10px; }
.set-row{ display:flex; align-items:center; gap:8px; margin:3px 0; }
.set-row label{ flex:0 0 78px; }
.set-val{ flex:0 0 44px; text-align:right; color:var(--ink-soft); font-size:11px; }
.set-note{ flex:1; color:var(--ink-soft); font-size:11px; }
.set-sel{ flex:1; min-width:0; text-align:left; }
.set-row .chip-folder{ flex:1; }
.set-row input[type=range]{ flex:1; min-width:0; accent-color:var(--magenta); height:14px; margin:0; }
.set-toggle{ appearance:none; -webkit-appearance:none; width:30px; height:16px; border-radius:9px; background:#d9c0d4; position:relative; margin:0; cursor:pointer; flex:0 0 auto; }
.set-toggle::after{ content:''; position:absolute; top:2px; left:2px; width:12px; height:12px; border-radius:50%; background:#fff; transition:left .12s; }
.set-toggle:checked{ background:var(--magenta); }
.set-toggle:checked::after{ left:16px; }
.settings-quit{ border-top:2px solid #f3bfe3; padding:8px 10px; display:flex; justify-content:space-between; align-items:center; }
.set-hint{ font-size:10px; color:var(--ink-soft); }
.chip-quit{ color:#fff; background:linear-gradient(#ffb3b3,#ff6a6a); text-shadow:1px 1px 0 #a02020; border-color:var(--bevel-lt) #a02020 #a02020 var(--bevel-lt); padding:3px 10px; }
.form-ame .set-sec{ border-top-color:#4a2a55; }
.form-ame .settings-quit{ border-top-color:#4a2a55; }
.form-ame .set-sec h4, .form-ame .set-val, .form-ame .set-note, .form-ame .set-hint{ color:#c0a0d8; }
.form-ame .set-toggle{ background:#4a2a55; }
```

- [ ] **Step 3: renderer/settings.js**

```js
// 설정 패널(⚙) — 가끔만 만지는 값(사용자 2026-10-07 "캐릭터의 크기, 말소리 볼륨 … 가끔만 조절하기 때문에 설정 안으로").
// 값을 바꾸면 바로 main 에 보내고(setSetting, 허용 목록은 settings.js) main 이 되돌려 주는 config 로 패널 값을 맞춘다 — 말로 "목소리 키워"
// 해도 슬라이더가 따라온다. 캐릭터 크기·효과음·자리는 렌더러가 바로 적용한다(api.onScale·onSounds·resetPosition).
const SETTINGS_UI = (() => {
  const $ = (id) => document.getElementById(id);
  let api = null, applying = false;
  const pct = (v) => `${Math.round(v * 100)}%`;
  function init(a) {
    api = a;
    const scale = $('set-scale'), gain = $('set-gain');
    scale.addEventListener('input', () => { $('set-scale-v').textContent = `${scale.value}%`; api.onScale(Number(scale.value) / 100); });
    scale.addEventListener('change', () => api.setSetting('scale', Number(scale.value) / 100));
    gain.addEventListener('input', () => { $('set-gain-v').textContent = `${gain.value}%`; });
    gain.addEventListener('change', () => api.setSetting('voice.gain', Number(gain.value) / 100));
    $('set-sounds').addEventListener('change', (e) => { api.onSounds(e.target.checked); api.setSetting('sounds', e.target.checked); });
    $('set-announce').addEventListener('change', (e) => api.setSetting('announce.on', e.target.checked));
    $('set-announce-mode').addEventListener('change', (e) => api.setSetting('announce.mode', e.target.value));
    $('set-announce-min').addEventListener('change', (e) => api.setSetting('announce.minSec', Number(e.target.value)));
    $('set-folder').addEventListener('click', () => api.pickFolder());
    $('set-reset').addEventListener('click', () => api.resetPosition());
    $('settings-close').addEventListener('click', () => api.close());
  }
  // main 이 보낸 config 로 패널 값 맞추기(의상·언어·권한은 mascot.js 의 applyConfig 가 이미 맞춘다)
  function apply(c) {
    applying = true;
    try {
      const scale = Math.round((Number(c.scale) || 1) * 100), gain = Math.round((Number(c.voice?.gain) || 1) * 100);
      $('set-scale').value = scale; $('set-scale-v').textContent = `${scale}%`;
      $('set-gain').value = gain; $('set-gain-v').textContent = `${gain}%`;
      $('set-sounds').checked = c.sounds !== false;
      $('set-announce').checked = !!c.announce?.on;
      $('set-announce-mode').value = c.announce?.mode === 'summary' ? 'summary' : 'line';
      $('set-announce-min').value = String([0, 10, 30, 60, 180].includes(Number(c.announce?.minSec)) ? Number(c.announce.minSec) : 30);
      $('set-folder-v').textContent = `‎${api.shortenPath(c.taskCwd || '~')}‎`;
      $('set-folder').title = `지시 폴더: ${c.taskCwd || ''}`;
    } finally { applying = false; }
  }
  return { init, apply, get applying() { return applying; }, pct };
})();
```

- [ ] **Step 4: mascot.js — 요소 참조와 입력 바**

84줄의 요소 참조를:
```js
const panel = $('panel'), input = $('input'), modeBtn = $('mode'), folderEl = $('folder'), permSel = $('perm'), goBtn = $('go'), cancelBtn = $('cancel'), barFoot = $('bar-foot');
const logEl = $('log'), logList = $('log-list'), settingsEl = $('settings');
```
`onRunStart` 의 `panel.classList.add('busy'); cancelBtn.hidden = false; input.disabled = true;` → `panel.classList.add('busy'); cancelBtn.hidden = false; goBtn.hidden = true; input.readOnly = true;` (disabled 는 포커스를 잃게 해 직전 앱으로 돌아가 버린다). `hint.textContent = …` → `input.placeholder = r.kind === 'task' ? \`클로드 작업 중… (${shortenPath(r.cwd)})\` : '생각 중…';`.
`onRunDone` 의 `panel.classList.remove('busy'); cancelBtn.hidden = true; input.disabled = false;` → `panel.classList.remove('busy'); cancelBtn.hidden = true; goBtn.hidden = false; input.readOnly = false;`, `hint.textContent = ''` → `input.placeholder = '말 걸기…'`. 끝의 `if (!panel.hidden) input.focus();` → `if (inputFocused) input.focus();`.

입력 패널 묶음(`openInput`·`closeInput`)을:
```js
/* ── 입력 바: 늘 보이고, 포커스가 있을 때만 '열린' 것이다(main 의 inputOpen). 포커스를 잃으면 main 이 직전 앱으로 돌려준다 ── */
let inputFocused = false;
function openInput() { input.focus(); }
function closeInput() { if (document.activeElement === input) input.blur(); }
input.addEventListener('focus', () => {
  if (inputFocused) return;
  inputFocused = true; root.classList.add('typing'); window.overlay.setInputState(true);
  if (!running) { setImg('idle'); say(line('listen'), 4000, { prio: 1 }); }
});
input.addEventListener('blur', () => {
  if (!inputFocused) return;
  inputFocused = false; root.classList.remove('typing'); window.overlay.setInputState(false);
});
function autoGrow() { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 62)}px`; }
input.addEventListener('input', autoGrow);
```
`setSendMode` 의 `modeBtn.textContent = m === 'task' ? '⚡ 지시' : '💬 잡담';` → `modeBtn.textContent = m === 'task' ? '⚡' : '💬'; barFoot.hidden = m !== 'task';`. `submit` 의 `input.value = '';` 뒤에 `autoGrow();`.
배선에서 `$('talk').addEventListener(…)` 줄을 지우고 다음을 넣는다:
```js
goBtn.addEventListener('click', () => { if (!running) submit(input.value); input.focus(); });
```

- [ ] **Step 5: mascot.js — 설정 패널·크기·효과음·자리**

`toggleLog` 를 다음으로 바꾸고 아래를 더한다:
```js
// 기록(📜)·설정(⚙)은 캐릭터 왼쪽 같은 자리에 뜨니 하나만 연다. 왼쪽에 자리가 없으면(왼쪽 끝으로 끌어다 놓았으면) 오른쪽에
function placeSide(el) { el.classList.remove('flip'); if (el.getBoundingClientRect().left < 4) el.classList.add('flip'); }
function toggleLog(open = logEl.hidden) {
  logEl.hidden = !open;
  if (!open) return;
  settingsEl.hidden = true; renderLog(); placeSide(logEl);
}
function toggleSettings(open = settingsEl.hidden) {
  settingsEl.hidden = !open;
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
function clampPosition() {
  if (!root.style.left) return;
  root.style.left = Math.max(0, Math.min(innerWidth - root.offsetWidth, parseFloat(root.style.left))) + 'px';
  root.style.top = Math.max(0, Math.min(innerHeight - root.offsetHeight, parseFloat(root.style.top))) + 'px';
}
function resetPosition() { root.style.left = ''; root.style.top = ''; root.style.right = ''; root.style.bottom = ''; fitBubbles(); reportHit(); }
let soundsOn = true;
```
`window.addEventListener('resize', …)` 의 본문을 `clampPosition(); applyScale(config.scale);` 로 바꾼다.
배선 묶음에:
```js
$('logbtn').addEventListener('click', () => toggleLog());
$('settingsbtn').addEventListener('click', () => toggleSettings());
SETTINGS_UI.init({
  setSetting: (k, v) => window.overlay.setSetting(k, v), pickFolder: () => window.overlay.pickFolder(),
  onScale: applyScale, onSounds: (on) => { soundsOn = on; }, resetPosition, close: () => toggleSettings(false), shortenPath,
});
```
`applyConfig` 끝에:
```js
  applyScale(config.scale); soundsOn = config.sounds !== false;
  SETTINGS_UI.apply(config);
```
`chime(kind)` 첫 줄을 `const c = CHIMES[kind]; if (!c || !soundsOn) return;` 로, `workTick()` 첫 줄 앞에 `if (!soundsOn) return;` 를 둔다.
`reportHit` 의 요소 목록을 `[img, ctl, panel, barFoot, logEl, settingsEl, ...stack.children]` 로.
`$('quit')` 리스너는 그대로(버튼이 설정 패널로 옮겨졌을 뿐).

- [ ] **Step 6: 문법 확인과 설치·화면 확인**

Run: `node --check renderer/mascot.js && node --check renderer/settings.js && npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: fail 0

쉬는 틈에: `cd /Users/dobedub/Desktop/skinclaude && bash bin/overlay-ctl.sh install && ~/.skinclaude/overlay-ctl.sh stop; ~/.skinclaude/overlay-ctl.sh start`
그 뒤 `curl -s "127.0.0.1:47831/shot?to=<scratch>/ui1.png"`(평소), `curl -s 127.0.0.1:47831/open-input` 뒤 다시 찍기(포커스), `curl -s "127.0.0.1:47831/status"` 의 `inputOpen` 이 포커스에 따라 true/false 인지, 로그에 렌더러 오류(`[renderer]`·`Uncaught`)가 없는지 확인한다. 설정 패널은 `win.webContents.executeJavaScript('toggleSettings(true)')` 를 쓰는 디버그 주소가 없으니 `/poke` 처럼 하나 더 두지 말고, 사용자가 직접 연다 — 대신 Electron 으로 `renderer/index.html` 을 열어 찍는 스크립트(`scratchpad/mock/shot.js` 와 같은 방식, `settingsEl.hidden=false` 를 주입)로 모양을 확인한다.

---

### Task 6: 완료 알림 실제 확인과 기억 갱신

**Files:**
- Modify: `~/.claude/projects/-Users-dobedub-Desktop-skinclaude/memory/skinclaude-overlay-approach.md`, `MEMORY.md`

- [ ] **Step 1: 가짜 훅으로 알림 한 번**

```bash
curl -s -X POST -H 'content-type: application/json' --data '{"hook_event_name":"UserPromptSubmit","session_id":"test-announce","cwd":"/Users/dobedub/Desktop/txtgame","prompt":"x"}' http://127.0.0.1:47831/hook; sleep 31; curl -s -X POST -H 'content-type: application/json' --data '{"hook_event_name":"Stop","session_id":"test-announce","cwd":"/Users/dobedub/Desktop/txtgame","last_assistant_message":"옷장에 성자 의상을 넣었습니다."}' http://127.0.0.1:47831/hook
```
Expected: 로그에 `[announce] "P, txtgame 끝났어♡ 확인해 봐!"`(또는 아메 대사)와 `[voice] 말함`. 기준 미만(sleep 5)과 `cwd: ~/.skinclaude/chat` 으로 한 번씩 더 보내 `[announce] 안 함: 짧음`·`마스코트 세션` 이 찍히는지 본다. 소리가 한 번 나니 사용자에게 알린다.

- [ ] **Step 2: 기억**

`skinclaude-overlay-approach.md` 에 "2026-10-07 UI 정돈" 절: 입력 바 상시 표시(포커스=inputOpen), 버튼 줄 구성, 설정 패널과 `set-setting`(settings.js 허용 목록), 완료 알림(announce.js, 음성 모드 꺼져도 utterance announce, 마스코트 세션 제외, 기본 30초), 오버레이 끄기는 설정 맨 아래. MEMORY.md 의 오버레이 줄에 한 구절 추가.
