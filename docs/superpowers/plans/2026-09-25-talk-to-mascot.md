# 캐릭터에게 말 걸기 구현 계획

**Goal:** 다른 창을 보고 있어도 초텐쨩·아메에게 문장을 입력해 잡담하거나 Claude Code에 지시하고, 결과를 말풍선으로 받는다.

**Architecture:** 오버레이(Electron)에 입력 패널과 전역 단축키를 추가한다. 입력은 `runner.js`가 Claude Code CLI(`claude -p`)를 헤드리스로 실행해 처리한다. 잡담은 도구 없이 페르소나 시스템 프롬프트 + haiku + 세션 재개(`--resume`)로 기억을 유지하고, 지시는 지정 폴더에서 `--session-id`를 미리 정해 실행하며 그 세션의 훅만 진행 표시로 쓴다. 결과 말풍선의 "앱에서 열기"는 `claude://resume?session=ID`로 데스크톱 앱에 세션을 가져온다. Claude가 앞에 없을 때는 숨기지 않고 화면 구석의 작은 창(미니 모드)으로 남는다.

**Tech Stack:** Electron 44, Node child_process, Claude Code CLI 2.1.x (`-p --output-format json`), Swift 헬퍼(기존).

**Spec:** 이 문서 상단 + 대화에서 승인된 설계(2026-09-25).

## Global Constraints
- Claude 데스크톱 앱 파일은 절대 수정하지 않는다.
- API 키를 쓰지 않는다. CLI 로그인(구독)만 사용.
- 실행본은 `~/.skinclaude/app` 복사본이므로 소스 수정 후 `bin/overlay-ctl.sh install` 필수.
- 대사 톤: 초텐쨩은 밝고 호들갑·♡·"P" 호칭, 아메는 건조·"…"·츤데레. 이모지 남발 금지(아메는 이모지 없음).

## 파일
- `overlay/persona.js` (신규): 폼별 시스템 프롬프트 문자열. `PERSONA[form]`.
- `overlay/runner.js` (신규): `runChat({form, text, resumeId, onDone})`, `runTask({text, cwd, permissionMode, hooksUrl, onDone})`, `cancel()`. 각 실행은 `{sessionId, child}`를 돌려주고 완료 시 `{ok, text, sessionId, costUsd, durationMs, error}`.
- `overlay/main.js` (수정): 전역 단축키 `Control+Alt+Space`, 미니 모드 전환, 설정 파일 `~/.skinclaude/config.json`, IPC(`chat`, `cancel`, `open-in-app`, `pick-folder`, `get-config`), 훅 필터용 세션 ID 전달.
- `overlay/preload.js` (수정): 위 IPC 노출.
- `overlay/renderer/index.html`, `style.css`, `mascot.js` (수정): 입력 패널(모드 토글 💬/⚡, 폴더 표시·선택, 전송·취소), `>` 접두어, 결과 말풍선 + "앱에서 열기", 미니 모드 축소.

## 작업
1. persona.js + runner.js 작성. `node -e`로 runChat을 직접 호출해 답이 오는지 확인.
2. main.js: 설정·단축키·미니 모드·IPC. 헬퍼 메시지로 `claudeFront`면 풀, 아니면 미니, 우리 창이 앞이면 이전 모드 유지.
3. renderer: 입력 패널과 이벤트 배선. `GET /shot`으로 렌더 확인.
4. `install` 재실행 → 감시가 새 버전을 띄움 → 단축키로 입력 패널 열고 잡담·지시 각 1회 실제 테스트.
