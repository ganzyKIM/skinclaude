// chromefront-mcp.js — 크롬 도우미에게 주는 show_tab MCP 서버 (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { handle, askOverlay } = require('../chromefront-mcp.js');

test('초기화·도구 목록·알림', async () => {
  const init = await handle({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  assert.equal(init.result.protocolVersion, '2025-06-18');
  assert.deepEqual(init.result.capabilities, { tools: {} });
  const list = await handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.deepEqual(list.result.tools.map((t) => t.name), ['show_tab']);
  assert.deepEqual(list.result.tools[0].inputSchema.required, ['tabId']);
  assert.equal(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.equal((await handle({ jsonrpc: '2.0', id: 2, method: 'resources/list' })).error.code, -32601);
});

test('show_tab 은 오버레이에 부탁하고 결과를 글로 돌려준다', async () => {
  const asked = [];
  const ok = await handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'show_tab', arguments: { tabId: 7, url: 'https://x.y/' } } },
    { ask: async (a) => { asked.push(a); return { ok: true, text: '앞으로 가져왔어' }; } });
  assert.deepEqual(asked, [{ tabId: 7, url: 'https://x.y/' }]);
  assert.deepEqual(ok.result, { content: [{ type: 'text', text: '앞으로 가져왔어' }], isError: false });
  const bad = await handle({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'show_tab', arguments: { tabId: 8 } } },
    { ask: async () => ({ ok: false, text: '그 탭이 없어' }) });
  assert.equal(bad.result.isError, true);
  assert.equal((await handle({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'nope' } })).error.code, -32602);
});

test('오버레이 /chrome-front 로 탭 id 와 주소를 보낸다', async (t) => {
  let got = null;
  const server = http.createServer((req, res) => { got = new URL(req.url, 'http://x'); res.end(JSON.stringify({ ok: true, text: '됐어' })); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  const r = await askOverlay({ tabId: 691828777, url: 'https://www.youtube.com/watch?v=a&t=1' }, server.address().port);
  assert.deepEqual(r, { ok: true, text: '됐어' });
  assert.equal(got.pathname, '/chrome-front');
  assert.equal(got.searchParams.get('tab'), '691828777');
  assert.equal(got.searchParams.get('url'), 'https://www.youtube.com/watch?v=a&t=1');
});

test('오버레이가 꺼져 있으면 도구 오류로만 끝난다', async () => {
  const r = await askOverlay({ tabId: 1 }, 9); // 9번 포트엔 아무도 없다
  assert.equal(r.ok, false);
  assert.match(r.text, /닿지 못했어/);
});

test('stdio 로 띄우면 줄 단위 JSON-RPC 로 답한다', async () => {
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'chromefront-mcp.js')], { stdio: ['pipe', 'pipe', 'inherit'] });
  const lines = [];
  const done = new Promise((resolve) => {
    let buf = '';
    child.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { lines.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); if (lines.length === 2) resolve(); } });
  });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2024-11-05' } }) + '\n');
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) + '\n');
  await done;
  child.stdin.end();
  assert.deepEqual(lines.map((l) => l.id), [0, 1]);
  assert.equal(lines[0].result.serverInfo.name, 'skinclaude');
});
