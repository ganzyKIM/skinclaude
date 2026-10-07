// 표정 컷의 캐릭터 크기·위치를 세트 기본 컷에 맞추는 계산(순수 함수, gen/test/normalize.test.mjs).
// 컷아웃 도구(txtgame tools/cutout.mjs)는 든 팔·퍼진 리본 머리·소품까지 포함한 윤곽을 400×658 틀에 꽉 맞추기 때문에,
// 포즈마다 캐릭터가 커졌다 작아지고 옆으로 움직였다. 그래서 윤곽 대신 "머리 꼭대기~발끝 키"와 "발끝·발 중심"으로 맞춘다.

// 알파 채널에서 발끝(가장 아래 불투명 행), 발 중심 x(발끝 근처 feetRows 행의 평균), 머리 꼭대기(발 중심 ±band 띠의
// 가장 위 불투명 행 — 옆으로 든 팔·리본은 띠 밖이라 무시)를 잰다. 전체 윤곽(top·minx·maxx)은 틀 밖으로 나가는지 볼 때 쓴다.
export function measure({ data, width: W, height: H, channels = 4 }, { alphaMin = 128, band = 30, feetRows = 25 } = {}) {
  const A = (x, y) => data[(y * W + x) * channels + channels - 1];
  let feet = -1, top = H, minx = W, maxx = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A(x, y) > alphaMin) {
    if (y > feet) feet = y; if (y < top) top = y; if (x < minx) minx = x; if (x > maxx) maxx = x;
  }
  if (feet < 0) return null;
  let sx = 0, c = 0;
  for (let y = Math.max(0, feet - feetRows + 1); y <= feet; y++) for (let x = 0; x < W; x++) if (A(x, y) > alphaMin) { sx += x; c++; }
  const fx = sx / c;
  let head = feet;
  const x0 = Math.max(0, Math.round(fx - band)), x1 = Math.min(W - 1, Math.round(fx + band));
  scan: for (let y = 0; y <= feet; y++) for (let x = x0; x <= x1; x++) if (A(x, y) > alphaMin) { head = y; break scan; }
  return { feet, fx, head, h: feet - head, top, minx, maxx };
}

// 원본을 scale 배로 키우고/줄여 (left, top)에 놓으면 키가 기본 컷과 같고 발끝·발 중심이 기본 컷 자리에 온다.
// 키가 먼저다: 윤곽이 틀 위로 나가거나 틀 폭보다 넓어질 때만 덜 키우고(clamped), 좌우 이동은 윤곽이 틀(여백 pad)
// 안에 남는 만큼만 한다(offCenter = 못 옮긴 px). 초텐은 리본 머리가 틀 폭을 거의 다 채워 옆으로 옮길 자리가 모자라다.
export function plan(src, ref, { width, pad = 2 }) {
  const want = ref.h / src.h, bounds = [want];
  if (src.feet > src.top) bounds.push((ref.feet - pad) / (src.feet - src.top)); // 발끝은 기본 컷 자리에 고정
  if (src.maxx > src.minx) bounds.push((width - 1 - 2 * pad) / (src.maxx - src.minx));
  const scale = Math.min(...bounds);
  const lo = pad + (src.fx - src.minx) * scale, hi = width - 1 - pad - (src.maxx - src.fx) * scale;
  const fx = Math.min(Math.max(ref.fx, lo), hi);
  return { scale, left: fx - src.fx * scale, top: ref.feet - src.feet * scale, clamped: scale < want - 1e-9, offCenter: Math.abs(ref.fx - fx) };
}

// 바꿀 필요가 없을 만큼 작은 차이인지(0.4% 미만 크기, 1px 미만 이동)
export const isNoop = (p) => Math.abs(p.scale - 1) < 0.004 && Math.abs(p.left) < 0.75 && Math.abs(p.top) < 0.75;

// srcW×srcH 원본을 s 배로 리사이즈해 W×H 틀의 (left, top)에 놓을 때, 틀 안에 들어오는 부분(extract)과 놓을 자리(at)
export function placement({ srcW, srcH, W, H }, s, left, top) {
  const scaledW = Math.round(srcW * s), scaledH = Math.round(srcH * s);
  const ox = Math.round(left), oy = Math.round(top);
  const ex = Math.max(0, -ox), ey = Math.max(0, -oy), ax = Math.max(0, ox), ay = Math.max(0, oy);
  const width = Math.min(scaledW - ex, W - ax), height = Math.min(scaledH - ey, H - ay);
  return { scaledW, scaledH, extract: { left: ex, top: ey, width, height }, at: { left: ax, top: ay } };
}

// 폼의 모든 세트({ ref, cuts: [측정값] })가 좌우까지 기준 컷에 맞으려면 틀 양옆을 몇 px 넓혀야 하는지(step 단위, 최대 max).
// 한 폼의 컷은 모두 같은 폭이어야 화면에서 가운데 정렬이 어긋나지 않으므로 폼 단위로 정한다.
export function sidePad(sets, { width, pad = 2, step = 10, max = 80 }) {
  for (let e = 0; e <= max; e += step) {
    const fits = sets.every(({ ref, cuts }) => cuts.every((m) => plan(m, { ...ref, fx: ref.fx + e }, { width: width + 2 * e, pad }).offCenter <= 1));
    if (fits) return e;
  }
  return max;
}
