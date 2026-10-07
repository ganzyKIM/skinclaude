// projects.js — Claude 세션 기록에서 프로젝트·대화 목록 만들기 (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const P = require('../projects.js');

const line = (o) => JSON.stringify(o) + '\n';
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skc-projects-'));
  const put = (cwd, id, lines, { pad = 0, mtime } = {}) => {
    const dir = path.join(root, P.encodeCwd(cwd));
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, `${id}.jsonl`);
    fs.writeFileSync(f, lines.map(line).join('') + (pad ? line({ type: 'pad', x: 'x'.repeat(pad) }) : ''));
    if (mtime) fs.utimesSync(f, mtime / 1000, mtime / 1000);
    return f;
  };
  return { root, put };
}

test('기록 폴더 이름은 경로의 영문자·숫자 말고 모두 "-"', () => {
  assert.equal(P.encodeCwd('/Users/a/Desktop/window_simulator'), '-Users-a-Desktop-window-simulator');
  assert.equal(P.encodeCwd('/Users/a/.skinclaude/크롬'), '-Users-a--skinclaude---');
});

test('세션 하나: 기록 폴더와 맞는 cwd·마지막 제목·첫 말·마지막 지시를 읽는다', () => {
  const { root, put } = fixture();
  // 세션 도중 cd 로 옮겨 갔어도(txtgame → skinclaude) 이어 쓰기는 처음 폴더에서 해야 한다
  const f = put('/Users/a/Desktop/txtgame', 'd16dfe26-aaaa', [
    { type: 'user', cwd: '/Users/a/Desktop/skinclaude', message: { role: 'user', content: '<command-name>/model</command-name>' } },
    { type: 'user', cwd: '/Users/a/Desktop/txtgame', message: { role: 'user', content: [{ type: 'text', text: '텍스트 게임에\n스킨을 입히자' }] } },
    { type: 'custom-title', customTitle: '옛 제목' },
    { type: 'custom-title', customTitle: '텍스트 게임 UI 스킨 작업' },
    { type: 'last-prompt', lastPrompt: '퀴즈를 더 만들어 \\"놓고\\"' },
  ]);
  const s = P.readSession(f, P.encodeCwd('/Users/a/Desktop/txtgame'));
  assert.equal(s.cwd, '/Users/a/Desktop/txtgame');
  assert.equal(s.title, '텍스트 게임 UI 스킨 작업');
  assert.equal(s.first, '텍스트 게임에 스킨을 입히자');
  assert.equal(s.last, '퀴즈를 더 만들어 \\"놓고\\"');
  assert.equal(s.id, 'd16dfe26-aaaa');
  // 기록 폴더와 맞는 cwd 가 하나도 없으면 이어 쓸 수 없다
  const g = put('/Users/a/Desktop/agent', 'x1', [{ type: 'user', cwd: '/Users/a', message: { content: 'hi' } }]);
  assert.equal(P.readSession(g, P.encodeCwd('/Users/a/Desktop/agent')), null);
  fs.rmSync(root, { recursive: true });
});

test('목록: 폴더별로 묶고 최근 순, 오버레이 자신·임시 폴더·제목 없는 작은 세션은 뺀다', () => {
  const { root, put } = fixture();
  const now = Date.now();
  put('/Users/a/Desktop/pofol', 'p1', [{ type: 'user', cwd: '/Users/a/Desktop/pofol', message: { content: '포트폴리오 기획' } }, { customTitle: '포트폴리오 사이트 기획' }], { mtime: now - 3600_000 });
  put('/Users/a/Desktop/sk', 's1', [{ cwd: '/Users/a/Desktop/sk' }, { customTitle: '스킨' }], { mtime: now - 60_000 });
  put('/Users/a/Desktop/sk', 's2', [{ cwd: '/Users/a/Desktop/sk' }, { customTitle: '옛 대화' }], { mtime: now - 86_400_000 });
  put('/Users/a/Desktop/sk', 'tiny', [{ type: 'user', cwd: '/Users/a/Desktop/sk', message: { content: '너는 초텐쨩. 인사만.' } }], { mtime: now });  // 제목 없는 작은 세션
  put('/Users/a/Desktop/sk/workspace', 'w1', [{ cwd: '/Users/a/Desktop/sk/workspace' }, { customTitle: '지시' }]);
  put('/private/tmp/x', 't1', [{ cwd: '/private/tmp/x' }, { customTitle: '임시' }]);
  put('/Users/a', 'h1', [{ type: 'user', cwd: '/Users/a', message: { content: '홈에서 한 말' } }], { pad: 200 * 1024 }); // 홈 바로 아래 제목 없음
  const list = P.scan({ root, home: '/Users/a', exclude: ['/Users/a/Desktop/sk/workspace', '/private/tmp'] });
  assert.deepEqual(list.map((p) => p.cwd), ['/Users/a/Desktop/sk', '/Users/a/Desktop/pofol']);
  assert.deepEqual(list[0].sessions.map((s) => s.id), ['s1', 's2']);
  assert.equal(list[0].name, 'sk');
  // 찾기: id 앞자리로, 없으면 가장 최근
  assert.equal(P.findSession(list, '/Users/a/Desktop/sk', 'S2').id, 's2');
  assert.equal(P.findSession(list, '/Users/a/Desktop/sk/').id, 's1');
  assert.equal(P.findSession(list, '/Users/a/Desktop/sk', 'zz'), null);
  assert.equal(P.findSession(list, '/Users/a/Desktop/none'), null);
  // 방금 바뀐 기록은 '지금 쓰는 중'
  assert.equal(P.isActive(list[0].sessions[0], now), true);
  assert.equal(P.isActive(list[1].sessions[0], now), false);
  const text = P.catalogText(list, { now });
  assert.match(text, /- \/Users\/a\/Desktop\/sk\n {4}· "스킨" 대화 s1 \(\d\d-\d\d \d\d:\d\d, 지금 쓰는 중\)/);
  assert.match(text, /"포트폴리오 사이트 기획" 대화 p1/);
  fs.rmSync(root, { recursive: true });
});

test('under: 그 폴더 자신과 그 아래만', () => {
  assert.equal(P.under('/a/b/c', '/a/b'), true);
  assert.equal(P.under('/a/b', '/a/b/'), true);
  assert.equal(P.under('/a/bc', '/a/b'), false);
});

test('지시 에이전트 규칙: 목록·최근 넘긴 곳(6시간 안)·직전 지시(5분 안)', () => {
  const now = Date.now();
  const projects = [{ cwd: '/Users/a/pofol', name: 'pofol', at: now - 60_000, sessions: [{ id: '0ce669b1-x', title: '포트폴리오 사이트 기획', first: '', last: '', at: now - 60_000 }] }];
  const t = P.rulesText({ projects, route: { folder: '/Users/a/pofol', sessionId: '0ce669b1-x', title: '포트폴리오 사이트 기획', at: now - 10 * 60_000 }, lastDispatch: { text: '앱 고쳐', answer: '어느 앱?', at: now - 30_000 }, now });
  assert.match(t, /mcp__skinclaude__delegate/);
  assert.match(t, /"포트폴리오 사이트 기획" 대화 0ce669b1/);
  assert.match(t, /최근 마스코트가 넘긴 곳: "포트폴리오 사이트 기획" \(\/Users\/a\/pofol, 대화 0ce669b1, 10분 전\)/);
  assert.match(t, /직전 지시: "앱 고쳐" → 네 답: "어느 앱\?"/);
  const old = P.rulesText({ projects, route: { folder: '/Users/a/pofol', sessionId: 's', at: now - 7 * 3600_000 }, lastDispatch: { text: 'x', answer: 'y', at: now - 10 * 60_000 }, now });
  assert.doesNotMatch(old, /최근 마스코트가 넘긴 곳|직전 지시/);
});

test('넘긴 일의 모델은 그 대화의 설정: 앱에서 고른 모델·effort → 그 대화의 마지막 모델 → 없음(2026-10-04)', () => {
  const { root, put } = fixture();
  const f = put('/Users/a/Desktop/pofol', 's-term', [
    { type: 'user', cwd: '/Users/a/Desktop/pofol', message: { role: 'user', content: '시작' } },
    { type: 'assistant', cwd: '/Users/a/Desktop/pofol', message: { model: 'claude-sonnet-5-5', content: [{ type: 'text', text: '네' }] } },
    // 도구 결과 속의 "model" 글자(따옴표가 \" 로 적힌다)와 합성 메시지는 모델로 치지 않는다
    { type: 'user', cwd: '/Users/a/Desktop/pofol', message: { role: 'user', content: [{ type: 'tool_result', content: '{"model":"claude-haiku-4-5"}' }] } },
    { type: 'assistant', cwd: '/Users/a/Desktop/pofol', message: { model: 'claude-opus-5-5', content: [{ type: 'text', text: '했어' }] } },
    { type: 'assistant', cwd: '/Users/a/Desktop/pofol', message: { model: '<synthetic>', content: [] } },
  ]);
  assert.equal(P.readSession(f, P.encodeCwd('/Users/a/Desktop/pofol')).model, 'claude-opus-5-5');
  // 데스크톱 앱이 적어 둔 설정(claude-code-sessions/<계정>/<조직>/local_*.json)
  const app = fs.mkdtempSync(path.join(os.tmpdir(), 'skc-appsessions-')), dir = path.join(app, 'acct', 'org');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'local_1.json'), JSON.stringify({ sessionId: 'local_1', cliSessionId: 's-app', model: 'claude-fable-5-1', effort: 'high', title: '포트폴리오' }));
  fs.writeFileSync(path.join(dir, 'local_2.json'), '{깨진 파일');
  assert.deepEqual(P.appSettings('s-app', { root: app }), { model: 'claude-fable-5-1', effort: 'high' });
  assert.deepEqual(P.runSettings('s-app', { model: 'claude-opus-5-5', root: app }), { model: 'claude-fable-5-1', effort: 'high', from: 'app' });
  assert.deepEqual(P.runSettings('s-term', { model: 'claude-opus-5-5', root: app }), { model: 'claude-opus-5-5', effort: null, from: 'log' });
  assert.deepEqual(P.runSettings('s-none', { root: app }), { model: null, effort: null, from: null });
  assert.equal(P.appSettings('s-app', { root: path.join(app, 'missing') }), null);
});
