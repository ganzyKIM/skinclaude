# 마스코트 음성 입력: 한국어 음성인식(STT) 선택지 조사 — skinclaude (Electron 44 · macOS 26 · Apple M4)

> 조사일 2026-09-30. 버전·가격은 조사 시점 값이며 날짜를 함께 적었다. "로컬 실측"은 이 Mac에서 직접 확인한 값이다(Apple M4, RAM 16 GB, macOS 26.5.2 빌드 25F84, Xcode SDK 26.5, Swift 6.3.3 — `sw_vers`·`sysctl`·`xcrun --show-sdk-version` 결과).

## 1. Apple 네이티브 음성인식(SFSpeechRecognizer · SpeechAnalyzer/SpeechTranscriber/DictationTranscriber)과 Electron 연동·권한

### Takeaway
macOS 26의 SpeechAnalyzer + SpeechTranscriber는 한국어(ko_KR)를 온디바이스로 지원하고, 이 Mac에는 ko_KR 자산이 이미 설치돼 있다. API 키 없이 가장 빨리 붙일 수 있는 경로다. 다만 한국어 정확도를 공개한 수치가 없다. 비샌드박스 앱에서 TCC(마이크·음성인식 권한)가 어떻게 동작하는지도 보고가 엇갈린다. 그래서 기존 `claudewin`처럼 별도 Swift 헬퍼 프로세스로 만들고 직접 재봐야 한다. 구형 SFSpeechRecognizer는 1분 제한, 전용 권한 키, macOS 26 무응답 보고 때문에 권하지 않는다.

### Cited Findings
**이 환경에서 직접 확인한 것(2026-09-30)**
- `swiftc`로 컴파일한 probe(호출 API: `SpeechTranscriber.isAvailable/supportedLocales/installedLocales/supportedLocale(equivalentTo:)`, `AssetInventory.status(forModules:)`, `DictationTranscriber.supportedLocales/installedLocales`, `SFSpeechRecognizer(locale:)`, `SFSpeechRecognizer.authorizationStatus()`) 결과는 다음과 같다. 권한 창이나 다운로드 없이 실행됐다 — 로컬 실측
  - `SpeechTranscriber.isAvailable = true`, `supportedLocales` 30개(ko_KR 포함), `installedLocales = [ko_KR]`, `supportedLocale(equivalentTo: ko-KR) = ko_KR`
  - `.progressiveTranscription` 프리셋으로 만든 ko_KR SpeechTranscriber의 `AssetInventory.status` = `supported`. 이 구성에는 `installed`가 아니므로 첫 사용 때 추가 자산을 내려받을 수 있다.
  - `DictationTranscriber.supportedLocales` 54개(ko_KR 포함), `installedLocales = [en_US, ko_KR]`
  - `SFSpeechRecognizer(ko-KR)`: `isAvailable = true`, `supportsOnDeviceRecognition = true`. `authorizationStatus = 0`(notDetermined). `SFSpeechRecognizer.supportedLocales` 63개.
- 오버레이가 쓰는 Electron 번들: `CFBundleIdentifier = com.github.Electron`, 44.4.5, ad-hoc(linker-signed) 서명, TeamIdentifier 없음. Info.plist에는 `NSMicrophoneUsageDescription`·`NSAudioCaptureUsageDescription`이 있고 `NSSpeechRecognitionUsageDescription`은 없다. 기존 헬퍼는 `swiftc -O helper/claudewin.swift`로 빌드한다 — [로컬 Info.plist](file:///Users/dobedub/Desktop/skinclaude/overlay/node_modules/electron/dist/Electron.app/Contents/Info.plist), [overlay/package.json](file:///Users/dobedub/Desktop/skinclaude/overlay/package.json)

**API 성격·언어 지원**
- SpeechAnalyzer는 iOS 10 이래의 SFSpeechRecognizer를 대신하는 새 API다. Notes·Voice Memos·Journal에 쓰이는 모델을 쓴다. 모델은 AssetInventory로 필요할 때 내려받아 시스템 저장소에 두므로 앱 용량이나 런타임 메모리를 늘리지 않고, 시스템이 자동으로 업데이트한다. "volatile results"(말하자마자 나오는 거친 결과를 몇 초에 걸쳐 고쳐 가는 방식)를 지원한다. 강의·회의 같은 장문과 원거리 음성에 맞다. 지원하지 않는 언어·기기에는 DictationTranscriber를 쓴다. DictationTranscriber는 iOS 10 온디바이스 SFSpeechRecognizer와 언어·모델·기기가 같지만, 사용자가 설정에서 Siri나 키보드 받아쓰기를 켤 필요가 없다 — [WWDC25 세션 277](https://developer.apple.com/videos/play/wwdc2025/277/)
- 출시 때 SpeechTranscriber 언어는 광둥어·중국어·영어·프랑스어·독일어·이탈리아어·일본어·한국어·포르투갈어·스페인어 10개였다. iOS/iPadOS/macOS/tvOS/visionOS 26과 Mac Catalyst 26에서 제공된다(watchOS 제외). JavaScript 바인딩이나 브라우저 노출이 없어 네이티브 브리지가 필요하다. 2025년 6월 테스트에서 Whisper Large V3보다 2.2배 빨랐다 — [addpipe 블로그](https://blog.addpipe.com/apple-speechanalyzer-api/)
- 2026-08-23 확인 기준 `supportedLocales`는 42개 로케일, 22개 언어(한국어 포함)라고 한다. LibriSpeech(영어) WER은 SpeechAnalyzer 2.12%(test-clean)·4.56%(test-other), Whisper Small 3.74%·7.95%다. M2 Pro에서 12~40배 실시간이다. 영어 외 언어나 Large V3와 비교한 공개 테스트는 없다고 밝혔다 — [LoroNote](https://loronote.com/en/blog/apple-speechanalyzer-vs-whisper). 이 Mac의 실측은 30개로, 이 수치와 맞지 않는다.
- Apple 포럼 사례(ambient-voice, MIT): Mac mini M4 16GB에서 SpeechAnalyzer 처리 속도는 74~89배 실시간이었다. 중국어(AliMeeting)·영어(AMI) 회의 음성 기준 CER은 근거리 34%, 원거리 40%였다(한국어 아님) — [Apple Developer Forums #819555](https://developer.apple.com/forums/thread/819555)
- macOS 기능 제공 페이지의 "Dictation: On-Device and Modeless Dictation" 목록에 Korean (Korea)이 있다("Requires download of speech models"). 받아쓰기 자동 문장부호에도 Korean이 있다. Apple Intelligence "More advanced Dictation"은 영어만 된다 — [Apple macOS Feature Availability](https://www.apple.com/macos/feature-availability/)

**구형 SFSpeechRecognizer의 제약**
- 네트워크 기반 서비스라 기기별 일일 인식 횟수나 앱별 요청량이 제한될 수 있다. 문서에 "Plan for a one-minute limit on audio duration"(1분이 넘는 작업은 중단)이라고 적혀 있다 — [Apple: SFSpeechRecognizer](https://developer.apple.com/documentation/speech/sfspeechrecognizer)
- `requiresOnDeviceRecognition = true`로 네트워크 전송을 막을 수 있지만 "on-device requests won't be as accurate" — [Apple: requiresOnDeviceRecognition](https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/requiresondevicerecognition)
- macOS 26에서 `SFSpeechURLRecognitionRequest`가 "silently never starts" 했다는 보고가 있다(60초 클립을 넣고 120초 동안 출력 0). SpeechAnalyzer로 바꾼 뒤 174분짜리 방송을 약 190초에 처리했다. CLI 하나의 사례다 — [djacobs/transcribe-audio PR #1](https://github.com/djacobs/transcribe-audio/pull/1)

**권한(TCC) — 보고가 엇갈림**
- SpeechAnalyzer는 `NSSpeechRecognitionUsageDescription`이나 `requestAuthorization`을 쓰지 않는다고 한다. 라이브 오디오에는 `NSMicrophoneUsageDescription`만 필요하고, 이미 가진 오디오를 전사할 때는 추가 권한이 없다. 서버 경로가 없는 온디바이스 전용이다. SFSpeechRecognizer는 전용 음성인식 권한을 계속 요구한다. DictationTranscriber는 짧은 발화용 SFSpeechRecognizer 대체다. SpeechDetector는 발화 시작·끝 이벤트를 내는 VAD 모듈이다(2026-05-02 글) — [Blake Crosley](https://blakecrosley.com/blog/speech-framework-vs-sfspeechrecognizer)
- 반대 보고: simonw/speech-analyzer-cli는 바이너리를 앱 번들로 감싼다. README에 "The bundle supplies the privacy metadata macOS needs when requesting Speech Recognition permission"이라고 쓰고, 첫 전사 때 음성인식 권한 창이 뜬다고 한다. ad-hoc 서명이라 다시 빌드하면 권한을 또 물을 수 있어 Apple Development 인증서 서명을 권한다 — [simonw/speech-analyzer-cli](https://github.com/simonw/speech-analyzer-cli/blob/main/README.md)
- 코드 확인: yap(Homebrew CLI)의 Swift 소스와 node-apple-speech의 Swift 헬퍼에는 `requestAuthorization` 호출이 없다. `SpeechTranscriber.isAvailable`, `supportedLocales`, `AssetInventory.reserve/assetInstallationRequest`만 쓴다 — [yap 소스](https://github.com/finnvoor/yap/tree/main/Sources/yap), [node-apple-speech](https://www.npmjs.com/package/node-apple-speech)
- 비샌드박스 macOS 앱에서 AVAudioEngine + SpeechAnalyzer + SpeechTranscriber를 쓰면 `engine.prepare()/start()`나 `SpeechAnalyzer.start()`를 할 때마다 마이크 권한 창이 10~20회 이상 반복됐다는 보고가 있다. 엔진 재사용 같은 우회는 실패했고 기능은 꺼 둔 상태다. 유력한 해법으로 "Sandbox the app"을 들었다 — [sophiaclaw voice-wake 상태 문서](https://cdn.jsdelivr.net/npm/sophiaclaw@0.2.4/docs/status/voice-wake.md)
- 같은 Apple 포럼 사례의 함정: `AVAudioEngine.installTap`은 블루투스 장치에서 실패하므로 `AVCaptureSession`을 쓴다. `NSEvent.addGlobalMonitorForEvents`는 macOS 26 Swift actor 런타임 버그로 크래시하므로 `CGEventTap`을 쓴다. ad-hoc 서명은 빌드마다 코드 디렉터리 해시가 바뀌어 TCC 권한이 초기화되므로 고정 인증서로 서명하고 LaunchServices(`open`)로 실행한다 — [Apple Developer Forums #819555](https://developer.apple.com/forums/thread/819555)

**Electron에 붙이는 기존 도구**
- **yap** 1.2.1(2026-07-20, CC0-1.0, 별 1.6k): macOS 26 이상, `brew install yap`. `yap dictate`(마이크)·`listen`(시스템 오디오)·`transcribe`(파일)와 `--locale`, TXT/SRT/VTT/JSON 출력을 지원한다 — [finnvoor/yap](https://github.com/finnvoor/yap)
- **node-apple-speech** 0.1.1(2026-06-03, darwin 전용): macOS 26+와 Swift 6.3+가 필요하다. Swift 헬퍼 바이너리(`native/apple-speech-helper.swift`)를 빌드해 쓴다. `transcribeData(PCM16 버퍼)`와 `transcribeFile`을 제공하고 whisper.node와 같은 API 모양이다 — [npm](https://www.npmjs.com/package/node-apple-speech)
- **@xsai-apple-speech/transcription-native** 0.1.4(2026-09-02): Node-API 애드온이다. SpeechTranscriber와 DictationTranscriber를 지원하고 로케일에 따라 자동으로 넘어간다. "Use it in Node.js or an Electron main process. Do not bundle it into an Electron renderer." 빌드에 Xcode 26과 macOS 26 SDK가 필요하다. 라이브 세션은 mono Float32 PCM을 받는다 — [npm](https://www.npmjs.com/package/@xsai-apple-speech/transcription-native), [moeru-ai/xsai-apple-speech](https://github.com/moeru-ai/xsai-apple-speech)

### Inferences
- **권장 구조: `claudewin`과 같은 방식의 두 번째 Swift 헬퍼(가칭 `sttd`).** SpeechAnalyzer + SpeechTranscriber(ko_KR, volatileResults)를 돌리고 stdout에 JSON 줄로 부분·최종 결과를 흘려 main.js가 읽는다. 장점은 세 가지다. 앱을 다시 서명할 필요가 없다. 네이티브 애드온의 Electron ABI 문제가 없다. 헬퍼가 죽어도 오버레이는 산다.
- **오디오를 누가 잡을지가 TCC 위험을 가른다.** 렌더러가 getUserMedia로 잡아 PCM을 헬퍼 stdin에 넣으면 마이크 권한은 이미 `NSMicrophoneUsageDescription`을 가진 Electron이 받는다. 이렇게 하면 헬퍼 안의 AVAudioEngine에서 보고된 "권한 창 반복" 문제를 피할 수 있다(추론, 검증 필요). 헬퍼가 직접 녹음하면 포럼 권고대로 `AVCaptureSession`을 쓰는 편이 블루투스 마이크(에어팟 등)에서 안전하다.
- **SpeechTranscriber에 음성인식 권한이 필요한지는 결론이 나지 않았다.** yap과 node-apple-speech 코드, Blake Crosley 글은 "마이크 권한만"을 가리키고, simonw는 "음성인식 권한 창"을 보고했다. 필요하다면 Electron.app Info.plist에 `NSSpeechRecognitionUsageDescription`을 넣어야 한다. 그런데 npm으로 설치한 Electron 번들을 고치면 서명을 다시 해야 하고, 재설치하면 사라진다(t3code 이슈 참고, 섹션 4). 이 경우엔 헬퍼를 작은 `.app` 번들로 감싸는 simonw 방식이 대안이다.
- 이 Mac에는 ko_KR 자산이 이미 있다(`installedLocales`). 한국어 시스템 받아쓰기를 써 온 결과로 보인다. 그래도 `.progressiveTranscription` 프리셋은 `supported` 상태라 첫 실행 때 AssetInventory 다운로드가 한 번 일어날 수 있다.
- **코드 0줄 대안: macOS 시스템 받아쓰기.** 한국어가 온디바이스로 되므로 사용자는 기존 ⌥⇧Space 입력창에서 받아쓰기 단축키로 말해 입력할 수 있다. 다만 마스코트가 "듣는 중" 상태를 알 수 없고, 입력창에 포커스가 있어야 한다.
- SFSpeechRecognizer는 1분 제한, Electron 번들에 없는 전용 권한 키, macOS 26 무응답 보고 때문에 새로 만들 경로로는 부적합하다.

### Gaps
- SpeechTranscriber·DictationTranscriber의 **한국어 CER을 공개한 자료가 없다**. 코드명·파일명·"클로드 코드" 같은 섞인 영어 용어를 얼마나 알아듣는지도 모른다. 짧은 한국어 명령 50~100개로 실측해야 한다.
- 음성인식 TCC 권한이 필요한지를 두고 1차 자료가 서로 충돌한다(Apple 공식 문서에서 확인하지 못함).
- `supportedLocales` 개수가 다르다(이 Mac 30개, LoroNote 42개). OS 빌드나 하드웨어 차이일 수 있으나 확인하지 못했다.
- SpeechTranscriber의 사용자 지정 어휘(예: `AnalysisContext` contextual strings)가 한국어에서 되는지 확인하지 못했다.
- 한국어 volatile 결과의 첫 글자 지연(ms)을 잰 자료를 찾지 못했다.

## 2. 로컬 오픈소스 엔진(whisper.cpp·WhisperKit·mlx/faster-whisper·sherpa-onnx·Vosk·Moonshine·Kyutai·Parakeet/Canary·2026 신규 모델)과 Node 바인딩

### Takeaway
한국어가 되는 로컬 엔진 가운데 검증된 1순위는 Whisper large-v3-turbo다(whisper.cpp는 Metal/Core ML, WhisperKit은 ANE). 2026년 새로 나온 Qwen3-ASR(0.6B/1.7B, Apache-2.0)는 보고된 한국어 FLEURS 오류율이 훨씬 낮다. sherpa-onnx에 int8 모델이 있어 Node에서 바로 돌릴 수 있는 유력 후보다. 한국어를 진짜로 스트리밍하는 모델은 드물다. 그래서 "VAD로 발화를 끊고 배치 인식"하는 방식이 실용적이다. Kyutai, Parakeet/Canary, distil-whisper, Granite Speech, Moonshine 스트리밍은 한국어가 안 돼서 뺀다.

### Cited Findings
**Whisper 계열**
- whisper.cpp 최신은 v1.9.4(2026-09-11), MIT, 별 5.4만이다. Apple Silicon을 1급으로 최적화한다(ARM NEON, Accelerate, Metal, Core ML). Core ML로 인코더를 ANE에서 돌리면 CPU만 쓸 때보다 3배 이상 빠르다 — [ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp) (버전은 GitHub API로 확인)
- large-v3-turbo는 large-v3를 가지치기해 디코더 층을 32개에서 4개로 줄인 모델이다. "way faster, at the expense of a minor quality degradation" — [openai/whisper-large-v3-turbo](https://huggingface.co/openai/whisper-large-v3-turbo). distil-whisper(distil-large-v3/v3.5 등)는 언어 태그가 `en`뿐이라 영어 전용이다 — [distil-large-v3.5](https://huggingface.co/distil-whisper/distil-large-v3.5)
- 한국어 정확도 근거:
  - Whisper-large-v3의 KsponSpeech Eval-Other CER은 11.13%다(영어 LibriSpeech Other는 3.91%). ENERZAi가 한국어로 추가 학습하고 토크나이저를 바꾸자 Whisper-Small CER이 18.05%에서 6.45%로 내려갔다 — [Edge AI and Vision Alliance, 2025-11](https://www.edge-ai-vision.com/2025/11/small-models-big-heat-conquering-korean-asr-with-low-bit-whisper/)
  - FLEURS 한국어 CER: whisper tiny 15.83, whisper medium 6.99, moonshine tiny-ko(27M) 8.9. Common Voice 17 CER은 각각 37.27, 9.38, 14.94다 — [moonshine-tiny-ko 모델 카드](https://huggingface.co/moonshine-ai/moonshine-tiny-ko)
  - 리턴제로 벤치마크(AI-Hub 7개 테스트셋, 셋당 3,000문장, 2025년 2월 측정, 2025-08 갱신)에서 OpenAI Whisper API 평균 CER은 11.39%였다. 리턴제로가 Whisper를 한국어로 미세조정한 모델은 6.59%였다 — [rtzr/Awesome-Korean-Speech-Recognition](https://github.com/rtzr/Awesome-Korean-Speech-Recognition)
  - 커뮤니티가 한국어로 미세조정한 turbo 모델도 있다(예: ghost613/whisper-large-v3-turbo-korean, faster-whisper·ggml 변환본). 품질은 검증되지 않았다 — [Hugging Face](https://huggingface.co/ghost613/whisper-large-v3-turbo-korean)
- WhisperKit은 argmaxinc/argmax-oss-swift로 옮겨졌다. v1.1.0(2026-08-06), MIT이며 WhisperKit·TTSKit·SpeakerKit을 담았다. macOS 14 이상, `brew install whisperkit-cli`로 설치한다. `argmax-cli transcribe --stream`으로 마이크를 스트리밍 전사한다. README에 Local Server 절이 있다. 권장 모델은 `large-v3-v20240930_626MB`(압축한 Large v3 Turbo, "Recommended across iOS and macOS for maximum accuracy")다. 화자 포함 실시간 전사 등은 유료 Pro SDK 기능이다 — [argmax-oss-swift](https://github.com/argmaxinc/argmax-oss-swift)
- mlx-whisper 0.4.3(2025-08-29, MIT, "OpenAI Whisper on Apple silicon with MLX") — [PyPI](https://pypi.org/project/mlx-whisper/). 제3자 벤치마크로 M1 Max(64GB)에서 whisper-large-v3-turbo가 14.3배 RTF(짧은 클립 0.70초), whisper-large-v3가 10.5배였다 — [vllm-mlx 오디오 벤치마크](https://vllm-mlx.is-a.dev/benchmarks/audio/)
- faster-whisper 1.2.1(2025-10-31, MIT, CTranslate2 기반) — [PyPI](https://pypi.org/project/faster-whisper/)

**Node/Electron 바인딩(npm, 2026-09-30 조회)**
- `whisper-cpp-node` 0.2.12(2026-03-07, MIT): macOS 13.3 이상 Apple Silicon에서 Metal을 쓰고 Core ML은 선택이다. **Silero VAD 스트리밍이 내장**돼 있다. PCM Float32 16 kHz 버퍼를 받는다. 미리 빌드된 `@whisper-cpp-node/darwin-arm64`가 있다 — [npm](https://www.npmjs.com/package/whisper-cpp-node)
- `@fugood/whisper.node` 1.2.0-rc.0(2026-09-17, MIT): macOS arm64에서 CPU와 Metal을 쓴다. whisper.rn과 같은 API이고 `transcribeData(PCM16 mono 16kHz)`와 중단 기능이 있다 — [npm](https://www.npmjs.com/package/@fugood/whisper.node)
- `@kutalia/whisper-node-addon` 1.1.0(2025-07-18, MIT): 실시간용이며 PCM을 넣을 수 있고 Electron 대상 prebuilt가 있다 — [npm](https://www.npmjs.com/package/@kutalia/whisper-node-addon)
- `nodejs-whisper` 0.3.1(2026-08-03, MIT): make 도구가 필요하다. 파일을 WAV로 바꾼 뒤 whisper.cpp를 실행하는 파일 기반 래퍼다 — [npm](https://www.npmjs.com/package/nodejs-whisper)
- 오래된 것: `smart-whisper` 0.8.1(2024-10-02), `whisper-node` 1.1.1(2023-11-29), `@napi-rs/whisper` 0.0.4(2024-12-25) — [npm registry](https://registry.npmjs.org/)
- Python 바인딩: `pywhispercpp` 1.5.1(2026-08-22, MIT) — [PyPI](https://pypi.org/project/pywhispercpp/)

**sherpa-onnx(next-gen Kaldi)**
- v1.13.8(2026-09-10), Apache-2.0, 별 1.5만. `sherpa-onnx-node` 1.13.8은 선택 의존성으로 `sherpa-onnx-darwin-arm64`를 포함한다 — [k2-fsa/sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx), [npm sherpa-onnx-node](https://www.npmjs.com/package/sherpa-onnx-node)
- 한국어를 쓸 수 있는 모델(asr-models 릴리스 자산, 크기는 tar.bz2 기준) — [sherpa-onnx asr-models 릴리스](https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models):
  - `sherpa-onnx-streaming-zipformer-korean-2024-06-16`(418 MB, 모바일판 378 MB): **스트리밍**, 한국어 전용, KsponSpeech 학습(icefall PR #1651) — [sherpa 문서](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/online-transducer/zipformer-transducer-models.html)
  - `sherpa-onnx-zipformer-korean-2024-06-24`(330 MB, 인코더 int8 68 MB): 오프라인, KsponSpeech 학습 — [sherpa 문서](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-transducer/zipformer-transducer-models.html)
  - `sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2025-09-09`(166 MB)
  - `sherpa-onnx-moonshine-tiny-ko-quantized-2026-02-27`(49 MB)
  - `sherpa-onnx-qwen3-asr-0.6B-int8-2026-03-25`(879 MB)
  - `sherpa-onnx-omnilingual-asr-1600-languages-300M/1B-ctc`(int8 292 MB / 787 MB)
- SenseVoice-Small은 zh/en/ja/ko/yue를 지원한다. 비자기회귀 구조라 10초 오디오를 70 ms에 처리한다("15 times faster than Whisper-Large"). 라이선스는 FunASR `model-license`(MIT 아님) — [FunAudioLLM/SenseVoiceSmall](https://huggingface.co/FunAudioLLM/SenseVoiceSmall)

**2026년 신규 다국어 모델(한국어 지원 여부)**
- **Qwen3-ASR** 1.7B/0.6B(2026-01, Apache-2.0): 30개 언어와 22개 중국어 방언을 지원하고 Korean (ko)이 포함된다. 오프라인과 스트리밍을 한 모델로 하지만 스트리밍은 vLLM 백엔드에서만 된다 — [Qwen/Qwen3-ASR-1.7B](https://huggingface.co/Qwen/Qwen3-ASR-1.7B). 기술 보고서(arXiv 2601.21337v2, 2026-01-30) 부록 표의 한국어 값은 FLEURS 0.6B 3.72, 1.7B 2.57, Flash-1208 2.07이고, CommonVoice 0.6B 8.48, 1.7B 5.88, Flash 3.82다. 동시 128 요청에서 0.6B의 평균 TTFT는 92 ms, RTF는 0.064다 — [Qwen3-ASR Technical Report](https://arxiv.org/html/2601.21337). 검색 요약은 1.7B를 3.72로 적어 논문 원문 추출값과 달랐다. 여기서는 원문 추출값을 썼다.
- **Voxtral Mini 4B Realtime 2602**(Mistral, 2026-01, Apache-2.0): 13개 언어(ko 포함)의 네이티브 스트리밍 모델이다. 480 ms 지연에서 FLEURS 한국어 15.74%, 2400 ms에서 14.30%다. 오프라인 Voxtral Mini Transcribe 2.0은 12.29%다. 지연은 80 ms~2.4 s로 설정할 수 있다. "currently only support in vLLM" — [모델 카드](https://huggingface.co/mistralai/Voxtral-Mini-4B-Realtime-2602). 2025년판 Voxtral-Mini-3B-2507은 한국어를 지원하지 않는다 — [모델 카드](https://huggingface.co/mistralai/Voxtral-Mini-3B-2507)
- **Cohere Transcribe 03-2026**(Apache-2.0, gated): 14개 언어(ko 포함) — [모델 카드](https://huggingface.co/CohereLabs/cohere-transcribe-03-2026)
- **Microsoft VibeVoice-ASR**(MIT, 51개 언어, ko 포함)와 **VibeVoice-ASR-Streaming-1.5B**(2026-09, MIT, 10개 언어, 한국어 포함, 화자 구분·핫워드) — [VibeVoice-ASR](https://huggingface.co/microsoft/VibeVoice-ASR), [Streaming-1.5B](https://huggingface.co/microsoft/VibeVoice-ASR-Streaming-1.5B)
- **Moonshine**: moonshine-ai/moonshine v0.1.5(2026-08-24). 한국어는 "Flavors of Moonshine" tiny-ko(27M, 2025-09)와 base-ko가 있다. 모델 라이선스는 "other"이고, 영어가 아닌 legacy 비스트리밍 모델은 **비상업 Moonshine Community License**다. 2026년 스트리밍 모델에 한국어판은 아직 없다(en·es·ja·ar·de·vi만 확인). 카드에 환각(말하지 않은 텍스트 생성) 경고가 있다 — [moonshine-ai/moonshine](https://github.com/moonshine-ai/moonshine), [HF moonshine-ai](https://huggingface.co/moonshine-ai), [moonshine-tiny-ko](https://huggingface.co/moonshine-ai/moonshine-tiny-ko)
- **Vosk** `vosk-model-small-ko-0.22`: 82 MB, Zeroth 테스트 WER 28.1, Apache 2.0 — [Vosk 모델 목록](https://alphacephei.com/vosk/models). vosk-api 마지막 릴리스는 v0.3.50(2024-04-22), npm `vosk`는 0.3.39(2022-05-24), 대안 `vosk-koffi`는 1.1.1(2025-05-09) — [GitHub API](https://github.com/alphacep/vosk-api), [npm vosk-koffi](https://www.npmjs.com/package/vosk-koffi)

**한국어 미지원이라 빼는 것**
- Kyutai STT: `stt-1b-en_fr`(영어·프랑스어, 0.5초 지연)와 `stt-2.6b-en`(영어 전용) — [kyutai-labs/delayed-streams-modeling](https://github.com/kyutai-labs/delayed-streams-modeling)
- NVIDIA parakeet-tdt-0.6b-v3와 canary-1b-v2: 유럽 25개 언어, CC-BY-4.0, ko 없음 — [parakeet-tdt-0.6b-v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3), [canary-1b-v2](https://huggingface.co/nvidia/canary-1b-v2)
- IBM granite-speech-4.1(en/fr/de/es/pt/ja) — [모델 카드](https://huggingface.co/ibm-granite/granite-speech-4.1-2b)

### Inferences
- **정확도 우선 로컬 1순위는 Whisper large-v3-turbo다(Whisper 계열 안에서).** `whisper-cpp-node`(Metal + 내장 Silero VAD)나 `@fugood/whisper.node`로 main 프로세스에서 돌리거나, WhisperKit CLI/헬퍼로 돌린다. M4 16GB에서 모델(약 0.6~1.6 GB)이 메모리에 충분히 들어간다. 몇 초짜리 짧은 발화는 1초 안팎에 처리될 것으로 보인다(M1 Max 14배 RTF에서 유추, M4 실측 없음).
- **평가해 볼 가치가 가장 큰 새 후보는 Qwen3-ASR-0.6B다(sherpa-onnx-node, int8 879 MB).** 보고된 FLEURS 한국어 3.72%는 Whisper 쪽 한국어 수치(FLEURS CER: medium 6.99, 대화체 KsponSpeech에서 large-v3 11.13)보다 크게 낮다. 다만 데이터셋과 지표(CER/WER)가 달라 직접 비교는 할 수 없다.
- 가장 가볍고 빠른 선택지는 SenseVoice int8(166 MB)과 moonshine-tiny-ko(49 MB)다. Moonshine 한국어 모델은 비상업 라이선스지만 개인 앱이라 괜찮을 가능성이 높다. SenseVoice는 FunASR 모델 라이선스를 확인해야 한다.
- 한국어 네이티브 스트리밍 로컬 모델은 sherpa의 2024년 zipformer-korean(KsponSpeech만 학습)밖에 Mac/Node에서 바로 쓸 게 없다. Voxtral Realtime은 vLLM 전용이고, VibeVoice-Streaming은 Mac 런타임을 확인하지 못했다. 마스코트 대화는 발화 단위 턴제라, 부분 결과 표시가 꼭 필요하지 않으면 VAD 후 배치 인식으로 충분하다.
- faster-whisper는 Python과 CTranslate2 기반이라 Electron에서 쓰려면 Python 런타임을 따로 둬야 한다. Apple GPU/ANE 가속도 whisper.cpp·WhisperKit·MLX 쪽이 명시적으로 지원한다. 이 앱에서는 우선순위가 낮다(추론).
- 네이티브 애드온(sherpa-onnx-node, whisper-cpp-node)은 main 프로세스에서 쓴다. N-API 기반이면 Electron ABI 문제가 적지만 설치 뒤 로드 테스트는 해야 한다(추론). LaunchAgent가 `~/.skinclaude/app`으로 rsync하는 설치 흐름에 모델 파일(수백 MB) 배치 규칙을 더해야 한다.

### Gaps
- 같은 한국어 테스트셋에서 whisper turbo, Qwen3-ASR, SenseVoice, sherpa zipformer-korean, Apple SpeechTranscriber를 나란히 비교한 자료가 없다.
- **M4 실측 속도가 없다**(찾은 벤치마크는 M1 Max·M2 Pro·"M5 Pro" 등). 짧은 한국어 명령 기준 첫 결과 지연도 없다.
- Qwen3-ASR 한국어 수치가 CER인지 WER인지 원문 표에서 확인하지 못했다. sherpa-onnx에서 Qwen3-ASR을 돌릴 때 Mac 속도·메모리 자료도 없다.
- sherpa zipformer-korean 모델 카드에서 KsponSpeech CER 수치를 확인하지 못했다.
- Voxtral Realtime을 Mac(MLX/llama.cpp)에서 돌릴 수 있는 포트가 있는지 확인하지 못했다.
- whisper large-v3-turbo가 large-v3보다 한국어에서 얼마나 떨어지는지(openai/whisper discussion #2363) 수치를 확인하지 못했다.

## 3. 클라우드 STT: 한국어 정확도·스트리밍·지연·가격·무료 한도

### Takeaway
한국어 특화 업체(리턴제로 RTZR, 네이버 CLOVA)는 한국어 대화체 벤치마크에서 강하다. 다만 그 벤치마크는 리턴제로가 만들었다. 가격은 Soniox(실시간 약 $0.12/시간), OpenAI `gpt-transcribe`($0.0045/분), Deepgram($200 크레딧), Gemini 3.5 Transcribe(무료 티어 있음)가 가장 싸다. AssemblyAI 스트리밍은 한국어가 안 된다. 개인 사용량(월 수 시간)이면 어느 쪽을 골라도 한 달에 몇 달러 이하다. 선택 기준은 가격보다 한국어 품질, 스트리밍 여부, 개인정보 정책이다.

### Cited Findings
**한국어 정확도(모두 업체가 만든 벤치마크 — 편향 주의)**
- 리턴제로 벤치마크(AI-Hub 7개 셋, 셋당 3,000문장, 2025-02 측정, 2025-08-15에 Azure·AWS·Deepgram 추가)의 평균 CER: 리턴제로 **5.91**, 리턴제로 Whisper 6.59, Naver ClovaSpeech **7.52**, ETRI 10.19, Azure batch 10.88, AWS 11.11, OpenAI Whisper 11.39, Google API v2 11.50, Gemini 2.0 Flash 16.58, Deepgram nova-2 21.02. KsponSpeech clean/other 값은 리턴제로 6.64/6.77, Clova 8.05/7.96, Whisper 12.06/11.34다 — [rtzr/Awesome-Korean-Speech-Recognition](https://github.com/rtzr/Awesome-Korean-Speech-Recognition) (커밋 이력은 GitHub API로 확인)
- Soniox가 공개한 한국어 CER: Azure 1.21, Soniox 1.25, Speechmatics 1.4, Cartesia 1.47, AWS 1.68, Deepgram 1.71, AssemblyAI 1.74, Google 2.84, ElevenLabs 3.16, OpenAI 3.24. 같은 페이지의 가격 비교표는 "RTZR 공개 비교 페이지" 수치를 인용한다: Soniox 4.3%, RTZR 4.66%, NAVER CLOVA 9.09% — [Soniox 한국어 페이지](https://soniox.com/korea). 두 벤치마크는 절대값이 크게 다르다(데이터셋과 정규화 차이로 보임).
- 한국어 CER은 WER보다 적절한 지표다. 띄어쓰기 차이만으로 WER이 50%가 되기도 한다(예: "커피 한 잔"과 "커피 한잔"은 WER 50%, CER 0%) — [rtzr/Awesome-Korean-Speech-Recognition](https://github.com/rtzr/Awesome-Korean-Speech-Recognition)

**업체별 사양·가격(2026-09-30 조회)**
- **OpenAI** 분당 추정가: `gpt-transcribe` $0.0045, `gpt-4o-mini-transcribe` $0.003, `gpt-4o-transcribe` $0.006, `whisper` $0.006, `gpt-4o-transcribe-diarize` $0.006, `gpt-live-transcribe` $0.017, `gpt-realtime-whisper` $0.017. Realtime 음성 모델(gpt-realtime-2.1 등)의 오디오 입력은 1M 토큰당 $32(mini $10)다 — [OpenAI pricing](https://developers.openai.com/api/docs/pricing)
  - `gpt-transcribe`: 파일 전사, 스트리밍 파일 전사, Realtime 세션의 확정 턴을 처리한다. 맥락, 키워드 힌트, 복수 언어 힌트를 지원한다. `v1/audio/transcriptions`와 `v1/realtime/transcription_sessions`에서 쓴다 — [모델 페이지](https://developers.openai.com/api/docs/models/gpt-transcribe)
  - `gpt-live-transcribe`: 지연을 조절할 수 있는 저지연 스트리밍 델타, 키워드·언어 힌트. Realtime transcription 세션 전용이다 — [모델 페이지](https://developers.openai.com/api/docs/models/gpt-live-transcribe)
  - `gpt-realtime-whisper`: 오디오 길이로 과금하는 스트리밍 STT다. Tier 1 한도는 분당 오디오 100분이다 — [모델 페이지](https://developers.openai.com/api/docs/models/gpt-realtime-whisper)
- **Google Cloud STT v2**: 표준 인식은 월 50만 분까지 $0.016/분, 동적 배치는 $0.003/분이다. v1은 월 처음 60분이 무료다 — [Google STT pricing](https://cloud.google.com/speech-to-text/pricing). Chirp 3는 ko-KR이 GA이고 StreamingRecognize, Recognize(1분 미만), BatchRecognize를 지원한다. 리전은 us, eu, asia-northeast1 등이다(검색 요약 기준) — [Chirp 3 문서](https://docs.cloud.google.com/speech-to-text/docs/models/chirp-3)
- **Gemini API**(2026-09-24 갱신 페이지): `gemini-3.5-transcribe`는 언어 자동 감지, 화자 구분, 단어 타임스탬프, 사용자 어휘 바이어싱을 지원한다. 입력 1M 토큰당 $2.00(약 $0.003/분), 합산 약 $0.005/분이다. `gemini-3.5-transcribe-live`는 WebSocket 양방향 스트리밍 STT이고 합산 약 $0.009/분이다. 오디오는 초당 25토큰으로 계산한다. 두 모델 모두 **무료 티어가 "Free of charge"**이지만 무료 티어 데이터는 "Used to improve our products: Yes"다 — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- **Deepgram**: 가입하면 $200 크레딧을 준다. Nova-3 Monolingual 스트리밍은 PAYG $0.0048/분(정가 $0.0077, 기간 한정 프로모션), Multilingual은 $0.0058/분(정가 $0.0092)이다 — [Deepgram pricing](https://deepgram.com/pricing). 2026-08-04 변경 기록에 한국어(ko, ko-KR) Nova-3 단일언어 배치·스트리밍 모델 개선이 있고, 요청은 바꾸지 않아도 된다 — [Deepgram changelog 2026-08-04](https://developers.deepgram.com/changelog/2026/8/4.md). 스트리밍 지연이 300 ms 미만이라는 주장은 2차 자료에서만 봤다 — [검색 요약 출처](https://mlopscommunity.substack.com/p/tuesday-tool-review-deepgrams-nova)
- **AssemblyAI**: Universal-3.5 Pro(비동기) $0.21/시간, Universal-2 $0.15/시간, U-3.6 Pro Realtime $0.45/시간, Universal-Streaming $0.15/시간. 신규 계정은 $50 무료 크레딧을 받는다. 스트리밍은 오디오 길이가 아니라 **세션 시간**으로 과금한다 — [AssemblyAI pricing](https://www.assemblyai.com/pricing). 한국어는 비동기 Universal-3.5 Pro와 Universal-2만 지원하고, 실시간(U-3.6 Pro Realtime)은 한국어 지원 표시가 없다("—") — [AssemblyAI Korean](https://www.assemblyai.com/languages/korean)
- **ElevenLabs**: Scribe v2 배치 $0.22/시간, Scribe v2 Realtime $0.39/시간. Starter($6/월)에 배치 4시간 30분·실시간 2시간 30분이 포함된다 — [ElevenLabs API pricing](https://elevenlabs.io/pricing/api). 90개 이상 언어, 약 150 ms 지연(검색 요약) — [ElevenLabs Realtime STT](https://elevenlabs.io/realtime-speech-to-text)
- **Azure AI Speech**: F0 무료는 실시간 전사 월 5시간이다 — [Azure Speech pricing](https://azure.microsoft.com/en-us/pricing/details/speech/). Azure Retail Prices API(eastus) 기준 S1 Speech To Text $1.00/시간, Fast Transcription $0.36/시간, "Fast Transcription Promo" $0.10/시간(2026-09-01부터) — [Azure Retail Prices API](https://prices.azure.com/api/retail/prices)
- **네이버 CLOVA Speech**: Free 플랜은 매월 20분 무료(장문 인식, 계정당 도메인 1개)다. 15초 단위로 올려서 과금한다(예: 10초 이용 5원, 32초 이용 15원 → 약 ₩1,200/시간). 단문 인식, 장문 인식, 스트리밍 인식(Basic 플랜) 유형이 있다 — [NAVER Cloud CLOVA Speech](https://www.ncloud.com/product/aiService/clovaSpeech)
- **리턴제로 RTZR STT**: Basic 플랜은 **10시간 무료**, 배치·스트리밍 모두 ₩1,000/시간이고 최대 할인가는 ₩400/시간이다. 무료 10시간을 넘으면 결제수단을 등록하지 않은 경우 자동으로 멈춘다. 동시 10채널, 화자분리, 키워드 부스팅, "리턴제로 Whisper 모델", 다국어 "Sommers" 모델을 제공한다 — [RTZR pricing](https://rtzr.ai/pricing). 실시간 스트리밍과 파일 API를 지원한다 — [RTZR developers](https://developers.rtzr.ai/)
- **Soniox**: 토큰 과금으로 비동기 약 $0.10/시간, 실시간 약 $0.12/시간(stt-rt-v5)이다 — [Soniox pricing](https://soniox.com/pricing). 한국어 스트리밍, 200 ms 미만 지연 주장, Node.js·Web SDK 제공 — [Soniox 한국어 페이지](https://soniox.com/korea)
- 참고(영어 실시간, 2026-08 Pipecat 벤치마크): 현재 모델명은 OpenAI `gpt-realtime-whisper`, Google `gemini-3.5-transcribe-live`, ElevenLabs `scribe_v2_realtime`, AssemblyAI `universal-3-5-pro`, Soniox `stt-rt-v5`, Deepgram `nova-3-general`이다 — [Soniox benchmarks](https://soniox.com/benchmarks)

### Inferences
- **월 15시간(900분)을 쓴다고 가정한 비용**(위 공개가로 계산): Soniox 실시간 약 $1.8 / gpt-4o-mini-transcribe $2.7 / gpt-transcribe $4.05 / Deepgram Nova-3 $4.3(단, $200 크레딧으로 사실상 수년 무료) / Gemini 3.5 Transcribe 약 $4.5(무료 티어면 $0) / ElevenLabs 실시간 $5.9 / Azure S1 $10(5시간 무료 차감) / Google v2 $14.4 / gpt-live-transcribe $15.3 / RTZR ₩15,000(첫 10시간 무료) / CLOVA ₩18,000. 푸시투토크로 하루 몇 분만 쓰면 전부 월 1달러 안팎이다.
- **한국어 품질 기대치**: RTZR·CLOVA는 한국어 대화체에 특화돼 있다. 리턴제로 벤치마크에서는 1·2위지만 작성자가 리턴제로라 편향 가능성이 있다. Soniox 벤치마크에서는 Azure·Soniox·Deepgram·AssemblyAI가 상위이고 OpenAI·ElevenLabs·Google이 하위다. 이것도 Soniox가 만들었다. 두 결과를 모두 받쳐 주는 독립 벤치마크는 찾지 못했다.
- **스트리밍(말하는 동안 자막)**이 필요하면 RTZR 스트리밍, Deepgram Nova-3 ko 스트리밍, Soniox 실시간, OpenAI `gpt-live-transcribe`, Gemini `3.5-transcribe-live`, Google Chirp 3 StreamingRecognize, ElevenLabs Scribe v2 Realtime, CLOVA 스트리밍이 후보다. AssemblyAI는 한국어 스트리밍이 없어 뺀다.
- **발화 단위 배치**(VAD로 끊고 한 번에 전송)면 가장 단순한 조합은 OpenAI `gpt-transcribe`(REST 하나로 끝나고, 키워드·맥락 힌트로 "클로드 코드", 파일명 같은 용어를 보정)와 Gemini `gemini-3.5-transcribe`(무료 티어)다.
- **개인정보**: Gemini 무료 티어는 데이터가 제품 개선에 쓰인다. 마스코트에게 하는 말에는 작업 지시(코드·경로)가 섞이므로 유료 티어나 데이터 정책이 명확한 API를 고르는 편이 낫다.
- OpenAI Realtime 음성 모델(gpt-realtime-2.x)은 STT를 넘어 음성 대화 에이전트다. 이 앱은 응답을 Claude Code CLI가 만드므로 입력 전사 전용 모델이면 충분하다.

### Gaps
- OpenAI `gpt-transcribe`·`gpt-live-transcribe`의 **한국어 전용 수치와 출시일**을 찾지 못했다. OpenAI 공식 오디오 모델 발표 페이지는 403으로 막혔다.
- Deepgram Nova-3의 2026-08 한국어 개선 폭(수치)이 공개되지 않았다.
- Chirp 3 한국어 지원·리전 정보는 검색 요약에만 의존했다(문서를 직접 열지 못함).
- CLOVA Speech 스트리밍(gRPC)의 가격표와 지연 수치는 페이지가 JS로 그려져 확인하지 못했다(15초당 5원은 장문 인식 예시).
- 한국어 실시간 스트리밍의 첫 토큰 지연을 독립적으로 잰 비교 자료를 찾지 못했다.

## 4. Electron에서의 오디오 캡처, macOS 마이크 권한, 마스코트 음성(TTS)과의 에코 제거

### Takeaway
렌더러에서 `getUserMedia`로 잡고 AudioWorklet으로 16 kHz mono PCM을 만들어 main이나 헬퍼로 넘기는 방식이 가장 간단하다. 권한은 이미 `NSMicrophoneUsageDescription`을 가진 Electron 번들이 받는다. Chromium의 Web Speech API(webkitSpeechRecognition)는 Electron에서 "network" 오류로 동작하지 않는다는 보고가 반복돼 쓸 수 없다. ad-hoc 서명된 npm Electron이라 Electron을 업데이트하면 권한을 다시 물을 수 있다. 에코는 같은 렌더러에서 TTS를 재생하면 Chromium AEC에 기대 볼 수 있지만, 가장 확실한 건 마스코트가 말하는 동안 마이크를 무시하는 반이중 방식이다.

### Cited Findings
- `systemPreferences.askForMediaAccess('microphone')`(macOS 전용)는 `Promise<boolean>`을 돌려준다. `getMediaAccessStatus`는 `not-determined`, `granted`, `denied`, `restricted`, `unknown` 중 하나다. Info.plist에 `NSMicrophoneUsageDescription`이 있어야 한다. 한 번 거부되면 창이 다시 뜨지 않고 시스템 설정에서 바꿔야 하며, 바꾼 뒤엔 앱을 재시작해야 한다 — [Electron systemPreferences](https://www.electronjs.org/docs/latest/api/system-preferences)
- "By default, Electron will automatically approve all permission requests unless the developer has manually configured a custom handler". 따라서 렌더러의 getUserMedia는 macOS TCC만 통과하면 된다 — [Electron Security 문서](https://www.electronjs.org/docs/latest/tutorial/security)
- 로컬 Electron 번들(com.github.Electron 44.4.5, ad-hoc 서명)의 Info.plist에는 `NSMicrophoneUsageDescription`("This app needs access to the microphone")이 이미 있다 — [로컬 Info.plist](file:///Users/dobedub/Desktop/skinclaude/overlay/node_modules/electron/dist/Electron.app/Contents/Info.plist). npm 최신 electron은 44.5.1(2026-09-30)이다 — [npm electron](https://www.npmjs.com/package/electron)
- 앱 번들의 Info.plist만 고치고 다시 서명하지 않으면 서명이 깨지고, TCC가 자식 프로세스의 권한 요청을 조용히 거부한다. 해법은 plist를 고친 뒤 ad-hoc 재서명(`identity: "-"`)하는 것이다 — [t3code 이슈 #728](https://github.com/pingdotgg/t3code/issues/728)
- ad-hoc 서명은 빌드마다 코드 디렉터리 해시가 바뀌어 TCC 권한이 초기화된다. LaunchServices(`open`)로 실행하는 것도 권한다 — [Apple Developer Forums #819555](https://developer.apple.com/forums/thread/819555)
- 네이티브 캡처의 함정: `AVAudioEngine.installTap`은 블루투스 장치에서 실패하므로 `AVCaptureSession`을 쓴다 — [Apple Developer Forums #819555](https://developer.apple.com/forums/thread/819555). 비샌드박스 앱에서 AVAudioEngine + SpeechAnalyzer 조합은 마이크 권한 창이 반복된다 — [sophiaclaw](https://cdn.jsdelivr.net/npm/sophiaclaw@0.2.4/docs/status/voice-wake.md)
- Web Speech API: "Web Speech API Fails with 'network error' in Electron (Even in Dev Mode)"(Electron 32, 2025-03). 같은 코드가 Chrome에서는 된다 — [electron#46143](https://github.com/electron/electron/issues/46143). 2021년에도 "[Bug]: SpeechRecognition does not work"가 보고됐다 — [electron#31732](https://github.com/electron/electron/issues/31732)
- `echoCancellation` 제약값: `"all"`은 마이크에 잡힌 시스템 생성 오디오를 모두 지운다(스크린리더, 알림음 등). `"remote-only"`는 RTCPeerConnection에서 온 원격 오디오만 지운다. `true`는 브라우저가 정하되 최소 remote-only 수준이고, all 수준을 시도해야 한다 — [MDN echoCancellation](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/echoCancellation)
- Chrome M68(2018)부터 macOS 네이티브(시스템) 에코 캔슬러를 쓸 수 있다(`echoCancellationType: 'system'|'browser'`, 당시 실험 기능). macOS 구현은 "internal loopback"으로 재생 오디오를 얻는다 — [Chrome 블로그(2018, 오래됨)](https://developer.chrome.com/blog/more-native-echo-cancellation/). "Chrome-wide echo cancellation"은 다른 탭에서 재생되는 소리까지 마이크에서 지우는 실험 기능으로, 끄는 제약을 추가해 달라는 요청이 있다 — [Chromium issue 40871060](https://issues.chromium.org/issues/40871060)

### Inferences
- **권장 캡처 파이프라인**: 렌더러(또는 숨은 창)에서 `getUserMedia({audio:{echoCancellation:true, noiseSuppression:true, autoGainControl:true, channelCount:1}})`로 잡는다. AudioWorklet에서 16 kHz로 다운샘플해 20~32 ms 프레임을 만든다. VAD(@ricky0123/vad-web)로 발화를 자른다. 자른 Float32/PCM16을 IPC로 main에 보낸다. main은 STT 엔진(로컬 애드온, Swift 헬퍼 stdin, 클라우드)으로 넘긴다. MediaRecorder(webm/opus)는 클라우드 배치 업로드에는 편하지만 로컬 엔진과 VAD에는 원시 PCM이 필요해서 맞지 않는다.
- 오버레이는 투명 always-on-top 창이라 보이는 창에서 캡처해도 되지만, 숨은 BrowserWindow를 따로 두면 렌더러 재로드나 창 숨김과 녹음이 서로 영향을 주지 않는다(설계 선택).
- **권한 주체**: 현재 권한은 generic `com.github.Electron`(ad-hoc) 이름으로 나간다. 권한 창에 "Electron"이 표시된다. 같은 번들 ID를 쓰는 다른 개발용 Electron 앱과 권한 항목이 섞일 수 있다. `npm update electron`으로 바이너리가 바뀌면 다시 물을 수 있다(추론). LaunchAgent로 실행하는 지금 구조에서 문제가 되면 `open`으로 띄우거나 전용 번들 ID로 재포장(electron-builder 등)을 검토한다.
- **에코/자기 음성 인식 방지**: 마스코트 TTS를 같은 렌더러의 `<audio>`나 WebAudio로 재생하면 Chromium AEC가 참조 신호를 가질 가능성이 높다. `say` 같은 다른 프로세스로 재생하면 보장되지 않는다(추론). 가장 확실한 방법은 **반이중**이다. 마스코트가 말하는 동안(그리고 끝난 뒤 200~300 ms) VAD 결과를 버린다. 또는 푸시투토크를 누르면 TTS를 즉시 멈추는 barge-in만 허용한다.
- 헬퍼에서 직접 캡처하는 방식은 Apple SpeechAnalyzer와 궁합이 좋지만, 반복 권한 창과 블루투스 문제를 먼저 실측해야 한다.

### Gaps
- Electron 44(Chromium 최신)에서 `echoCancellation: "all"`이 macOS에서 실제로 같은 앱의 `<audio>` 재생을 지우는지 확인한 자료를 찾지 못했다(Chromium 버전별 지원표 미확인).
- Electron이 Web Speech API를 공식적으로 지원하지 않는 이유(구글 API 키, 크롬 전용 서비스)를 메인테이너가 설명한 원문을 보지 못했다.
- Electron이 띄운 헬퍼가 마이크를 직접 열 때 TCC 책임 프로세스가 Electron으로 잡히는지, 헬퍼로 잡히는지 확인한 1차 자료가 없다(보안 연구 자료와 검색 요약 수준뿐).

## 5. VAD와 청취 트리거: Silero/WebRTC VAD, 푸시투토크 vs 상시 청취 웨이크워드

### Takeaway
VAD는 Silero VAD(v6.2.3, MIT)가 사실상 표준이다. 렌더러에서는 `@ricky0123/vad-web`로 바로 쓴다. WebRTC VAD의 Node 패키지들은 2019년 이후 방치 상태다. 트리거는 기존 ⌥⇧Space를 "토글형 푸시투토크(눌러서 듣기 시작 → VAD가 침묵을 감지하면 자동 종료)"로 확장하는 게 프라이버시·배터리·구현 모두에서 가장 낫다. 한국어 상시 웨이크워드는 2026년 현재 쓸 만한 무료 선택지가 없다. Porcupine 무료 티어는 2026-06-30에 끝났고, openWakeWord는 영어 모델만 있으며, sherpa-onnx KWS에는 한국어 모델이 없다.

### Cited Findings
- **Silero VAD** v6.2.3(2026-09-23), MIT. 30 ms 이상 청크 하나를 CPU 스레드 하나로 1 ms 안에 처리한다. 8 kHz/16 kHz를 지원하고 6,000개 이상 언어로 학습했다. "no telemetry, no keys, no registration" — [snakers4/silero-vad](https://github.com/snakers4/silero-vad) (버전은 GitHub API·PyPI로 확인)
- **@ricky0123/vad-web** 0.0.31(2026-09-12, ISC)은 Silero VAD를 ONNX Runtime Web/Node로 돌린다. `MicVAD.new({onSpeechStart, onSpeechEnd(audio: Float32Array 16 kHz)})` API로 마이크 권한 요청, 녹음, 발화 구간 콜백까지 해 준다 — [ricky0123/vad](https://github.com/ricky0123/vad). React판 `@ricky0123/vad-react` 0.0.37(2026-09-12), Node판 `@ricky0123/vad-node` 0.0.3(2024-06-01, 오래됨) — [npm](https://www.npmjs.com/package/@ricky0123/vad-web)
- **avr-vad** 1.0.10(2026-04-13, MIT): Node용 Silero v5/legacy다. 실시간 프레임(16 kHz에서 1536샘플) 처리, positive/negative 임계값, redemptionFrames 설정을 지원하고 모델이 번들돼 있다 — [npm avr-vad](https://www.npmjs.com/package/avr-vad). `onnxruntime-node`/`onnxruntime-web` 1.30.0(2026-09-14, MIT) — [npm](https://www.npmjs.com/package/onnxruntime-node)
- whisper-cpp-node에는 Silero VAD 스트리밍이 내장돼 있다 — [npm whisper-cpp-node](https://www.npmjs.com/package/whisper-cpp-node). Apple SpeechAnalyzer에는 VAD 모듈 SpeechDetector가 있다 — [Blake Crosley](https://blakecrosley.com/blog/speech-framework-vs-sfspeechrecognizer)
- **WebRTC VAD** Node 패키지: `node-vad` 1.1.4(2019-10-18), `webrtcvad` 1.0.1(2019-10-26), `@echogarden/fvad-wasm` 0.2.0(2024-10-26, BSD-3) — [npm registry](https://www.npmjs.com/package/@echogarden/fvad-wasm)
- **Electron globalShortcut**: "The `callback` is called when the registered shortcut is pressed by the user". 뗄 때(key-up) 이벤트는 없다 — [Electron globalShortcut](https://www.electronjs.org/docs/latest/api/global-shortcut). 전역 키다운/키업 훅 npm `uiohook-napi` 1.5.5(2026-03-21, MIT) — [npm](https://www.npmjs.com/package/uiohook-napi). macOS 26에서 `NSEvent.addGlobalMonitorForEvents`는 크래시하므로 `CGEventTap`을 쓴다 — [Apple Developer Forums #819555](https://developer.apple.com/forums/thread/819555)
- **Picovoice Porcupine** v4.0(2025-12-11). 코드는 Apache-2.0이지만 AccessKey가 필요하다. 지원 언어: 영어, 중국어, 프랑스어, 독일어, 이탈리아어, 일본어, **한국어**, 포르투갈어, 스페인어. Picovoice Console에서 사용자 웨이크워드를 학습시킨다 — [Picovoice/porcupine](https://github.com/Picovoice/porcupine). npm은 `@picovoice/porcupine-node` 4.0.2, `@picovoice/porcupine-web` 4.0.1 — [npm](https://www.npmjs.com/package/@picovoice/porcupine-node). Picovoice는 "After Free Tier AccessKeys are disabled on June 30, 2026, features using those keys will stop working", "There is no non-commercial tier planned"라고 밝혔다(2026-06-04 게시) — [Home Assistant 커뮤니티](https://community.home-assistant.io/t/fyi-picovoice-confirmed-free-tier-accesskeys-will-stop-working-after-june-30-2026/1012744). 엔진이 AccessKey 검증을 위해 서버에 접속한다(검색 요약) — [Picovoice FAQ](https://picovoice.ai/docs/faq/general)
- **openWakeWord** v0.6.0(2024-02-11, Apache-2.0). "Currently, only English models are supported". 기본 모델은 100% 합성 음성(TTS)으로 학습했다. 80 ms 프레임, 선택형 Silero VAD 게이트. 목표 오작동은 시간당 0.5회 미만, 미검출은 5% 미만이다. 새 모델은 목표 문구의 합성 클립으로 학습한다 — [dscripka/openWakeWord](https://github.com/dscripka/openWakeWord)
- **sherpa-onnx KWS** 모델은 gigaspeech(영어) 3.3M, wenetspeech(중국어) 3.3M, zh-en 3M(2025-12-20)뿐이고 한국어 모델은 없다 — [sherpa-onnx kws-models 릴리스](https://github.com/k2-fsa/sherpa-onnx/releases/tag/kws-models)

### Inferences
- **추천 트리거(1단계)**: ⌥⇧Space를 "음성 토글"로 쓴다. 누르면 마스코트가 "듣는 중" 표정을 짓고 VAD가 발화를 기다린다. 발화가 끝나고 약 0.6~1.0초 침묵이 이어지면 자동으로 끝내고 전사 결과를 입력창에 채운다. 사용자가 확인하거나 곧바로 보낸다. 다시 누르면 취소한다. globalShortcut에는 key-up이 없어서 "누르고 있는 동안만" 방식에는 네이티브 훅이 필요하다. 토글+VAD는 추가 권한이 없다.
- **누르고 말하기(hold-to-talk)**가 꼭 필요하면 기존 Swift 헬퍼에 `CGEventTap`을 추가하는 편이 `uiohook-napi` 같은 네이티브 애드온보다 이 프로젝트 구조에 맞다. 두 방식 모두 입력 모니터링·손쉬운 사용 권한이 추가로 필요하다(추론).
- **상시 청취**: 한국어 웨이크워드("초텐아", "아메야")를 무료로 쓸 수 있는 방법은 사실상 없다. Porcupine은 이제 엔터프라이즈 전용이고, openWakeWord는 한국어 TTS로 합성 데이터를 만들어 직접 학습해야 한다. 대안으로 "Silero VAD 상시 + 발화 구간만 로컬 STT(SpeechTranscriber/sherpa) + 전사문에서 이름 매칭"이 가능하다. 다만 CPU를 계속 쓰고, 사용자의 모든 말을 로컬에서 전사하는 셈이며, 마이크 사용 표시(주황 점)가 항상 켜진다. 개인용 데스크톱이면 켜고 끄는 옵션으로만 두는 게 적절하다.
- VAD 파라미터는 한국어 짧은 명령에 맞춰 조정해야 한다. 예: positiveSpeechThreshold 0.5, negative 0.35, 발화 전 패딩 200~300 ms로 첫 음절 잘림 방지, 최소 발화 250 ms로 기침·키보드 소리 거르기(추론, 실측 필요).

### Gaps
- Picovoice 2026년 하반기 유료 플랜의 가격과 개인 사용 가능 여부(pricing 페이지가 JS로 그려져 확인하지 못함).
- 상시 VAD와 로컬 STT를 돌릴 때 M4 배터리·CPU 소모 실측 자료가 없다.
- 한국어 합성 데이터로 openWakeWord 사용자 모델을 학습한 사례를 찾지 못했다.

## 6. 추천 매트릭스: 이 환경(Electron 44 · macOS 26.5 · M4 16GB · 개인·저예산)에서 최선의 온디바이스 / 클라우드 / 제로셋업 선택지

### Takeaway
제로셋업은 **Apple SpeechTranscriber(ko_KR 이미 설치) + 작은 Swift 헬퍼**다. 코드 0줄로 가려면 macOS 시스템 받아쓰기다. 온디바이스 정확도 최선은 **Whisper large-v3-turbo(whisper.cpp/WhisperKit)**이고, 한국어 수치가 좋은 **Qwen3-ASR-0.6B(sherpa-onnx)**를 함께 비교해 볼 만하다. 클라우드는 한국어 품질 우선이면 **리턴제로 RTZR**(10시간 무료, ₩1,000/시간, 스트리밍)다. 연동 간편성과 용어 보정 우선이면 **OpenAI gpt-transcribe**($0.0045/분)다. 무료 우선이면 Deepgram($200 크레딧, Nova-3 한국어 스트리밍)이나 Gemini 3.5 Transcribe(무료 티어, 데이터 활용 주의)다. 공통 골격은 "⌥⇧Space 토글 → 렌더러 getUserMedia + Silero VAD → 발화 단위 STT → 입력창 채움"이고, 엔진은 교체할 수 있게 설계한다.

### Cited Findings
- 이 Mac: SpeechTranscriber ko_KR 지원·설치, SFSpeechRecognizer ko-KR 온디바이스 지원 — 로컬 실측(섹션 1). SpeechAnalyzer는 온디바이스 전용이며 라이브 오디오엔 마이크 권한만 필요하다는 보고와 음성인식 권한 창이 뜬다는 반대 보고가 공존한다 — [Blake Crosley](https://blakecrosley.com/blog/speech-framework-vs-sfspeechrecognizer), [simonw/speech-analyzer-cli](https://github.com/simonw/speech-analyzer-cli/blob/main/README.md)
- macOS 받아쓰기의 온디바이스 한국어 지원 — [Apple macOS Feature Availability](https://www.apple.com/macos/feature-availability/)
- Whisper large-v3-turbo: large-v3에서 디코더 32층을 4층으로 줄여 훨씬 빠르고 품질은 조금 떨어진다 — [HF 모델 카드](https://huggingface.co/openai/whisper-large-v3-turbo). 대화체 한국어 CER은 large-v3 11.13%(KsponSpeech eval-other) — [Edge AI and Vision Alliance](https://www.edge-ai-vision.com/2025/11/small-models-big-heat-conquering-korean-asr-with-low-bit-whisper/)
- Qwen3-ASR FLEURS 한국어: 0.6B 3.72, 1.7B 2.57 — [arXiv 2601.21337](https://arxiv.org/html/2601.21337). sherpa-onnx int8 0.6B 자산 879 MB — [sherpa-onnx asr-models](https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models)
- RTZR: 리턴제로 벤치마크 평균 CER 5.91(1위), 10시간 무료, ₩1,000/시간 — [rtzr/Awesome-Korean-Speech-Recognition](https://github.com/rtzr/Awesome-Korean-Speech-Recognition), [RTZR pricing](https://rtzr.ai/pricing)
- OpenAI gpt-transcribe: $0.0045/분, 키워드·맥락·다중 언어 힌트 — [OpenAI 모델 페이지](https://developers.openai.com/api/docs/models/gpt-transcribe)
- Deepgram: $200 크레딧, Nova-3 한국어 배치·스트리밍 개선(2026-08) — [Deepgram pricing](https://deepgram.com/pricing), [changelog](https://developers.deepgram.com/changelog/2026/8/4.md)
- Gemini 3.5 Transcribe(/Live) 무료 티어, 무료 티어 데이터는 제품 개선에 쓰임 — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Porcupine 무료 티어 종료(2026-06-30) — [Home Assistant 커뮤니티](https://community.home-assistant.io/t/fyi-picovoice-confirmed-free-tier-accesskeys-will-stop-working-after-june-30-2026/1012744)

### Inferences
**추천 매트릭스(추론 — 한국어 실측 전 잠정 순위)**

| 구분 | 1순위 | 대안 | 이유 / 주의 |
|---|---|---|---|
| 제로셋업(키·모델 다운로드 없음) | Apple SpeechAnalyzer + SpeechTranscriber(ko_KR) Swift 헬퍼(`claudewin`과 같은 빌드 방식) | macOS 시스템 받아쓰기(코드 0줄, 입력창에 직접), `yap dictate`(brew)로 먼저 시험 | ko_KR 이미 설치, 온디바이스, 무료, 스트리밍(volatile) 가능. **한국어 정확도·권한 동작을 실측해야 함** |
| 온디바이스 정확도 | Whisper large-v3-turbo(whisper.cpp → `whisper-cpp-node`/`@fugood/whisper.node`, 또는 WhisperKit CLI 626MB) + Silero VAD | Qwen3-ASR-0.6B int8(sherpa-onnx-node), SenseVoice int8(초고속), sherpa streaming zipformer-korean(진짜 스트리밍) | 모두 무료·오프라인. 모델 0.1~0.9 GB를 설치 경로(`~/.skinclaude`)에 둬야 함. M4 속도 실측 필요 |
| 클라우드 한국어 품질 | RTZR STT(스트리밍·배치, 10시간 무료 후 ₩1,000/h) | NAVER CLOVA Speech(월 20분 무료, ₩1,200/h), Soniox(실시간 $0.12/h, 자체 벤치 CER 1.25) | 한국어 특화. 벤치마크가 업체 작성이라 직접 비교 필요 |
| 클라우드 연동 간편·용어 보정 | OpenAI `gpt-transcribe`(REST 한 번, $0.0045/분) | `gpt-4o-mini-transcribe`($0.003/분), 실시간이면 `gpt-live-transcribe`($0.017/분) | npm `openai` 7.25.0. 코드·파일명 등 키워드 힌트 활용 |
| 무료로 오래 | Deepgram Nova-3 ko(스트리밍, $200 크레딧) | Gemini `3.5-transcribe`(무료 티어, 데이터 학습 활용 주의), Azure F0(월 5시간) | 리턴제로 벤치의 Deepgram 점수(nova-2 21.02)는 구세대라 Nova-3 재평가 필요 |
| 트리거 | ⌥⇧Space 토글 + VAD 자동 종료 | 헬퍼 CGEventTap으로 hold-to-talk | 상시 한국어 웨이크워드는 무료 선택지 없음(Porcupine 무료 종료, openWakeWord 영어만, sherpa KWS 한국어 없음) |

- **단계적 도입안(추론)**:
  1. 먼저 Apple SpeechTranscriber 헬퍼로 뼈대를 만든다. 렌더러 캡처 + VAD + IPC + 헬퍼 stdin/stdout 구조로 하고 엔진 인터페이스를 추상화한다.
  2. 짧은 한국어 명령 50~100개(예: "메인.js 읽어줘", "테스트 돌려봐", 캐릭터 잡담)를 녹음해 Apple, whisper-turbo, Qwen3-ASR-0.6B, (선택) RTZR·gpt-transcribe의 CER과 지연을 잰다.
  3. Apple이 한국어 용어에서 약하면 whisper-turbo나 Qwen3-ASR로, 로컬이 모두 약하면 RTZR이나 gpt-transcribe로 바꾼다.
- **Claude Code로 지시를 넘기는 흐름**에서는 전사 오류가 곧 잘못된 작업 지시가 된다. 그래서 작업 모드("지시")에는 전사 결과를 입력창에 채워 **사용자가 확인한 뒤 전송**하고, 잡담 모드에만 자동 전송하는 게 안전하다(추론).
- 메모리·배터리: Electron 오버레이와 상주 `chatd`(프로세스당 약 390 MB, 프로젝트 메모)에 더해 로컬 모델을 상주시키면 16 GB 맥에서 1~2 GB가 추가된다. 쓰지 않을 때 모델을 내리는(유휴 시 해제) 설계가 필요하다(추론). Apple SpeechTranscriber는 모델이 시스템 메모리 공간 밖에서 돈다고 Apple이 설명한다(WWDC25).

### Gaps
- 이 매트릭스의 한국어 정확도 순위는 서로 다른 데이터셋과 업체 벤치마크를 이어 붙인 것이다. 이 앱의 실제 사용 조건(짧은 명령, 개발 용어가 섞인 구어, 맥 내장 마이크)에서 잰 비교는 없다. 최종 결정 전에 직접 재야 한다.
- Apple SpeechTranscriber의 한국어 정확도와 음성인식 권한 요구 여부(섹션 1 Gaps)가 제로셋업 1순위의 가장 큰 미확인 변수다.
