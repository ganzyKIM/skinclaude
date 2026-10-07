// 크롬 탭을 모델도 확장도 거치지 않고 AppleScript(JXA)로 바로 다룬다(main.js 가 쓴다). 한 번 부르는 데 0.15~0.3초.
// 크롬 도우미(Claude in Chrome)는 한 턴에 4~11초라, 정해진 일(주소 열기·영상 멈춤·다음 곡·소리 줄이기)은 여기서 한다.
//  - 탭 주소 바꾸기·새 탭 만들기·창 올리기는 늘 된다(처음 한 번 macOS 가 "Google Chrome 제어" 허용을 묻는다).
//  - 탭 안의 영상 조작(tabsOp)은 크롬 메뉴 보기 › 개발자 › "Apple Events의 자바스크립트 허용"이 켜져 있어야 한다. 꺼져 있으면 jsOff 로 알린다.
const { execFile } = require('node:child_process');
const INTENT = require('./intent');

// 노래·영상이 나오는 사이트의 탭(우리가 연 탭이 아니어도 "멈춰"가 먹게 후보에 넣는다)
const MEDIA_SITE = String.raw`/youtube\.com\/(?:watch|shorts|live)|music\.youtube\.com|nicovideo\.jp\/watch|twitch\.tv\/|chzzk\.naver\.com|soundcloud\.com|open\.spotify\.com|netflix\.com\/watch/`;
// 탭에서 돌리는 스크립트는 즉시 실행 함수로 싼다(같은 페이지에서 여러 번 돌려도 이름이 겹치지 않게). v = 그 탭의 영상.
const vjs = (body) => `(()=>{const v=document.querySelector('video');${body}})()`;
const STATE_JS = vjs("return JSON.stringify({has:!!v,playing:!!v&&!v.paused&&!v.ended,href:location.href})");
// 노래 조작(유튜브 플레이어 기준, 다른 사이트도 video 요소면 된다). 모두 { ok } 를 JSON 으로 돌려준다.
const MEDIA_JS = {
  pause: vjs("if(v){v.pause()} return JSON.stringify({ok:!!v})"),
  play: vjs("if(v){const p=v.play(); if(p&&p.catch){p.catch(()=>{})}} return JSON.stringify({ok:!!v})"),
  next: vjs("const b=document.querySelector('.ytp-next-button'); if(b){b.click()} return JSON.stringify({ok:!!b})"),
  prev: vjs("const b=document.querySelector('.ytp-prev-button'); if(b&&b.getAttribute('aria-disabled')!=='true'&&getComputedStyle(b).display!=='none'){b.click()}else if(v){v.currentTime=0} return JSON.stringify({ok:!!(b||v)})"),
};
// 캐릭터와 이야기하는 동안 영상 소리만 줄였다가(나오는 중인 영상만, factor 배로) 되돌린다
const duckJs = (factor) => vjs(`if(!v||v.paused||v.ended){return JSON.stringify({ok:false})} if(window.__skinDuck==null){window.__skinDuck=v.volume} v.volume=Math.min(v.volume,window.__skinDuck*${Number(factor) || 0.5}); return JSON.stringify({ok:true})`);
const UNDUCK_JS = vjs("const had=window.__skinDuck!=null; if(v&&had){v.volume=window.__skinDuck} window.__skinDuck=null; return JSON.stringify({ok:had})");

const JS_OFF = /꺼져 있|turned off|disabled/i; // "Apple Events의 자바스크립트 허용"이 꺼져 있을 때의 오류 글
function osa(script, args, timeout = 20_000) {
  return new Promise((resolve) => {
    execFile('osascript', ['-l', 'JavaScript', '-e', script, ...args], { timeout }, (err, stdout, stderr) => {
      if (err) { const error = String(stderr || err.message || '').trim().slice(0, 240); return resolve({ ok: false, error, jsOff: JS_OFF.test(error) }); }
      try { const r = JSON.parse(String(stdout).trim()); resolve(r.error && JS_OFF.test(r.error) ? { ...r, jsOff: true } : r); } catch { resolve({ ok: false, error: String(stdout).slice(0, 240) }); }
    });
  });
}
// 모든 창의 탭을 훑어 후보를 고르는 머리 부분(두 스크립트가 같이 쓴다). want 의 '*' 자리에는 영상 사이트 탭이 들어간다.
const PICK_HEAD = `
  const SITE = ${MEDIA_SITE};
  const chrome = Application('Google Chrome');
  let wins = chrome.windows();
  const all = [];
  for (let wi = 0; wi < wins.length; wi++) {
    const ids = wins[wi].tabs.id().map(String), urls = wins[wi].tabs.url();
    for (let ti = 0; ti < ids.length; ti++) all.push({ id: ids[ti], wi: wi, ti: ti, url: urls[ti] || '' });
  }
  const cands = [];
  for (const c of want) {
    if (c === '*') { for (const t of all) if (SITE.test(t.url) && want.indexOf(t.id) < 0 && cands.indexOf(t) < 0) cands.push(t); }
    else { const t = all.find((x) => x.id === c); if (t && cands.indexOf(t) < 0) cands.push(t); }
  }
  let jsError = '';
  const exec = (t, js) => { try { return wins[t.wi].tabs[t.ti].execute({ javascript: js }); } catch (e) { jsError = String(e); return null; } };
  const state = (t) => { try { return JSON.parse(exec(t, ${JSON.stringify(STATE_JS)})) || {}; } catch (e) { return {}; } };
`;
// 탭에 주소를 연다. cands: 쓸 탭 후보(앞에서부터, '*' = 영상 사이트 탭들). 후보가 크롬에 없으면 새 탭을 만든다(created).
//  mode 'media': 지금 영상이 나오는 탭이 있으면 그 탭에 연다(두 곡이 겹치지 않게), 없으면 첫 후보
//  mode 'spare': 영상이 나오는 중인 탭은 건드리지 않는다(검색·사이트 열기가 노래를 끊지 않게)
//  raise: 그 탭의 창을 맨 앞으로
const OPEN_JXA = `function run(argv) {
  const want = JSON.parse(argv[0]), url = argv[1], mode = argv[2], raise = argv[3] === '1';
  ${PICK_HEAD}
  let pick = null;
  if (mode === 'media') pick = cands.find((t) => state(t).playing) || cands[0] || null;
  else if (mode === 'spare') pick = cands.find((t) => !state(t).playing) || null;
  else pick = cands[0] || null;
  let w, ti, created = false;
  if (pick) { w = wins[pick.wi]; ti = pick.ti; w.tabs[ti].url = url; }
  else {
    created = true;
    const home = want.map((c) => all.find((x) => x.id === c)).find(Boolean); // 아는 탭이 있던 창, 없으면 맨 앞 창
    if (home || wins.length) { w = wins[home ? home.wi : 0]; w.tabs.push(chrome.Tab({ url: url })); ti = w.tabs.length - 1; }
    else { chrome.Window().make(); wins = chrome.windows(); w = wins[0]; ti = 0; w.tabs[0].url = url; }
  }
  if (raise) { try { if (w.minimized()) w.minimized = false; } catch (e) {} w.activeTabIndex = ti + 1; w.index = 1; chrome.activate(); }
  return JSON.stringify({ ok: true, tabId: Number(w.tabs[ti].id()), created: created });
}`;
function openTab(url, { cands = [], mode = '', raise = true } = {}) {
  return osa(OPEN_JXA, [JSON.stringify([...new Set(cands.filter(Boolean).map(String))]), url, mode, raise ? '1' : '0']);
}
// 후보 탭들(cands, '*' = 영상 사이트 탭들)에서 스크립트 js({ ok } 를 JSON 으로 돌려주는 것)를 돌린다.
//  select 'playing': 지금 영상이 나오는 탭 전부(없으면 영상이 있는 탭 전부) — 멈춰
//  select 'one': 영상이 나오는 첫 탭(없으면 영상이 있는 첫 탭) — 다음 곡·소리·이어 틀기
//  select 'all': 후보 전부(스크립트가 알아서 가린다) — 소리 줄이기·되돌리기
// → { ok(한 탭이라도 됐나), tab(된 첫 탭 id), tabs(후보 수), jsOff }
const OP_JXA = `function run(argv) {
  const want = JSON.parse(argv[0]), select = argv[1], js = argv[2];
  if (!Application('Google Chrome').running()) return JSON.stringify({ ok: false, error: 'chrome not running' }); // 꺼진 크롬을 켜지 않는다
  ${PICK_HEAD}
  let targets = cands.slice(0, 8);
  if (select !== 'all') {
    const states = targets.map((t) => ({ t: t, s: state(t) }));
    const playing = states.filter((x) => x.s.playing), has = states.filter((x) => x.s.has);
    targets = (playing.length ? playing : has).map((x) => x.t);
    if (select === 'one') targets = targets.slice(0, 1);
  }
  let done = null;
  for (const t of targets) { let r = {}; try { r = JSON.parse(exec(t, js)) || {}; } catch (e) {} if (r.ok && done === null) done = Number(t.id); }
  return JSON.stringify({ ok: done !== null, tab: done, tabs: cands.length, error: done === null ? (jsError || (cands.length ? 'no video' : 'no tab')) : '' });
}`;
function tabsOp(cands, select, js) {
  return osa(OP_JXA, [JSON.stringify([...new Set(cands.filter(Boolean).map(String))]), select, js], 8000);
}
// 탭 하나(tabId)에서 스크립트를 돌린다 → { ok, result } | { ok: false, missing(탭이 없음) | error, jsOff }
const EXEC_JXA = `function run(argv) {
  const want = String(argv[0]), js = argv[1];
  const chrome = Application('Google Chrome');
  if (!chrome.running()) return JSON.stringify({ ok: false, missing: true });
  const wins = chrome.windows();
  for (let wi = 0; wi < wins.length; wi++) {
    const ti = wins[wi].tabs.id().map(String).indexOf(want);
    if (ti < 0) continue;
    const r = wins[wi].tabs[ti].execute({ javascript: js });
    return JSON.stringify({ ok: true, result: r === undefined ? null : r });
  }
  return JSON.stringify({ ok: false, missing: true });
}`;
const execIn = (tabId, js) => osa(EXEC_JXA, [String(tabId), js], 8000);

// 유튜브 검색 결과를 직접 받아 첫 영상을 고른다(0.5~0.8초, 2026-10-01 실측). 브라우저도 모델도 안 거친다 → { id, title } | null
const YT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0 Safari/537.36';
async function findOnYouTube(query, lang = 'ko') {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 4000);
  try {
    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': YT_UA, 'Accept-Language': lang === 'ja' ? 'ja,en;q=0.8' : lang === 'en' ? 'en' : 'ko,en;q=0.8' }, signal: ctl.signal,
    });
    if (!res.ok) return null;
    return INTENT.parseYouTubeResults(await res.text())[0] || null;
  } catch { return null; } finally { clearTimeout(timer); }
}

module.exports = { openTab, tabsOp, execIn, findOnYouTube, vjs, STATE_JS, MEDIA_JS, duckJs, UNDUCK_JS, MEDIA_SITE };
