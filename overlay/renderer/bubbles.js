// 말풍선 여러 개와 최근 대화 기록의 순수 로직(test/bubbles.test.js). 렌더러는 전역 BUBBLES, 테스트는 module.exports 로 쓴다.
// 여러 세션이 동시에 일하면 한 말풍선을 서로 덮어써서 읽기 전에 사라지므로, 말하는 쪽(key: 세션·잡담·지시·마스코트 자신)마다
// 말풍선을 하나씩 두고 최대 3개까지 쌓는다. 같은 key 는 제자리에서 글만 바뀐다.
const BUBBLES = (() => {
  // 자리가 없으면 중요도(prio)가 가장 낮고 가장 오래 안 바뀐 것을 비운다. 새 말이 그보다 덜 중요하면 띄우지 않는다.
  function createSlots({ max = 3 } = {}) {
    let items = []; // [{ key, prio, at }] 쌓인 순서(뒤가 아래, 캐릭터 쪽)
    const weakest = () => [...items].sort((a, b) => a.prio - b.prio || a.at - b.at)[0];
    return {
      place(key, prio, at) {
        const hit = items.find((x) => x.key === key);
        if (hit) { hit.prio = prio; hit.at = at; return { action: 'update' }; }
        if (items.length < max) { items.push({ key, prio, at }); return { action: 'add' }; }
        const victim = weakest();
        if (prio < victim.prio) return { action: 'drop' };
        items = items.filter((x) => x !== victim);
        items.push({ key, prio, at });
        return { action: 'replace', victim: victim.key };
      },
      remove(key) { items = items.filter((x) => x.key !== key); },
      weakest: () => weakest()?.key ?? null,
      keys: () => items.map((x) => x.key),
      clear() { items = []; },
    };
  }

  // 최근 대화 기록: 최대 max 개. 같은 말이 3초 안에 또 오면(훅 중복 등) 한 번만 남긴다. load/save 로 재시작 뒤에도 이어진다.
  function createLog({ max = 20, load = () => [], save = () => {} } = {}) {
    let list = [];
    try { const l = load(); if (Array.isArray(l)) list = l.slice(-max); } catch {}
    return {
      add(entry) {
        const e = { at: Date.now(), who: 'mascot', tag: '', ...entry };
        e.text = String(e.text || '').trim();
        if (!e.text) return false;
        const last = list[list.length - 1];
        if (last && last.text === e.text && last.tag === e.tag && last.who === e.who && e.at - last.at < 3000) return false;
        list = [...list, e].slice(-max);
        try { save(list); } catch {}
        return true;
      },
      list: () => list.slice(),
      clear() { list = []; try { save(list); } catch {} },
    };
  }

  const clock = (ms) => {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  return { createSlots, createLog, clock };
})();
if (typeof module !== 'undefined') module.exports = BUBBLES;
