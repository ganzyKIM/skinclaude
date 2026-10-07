# skinclaude

Claude 데스크톱 앱 위에 떠 있는 마스코트 오버레이. 두 캐릭터(초텐·아메)가 Claude Code 세션의 진행을 말풍선으로 중계하고, 말을 걸면 잡담하거나 지시를 대신 실행하고, 이름을 부르면 목소리로 대답한다. macOS 전용.

> 캐릭터 그림은 원작 캐릭터의 팬 창작물이라 저장소에 넣지 않았다. `overlay/assets/char/README.md` 의 이름 규칙대로 직접 만든 그림을 넣어야 한다.

## 무엇을 하나

- **진행 중계**: Claude Code 의 훅(UserPromptSubmit·PreToolUse·Notification·Stop)을 받아 "파일 읽는 중…", "다 했어~♡ …" 같은 말풍선과 표정으로 보여 준다. 앱의 모든 대화창이 대상이고, 말풍선 위에 "대화 제목 · 폴더" 이름표가 붙는다.
- **입력 바**: 캐릭터 아래 늘 보이는 한 줄. 💬 잡담은 캐릭터가 답하고, ⚡ 지시는 `claude -p` 로 실행한다. 지시는 "포트폴리오 세션에…"처럼 말하면 그 폴더의 기존 대화에 이어 돌린다(`projects.js`).
- **음성 모드**(🎙): "쵸텐짱"·"아메" 같은 이름으로 부르면 듣고, 캐릭터 목소리로 답한다. 듣기는 Apple 온디바이스 받아쓰기(`helper/sttd.swift`), 말하기는 mlx-audio 의 Qwen3-TTS(`tts/ttsd.py`). 한국어·일본어·영어.
- **바로 하기**(`intent.js`): 변신·의상·노래 멈춤/다음 곡·맥 음량·화면 켜고 끄기·유튜브 재생·검색·사이트 열기는 모델 없이 즉시 한다. 웹 일은 Claude in Chrome 으로 넘긴다(`chromeflow.js`).
- **완료 알림**: 앱의 어느 대화창이든 오래 걸린 턴이 끝나면 "P, ○○ 끝났어♡"라고 말한다(설정에서 끄거나 기준을 바꾼다).
- **설정**(⚙): 캐릭터 크기, 목소리 크기, 효과음, 음성 언어, 완료 알림, 지시 폴더·권한, 오버레이 끄기.

## 구성

```
overlay/            Electron 앱(투명·항상 위 창). main.js 가 훅 서버(127.0.0.1:47831)·음성·지시 실행을 맡는다
  renderer/         화면(말풍선·입력 바·설정 패널·터치 대사)
  helper/           Swift 도우미 — claudewin(Claude 창 위치 추적), sttd(받아쓰기·말 끝 판정·참조 에코 제거)
  tts/ttsd.py       목소리 합성 데몬(Qwen3-TTS, 스트리밍)
  hooks/            Claude Code 훅(넘긴 일의 기록을 그 대화 화면에 남기기)
  test/             node --test
bin/overlay-ctl.sh  install | start | stop | status | watch
bin/applets/        "오버레이 켜기/끄기" 애플스크립트(bin/build-applets.sh 로 .app 생성)
gen/                캐릭터 그림 생성 파이프라인(제미나이 → 컷아웃 → 워터마크 제거 → 그림자 보정)과 목소리 설계
docs/               기획서·구현 계획·조사 보고서
```

런타임은 `~/.skinclaude/` 에 산다: `app/`(설치본), `config.json`, `tts/`(venv·목소리 참조·모델), `session-notes/`, `paused`(끔 표시). 로그는 `~/Library/Logs/skinclaude-overlay.log`.

## 요구 사항

- macOS 26 (Apple Silicon), Claude 데스크톱 앱, Claude Code CLI(`claude`)
- Node 22, Xcode 명령줄 도구(`swiftc`)
- 음성: Python 3.12 + [mlx-audio](https://github.com/Blaizzy/mlx-audio) 가 든 venv `~/.skinclaude/tts/venv`, 모델 `mlx-community/Qwen3-TTS-12Hz-0.6B-Base-8bit`, 캐릭터별 참조 음성 `~/.skinclaude/tts/voices/<choten|ame>.wav+.txt`(`gen/voice-design.py` 로 만든 합성 음성)
- 웹 일·이미지 생성: Chrome + Claude in Chrome 확장. 노래 조작은 Chrome 의 "Apple Events 의 자바스크립트 허용"이 필요하다
- 이미지 도구(`gen/*.mjs`)는 옆 프로젝트의 `sharp` 를 빌려 쓴다(`SKINCLAUDE_SHARP_PKG` 로 바꿀 수 있다)

## 설치·실행

```bash
cd overlay && npm install
npm run build:helper && npm run build:sttd      # helper/claudewin, helper/sttd
cd .. && bash bin/overlay-ctl.sh install         # ~/.skinclaude/app 으로 복사, LaunchAgent(감시) 등록, 훅 설치
~/.skinclaude/overlay-ctl.sh start               # Claude 앱이 떠 있으면 감시가 알아서 켠다
bash bin/build-applets.sh                        # (선택) 켜기/끄기 .app
```

소스를 고치면 `install` 을 다시 하고 `stop`/`start`. 끈 상태(`~/.skinclaude/paused`)에서는 `install` 만 해 두면 다음에 켤 때 반영된다.

Claude Code 의 전역 훅(`~/.claude/settings.json`)이 각 이벤트를 `curl` 로 `127.0.0.1:47831/hook` 에 보내야 중계가 된다. 지시 세션은 `runner.js` 가 `--settings` 로 같은 훅을 단다.

## 디버그

`127.0.0.1:47831` 의 `/status`, `/open-input`, `/costume?c=`, `/form?f=`, `/say?text=`, `/poke`, `/voice-heard?text=&quiet=1`, `/shot?to=`. 웹페이지에서 온 요청은 막는다.

## 테스트

```bash
cd overlay && npm test          # 순수 로직(이름 판정·의도·설정·알림·말풍선·기록…)
node --test gen/test/*.mjs      # 이미지 보정
```

## 설계 메모

캐릭터 말투·호출어·에코 제거·속도 결정의 배경은 `docs/` 의 기획서와 조사 보고서에 있다. 원작 캐릭터와 세계관의 권리는 원작자에게 있다.
