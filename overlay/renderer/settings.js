// 설정 패널(⚙) — 가끔만 만지는 값(사용자 2026-10-07 "캐릭터의 크기, 말소리 볼륨 … 가끔만 조절하기 때문에 설정 안으로").
// 값을 바꾸면 바로 main 에 보내고(setSetting, 허용 목록은 settings.js) main 이 되돌려 주는 config 로 패널 값을 맞춘다 — 말로 "목소리 키워"
// 해도 슬라이더가 따라온다. 캐릭터 크기·효과음·자리는 렌더러가 바로 적용한다(api.onScale·onSounds·resetPosition).
// 의상·음성 언어·실행 권한의 select 는 id 가 그대로라(costume·vlang·perm) mascot.js 의 기존 배선이 맡는다.
const SETTINGS_UI = (() => {
  const $ = (id) => document.getElementById(id);
  let api = null;
  function init(a) {
    api = a;
    const scale = $('set-scale'), gain = $('set-gain');
    scale.addEventListener('input', () => { $('set-scale-v').textContent = `${scale.value}%`; api.onScale(Number(scale.value) / 100); }); // 끌면서 바로 보인다
    scale.addEventListener('change', () => api.setSetting('scale', Number(scale.value) / 100));
    gain.addEventListener('input', () => { $('set-gain-v').textContent = `${gain.value}%`; });
    gain.addEventListener('change', () => api.setSetting('voice.gain', Number(gain.value) / 100));
    $('set-sounds').addEventListener('change', (e) => { api.onSounds(e.target.checked); api.setSetting('sounds', e.target.checked); });
    $('set-announce').addEventListener('change', (e) => api.setSetting('announce.on', e.target.checked));
    $('set-announce-mode').addEventListener('change', (e) => api.setSetting('announce.mode', e.target.value));
    $('set-announce-min').addEventListener('change', (e) => api.setSetting('announce.minSec', Number(e.target.value)));
    $('set-folder').addEventListener('click', () => api.pickFolder());
    $('set-reset').addEventListener('click', () => api.resetPosition());
    $('settings-close').addEventListener('click', () => api.close());
  }
  // Claude 사용량: 패널이 열려 있는 동안 1분마다 main 에 묻는다(main 이 60초 캐시). 닫히면 멈춘다
  let usageTimer = null;
  function watchUsage(on) {
    clearInterval(usageTimer); usageTimer = null;
    if (!on) return;
    api.getUsage(); usageTimer = setInterval(() => api.getUsage(), 60_000);
  }
  function showUsage(u) {
    const rows = $('usage-rows'), note = $('usage-note');
    if (!u?.ok) { rows.replaceChildren(Object.assign(document.createElement('div'), { className: 'set-note', textContent: `못 읽음: ${u?.error || ''}` })); note.textContent = ''; return; }
    note.textContent = `(${new Date(u.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준)`;
    rows.replaceChildren(...u.windows.flatMap((w) => {
      const row = document.createElement('div'); row.className = 'usage-row';
      const label = document.createElement('label'); label.textContent = w.label;
      const bar = document.createElement('div'); bar.className = `usage-bar${w.pct >= 90 ? ' hot' : ''}`;
      const fill = document.createElement('i'); fill.style.width = `${w.pct}%`; bar.append(fill);
      const pct = document.createElement('span'); pct.className = 'usage-pct'; pct.textContent = `${w.pct}%`;
      row.append(label, bar, pct);
      const reset = document.createElement('div'); reset.className = 'usage-reset'; reset.textContent = w.reset || '';
      return [row, reset];
    }));
    if (!u.windows.length) rows.replaceChildren(Object.assign(document.createElement('div'), { className: 'set-note', textContent: '한도 정보가 없어(API 키·게이트웨이 계정)' }));
  }
  // main 이 보낸 config 로 패널 값 맞추기(의상·언어·권한은 mascot.js 의 applyConfig 가 이미 맞춘다)
  function apply(c) {
    const scale = Math.round((Number(c.scale) || 1) * 100), gain = Math.round((Number(c.voice?.gain) || 1) * 100);
    $('set-scale').value = scale; $('set-scale-v').textContent = `${scale}%`;
    $('set-gain').value = gain; $('set-gain-v').textContent = `${gain}%`;
    $('set-sounds').checked = c.sounds !== false;
    $('set-announce').checked = !!c.announce?.on;
    $('set-announce-mode').value = c.announce?.mode === 'summary' ? 'summary' : 'line';
    $('set-announce-min').value = String([0, 10, 30, 60, 180].includes(Number(c.announce?.minSec)) ? Number(c.announce.minSec) : 30);
    // 긴 경로는 앞을 줄이려고 direction:rtl 로 보이는데, 그러면 맨 앞 "~/" 가 뒤로 가서 LRM(‎)으로 감싼다(mascot.js 와 같게)
    $('set-folder-v').textContent = `‎${api.shortenPath(c.taskCwd || '~')}‎`;
    $('set-folder').title = `지시 폴더: ${c.taskCwd || ''}`;
  }
  return { init, apply, watchUsage, showUsage };
})();
