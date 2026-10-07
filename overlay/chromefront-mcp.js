// 크롬 도우미(claude -p --chrome)에게 붙이는 작은 MCP 서버(stdio, 줄 단위 JSON-RPC). 도구는 show_tab 하나.
// 크롬은 가려진 창(document.visibilityState 가 'hidden')에서는 영상을 불러오지 않는다. 도우미가 만든 창이 늘 다른 창 뒤에 있어서
// 유튜브가 0:00 로딩에서 멈췄다(2026-10-01 기록 확인). 그래서 재생 전에 그 탭의 창을 앞으로 가져오게 한다.
// 창 올리기는 오버레이(main.js /chrome-front)가 하고, 작업이 끝나면 사용자가 보던 앱으로 되돌린다.
// main.js 가 Electron 실행 파일을 ELECTRON_RUN_AS_NODE=1 로 돌려 띄운다(따로 node 가 없어도 되게).
const http = require('node:http');

const PORT = Number(process.env.SKINCLAUDE_PORT || 47831);

const TOOL = {
  name: 'show_tab',
  description: '사용자의 크롬에서 이 탭이 든 창을 맨 앞으로 가져와 화면에 보이게 한다. 창이 가려져 있으면(document.visibilityState 가 "hidden") '
    + '크롬이 영상·음악을 불러오지 않으니 재생하기 전에 부른다. 작업이 끝나면 마스코트가 사용자가 보던 앱으로 되돌린다.',
  inputSchema: {
    type: 'object',
    properties: {
      tabId: { type: 'number', description: '앞으로 가져올 탭 id(tabs_context_mcp 의 tabId)' },
      url: { type: 'string', description: '그 탭의 지금 주소(id 로 못 찾을 때 쓴다, 없어도 됨)' },
    },
    required: ['tabId'],
  },
};

// 오버레이에 창 올리기를 부탁하고 { ok, text } 를 받는다. 오버레이가 꺼져 있어도 도구 오류로만 끝나게 한다.
function askOverlay({ tabId, url = '' }, port = PORT) {
  return new Promise((resolve) => {
    const q = new URLSearchParams({ tab: String(tabId ?? ''), url: String(url || '') });
    const req = http.get({ host: '127.0.0.1', port, path: `/chrome-front?${q}`, timeout: 30_000 }, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({ ok: false, text: body || '오버레이 답이 비었어' }); } });
    });
    req.on('timeout', () => req.destroy(new Error('오버레이가 30초 안에 답하지 않았어')));
    req.on('error', (e) => resolve({ ok: false, text: `오버레이에 닿지 못했어: ${e.message}` }));
  });
}

// JSON-RPC 요청 하나 → 응답(알림이면 null)
async function handle(msg, { ask = askOverlay } = {}) {
  const { id, method, params } = msg || {};
  const reply = (body) => ({ jsonrpc: '2.0', id, ...body });
  if (method === 'initialize') {
    return reply({ result: { protocolVersion: params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'skinclaude', version: '1.0.0' } } });
  }
  if (method === 'tools/list') return reply({ result: { tools: [TOOL] } });
  if (method === 'tools/call') {
    if (params?.name !== TOOL.name) return reply({ error: { code: -32602, message: `모르는 도구: ${params?.name}` } });
    const r = await ask(params.arguments || {});
    return reply({ result: { content: [{ type: 'text', text: String(r.text || (r.ok ? '앞으로 가져왔어' : '못 가져왔어')) }], isError: !r.ok } });
  }
  if (method === 'ping') return reply({ result: {} });
  if (id === undefined || id === null) return null; // notifications/* 에는 답하지 않는다
  return reply({ error: { code: -32601, message: `지원하지 않는 요청: ${method}` } });
}

function serve(input = process.stdin, output = process.stdout) {
  let buf = '';
  input.setEncoding('utf8');
  input.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      let msg; try { msg = JSON.parse(line); } catch { continue; }
      handle(msg).then((res) => { if (res) output.write(JSON.stringify(res) + '\n'); });
    }
  });
  input.on('end', () => process.exit(0));
}

if (require.main === module) serve();
module.exports = { handle, askOverlay, TOOL };
