// 훅 이벤트 → 캐릭터 대사. mascot.js 가 Claude Code 세션의 작업(도구 사용·실패·질문)을 실시간으로 알릴 때 쓴다.
// 렌더러에선 클래식 스크립트로 전역 NARRATE 가 되고, node 테스트(test/narrate.test.js)에선 module.exports 로 쓴다.
// 톤은 mascot.js 머리말과 같다: 초텐쨩은 밝고 ♡, 아메는 건조한 "…"(이모지 없음).
const NARRATE = (() => {
  const MAX = 36; // 말풍선에 넣을 작업 대상(파일·명령 설명·검색어) 최대 길이
  const clip = (s) => { const t = String(s || '').split('\n')[0].trim(); return t.length > MAX ? t.slice(0, MAX) + '…' : t; };
  const base = (p) => String(p || '').replace(/\/+$/, '').split('/').pop() || '';
  const host = (u) => { try { return new URL(u).hostname; } catch { return clip(u); } };

  // PreToolUse·PostToolUseFailure 페이로드 → { act: 대사 종류, what: 작업 대상 }
  function actionOf(p) {
    const n = p.tool_name || '', i = p.tool_input || {};
    if (n === 'Read') return { act: 'read', what: base(i.file_path) };
    if (n === 'Edit' || n === 'MultiEdit') return { act: 'edit', what: base(i.file_path) };
    if (n === 'NotebookEdit') return { act: 'edit', what: base(i.notebook_path) };
    if (n === 'Write') return { act: 'write', what: base(i.file_path) };
    if (n === 'Bash' || n === 'PowerShell') return { act: 'bash', what: clip(i.description || i.command) };
    if (n === 'Grep') return { act: 'search', what: clip(i.pattern) };
    if (n === 'Glob') return { act: 'find', what: clip(i.pattern) };
    if (n === 'WebSearch') return { act: 'web', what: clip(i.query) };
    if (n === 'WebFetch') return { act: 'fetch', what: host(i.url) };
    if (n === 'Agent' || n === 'Task') return { act: 'agent', what: clip(i.description || i.subagent_type) };
    if (n === 'Skill') return { act: 'skill', what: clip(String(i.skill || '').split(':').pop()) };
    if (n === 'TodoWrite' || n === 'TaskCreate' || n === 'TaskUpdate') return { act: 'todo', what: '' };
    if (n === 'AskUserQuestion') return { act: 'ask', what: '' };
    if (n === 'ExitPlanMode') return { act: 'plan', what: '' };
    if (n === 'mcp__skinclaude__show_tab') return { act: 'browser', what: '창 앞으로' }; // 크롬 도우미가 재생 전에 창을 올릴 때
    const m = /^mcp__(.+?)__(.+)$/.exec(n);
    if (m) return { act: /chrome|browser/i.test(m[1]) ? 'browser' : 'mcp', what: clip(m[2]) };
    return { act: 'tool', what: clip(n) };
  }

  const LINES = {
    choten: {
      prompt:  ['접수~! 바로 시작할게♡', '오케이 P! 초텐쨩 출동~', '좋아, 해 보자고♡'],
      read:    ['{w} 읽는 중~', '{w} 훑어보는 중♡', '{w} 펼쳐 보는 중!'],
      edit:    ['{w} 고치는 중~♡', '{w} 손보는 중!', '{w} 뚝딱뚝딱 수정 중~'],
      write:   ['{w} 새로 만드는 중♡', '{w} 쓰는 중~!'],
      bash:    ['명령 실행! {w}', '{w} 돌리는 중~', '터미널 출동♡ {w}'],
      search:  ["'{w}' 찾는 중~", "'{w}' 어디 있지? 찾아보는 중!"],
      find:    ['{w} 파일 찾는 중~', '파일 탐색 중! {w}'],
      web:     ["'{w}' 검색 중~♡", "인터넷에서 '{w}' 찾아보는 중!"],
      fetch:   ['{w} 페이지 읽는 중~', '{w} 들어가 보는 중!'],
      agent:   ['도우미 출동! {w}', '{w}, 친구한테 맡겼어♡'],
      skill:   ['{w} 스킬 꺼내는 중~♡', '비장의 스킬! {w}'],
      todo:    ['할 일 정리 중~♡', '체크리스트 업데이트!'],
      ask:     ['P! 질문 있어~ 대답해 줘♡', '골라 줘 P! 기다릴게~'],
      plan:    ['계획 짰어! 확인해 줘 P♡', '이렇게 해 볼까? 계획 봐 줘~'],
      browser: ['브라우저 조작 중~ {w}', '클릭클릭♡ {w}'],
      mcp:     ['{w} 쓰는 중~', '{w} 발동!'],
      tool:    ['{w} 발동~!', '{w} 가보자고♡'],
      fail:    ['앗, {w} 실패했어… 다시 해 볼게!', '으앙 {w} 에러… 괜찮아 괜찮아!'],
    },
    ame: {
      prompt:  ['…알았다. 시작한다.', '…맡겨. 한다.', '…들었다.'],
      read:    ['…{w} 읽는다.', '…{w}. 보고 있다.'],
      edit:    ['…{w} 고친다.', '…{w} 손본다.'],
      write:   ['…{w} 새로 쓴다.', '…{w} 만든다.'],
      bash:    ['…실행. {w}', '…{w}. 돌린다.'],
      search:  ["…'{w}' 찾는다.", "…'{w}'. 어디 있지."],
      find:    ['…{w} 찾는 중.', '…파일 찾는다. {w}'],
      web:     ["…'{w}' 검색한다.", "…'{w}'. 찾아본다."],
      fetch:   ['…{w} 읽는다.', '…{w} 들여다본다.'],
      agent:   ['…{w}. 맡겼다.', '…다른 애한테 시켰다. {w}'],
      skill:   ['…{w} 꺼낸다.', '…{w}. 쓸 때다.'],
      todo:    ['…할 일 정리.', '…목록 고친다.'],
      ask:     ['…물어볼 게 있다. 대답해.', '…골라. 기다린다.'],
      plan:    ['…계획이다. 봐.', '…이렇게 한다. 확인해.'],
      browser: ['…브라우저 만진다. {w}', '…클릭. {w}'],
      mcp:     ['…{w} 쓴다.', '…{w}.'],
      tool:    ['…{w} 쓴다.', '{w}… 필요하니까.'],
      fail:    ['…{w} 실패. 다시 한다.', '…에러다. {w}'],
    },
  };
  const ACTS = Object.keys(LINES.choten);
  const randomPick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // 대상이 비면 자리표시자와 따옴표·쉼표를 같이 지우고 어색한 "…." 을 정리한다
  function lineFor(form, act, what, pick = randomPick) {
    const L = LINES[form] || LINES.choten, t = pick(L[act] || L.tool), w = String(what || '').trim();
    const s = w ? t.replace(/\{w\}/g, w) : t.replace(/'?\{w\}'?,?\s*/g, '');
    return s.replace(/…\s*\./g, '…').replace(/\s{2,}/g, ' ').trim();
  }

  const projectOf = (cwd) => base(cwd);

  // 대사를 최소 gap 간격으로 보여 준다. 간격 안에 온 것은 가장 최근 것 하나만 기다렸다 보여 주고,
  // urgent(질문·완료·권한 요청)는 바로 보여 주며 기다리던 것은 버린다.
  function createPacer({ gap, show, now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout }) {
    let lastAt = -Infinity, pending = null, timer = null;
    const flush = () => { timer = null; if (pending === null) return; const x = pending; pending = null; lastAt = now(); show(x); };
    return {
      push(item, { urgent = false } = {}) {
        if (urgent) { if (timer) clearTimer(timer); timer = null; pending = null; lastAt = now(); show(item); return; }
        const wait = lastAt + gap - now();
        if (wait <= 0 && !timer) { lastAt = now(); show(item); return; }
        pending = item;
        if (!timer) timer = setTimer(flush, Math.max(0, wait));
      },
    };
  }

  return { ACTS, actionOf, lineFor, projectOf, createPacer };
})();
if (typeof module !== 'undefined') module.exports = NARRATE;
