// 제미나이 페이지에서 생성 이미지를 로컬로 받는 임시 서버 (127.0.0.1:47832).
// 페이지 JS가 canvas→base64 로 만든 PNG 를 POST /upload 로 보내면 raw/ 에 저장한다.
// https 페이지 → http://127.0.0.1 은 크롬이 안전한 컨텍스트로 봐서 허용되지만 CORS + Private Network Access 헤더가 필요하다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const OUT = path.resolve('raw'); fs.mkdirSync(OUT, { recursive: true });
const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://gemini.google.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
};
http.createServer((req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method === 'POST' && req.url === '/upload') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 30_000_000) req.destroy(); });
    req.on('end', () => {
      try {
        const { name, b64 } = JSON.parse(body);
        const safe = String(name).replace(/[^a-z0-9_-]/gi, '_');
        const file = path.join(OUT, `${safe}.png`);
        fs.writeFileSync(file, Buffer.from(b64, 'base64'));
        console.log(new Date().toISOString(), 'saved', file, fs.statSync(file).size);
        res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, file, bytes: fs.statSync(file).size }));
      } catch (e) { res.writeHead(400); res.end(String(e)); }
    });
    return;
  }
  res.writeHead(404); res.end();
}).listen(47832, '127.0.0.1', () => console.log('upload server on 127.0.0.1:47832 →', OUT));
