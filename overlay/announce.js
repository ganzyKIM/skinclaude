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
