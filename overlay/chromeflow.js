// 잡담 → 크롬 작업 흐름의 순수 로직(test/chromeflow.test.js). main.js 는 module.exports 로, 렌더러는 전역 CHROMEFLOW 로 쓴다.
// 잡담 캐릭터(persona.js)는 웹에서 할 일을 부탁받으면 답 끝줄에 "[크롬] 할 일"을 붙이고, 크롬 도우미가 확인을 기다리는 중이면
// "[크롬 이어서] 사용자 대답" 또는 "[크롬 취소]"를 붙인다. 크롬 도우미(runner --chrome)는 보내기 같은 되돌릴 수 없는 일 앞에서
// 멈추고 마지막 줄에 "[확인 필요]"를 붙인다.
const CHROMEFLOW = (() => {
  const START = /^\s*\[크롬\]\s*(.+?)\s*$/, RESUME = /^\s*\[크롬 이어서\]\s*(.*?)\s*$/, CANCEL = /^\s*\[크롬 취소\]\s*$/;
  const CONFIRM = /^\s*\[확인 필요\]\s*$/;
  // 캐릭터가 직접 할 수 있는 일(변신·의상·노래·음량·화면)은 답 끝줄에 "[실행] 동작"을 붙인다 → main 이 바로 한다(intent.js parseAction)
  const ACTION = /^\s*\[실행\]\s*(.+?)\s*$/;
  // 노래·영상 재생처럼 결과가 바로 들리는 일은 도우미가 "[조용히]"로 끝낸다 → 말풍선·소리 보고를 생략한다(사용자 2026-10-01)
  const QUIET = /^\s*\[조용히\]\s*/; // 줄 앞에만 붙어도 받는다("[조용히] 재생 중이야."처럼 쓰기도 했다)

  function parseDirective(text) {
    let directive = null, action = null;
    const keep = [];
    for (const line of String(text || '').split('\n')) {
      let m;
      if ((m = ACTION.exec(line))) action = m[1];
      else if ((m = RESUME.exec(line))) directive = { kind: 'resume', reply: m[1] };
      else if (CANCEL.test(line)) directive = { kind: 'cancel' };
      else if ((m = START.exec(line))) directive = { kind: 'start', task: m[1] };
      else keep.push(line);
    }
    return { text: keep.join('\n').trim(), directive, action };
  }

  // 스트리밍 중 말풍선에 보일 글: 완성된 크롬 줄과, 아직 쓰이는 중이라 "[크롬"이 될 수 있는 마지막 줄을 가린다
  function visible(text) {
    const lines = parseDirective(text).text.split('\n');
    const last = lines[lines.length - 1].trim();
    if (last && ('[크롬'.startsWith(last) || last.startsWith('[크롬') || '[실행'.startsWith(last) || last.startsWith('[실행'))) lines.pop();
    return lines.join('\n').trim();
  }

  function parseAgentResult(text) {
    const lines = String(text || '').split('\n');
    return {
      text: lines.filter((l) => !CONFIRM.test(l)).map((l) => l.replace(QUIET, '')).join('\n').trim(),
      needsConfirm: lines.some((l) => CONFIRM.test(l)),
      silent: lines.some((l) => QUIET.test(l)),
    };
  }

  // 확인을 기다리는 동안 사용자의 다음 잡담 앞에 붙여 캐릭터가 이어서/취소를 판단하게 하는 메모
  const pendingNote = (question) =>
    `(메모: 크롬 도우미가 이렇게 묻고 확인을 기다리는 중이야 — "${question}". 사용자가 진행하라고 하면 답 맨 마지막 줄에 "[크롬 이어서] 사용자 대답"을, 그만두라고 하면 "[크롬 취소]"를 붙여. 상관없는 말이면 평소처럼 대답하고 아무것도 붙이지 마.)`;

  // 사용자 말 앞에 메모를 붙여 잡담 캐릭터에게 넘길 글을 만든다. (예전엔 "크롬 도우미가 생겼다"·"이제 [실행]을 쓸 수 있다"는 메모도
  // 캐릭터마다 한 번씩 붙였다 — 이어 가는 세션은 새 지침을 못 봐서. 지금은 지침이 바뀌면 새 세션으로 넘어가니(main.js ensureToday) 필요 없다.)
  function composeChat({ text, pendingQuestion }) {
    return pendingQuestion ? `${pendingNote(pendingQuestion)}\n${text}` : text;
  }

  return { parseDirective, visible, parseAgentResult, pendingNote, composeChat };
})();
if (typeof module !== 'undefined') module.exports = CHROMEFLOW;
