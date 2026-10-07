// usage.js — Claude 구독 사용량(5시간·주간 한도의 사용률, 사용자 2026-10-07 "설정에서 클로드 사용량을 볼 수 있게").
// Claude Code 가 쓰는 OAuth 토큰(맥 키체인 "Claude Code-credentials")으로 api.anthropic.com/api/oauth/usage 를 읽는다 — 앱의 사용량 카드와
// 같은 출처(2026-10-07 확인: five_hour.utilization 90 = 앱의 "5-hour limit 90%"). 토큰은 main 안에서만 쓰고 로그·렌더러에 내보내지 않는다.
// 60초 캐시(설정 패널을 열어 둔 동안 1분마다 새로 읽는다). test/usage.test.js
const { execFile } = require('node:child_process');
const https = require('node:https');

function readToken() {
  return new Promise((resolve) => {
    execFile('/usr/bin/security', ['find-generic-password', '-s', 'Claude Code-credentials', '-w'], { timeout: 5000 }, (err, out) => {
      if (err) return resolve(null);
      try { resolve(JSON.parse(String(out).trim())?.claudeAiOauth?.accessToken || null); } catch { resolve(null); }
    });
  });
}
function fetchJson(token) {
  return new Promise((resolve, reject) => {
    const req = https.get('https://api.anthropic.com/api/oauth/usage', {
      headers: { Authorization: `Bearer ${token}`, 'anthropic-beta': 'oauth-2025-04-20', 'User-Agent': 'skinclaude-overlay' }, timeout: 10_000,
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}
// 보여 줄 창과 이름. 응답에는 코드명 창(tangelo…)도 오는데 뜻을 모르니 뺀다
const WINDOWS = [['five_hour', '5시간'], ['seven_day', '주간 · 전체'], ['seven_day_opus', '주간 · Opus'], ['seven_day_sonnet', '주간 · Sonnet']];
function summarize(json) {
  const out = [];
  for (const [key, label] of WINDOWS) {
    const w = json?.[key];
    if (!w || typeof w.utilization !== 'number') continue;
    out.push({ key, label, pct: Math.max(0, Math.min(100, Math.round(w.utilization))), resetsAt: w.resets_at || null });
  }
  return out;
}
// "4시간 12분 뒤 초기화"·"4일 22시간 뒤 초기화"
function resetText(resetsAt, now = Date.now()) {
  const ms = new Date(resetsAt || 0).getTime() - now;
  if (!(ms > 0)) return resetsAt ? '곧 초기화' : '';
  const h = Math.floor(ms / 3600e3), d = Math.floor(h / 24), m = Math.floor((ms % 3600e3) / 60e3);
  return `${d ? `${d}일 ${h % 24}시간` : h ? `${h}시간 ${m}분` : `${m}분`} 뒤 초기화`;
}
function createUsage({ ttlMs = 60_000, read = readToken, fetch = fetchJson, now = () => Date.now() } = {}) {
  let cache = null;
  return async function get() {
    if (cache && now() - cache.at < ttlMs) return cache.value;
    const token = await read();
    if (!token) { cache = { at: now(), value: { ok: false, error: 'Claude Code 로그인 정보를 못 읽음' } }; return cache.value; }
    try { cache = { at: now(), value: { ok: true, windows: summarize(await fetch(token)), at: now() } }; }
    catch (e) { cache = { at: now(), value: { ok: false, error: String(e?.message || e) } }; }
    return cache.value;
  };
}
module.exports = { createUsage, summarize, resetText, readToken, fetchJson };
