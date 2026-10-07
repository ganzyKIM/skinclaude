# 캐릭터 그림

이 폴더의 PNG 는 저장소에 올리지 않는다(원작 캐릭터의 팬 창작물). 직접 만든 그림을 여기에 넣으면 오버레이가 켜질 때 폴더를 읽어 쓴다(`main.js charFiles()`).

## 이름 규칙

`<form>_<key>.png` 또는 의상이 있으면 `<form>_<costume>_<key>.png`, 의상 기본 컷은 `<form>_<costume>.png`.

- `form`: `choten` | `ame`
- `costume`: `kimono` `bunny` `pajama` `casual` `summer` `lounge` `knit` `nurse` `swim` `saint` (기본 교복은 접두 없음)
- `key`(표정): `default` `joy` `shy` `pout` `worried` `jealous` `sleepy` `surprised` `smug` `sad` `laugh` `love` `thinking` `wave` `cheer` `rude` `smoke` 와 터치용 `peace` `dere` `contempt` `smirk` `angry` `yandere`

없는 표정은 `renderer/mascot.js` 의 `EMO_FILES` 후보 순서대로 대체되고, 의상 전용 표정이 없으면 의상 기본 컷을 쓴다. 최소한 `choten_default.png` 와 `ame_default.png` 는 있어야 한다.

## 규격

- 투명 배경 PNG, 세로 약 630px(바닥선·가운데를 맞춘 컷 — `txtgame/tools/char-normalize.mjs` 방식), 몸에서 2px 에 알파 ~45 인 옅은 그림자(`gen/soften-shadow.mjs`).
- 생성 파이프라인(제미나이 → 컷아웃 → 워터마크 제거 → 그림자)은 `gen/` 참고.
