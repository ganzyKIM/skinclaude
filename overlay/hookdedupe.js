// 같은 훅 이벤트가 두 번 들어오는 경우를 걸러낸다. 오버레이가 띄운 지시 세션은 runner.js 가 --settings 로 넣은 훅과
// 전역(~/.claude/settings.json) 훅이 둘 다 돌아 같은 페이로드를 두 번 보낸다(test/hookdedupe.test.js).
function createDeduper(windowMs = 3000, now = () => Date.now()) {
  const seen = new Map();
  return (p) => {
    const t = now();
    for (const [k, at] of seen) if (t - at > windowMs) seen.delete(k);
    const body = p.tool_input ?? p.prompt ?? p.message ?? p.last_assistant_message ?? '';
    const key = [p.session_id, p.hook_event_name, p.tool_use_id || '', JSON.stringify(body).slice(0, 200)].join('|');
    if (seen.has(key)) return true;
    seen.set(key, t);
    return false;
  };
}
module.exports = { createDeduper };
