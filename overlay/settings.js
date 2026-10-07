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
