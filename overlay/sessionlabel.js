// 훅 이벤트가 어느 세션 얘기인지 말풍선 위에 띄울 이름표: "세션 제목 · 폴더"(test/sessionlabel.test.js).
// 제목은 Claude 앱 사이드바와 같은 customTitle, 없으면 자동 제목 aiTitle. 둘 다 세션 기록(jsonl)에 수시로 다시 적히므로
// 수십 MB 기록 전체 대신 끝부분만 읽고, 없을 때만 더 넓게 읽는다. 세션마다 30초 동안 기억한다.
const fs = require('node:fs');
const path = require('node:path');

const TAIL = 256 * 1024, WIDE = 8 * 1024 * 1024;

function titleFromText(text) {
  const last = (re) => { let m, v = ''; while ((m = re.exec(text))) v = m[1]; return v; };
  const raw = last(/"customTitle":"((?:[^"\\]|\\.)*)"/g) || last(/"aiTitle":"((?:[^"\\]|\\.)*)"/g);
  if (!raw) return '';
  try { return JSON.parse(`"${raw}"`); } catch { return raw; }
}

function readTail(file, bytes) {
  const fd = fs.openSync(file, 'r');
  try {
    const { size } = fs.fstatSync(fd), len = Math.min(size, bytes), buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    return buf.toString('utf8');
  } finally { fs.closeSync(fd); }
}

function createLabeler({ read = readTail, now = () => Date.now(), ttlMs = 30_000, maxTitle = 20 } = {}) {
  const cache = new Map(); // session_id → { at, title }
  return (p) => {
    if (!p.session_id) return '';
    let c = cache.get(p.session_id);
    if (!c || now() - c.at > ttlMs) {
      let title = '';
      if (p.transcript_path) {
        try { title = titleFromText(read(p.transcript_path, TAIL)) || titleFromText(read(p.transcript_path, WIDE)); } catch {}
      }
      c = { at: now(), title: title || c?.title || '' };
      cache.set(p.session_id, c);
    }
    const project = path.basename(String(p.cwd || '').replace(/\/+$/, ''));
    const t = c.title.length > maxTitle ? c.title.slice(0, maxTitle) + '…' : c.title;
    return [t, project].filter(Boolean).join(' · '); // 사이드바에서 세션을 알아보는 건 제목이라 앞에
  };
}

module.exports = { titleFromText, createLabeler };
