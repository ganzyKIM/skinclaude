# 픽셀아트 마스코트(초텐·아메)의 오리지널 합성 음성과 2D 스프라이트 립싱크

_조사 기준일 2026-09-30. 버전·날짜는 각 출처 기준. "(검색 요약)"은 원문 페이지를 직접 열지 못하고 검색 결과 요약으로만 확인한 항목이며, 신뢰도가 한 단계 낮다._

## 1. 실존 인물 복제 없이 두 캐릭터용 오리지널 한국어 목소리를 설계하고 세션 간 일관성을 유지하는 방법

### Takeaway
2025–2026년에는 "텍스트 설명으로 새 목소리 만들기"가 상용 벤더와 오픈소스 양쪽에서 실용 단계에 들어섰다. 한국어, 감정 태그, 립싱크용 타임스탬프를 한 곳에서 모두 주는 조합은 ElevenLabs(Voice Design v3로 설계 → voice_id 저장 → `eleven_v3` + with-timestamps)가 가장 완결적이다. 저예산·단순 구현은 OpenAI `gpt-4o-mini-tts`(고정 보이스 + instructions), 한국어 전용 감정 프리셋은 Azure MAI-Voice-2 ko-KR(프리뷰)·Typecast·CLOVA Voice, 완전 로컬은 Qwen3-TTS VoiceDesign(Apache-2.0)이 후보다. 일관성은 "저장된 보이스 ID/고정 프리셋 + 고정 연기 지시문 + 모델 스냅샷 고정 + 생성 오디오 캐시"로 확보한다. Supertone API는 2026-08-31에 종료되어 후보에서 빼야 한다.

### Cited Findings

#### ElevenLabs (Voice Design / v3 / v4)
- Voice Design v3는 2025-06-25 발표. 설명문 하나로 후보 3개를 만들고, 그중 하나를 골라 바로 쓴다. 프롬프트에 "perfect audio quality" 같은 품질 문구와 나이·억양/국적·성별·톤/감정·속도를 넣으라고 권장한다(예: "Perfect audio quality. Elderly male, thick Scottish accent, slow and reflective, gravelly timbre."). "elves to elder gods" 같은 캐릭터 보이스도 공식 용도로 명시한다 — [ElevenLabs 블로그: Introducing Voice Design v3](https://elevenlabs.io/blog/voice-design-v3)
- API는 2단계다. 프롬프트로 프리뷰를 만들고, 고른 프리뷰의 `generated_voice_id`로 보이스를 생성해 라이브러리에 저장한다 — [ElevenLabs Voice Design 가이드](https://elevenlabs.io/docs/eleven-api/guides/how-to/voices/voice-design)
- 설계 API 파라미터 — [API 레퍼런스: Design a voice](https://elevenlabs.io/docs/api-reference/text-to-voice/design)
  - `model_id`: `eleven_multilingual_ttv_v2`(기본) 또는 `eleven_ttv_v3`
  - 프리뷰 `text`: 100–1000자
  - `seed`: "Same seed with same inputs produces same voice"
  - `guidance_scale`(프롬프트 추종 강도): 기본 5
  - `loudness`: -1~1, 0 ≈ -24 LUFS
  - `reference_audio_base64`, `prompt_strength`: `eleven_ttv_v3` 전용
  - `remixing_session_id`: 리믹스용
  - 응답 `previews[]`: `generated_voice_id`, `audio_base_64`, `duration_secs`, `language`
- 모델 현황(문서 기준) — [ElevenLabs Models](https://elevenlabs.io/docs/overview/models)
  - `eleven_v3`: 70개 이상 언어(한국어 포함), 요청당 5,000자
  - `eleven_v4`: 90개 이상 언어(한국어 포함), 10,000자
  - `eleven_flash_v2_5`: 32개 언어, 약 75ms
  - 설계용 모델: `eleven_ttv_v3`, `eleven_multilingual_ttv_v2`
- Eleven v4 / v4 Turbo는 2026-09-28 changelog에 출시로 올라왔다 — [ElevenLabs changelog 2026-09-28](https://elevenlabs.io/docs/changelog/2026/9/28)
  - 90개 이상 언어, v4 Turbo 중앙값 추론 지연 약 100ms
  - TTS와 Text to Dialogue에 "Convert with timestamps", "Stream with timestamps" 제공
  - Text to Dialogue에 `previous_text`, `future_text`, `previous_request_ids`, `next_request_ids` 같은 연속성 파라미터 추가
- v4 문서 내용 — [ElevenLabs Eleven v4 문서](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4)
  - 오디오 태그(`[whispering]`, `[shouting]`, `[laughing]`)를 지원하지만 "not perfect yet"
  - Style·Speed 슬라이더 없음, SSML 미지원
  - **Voice Design으로 만든 보이스는 v4에서도 동작하지만 "may not be as performative or sound as good as with earlier models"**
- v4는 "speaker identity now stable across regenerations"를 내세운다. 무료 플랜(월 10,000크레딧, 약 10분 오디오)에서도 쓸 수 있다고 한다(검색 요약) — [ElevenLabs 블로그: Eleven v4](https://elevenlabs.io/blog/eleven-v4)
- TTS 요청 파라미터: `seed`(결정적 샘플링), `previous_text`/`next_text`(앞뒤 연속성), `language_code`, `voice_settings`(`stability`, `similarity_boost`, `style`, `speed`) — [Convert with timestamps API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps)
- Voice Design 블로그는 "특정 라이선스 연기자를 재현"하는 용도에는 Professional Voice Clone이 "gold standard"라고 선을 긋는다. 즉 Voice Design은 새 목소리를 만드는 기능으로 포지셔닝되어 있다 — [ElevenLabs 블로그: Voice Design v3](https://elevenlabs.io/blog/voice-design-v3)

#### OpenAI
- `gpt-4o-mini-tts` 기능 요약 — [OpenAI TTS 가이드](https://developers.openai.com/api/docs/guides/text-to-speech)
  - 모델: `gpt-4o-mini-tts`(instructions 지원), `tts-1`, `tts-1-hd`
  - 내장 보이스 13종: alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer, verse, marin, cedar. 최고 품질로는 marin·cedar 권장
  - instructions로 "Accent, Emotional range, Intonation, Impressions, Speed of speech, Tone, Whispering" 제어
  - 언어 지원은 Whisper를 따름(한국어 포함)
  - 출력 mp3/opus/aac/flac/wav/pcm. 스트리밍 지원(가장 빠른 응답은 wav/pcm)
  - 커스텀 보이스는 화자 동의 녹음이 필요
  - 최종 사용자에게 AI 음성임을 명확히 고지해야 함
- 스냅샷과 가격 — [OpenAI 모델 페이지: gpt-4o-mini-tts](https://developers.openai.com/api/docs/models/gpt-4o-mini-tts)
  - 스냅샷: `gpt-4o-mini-tts-2025-03-20`, `gpt-4o-mini-tts-2025-12-15`(기본)
  - 텍스트 입력 $0.60/1M 토큰, 오디오 출력 $12/1M 토큰
  - 입력 최대 2000토큰, `v1/audio/speech` 전용
- 커뮤니티 계산으로는 분당 약 1.5센트다(검색 요약) — [OpenAI Community](https://community.openai.com/t/understanding-gpt-4o-mini-tts-pricing-input-characters-cost/1151816)
- 한국어 지시 추종 벤치마크(InstructTTSEval 한국어)에서 카카오 Kanana-O가 94.50, GPT-4o mini TTS가 91.10을 기록했다는 2026-08 보도가 있다(검색 스니펫) — [이데일리 영문판](https://en.edaily.co.kr/news/eda202608045300/)

#### Google Gemini TTS
- Gemini API 문서 — [Gemini API: Speech generation](https://ai.google.dev/gemini-api/docs/speech-generation)
  - 모델: `gemini-3.8-flash-tts`(최신), `gemini-3.8-flash-lite-tts`, `gemini-3.1-flash-tts-preview`, `gemini-2.5-pro-preview-tts`
  - 프리빌트 보이스 30종. 예: Kore "Firm", Puck "Upbeat", Leda "Youthful", Fenrir "Excitable", Enceladus "Breathy", Achernar "Soft"
  - 한국어를 포함한 130개 이상 언어
  - 턴 단위 연기는 `speech_metadata.style`(예: "whispering", "sarcastic"), 순간 이벤트는 `<cough>` 같은 꺾쇠 태그
  - 단일 요청에 화자 2명까지. 출력은 24kHz mono 16-bit WAV
  - 타임스탬프 기능은 문서에 언급이 없음
- Gemini 3.8 Flash TTS / Flash-Lite TTS 발표(2026-09-23) — [Google 블로그: Gemini 3.8 TTS](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-8-text-to-speech/)
  - 100개 이상 언어·방언
  - `<laughs>`, `<sigh>`, `<gasp>` 같은 발성 이벤트
  - 2,000개 이상 보이스. 자연어 프롬프트로 커스텀 보이스를 만들거나 30초 샘플로 복제
  - 2화자 장면 연출
  - 모든 오디오에 SynthID 워터마크
- Gemini 3.1 Flash TTS(2026년 4월, 검색 요약): 200개 이상의 대괄호 오디오 태그(`[whispers]`, `[happy]`), 70개 이상 언어, SynthID — [Google 블로그: Gemini 3.1 Flash TTS](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-flash-tts/). 24개 "고품질" 언어에 한국어가 포함된다는 서드파티 요약도 있다 — [Replicate README](https://replicate.com/google/gemini-3.1-flash-tts/readme)
- 태그 문법이 세대마다 다르다. 3.1은 대괄호 인라인 태그, 3.8 문서는 `speech_metadata.style`과 꺾쇠 이벤트를 쓴다 — [Gemini API 문서](https://ai.google.dev/gemini-api/docs/speech-generation)
- **상충 정보**: 한 서드파티 페이지는 "Kore"를 한국어 보이스라고 설명한다 — [AtlasCloud](https://www.atlascloud.ai/ko/models/google/gemini-2.5-flash-tts). 그러나 Google 문서에서 Kore는 "Firm" 성격의 보이스이고, 보이스는 지원 언어 안에서 언어와 무관하다 — [Gemini API 문서](https://ai.google.dev/gemini-api/docs/speech-generation)

#### Microsoft Azure Speech
- ko-KR 보이스 현황 — [Azure 언어 지원(TTS)](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)
  - 표준 뉴럴: SunHi(F), InJoon(M), BongJin(M), GookMin(M), Hyunsu(M), JiMin(F), SeoHyeon(F), SoonBok(F), YuJin(F)
  - HD: `ko-KR-SunHi:DragonHDLatestNeural`, `ko-KR-Hyunsu:DragonHDLatestNeural`
  - 멀티링구얼: `ko-KR-HyunsuMultilingualNeural`
  - 표준 ko-KR 보이스 중 스타일(express-as)을 지원하는 것은 InJoon의 `sad` 하나뿐
- MAI-Voice-2 / MAI-Voice-2-Flash(퍼블릭 프리뷰, 문서 2026-07-23 갱신) — [Microsoft Learn: MAI-Voice](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices)
  - 15개 언어, 18개 로캘
  - SSML `mstts:express-as`의 `style`/`styledegree`로 감정 제어(예시 `styledegree="1.2"`)
  - `ko-KR-Hana:MAI-Voice-2`(여성) 스타일: angry, confused, determined, embarrassed, excited, happy, hopeful, joyful, regretful, relieved, sad, softvoice, surprised
  - `ko-KR-Junho:MAI-Voice-2`(남성) 스타일: angry, confused, determined, embarrassed, excited, happy, hopeful, joyful, relieved, sad, softvoice
  - Flash 버전: `ko-KR-Haena:MAI-Voice-2-Flash`(여성, 같은 스타일 목록), `ko-KR-Junho:MAI-Voice-2-Flash`
  - 인스턴트 클로닝은 동의 절차가 딸린 게이트 접근
- **명칭 불일치**: 언어 지원 페이지는 MAI-Voice-2 여성 한국어 보이스를 `ko-KR-Haena:MAI-Voice-2`로, MAI 문서는 `ko-KR-Hana:MAI-Voice-2`로 적는다 — [언어 지원](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts) vs [MAI-Voice](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices)

#### 한국 벤더: Typecast, CLOVA Voice, Supertone
- Typecast
  - `ssfm-v30`(2026.01): 37개 언어, 감정 프리셋 `normal`, `happy`, `sad`, `angry`, `whisper`, `toneup`, `tonedown`, 그리고 문맥에서 감정을 자동 추론하는 Smart Emotion. `ssfm-v21`(2025.07)은 27개 언어·감정 4종 — [Typecast Models](https://typecast.ai/docs/models.md)
  - 앞뒤 문맥 텍스트를 함께 주면 감정 추론 정확도가 오른다(검색 요약) — [Typecast changelog](https://typecast.ai/docs/changelog)
- CLOVA Voice Premium(NCP) — [NCP CLOVA Voice Premium API](https://api.ncloud-docs.com/docs/ai-naver-clovavoice-ttspremium)
  - 한국어 화자: nara, jinho, vara, vdain, vgoeun, vmikyung, vyuna, vdaeseong 등. 아동 ndain/nhajun, 캐릭터 nmammon(악마)·nsabina(마녀)·nmeow(고양이)·nwoof(개)
  - `emotion`: 0 중립 / 1 슬픔 / 2 기쁨 / 3 분노. 지원 화자는 nara·vara·vmikyung·vdain·vyuna·vgoeun·vdaeseong이며 nara는 분노 불가
  - `emotion-strength` 0~2, `volume` -5~5
  - `speed` -5~10: -5가 2배 빠름, 10이 0.5배
  - `pitch` -5~5: **-5가 1.2배 높음**, 5가 0.8배 낮음(부호가 직관과 반대)
  - `alpha`(음색) -5~5, `end-pitch` -5~5
  - 한국어는 요청당 2,000자
- Supertone은 2026-07-15 임시주총에서 해산을 결의했다. Play·API·Voice Builder는 2026-08-31 종료됐고, Shift·Clear·Air는 Antinode Audio로 이관됐다(검색 요약) — [Music Business Worldwide](https://www.musicbusinessworldwide.com/hybe-winds-down-ai-voice-company-supertone-after-investing-nearly-35m/), [Production Expert](https://www.production-expert.com/production-expert-1/hybe-announces-transfer-of-ownership-of-some-supertone-products-including-clear-to-antinode-audio-inc). supertone.ai/ko/sunset은 antinodeaudio.com으로 리다이렉트된 뒤 404를 반환했다.

#### 오픈소스·로컬
- Qwen3-TTS(2026-01-22) — [QwenLM/Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS)
  - VoiceDesign(1.7B): 자연어 `instruct`로 음색 설계
  - CustomVoice(1.7B/0.6B): 프리셋 음색 9종. 한국어 대표는 "Sohee: Warm Korean female voice with rich emotion"
  - Base(1.7B/0.6B): `ref_audio` + `ref_text`로 3초 복제
  - 한국어를 포함한 10개 언어. 음색·감정·운율을 자연어로 제어
  - 최저 약 97ms 지연, Apache-2.0
  - CUDA·FlashAttention 중심이며 Apple Silicon 지원은 명시되지 않음
- Fun-CosyVoice3-0.5B-2512(2025-12): 한국어 포함 9개 언어, 언어·방언·감정·속도·볼륨 instruct, 제로샷·교차언어 클로닝, Apache-2.0 — [FunAudioLLM/CosyVoice](https://github.com/FunAudioLLM/CosyVoice)
- Fish Audio S1-mini(0.5B, S1 4B의 증류판) — [fishaudio/s1-mini README](https://huggingface.co/fishaudio/s1-mini/blob/main/README.md)
  - 한국어 포함 13개 언어
  - 감정 마커: `(angry) (sad) (disdainful) (excited) (surprised) (satisfied) (unhappy) (anxious)` … `(joyful) (confident)`
  - 톤 마커: `(in a hurry tone) (shouting) (screaming) (whispering) (soft tone)`
  - 특수 마커: `(laughing) (chuckling) (sobbing) (crying loudly) (sighing) (panting) (groaning)`
  - 라이선스 CC-BY-NC-SA-4.0(비상업)
- GPT-SoVITS — [RVC-Boss/GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS)
  - MIT. en/ja/ko/yue/zh 지원(한국어는 v2부터)
  - 5초 제로샷, 1분 데이터로 파인튜닝
  - Apple silicon(Python 3.11/PyTorch 2.7.0) 테스트 환경이 명시되어 있으나, "Models trained with GPUs on Macs result in significantly lower quality"
  - `api.py`/`api_v2.py` 제공
  - V4는 2025-04, V2Pro는 2025-06(검색 요약) — [pyvideotrans GPT-SoVITS 가이드](https://pyvideotrans.com/en/gptsovits)
- Chatterbox Multilingual(Resemble AI): 한국어 포함 23개 언어, MIT, 감정 과장(exaggeration) 제어, 0.5B Llama 백본(검색 요약) — [DeepInfra 모델 페이지](https://deepinfra.com/ResembleAI/chatterbox-multilingual)
- Supertonic 2 — [Supertone/supertonic-2 (HF)](https://huggingface.co/Supertone/supertonic-2)
  - 66M 파라미터 온디바이스 TTS. en/ko/es/pt/fr 지원
  - ONNX Runtime. M4 Pro CPU에서 RTF 0.012(2 steps), 초당 1263자. WebGPU 테스트 있음
  - 보이스 스타일 지정(예: "M1")
  - 코드 MIT, 모델 OpenRAIL-M. 감정 제어는 언급 없음
  - Supertonic 3는 31개 언어로 확장(미러 페이지 검색 요약) — [HF supertonic-3 미러](https://huggingface.co/i2so/supertonic-3)
- Seed-VC: 1–30초 레퍼런스로 제로샷 음성 변환. 실시간 모드는 알고리즘 지연 약 300ms + 디바이스 지연 약 100ms. GPL-3.0(검색 요약) — [Seed-VC 요약 페이지](https://gittrend.io/repo/Plachtaa/seed-vc), [arXiv 2411.09943](https://arxiv.org/abs/2411.09943v1)

### Inferences
- **1순위(품질과 기능이 가장 완결적)**
  - 두 캐릭터 보이스를 `eleven_ttv_v3`로 설계하고, `voice_id` 2개를 앱 설정에 상수로 고정한다.
  - 합성은 `eleven_v3`(오디오 태그) + `convert/stream with timestamps`로 한다.
  - v4 문서가 설계 보이스는 v4에서 덜 연기적일 수 있다고 적었으므로 v4는 A/B 청취 테스트만 한다.
- **보이스 설계 프롬프트 초안**
  - 성인임을 명시해 아동 톤을 막는다. 실존 성우·배우 이름이나 "~처럼" 비교는 넣지 않는다(2절).
  - 초텐: "Perfect audio quality. Korean woman in her early twenties, bright bubbly idol-streamer energy, high clear pitch, fast upbeat pacing, playful sing-song intonation, audible smile."
  - 아메: "Perfect audio quality. Korean woman in her early twenties, low-energy dry deadpan delivery, mid-low slightly husky pitch, slow flat intonation, subtle sarcasm, small tired sighs."
  - 후보 3개 × 여러 seed로 뽑아서, 같은 한국어 테스트 문장(기쁨·삐짐·졸림 등 감정별)을 읽혀 비교 청취한 뒤 확정한다.
- **일관성 레시피**
  1. 보이스 식별자 고정: voice_id, 프리셋 이름, `gpt-4o-mini-tts-2025-12-15` 같은 스냅샷.
  2. 캐릭터별 "기본 연기 지시문"을 상수로 두고, 감정 지시만 덧붙인다.
  3. ElevenLabs `seed`를 고정한다.
  4. (텍스트, 캐릭터, 감정, 엔진 버전) 해시를 키로 오디오를 캐시한다. 반복 대사는 똑같이 재생되고 비용도 0이다.
  5. 설계 프롬프트·seed·후보 오디오 원본을 프로젝트 안에 보관해 재생성할 수 있게 한다.
- **보이스 1개로 두 캐릭터를 할지**: 원작 설정상 초텐은 아메의 방송 페르소나다(원작 설정이며 이번 조사에서 출처를 확인하지 않음). 그래서 "같은 보이스 + 연기 지시만 다르게"도 설정에 맞는 선택이다. 다만 두 캐릭터가 한 화면에서 번갈아 말하는 앱이라면, 보이스를 분리해야 귀로 구분하기 쉽다.
- **저예산 대안**: OpenAI 스냅샷을 고정하고 내장 보이스 2개를 쓴다(청취 테스트로 선택) + instructions. 타임스탬프가 없으므로 립싱크는 진폭 방식(4절)으로 한다.
- **한국어 감정 프리셋을 중시할 때**
  - Azure MAI-Voice-2 ko-KR: 프리뷰이고 여성 보이스가 1종이라, 두 캐릭터 구분은 styledegree·prosody(피치·속도)로 해야 한다.
  - Typecast 또는 CLOVA: CLOVA는 `pitch`/`alpha`/`speed`로 같은 화자에서도 두 캐릭터 톤을 벌릴 수 있다.
- **오프라인 대안**: Qwen3-TTS VoiceDesign으로 레퍼런스 클립을 한 번 만들어 저장한다. 이후에는 그 클립을 Base 모델의 복제 레퍼런스로 계속 쓰면, 매 호출마다 설계 결과가 흔들리는 문제를 피할 수 있다(추론). 맥에서의 속도는 검증이 필요하다. Supertonic은 매우 가볍지만 감정 제어·커스텀 보이스가 없고, 회사가 해산되어 유지보수가 없다.
- **"라이선스 있는 베이스 보이스 + 피치시프트/음성변환(VC)"은 비추천**
  - Web Audio 피치 변경은 칩멍크화가 심하다.
  - RVC·Seed-VC는 타깃 보이스 레퍼런스가 필요하고, 실존 인물 레퍼런스는 쓸 수 없다(2절).
  - 프롬프트 설계가 가능해진 지금은 우회로로서 가치가 낮다.

### Gaps
- ElevenLabs Voice Design에 한국어 설명문이나 한국어 프리뷰 텍스트를 넣었을 때의 품질·억양 안정성은 공식 문서에 언어별 안내가 없다.
- ElevenLabs 유료 플랜 단가, Gemini TTS·Azure MAI·Typecast·CLOVA 단가는 이번에 수집하지 못했다.
- Typecast의 감정 강도 파라미터와 타임스탬프 반환 여부는 확인하지 못했다.
- Qwen3-TTS·CosyVoice3의 Apple Silicon(MPS/MLX) 실행 성능은 공식 문서에 없다.
- 벤더 간 한국어 음질을 독립적으로 비교한 자료(MOS·아레나)는 찾지 못했다. Kanana-O 수치는 보도 스니펫만 확인했다.
- RVC의 2026년 현재 유지보수·라이선스 상태는 이번에 재확인하지 않았다.

## 2. 라이선스·동의 함정: 원작 IP(NEEDY GIRL OVERDOSE)의 팬 캐릭터에 합성 음성을 붙일 때 개인용 앱에서 되는 것과 안 되는 것

### Takeaway
텍스트로 설계한 오리지널 합성 보이스로 팬 캐릭터를 말하게 하고, 그 소리가 개인 PC 안에서만 재생된다면 벤더 약관과 한·일 규범 모두에서 위험은 낮다. 명확한 금지선은 세 가지다.
- 실존 인물의 목소리를 복제·모사하는 것. 특히 2026년 TV 애니메이션 공식 성우가 해당한다.
- 동의 없는 레퍼런스 오디오를 쓰는 것. 게임·애니 음성 추출이나 커뮤니티 "캐릭터 RVC 모델"이 여기 포함된다.
- 공개·배포할 때 원작 가이드라인과 AI 고지 의무를 무시하는 것.

원작은 2022년 발매 때 영상·방송·2차창작을 폭넓게 허용했다(스토어 링크 조건). 하지만 AI 음성에 대한 명시 조항은 확인하지 못했다.

### Cited Findings
- NGO 발매일(2022-01-21) 기사 — [電ファミニコゲーマー 2022-01-21](https://news.denfaminicogamer.jp/news/220121b)
  - 원문: 「本作の動画投稿・生配信および二次創作活動が個人・法人、営利・非営利を問わず許可されている」
  - 조건: 개요란에 스토어 페이지 링크를 기재할 것
  - 허용 예: 동영상·생방송, 노래 커버·BGM 편곡, 일러스트, 동인지, 팬 굿즈. 세부 조항은 Steam에 있다고 함
- TV 애니메이션은 2026-04-04 방영을 시작했다(Yostar Pictures). 초텐(超絶最かわてんしちゃん) 성우는 川口莉奈 — [crank-in 2026 봄 애니](https://www.crank-in.net/animation/spring2026/1963)
- 일본 성우 26명과 일본배우연합이 참여한 "NOMORE無断生成AI" 캠페인(2024-10-15 시작)은 무단 음성 생성·판매에 반대한다(검색 요약) — [アニメ!アニメ! 2024-10-16](https://animeanime.jp/article/2024/10/16/87146.html), [inside-games 2024-10-16](https://www.inside-games.jp/article/2024/10/16/160479.html)
- ElevenLabs는 공인·일반인을 가리지 않고 실존 개인 목소리를 명시적 사전 동의 없이 복제·합성하는 것을 금지한다. 선거 후보 등을 막는 "No-Go Voices" 장치도 있다 — [ElevenLabs Help: No-Go Voices](https://help.elevenlabs.io/hc/en-us/articles/22584327690897), [ConductAtlas 정책 요약](https://conductatlas.com/platform/elevenlabs/elevenlabs-usage-policy/voice-cloning-without-consent-prohibition/)(검색 요약)
- OpenAI는 최종 사용자에게 AI 음성임을 명확히 고지해야 하고, 커스텀 보이스에는 화자 동의 녹음이 필요하다 — [OpenAI TTS 가이드](https://developers.openai.com/api/docs/guides/text-to-speech)
- Azure MAI: "Only authorized, licensed voices can be synthesized in production. No unlicensed voice cloning is possible." 클로닝은 Limited Access 심사와 동의 음성 업로드를 거쳐야 한다 — [Microsoft Learn: MAI-Voice](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices)
- Gemini 오디오 모델이 생성한 모든 클립에는 SynthID 워터마크가 들어간다 — [Google 블로그: Gemini 3.8 TTS](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-8-text-to-speech/)
- 한국 부정경쟁방지법 제2조 제1호 (타)목(2022 신설)은 "국내에 널리 인식되고 경제적 가치를 가지는 타인의 성명, 초상, 음성, 서명 등"을 공정한 상거래 관행에 반하는 방법으로 "자신의 영업을 위하여 무단으로 사용"하는 행위를 부정경쟁행위로 규정한다(검색 요약) — [한경 매거진](https://magazine.hankyung.com/business/article/202410032642b), [nepla 위키: 퍼블리시티권의 보호대상](https://www.nepla.ai/wiki/지식재산/부정경쟁/퍼블리시티권의-보호대상-1509xgr62nol)
- 2026-01에 '퍼블리시티권 보호 및 이용에 관한 법률' 제정안이 대표발의됐다. AI·딥페이크의 얼굴·목소리 무단 이용 대응이 목적이다 — [헤럴드경제 2026-01-04](https://www.heraldk.com/article/2026010422393901447)
- 오픈소스 라이선스(1절 출처): Qwen3-TTS·CosyVoice는 Apache-2.0, GPT-SoVITS·Chatterbox는 MIT, Fish S1-mini는 CC-BY-NC-SA-4.0, Supertonic 모델은 OpenRAIL-M, Seed-VC는 GPL-3.0 — [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS), [CosyVoice](https://github.com/FunAudioLLM/CosyVoice), [GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS), [Fish S1-mini](https://huggingface.co/fishaudio/s1-mini/blob/main/README.md), [Supertonic 2](https://huggingface.co/Supertone/supertonic-2)

### Inferences
- **해도 되는 것**
  - 프롬프트로 설계한 오리지널 보이스, 벤더 프리셋 보이스
  - 본인 목소리(본인 동의)로 파인튜닝
  - 생성 음성을 개인 PC 안에서만 재생
  - 비상업 라이선스(CC-BY-NC-SA, OpenRAIL-M) 모델을 개인 용도로 사용
- **하면 안 되는 것**
  - 애니·게임 음성을 레퍼런스로 쓰는 것. 대상: ElevenLabs `reference_audio_base64`, Qwen3 Base 복제, GPT-SoVITS 학습, RVC·Seed-VC 타깃
  - 설계 프롬프트에 성우 이름을 쓰는 것
  - 인터넷에 도는 캐릭터 음성 모델을 받아 쓰는 것
  - 공식 성우와 "비슷하게 들리도록" 반복 조정하는 것
- **회색지대(공개할 때)**
  - 앱 화면 녹화·방송·앱 배포처럼 외부에 공개하는 경우다.
  - 2022년 기사 기준으로 NGO는 스토어 링크 조건으로 2차창작을 넓게 허용했지만, AI 음성 조항은 확인되지 않았다.
  - 공개할 때는 최신 가이드라인(Steam/공식)을 다시 확인하고 "AI 합성 음성"을 고지한다. OpenAI를 쓰면 고지는 약관상 의무다.
- **한국법 요건 검토**: 한국 (타)목은 "널리 인식된 타인"의 표지를 "영업을 위하여" 쓰는 것이 요건이다. 따라서 개인 비상업 앱에서 오리지널 보이스를 쓰는 경우는 해당 가능성이 낮다. 반면 성우 모사 음성을 공개적으로 쓰면 이 조항, 일본 성우계 규범, 벤더 약관에 동시에 걸릴 수 있다.

### Gaps
- WSS playground 공식 가이드라인 현행본은 확인하지 못했다(wss-playground.com DNS 조회 실패). Steam 상세 조항 원문, 애니메이션 방영(2026) 이후 새 가이드라인·AI 관련 조항도 미확인.
- 애니메이션판 아메 역 성우 정보는 출처에 없었다.
- ElevenLabs 등에서 생성한 오디오를 다른 모델(VC·파인튜닝)의 레퍼런스나 학습 데이터로 쓰는 것이 약관상 허용되는지는 확인하지 못했다.

## 3. 앱 감정 태그(joy/pout/shy/surprised/thinking/sleepy…)를 TTS 스타일·감정 파라미터로 매핑하는 방법

### Takeaway
엔진마다 감정 제어 방식이 다르다.
- 대괄호 인라인 태그: ElevenLabs v3, Gemini 3.1
- 구조화된 스타일 + 꺾쇠 이벤트: Gemini 3.8
- 자연어 instructions: OpenAI, Qwen3, CosyVoice3
- SSML style + styledegree: Azure MAI(한국어 여성 13종)
- 고정 프리셋: Typecast 7종, CLOVA 4종 + 피치·속도·음색
- 괄호 마커: Fish S1

그래서 앱 쪽 감정 태그는 "엔진 중립 중간표현"(emotion, intensity, 캐릭터 기본 톤)으로 유지하고, 엔진별 어댑터가 이를 변환하는 구조가 적합하다. 같은 감정이라도 초텐은 강도를 올리고 아메는 내리는 캐릭터 보정을 어댑터에 넣는다.

### Cited Findings
- ElevenLabs v3 — [ElevenLabs v3 prompting 가이드](https://elevenlabs.io/docs/best-practices/prompting/eleven-v3)
  - 태그 예: `[laughs]`, `[whispers]`, `[sighs]`, `[exhales]`, `[sarcastic]`, `[curious]`, `[excited]`, `[crying]`, `[snorts]`, `[mischievously]`
  - 말줄임표(…)는 멈춤과 무게를, 대문자는 강조를 준다
  - v3/v4에서는 SSML break 대신 구두점을 쓴다
  - 태그는 그 보이스의 학습 분포에 있는 연기일수록 잘 먹는다. 없는 연기도 따를 수 있지만 결과가 최적이 아닐 수 있다
- ElevenLabs v4 문서는 `[whispering]`, `[shouting]`, `[laughing]`을 예로 들며, 태그 신뢰성은 아직 개선 중이라고 밝힌다 — [Eleven v4 문서](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4)
- Azure MAI-Voice-2 ko-KR 여성 보이스 스타일은 angry, confused, determined, embarrassed, excited, happy, hopeful, joyful, regretful, relieved, sad, softvoice, surprised다. 남성 Junho에는 regretful·surprised가 없다. `styledegree`로 강도를 조절한다 — [MAI-Voice](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices)
- OpenAI instructions는 억양, 감정 폭, 억양 곡선, 흉내, 속도, 톤, 속삭임을 자연어로 지시한다 — [OpenAI TTS 가이드](https://developers.openai.com/api/docs/guides/text-to-speech)
- Gemini 3.8은 `speech_metadata.style`(예: "whispering", "out of breath", "sarcastic")과 인라인 이벤트 `<cough>`를 쓴다 — [Gemini API 문서](https://ai.google.dev/gemini-api/docs/speech-generation). 블로그는 `<laughs>`, `<sigh>`, `<gasp>`를 예로 든다 — [Google 블로그 3.8](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-8-text-to-speech/). 3.1은 `[whispers]`, `[happy]`, `[curiosity]`, `[enthusiasm]` 같은 대괄호 태그를 쓴다(검색 요약) — [Google 블로그 3.1](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-flash-tts/)
- Typecast `ssfm-v30` 프리셋은 `normal/happy/sad/angry/whisper/toneup/tonedown`이고, Smart Emotion이 문맥으로 감정을 추론한다 — [Typecast Models](https://typecast.ai/docs/models.md)
- CLOVA는 `emotion` 0/1/2/3(중립/슬픔/기쁨/분노)과 `emotion-strength` 0~2를 쓴다. `pitch`는 음수가 더 높고, `speed`는 음수가 더 빠르다 — [NCP CLOVA Voice API](https://api.ncloud-docs.com/docs/ai-naver-clovavoice-ttspremium)
- Fish S1은 `(angry) (sad) (excited) (surprised) (unhappy) (disdainful) (anxious) (joyful)`, `(whispering) (soft tone)`, `(laughing) (sighing) (sobbing)` 등 괄호 마커를 쓴다 — [fishaudio/s1-mini README](https://huggingface.co/fishaudio/s1-mini/blob/main/README.md)
- Qwen3-TTS는 자연어 instruct로 음색·감정·운율을 제어한다 — [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS). CosyVoice3는 감정·속도·볼륨 instruct를 지원한다 — [CosyVoice](https://github.com/FunAudioLLM/CosyVoice). Chatterbox는 exaggeration 값으로 감정 강도를 조절한다(검색 요약) — [DeepInfra](https://deepinfra.com/ResembleAI/chatterbox-multilingual)

### Inferences
- **매핑 초안**
  - 강도 표기: 초텐 ↑ / 아메 ↓.
  - † 표시는 공식 예시 목록에 없는 자유 태그다. v3는 자유 태그도 따르지만 결과 편차가 있으므로 청취 검증이 필요하다.

| 앱 태그 | ElevenLabs v3 태그 | OpenAI instructions 핵심 | Azure MAI ko-KR style (styledegree) | Typecast | CLOVA (vara 등 감정 지원 화자) | Fish S1 |
|---|---|---|---|---|---|---|
| joy | 초텐 `[excited]` `[laughs]` / 아메 태그 없이 짧게 또는 `[chuckles]`† | "신나서 톤이 올라가고 웃음기" / 아메 "무심하지만 살짝 기분 좋은" | 초텐 joyful·excited 1.2–1.5 / 아메 happy·relieved 0.5–0.8 | happy, toneup | emotion 2, strength 2 / 아메 strength 0 | (joyful) (laughing) / 아메 (satisfied) |
| pout(삐짐) | 초텐 `[pouting]`† + 늘어지는 말끝 "…" / 아메 `[sarcastic]` | "삐쳐서 입 내밀고 말끝을 끄는, 투정 섞인" | angry 0.4–0.6(약하게) | angry 또는 tonedown | emotion 3, strength 0(nara는 불가) | (unhappy) (disdainful) |
| shy | `[whispers]`, `[nervously]`† | "수줍게, 작고 망설이는 목소리" | embarrassed | whisper | emotion 0, volume -2, speed +1(약간 느리게) | (soft tone) (anxious) |
| surprised | `[gasps]`†, `[excited]` (Gemini 3.8은 `<gasp>`) | "깜짝 놀라 숨 들이키며 높게" | surprised(여성만) | toneup | pitch -2(더 높게), speed -1 | (surprised) |
| thinking | `[curious]` + "음…" 말줄임표 | "생각하며 천천히, 중간중간 멈춤" | confused 또는 softvoice | tonedown/normal | speed +2(느리게) | (soft tone) |
| sleepy | `[sighs]` `[exhales]` `[yawns]`† | "졸려서 느리고 늘어지는, 하품 섞인" | softvoice 0.8 | whisper/tonedown | speed +3, pitch +2(낮게), volume -1 | (sighing) (soft tone) |
| sad | `[sighs]`, 강하면 `[crying]` | "풀 죽은, 낮고 느린" | sad·regretful | sad | emotion 1 | (sad) (sobbing) |
| angry | `[shouting]`(v4 예시) 또는 강조 대문자 | "짜증 난, 빠르고 날카롭게" | angry 1.0+ | angry | emotion 3, strength 2 | (angry) |

- **캐릭터 기본 톤은 감정 매핑 앞단에서 합성한다.**
  - 초텐 = 에너지 +(속도·피치 약간 ↑, styledegree ×1.2)
  - 아메 = 에너지 −(styledegree ×0.6, 문장 짧게, 한숨 태그 가끔)
  - OpenAI는 instructions를 "캐릭터 고정문 + 감정문" 두 줄로 조립한다.
- **비언어 표현은 텍스트에도 넣는다.** "…", "~", "헤헤", "하아" 같은 표기가 태그 없는 엔진에서도 운율을 만든다(ElevenLabs가 구두점·말줄임표 효과를 명시함). 반대로 태그를 쓰는 엔진에서는 이 표기가 말풍선 텍스트에 그대로 보이지 않도록, "표시용 텍스트"와 "발화용 텍스트"를 분리한다.
- **CLOVA를 쓰면 부호 주의**: pitch·speed 부호가 직관과 반대이므로 어댑터에서 반전 변환 함수를 둔다.

### Gaps
- ElevenLabs 태그는 열린 집합이라 한국어 문장에서 어떤 태그가 안정적인지 공식 목록·평가가 없다.
- Gemini 3.1의 200개 이상 태그 전체 목록은 가져오지 못했다.
- Typecast 감정 강도 파라미터, CLOVA `end-pitch`의 방향(어느 부호가 올라가는지)은 미확인.
- MAI-Voice-2 한국어 스타일의 실제 청감 품질을 다룬 리뷰는 찾지 못했다.

## 4. 2D 픽셀 스프라이트의 말하기 애니메이션: 진폭·비셈·타임스탬프 방식, 한국어 고려, 입 프레임 제작

### Takeaway
리그 없이 표정당 정지컷 1장인 픽셀 스프라이트라면 다음 순서가 적합하다.
1. 가장 싸고 어떤 TTS·한국어에도 통하는 방식: Web Audio `AnalyserNode` 진폭으로 입 2–3프레임을 바꾸고, 말할 때 몸을 들썩인다(PNGtuber 방식).
2. 정확도를 올리는 방식: ElevenLabs 문자 단위 타임스탬프(한글 1음절 = 1문자)를 한글 자모 분해와 결합해 모음 입모양과 ㅁ·ㅂ·ㅍ·ㅃ 닫힘을 정한다. 또는 Azure `VisemeReceived`(ko-KR은 Viseme ID만 지원)를 3–5개 입 프레임으로 줄여 쓴다.

오디오 기반 비셈 추정 라이브러리(wawa-lipsync, HeadAudio, wLipSync)는 영어 중심이거나, 알고리즘과 한국어 성능이 공개되지 않았다. 입 프레임은 컷 전체를 재생성하지 말고 "입 영역 패치"만 만들어 겹치는 방식이 픽셀 일관성과 용량 면에서 유리하다.

### Cited Findings

#### 진폭 기반 / PNGtuber 선례
- veadotube mini 2.2(2026-03-24 갱신) — [itch.io: veadotube mini](https://olmewe.itch.io/veadotube-mini)
  - 마이크 소리 감지로 idle/talking 이미지를 전환한다
  - 말할 때 아바타가 "shake or jump"한다
  - 눈 깜빡임 이미지, 표정 슬롯 무제한
  - 단축키·WebSocket으로 상태를 전환한다
  - veadotube는 마이크를 음량 감지에만 써서 still/talking 이미지를 바꾼다(검색 요약)
- `AnalyserNode`는 시간영역 파형(`getByteTimeDomainData`/`getFloatTimeDomainData`)과 주파수 데이터(`getByteFrequencyData`), `fftSize`, `smoothingTimeConstant`를 제공한다(일반 레퍼런스, 이번에 본문 재확인 안 함) — [MDN AnalyserNode](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode)
- Electron `webPreferences.autoplayPolicy`의 기본값은 `no-user-gesture-required`다(검색 요약) — [Electron WebPreferences](https://www.electronjs.org/docs/latest/api/structures/web-preferences)

#### 오디오 기반 비셈 추정(브라우저)
- wawa-lipsync — [npm README](https://cdn.jsdelivr.net/npm/wawa-lipsync@0.0.2/README.md), [GitHub wass08/wawa-lipsync](https://github.com/wass08/wawa-lipsync)
  - TypeScript, MIT
  - `<audio>` 요소를 `connectAudio()`로 연결하고, `processAudio()`를 주기적으로(requestAnimationFrame 등) 호출해 `viseme` 속성을 읽는다
  - 내부적으로 `AnalyserNode`를 쓰고, React Three Fiber 3D 예제와 데모가 있다
  - README에는 검출 알고리즘과 비셈 목록 설명이 없다
- HeadAudio(원저자 met4citizen, 확인한 것은 kyr0 포크) — [GitHub kyr0/HeadAudio](https://github.com/kyr0/HeadAudio)
  - MFCC + 가우시안 프로토타입 + 마할라노비스 거리 분류기로 Oculus 비셈 블렌드셰이프 값을 산출한다
  - AudioWorklet 기반, 지연 약 50ms
  - 영어(Harvard Sentences) 학습 모델 약 14kB, MIT
  - TalkingHead와 호환
- wLipSync — [GitHub mrxz/wlipsync](https://github.com/mrxz/wlipsync)(검색 요약)
  - uLipSync(Unity)의 WebAudio·WASM 포트, MFCC 기반
  - AudioWorklet을 쓰므로 secure context(localhost/https)가 필요하다
  - Unity uLipSync로 캘리브레이션한 프로파일이 필요하다

#### 텍스트·음소 타이밍 기반
- ElevenLabs with-timestamps는 `audio_base64`와 함께 `alignment{characters, character_start_times_seconds, character_end_times_seconds}`, `normalized_alignment`를 반환한다 — [Convert with timestamps API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps). 스트리밍판 "Stream with timestamps"도 있다 — [changelog 2026-09-28](https://elevenlabs.io/docs/changelog/2026/9/28). v3의 단어 단위 타임스탬프 지원은 서드파티 요약에서만 확인했다 — [fal.ai eleven-v3](https://fal.ai/models/fal-ai/elevenlabs/tts/eleven-v3)
- Azure viseme — [Azure: Get facial position with viseme](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis-viseme)
  - viseme ID 22개: 0 무음, 1 æ/ə/ʌ, 2 ɑ, 3 ɔ, 4 ɛ/ʊ, 5 ɝ, 6 j/i/ɪ, 7 w/u, 8 o, 9 aʊ, 10 ɔɪ, 11 aɪ, 12 h, 13 ɹ, 14 l, 15 s/z, 16 ʃ/tʃ/dʒ/ʒ, 17 ð, 18 f/v, 19 d/t/n/θ, 20 k/g/ŋ, 21 p/b/m
  - `AudioOffset`는 100ns 틱 단위
  - 이벤트는 `VisemeReceived`(JS SDK에서는 `synthesizer.visemeReceived`)
  - 2D SVG 출력은 en-US만, 블렌드셰이프는 60fps·55개 값
- Azure 로캘 표에서 `ko-KR`과 `ja-JP`는 "Viseme ID"만 지원한다(블렌드셰이프 없음). 이 표는 GitHub 원문을 직접 받아 확인했다 — [Azure viseme 로캘 표(GitHub 원문)](https://raw.githubusercontent.com/MicrosoftDocs/azure-ai-docs/main/articles/ai-services/speech-service/includes/language-support/viseme.md)
- Rhubarb Lip Sync — [GitHub DanielSWolf/rhubarb-lip-sync](https://github.com/DanielSWolf/rhubarb-lip-sync)
  - 입모양 A: P/B/M 닫힘
  - B: 이를 다문 채 살짝 벌림
  - C: 벌림(EH/AE)
  - D: 크게 벌림(AA)
  - E: 살짝 둥글게(AO/ER)
  - F: 오므림(UW/OW/W)
  - 확장 G(F/V), H(L), X(휴지)
  - 인식기: PocketSphinx(영어), phonetic(언어 무관). 대사 파일을 주면 정확도가 오른다
  - 출력 TSV/XML/JSON, macOS 바이너리 제공
  - 최신은 1.14.0(4월 3일, 페이지에 연도 없음). 1.9.0에서 비영어용 phonetic 인식이 추가됐다 — [Releases](https://github.com/DanielSWolf/rhubarb-lip-sync/releases)

#### 한국어 고려
- 한국어 viseme 정의 연구(김일성종합대학 Ha Jong Won 외, arXiv 2014) — [arXiv:1411.4114](https://arxiv.org/abs/1411.4114)
  - 모음을 축으로 viseme 10개를 정의했다: a(a, ya), o(o, yo), u(u, yu), i, e, we, wi(wi, ui), wa, wo, m(m, b, p)
  - a·o·i·u·e·m은 기본 입모양 하나로 정해지는 "single viseme"이다
  - we·wi·wa·wo는 두 입모양 사이의 전이인 "double viseme"이다
  - 자음 가운데 입모양만으로 명확히 구분되는 것은 m·b·p·pp(닫힘)뿐이다. 나머지 자음·받침은 혀 위치로 정해져 겉으로 보기 어렵다
  - 텍스트 추출본에서 로마자 발음 구별 기호가 사라져, o/u가 ㅗ·ㅓ 중 무엇에 대응하는지는 추출본만으로 확정할 수 없다
- 영어 기반 립싱크 자동생성 도구를 한국어에 쓰면 음운체계 차이 때문에 수작업이 많이 든다. 그래서 한국어 단모음 실시간 인식 결과를 립싱크 키로 쓰는 연구가 있다(검색 스니펫, 원문 접속 실패) — [KoreaScience JAKO201326835630563](https://www.koreascience.or.kr/article/JAKO201326835630563.page?lang=ko)
- 한글 완성형 음절은 산술로 분해된다. SBase U+AC00, 초성 19, 중성 21, 종성 28개(NCount 588) — [Unicode 표준 3.12절 Conjoining Jamo Behavior](https://www.unicode.org/versions/Unicode15.0.0/ch03.pdf)

#### 프레임 제작
- Gemini 2.5 Flash Image(nano-banana)는 캐릭터 일관성을 유지하며 자연어로 국소 변형을 할 수 있다. 원본의 스타일·조명·시점을 분석해 편집하고, 가격은 이미지당 $0.039다(검색 요약) — [Google Developers Blog: Introducing Gemini 2.5 Flash Image](https://developers.googleblog.com/introducing-gemini-2-5-flash-image/). 후속으로 Nano Banana Pro(Gemini 3 Pro Image)가 나왔다 — [Google 블로그: Nano Banana Pro](https://blog.google/technology/ai/nano-banana-pro/)

### Inferences
- **MVP: 진폭 방식, 모든 엔진 공통**
  - 재생은 `AudioContext`의 `MediaElementSource` 또는 `AudioBufferSource` → `AnalyserNode` → destination으로 잇는다.
  - 매 틱마다 `getFloatTimeDomainData`로 RMS를 구하고 엔벨로프를 만든다. 어택은 약 20–30ms로 빠르게, 릴리즈는 약 80–120ms로 느리게 한다.
  - 임계값은 직전 발화의 피크 대비 비율로 잡는다(예: 열림 > 0.35·peak, 반열림 > 0.15·peak). 히스테리시스와 최소 유지시간(약 2틱)을 둔다.
  - 입 갱신은 초당 10–15회로 제한해 도트 애니메이션 느낌을 내고 깜빡임을 줄인다. 모든 수치는 튜닝용 시작값이다.
  - 몸 바운스는 엔벨로프에 비례해 정수 픽셀(1–3px)만 `translateY`한다. 비정수 scale 스쿼시는 도트를 흐리게 하므로 쓰지 않는다. 스쿼시가 필요하면 별도 프레임으로 만든다.
  - 스케일 렌더링은 `image-rendering: pixelated`로 한다(일반 CSS, [MDN image-rendering](https://developer.mozilla.org/en-US/docs/Web/CSS/image-rendering)).
- **한국어 정밀 모드: ElevenLabs 타임스탬프 + 자모 분해**
  - `alignment`의 각 한글 문자 구간(start~end)마다 `code = ch - 0xAC00`을 계산한다.
  - 초성 = `floor(code/588)`, 중성 = `floor((code%588)/28)`, 종성 = `code%28`.
  - 중성 인덱스(0–20: ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ)를 입모양으로 바꾼다.
    - A 크게: ㅏ ㅑ
    - A− 중간: ㅓ ㅕ
    - E 옆으로 중간: ㅐ ㅒ ㅔ ㅖ
    - I 옆으로 좁게: ㅣ ㅡ ㅢ
    - O/U 둥글게: ㅗ ㅛ ㅜ ㅠ ㅚ
    - 이중모음 ㅘ ㅝ ㅙ ㅞ ㅟ: 구간 앞 30–40%는 O/U, 뒤는 A/E/I로 전이(arXiv의 double viseme 개념)
  - 초성 ㅁ·ㅂ·ㅃ·ㅍ(인덱스 6, 7, 8, 17)이면 구간 앞 40–60ms를 닫힘으로 한다.
  - 종성 ㅁ·ㅂ·ㅄ·ㅍ(16, 17, 18, 26)이면 구간 끝을 닫힘으로 한다.
  - 문장부호·공백 구간과 발화 종료 후는 닫힘으로 한다.
  - 프레임이 3장뿐이면 A/A−/E는 열림, I/O/U는 반열림, 양순음·무음은 닫힘으로 축약한다.
  - 연음·비음화로 실제 발음 위치가 한 음절쯤 밀릴 수 있지만, ㅂ→ㅁ 비음화는 여전히 양순음이라 닫힘 판정은 유지된다. 이 정도 오차는 도트 해상도에서 체감이 작을 것으로 본다.
- **Azure 경로: viseme ID → 픽셀 입 프레임**
  - 닫힘: 0, 21
  - 크게 열림: 1, 2, 9, 11
  - 둥글게: 3, 7, 8, 10
  - 옆으로: 4, 5, 6
  - 반열림(자음): 12–20
  - 한계: ko-KR은 ID만 제공한다. 표준 ko-KR 보이스는 감정 스타일이 거의 없어(InJoon `sad`만) 감정 표현과 정밀 립싱크를 함께 얻기 어렵다. MAI 보이스가 viseme 이벤트를 내는지는 미확인이다.
- **Rhubarb 경로**
  - 생성·캐시한 클립마다 사후에 한 번 CLI로 phonetic 인식을 돌려 JSON 큐를 저장한다. Electron 메인 프로세스에서 child_process로 실행한다.
  - A–H·X를 3–4개 프레임으로 축약한다: X·A 닫힘, B·E·F·G·H 반열림, C·D 열림.
  - 처리 지연이 생기므로 실시간 대사보다는 미리 렌더한 고정 대사에 맞는다. 한국어 정확도는 검증이 필요하다.
- **오디오 비셈 라이브러리의 위치**: wawa-lipsync·HeadAudio는 3D 블렌드셰이프용 비셈을 내고 영어에 최적화돼 있다. 입 프레임이 2–4장뿐인 픽셀 스프라이트에서는 진폭 방식보다 체감 이득이 크지 않을 가능성이 높다. wLipSync는 Unity 캘리브레이션이 필요해 이 앱에는 과하다.
- **입 프레임 제작: 입 영역 패치 방식 권장**
  - 기존 컷(입 닫힘)을 그대로 base로 쓴다.
  - 표정 컷마다 "반열림/열림" 입 패치(수십 px 크기의 투명 PNG)와 좌표만 추가한다. 렌더러가 base 위에 패치를 겹친다.
  - 제작 방법은 두 가지다.
    - 도트 에디터에서 직접 2–3픽셀짜리 입을 그린다(가장 확실).
    - 사용 중인 Gemini 이미지 편집으로 "mouth slightly open as if saying '아', keep everything else identical"을 요청한다. 결과에서 입 주변 사각형만 잘라 원본에 합성한다. 전체 교체는 다른 픽셀이 미세하게 흔들릴 수 있다.
  - 400×658 전신컷에서 입은 몇 픽셀에 불과하다. 입 움직임이 잘 안 보일 수 있으므로 바운스·깜빡임을 같이 쓰는 편이 "말한다"는 인상이 강하다.
  - 깜빡임 패치도 같은 방식으로 만들 수 있다. PNGtuber 도구들도 깜빡임을 기본으로 쓴다.
- **말풍선 타이프라이터 동기화**
  - ElevenLabs는 각 문자의 start 시각에 그 글자를 노출하면 음성과 정확히 맞는다.
  - 타임스탬프가 없는 엔진(OpenAI, Gemini)은 디코드한 오디오 길이 ÷ 글자 수로 균등 노출한다. 문장부호에서 멈춤 가중치를 준다.
  - 음성이 중단되면 전체 텍스트를 즉시 표시한다.

### Gaps
- wawa-lipsync의 검출 알고리즘과 비셈 세트, 오디오 기반 라이브러리들의 한국어 정확도는 확인하지 못했다.
- Rhubarb phonetic 인식기의 한국어 품질을 평가한 자료가 없다.
- Azure MAI·Dragon HD 보이스의 viseme/WordBoundary 이벤트 지원 여부는 미확인이다.
- OpenAI·Gemini TTS에는 타임스탬프가 문서화되어 있지 않다. 대안인 강제정렬(forced alignment) 도구는 조사하지 않았다.
- 과제에 언급된 "lipsync-js" 라이브러리의 실체와 유지보수 상태는 확인하지 못했다.
- 한국어 viseme 국내 논문 원문(KoreaScience)은 접속 실패로 직접 확인하지 못했다.
- Electron에서 file:// 또는 커스텀 프로토콜이 AudioWorklet용 secure context로 취급되는지는 미확인이다(wLipSync·HeadAudio 사용 시 필요).

## 5. 발화 타이밍과 UX: 언제 말하고 언제 조용할지, 음소거·볼륨·끼어들기, 피로도 방지

### Takeaway
음성은 "짧게, 드물게, 언제든 끌 수 있게"가 원칙이다. 캐릭터가 긴 Claude 답변 전체를 낭독하게 하지 말고, 한 호흡 안에 끝나는 리액션이나 요약 한 줄만 말하게 한다. 본문은 말풍선 텍스트가 담당한다. 새 발화는 이전 발화를 페이드아웃하며 끊고, 두 캐릭터는 턴제 큐로 겹치지 않게 한다. 고정 대사는 사전 렌더·캐시로 지연과 비용을 없앤다.

### Cited Findings
- Alexa 음성 디자인 가이드의 "one-breath test": 대화 속도로 한 호흡에 말할 수 있으면 적절한 길이이고, 숨을 쉬어야 하면 줄이라고 권한다. 여러 아이디어는 아이디어 사이에서만 숨을 쉬게 쓰고, "very" 같은 군더더기는 삭제하라고 한다 — [Amazon Alexa Haus: Be brief](https://developer.amazon.com/en-US/alexa/alexa-haus/design-principles/be-brief), [Alexa 블로그: Pass the One-Breath Test](https://developer.amazon.com/blogs/alexa/post/531ffdd7-acf3-43ca-9831-9c375b08afe0/things-every-alexa-skill-should-do-pass-the-one-breath-test)
- OpenAI를 쓰면 AI 음성임을 고지해야 한다 — [OpenAI TTS 가이드](https://developers.openai.com/api/docs/guides/text-to-speech)
- 지연 참고치
  - ElevenLabs Flash v2.5 약 75ms — [Models](https://elevenlabs.io/docs/overview/models)
  - v4 Turbo 중앙값 약 100ms — [changelog](https://elevenlabs.io/docs/changelog/2026/9/28)
  - Qwen3-TTS 최저 약 97ms(GPU) — [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS)
  - Supertonic 2는 M4 Pro CPU에서 RTF 0.012 — [HF](https://huggingface.co/Supertone/supertonic-2)
  - OpenAI는 가장 빠른 응답에 wav/pcm 스트리밍을 권장 — [OpenAI TTS 가이드](https://developers.openai.com/api/docs/guides/text-to-speech)
- 비용 참고치
  - ElevenLabs 무료 월 10,000크레딧 ≈ 10분(검색 요약) — [ElevenLabs 블로그: Eleven v4](https://elevenlabs.io/blog/eleven-v4)
  - gpt-4o-mini-tts는 오디오 출력 $12/1M 토큰 — [OpenAI 모델 페이지](https://developers.openai.com/api/docs/models/gpt-4o-mini-tts), 약 1.5센트/분(커뮤니티 추정) — [OpenAI Community](https://community.openai.com/t/understanding-gpt-4o-mini-tts-pricing-input-characters-cost/1151816)
- Electron의 기본 자동재생 정책은 `no-user-gesture-required`다(검색 요약) — [Electron WebPreferences](https://www.electronjs.org/docs/latest/api/structures/web-preferences)
- PNGtuber 도구도 단축키·Stream Deck·WebSocket으로 상태와 push-to-talk를 제어한다. "사용자가 즉시 제어할 수 있는 스위치"가 이 장르의 표준 UX다 — [veadotube mini](https://olmewe.itch.io/veadotube-mini)

### Inferences
- **발화 정책(기본값 제안)**
  - 작업 완료·오류·권한 요청 같은 이벤트 알림: 캐릭터·감정별 사전 렌더 대사 1줄(예: 초텐 "끝났어~!", 아메 "…됐어."). 같은 이벤트에 변형 3–5개를 두고 랜덤으로 골라 반복감을 줄인다.
  - 긴 Claude 답변: 음성은 리액션이나 요약 한 줄(한 호흡, 대략 한국어 20–40음절)만 말한다. 전문은 말풍선으로 보여준다. 사용자가 말풍선을 클릭하면 "읽어줘"를 온디맨드로 제공한다.
  - 자발적 잡담(방치 시 혼잣말 등): 기본 OFF 또는 긴 쿨다운(예: 수십 분)을 둔다. 사용자가 타이핑 중이면 억제한다.
  - 같은 이벤트가 연속되면 합쳐서 1회만 말한다(디바운스). 쿨다운 동안에는 말풍선만 갱신한다.
- **끼어들기 규칙**
  - 우선순위는 오류 > 사용자 트리거 > 완료 알림 > 잡담이다.
  - 새 발화 우선순위가 같거나 높으면 현재 음성을 80–150ms 페이드아웃해 끊는다(클릭음 방지). 입은 즉시 닫고, 말풍선은 전체 텍스트를 확정한다.
  - 낮으면 버린다. 큐 길이는 1로 두어 오래된 대사가 뒤늦게 나오지 않게 한다.
  - 두 캐릭터는 하나의 전역 오디오 큐를 공유하는 턴제로 운영해 동시 발화를 막는다.
- **제어 UI**
  - 전역 음소거 단축키, 볼륨 슬라이더, 캐릭터별 음성 on/off, "텍스트만" 모드.
  - 이 설정은 앱 재시작 후에도 유지한다.
  - 음소거 상태에서도 입·바운스 애니메이션은 짧게 재생해 "말하고 있음"을 시각적으로 보여줄 수 있다. 끄는 옵션도 둔다.
- **지연 숨기기**
  - 말풍선과 "…" 타이핑 표시를 먼저 띄운다. 오디오 첫 청크가 도착하면 입 애니메이션과 타이프라이터를 함께 시작한다.
  - 고정 대사는 앱 시작 시 캐시를 워밍한다.
- **비용 감각(산술 추정)**
  - 하루 50줄 × 2초 ≈ 월 50분이다.
  - ElevenLabs 무료 한도(약 10분)는 넘는다.
  - OpenAI 기준으로는 월 약 $0.75 수준이다.
  - 캐시 적중률이 높으면 크게 줄어든다.
- **고지**: 개인 앱에서는 사용자 본인이 AI임을 알고 있으므로 실질 문제는 없다. 화면 녹화·배포 시에는 "AI 합성 음성" 표기를 넣는다.

### Gaps
- Electron에서 macOS 집중 모드(방해금지)·화상회의 중(마이크 사용 중) 상태를 감지해 자동 음소거하는 방법은 조사하지 않았다.
- 데스크톱 마스코트·상시 음성 에이전트의 피로도를 다룬 사용자 연구나 정량 자료는 찾지 못했다. 위 정책은 Alexa 가이드와 PNGtuber 관행에 기반한 추론이다.
- 벤더별 한국어 첫 음성 도달 시간(TTFB)을 실측한 자료는 없다(공식 수치는 모델 추론 지연 위주).
