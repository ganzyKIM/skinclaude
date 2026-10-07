// 캐릭터 목소리 키우기. 캐릭터가 말하는 동안 main 이 맥 출력 음량을 낮추면(다른 소리를 줄이려고) 목소리는 그만큼 키워 틀어 제 크기로 들리게 한다.
// 그냥 곱하면 큰 소리가 1.0 을 넘어 찢어지니, 넘칠 대목만 순간적으로 눌러 준다(앞 5ms 를 미리 보고 누르고 80ms 에 걸쳐 푼다).
// 렌더러에선 전역 BOOST, node 테스트(test/boost.test.js)에선 module.exports.
const BOOST = (() => {
  const LIM = 0.92;
  // ch(Float32Array, -1~1)를 제자리에서 gain 배 한다. state.env 는 조각 사이에 이어 쓰는 누름 상태.
  // from 을 주면 조각 처음의 배수 from 에서 끝의 gain 까지 고르게 바꿔 간다(조각마다 배수가 달라도 소리 크기가 툭 바뀌지 않게).
  function apply(ch, sampleRate, gain, state, from = gain) {
    const n = ch.length;
    if (!(Math.max(gain, from) > 1.01)) { // 키울 게 없다. 1 이 아니면(목소리를 줄여 둔 경우) 그대로 곱하기만 한다
      state.env = 0;
      if (gain !== 1 || from !== 1) for (let i = 0; i < n; i++) ch[i] *= from + (gain - from) * (i / n);
      return ch;
    }
    const look = Math.max(1, Math.round(sampleRate * 0.005)), decay = Math.exp(-1 / (sampleRate * 0.08));
    let env = state.env || 0;
    for (let i = 0; i < n; i++) {
      const g = from + (gain - from) * (i / n);
      let ahead = 0; // 지금부터 look 표본 안에서 가장 큰 값
      const end = Math.min(n, i + look + 1);
      for (let j = i; j < end; j++) { const a = Math.abs(ch[j]); if (a > ahead) ahead = a; }
      env = Math.max(ahead * g, env * decay);
      ch[i] = ch[i] * g * (env > LIM ? LIM / env : 1);
    }
    state.env = env;
    return ch;
  }
  return { apply, LIM };
})();
if (typeof module !== 'undefined') module.exports = BOOST;
