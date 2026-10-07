# 마스코트 음성 대화 루프: 통합 생태계와 아키텍처 옵션 (2026-09-30 기준)

> 범위: skinclaude(Electron 44, macOS 26, Apple Silicon)의 두 마스코트가 상주 `claude -p --input-format stream-json --output-format stream-json --include-partial-messages` 프로세스를 두뇌로 쓰면서 한국어 음성 입력과 음성 응답·나레이션을 붙일 때 재사용할 수 있는 기능, 스킬, 플러그인, MCP, SDK와 아키텍처 패턴을 정리했다.
> 표기: "로컬 확인"은 이 Mac에서 직접 확인한 1차 증거다. "(검색 요약)"은 검색 엔진 요약으로만 확인했고 원문은 열람하지 못한 항목이다. "(집계 사이트)"는 1차 출처가 아닌 2차 정리 글이다.

## Q1. Claude Code 내장 음성 기능과 Claude 앱 음성 모드를 재사용할 수 있는가

### Takeaway
Claude Code의 `/voice`는 대화형 TUI(와 VS Code 확장, agent view)의 프롬프트 입력창에 붙은 **받아쓰기(STT) 전용** 기능이다. 한국어(`ko`)를 지원하지만 TTS는 없다. claude.ai 계정 로그인이 필요하고 오디오는 Anthropic 서버로 스트리밍된다. 또 터미널 key-repeat 감지에 묶여 있어서 headless `claude -p` 프로세스나 Electron에서 재사용할 공식 경로가 없다. Claude 앱(데스크톱, 웹, 모바일)의 음성 모드는 Claude Code에서 쓸 수 없고 개발자 API도 없다. Claude API 모델 자체도 오디오 입출력이 없으므로 STT와 TTS는 앱이 직접 붙여야 한다.

### Cited Findings
- `/voice`로 받아쓰기를 켠다. 모드는 `/voice hold`(기본, 누르는 동안 녹음), `/voice tap`(한 번 눌러 시작하고 다시 눌러 전송), `/voice off`가 있다. 설정 파일에는 `{"voice": {"enabled": true, "mode": "tap"}}` 형태로 저장되고, `"autoSubmit": true`를 켜면 키를 뗄 때 자동 전송된다(3단어 이상일 때). — [Claude Code Docs: Voice dictation](https://code.claude.com/docs/en/voice-dictation)
- 요구사항: "Voice dictation streams your recorded audio to Anthropic's servers for transcription. Audio is not processed locally." claude.ai 계정 인증이 필요하고 API key, Bedrock, Google Cloud Agent Platform, Microsoft Foundry 인증으로는 쓸 수 없다. 클라우드 세션과 SSH에서는 동작하지 않는다. 전사는 Claude 메시지·토큰·`/usage` 한도를 소모하지 않는다. — [Voice dictation](https://code.claude.com/docs/en/voice-dictation)
- 녹음은 macOS, Linux, Windows에서 내장 native module로 한다. Linux에서 native module을 못 쓰면 `arecord`/SoX로 fallback한다. — [Voice dictation](https://code.claude.com/docs/en/voice-dictation)
- 언어: Claude 응답 언어를 정하는 `language` 설정을 받아쓰기도 같이 쓴다. 비어 있으면 영어다. 지원 목록 20개 언어에 **Korean `ko`가 포함**된다. 목록에 없는 언어를 설정하면 경고 후 영어로 fallback한다. — [Voice dictation](https://code.claude.com/docs/en/voice-dictation)
- 전사는 코딩 어휘(regex, OAuth, JSON, localhost)에 튜닝돼 있고, 현재 프로젝트명과 git 브랜치명이 인식 힌트로 자동 추가된다. — [Voice dictation](https://code.claude.com/docs/en/voice-dictation)
- hold 모드는 "터미널의 빠른 key-repeat 이벤트"로 누르고 있는 키를 감지하므로 warmup이 있다. tap 모드는 15초 무음이나 총 2분이 지나면 자동 종료된다. `Esc`/`Ctrl+C`는 받아쓰기를 취소한다. 키 바인딩은 `~/.claude/keybindings.json`의 `Chat` 컨텍스트 `voice:pushToTalk`로 바꾼다. — [Voice dictation](https://code.claude.com/docs/en/voice-dictation)
- macOS에서 `/voice`를 켜면 "triggers the system microphone permission prompt **for your terminal**"라고 문서에 적혀 있다. 터미널에서 실행된 CLI의 마이크 권한이 터미널 앱 이름으로 요청된다는 뜻이고, 자식 프로세스 권한이 부모 앱에 귀속되는 사례로 해석할 수 있다(Q6 참고). — [Voice dictation](https://code.claude.com/docs/en/voice-dictation)
- 로컬 확인(Claude Code 2.1.284 바이너리 strings 분석):
  - `voiceEnabled`는 레거시 키다. 판정식이 `(e.voice?.enabled ?? e.voiceEnabled) === true`이고, `/voice`는 `voiceEnabled`와 `voice:{enabled,mode}`를 둘 다 기록한다. 스키마 설명은 "Enable voice mode (hold-to-talk dictation)"이다.
  - STT 연결은 WebSocket `/api/ws/speech_to_text/voice_stream`이고 `Authorization: Bearer <OAuth accessToken>`을 쓴다. 쿼리는 `encoding=linear16, sample_rate=16000, channels=1, endpointing_ms=300, utterance_end_ms=1000, language=…, use_conversation_engine=true`, keyterms이고, 제어 메시지는 `{"type":"KeepAlive"}`와 `{"type":"CloseStream"}`이다.
  - 환경변수 `VOICE_STREAM_BASE_URL`, `CLAUDE_CODE_VOICE_FORWARD_INTERIMS_TYPED`와 번들 native module `audio-capture.node`가 있다.
  - 출처: [로컬 확인: ~/.local/share/claude/versions/2.1.284](file:///Users/dobedub/.local/share/claude/versions/2.1.284)
- Claude 앱 음성 모드: Claude Mobile(iOS/Android), Claude Desktop, 웹에서 beta다. hands-free와 push-to-talk 모드가 있고 사용량은 요금제 한도에 포함된다. "In Claude Cowork and Claude Code, dictation is available but voice mode isn't." 개발자 API 언급은 없다. — [Claude Help Center: Use voice mode](https://support.claude.com/en/articles/11101966-use-voice-mode)
- Claude 앱 음성 모드 지원 언어에 한국어가 포함된다(영어, 프랑스어, 독일어, 힌디어, 인도네시아어, 이탈리아어, 일본어, 포르투갈어(브라질), 스페인어 등 11개). 검색 요약으로만 확인했고, 본문 fetch에서는 목록이 보이지 않았다. — [Help Center .md](https://support.claude.com/en/articles/11101966-use-voice-mode.md)
- Claude API 모델: "All current models support text and image input, text output". 현재 라인업은 Fable 5.1, Opus 5.5, Sonnet 5.5, Haiku 4.5다. Sonnet 5.5는 $2/$10 per MTok이고 comparative latency는 "Fast"다. 오디오 입출력은 없다. — [Claude Models overview](https://platform.claude.com/docs/en/about-claude/models/overview). 한 블로그는 "Claude API가 오디오 입력을 네이티브 지원"한다고 주장하지만 공식 문서와 모순되어 신뢰하기 어렵다. — [tkmxai (신뢰도 낮음)](https://tkmxai.it.com/claude-api-in-2026-2)

### Inferences
- `/voice`는 TUI 입력 컴포넌트 기능이다. 입력창이 없는 `-p --input-format stream-json` 상주 프로세스에는 붙일 수 없다. 문서도 `-p`나 SDK 사용을 언급하지 않는다.
- 내부 엔드포인트(`/api/ws/speech_to_text/voice_stream`)를 OAuth 토큰으로 직접 호출하는 것은 기술적으로 가능해 보이지만 비공개 내부 API다. 약관, 변경, 차단 위험이 있어 **비권장**한다. 다만 그 파라미터(16 kHz linear16, endpointing 300 ms, utterance end 1000 ms, keyterm 힌트)는 우리 턴 감지 기본값의 좋은 참고치다. 파라미터명(`endpointing`, `utterance_end_ms`, `KeepAlive`, `CloseStream`)이 Deepgram 스트리밍 API 용어와 같아서 Deepgram 계열 백엔드로 추정되지만 확인되지는 않았다.
- 사용자가 터미널에서 직접 쓰는 대화형 Claude Code에서는 `language: "korean"`과 `/voice`만으로 한국어 받아쓰기를 바로 쓸 수 있다. 마스코트와는 별개인 무비용 옵션이다. 단 `language`는 사용자 설정(`~/.claude/settings.json`)에 두면 `--bare`가 아닌 마스코트 `claude -p` 세션의 응답 언어에도 영향을 준다(원래 한국어라 실질 영향은 작을 것).
- 결론적으로 재사용 가능한 부분은 없다. 마스코트용 음성 루프는 앱 안에서 새로 구현해야 한다.

### Gaps
- `/voice` STT 백엔드 벤더를 공식 확인하지 못했다(추정만 있음).
- Claude 앱 음성 모드의 한국어 지원은 검색 요약으로만 확인했다.
- `claude -p` 쪽에 향후 음성 입력 플래그가 추가될 계획이 있는지 공개된 정보가 없다.

## Q2. 음성용 MCP 서버, Claude Code 플러그인·스킬, 훅 생태계

### Takeaway
기성품 대부분은 **"Claude Code 터미널 세션에 음성을 붙이는"** 도구다. Claude가 MCP 도구를 호출해 말하고 듣거나, 훅이 `say`나 TTS를 호출하는 식이다. 마스코트처럼 앱이 오디오를 소유하는 구조에는 부품이나 참고 구현으로만 쓸모가 있다. 가장 성숙한 것은 VoiceMode(1.4k★, v8.12.0, 2026-07-21, MIT, 플러그인 마켓플레이스)다. 하지만 기본 로컬 TTS인 Kokoro는 **한국어를 지원하지 않는다**. ElevenLabs 공식 로컬 MCP는 2026-08-20에 아카이브되어 호스티드 MCP로 대체됐고, 파일 생성형이라 실시간 대화용이 아니다.

### Cited Findings
#### VoiceMode (mbailey/voicemode)
- Claude Code 등 MCP 에이전트와 자연스러운 음성 대화를 하게 해 준다. **1.4k stars, MIT**다. 설치 방법은 네 가지다.
  - `claude plugin install voicemode@voicemode`(플러그인 마켓플레이스)
  - `uvx voice-mode-install`
  - 소스 설치
  - NixOS flake
- 서비스 구성: 로컬 STT는 Whisper.cpp, 로컬 TTS는 Kokoro이고 OpenAI API는 클라우드 fallback이다. smart silence detection을 갖췄고 Linux, macOS, Windows, NixOS에서 돌며 Python 3.10–3.14가 필요하다. — [GitHub mbailey/voicemode](https://github.com/mbailey/voicemode)
- 릴리스(연도는 페이지에 표기되지 않았고 2026년으로 추정):
  - v8.12.0(21 Jul): ESC 취소 시 마이크가 계속 녹음되던 문제를 수정했다.
  - v8.11.0(10 Jul): 네이티브 Windows, `turns[]` 멀티보이스 스크립트, pause/resume/stop 제어 채널, "skip-forward"("manual end-of-turn and reliable VAD fallback"), `VOICEMODE_MCP_URL`로 원격 HTTP MCP 연결을 추가했다.
  - v8.10.2: `voicemode config set` 명령 주입 취약점을 수정했다.
  - v8.10.1: MCP Registry 네임스페이스를 `dev.voicemode/voicemode`로 바꿨다.
  - 출처: [VoiceMode releases](https://github.com/mbailey/voicemode/releases)
- 로컬 마이크 또는 LiveKit 룸 전송과 OpenAI-compatible 서비스를 지원한다. — [Archestra MCP catalog (검색 요약)](https://archestra.ai/mcp-catalog/mbailey__voice-mcp)
- Kokoro-82M 공식 VOICES.md의 언어는 American/British English, Japanese, Mandarin, Spanish, French, Hindi, Italian, Brazilian Portuguese뿐이고 **Korean이 없다**. — [HF hexgrad/Kokoro-82M VOICES.md](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md). "Kokoro가 한국어를 지원한다"는 글이 있지만 1차 출처와 모순된다. — [Analytics Vidhya (2025-01, 부정확)](https://www.analyticsvidhya.com/blog/2025/01/kokoro-82m/)

#### ElevenLabs MCP
- 공식 로컬 MCP 서버: **1.5k stars, 2026-08-20 아카이브(read-only)**. 설치는 `uvx elevenlabs-mcp`이고 `ELEVENLABS_API_KEY`가 필요하다.
- 기능은 TTS, STT, 보이스 클로닝, 오디오 분리, speech-to-speech 등이다. 출력 모드(`ELEVENLABS_MCP_OUTPUT_MODE`)는 files(기본), resources(base64), both가 있다.
- 호스티드 `api.elevenlabs.io/v1/mcp`(OAuth)로 대체됐다. 무료 티어는 월 10k credits다.
- 출처: [GitHub elevenlabs/elevenlabs-mcp](https://github.com/elevenlabs/elevenlabs-mcp)
- 마지막 릴리스는 v0.10.0(2026-06-19)이다. — [dev.co (집계 사이트)](https://dev.co/ai/mcp/elevenlabs-mcp)

#### 훅·플러그인 기반 음성 알림과 대화
- **mcp-voice-hooks** (johnmatthewtennant): Claude Code 훅으로 연속 양방향 음성을 붙인다. STT는 브라우저 Web Speech API(Chrome/Safari)이고, TTS는 브라우저 speechSynthesis 또는 macOS `say`(Siri 고품질 음성 포함)다. "Trigger Word Mode"를 지원한다. 플러그인 마켓플레이스로 설치하고 Claude Code 2.1.69 이상이 필요하다. 125 stars, 32 forks, TypeScript, MIT다. — [GitHub mcp-voice-hooks](https://github.com/johnmatthewtennant/mcp-voice-hooks)
- **Herald** 플러그인은 macOS/Windows 내장 음성 또는 ElevenLabs로 TTS 알림을 낸다. — [GitHub al3xjohnson/herald (검색 요약)](https://github.com/al3xjohnson/herald)
- **claude-voice-notify**는 Stop/Notification 훅과 ElevenLabs TTS를 쓰고 provider router가 있다. — [Glama (검색 요약)](https://glama.ai/mcp/servers/kubouchiyuya/claude-voice-notify)
- **Voice Bridge**는 edge-tts, ElevenLabs, Kokoro, macOS `say`, espeak-ng 다섯 엔진을 지원하고 플러그인, MCP, CLI 파이프로 쓸 수 있다. — [Glama (검색 요약)](https://glama.ai/mcp/servers/izojhher0q)
- 훅에서 macOS `say`를 부를 때는 `"async": true`로 Claude를 기다리게 하지 않는 패턴을 쓴다. — [Roman Imankulov: Claude Code hooks (검색 요약)](https://roman.pt/posts/claude-code-hooks)
- **say-mcp-server** (bmorphism)는 macOS `say`와 AVSpeechSynthesizer를 쓰고, 한국어 "Yuna (Premium)"을 `-v "Yuna (Premium)"`으로 지정할 수 있다. — [mcpservers.org](https://mcpservers.org/servers/bmorphism/say-mcp-server)

#### Claude Code를 음성 레이어로 감싸는 선행 사례
- **duck_talk**: Claude Code를 블랙박스로 감싸는 릴레이다. Claude Code의 스트리밍 텍스트를 TTS로 흘리고 전사를 지시로 넣는다("No modifications to the agent"). 귀는 Gemini Live, 입은 Gemini TTS다. "stop" 음성 인터럽트와 전사 검토 모드가 있다. 서버는 TS/Node, iOS 앱은 SwiftUI이고 24 stars, MIT이며 문서상 영어만 보인다. — [GitHub dhuynh95/duck_talk](https://github.com/dhuynh95/duck_talk)
- **OpenLive** (katipally/openlive): Agent Client Protocol(ACP)로 Claude Code에 연결한다. 로컬 WebGPU로 Silero VAD, Whisper, Kokoro/Supertonic TTS, ZipVoice 클로닝을 돌리고 barge-in을 지원한다("interrupt anytime"). 2026-08-08 글이고 저자 스스로 "not production-grade"라고 한다. — [The Menon Lab 블로그](https://themenonlab.blog/blog/openlive-voice-ai-agents-local)
- **claude-code-is-programmable** (disler)에는 RealtimeSTT와 OpenAI TTS를 쓰는 `voice_to_claude_code.py`가 들어 있다. — [SourcePulse (검색 요약)](https://www.sourcepulse.org/projects/14493853)

### Inferences
- 마스코트 앱에는 **앱이 오디오를 소유하는 구조**가 맞다. MCP "speak" 도구 방식은 Claude가 말할 시점을 정하고 도구 호출 왕복이 추가되어 지연이 늘어난다. 두 캐릭터의 목소리와 우선순위를 앱이 중앙 제어하기도 어렵다. 이미 훅 이벤트가 HTTP로 오버레이에 도착하므로(훅 `type: "http"`도 공식 지원, Q5 참고) 나레이션 음성화는 오버레이 안에서 하는 편이 단순하다.
- VoiceMode는 로컬 whisper.cpp와 kokoro-fastapi 설치·관리, 발화 잠금 개념, skip-forward(수동 턴 종료) 같은 UX 참고용으로 가치가 있다. 한국어 TTS는 Kokoro로 불가하므로 OpenAI-compatible 한국어 TTS 엔드포인트를 따로 붙여야 한다.
- duck_talk과 OpenLive는 "에이전트는 그대로 두고 앞단 음성 레이어만 붙인다"는 우리 구조와 같은 방향이다. 아키텍처 참고 가치는 있지만 둘 다 한국어 검증이 없다.

### Gaps
- OpenAI/Whisper 전용 MCP 서버, Smithery·mcp.so 레지스트리의 음성 서버를 전수 조사하지 못했다.
- Herald, claude-voice-notify, Voice Bridge의 성숙도(stars, 마지막 릴리스)를 확인하지 못했다.
- VoiceMode의 한국어 STT 언어 설정 키(예: Whisper language 환경변수) 공식 문서를 확인하지 못했다.
- Electron 렌더러에서 Web Speech API `SpeechRecognition`이 동작하는지(mcp-voice-hooks 방식 이식 가능성) 확인하지 못했다.

## Q3. 아키텍처 옵션 비교: 캐스케이드, 실시간 S2S, OS 레벨

### Takeaway
"Claude Code CLI가 두뇌"라는 제약 때문에 **캐스케이드(STT → `claude -p` 스트리밍 텍스트 → 문장 단위 스트리밍 TTS)가 기본 적합안**이다. 실시간 S2S 모델 가운데 Gemini 3.8 Live와 Hume EVI 4-mini는 한국어 지원이 문서에 명시돼 있다. ElevenLabs Agents는 한국어를 지원하는 ElevenLabs 모델을 쓴다(추정). GPT-Live-1과 gpt-realtime-2.1의 한국어 지원은 공식 문서에서 확인하지 못했다. 어느 쪽이든 대화층으로 쓰면 페르소나, 기억, 도구가 Claude Code 밖으로 빠져나간다.

2026-09-10 GA된 **GPT-Live-1**은 "full-duplex 음성 front + 백엔드 위임"을 공식화했다. Pipecat의 client delegation으로 임의 LLM을 백엔드로 붙일 수 있어서 "음성 I/O만 S2S" 하이브리드의 가장 현실적인 경로다. 다만 무음을 포함해 세션 내내 분당 $0.05가 과금된다.

OS 레벨(`say` + SpeechTranscriber)은 무료이고 로컬에서 돈다. 한국어 음성이 이미 9종 설치돼 있어서 폴백과 알림용으로 적합하다.

### Cited Findings
#### 지연 예산 (voice-to-voice)
- 사람은 턴 교대에서 약 800 ms 안의 응답을 기대한다. 스트리밍 STT 50–150 ms, LLM 200–400 ms, TTS TTFB 100–200 ms, 네트워크 20–80 ms로 나누는 예시가 있다. — [Twig: 800ms rule (검색 요약)](https://www.twig.so/blog/voice-ai-agents-latency-budget-800ms)
- 2026년 권장 예산은 VAD 50, STT 150, LLM TTFT 400, TTS 첫 청크 150, 네트워크 50 ms다. — [smallest.ai (검색 요약)](https://smallest.ai/blog/designing-voice-assistants-stt-llm-tts-tools-and-latency-budget)
- LLM이 예산의 350–1000 ms로 가장 크고 변동이 심하다. 800 ms는 단계들이 스트리밍으로 겹칠 때만 가능하다. — [morphllm (검색 요약)](https://www.morphllm.com/voice-agent-api)
- ElevenLabs 모델 지연: `eleven_flash_v2_5` ~75 ms, `eleven_v4_turbo` ~100 ms, `eleven_v3_conversational` ~280 ms, `scribe_v2_realtime` ~150 ms. — [ElevenLabs Models](https://elevenlabs.io/docs/overview/models)

#### 캐스케이드 구성요소 가격과 한국어
- OpenAI 전사: `gpt-4o-transcribe` $0.006/min, `gpt-4o-mini-transcribe` $0.003/min, Whisper $0.006/min, `gpt-live-transcribe`와 `gpt-realtime-whisper` $0.017/min.
- OpenAI TTS: `tts-1` $15/1M chars, `tts-1-hd` $30/1M chars, `gpt-4o-mini-tts`는 오디오 출력 $12/1M tokens에 텍스트 입력 $0.60/1M.
- 출처: [OpenAI API Pricing](https://developers.openai.com/api/docs/pricing)
- ElevenLabs 한국어 지원 모델:
  - `eleven_flash_v2_5`: 32개 언어, 40k chars, "Fast, affordable", API 50% 저가
  - `eleven_v4_turbo`: 90+ 언어, 실시간용
  - `eleven_v4`, `eleven_v3`, `eleven_multilingual_v2`
  - STT: `scribe_v2_realtime`(~150 ms, 90+ 언어, 한국어 포함)
  - 출처: [ElevenLabs Models](https://elevenlabs.io/docs/overview/models)
- Flash v2.5 가격은 $0.05/1K chars다. — [Runware 모델 페이지 (집계 사이트)](https://runware.ai/models/eleven-flash-v2-5)
- Gemini TTS: `gemini-3.8-flash-tts`는 입력 $0.50, 출력 $9.00 per 1M(2026-12-31까지, 2027-01-01부터 $1.00/$18.00)이고, `gemini-3.8-flash-lite-tts`는 출력 $6.00이다. 둘 다 무료 티어가 있다. — [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)

#### 실시간 S2S 모델
- **OpenAI gpt-realtime-2.1**: 오디오 입력 $32, 캐시 $0.40, 출력 $64 per 1M이고 텍스트는 $4/$24다. **mini**는 오디오 $10/$0.30/$20다. 구버전 `gpt-realtime-2`, `-1.5`와 `gpt-realtime`도 같은 오디오 단가다. — [OpenAI API Pricing](https://developers.openai.com/api/docs/pricing)
- 오디오 토큰 환산은 사용자 1 token/100 ms, 어시스턴트 1 token/50 ms다. 따라서 2.1은 듣기 $0.0192/min, 말하기 $0.0768/min이고, 실사용은 프롬프트 캐싱 시 $0.06–0.11/min이다. — [Forasoft 등 (검색 요약, 집계 사이트)](https://www.forasoft.com/blog/article/openai-realtime-api-pricing)
- **OpenAI GPT-Live-1**:
  - 세션당 "$0.05 per minute, billed per second"이고 백엔드 모델과 도구 비용은 별도다.
  - 엔드포인트는 `v1/live/sessions` 전용이다. 입출력은 오디오와 텍스트이고 function calling을 지원한다.
  - 레이트 리밋은 동시 세션 25–500(티어별)이고 무료 티어는 없다. 지식 컷오프는 2025-07-31이다.
  - 문서에 지원 언어 정보가 없다.
  - 출처: [OpenAI Models: gpt-live-1](https://developers.openai.com/api/docs/models/gpt-live-1)
- 위임 모드는 두 가지다. Responses delegation은 OpenAI가 Responses 모델로 백엔드를 호스팅한다. client delegation은 "backend is any application service running with its own tools"다. — [OpenAI API reference: Live sessions (검색 요약)](https://developers.openai.com/api/reference/resources/live/methods/create)
- GPT-Live-1 WebSocket:
  - 오디오는 base64 JSON이고 `audio/pcm` 24 kHz(기본) 또는 16 kHz, G.711 μ-law/A-law를 쓴다.
  - 위임 작업은 `response.event` envelope 안의 중첩 이벤트로 오고, `response.create`로 시작하거나 이어 간다.
  - 출처: [OpenAI Guide: voice WebSockets](https://developers.openai.com/api/docs/guides/voice-websockets)
- GPT-Live-1 동작 특성:
  - 2026-09-10 API 출시, $0.05/min, 백엔드 위임. — [CellCog (집계 사이트)](https://cellcog.ai/blog/gpt-live-1/), [DataCamp](https://www.datacamp.com/tutorial/gpt-live-1-api)
  - "A spoken interruption does not cancel backend work"
  - 무음과 백엔드 작업 시간까지 세션 내내 과금되고 컨텍스트는 128k다.
  - 목소리는 세션 내 변경할 수 없다.
  - 출처: [DataCamp 튜토리얼](https://www.datacamp.com/tutorial/gpt-live-1-api)
- **Pipecat `OpenAILiveLLMService`**는 Responses delegation과 **Client delegation**을 지원한다. "Any Pipecat LLM service can be the backend, with its own context and tools"이고, `BackendLLMWorker`로 감싸 `OpenAILiveLLMService.ClientDelegation(backend=...)`에 넘긴다. — [Pipecat docs: OpenAI Live](https://docs.pipecat.ai/api-reference/server/services/s2s/openai-live.md)
- **Gemini Live 가격과 모델**:
  - `gemini-3.8-live`는 production이다. 오디오 입력 $3/1M(≈$0.005/min), 오디오 출력 $12/1M(≈$0.018/min)이고 무료 티어가 있다.
  - `gemini-3.8-live-extended-thinking`도 같은 가격이다.
  - 그 밖에 `gemini-3.1-flash-live-preview`와 `gemini-2.5-flash-native-audio-preview-12-2025`가 있다.
  - 출처: [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
  - 2026-09-15 GA다. — [CellCog (집계 사이트)](https://cellcog.ai/blog/gemini-3-8-live/)
- **Gemini Live 기능**:
  - **한국어 `ko` 지원**(99개 언어), 대화 중 언어 전환 가능.
  - 자동 VAD(`startOfSpeechSensitivity`/`endOfSpeechSensitivity`, `silenceDurationMs` 기본 약 800 ms). 인터럽트되면 "ongoing generation is canceled and discarded".
  - 입력 16 kHz PCM, 출력 24 kHz. 오디오 전용 세션은 15분 제한.
  - `NON_BLOCKING` 비동기 function calling, 입출력 전사 옵션.
  - 외부 LLM 텍스트를 넣어 Live를 순수 TTS/STT로만 쓰는 방식은 문서에 없다.
  - 출처: [Gemini Live API capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities)
- **ElevenLabs Agents**: 통화 분당 $0.08(전 요금제), LLM 비용은 분당 별도이고 10초 넘는 무음은 5% 과금이다. Claude 등 주요 LLM과 커스텀 LLM을 연결할 수 있다. — [morphllm 비교 (검색 요약, 집계 사이트)](https://www.morphllm.com/best-ai-voice-agent-platforms)
- **Hume EVI**: "EVI 4-mini currently supports English, Japanese, **Korean**, Spanish, French, Portuguese, Italian, German, Russian, Hindi, Arabic"이고 EVI 3는 영어와 스페인어만 지원한다. Anthropic 모델에 대해 프롬프트 캐싱과 도구 사용을 지원한다. 체감 지연의 핵심 요인은 TTFT다. — [Hume EVI FAQ](https://dev.hume.ai/docs/speech-to-speech-evi/faq). 외부 LLM(Claude 등)과 커스텀 언어모델을 연결할 수 있다. — [Hume: language model](https://dev.hume.ai/docs/empathic-voice-interface-evi/configuration/language-model)

#### OS 레벨 (macOS)
- 로컬 확인(`say -v '?'`): **ko_KR 음성 9종**이 이미 설치돼 있다. Yuna, Eddy, Flo, Grandma, Grandpa, Reed, Rocko, Sandy, Shelley다. — [로컬 실행 결과 (/usr/bin/say)](file:///usr/bin/say)
- 한국어 "Yuna (Premium)" 음성이 있다(Hee Oh 음성 기반). — [say-mcp-server 문서](https://mcpservers.org/servers/bmorphism/say-mcp-server)
- Apple **SpeechAnalyzer/SpeechTranscriber**(macOS 26 포함)는 출시 시점에 광둥어, 중국어, 영어, 프랑스어, 독일어, 이탈리아어, 일본어, **한국어**, 포르투갈어, 스페인어를 지원하는 온디바이스 STT다. `supportedLocales`로 확인한다. — [addpipe: Apple SpeechAnalyzer](https://blog.addpipe.com/apple-speechanalyzer-api/), [Apple Docs: SpeechTranscriber](https://developer.apple.com/documentation/speech/speechtranscriber)

### Inferences
- **지연 구조**: 캐스케이드에서 가장 큰 항목은 Claude Code CLI의 TTFT다. Sonnet에 Claude Code 시스템 프롬프트와 도구, 페르소나가 얹힌다. STT 확정(엔드포인트 후 약 150–300 ms)과 TTS 첫 청크(75–150 ms)는 상대적으로 작다. Claude가 두뇌로 남는 한 S2S를 써도 Claude 구간은 줄지 않는다. S2S 하이브리드의 이득은 "즉시 맞장구와 채움말"과 full-duplex 느낌에 한정된다. 이 부분은 턴 종료 직후 미리 만들어 둔 짧은 한국어 채움말("음~ 잠깐만!")이나 earcon을 재생해 싸게 흉내 낼 수 있다.
- **비용**: 아래 표는 하루 60분 음성 대화, 그중 마스코트 발화 20분을 가정한 대략치다(가정값은 미검증).

  | 옵션 | 계산 | 하루 비용 |
  |---|---|---|
  | GPT-Live-1 | 60분 × $0.05 | ≈$3 + 백엔드 |
  | gpt-realtime-2.1 | 듣기 60분 ≈ $1.15, 말하기 20분 ≈ $1.54 | ≈$2.7 + 텍스트 토큰(턴마다 대화 이력을 다시 과금하는 부분을 뺀 하한값) |
  | Gemini 3.8 Live | 입력 ≈$0.30, 출력 ≈$0.36 | ≈$0.66(무료 티어 별도) |
  | 캐스케이드 | STT `gpt-4o-mini-transcribe` 60분 ≈$0.18 + TTS Flash v2.5(한국어 분당 300–400자 가정 시 20분 ≈ 6–8k자 ≈ $0.3–0.4) | 로컬 STT/TTS를 쓰면 ≈$0 |

  저예산 개인 앱에는 캐스케이드와 로컬 부품의 조합이 가장 싸다.
- **적합성**:
  - Gemini Live나 gpt-realtime을 대화층으로 쓰면 두 마스코트의 페르소나, 기억, 도구 체계를 두 번 유지해야 하고 Claude Code의 작업 위임 흐름과 충돌한다.
  - "S2S를 음성 I/O로만" 쓰는 공식 경로는 GPT-Live-1 client delegation(Pipecat 지원)이 거의 유일하다. Gemini Live는 순수 TTS/STT 사용이 문서화돼 있지 않아서, `ask_claude` 같은 `NON_BLOCKING` 함수 하나로 Claude Code에 위임하는 구조가 대안이다. 이 경우 Gemini가 말투와 내용을 재구성하게 된다.
  - GPT-Live-1은 세션마다 목소리가 고정이므로 캐릭터별로 세션 두 개가 필요하다.
- **권장 순서**:
  1. 캐스케이드(주력)
  2. OS 레벨(무료 폴백, 알림 전용)
  3. S2S 하이브리드(실험용)

### Gaps
- GPT-Live-1과 gpt-realtime-2.1의 한국어 지원 여부와 품질이 공식 문서에 명시돼 있지 않다.
- ElevenLabs Agents와 Flash v2.5 가격을 1차 출처(공식 가격 페이지)에서 확인하지 못했다.
- 옵션별 한국어 음성 품질(MOS, CER)을 같은 조건에서 비교한 자료를 찾지 못했다.
- `claude -p` stream-json 경로의 Sonnet TTFT 실측값이 없다(로컬에서 측정 가능).
- Apple 개발자 포럼에 SpeechAnalyzer "asset not found after attempted download" 오류가 특정 언어에서 난다는 스레드가 있다(제목만 확인). — [Apple Developer Forums 797835](https://developer.apple.com/forums/thread/797835)

## Q4. 음성 루프 프레임워크와 SDK (Electron 안 또는 옆에서)

### Takeaway
Node/TS로 Electron 안에서 바로 쓸 수 있는 완성형 루프 프레임워크는 드물다.

- **Pipecat**(16.1k★, Python)이 가장 풍부하다. Anthropic, ElevenLabs, Gemini Live, OpenAI Live, 로컬 오디오 전송을 지원하고 한국어를 포함한 Smart Turn v3가 있다. 대신 Python 사이드카가 필요하다.
- **LiveKit Agents**는 Node(`@livekit/agents`)와 한국어 포함 multilingual turn detector가 있지만 LiveKit 룸 모델을 전제한다.
- **OpenAI Agents SDK(TS)**는 OpenAI Realtime에 묶여 있다.
- **Vercel AI SDK**의 transcribe/generateSpeech는 experimental 배치형이다.
- 로컬 우선 부품으로는 **sherpa-onnx**(Node addon, 한국어 streaming Zipformer), **@ricky0123/vad-web**(Silero VAD, 브라우저), **Supertonic 3**(한국어 온디바이스 TTS, Node와 브라우저 SDK)가 Electron에 직접 들어갈 수 있다.

### Cited Findings
- **Pipecat**: "open-source Python framework for building real-time voice and multimodal conversational agents"이고 16.1k stars, BSD-2-Clause, Python 3.11 이상(3.12+ 권장)이다.
  - STT: Deepgram, OpenAI Whisper, Google, AssemblyAI, Azure, AWS, 로컬 Whisper, Moonshine
  - LLM: Anthropic, OpenAI, Gemini 외 20여 종
  - TTS: ElevenLabs, OpenAI, Google, Kokoro, Piper, Cartesia
  - S2S: Gemini Multimodal Live, OpenAI Realtime, Grok, Ultravox
  - 전송: Daily, LiveKit, SmallWebRTCTransport, **데스크톱용 local audio transport**, WebSocket
  - JS/React 클라이언트 SDK
  - 출처: [GitHub pipecat-ai/pipecat](https://github.com/pipecat-ai/pipecat)
- **Smart Turn v3**(Pipecat의 오픈 턴 감지 모델)는 한국어를 포함한 23개 언어를 지원한다. — [GitHub pipecat-ai/smart-turn (검색 요약)](https://github.com/pipecat-ai/smart-turn)
- Pipecat은 GPT-Live-1 client delegation을 지원한다(`OpenAILiveLLMService`, `BackendLLMWorker`). — [Pipecat docs: OpenAI Live](https://docs.pipecat.ai/api-reference/server/services/s2s/openai-live.md)
- **LiveKit Agents (Node)**:
  - `@livekit/agents`의 `voice.AgentSession`과 `@livekit/agents-plugin-livekit`의 `turnDetector.MultilingualModel`을 쓴다.
  - multilingual turn detector는 영어, 프랑스어, 스페인어, 독일어, 이탈리아어, 포르투갈어, 네덜란드어, 중국어, 일본어, **한국어**, 인도네시아어, 러시아어, 터키어, 힌디어를 지원한다. 같은 검색 결과 안에서 "13개 언어"라는 표기도 있어 출처끼리 개수가 다르다.
  - 100토큰 기준 CPU에서 25 ms 미만이고 RAM은 약 400 MB다. 가중치는 `npx livekit-agents download-files`로 받는다.
  - 출처: [LiveKit docs: Turn detector (검색 요약)](https://docs.livekit.io/agents/logic/turns/turn-detector), [LiveKit Agents JS reference](https://docs.livekit.io/reference/agents-js)
- **Vocode**(vocode-core): 3.7k stars, 652 forks. 스냅샷 시점 기준 마지막 커밋이 3개월 전, 릴리스가 5개월 전으로 활동이 둔화했다. — [gittrend (검색 요약)](https://gittrend.io/repo/vocodedev/vocode-core)
- **OpenAI Agents SDK (TS)**: 브라우저 음성 비서의 최단 경로는 `RealtimeAgent`와 `RealtimeSession`이다. 음성 워크플로는 speech-to-speech와 chained voice pipeline 두 가지다. — [openai-agents-js: Voice agents (검색 요약)](https://openai.github.io/openai-agents-js/ko/guides/voice-agents), [OpenAI Guide: Voice agents](https://developers.openai.com/api/docs/guides/voice-agents.md). TS 쪽 chained VoicePipeline은 "future capability"로 표기돼 있다는 검색 요약이 있다(미검증).
- **Vercel AI SDK**: `experimental_generateSpeech`와 `experimental_transcribe`가 있고 `@ai-sdk/elevenlabs` provider를 쓴다(speech `eleven_multilingual_v2`, transcription `scribe_v1`, `languageCode` 옵션). — [AI SDK: generateSpeech](https://ai-sdk.dev/v5/docs/reference/ai-sdk-core/generate-speech), [AI SDK: ElevenLabs provider](https://ai-sdk.dev/v5/providers/ai-sdk-providers/elevenlabs)
- **sherpa-onnx**: `sherpa-onnx-node`는 node-addon-api 기반으로 오프라인 STT, TTS, 화자분리, 음성 향상을 제공한다. JS API는 Electron에서 쓸 수 있다. 한국어 스트리밍 모델 `sherpa-onnx-streaming-zipformer-korean-2024-06-16`이 있다. — [yarn: sherpa-onnx-node (검색 요약)](https://classic.yarnpkg.com/en/package/sherpa-onnx-node), [codekk: sherpa-onnx (검색 요약)](https://p.codekk.com/detail/c++/k2-fsa/sherpa-onnx)
- **@ricky0123/vad-web**: Silero VAD와 ONNX Runtime Web으로 브라우저에서 VAD를 돌린다. `MicVAD.new({onSpeechStart, onSpeechEnd})`의 `onSpeechEnd`는 16 kHz Float32Array를 준다. — [GitHub ricky0123/vad](https://github.com/ricky0123/vad), [vad docs: browser](https://docs.vad.ricky0123.com/user-guide/browser/)
- **Supertonic 3** (Supertone):
  - 2026-04-29 공개, 31개 언어(**Korean `ko` 포함**), 약 99M 파라미터(ONNX)다.
  - SDK: Python, **Node.js**, **Browser(WebGPU/WASM)**, Swift, C++, Rust 등.
  - 코드는 MIT, 가중치는 **OpenRAIL-M**이고 13.8k stars다.
  - **저장소가 아카이브되어 추가 개발 계획이 없다.** Voice Builder(클로닝)는 2026-08-31 이후 쓸 수 없다. 스트리밍 지원은 문서에 없다.
  - 출처: [GitHub supertone-inc/supertonic](https://github.com/supertone-inc/supertonic)
  - 한국어 CER 3.26(모델 카드 벤치). — [HF Supertone (검색 요약)](https://huggingface.co/Supertone/supertonic-2)
- 로컬 확인: 앱에 이미 Swift 헬퍼 빌드 스크립트(`"build:helper": "swiftc -O helper/claudewin.swift -o helper/claudewin"`)가 있다. Apple SpeechTranscriber와 AVAudioEngine 같은 Swift 전용 API를 붙일 발판이 있다. — [로컬 확인: ~/.skinclaude/app/package.json](file:///Users/dobedub/.skinclaude/app/package.json)

### Inferences
- 이 앱에는 **Electron(TS) 안의 얇은 커스텀 루프**가 맞다. VAD, STT 클라이언트, 문장 분할기, TTS 큐, 재생기로 구성하고 필요한 부품만 고른다. 두뇌는 기존 `claude -p` stream-json을 그대로 쓴다. 무거운 프레임워크는 Claude Code를 LLM 서비스로 감싸는 어댑터를 따로 써야 해서 이득이 작다.
- S2S 하이브리드(GPT-Live-1)를 시도한다면 Pipecat Python 사이드카를 두는 것이 가장 짧은 경로다. 이때 "Claude Code CLI 백엔드 LLM 서비스"를 직접 구현해야 한다. Claude API 백엔드는 기성품(AnthropicLLMService)이 있지만 그러면 Claude Code의 도구와 세션을 잃는다.
- 로컬 우선 한국어 구성 후보:
  - STT: Apple SpeechTranscriber(Swift 헬퍼, 무료·온디바이스), sherpa-onnx 한국어 Zipformer(스트리밍, Node), whisper.cpp
  - TTS: Supertonic 3(Node/ORT, 아카이브·라이선스 주의), macOS `say`/AVSpeechSynthesizer(폴백)
  - VAD: vad-web
  - 턴 감지: 간단한 무음 임계치로 시작하고, 필요하면 Smart Turn v3(ONNX)를 추가

### Gaps
- Apple SpeechTranscriber, Whisper, sherpa-onnx Zipformer, Scribe v2의 한국어 정확도·지연 비교 벤치를 찾지 못했다.
- Supertonic 3의 스트리밍 지원과 M 시리즈에서의 TTFB가 문서에 없다.
- LiveKit agents-js를 LiveKit 서버 없이 로컬 마이크로 직접 돌릴 수 있는지 확인하지 못했다.
- Pipecat 최신 릴리스 버전과 날짜를 확인하지 못했다.

## Q5. 대화 메커닉: 한국어 문장 분할, barge-in, AEC, 턴 감지, 더킹, 훅 이벤트 음성화

### Takeaway
- **문장 분할**: stream-json의 `text_delta`를 받아 구두점과 한국어 종결어미 기준 증분 분할기로 청크를 만들고, 첫 청크는 짧게 해서 TTFB를 줄인다.
- **barge-in**: VAD 발화 시작 시 TTS를 즉시 중단하고, 필요하면 Claude 턴을 `interrupt`한다.
- **AEC**: 헤드폰 없는 Mac 스피커 환경에서 가장 불확실한 부분이다. Chromium AEC가 앱 자신의 TTS 재생을 참조 신호로 쓰는지 Electron 44에서 실측해야 한다. 확실한 대안은 네이티브 VPIO(Swift)나 반이중(half-duplex) 모드다.
- **훅 이벤트**: 우선순위 큐를 둔다. 권한 요청은 즉시 음성으로, 작업 완료는 짧은 요약으로, 도구 사용은 무음이나 earcon으로 처리한다.

### Cited Findings
#### 스트리밍 텍스트와 TTS 청크
- `--output-format stream-json --verbose --include-partial-messages`는 토큰을 이벤트로 흘린다. 텍스트는 `select(.type == "stream_event" and .event.delta.type? == "text_delta") | .event.delta.text`로 추리고 마지막 줄은 `result`다. — [Claude Code Docs: Run programmatically](https://code.claude.com/docs/en/headless)
- 문장 경계 분할이 "simplest and most effective"다. 음성 비서는 50–100자 청크, 장문은 200–400자가 억양 보존에 유리하고, 스트림 끝에는 `flush()`한다. — [Deepgram: TTS text chunking](https://developers.deepgram.com/docs/tts-text-chunking)
- ElevenLabs WebSocket stream-input:
  - 기본 `chunk_length_schedule` [120, 160, 250, 290]이다. 첫 오디오는 누적 120자 이후에 생성된다.
  - `try_trigger_generation`, `flush`, `inactivity_timeout`(기본 20 s, 최대 180 s)을 쓰고 빈 문자열 `""`로 종료한다.
  - 출력은 PCM 16k/22.05k/24k 또는 mp3다.
  - 출처: [ElevenLabs API: stream-input](https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input)
- `Intl.Segmenter`는 locale-sensitive `granularity: "sentence"` 분할을 지원하고 2024년 4월부터 Baseline이다. `segment()`는 완성된 문자열에만 동작하고 증분 처리는 안 된다. — [MDN: Intl.Segmenter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter)
- KSS(Korean Sentence Splitter)는 구어와 문어에 강한 휴리스틱 분할기이고, 청크 분할 함수(검색 요약상 `splitChunks`)로 문장들을 최대 길이 이하 청크로 묶는다. KSSDS는 구두점 누락 등 STT 결과의 이상에 대응하는 트랜스포머 기반 대화용 분할기다. 둘 다 Python이다. — [PyPI kss (검색 요약)](https://pypi.org/project/kss/2.6.0), [PyPI KSSDS (검색 요약)](https://pypi.org/project/KSSDS/)

#### barge-in과 인터럽트
- `claude -p`를 SIGTERM으로 끝내면 코드 143으로 종료하고 진행 중인 턴을 결과 없이 남긴다. "To end the turn instead, send SIGINT, or call the Agent SDK's `interrupt()`"라고 되어 있다. `system/init`의 `capabilities` 배열에 `interrupt_receipt_v1`, `interrupt_cancel_queued_v1` 같은 값이 있어서 기능 감지에 쓸 수 있다. 재개 시 `CLAUDE_CODE_RESUME_INTERRUPTED_TURN=1`로 중단된 턴을 이어 갈 수 있다. — [Claude Code Docs: Run programmatically](https://code.claude.com/docs/en/headless)
- Gemini Live는 인터럽트되면 "the ongoing generation is canceled and discarded"하고 `silenceDurationMs`(기본 약 800 ms, 권장 500–800 ms)와 `prefixPaddingMs`(기본 20 ms)를 설정할 수 있다. — [Gemini Live API capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities)
- GPT-Live-1은 음성 인터럽트가 백엔드 작업을 취소하지 않는다. `task_version`으로 오래된 결과를 거른다. — [DataCamp](https://www.datacamp.com/tutorial/gpt-live-1-api)
- VoiceMode v8.11.0의 "skip-forward"는 녹음을 즉시 끝내는 수동 턴 종료이고 VAD fallback 역할을 한다. — [VoiceMode releases](https://github.com/mbailey/voicemode/releases)

#### 턴 감지
- Claude Code 내장 STT 파라미터는 `endpointing_ms=300`, `utterance_end_ms=1000`이다. — [로컬 확인: Claude Code 2.1.284 바이너리](file:///Users/dobedub/.local/share/claude/versions/2.1.284)
- Smart Turn v3는 23개 언어(한국어 포함)를 지원한다. — [GitHub pipecat-ai/smart-turn (검색 요약)](https://github.com/pipecat-ai/smart-turn). LiveKit MultilingualModel은 한국어를 포함한다. — [LiveKit docs (검색 요약)](https://docs.livekit.io/agents/logic/turns/turn-detector)

#### 에코 제거(AEC)와 더킹
- Chrome M68은 실험적 제약 `echoCancellationType: 'system' | 'browser'`를 추가했다. system은 OS 구현(macOS 등)을 쓴다. 제약이 없으면 하드웨어 AEC가 있을 때 그것을, 없으면 Chrome 소프트웨어 AEC를 쓴다(2018년 글). — [Chrome Developers: More native echo cancellation](https://developer.chrome.com/blog/more-native-echo-cancellation)
- macOS 네이티브 AEC(Sierra 이상)를 getUserMedia `echoCancellation`에 쓰는 실험이 있었다(M66–67, 2018). — [Chrome Developers: macOS native echo cancellation](https://developer.chrome.com/blog/macos-native-echo-cancellation)
- Chrome의 AEC 참조 범위는 확인이 엇갈린다.
  - 2019년 W3C 논의: "Firefox, Safari, and Edge consider all audio being played from the browser for echo cancellation, while Chrome only considers audio being played from the webrtc remote peer connection" — [W3C public-webrtc-logs 2019-05](https://lists.w3.org/Archives/Public/public-webrtc-logs/2019May/0149.html)
  - 이후 `chrome://flags/#chrome-wide-echo-cancellation`(Chrome 전역 AEC)이 도입돼 Chrome 106부터 대부분 기본값이 됐고 Windows와 macOS에서 동작한다는 검색 요약이 있다. 원문 이슈는 로그인 벽 때문에 확인하지 못했다. — [Chromium issue 40871060 (검색 요약, 미검증)](https://issues.chromium.org/issues/40871060)
- Apple `voiceProcessingOtherAudioDuckingConfiguration`(macOS 14+): 보이스 프로세싱을 켠 AVAudioEngine 입력 노드에서 다른 오디오의 더킹을 조절한다. `enableAdvancedDucking`(발화 기반 동적 더킹)과 `duckingLevel`(default/min/mid/max)이 있고 기본은 advanced ducking 비활성이다. — [Apple Docs: voiceProcessingOtherAudioDuckingConfiguration](https://developer.apple.com/documentation/avfaudio/avaudioinputnode/voiceprocessingotheraudioduckingconfiguration)

#### 훅 이벤트 (음성 큐 매핑 재료)
- 이벤트 목록:
  - 기본 흐름: SessionStart/SessionEnd, UserPromptSubmit, PreToolUse, **PermissionRequest**, PostToolUse, PostToolUseFailure, PostToolBatch, **Stop**, **StopFailure**(API 오류로 턴 종료), SubagentStart/SubagentStop, **TaskCreated/TaskCompleted**
  - 그 외: **Notification**, **MessageDisplay**(어시스턴트 텍스트 표시 중), PreCompact/PostCompact, Elicitation, TeammateIdle 등
  - 출처: [Claude Code Docs: Hooks](https://code.claude.com/docs/en/hooks)
- Notification matcher: `permission_prompt`, `idle_prompt`, `auth_success`, `elicitation_dialog`, `agent_needs_input`, `agent_completed`, `quota_auto_resume_*` 등이다. — [Hooks](https://code.claude.com/docs/en/hooks)
- 훅 타입은 `command`, **`http`**(이벤트 JSON을 POST), `mcp_tool`, `prompt`, `agent`다. command 훅의 `"async": true`는 백그라운드로 돌고 timeout을 강제하지 않는다. `-p` 모드에서도 훅은 정상 발화한다. Stop과 SubagentStop 입력에 **`last_assistant_message`**(마지막 응답 전문)가 들어 있다. — [Hooks](https://code.claude.com/docs/en/hooks)

### Inferences
- **한국어 증분 분할기 설계** (가정 포함, 미검증):
  - `text_delta`를 버퍼에 쌓고 다음 조건에서 청크를 내보낸다.
    1. `[.!?…~]` + 공백/줄바꿈, 또는 `\n`
    2. 한국어 종결 패턴(예: `다|요|죠|까|네|지|자` 뒤 구두점)
  - 첫 청크는 약 12–20자 이상일 때 쉼표나 연결어미(`고|서|는데|지만` + 공백)에서도 끊어 TTFB를 줄이고, 이후 청크는 30–80자로 키운다. 한국어는 영어보다 글자당 정보량이 많아 Deepgram의 50–100자 권장보다 짧게 잡는 게 적당해 보이지만 실측이 필요하다.
  - 소수점("3.5"), 버전, URL, 파일 경로, 코드블록, 마크다운 기호, 이모지는 분할과 발화에서 제외하거나 치환한다(코드는 "코드 블록 생략" 같은 말로 요약).
  - `Intl.Segmenter`는 완성된 버퍼에 대한 보조 검증용으로만 쓴다.
- **barge-in 절차**:
  - 렌더러 VAD가 `onSpeechStart`를 내면 ① 재생을 즉시 중단(AudioBufferSourceNode stop, 100 ms 이하)하고 ② TTS 큐와 스트림을 취소한 뒤 ③ Claude가 아직 이전 답을 스트리밍 중이면 상주 프로세스에 인터럽트를 보낸다. 인터럽트는 stream-json 입력의 control request나 SIGINT로 보낸다. SIGTERM은 프로세스를 죽이므로 쓰면 안 된다.
  - 에코로 인한 가짜 barge-in을 막으려면 AEC에 더해 최소 발화 길이(약 200–300 ms)와 에너지 임계를 요구하거나, 헤드폰이 없을 때는 "말하는 동안 VAD 무시 + 핫키/마스코트 클릭으로만 끼어들기"(반이중)로 시작하는 게 안전하다.
- **AEC 전략**:
  - ① TTS를 마이크를 캡처하는 **같은 Electron 렌더러**에서 WebAudio로 재생하고 `getUserMedia({audio:{echoCancellation:true}})`를 쓴다. Chrome 전역 AEC가 켜져 있다면 자체 재생음이 참조 신호가 된다. Electron 44에서 반드시 실측해야 한다.
  - ② 실패하면 Swift 헬퍼로 AVAudioEngine voice processing(VPIO)을 캡처한다. 시스템 출력 전체를 참조하는 AEC를 기대할 수 있고 macOS 14+ 더킹 설정도 가능하다. 다만 다른 앱 소리를 줄이는 부작용이 있다.
  - ③ `say`로 재생하는 경우 별도 프로세스 출력이라 브라우저 AEC 참조에 포함되지 않을 가능성이 크다(추정).
- **발화 권(floor) 관리**: 두 캐릭터와 여러 태스크 세션의 나레이션이 겹치지 않도록 단일 오디오 mutex와 우선순위 큐를 둔다(VoiceMode의 발화 잠금 개념과 같다). 사용자가 말하는 중에는 모든 나레이션을 보류하거나 버린다.
- **훅 이벤트 음성 매핑 초안** (우선순위 높은 순):

  | 우선순위 | 이벤트 | 처리 |
  |---|---|---|
  | 1 | 사용자와 마스코트의 직접 대화 | 항상 음성 |
  | 2 | `PermissionRequest` / Notification `permission_prompt` / `agent_needs_input` | 짧은 음성 + earcon, 대기 중인 나레이션 선점 |
  | 3 | `StopFailure`와 `PostToolUseFailure` 반복 | 짧은 오류 음성 |
  | 4 | 태스크 세션의 `Stop` / `TaskCompleted` / `agent_completed` | `last_assistant_message`를 1–2문장으로 요약해 음성화. 요약은 마스코트 Claude에 위임하거나 앞 문장만 사용 |
  | 5 | `SubagentStart/Stop`, `PostToolUse`, `PostToolBatch` | 무음 또는 짧은 earcon(빈도가 높음) |
  | 6 | `idle_prompt`, `PreCompact` | 무음이나 부드러운 chime, 말풍선만 |

  같은 세션에서 연속된 이벤트는 합치고, 큐 항목에는 TTL(예: 10–20초)을 둬서 오래된 나레이션을 폐기한다.

### Gaps
- Electron 44(Chromium)에서 Chrome 전역 AEC가 기본인지, `<audio>`와 WebAudio 재생음이 참조 신호에 들어가는지 1차 자료로 확인하지 못했다. 실측이 필요하다.
- 스트리밍 TTS용 한국어 청크 길이(자 수)에 관한 실증 연구를 찾지 못했다.
- stream-json 입력 모드의 interrupt control request 정확한 JSON 형식을 원문으로 확인하지 못했다(Agent SDK TypeScript 레퍼런스 확인 필요).
- 한국어 전용 턴 감지(종결어미 기반 end-of-turn) 모델의 성능 자료가 없다.

## Q6. Electron 특이사항: 재생, 마이크 권한(LaunchAgent), 백그라운드 스로틀링, 전역 push-to-talk

### Takeaway
오디오 재생은 투명 always-on-top 창에서도 일반 렌더러와 같다. Electron 기본 `autoplayPolicy`가 `no-user-gesture-required`라 자동 재생에 문제가 없다. 다만 `backgroundThrottling`(기본 true)은 끄는 게 안전하다.

가장 큰 위험은 **마이크 권한 귀속**이다. 현재 오버레이는 ① 서명 없는(ad-hoc) 기본 `Electron.app`(bundle id `com.github.Electron`)을 ② bash LaunchAgent 스크립트가 `nohup`으로 직접 실행한다. 그래서 TCC의 "responsible code" 판정이 모호하고, Electron을 업데이트할 때마다 권한이 초기화될 수 있다. 전역 hold-to-talk는 Electron `globalShortcut`이 키를 뗄 때 이벤트를 주지 않아서 uiohook 계열 native 훅(손쉬운 사용·입력 모니터링 권한 필요)이 필요하다. 권한이 필요 없는 tap 방식이나 마스코트 클릭-홀드가 현실적이다.

### Cited Findings
- `webPreferences.backgroundThrottling`은 "Whether to throttle animations and timers when the page becomes background. This also affects the Page Visibility API"이고 기본 `true`다. `autoplayPolicy`는 `no-user-gesture-required`(기본), `user-gesture-required`, `document-user-activation-required` 중 하나다. `transparent`는 기본 `true`다. — [Electron Docs: WebPreferences](https://www.electronjs.org/docs/latest/api/structures/web-preferences)
- `systemPreferences.askForMediaAccess('microphone')`은 `Promise<boolean>`을 반환한다. `getMediaAccessStatus`는 `not-determined|granted|denied|restricted|unknown` 중 하나를 준다. Info.plist에 `NSMicrophoneUsageDescription`이 필수다. 한 번 거부되면 다시 묻지 않으니 시스템 설정에서 바꿔야 하고, 바꾼 뒤 앱을 재시작해야 한다. — [Electron Docs: systemPreferences](https://www.electronjs.org/docs/latest/api/system-preferences)
- 패키징 시 entitlement `com.apple.security.device.audio-input`과 `NSMicrophoneUsageDescription`이 필요하다. — [BigBinary: camera/mic permission in Electron](https://bigbinary.com/blog/request-camera-micophone-permission-electron)
- `globalShortcut`: "The `callback` is called when the registered shortcut is pressed by the user"(key-up 없음). 미디어 키만 trusted accessibility client 권한이 필요하다. 다른 앱이 이미 점유한 단축키는 조용히 등록에 실패한다. `ready` 이후에만 쓸 수 있다. — [Electron Docs: globalShortcut](https://www.electronjs.org/docs/latest/api/global-shortcut)
- qHotkeys는 Electron globalShortcut 대체용으로 uiohook-napi를 쓰며 key release를 감지한다. — [npm qhotkeys (검색 요약)](https://npmjs.com/package/qhotkeys)
- macOS에서 "Accessibility"는 이벤트 게시와 청취를, "Input Monitoring"은 청취만 허용한다. Input Monitoring 요청 API는 `IOHIDRequestAccess()`다. — [Apple Developer Forums 828052 (검색 요약)](https://developer.apple.com/forums/thread/828052)
- **responsible code**(Apple DTS Quinn): "This responsible code concept is problematic when it comes to scripting, because there's no good way for the system to track the identity of a script." launchd 에이전트가 bash 스크립트를 실행한 사례에서는 프라이버시 프롬프트가 뜨지 않아 권한도 받지 못했다. 스크립트를 앱(Platypus 래퍼)으로 감싸 해결했다. 이 사례는 로컬 네트워크 권한이지만 같은 responsible code 개념이 쓰인다. — [Apple Developer Forums 769918](https://developer.apple.com/forums/thread/769918)
- 반대 사례로, 터미널에서 실행한 도구는 터미널이 responsible code가 된다. 또 SMAppService로 설치하지 않은 launchd 에이전트는 launchd plist의 `AssociatedBundleIdentifiers`로 responsible code를 macOS에 알려야 한다. 두 문장 모두 Apple 포럼 검색 요약에서 나왔고 원 스레드를 특정하지 못했다. — [Apple Developer Forums 774160](https://developer.apple.com/forums/thread/774160), [Michael Tsai: Local network privacy on Sequoia](https://mjtsai.com/blog/2024/10/02/local-network-privacy-on-sequoia). Claude Code 문서도 `/voice` 마이크 권한 프롬프트가 "for your terminal"로 뜬다고 적고 있다. — [Voice dictation](https://code.claude.com/docs/en/voice-dictation)
- ad-hoc 서명 코드는 안정적인 designated requirement(DR)가 없다. 그래서 macOS가 새 버전을 같은 앱으로 인식하지 못하고, 업데이트나 재빌드 후 TCC 권한이 사라질 수 있다. 안정적인 서명 ID(Apple Development/Developer ID 또는 일관된 자체 서명 인증서)를 쓰면 해결된다. — [Apple Developer Forums 795739 (검색 요약)](https://developer.apple.com/forums/thread/795739), [TN3127: Inside Code Signing Requirements](https://developer.apple.com/documentation/technotes/tn3127-inside-code-signing-requirements)
- 로컬 확인(현재 구성):
  - LaunchAgent `com.dobedub.skinclaude.watch`(KeepAlive, RunAtLoad)는 `/bin/bash ~/.skinclaude/overlay-ctl.sh watch`를 실행한다. 스크립트는 `nohup "$APP/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" "$APP" &`로 기본 Electron 바이너리를 직접 띄운다. — [로컬 확인: overlay-ctl.sh](file:///Users/dobedub/.skinclaude/overlay-ctl.sh), [로컬 확인: LaunchAgent plist](file:///Users/dobedub/Library/LaunchAgents/com.dobedub.skinclaude.watch.plist)
  - Electron 44.4.5 번들의 `CFBundleIdentifier`는 `com.github.Electron`이다. Info.plist에 `NSMicrophoneUsageDescription`과 `NSAudioCaptureUsageDescription`이 이미 있다. `codesign -dv` 결과는 `flags=0x20002(adhoc,linker-signed)`, `TeamIdentifier=not set`이다. — [로컬 확인: Electron.app Info.plist](file:///Users/dobedub/.skinclaude/app/node_modules/electron/dist/Electron.app/Contents/Info.plist)
- 스트리밍 오디오 포맷 참고: Gemini Live는 입력 16 kHz PCM, 출력 24 kHz이고 GPT-Live-1 WebSocket은 PCM 24k/16k base64다. — [Gemini Live capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities), [OpenAI voice WebSockets](https://developers.openai.com/api/docs/guides/voice-websockets)

### Inferences
- **마이크 권한 위험** (추정, 실측 필요):
  - 현재 구조에서는 Electron이 요청하는 마이크 권한이 ① launchd job인 bash에 귀속되거나 ② 프롬프트 없이 거부되거나 ③ `com.github.Electron`(ad-hoc)에 귀속될 수 있다. 어느 쪽인지는 첫 요청 뒤 시스템 설정의 마이크 목록을 보면 알 수 있다.
  - ③이라도 `npm update electron`으로 바이너리가 바뀌면 권한이 초기화될 가능성이 높다.
  - 대응 후보:
    - (a) `open -a …/Electron.app --args "$APP"`로 LaunchServices를 거쳐 실행해 앱 번들이 스스로 responsible code가 되게 한다(추정).
    - (b) 전용 .app으로 패키징한다. 고유 bundle id(예: `com.dobedub.skinclaude`)를 주고 자체 서명 인증서로 일관되게 서명해 TCC 권한을 업데이트 후에도 유지한다.
    - (c) 시작 시 `getMediaAccessStatus` 확인 후 `askForMediaAccess('microphone')`를 호출하고, 거부 상태면 말풍선으로 설정 경로를 안내한다.
    - (d) LaunchAgent plist에 `AssociatedBundleIdentifiers`로 앱 bundle id를 적는다. 이것이 TCC 마이크 귀속에도 효과가 있는지는 미검증이다.
  - Swift 헬퍼(SpeechTranscriber/VPIO)가 마이크를 잡으면 헬퍼 자체의 귀속 문제가 따로 생긴다. 헬퍼를 앱 번들 안에 넣어야 앱이 responsible code로 인식될 가능성이 높다.
- **재생**:
  - TTS 재생과 마이크 캡처는 가능하면 같은 렌더러(마스코트 창 또는 숨김 오디오 창)에서 WebAudio로 한다(AEC 참조 신호 확보).
  - PCM 스트림은 AudioWorklet이나 연속 AudioBufferSource 스케줄링으로 끊김 없이 재생하고, mp3 스트림은 MediaSource를 쓴다.
  - 투명도와 `setIgnoreMouseEvents`는 오디오에 영향이 없을 것으로 보인다(추정).
  - `backgroundThrottling: false`로 VAD 프레임 처리와 스케줄링 타이머가 창이 가려지거나 비활성일 때 느려지지 않게 한다. AudioWorklet은 오디오 스레드라 스로틀링 영향이 적을 것으로 추정한다.
- **push-to-talk 설계**:
  - v1은 ① `globalShortcut` tap 모드(한 번 눌러 녹음, 다시 눌러 전송, 추가 권한 없음. Claude Code `/voice tap`과 같은 UX)와 ② 마스코트를 마우스로 누르고 있는 동안 녹음(창 자체 이벤트라 권한 없음)을 권장한다.
  - 진짜 전역 hold-to-talk가 필요하면 uiohook-napi를 쓰되 손쉬운 사용·입력 모니터링 권한과 앞의 귀속 문제를 같이 해결해야 한다.
- 두 마스코트가 동시에 듣지 않도록 마이크 입력은 앱 단일 모듈이 소유한다. 현재 활성(포커스) 캐릭터의 `claude -p`로만 전사를 보낸다.

### Gaps
- nohup으로 실행한 Electron(LaunchAgent → bash → Electron 바이너리 직접 실행)의 TCC 귀속을 공식 자료로 확인하지 못했다. 실측이 필요하다.
- `open -a`로 실행하면 앱이 responsible code가 된다는 점을 1차 자료로 확인하지 못했다(추정).
- Electron 44가 기반으로 하는 Chromium 버전과 전역 AEC·오디오 서비스 동작을 확인하지 못했다.
- 투명 always-on-top 창과 백그라운드 스로틀링에서 AudioWorklet 재생이 안정적인지에 대한 자료가 없다.
