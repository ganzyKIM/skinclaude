# 마스코트 음성 입력: 일본어 및 한국어·일본어 이중 언어 음성인식(STT) 조사 — skinclaude (Electron 44 · macOS 26.5 · Apple M4)

> 조사일 2026-09-30. 한국어만 다룬 결과(한국어 CER, 업체별 가격표, Electron 캡처·VAD·권한)는 `speech_to_text.md`에 있어 여기서 되풀이하지 않는다. "로컬 실측"은 이 Mac(macOS 26.5.2 빌드 25F84, Apple M4)에서 `swiftc`로 컴파일한 probe의 결과다. 일본어와 한국어 수치는 자료마다 지표(CER/WER)와 데이터셋 버전(CommonVoice 8/16/17 등)이 달라서 표끼리 직접 비교하면 안 된다.

## 1. Apple 온디바이스 API의 일본어(ja_JP) 지원, 한 세션에서 ko+ja 동시 처리 가능 여부, macOS의 언어 식별 방법

### Takeaway
SpeechTranscriber·DictationTranscriber·SFSpeechRecognizer는 모두 ja_JP를 지원한다. 다만 이 Mac에는 일본어 자산이 없고 ko_KR만 설치돼 있다. 그래서 일본어를 쓰려면 한 번 AssetInventory로 내려받아야 한다. 지금 SFSpeechRecognizer로 일본어를 인식하면 온디바이스로 처리되지 않는다.

Transcriber는 인스턴스마다 locale 하나를 받고 자동 언어 식별 기능이 없다. 그래서 앱이 언어를 먼저 정해야 한다. 방법은 셋이다.
- 사용자가 고른다.
- 별도 음성 LID 모델로 판별해 해당 인식기로 보낸다.
- ko·ja 인식기를 병렬로 돌려 신뢰도를 비교한다(미검증).

NLLanguageRecognizer는 전사문의 문자 체계로 ko/ja를 정확히 가른다. 하지만 단일 언어 인식기는 항상 자기 언어 문자로 출력하므로, 어느 인식기를 쓸지 정하는 데는 쓸 수 없다.

### Cited Findings
**로컬 실측(2026-09-30)** — 사용한 API: `SpeechTranscriber.supportedLocales/installedLocales/supportedLocale(equivalentTo:)`, `AssetInventory.status(forModules:)`, `SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith:)`, `AssetInventory.maximumReservedLocales`, `DictationTranscriber.supportedLocales/installedLocales`, `SFSpeechRecognizer(locale:)`, `NLLanguageRecognizer`. 권한 창, 자산 다운로드, 실제 전사는 일으키지 않았다.
- SpeechTranscriber: `supportedLocales` 30개에 ja_JP와 ko_KR이 있다. `installedLocales = [ko_KR]`이고 `supportedLocale(equivalentTo: ja-JP) = ja_JP`다. ja_JP의 `AssetInventory.status`는 `.progressiveTranscription`·`.transcription` 프리셋 모두 `supported`다(다운로드 가능, 미설치) — 로컬 실측
- `bestAvailableAudioFormat` 결과(로컬 실측):
  - ko_KR transcriber는 `1 ch, 16000 Hz, Int16`, ja_JP transcriber는 `nil`이다.
  - 모듈 두 개를 한 목록으로 넘겨도 16 kHz 포맷이 나왔다(ko SpeechTranscriber 2개, ko SpeechTranscriber + ko DictationTranscriber).
  - ja+ko 조합은 `nil`이다.
- `AssetInventory.maximumReservedLocales = 5`이고, 현재 프로세스의 `reservedLocales = []`다 — 로컬 실측
- DictationTranscriber: `supportedLocales` 54개(ja_JP 포함), `installedLocales = [en_US, ko_KR]`, ja_JP `.progressiveShortDictation`은 `supported` — 로컬 실측
- SFSpeechRecognizer(ja-JP)는 `isAvailable = true`, **`supportsOnDeviceRecognition = false`**다. 콘솔에 "No Assistant asset for language ja-JP"가 찍혔다. ko-KR은 `true`다 — 로컬 실측
- NLLanguageRecognizer(제약 없음 / `languageConstraints = [.korean, .japanese]`) — 로컬 실측:
  - "네", "응", "안녕하세요", "클로드 테스트 돌려줘", "메인.js 읽어줘" → ko 1.000
  - "はい", "うん", "こんにちは", "クロード、テスト回して", "アニメ" → ja 1.000
  - 한자만 있는 "今日": 제약이 없으면 **zh-Hans**, 제약을 걸면 ja. "日本語", "東京"은 제약 없이도 ja다.
  - 한·일 혼합 "오늘 ありがとう 했어" → **ja 1.000** 하나만 나온다(혼합 비율을 주지 않음).

**문서·자료**
- SpeechTranscriber 생성자는 `init(locale: Locale, preset:)`와 `init(locale:transcriptionOptions:reportingOptions:attributeOptions:)`이고, 둘 다 locale을 하나만 받는다. 클래스는 `LocaleDependentSpeechModule`을 따른다. 문서에 "Several transcriber instances can share the same backing engine instances and models, so long as the transcribers are configured similarly in certain respects."라고 적혀 있다. 기기가 지원하지 않으면 DictationTranscriber를 쓰라고 한다 — [Apple: SpeechTranscriber](https://developer.apple.com/documentation/speech/speechtranscriber)
- 출시 때 SpeechTranscriber가 지원한 10개 언어에 일본어가 있었다 — [addpipe 블로그](https://blog.addpipe.com/apple-speechanalyzer-api/)
- macOS 기능 제공 페이지의 "Dictation: On-Device and Modeless Dictation"과 "Dictation: Auto-Punctuation" 목록에 Japanese (Japan)이 있다 — [Apple macOS Feature Availability](https://www.apple.com/macos/feature-availability/) (페이지 HTML 파싱으로 확인)
- 개발자 글(검색 결과 요약만 확인, 본문은 403). Speech 프레임워크는 locale을 먼저 정해야 한다. 영어와 일본어를 번갈아 받아쓰려면 수동 전환이 필요하다. 해법으로 언어 감지기를 앞에 붙였다. Swift에는 음성 언어 감지 프레임워크가 없어 MLX로 작고 빠른 LID 모델을 돌렸다 — [Itsuki, Medium](https://medium.com/@itsuki.enjoy/swift-speechtranscriber-support-multi-language-without-manual-locale-switching-b626b547bd74)
- SpeechAnalyzer 비교 글들은 속도와 영어 정확도만 다룬다. 일본어 정확도 수치는 없었다 — [GIGAZINE](https://gigazine.net/gsc_news/en/20250619-apple-speech-analyzer), [issoh](https://www.issoh.co.jp/tech/details/8929/)

### Inferences
- **일본어 준비**: 헬퍼가 처음 실행될 때 ja_JP transcriber용 `AssetInventory.assetInstallationRequest(supporting:)`로 한 번 내려받는다. ko_KR과 ja_JP를 둘 다 예약해도 한도(5개) 안이다. ja+ko 조합의 `nil`은 ja 자산이 없기 때문일 가능성이 크다(ko 모듈 두 개 조합은 됐다).
- **SFSpeechRecognizer(ja-JP)**: 이 Mac에서 쓰면 온디바이스 자산이 없어서 Apple 서버로 간다. 1분 제한과 네트워크 전송이 따른다. 새로 만드는 경로는 SpeechTranscriber나 DictationTranscriber로 한다.
- **Apple 경로에서 ko/ja를 고르는 세 방법**
  1. 명시적 선택(기본값으로 권장): 캐릭터나 단축키마다 locale을 정해 두고 transcriber 두 개를 미리 만들어 둔다.
  2. LID 라우팅: VAD로 자른 발화를 작은 음성 LID(whisper tiny/base의 언어 확률, 섹션 2)에 넣고, 판별된 locale의 transcriber로 보낸다. 지연은 LID 시간만큼 는다.
  3. 병렬 인식: 같은 PCM을 ko_KR·ja_JP transcriber에 넣고 `.transcriptionConfidence` 평균이 높은 쪽을 고른다. 계산량이 두 배다. locale이 다른 모듈을 SpeechAnalyzer 하나에 붙일 수 있는지는 확인하지 못했다. 안 되면 analyzer를 두 개 쓴다.
- **NLLanguageRecognizer의 쓸모**: Whisper·Qwen3-ASR·SenseVoice·클라우드 같은 다국어 엔진의 결과를 검증하는 데 쓴다(예: 언어 태그는 ko인데 가나가 나오면 오인식). 혼합 문장은 가나가 조금만 있어도 ja 1.000이 된다. 그래서 판정 규칙은 NL 결과보다 한글·가나 문자 비율로 짜는 편이 해석하기 쉽다.

### Gaps
- SpeechTranscriber·DictationTranscriber의 **일본어 CER**을 공개한 자료를 찾지 못했다(한국어도 없음).
- 한국어 발화를 ja_JP 인식기에 넣거나 그 반대일 때의 출력을 실측하지 못했다(빈 결과인지, 엉뚱한 가나인지, confidence가 낮은지). 실제 전사 호출이 TCC 권한 창을 띄울 수 있어서 시험하지 않았다. 권장 시험: `say -v Kyoko`, `say -v Yuna`로 만든 짧은 문장과 본인 녹음 20~30개를 두 locale로 교차 전사해 `transcriptionConfidence`로 가를 수 있는지 본다.
- ja_JP 자산 크기와 다운로드 시간, locale이 다른 transcriber 두 개를 analyzer 하나에 붙일 수 있는지 확인하지 못했다.
- macOS 시스템 받아쓰기가 여러 언어를 자동 전환하는지 확인하지 못했다.

## 2. Whisper 계열의 일본어 성능(large-v3/turbo, kotoba-whisper, ReazonSpeech, Anime-Whisper)과 ko/ja 자동 언어 감지 신뢰도

### Takeaway
일본어에서는 Whisper large-v3가 여전히 강한 기준선이다(CER: CommonVoice 8 8.5, JSUT 7.1, FLEURS 4.97). 일본어로 증류한 kotoba-whisper-v2.0은 6.3배 빠르다. 일반 테스트셋에서는 조금 뒤지지만 대화체(ReazonSpeech)에서는 더 낫다(11.6 대 14.9). 일본어 전용 최고 정확도는 NVIDIA parakeet-tdt_ctc-0.6b-ja(JSUT 6.4, CV8 7.1)와 ReazonSpeech NeMo v2(JSUT 7.4)다. 둘 다 sherpa-onnx나 NeMo로 돌린다.

Whisper의 LID는 한국어 방송 발화에서 약 95% 맞힌다. 그래도 12초짜리 한국어를 일본어로 오인한 실제 사례가 있고, 오인하면 번역된 텍스트가 나올 수 있다. 그래서 {ko, ja}로 제한한 확률 비교, 임계값, 폴백이 필요하다.

### Cited Findings
**일본어 정확도(CER, 낮을수록 좋음)**
- kotoba-whisper-v2.0 모델 카드 표. 순서는 CommonVoice 8 ja / JSUT basic5000 / ReazonSpeech held-out이다 — [kotoba-whisper-v2.0](https://huggingface.co/kotoba-tech/kotoba-whisper-v2.0)
  - whisper-large-v3: **8.5 / 7.1 / 14.9**
  - kotoba-whisper-v2.0: 9.2 / 8.4 / **11.6**, v1.0: 9.4 / 8.5 / 12.2
  - large-v2: 9.7 / 8.2 / 28.1, medium: 11.5 / 10.0 / 33.2, small: 15.1 / 14.2 / 41.5
  - base: 28.6 / 24.9 / 70.4, tiny: 53.7 / 36.5 / 137.9
  - kotoba v2.0 사양: 756M 파라미터, large-v3 인코더 전체와 디코더 2층. ReazonSpeech "all"(720만 클립)으로 학습했다. "6.3x faster than large-v3", Apache-2.0, 일본어 전용이다. faster-whisper·ggml 변환본이 있고, v2.1에는 문장부호 파이프라인(stable-ts)이 붙는다.
- 같은 벤치마크에서 `reazon-research/reazonspeech-nemo-v2`는 **9.1 / 7.4 / 11.2**다 — [japanese-asr 벤치마크 README](https://japanese-asr-readme.static.hf.space/)
- kotoba-tech의 Hugging Face 모델 목록은 2024년에서 멈췄다. 마지막 것들은 v2.0(-ggml·-faster 포함)과 v2.1(2024-09-17), v2.2(2024-10-18), kotoba-whisper-bilingual-v1.0(일·영, 2024-09-27)이다. 2025~2026년에 나온 kotoba-whisper는 없다 — [HF API: kotoba-tech](https://huggingface.co/api/models?author=kotoba-tech)
- Mistral의 Voxtral Realtime 논문(arXiv 2602.11298v3, 2026-04-06)에는 오프라인 기준선 "Whisper"(버전은 본문에서 확인 못 함)의 값이 있다. 일본어 CER은 **4.97**(FLEURS 표 7), 15.80(Mozilla Common Voice 표 8)이다. 한국어는 **WER**로 14.30(FLEURS), 20.86(MCV)이다. 표 설명: "For Chinese and Japanese we report character error-rate (CER). For all other languages, we report WER" — [arXiv 2602.11298](https://arxiv.org/html/2602.11298)
- SenseVoice 논문의 CommonVoice 일본어 CER: Whisper-Large-V3 10.34, Whisper-Small 19.51 — [FunAudioLLM, arXiv 2407.04051](https://arxiv.org/html/2407.04051)
- turbo 관련(OpenAI, 2024-10) — [openai/whisper discussion #2363](https://github.com/openai/whisper/discussions/2363):
  - "Across languages, the turbo model performs similarly to large-v2, though it shows larger degradation on some languages like Thai and Cantonese." 일본어 수치는 그림에만 있고 본문에는 없다.
  - v3부터 한국어도 CER로 쟀다(메인테이너 jongwook 댓글).
  - 사용자 댓글(2024-10-05, 일화): large-v3로 일본어를 전사하면 관련 없는 영어 단어가 끼어드는데, v2에는 없던 문제다.
- **NVIDIA parakeet-tdt_ctc-0.6b-ja** — [HF 모델 카드](https://huggingface.co/nvidia/parakeet-tdt_ctc-0.6b-ja)
  - FastConformer TDT-CTC, 약 0.6B, CC-BY-4.0. ReazonSpeech v2.0(3만 5천 시간 이상)으로 학습했고 문장부호를 출력한다.
  - CER(TDT): JSUT basic5000 **6.4**, CommonVoice 8.0 **7.1**, CV 16.1 dev 10.1 / test 13.2, TEDxJP-10k 9.0.
- **ReazonSpeech**
  - 모델 세 가지 — [reazon-research/ReazonSpeech](https://github.com/reazon-research/ReazonSpeech):
    - `reazonspeech.k2.asr`: Next-gen Kaldi, 159M, sherpa-onnx·ONNX 사용. 일·영 이중 언어 개발 모델 "ja-en-mls-5k"가 있다.
    - `reazonspeech.nemo.asr`: FastConformer-RNNT, 619M.
    - `reazonspeech.espnet.asr`: Conformer-Transducer, 120M.
  - 모델은 Apache-2.0이다. 코퍼스는 CDLA-Sharing-1.0이지만 "利用目的は著作権法３０条の４に定める情報解析に限る"라는 제한이 붙는다 — [ReazonSpeech 프로젝트 페이지](https://research.reazon.jp/projects/ReazonSpeech/)
  - k2-v2: 159.34M Zipformer RNN-T. 약 30초까지의 클립을 처리한다 — [HF reazonspeech-k2-v2](https://huggingface.co/reazon-research/reazonspeech-k2-v2)
- **Anime-Whisper** — [litagin/anime-whisper](https://huggingface.co/litagin/anime-whisper)
  - kotoba-whisper-v2.0을 Galgame_Speech_ASR_16kHz(약 5,300시간, 375만 파일, 애니·비주얼노벨 대사)로 미세조정했다. MIT, 일본어 전용이다.
  - 처음 보는 비주얼노벨 테스트에서 평균 CER은 13.0으로, large-v3의 16.5보다 낮다.
  - 주의점: initial prompt를 넣으면 품질이 떨어지고 환각이 생긴다. 문장부호를 말의 리듬과 감정에 맞춰 달고 문장 끝 마침표는 거의 생략한다. 고유명사를 학습한 게임 속 한자로 적을 수 있다.

**Apple Silicon 속도(일본어)**
- kotoba-whisper-v2.0 ggml(`ggml-kotoba-whisper-v2.0.bin`과 `-q5_0`, 실행 옵션 `-l ja`)을 MacBook Pro M2 Pro 32GB에서 잰 값이다. 5.6분 음성을 whisper.cpp는 41초, faster-whisper는 73초, HF pipeline은 61초에 처리했다. 50.3분 음성은 whisper.cpp로 581초였다. 양자화본 결과는 원본과 "almost identical"이다 — [kotoba-whisper-v2.0-ggml](https://huggingface.co/kotoba-tech/kotoba-whisper-v2.0-ggml)

**ko/ja 자동 언어 감지(LID)**
- Solbox SceneMaker 문서의 PoC는 한국어 방송 6편, 3,115발화로 LID 정확도를 비교했다 — [Solbox LID 비교](https://doc.scenemaker.solbox.com/en/docs/poc/audio-bench/2)
  - faster-whisper large-v3-turbo: **95.2%**(원음), 93.4%(노이즈 제거).
  - SpeechBrain VoxLingua107 ECAPA: 88.9%(원음), 87.0%(노이즈 제거).
  - VoxLingua107은 ko/ja처럼 음향이 비슷한 쌍을 잘 가른다고 알려져 있지만, 이 실험에서는 Whisper가 나았다.
- 같은 팀 블로그(2026-07-10) — [Solbox 블로그](https://doc.scenemaker.solbox.com/en/blog/4):
  - "12 seconds of Korean are recognized as Japanese". 한국어 모드에서도 가나·한자가 출력됐다.
  - 대책 1: 한국어가 아닌 언어의 LID 확률이 0.5 미만이면 한국어로 강제한다.
  - 대책 2: 3초 미만 구간이 한국어가 아닌 언어로 감지되면 한국어와 감지된 언어로 **두 번 전사**해 `avg_logprob`가 높은 쪽을 쓴다. 둘 다 −0.6 미만이면 잡음으로 버린다.
  - 대책 3: 한국어 결과의 **한글 비율이 30% 미만**이면 버린다.
  - 모델은 large-v3를 썼다. turbo가 "23 times faster"였지만 정확도 손실이 컸기 때문이다.
- 언어를 잘못 감지하면 Whisper가 전사 대신 **번역한** 텍스트를 낸다는 보고가 있다(2024-06-19). 무음 구간에서 한국어를 만들어 냈다는 보고(2024-11-24)도 있다 — [OpenAI Community](https://community.openai.com/t/whisper-3-detects-incorrect-language-translates-instead-of-transcribes/828870)
- whisper.cpp C API `whisper_lang_auto_detect(..., float * lang_probs)`는 "fills the lang_probs array with the probabilities of all languages"다(배열 크기 `whisper_lang_max_id() + 1`) — [whisper.h](https://github.com/ggml-org/whisper.cpp/blob/master/include/whisper.h)
- `whisper-cpp-node` 0.2.12 README에는 `language: 'auto'`와 `detect_language?: boolean` 옵션이 있다. 언어별 확률을 돌려주는지는 적혀 있지 않다 — [npm whisper-cpp-node](https://www.npmjs.com/package/whisper-cpp-node)
- Qwen3-ASR 모델 카드의 LID 정확도(MLS/CommonVoice/MLC-SLM/FLEURS 평균): Whisper-large-v3 **94.1%**, Qwen3-ASR-0.6B 96.8%, 1.7B **97.9%**. CommonVoice만 보면 92.7%, 98.2%, 98.7%다 — [Qwen/Qwen3-ASR-1.7B](https://huggingface.co/Qwen/Qwen3-ASR-1.7B)

### Inferences
- **일본어만 볼 때 로컬 정확도 순서(추정)**: parakeet-tdt_ctc-0.6b-ja ≈ Whisper large-v3 ≈ ReazonSpeech NeMo v2 > kotoba-whisper-v2.0 > large-v3-turbo(추정) > medium. 대화체(ReazonSpeech 도메인)에서는 ReazonSpeech로 학습한 모델이 large-v3보다 낫다(11.2~11.6 대 14.9).
- **turbo의 일본어 CER**: 수치는 확인하지 못했다. OpenAI가 "large-v2와 비슷하다"고 했으므로 CV8 기준 약 9~10%로 짐작한다.
- **Whisper 하나로 ko+ja를 받는 경우**: 일본어는 강하고 한국어는 약하다(FLEURS 한국어 WER 14.30, 기존 노트의 KsponSpeech CER 11.13). LID는 whisper.cpp `lang_probs`에서 ko와 ja 확률만 뽑아 비교하는 제한 방식으로 한다. 3초 미만 발화는 Solbox처럼 두 번 전사하거나 기본 언어로 돌아간다. 오인하면 번역문이 나올 수 있으므로, 결과에 문자 비율 검사(한글 대 가나)를 반드시 붙인다.
- **Anime-Whisper**: 성우 연기 음성에 맞춘 모델이다. 사용자 본인의 평범한 발화에는 이점이 불분명하고 문장부호 규칙도 달라서 명령 입력용으로는 권하지 않는다.
- **라이선스**: ReazonSpeech 코퍼스의 제한(저작권법 30조의4 정보 해석)은 데이터셋에 걸린 것이다. 모델(Apache-2.0)과 parakeet-ja(CC-BY-4.0, 저작자 표시)는 개인 앱에서 쓰는 데 문제없어 보인다(법률 판단 아님).

### Gaps
- large-v3-turbo의 일본어 CER을 다른 모델과 같은 표에서 잰 1차 자료를 찾지 못했다(OpenAI 그림에만 있음).
- 한국어·일본어 **짧은 발화(1~3초)** 에서 Whisper LID가 얼마나 맞는지 잰 자료가 없다(Solbox는 방송 발화 기준).
- ReazonSpeech k2-v2·espnet-v2의 CER 수치를 찾지 못했다(프로젝트 페이지는 그래프만 있음). kotoba-whisper-v2.2의 정확도 변화도 확인하지 못했다.
- M4에서 일본어 짧은 발화를 kotoba나 whisper로 처리할 때의 지연을 실측한 자료가 없다.

## 3. 일본어를 지원하는 기타 로컬 모델(Qwen3-ASR, SenseVoice, sherpa-onnx 일본어 모델, Moonshine, Dolphin 등)과 Node 바인딩·Apple Silicon 속도

### Takeaway
한 모델로 한·일을 모두 처리하는 로컬 후보는 Whisper, Qwen3-ASR, SenseVoice, Dolphin이다. 다만 언어별 강약이 엇갈린다. Qwen3-ASR는 한국어에 강하지만 일본어는 약하다. sherpa-onnx에 있는 0.6B는 FLEURS 일본어 CER 8.33이고, 1.7B(5.20)라야 Whisper(4.97)와 비슷하다. SenseVoice-Small은 가장 가볍지만 일본어 CommonVoice CER이 11.96이다.

sherpa-onnx에는 일본어 전용 고정확도 모델(parakeet-ja int8 489 MB, ReazonSpeech zipformer)이 있다. 그래서 `sherpa-onnx-node` 런타임 하나로 LID와 언어별 모델을 함께 구성할 수 있다. 일본어 네이티브 스트리밍은 Moonshine streaming-ja(MIT, 2026-08)가 새로 나왔지만 짝이 될 한국어 스트리밍 모델이 없다.

### Cited Findings
- **Qwen3-ASR 일본어 CER**(기술 보고서 부록, 순서는 0.6B / 1.7B / Flash-1208) — [arXiv 2601.21337](https://arxiv.org/html/2601.21337)
  - CommonVoice **14.96** / 11.64 / 9.31
  - MLC-SLM 14.74 / 11.80 / 9.74
  - FLEURS **8.33** / **5.20** / 3.09
  - 같은 표의 한국어: FLEURS 3.72 / 2.57 / 2.07, CV 8.48 / 5.88 / 3.82, MLC-SLM 10.31 / 8.61 / 8.09
  - 출력 형식이 `language {언어}<asr_text>{전사}`라서 인식과 LID를 한 번에 한다. Qwen3-ForcedAligner-0.6B는 일본어·한국어를 포함한 11개 언어를 지원한다.
- Qwen3-ASR는 `language` 인자에 언어 이름(예: `"English"`)을 주면 그 언어로 강제하고, `None`이면 자동 감지한다. 스트리밍은 vLLM 백엔드에서만 되고, 공식 백엔드는 transformers와 vLLM이다. Apache-2.0 — [HF Qwen3-ASR-1.7B](https://huggingface.co/Qwen/Qwen3-ASR-1.7B)
- Apple Silicon(M5 Pro) 벤치마크. Qwen3-ASR는 MLX, Whisper는 CoreML로 영어 LibriSpeech를 쟀다. Qwen3-ASR 1.7B가 WER 1.32%로 가장 정확했고, 0.6B가 RTF 0.014로 가장 빨랐다. 피크 메모리는 WhisperKit이 427 MB로 가장 적었다. 일본어·한국어 데이터는 없다 — [soniqo 벤치마크](https://soniqo.audio/ja/benchmarks/qwen3-asr-vs-whisper)
- **SenseVoice** — [arXiv 2407.04051](https://arxiv.org/html/2407.04051)
  - CommonVoice 일본어 CER: Small **11.96**, Large 9.19(Whisper-S 19.51, L-V3 10.34).
  - 한국어 CER: Small 8.28, Large 5.21(Whisper 10.48, 5.59).
  - 부록 LID 비교(Large): LID를 켜면 일본어 9.58→9.19, 한국어 5.23→5.21.
  - Small은 A800에서 10초 음성을 70 ms에 처리한다.
- sherpa-onnx C API의 오프라인 결과 구조체에는 `lang`, `emotion`, `event` 필드가 있다(SenseVoice의 언어·감정·이벤트 태그를 담음) — [sherpa-onnx c-api.h](https://github.com/k2-fsa/sherpa-onnx/blob/master/sherpa-onnx/c-api/c-api.h)
- **sherpa-onnx asr-models 릴리스의 일본어 관련 자산**(GitHub API, 2026-09-30 조회, tar.bz2 크기) — [sherpa-onnx asr-models](https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models)
  - 일본어 전용·일본어 중심:
    - `sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01`(713 MB)
    - `sherpa-onnx-zipformer-ja-en-reazonspeech-2025-01-17`(438 MB, 일·영)
    - `sherpa-onnx-nemo-parakeet-tdt_ctc-0.6b-ja-35000-int8`(489 MB, 2025-07-09)
    - `sherpa-onnx-moonshine-tiny-ja-quantized-2026-02-27`(48 MB), `sherpa-onnx-moonshine-base-ja-quantized-2026-02-27`(104 MB)
  - 스트리밍: `sherpa-onnx-streaming-zipformer-ar_en_id_ja_ru_th_vi_zh-2025-02-10`(259 MB, **한국어 없음**)
  - 한·일 모두 지원:
    - `sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2025-09-09`(166 MB)
    - `sherpa-onnx-qwen3-asr-0.6B-int8-2026-03-25`(879 MB)
    - `sherpa-onnx-whisper-turbo`(564 MB), `sherpa-onnx-whisper-large-v3`(1,068 MB), `sherpa-onnx-whisper-tiny`(116 MB)
    - `sherpa-onnx-dolphin-base/small-ctc-multi-lang-int8-2025-04-02`(81 / 192 MB)
- sherpa-onnx의 음성 LID는 Whisper tiny/base/small/medium(int8 포함)을 쓴다. 결과로 **최상위 언어 코드 하나만** 준다(확률 없음). tiny int8 예시의 RTF는 0.043이다. 문서의 예제는 Python이다 — [sherpa-onnx 음성 LID 모델](https://k2-fsa.github.io/sherpa/onnx/spoken-language-identification/pretrained_models.html)
- **Moonshine 일본어**
  - `moonshine-tiny-ja`(27M, 2025-09): FLEURS CER 17.87, CV17 18.3(Whisper Tiny 47.2 / 96.11, Whisper Medium 11.5 / 29.09). 환각과 반복 출력 경고가 있다 — [moonshine-tiny-ja](https://huggingface.co/moonshine-ai/moonshine-tiny-ja)
  - **`moonshine-streaming-small-ja`**(112.9M, **MIT**, 2026-08-23) — [moonshine-streaming-small-ja](https://huggingface.co/moonshine-ai/moonshine-streaming-small-ja):
    - 정확도: FLEURS CER **7.99**, ReazonSpeech 26.31.
    - 구조와 학습: 약 80 ms lookahead의 sliding-window 인코더. Whisper 계열이 자동으로 단 라벨 약 15.9만 시간으로 학습했다.
    - 주의점: 짧은 클립에서 반복 루프가 발화의 약 0.75%에서 생기므로 출력 길이를 제한하라고 한다.
  - HF 목록에는 `moonshine-streaming-tiny-ja`와 `-small-ja`(2026-08-24)가 있다. 한국어는 비스트리밍 `tiny-ko`, `base-ko`뿐이다 — [HF API: moonshine-ai](https://huggingface.co/api/models?author=moonshine-ai)
- **Dolphin**(DataoceanAI) — [dolphin-small](https://huggingface.co/DataoceanAI/dolphin-small)
  - 동아시아·남아시아·동남아·중동 40개 언어와 중국어 방언 22개를 지원한다(ja, ko 포함). small은 372M, Apache-2.0이고 LID 기능이 있다.
  - 언어별 수치는 없다. 전체 평균 WER은 25.2다(2025-03).
- Voxtral Realtime(오픈 웨이트, Apache-2.0)의 FLEURS 일본어 CER은 지연 480 ms에서 9.59, 960 ms에서 6.80, 2400 ms에서 5.50이다 — [arXiv 2602.11298](https://arxiv.org/html/2602.11298). vLLM에서만 돌아간다는 점은 기존 노트에 있다.

### Inferences
- **한 모델로 ko+ja를 받을 때 언어별 강약**
  - Whisper large-v3/turbo: 일본어 강, 한국어 약.
  - Qwen3-ASR: 한국어 강. 일본어는 1.7B가 Whisper와 비슷하고(FLEURS 5.20 대 4.97), sherpa에 있는 0.6B는 뚜렷이 약하다(8.33).
  - SenseVoice-Small: 두 언어 모두 중간이지만 가장 가볍고 빠르다(166 MB, `lang` 태그 제공).
  - Dolphin: 언어별 근거가 없어 보류한다.
- **sherpa-onnx-node 하나로 "LID → 언어 전용 모델" 구성이 된다.**
  - 구성 예: LID는 whisper-tiny(최상위 언어 하나만 줌)나 SenseVoice의 `lang` 태그를 쓴다. 일본어는 parakeet-tdt_ctc-0.6b-ja int8(489 MB, JSUT 6.4), 한국어는 Qwen3-ASR-0.6B int8(879 MB)이나 zipformer-korean을 쓴다.
  - 압축 자산 기준으로 약 1.5 GB이므로, 필요할 때 올리고 쉬면 내리는 방식이 좋다.
- **whisper.cpp 한 모델 구성**: large-v3-turbo 하나로 ko+ja를 받고, LID는 `lang_probs`를 ko·ja로 제한한다. 모델 하나(약 0.6~1.6 GB)라 가장 단순하다. 일본어만 더 정확하게 하려면 kotoba-whisper-v2.0 ggml(`-l ja`)을 두 번째 모델로 추가한다. kotoba는 M2 Pro에서 약 5~8배 실시간이었으므로 5초 발화는 1초 안팎일 것으로 본다(M4 실측 없음).
- **스트리밍**: 일본어 네이티브 스트리밍은 Moonshine streaming-ja(MIT)와 sherpa의 다국어 streaming zipformer(한국어 없음)뿐이다. 한국어 스트리밍은 sherpa zipformer-korean(2024)이다. 두 언어 모두 스트리밍하려면 언어마다 엔진이 다르고, 말하기 전에 언어를 정해야 한다. 푸시투토크 턴제라면 발화 단위 배치로 충분하다(기존 노트와 같은 결론).

### Gaps
- sherpa-onnx에서 parakeet-ja, ReazonSpeech zipformer, Qwen3-ASR-0.6B를 M4로 돌릴 때 짧은 발화의 지연과 메모리 실측이 없다.
- Qwen3-ASR 1.7B(일본어가 Whisper급인 크기)를 Node/Electron에서 쓸 안정적인 경로가 있는지 확인하지 못했다. MLX Swift 포트가 후보다.
- SenseVoice LID 자체의 ko/ja 혼동률 수치를 찾지 못했다.
- sherpa-onnx에서 Qwen3-ASR의 언어를 강제하거나 감지 언어를 받을 수 있는지 확인하지 못했다.
- Moonshine streaming-ja를 sherpa-onnx나 Node에서 돌릴 수 있는지 확인하지 못했다. sherpa에 있는 것은 2026-02-27의 비스트리밍 tiny/base-ja다.
- FunASR-nano(`sense-voice-funasr-nano-2025-12-17`)와 omnilingual ASR의 일본어·한국어 성능을 확인하지 못했다.

## 4. 클라우드 STT의 일본어 정확도·다국어 자동 감지·가격(OpenAI, Google Chirp 3, Deepgram, AmiVoice, ElevenLabs, Azure, Gemini 외)

### Takeaway
한 요청 안에서 한·일을 자동 판별할 수 있는 서비스는 여섯이다: OpenAI `gpt-transcribe`(`languages` 배열, 감지 언어 반환), Google Chirp 3(`language_codes` 제한 또는 `auto`), Azure(후보 최대 4개), ElevenLabs(`language_probability`), Soniox(토큰 단위 언어 태그), RTZR whisper 모델(`detect`와 후보 지정, 파일 API).

나머지는 언어를 먼저 정해야 한다. Deepgram의 코드스위칭 `multi`, AmiVoice 다국어 엔진, CLOVA의 혼합 인식(`enko`)은 한국어-일본어 혼합을 지원하지 않는다.

일본어 정확도의 독립 수치는 거의 없다. Mistral 논문(자사 모델 포함)의 FLEURS 일본어 CER은 Voxtral Mini Transcribe V2 4.14, Whisper 4.97, GPT-4o mini Transcribe 9.89, Scribe v2 Realtime 10.92 순이다. 일본어 특화인 AmiVoice는 한국어 엔진도 있고, 매월 60분 무료에 로그를 저장하면 ¥99/시간이다.

### Cited Findings
**제3자 정확도 표**(Mistral 작성, 자사 모델이 포함돼 편향 가능). 값은 일본어 CER / 한국어 WER — [arXiv 2602.11298 표 7·8](https://arxiv.org/html/2602.11298)

| 모델 | FLEURS | Mozilla Common Voice |
|---|---|---|
| Voxtral Mini Transcribe V2 | **4.14** / 12.29 | 12.87 / 20.29 |
| Whisper | 4.97 / 14.30 | 15.80 / 20.86 |
| GPT-4o mini Transcribe | **9.89** / 19.46 | 18.53 / 32.90 |
| ElevenLabs Scribe v2 Realtime | **10.92** / 11.90 | 24.70 / 26.98 |
| Voxtral Realtime(480 ms) | 9.59 / 15.74 | 20.87 / 31.37 |

**업체별**
- **OpenAI** — [OpenAI STT 가이드](https://developers.openai.com/api/docs/guides/speech-to-text)
  - `gpt-transcribe`는 `languages` 배열로 언어 힌트를 여러 개 받는다(ISO 639-1과 일부 639-3). 구형 모델은 단수 `language`를 쓰고, 두 필드를 함께 보내지 말라고 한다.
  - "The model returns the transcript and the detected languages as JSON."
  - `keywords`로 용어 힌트를 준다. 파일은 25 MB까지다.
- **Google Chirp 3** — [Chirp 3 문서](https://docs.cloud.google.com/speech-to-text/docs/models/chirp-3)
  - ja-JP와 ko-KR 모두 GA다. Recognize(1분 미만), StreamingRecognize, BatchRecognize를 지원한다.
  - `language_codes=["auto"]`로 주된 언어를 자동 판별하고, `["en-US","fr-FR"]`처럼 후보를 제한할 수도 있다(스트리밍에서도 된다고 요약됨).
  - 리전은 이 페이지 요약 기준 us·eu다. phrase set(권장 1,000개 이하)을 쓸 수 있고, ja·ko 화자 구분이 된다.
  - 다른 문서는 V2 다국어 자동 감지를 "`language_codes` 최대 3개, `long`/`short`/`telephony` 모델 전용(Chirp 3 아님), global·us·eu 리전"이라고 적었다. 모범 사례로 "The fewer language codes you specify, the higher the likelihood that Cloud Speech-to-Text successfully selects the correct one"이라고 한다 — [Google: Automatically detect language](https://docs.cloud.google.com/speech-to-text/docs/multiple-languages)
  - 두 문서의 Chirp 3 관련 서술이 서로 다르다.
- **Deepgram**
  - Nova-3는 ja와 ko 단일 언어 모델을 지원한다. 코드스위칭 `multi`(Nova-3·Flux)가 받는 언어는 "English, Spanish, French, German, Hindi, Russian, Portuguese, Japanese, Italian, and Dutch"다. **일본어는 있고 한국어는 없다** — [Deepgram 모델·언어](https://developers.deepgram.com/docs/models-languages-overview)
  - Nova-3에 ja·ko를 포함한 11개 언어가 추가됐다(글 날짜는 "October 29"이고 연도 표기가 없다). 스트리밍과 배치를 모두 지원한다. keyterm prompting이 11개 언어 전체에 되고, 일본어 외래어에 특히 유용하다고 한다. 한국어는 Nova-2보다 WER이 최대 27% 줄었다 — [Deepgram 블로그](https://deepgram.com/learn/deepgram-expands-nova-3-with-11-new-languages-across-europe-and-asia)
  - 2026-08-04에 ja·ko 단일 언어 배치·스트리밍 모델이 개선됐다 — [Deepgram changelog](https://developers.deepgram.com/changelog/2026/8/4)
- **AmiVoice API**(Advanced Media, 일본어 특화)
  - 지원 언어는 일본어·영어·중국어·한국어다. 사용자 사전은 일본어(히라가나/가타카나 읽기), 중국어, 한국어(한글 읽기)에서 되고 영어는 안 된다. 자동 문장부호는 네 언어 모두 되고, 한국어는 띄어쓰기도 넣는다 — [AmiVoice 지원 언어](https://docs.amivoice.com/en/amivoice-api/manual/supported-languages)
  - 엔진 — [AmiVoice 엔진 목록](https://docs.amivoice.com/en/amivoice-api/manual/engines):
    - 日本語E2E_汎用 `-a2-ja-general`
    - 多言語E2E_汎用 `-a2-multi-general`: **일본어·영어·중국어**만, 단어마다 언어 라벨이 붙는다. 한국어는 없다.
    - 会話_汎用 `-a-general`, 韓国語_汎用 `-a-general-ko`
    - 배치 전용 `-a2b-*`
  - 요금(세금 포함, 1초 단위, 발화 구간만 과금) — [AmiVoice API 가격](https://acp.amivoice.com/amivoice_api/price/):
    - 범용 WebSocket/동기 HTTP: 로그 저장 ¥0.0275/초(**¥99/시간**), 미저장 ¥0.04125/초(¥148.5/시간)
    - 범용 비동기 HTTP: 로그 저장 ¥0.022/초(¥79.2/시간), 미저장 ¥0.0275/초
    - "多言語" 구분: 로그 저장 ¥0.033/초, 미저장 ¥0.04125/초
    - **모든 엔진이 매월 60분 무료**
- **ElevenLabs Scribe v2 / v2 Realtime** — [ElevenLabs STT 문서](https://elevenlabs.io/docs/overview/capabilities/speech-to-text)
  - 자체 정확도 등급에서 일본어는 "Excellent (≤5% WER)", 한국어는 "Good (>10–20% WER)"이다.
  - 응답에 `language_code`와 `language_probability`가 있다.
  - keyterm은 배치 1,000개, 실시간 50개까지이고 추가 요금이 든다. 실시간 지연은 약 150 ms다.
- **Azure** — [Azure 언어 식별](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-identification) (2026-08-10 갱신)
  - 후보 언어는 at-start LID에서 최대 4개, continuous LID에서 최대 10개다.
  - "The Speech service returns one of the candidate languages provided even if those languages weren't in the audio."
  - at-start는 5초 안에 언어 하나를 정한다. "Continuous LID doesn't support changing languages within the same sentence."
  - LID를 켜면 초기 지연이 는다. continuous LID는 C#·C++·Java·JavaScript·Python SDK에서만 된다.
- **Soniox**
  - `enable_language_identification`을 켜면 토큰마다 `language` 태그가 붙는다. 문장 단위로 일관성을 지키고, 문장 안에 끼인 외국어 단어는 주 언어로 태그한다. 실시간에서는 문맥이 늘면 태그가 바뀔 수 있다. language hints와 language restrictions 기능이 있다 — [Soniox 언어 식별](https://soniox.com/docs/stt/concepts/language-identification)
  - 일본 페이지 주장: 일·영이 문장 중간에 바뀌어도 자동으로 감지한다. 요금은 비동기 약 $0.10/시간, 실시간 약 $0.12/시간이고 스트리밍 지연은 200 ms 미만이다. 페이지는 AI 번역본이다 — [Soniox Japan](https://soniox.com/japan)
  - **주의**: 이 페이지의 "일본어" 오류율 표(Azure 1.21, Soniox 1.25 … OpenAI 3.24)는 한국 페이지의 "한국어 CER" 표와 숫자가 완전히 같다 — [Soniox Korea](https://soniox.com/korea). 언어별 측정값으로 믿기 어렵다.
- **RTZR(리턴제로)**
  - 파일 API의 `model_name`은 두 가지다. `sommers`(기본값)는 **ko와 ja**를 지원한다. `whisper`는 `ko`, `ja`, `detect`, `multi`를 받고 `language_candidates`로 후보를 준다(예: ["ko","ja","zh","en"]). `keywords` 부스팅이 있다 — [RTZR 파일 STT](https://developers.rtzr.ai/docs/stt-file/)
  - 스트리밍(gRPC/WebSocket) 모델은 `sommers_ko`, **`sommers_ja`**, `whisper`(한국어 강화, `language` 기본값 ko)다. 키워드 부스팅은 sommers_ko나 whisper(ko)에서만 된다. 스트리밍에서 자동 감지가 되는지는 문서에 없다 — [RTZR 스트리밍 STT](https://developers.rtzr.ai/docs/stt-streaming/)
  - 회사 소개(2차 자료): "국내 최고 수준의 한국어/일본어 음성인식 정확도" — [innoforest](https://www.innoforest.co.kr/company/CP00001923/%EB%A6%AC%ED%84%B4%EC%A0%9C%EB%A1%9C)
- **NAVER CLOVA Speech**
  - 일본어는 단문(60초 이하), 장문, 스트리밍을 모두 지원한다. 동시 인식은 "Korean/English"(장문)뿐이다 — [CLOVA Speech 사양](https://guide.ncloud-docs.com/docs/en/clovaspeech-spec)
  - 언어 코드는 ko-KR, en-US, enko, ja, zh-cn, zh-tw다(검색 요약) — [LiveKit CLOVA 문서](https://docs.livekit.io/agents/integrations/stt/clova)
- **Mistral Voxtral Transcribe 2**(2026-02-04) — [Mistral 발표](https://mistral.ai/news/voxtral-transcribe-2)
  - Voxtral Mini Transcribe V2는 API 전용이고 **$0.003/분**이다. 13개 언어(ja·ko 포함)를 지원한다.
  - context biasing은 단어·구 최대 100개다. 영어에 최적화돼 있고 다른 언어는 "experimental"이다. 한 번에 최대 3시간을 처리하고 화자 구분이 된다.
  - Voxtral Realtime은 오픈 웨이트이고 API는 $0.006/분이다.
  - 언어 자동 감지나 코드스위칭에 대한 언급은 없다.
- **Gemini 3.5 Transcribe**: 자동 언어 감지와 무료 티어는 기존 노트 섹션 3에 있다. 2026-08-26부터 공개 프리뷰라는 2차 자료가 있다 — [orcarouter 블로그(검색 요약)](https://www.orcarouter.ai/blog/gemini-3-5-transcribe-vs-whisper-large-v3-turbo). 일본어 정확도 수치는 찾지 못했다.

### Inferences
- **한 요청에서 ko/ja 자동 판별**
  - 되는 곳과 설정:
    - OpenAI `gpt-transcribe`: `languages: ["ko","ja"]`
    - Chirp 3: `language_codes`를 ko-KR과 ja-JP로 제한(후보가 적을수록 정확하다는 권고와 맞음)
    - Azure: at-start 후보 2개
    - ElevenLabs: 확률을 돌려주므로 임계값 적용 가능
    - Soniox: 토큰 단위 태그
    - RTZR: whisper 모델 `detect`와 후보 지정(파일 API)
  - 언어를 **먼저 정해야** 하는 곳:
    - Deepgram: ko가 `multi`에 없다.
    - AmiVoice: 한국어는 별도 엔진이고, 다국어 엔진에 ko가 없다.
    - CLOVA: 혼합 인식은 `enko`뿐이다.
    - RTZR sommers와 RTZR 스트리밍
    - Voxtral: 감지 기능이 문서에 없다.
- **일본어 품질 기대치(근거 약함)**: 독립 수치는 Mistral 표 하나뿐이다. 거기서 일본어는 Voxtral V2와 Whisper가 GPT-4o mini와 Scribe RT보다 두 배 가까이 좋았다. 하지만 다음 모델들의 일본어 수치는 없어 직접 재야 한다: 신형 gpt-transcribe, Scribe v2 배치, Chirp 3, Azure, AmiVoice, Deepgram Nova-3 ja. ElevenLabs의 자체 등급(일본어 5% 이하)은 Mistral이 잰 Realtime 수치(10.92)와 맞지 않는다. 배치와 실시간, 자체 측정과 제3자 측정의 차이로 보인다.
- **비용**: 요금은 언어와 무관하므로 기존 노트 섹션 3의 월 15시간 비용표를 그대로 쓴다. 새로 추가된 두 곳은 다음과 같다.
  - Voxtral Mini Transcribe V2: $2.7
  - AmiVoice 범용: (15시간 − 무료 1시간) × ¥99 = **약 ¥1,386**(로그 저장), 미저장 시 ¥2,079. 발화 구간만 과금하므로 실제로는 더 적을 수 있다.
- **한·일 모두 특화 업체 한 곳으로 끝내는 후보**: RTZR이 거의 유일하다(스트리밍 sommers_ko/sommers_ja, 배치 whisper detect). 일본어 품질은 업체 주장뿐이다.

### Gaps
- gpt-transcribe, Scribe v2(배치), Chirp 3, Azure ja-JP, AmiVoice, Deepgram Nova-3 ja, Gemini 3.5 Transcribe, RTZR sommers_ja의 일본어 CER을 같은 데이터셋에서 비교한 독립 벤치마크를 찾지 못했다.
- AmiVoice의 "多言語" 요금 구분에 韓国語_汎用(`-a-general-ko`)이 들어가는지, 그 한국어 엔진이 얼마나 정확한지 확인하지 못했다.
- Deepgram 11개 언어 추가 글의 연도를 확인하지 못했다. changelog 2025-10-29 항목은 self-hosted 릴리스뿐이었다.
- Chirp 3의 리전(기존 노트는 asia-northeast1, 이번 요약은 us·eu)과 자동 감지가 적용되는 범위를 두고 문서끼리 충돌한다.
- OpenAI가 감지 언어를 줄 때 확률도 주는지, Voxtral API에 언어 인자가 있는지 확인하지 못했다.

## 5. 이중 언어(ko+ja) 설계: 자동 언어 식별 vs 캐릭터별 언어 설정 vs UI 토글, 혼합 발화, 신뢰도 임계값

### Takeaway
푸시투토크의 짧은 발화에서는 명시적 언어 선택을 기본으로 한다. 캐릭터별 기본 언어를 두고 단축키나 토글로 바꾸는 방식이다. 자동 감지는 보조로 쓴다. {ko, ja}로 제한한 LID, 신뢰도 임계값, 폴백(캐릭터 기본 언어나 직전 언어), 문자 비율 검사를 함께 둔다.

문장 안에서 두 언어가 섞이는 코드스위칭은 대부분 엔진이 지원하지 않는다(Azure는 명시적으로 불가). 토큰 단위 태깅을 내세우는 Soniox가 예외지만, 한·일 혼합을 검증한 자료는 없다. 그래서 혼합 발화는 주 언어 하나로 받고, 상대 언어의 고유명사는 사용자 사전이나 키워드로 보정하는 것이 현실적이다.

### Cited Findings
- Apple SpeechTranscriber는 인스턴스마다 locale 하나만 받는다 — [Apple: SpeechTranscriber](https://developer.apple.com/documentation/speech/speechtranscriber). 음성 LID는 따로 붙여야 한다 — [Itsuki, Medium(검색 요약)](https://medium.com/@itsuki.enjoy/swift-speechtranscriber-support-multi-language-without-manual-locale-switching-b626b547bd74)
- 텍스트 LID는 한글과 가나를 완벽히 가르지만 혼합문은 하나로 뭉갠다("오늘 ありがとう 했어" → ja 1.000). 한자만 있는 짧은 말은 제약이 없으면 zh-Hans로 간다("今日") — 로컬 실측
- Azure는 후보에 없는 언어로 말해도 후보 중 하나를 반환한다. at-start LID는 5초 안에 정한다. continuous LID도 문장 안에서 언어가 바뀌는 것은 지원하지 않는다 — [Azure 언어 식별](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-identification)
- Google은 후보 언어를 최소로 줄이라고 권한다. 후보가 적을수록 정답을 고를 가능성이 높기 때문이다 — [Google: Automatically detect language](https://docs.cloud.google.com/speech-to-text/docs/multiple-languages)
- Solbox의 운영 규칙은 다음과 같다 — [Solbox 블로그](https://doc.scenemaker.solbox.com/en/blog/4)
  - 비주력 언어의 LID 확률이 0.5 미만이면 주력 언어로 강제한다.
  - 3초 미만 구간은 두 언어로 전사해 `avg_logprob`가 높은 쪽을 쓴다. 둘 다 −0.6 미만이면 버린다.
  - 한글 비율이 30% 미만인 한국어 결과는 버린다.
- Whisper가 언어를 잘못 감지하면 전사 대신 번역문을 낸다 — [OpenAI Community](https://community.openai.com/t/whisper-3-detects-incorrect-language-translates-instead-of-transcribes/828870)
- 확률을 주는 API는 둘이다. whisper.cpp `lang_probs`(모든 언어의 확률) — [whisper.h](https://github.com/ggml-org/whisper.cpp/blob/master/include/whisper.h). ElevenLabs `language_probability` — [ElevenLabs STT](https://elevenlabs.io/docs/overview/capabilities/speech-to-text). sherpa-onnx Whisper LID는 최상위 언어 하나만 준다 — [sherpa-onnx LID](https://k2-fsa.github.io/sherpa/onnx/spoken-language-identification/pretrained_models.html)
- LID 정확도(4개 데이터셋 평균): Qwen3-ASR-1.7B 97.9%, 0.6B 96.8%, Whisper-large-v3 94.1% — [HF Qwen3-ASR-1.7B](https://huggingface.co/Qwen/Qwen3-ASR-1.7B). SenseVoice는 LID 사용 여부에 따른 CER 차이가 작다(ja 9.58→9.19) — [arXiv 2407.04051](https://arxiv.org/html/2407.04051)
- 코드스위칭 지원 범위:
  - Soniox: 토큰 단위 언어 태그. 문장에 끼인 외국어 단어는 주 언어로 태그한다 — [Soniox 언어 식별](https://soniox.com/docs/stt/concepts/language-identification)
  - Deepgram `multi`: 일본어는 포함, 한국어는 제외 — [Deepgram](https://developers.deepgram.com/docs/models-languages-overview)
  - AmiVoice 다국어 엔진: 일본어·영어·중국어만 — [AmiVoice 엔진](https://docs.amivoice.com/en/amivoice-api/manual/engines)
  - CLOVA: 한국어/영어 동시 인식만 — [CLOVA 사양](https://guide.ncloud-docs.com/docs/en/clovaspeech-spec)
- 용어 보정 수단(두 언어의 고유명사용):
  - AmiVoice 사용자 사전(일본어는 가나 읽기, 한국어는 한글 읽기) — [AmiVoice 지원 언어](https://docs.amivoice.com/en/amivoice-api/manual/supported-languages)
  - OpenAI `keywords` — [OpenAI STT 가이드](https://developers.openai.com/api/docs/guides/speech-to-text)
  - Deepgram keyterm(일본어 외래어) — [Deepgram 블로그](https://deepgram.com/learn/deepgram-expands-nova-3-with-11-new-languages-across-europe-and-asia)
  - Chirp 3 phrase set — [Chirp 3](https://docs.cloud.google.com/speech-to-text/docs/models/chirp-3)
  - RTZR keywords(한국어만) — [RTZR 스트리밍](https://developers.rtzr.ai/docs/stt-streaming/)
  - Anime-Whisper는 initial prompt를 쓰면 환각이 생긴다 — [anime-whisper](https://huggingface.co/litagin/anime-whisper)

### Inferences
**선택 방식 비교(추론)**

| 방식 | 장점 | 단점 | 이 앱에서의 역할 |
|---|---|---|---|
| UI 토글이나 단축키 두 개(예: ⌥⇧Space=한국어, 다른 조합=일본어) | 오인식 0, 지연 0, Apple·특화 엔진 모두 쓸 수 있음 | 사용자가 매번 의식해야 함 | 기본 수단 |
| 캐릭터별 기본 언어(한 캐릭터는 한국어, 다른 캐릭터는 일본어로 듣기) | 캐릭터 설정과 자연스럽게 맞음, 추가 조작 없음 | 같은 캐릭터에게 두 언어를 섞어 쓰면 틀림 | 폴백 기본값 |
| 자동 LID({ko, ja} 제한) | 조작 없음 | 1초 안팎의 발화("네", "はい", 이름 부르기)에서 불안정, 오인하면 번역문이나 엉뚱한 문자가 나옴 | 설정에서 켜는 보조 모드 |
| 두 언어 병렬 인식 후 선택 | LID 모델 불필요(Apple 경로에 적합) | 계산량 두 배, 신뢰도 비교 방식 미검증 | 실험용 |

**자동 모드의 시작 정책(임계값은 실측으로 조정할 출발점, Solbox 수치를 준용)**
1. 발화가 약 0.8초보다 짧으면 LID를 건너뛰고 캐릭터 기본 언어나 직전 언어를 쓴다.
2. `lang_probs`에서 p(ko)와 p(ja)만 떼어 둘의 합으로 나눠 정규화한다. 큰 쪽이 0.85 이상이면 채택한다.
3. 0.5~0.85이거나, 3초 미만인데 기본 언어가 아니면 두 언어로 모두 전사한다. Whisper는 `avg_logprob`, Apple은 confidence가 높은 쪽을 쓴다. 둘 다 −0.6 미만이면 버린다.
4. p(ko)+p(ja)가 0.5 미만이면(다른 언어나 잡음으로 판단) 기본 언어로 처리하고 "다시 말해 주세요"를 띄운다.
5. 사후 검사: 한국어 결과는 한글 비율 30% 이상이어야 한다(Solbox). 일본어 결과는 가나가 있어야 한다(가나 없이 한자만 나오면 중국어 환각일 수 있음). 통과하지 못하면 반대 언어로 다시 전사한다.
6. 기존 노트의 전송 규칙(작업 지시는 확인 후 전송, 잡담은 자동 전송)에 LID 신뢰도를 묶는다. 자동 모드에서 2~4단계를 거친 발화는 잡담이라도 입력창에 채워 확인받는다.

**UX 제안**
- 전사 결과 옆에 KO/JA 배지를 둔다. 누르면 보관해 둔 마지막 PCM을 다른 언어로 다시 전사한다. 발화 버퍼를 몇 초만 들고 있으면 되고, 오인식 복구 비용이 가장 낮다.
- 캐릭터마다 마지막으로 쓴 언어를 기억해 다음 기본값으로 쓴다.
- 캐릭터 이름처럼 두 언어에 걸친 고유명사는 두 문자 표기(예: 한글과 가나)를 모두 키워드나 사전에 넣는다.

**혼합 발화 처리**
- 문장 하나에 한·일이 섞이면 대부분 엔진은 주 언어 하나로 적는다. Whisper는 상대 언어 부분을 번역하거나 음차할 위험이 있다.
- 꼭 필요하면 Soniox(토큰 태그)나 LLM 기반 전사(`gpt-transcribe`에 `languages: ["ko","ja"]`)를 시험한다. 나머지는 "주 언어로 받고 고유명사는 사전으로 보정"한다.
- Claude에 넘기는 단계는 혼합 텍스트를 잘 이해하므로, 전사가 조금 틀려도 의미 전달에는 큰 문제가 없다(추론).

### Gaps
- 한·일 **문장 안 코드스위칭**을 평가한 자료(학술·업체 모두)를 찾지 못했다. Soniox·Deepgram·AmiVoice의 코드스위칭 사례는 일·영이나 영어 중심이다.
- 1~3초 발화에서 ko/ja LID 정확도를 잰 자료(Whisper, SenseVoice, Qwen3-ASR, 클라우드)가 없다. 임계값 0.85와 0.8초는 근거 없는 출발점이다.
- OpenAI와 Chirp 3가 감지 언어의 신뢰도 점수를 주는지 확인하지 못했다(ElevenLabs만 확인).

## 6. ko+ja 추천 매트릭스: 최선의 온디바이스 / 클라우드 / 제로셋업(주의점 포함)

### Takeaway
- **제로셋업**: Apple SpeechTranscriber다(ko_KR 설치됨, ja_JP는 한 번 다운로드). 캐릭터나 단축키로 언어를 고르는 방식으로 붙인다.
- **온디바이스 정확도**, 두 구성 중 고른다:
  - 단순: whisper.cpp large-v3-turbo 하나에 `lang_probs` 제한 LID를 붙인다. 일본어는 강하고 한국어는 중간이다.
  - 언어별 최적: sherpa-onnx-node에서 LID를 거쳐 일본어는 parakeet-ja, 한국어는 Qwen3-ASR-0.6B로 보낸다.
- **클라우드**, 목적별로 고른다:
  - 자동 감지가 한 번에 되고 연동이 쉬운 곳: OpenAI `gpt-transcribe`(`languages`·`keywords`).
  - 가장 싸고 FLEURS 일본어가 강한 곳: Voxtral Mini Transcribe V2($0.003/분, 감지 기능 미확인).
  - 한국어 품질과 일본어를 함께 원하면: RTZR(sommers_ko/ja).
  - 일본어 특화: AmiVoice(월 60분 무료, 한국어 엔진은 따로).
- 어느 경우든 일본어·한국어 짧은 발화 50~100개로 직접 재 보기 전까지는 잠정 순위다.

### Cited Findings
- Apple: ja_JP 지원(미설치, `supported`), ko_KR 설치, 예약 한도 5개, SFSpeechRecognizer(ja-JP)는 이 Mac에서 온디바이스 불가 — 로컬 실측. SpeechTranscriber는 locale 하나만 받는다 — [Apple 문서](https://developer.apple.com/documentation/speech/speechtranscriber)
- Whisper 일본어: CV8 8.5, JSUT 7.1 — [kotoba-whisper-v2.0](https://huggingface.co/kotoba-tech/kotoba-whisper-v2.0). FLEURS 일본어 CER 4.97, 한국어 WER 14.30 — [arXiv 2602.11298](https://arxiv.org/html/2602.11298). whisper.cpp `lang_probs` — [whisper.h](https://github.com/ggml-org/whisper.cpp/blob/master/include/whisper.h)
- parakeet-ja: JSUT 6.4, CV8 7.1, CC-BY-4.0 — [HF](https://huggingface.co/nvidia/parakeet-tdt_ctc-0.6b-ja). sherpa int8 자산은 489 MB — [sherpa-onnx asr-models](https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models)
- Qwen3-ASR-0.6B: FLEURS 일본어 8.33, 한국어 3.72(CER) — [arXiv 2601.21337](https://arxiv.org/html/2601.21337)
- SenseVoice-Small: CommonVoice 일본어 11.96, 한국어 8.28(CER), 언어 태그 제공, int8 166 MB — [arXiv 2407.04051](https://arxiv.org/html/2407.04051), [sherpa-onnx asr-models](https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models)
- Moonshine streaming-small-ja: MIT, FLEURS 7.99 — [HF](https://huggingface.co/moonshine-ai/moonshine-streaming-small-ja)
- OpenAI `gpt-transcribe`: `languages` 배열, 감지 언어 반환, `keywords` — [OpenAI STT 가이드](https://developers.openai.com/api/docs/guides/speech-to-text)
- Voxtral Mini Transcribe V2: $0.003/분, ja·ko 지원, FLEURS 일본어 4.14 / 한국어 WER 12.29 — [Mistral](https://mistral.ai/news/voxtral-transcribe-2), [arXiv 2602.11298](https://arxiv.org/html/2602.11298)
- RTZR: sommers(ko·ja), 스트리밍 sommers_ko/sommers_ja, whisper `detect` — [RTZR 파일](https://developers.rtzr.ai/docs/stt-file/), [RTZR 스트리밍](https://developers.rtzr.ai/docs/stt-streaming/)
- AmiVoice: 월 60분 무료, ¥99/시간(로그 저장), `-a-general-ko` 한국어 엔진, 다국어 E2E 엔진에 ko 없음 — [가격](https://acp.amivoice.com/amivoice_api/price/), [엔진](https://docs.amivoice.com/en/amivoice-api/manual/engines)
- Soniox: 토큰 단위 언어 태그, 실시간 약 $0.12/시간 — [Soniox 언어 식별](https://soniox.com/docs/stt/concepts/language-identification), [Soniox Japan](https://soniox.com/japan)
- ElevenLabs: 일본어 Excellent / 한국어 Good 등급, `language_probability` — [ElevenLabs STT](https://elevenlabs.io/docs/overview/capabilities/speech-to-text)
- Deepgram: ja·ko 단일 언어는 되고, `multi`에 ko가 없다 — [Deepgram](https://developers.deepgram.com/docs/models-languages-overview)

### Inferences
**추천 매트릭스(추론 — 한·일 실측 전의 잠정 순위)**

| 구분 | 1순위 | 대안 | 이유 / 주의 |
|---|---|---|---|
| 제로셋업(키 없음, 앱에 모델 파일 없음) | Apple SpeechTranscriber(ko_KR + ja_JP) Swift 헬퍼, **언어는 캐릭터별 기본값 + 단축키로 고름** | macOS 시스템 받아쓰기(일본어 온디바이스 지원 목록에 있음), `yap dictate --locale ja-JP` | ja_JP 자산을 한 번 받아야 함. 자동 LID가 없어 병렬 인식이나 whisper-tiny LID를 붙여야 자동 모드 가능. 한·일 정확도 모두 미공개 |
| 온디바이스·단순 | whisper.cpp **large-v3-turbo** 하나 + `lang_probs`로 {ko, ja}만 비교 + Solbox식 폴백 | 일본어 품질을 올리려면 kotoba-whisper-v2.0 ggml을 일본어 전용으로 추가 | 모델 하나로 끝남. 일본어는 강하고(large-v3 CER 7~8.5) 한국어는 약함(FLEURS WER 14.3, Kspon CER 11.1). 오인하면 번역문이 나올 수 있어 문자 비율 검사 필수 |
| 온디바이스·언어별 최적 | **sherpa-onnx-node**: LID(whisper-tiny 또는 SenseVoice 태그) → 일본어 parakeet-tdt_ctc-0.6b-ja int8, 한국어 Qwen3-ASR-0.6B int8 | 일본어는 ReazonSpeech zipformer, 한국어는 zipformer-korean. 가볍게 가려면 SenseVoice-Small 하나(166 MB)로 두 언어 | 런타임 하나에 모델 자산 약 1.5 GB(압축 기준), 필요할 때 올리고 내림. parakeet-ja는 CC-BY 표시. Qwen3-ASR-0.6B는 일본어에 쓰지 않음(FLEURS 8.33으로 약함) |
| 온디바이스 스트리밍(부분 결과) | 일본어 Moonshine streaming-small-ja(MIT) / 한국어 sherpa streaming zipformer-korean | 스트리밍 없이 VAD 후 배치(권장) | 언어를 먼저 정해야 함. Moonshine의 Node 경로 미확인, 짧은 클립 반복 루프 주의 |
| 클라우드·한 요청 자동 감지 | **OpenAI `gpt-transcribe`**(`languages:["ko","ja"]`, `keywords`, 감지 언어 반환) | Soniox(토큰 단위 LID, 가장 쌈), ElevenLabs Scribe v2(`language_probability`), Chirp 3(`language_codes` 두 개), Azure(at-start 후보 두 개, F0 무료) | 신형 모델의 일본어 수치 없음. 구형 GPT-4o mini의 FLEURS 일본어 9.89는 Whisper 4.97보다 나빴음 |
| 클라우드·최저가와 일본어 FLEURS 최상 | **Voxtral Mini Transcribe V2**($0.003/분) | Voxtral Realtime API($0.006/분) | Mistral이 잰 수치(편향 가능). 자동 감지와 한국어 용어 보정(experimental) 미확인 |
| 클라우드·한국어 특화 + 일본어 | **RTZR**(스트리밍 sommers_ko / sommers_ja, 파일 whisper `detect`) | NAVER CLOVA Speech(ja 지원, 혼합 인식은 enko뿐) | 무료 10시간(기존 노트). 일본어 품질은 업체 주장뿐. 키워드 부스팅은 한국어만 |
| 클라우드·일본어 특화 | **AmiVoice API**(日本語E2E_汎用, 월 60분 무료, ¥99/시간 로그 저장) | 한국어는 같은 계정의 `-a-general-ko` | 한·일 자동 감지 없음(다국어 엔진은 ja/en/zh). 로그를 저장하지 않으면 ¥148.5/시간. 일본 국내 처리 |
| 트리거 / 언어 선택 UX | 푸시투토크 단축키를 **언어별 두 개** 또는 캐릭터별 기본 언어 + KO/JA 배지(누르면 반대 언어로 재전사) | 설정에서 "자동" 모드(LID + 임계값) | 짧은 발화에서는 명시적 선택이 가장 정확. 혼합 발화는 주 언어로 받고 고유명사는 사전으로 보정 |

**도입 순서(추론)**
1. 기존 노트의 1단계인 Apple 헬퍼에 ja_JP transcriber를 추가한다. 언어는 단축키나 캐릭터로 고른다.
2. 한국어·일본어 짧은 명령과 잡담을 각각 50개씩 녹음해 비교한다. 대상은 Apple(ko/ja), whisper-turbo(+LID), parakeet-ja, Qwen3-ASR-0.6B, SenseVoice, 그리고 선택적으로 gpt-transcribe, Voxtral V2, RTZR이다. 볼 지표는 CER, 지연, LID 정답률이다.
3. Apple 일본어가 약하면 일본어만 parakeet-ja(sherpa)나 kotoba ggml로 바꾼다. 한국어는 기존 노트의 결론을 따른다.
4. 자동 모드는 2단계에서 LID 정답률이 충분할 때만 켠다.

### Gaps
- 이 매트릭스의 순위는 서로 다른 데이터셋과 업체 벤치마크를 이어 붙인 것이다. 짧은 명령, 개발 용어가 섞인 구어, 맥 내장 마이크라는 실제 사용 조건에서 한·일을 함께 잰 비교는 없다.
- Apple SpeechTranscriber의 일본어·한국어 정확도와, 두 locale을 병렬로 돌려 confidence로 가르는 방식이 통하는지가 제로셋업 경로의 가장 큰 미확인 변수다.
- 사용자가 두 캐릭터에게 언어를 나눠 쓰는지, 한 캐릭터에게 두 언어를 섞어 쓰는지(요구사항) 모른다. 이에 따라 기본 방식(캐릭터별 언어인지 자동 LID인지)이 달라진다.
