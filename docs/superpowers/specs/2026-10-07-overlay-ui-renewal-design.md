# 오버레이 UI 정돈 — 설계 (2026-10-07)

사용자 요청: "채팅을 치는 칸이 좀더 간단하게 항상 보이면 좋겠다. 설정을 추가해서 캐릭터의 크기, 말소리 볼륨(그 외 필요한 옵션)을 넣어라. 변신·마이크 온오프·대화 로그는 외부에 보이게. 닫기는 다른 위치에. 대화로 요청한 게 아니더라도 음성으로 완료를 안내해 주는 옵션(앱의 모든 대화창)."

사용자가 고른 것: 닫기는 설정 패널 안 맨 아래 / 완료 알림 내용은 설정에서 고름(한 마디·요약까지) / 완료 알림은 오래 걸린 턴만(기본 30초).

## 1. 배치

```
            [말풍선 최대 3개]
                [캐릭터]
 ┌──────────────────────────────────┐
 │ 💬 │ 말 걸기…                 ↵ │   입력 바(항상 보임, 폭 320)
 └──────────────────────────────────┘
   ~/Desktop/skinclaude/workspace        ⚡ 모드일 때만: 지시 폴더(누르면 선택)
 [✞ 변신 ✞]              [🎙][📜][⚙]   버튼 줄 — 닫기(×)는 없다
```

기록(📜)과 설정(⚙) 패널은 캐릭터 왼쪽(자리가 없으면 오른쪽)에 뜨고, 둘 중 하나만 열린다.

## 2. 입력 바

- 한 줄 textarea. 글이 길면 3줄까지 자란다. 폭 320px.
- 왼쪽 칩 `💬`/`⚡`: 잡담·지시 전환(지금의 모드 버튼). 문장 앞 `>`로 한 번만 지시하는 규칙은 그대로.
- 오른쪽 `↵`: 보내기. 작업 중에는 `⏹`(취소)이 되고, 입력칸은 비활성에 안내 글("생각 중…"·"클로드 작업 중… (폴더)")이 placeholder 로 보인다.
- 포커스 없을 때 투명도 .72, 포커스 오면 불투명 + 자홍 외곽선.
- 포커스 얻기: 입력칸 클릭, ⌥⇧Space(단축키, 이미 포커스면 되돌아가기). 💬 버튼은 없앤다.
- 포커스 잃기: Esc, 다른 창 클릭(blur). 그때 main 이 직전 앱으로 포커스를 돌려준다(지금의 closeInputFocus).
- Enter 보내기 뒤 포커스는 남는다. Shift+Enter 줄바꿈.
- 입력 바는 늘 클릭 영역이다(그 자리의 Claude 창은 클릭이 안 닿는다 — 사용자에게 알렸다).
- 입력칸을 열었다는 뜻의 `setInputState(true)`는 포커스 얻을 때, `false`는 잃을 때 보낸다(main 의 inputOpen·blur 처리와 같은 뜻).

## 3. 버튼 줄

- 왼쪽 `✞ 변신 ✞`(모양 그대로), 오른쪽에 `🎙`·`📜`·`⚙`(26×22). 사이를 `space-between` 으로 띄운다.
- `🎙` 상태 색(켜짐·듣는 중·말하는 중·오류)은 그대로.

## 4. 설정 패널(⚙) — `renderer/settings.js`

머리: "⚙ 설정" + × (패널 닫기). Esc·⚙ 다시 누르기로도 닫힌다.

| 묶음 | 항목 | 값 | config |
|---|---|---|---|
| 모습 | 캐릭터 크기 | 슬라이더 60~140%, 10 단위, 기본 100 | `scale` (0.6~1.4) |
| | 의상 | select(지금 목록) | `costume` |
| | 자리 | "오른쪽 아래로 되돌리기" 버튼 | (렌더러 style 초기화) |
| 소리 | 목소리 크기 | 슬라이더 50~300%, 10 단위, 기본 100 | `voice.gain` (0.5~3, 말로 바꾸는 값과 같다) |
| | 효과음 | 토글(띠링·또롱·진행음), 기본 켬 | `sounds` (bool) |
| | 음성 언어 | select ko/ja/en | `voice.lang` |
| 완료 알림(앱의 모든 대화) | 목소리로 알림 | 토글, 기본 켬 | `announce.on` |
| | 내용 | 한 마디만 / 요약까지 | `announce.mode` ('line'/'summary') |
| | 기준 | 모든 턴 / 10초 / 30초(기본) / 1분 / 3분 넘게 걸린 턴만 | `announce.minSec` (0/10/30/60/180) |
| 지시 | 폴더 | 버튼(경로 표시, 누르면 선택) | `taskCwd` |
| | 실행 권한 | select(지금 목록) | `permissionMode` |
| 맨 아래 | `⌥⇧Space 입력칸 · Esc 되돌아가기` 안내, 빨간 "오버레이 끄기" | | (quit) |

- 바꾸면 즉시 적용·저장. 저장 버튼 없음.
- 렌더러 → main: `setSetting(key, value)` 하나. main 은 허용 목록·범위를 검사(`settings.js` 순수 함수)하고 `saveConfig(); sendConfig()`. 기존 `setCostume`·`setPermissionMode`·`setVoice({lang})`·`pickFolder` 는 그대로 쓴다.
- main 이 보내는 config 로 패널 값이 맞춰진다(말로 "목소리 키워" 하면 슬라이더도 움직인다).
- 캐릭터 크기: `.mascot-img{ height: calc(300px * var(--scale)) }`. 창 높이에 안 들어가면(`innerHeight - 160`) 그만큼 줄여 쓴다. 바꾼 뒤 끌어 놓은 자리를 창 안으로 당긴다(resize 와 같은 처리).
- 효과음 끔: 렌더러 `chime()`·`workTick()` 이 `config.sounds === false` 면 소리를 내지 않는다.

## 5. 완료 음성 알림 — `announce.js` + main.js

- 훅 서버가 `UserPromptSubmit` 에서 세션별 시작 시각을 적고(`startedAt[session_id]`), `Stop` 에서 걸린 시간을 잰다.
- 말할 조건(`ANNOUNCE.shouldAnnounce`): `announce.on` && 훅의 `cwd` 가 `~/.skinclaude/` 아래가 아님(마스코트 자신의 잡담·크롬 도우미 세션 제외) && `source !== 'task'`(마스코트의 ⚡ 지시는 아래 따로) && 걸린 시간 ≥ `minSec`(시작 시각을 모르면 말하지 않는다).
- 말할 글(`ANNOUNCE.text`): `VOICE.doneLine(who, lang, { title, folder })` — 제목은 `sessionLabel` 의 대화 제목, 없으면 폴더 이름. 일본어·영어 모드에서 한글 제목이면 폴더 이름(넘긴 일 알림 `delegateLine` 과 같은 규칙). `mode === 'summary'` 면 `VOICE.spokenSummary(last_assistant_message, 100)` 을 뒤에 잇는다.
  - 초텐 ko: "P, {t} 끝났어♡ 확인해 봐!" / 아메 ko: "…{t}, 끝났어. 봐 봐." (ja·en 도 둔다)
- 마스코트의 ⚡ 지시·크롬·넘긴 일이 글로 요청됐을 때도 같은 기준(시작 시각부터 `minSec`)이면 같은 한 마디(또는 요약)를 말한다. 음성으로 요청한 것은 지금처럼 결과를 읽고 끝(중복으로 말하지 않는다).
- 음성 모드가 꺼져 있어도 말한다: `utterance(who, lang, { announce: true })` 는 `config.voice.on` 검사를 건너뛴다. 말한 뒤 이어 듣기 창은 열지 않는다(`follow: false`). 마이크 버튼 표시는 음성 모드가 꺼져 있으면 건드리지 않는다.
- 캐릭터가 말하는 중이면 `speakChain` 으로 줄을 선다.

## 6. 바꾸는 파일

- `renderer/index.html`·`style.css`·`mascot.js`: 입력 바·버튼 줄·크기·효과음.
- `renderer/settings.js`(새): 설정 패널 그리기·값 맞추기·보내기.
- `preload.js`: `setSetting`, `resetPosition` 은 렌더러 안에서 끝난다(IPC 없음).
- `settings.js`(새, main 쪽 순수): 허용 목록·범위 검사 → 테스트.
- `announce.js`(새, 순수): 판단·글 만들기 → 테스트.
- `voice.js`: `doneLine`.
- `main.js`: 시작 시각 기록, Stop 알림, set-setting IPC, utterance 의 announce 통과, 글로 요청한 지시 결과 알림.
- `hittest`: 바뀜 없음(렌더러가 보내는 사각형에 입력 바가 늘 들어간다).

## 7. 검증

- node 테스트: `settings.js`(범위·허용 목록), `announce.js`(제외 조건·시간 기준·글), `voice.doneLine`(캐릭터·언어·제목 규칙).
- 화면: 설치 뒤 `/shot` 으로 평소·포커스·⚡·설정 열림·크기 140%·60% 확인. 입력 바 클릭 → 포커스 → Esc → 직전 앱으로 돌아가는지.
- 알림: `/hook` 에 가짜 `UserPromptSubmit`→(대기)→`Stop` 을 넣어 한 번 말하게 한다(소리 한 번 남). 기준 미만·`~/.skinclaude/` 세션은 말하지 않는지 로그로.
- 재시작은 쉬는 틈에 한 번.

## 8. 하지 않는 것

- 모델 선택·단축키 바꾸기 UI(config.json 으로 충분), 말풍선 크기 조절, 설정 패널의 저장/되돌리기 버튼.
