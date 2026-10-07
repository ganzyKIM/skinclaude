// projects-mcp.js — ⚡ 지시 에이전트에게 주는 list_projects·delegate MCP 서버 (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const { handle } = require('../projects-mcp.js');

test('도구 목록: list_projects·delegate', async () => {
  const init = await handle({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  assert.equal(init.result.serverInfo.name, 'skinclaude');
  const list = await handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.deepEqual(list.result.tools.map((t) => t.name), ['list_projects', 'delegate']);
  assert.deepEqual(list.result.tools[1].inputSchema.required, ['folder', 'instruction']);
  assert.equal(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
});

test('delegate 는 오버레이에 넘기고 그 답을 돌려준다. 빈 인자는 오버레이까지 가지 않는다', async () => {
  const asked = [];
  const ask = async (a) => { asked.push(a); return { ok: true, text: '넘겼어: "포트폴리오 사이트 기획"' }; };
  const r = await handle({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'delegate', arguments: { folder: '/Users/a/pofol', instruction: '헤더 색 바꿔', session_id: '0ce669b1' } } }, { ask });
  assert.deepEqual(asked, [{ folder: '/Users/a/pofol', instruction: '헤더 색 바꿔', session_id: '0ce669b1', mode: 'continue' }]);
  assert.deepEqual(r.result, { content: [{ type: 'text', text: '넘겼어: "포트폴리오 사이트 기획"' }], isError: false });
  const bad = await handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'delegate', arguments: { folder: '/x', instruction: ' ' } } }, { ask });
  assert.equal(bad.result.isError, true);
  assert.equal(asked.length, 1);
  const no = await handle({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'delegate', arguments: { folder: '/x', instruction: 'y', mode: 'new' } } },
    { ask: async (a) => { asked.push(a); return { ok: false, text: '폴더가 없어: /x' }; } });
  assert.equal(asked[1].mode, 'new');
  assert.deepEqual(no.result, { content: [{ type: 'text', text: '폴더가 없어: /x' }], isError: true });
});

test('list_projects 는 목록 글을 돌려준다', async () => {
  const r = await handle({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'list_projects', arguments: {} } }, { list: () => '- /Users/a/pofol' });
  assert.equal(r.result.content[0].text, '- /Users/a/pofol');
  const e = await handle({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'nope' } });
  assert.equal(e.error.code, -32602);
});
