// ⚡ 지시 에이전트(claude -p, workspace 폴더)에게 붙이는 MCP 서버(stdio, 줄 단위 JSON-RPC, test/projects-mcp.test.js).
// 사용자가 Claude 와 작업해 온 다른 프로젝트("포트폴리오 사이트"·"텍스트 게임" 등)의 일을 마스코트에게 시키면, 에이전트가 직접 하지 않고
// 그 폴더의 그 대화 세션에 지시를 넘긴다(사용자 요청 2026-10-02). 도구 둘:
//  - list_projects: 프로젝트(작업 폴더)·대화 세션 목록(projects.js)
//  - delegate: 넘길 곳과 지시를 오버레이(main.js /delegate)에 알린다. 오버레이는 에이전트가 끝나면 그 세션을 이어(--resume) 지시를 실행하고,
//    진행 상황과 결과를 마스코트가 알려 준다.
// main.js 가 Electron 실행 파일을 ELECTRON_RUN_AS_NODE=1 로 돌려 띄운다(chromefront-mcp.js 와 같은 방식).
const http = require('node:http');
const PROJECTS = require('./projects');

const PORT = Number(process.env.SKINCLAUDE_PORT || 47831);
const EXCLUDE = (() => { try { return JSON.parse(process.env.SKINCLAUDE_EXCLUDE || '[]'); } catch { return []; } })();

const TOOLS = [
  {
    name: 'list_projects',
    description: '사용자가 이 맥에서 Claude 와 작업해 온 프로젝트 폴더와 그 대화 세션 목록(최근 순)을 본다. 폴더마다 대화 제목·id·마지막으로 쓴 때·마지막 지시가 나온다.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'delegate',
    description: '지시를 그 프로젝트 폴더의 Claude 대화 세션에 넘긴다. 그 세션의 Claude 가 지난 대화의 맥락을 갖고 작업하고, 진행과 결과는 마스코트가 사용자에게 알린다. '
      + '부르면 너의 일은 끝난다 — 더 하지 말고 한 줄로 마친다.',
    inputSchema: {
      type: 'object',
      properties: {
        folder: { type: 'string', description: '프로젝트 폴더의 절대 경로(목록의 폴더 그대로)' },
        instruction: { type: 'string', description: '그 세션에 보낼 지시. 사용자가 한 말을 그대로(받아쓰기 오타만 바로잡아) 담는다' },
        session_id: { type: 'string', description: '이어 쓸 대화의 id(목록의 8자리면 된다). 없으면 마스코트가 최근에 넘긴 대화나 그 폴더의 가장 최근 대화' },
        mode: { type: 'string', enum: ['continue', 'new'], description: 'continue(기본): 대화를 이어 간다. new: 그 폴더에서 새 대화를 시작한다(목록에 없는 폴더도 된다)' },
      },
      required: ['folder', 'instruction'],
    },
  },
];

// 오버레이에 넘길 곳을 알리고 { ok, text } 를 받는다. 오버레이가 꺼져 있어도 도구 오류로만 끝나게 한다.
function askOverlay(args, port = PORT) {
  return new Promise((resolve) => {
    const body = JSON.stringify(args || {});
    const req = http.request({ host: '127.0.0.1', port, path: '/delegate', method: 'POST', timeout: 30_000,
      headers: { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) } }, (res) => {
      let out = '';
      res.on('data', (d) => { out += d; });
      res.on('end', () => { try { resolve(JSON.parse(out)); } catch { resolve({ ok: false, text: out || '오버레이 답이 비었어' }); } });
    });
    req.on('timeout', () => req.destroy(new Error('오버레이가 30초 안에 답하지 않았어')));
    req.on('error', (e) => resolve({ ok: false, text: `오버레이에 닿지 못했어: ${e.message}` }));
    req.end(body);
  });
}

const listText = () => PROJECTS.catalogText(PROJECTS.listProjects({ exclude: EXCLUDE }), { maxProjects: 40, maxSessions: 6 }) || '(Claude 와 작업한 프로젝트 기록이 없어)';

// JSON-RPC 요청 하나 → 응답(알림이면 null)
async function handle(msg, { ask = askOverlay, list = listText } = {}) {
  const { id, method, params } = msg || {};
  const reply = (body) => ({ jsonrpc: '2.0', id, ...body });
  const text = (t, isError = false) => reply({ result: { content: [{ type: 'text', text: String(t) }], isError } });
  if (method === 'initialize') {
    return reply({ result: { protocolVersion: params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'skinclaude', version: '1.0.0' } } });
  }
  if (method === 'tools/list') return reply({ result: { tools: TOOLS } });
  if (method === 'tools/call') {
    const name = params?.name, a = params?.arguments || {};
    if (name === 'list_projects') { try { return text(list()); } catch (e) { return text(`목록을 못 읽었어: ${e.message}`, true); } }
    if (name === 'delegate') {
      if (!String(a.folder || '').trim() || !String(a.instruction || '').trim()) return text('folder 와 instruction 이 있어야 해', true);
      const r = await ask({ folder: a.folder, instruction: a.instruction, session_id: a.session_id || '', mode: a.mode === 'new' ? 'new' : 'continue' });
      return text(r.text || (r.ok ? '넘겼어' : '못 넘겼어'), !r.ok);
    }
    return reply({ error: { code: -32602, message: `모르는 도구: ${name}` } });
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
module.exports = { handle, askOverlay, TOOLS };
