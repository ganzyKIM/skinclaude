// overlay-ctl.sh install 이 부른다: ~/.claude/settings.json 에 마스코트 기록 훅(UserPromptSubmit → hooks/session-note.sh)을 단다.
// 이미 있으면 그대로 둔다. 다른 설정·훅은 건드리지 않고 합친다. 떼려면: node install-hook.js --remove
// (Electron 을 node 로 돌린다: ELECTRON_RUN_AS_NODE=1)
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const file = path.join(os.homedir(), '.claude', 'settings.json');
const COMMAND = 'sh "$HOME/.skinclaude/app/hooks/session-note.sh" 2>/dev/null || true';
const MARK = '.skinclaude/app/hooks/session-note.sh';
const remove = process.argv.includes('--remove');

let settings = {};
if (fs.existsSync(file)) {
  try { settings = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
    console.error(`~/.claude/settings.json 을 읽지 못해 훅을 달지 않았다: ${e.message}`); process.exit(0);
  }
}
const groups = Array.isArray(settings.hooks?.UserPromptSubmit) ? settings.hooks.UserPromptSubmit : [];
const has = groups.some((g) => (g.hooks || []).some((h) => String(h.command || '').includes(MARK)));
if (remove) {
  if (!has) { console.log('session-note hook: 없음'); process.exit(0); }
  const kept = groups.map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !String(h.command || '').includes(MARK)) })).filter((g) => g.hooks.length);
  if (kept.length) settings.hooks.UserPromptSubmit = kept; else delete settings.hooks.UserPromptSubmit;
  if (settings.hooks && !Object.keys(settings.hooks).length) delete settings.hooks;
} else {
  if (has) { console.log('session-note hook: 이미 있음'); process.exit(0); }
  settings.hooks = { ...(settings.hooks || {}), UserPromptSubmit: [...groups, { hooks: [{ type: 'command', command: COMMAND, timeout: 5 }] }] };
}
fs.mkdirSync(path.dirname(file), { recursive: true });
const mode = fs.existsSync(file) ? fs.statSync(file).mode & 0o777 : 0o600; // 원래 권한(600)을 지킨다
if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.skinclaude-bak`);
fs.writeFileSync(`${file}.tmp`, `${JSON.stringify(settings, null, 2)}\n`, { mode });
fs.chmodSync(`${file}.tmp`, mode);
fs.renameSync(`${file}.tmp`, file);
console.log(`session-note hook: ${remove ? '뗌' : '닮'} (${file})`);
