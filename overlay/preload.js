const { contextBridge, ipcRenderer } = require('electron');
const on = (ch) => (cb) => ipcRenderer.on(ch, (_e, payload) => cb(payload));
contextBridge.exposeInMainWorld('overlay', {
  onHook: on('hook'), onTrack: on('track'), onConfig: on('config'),
  onOpenInput: on('open-input'), onCloseInput: on('close-input'),
  onRunStart: on('run-start'), onRunDone: on('run-done'), onChatDelta: on('chat-delta'), onDebugSend: on('debug-send'),
  setHitRects: (r) => ipcRenderer.send('hit-rects', r), // 클릭 영역 사각형들 → main 이 커서 위치로 판정(hittest.js)
  setInputState: (open) => ipcRenderer.send('input-state', !!open),
  getConfig: () => ipcRenderer.send('get-config'),
  setForm: (form) => ipcRenderer.send('set-form', form),
  setPermissionMode: (m) => ipcRenderer.send('set-permission-mode', m),
  setCostume: (c) => ipcRenderer.send('set-costume', c),
  setSetting: (key, value) => ipcRenderer.send('set-setting', { key, value }), // 설정 패널(settings.js 허용 목록)
  getUsage: () => ipcRenderer.send('get-usage'), onUsage: on('usage'), // 설정 패널의 Claude 사용량(usage.js)
  send: (payload) => ipcRenderer.send('send', payload),
  cancel: () => ipcRenderer.send('cancel'),
  openInApp: (sessionId) => ipcRenderer.send('open-in-app', sessionId),
  pickFolder: () => ipcRenderer.send('pick-folder'),
  quit: () => ipcRenderer.send('quit'),
  // 음성 모드: 켜기·언어(ko|ja), 소리 다 틀었음 알림, 상태·재생·부른 캐릭터·들은 말
  setVoice: (v) => ipcRenderer.send('set-voice', v),
  setSendMode: (m) => ipcRenderer.send('send-mode', m), // 💬 잡담 / ⚡ 지시 — 음성도 이 선택을 따른다
  voicePlayed: () => ipcRenderer.send('voice-played'),
  onVoiceState: on('voice-state'), onVoiceStream: on('voice-stream'), onVoiceBoost: on('voice-boost'), onVoiceWork: on('voice-work'), onSendModeSet: on('send-mode-set'), onVoiceCall: on('voice-call'), onVoiceHeard: on('voice-heard'),
  onVoiceChime: on('voice-chime'), // 'start' 띠링(듣는 중) / 'done' 또롱(알아들음)
});
