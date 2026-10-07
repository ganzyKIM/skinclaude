// 컷에 구워진 드롭섀도를 처음 원본 컷 수준으로 옅게 만드는 계산(순수 함수, gen/test/shadow.test.mjs).
// 텍스트게임 초기 원본은 그림자가 몸에서 2px에 알파 ~45, 8px 전후에서 사라지는데, 나중에 파이프라인이 입힌 컷은
// 2px에 ~120, 12px까지 번진다. 몸(알파 250 이상)에서의 거리별 그림자 농도를 재서, 거리마다 원본 농도에 맞춰 줄인다.
// 몸과 1px 가장자리(선화의 안티에일리어싱)는 건드리지 않고, 그림자 색(거의 검정~남색)인 반투명 픽셀만 바꾼다.
export const BODY_ALPHA = 250;
export const MAX_D = 20;
export const TOL = 0.1; // 목표와 10% 안쪽이면 그대로 둔다(반올림 때문에 다시 돌릴 때마다 조금씩 바뀌지 않게)

// 그림자 색: 원본 (0,0,0) 근처, 파이프라인 (21,20,37) 근처. 붉거나 밝은 색(머리카락 끝·연기)은 제외
export const isShadowColor = (r, g, b) => r <= 40 && g <= 40 && b <= 56 && b + 8 >= r;

// 1차원 제곱 거리 변환(Felzenszwalb & Huttenlocher)
function edt1(f, n) {
  const d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  const sect = (q, p) => ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p);
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = sect(q, v[k]);
    while (s <= z[k]) { k--; s = sect(q, v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const p = v[k]; d[q] = (q - p) * (q - p) + f[p]; }
  return d;
}

// mask(1=몸) → 각 픽셀에서 가장 가까운 몸 픽셀까지의 유클리드 거리. 몸이 없으면 전부 Infinity
export function edt(mask, w, h) {
  const INF = 1e12, g = new Float64Array(w * h), f = new Float64Array(h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = mask[y * w + x] ? 0 : INF;
    const d = edt1(f, h);
    for (let y = 0; y < h; y++) g[y * w + x] = d[y];
  }
  const out = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    const d = edt1(g.subarray(y * w, y * w + w), w);
    for (let x = 0; x < w; x++) out[y * w + x] = d[x] >= INF ? Infinity : Math.sqrt(d[x]);
  }
  return out;
}

export function bodyMask(data, w, h) {
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = data[i * 4 + 3] >= BODY_ALPHA ? 1 : 0;
  return m;
}

// 거리 k(반올림)마다 "그림자 색 픽셀의 알파 합 / 그 거리의 몸 밖 픽셀 수" — 그 거리의 그림자 농도
export function profile(data, dist, w, h) {
  const sum = new Float64Array(MAX_D + 1), cnt = new Float64Array(MAX_D + 1);
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3];
    if (a >= BODY_ALPHA) continue;
    const k = Math.round(dist[i]);
    if (k < 1 || k > MAX_D) continue;
    cnt[k]++;
    if (a > 0 && isShadowColor(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])) sum[k] += a;
  }
  return Array.from(sum, (s, k) => (cnt[k] ? s / cnt[k] : 0));
}

// 거리별 줄임 배율: 1px 가장자리는 1, 그 밖은 원본 농도/지금 농도(늘리지 않고, 목표와 TOL 안쪽이면 1)
export function factors(current, target) {
  return current.map((c, k) => {
    if (k <= 1 || c <= 0) return 1;
    const r = (target[k] || 0) / c;
    return r >= 1 - TOL ? 1 : r;
  });
}

const factorAt = (F, d) => {
  if (d <= 1) return 1;
  if (d >= MAX_D) return F[MAX_D];
  const lo = Math.floor(d), t = d - lo;
  return F[lo] * (1 - t) + F[lo + 1] * t;
};

// RGBA 버퍼의 그림자만 옅게 만든 새 버퍼와 바뀐 픽셀 수·전후 농도를 돌려준다. 몸·가장자리·그림자 색이 아닌 픽셀은 그대로
export function soften({ data, w, h, target }) {
  const dist = edt(bodyMask(data, w, h), w, h);
  const before = profile(data, dist, w, h);
  const F = factors(before, target);
  const out = Buffer.from(data);
  let changed = 0;
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3];
    if (a === 0 || a >= BODY_ALPHA || dist[i] <= 1) continue;
    if (!isShadowColor(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])) continue;
    const na = Math.round(a * factorAt(F, dist[i]));
    if (na !== a) { out[i * 4 + 3] = na; changed++; }
  }
  return { data: out, changed, before, after: profile(out, dist, w, h) };
}

// 기준 컷들의 농도 평균 = 목표
export function averageProfile(list) {
  return list[0].map((_, k) => list.reduce((s, p) => s + p[k], 0) / list.length);
}
