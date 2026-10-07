# 데스크톱 마스코트(초텐·아메)용 한국어 TTS 엔진 조사 — 클라우드 vs 로컬, 캐릭터 연기·스트리밍·가격·라이선스·Electron 연동

- 조사 기준일: 2026-09-30. 가격은 별도 표기 없으면 USD, 조사 시점 공식 페이지 기준.
- 표기: ⚠︎ = 제3자 출처, 출처 간 충돌, 또는 오래됐을 수 있는 정보. "로컬 확인" = 사용자의 Mac(macOS 26.5.2, build 25F84, Apple Silicon)에서 직접 명령을 실행해 얻은 1차 관찰(URL 없음).
- 전제(앱 맥락): Electron 44 / Node 22 투명 오버레이, 캐릭터 2명 — 초텐(밝고 발랄한 아이돌 톤), 아메(건조·무표정·짧은 "…" 츤데레). 대사는 보통 1~2문장, Claude 답변은 토큰 단위 스트리밍.

---

## 1. 클라우드 TTS 엔진 — 한국어 지원, 보이스, 감정/스타일 제어, 스트리밍 지연, 가격

### Takeaway
2026-09 현재 한국어를 지원하면서 캐릭터 연기(감정·스타일 지시)까지 되는 클라우드 후보는 다섯 곳입니다.
- **ElevenLabs:** Eleven v4가 2026-09-28 출시. Voice Design과 오디오 태그를 지원하고 Artificial Analysis Elo 1위입니다.
- **Google Gemini TTS:** 3.8 Flash / Flash-Lite가 2026-09-22 GA. 자연어로 스타일을 지시할 수 있고 무료 티어가 있으며 Elo 3위입니다.
- **OpenAI gpt-4o-mini-tts:** instructions 파라미터로 톤을 조절합니다.
- **Azure MAI-Voice-2:** 한국어 여성 보이스 Haena가 13개 감정 스타일을 지원합니다.
- **Typecast:** 한국 벤더이며 Anime/Character/Kid 보이스 카테고리와 7개 감정 프리셋이 있습니다.

제외하거나 보조로만 볼 곳도 있습니다.
- **Supertone:** 2026-08-31에 Play·API가 전면 종료돼 탈락입니다.
- **Google Chirp 3 HD:** 감정 지시가 안 돼 캐릭터 연기에는 약하지만, 월 100만 자 무료라 비용 면에서 강합니다.
- **Fish Audio:** 과금 단위가 UTF-8 바이트여서 한국어가 불리합니다.

### Cited Findings

#### ElevenLabs
- **모델 스펙 (Models 페이지 기준)** — [ElevenLabs Models](https://elevenlabs.io/docs/models)

  | 모델 | 언어 | 요청당 최대 | 지연 | 비고 |
  |---|---|---|---|---|
  | Eleven v4 | 90+ (한국어 kor 포함) | 10,000자 | 미기재 | 플래그십. "most emotive", 멀티스피커 대화 |
  | Eleven v4 Turbo | 90+ | 미기재 | 중앙값 ~100ms | "Audio tags for fine-grained control" |
  | Eleven v3 | 70+ (한국어 포함) | 5,000자 | 미기재 | "Previous generation" |
  | v3 Conversational | 70+ | 미기재 | ~280ms | |
  | Multilingual v2 | 29개 (Korean 포함) | 10,000자 | 미기재 | 장문 안정성 |
  | Flash v2.5 | 32개 (v2 목록 + 헝가리어·노르웨이어·베트남어) | 40,000자 | ~75ms | 문자당 가격 50% 저렴, 숫자·날짜 텍스트 정규화 필요 |

- v4와 v4 Turbo는 2026-09-28에 출시됐습니다. v4는 Text to Dialogue API로, v4 Turbo는 Text to Dialogue WebSocket(중앙값 ~100ms)으로 제공됩니다. — [ElevenLabs Changelog](https://elevenlabs.io/docs/changelog)
- **API 단가 (1K자당, 플랜과 무관하게 동일)** — [ElevenLabs API Pricing](https://elevenlabs.io/pricing/api)

  | 모델 | 정가 | 프로모션 (10월 12일까지 72% 할인) |
  |---|---|---|
  | v4 | $0.08 | $0.022 |
  | v4 Turbo | $0.04 | $0.011 |
  | v3 | $0.08 | — |
  | v3 Conversational | $0.04 | — |
  | Multilingual v2 | $0.08 | — |
  | Flash/Turbo | $0.04 | — |

- 플랜 가격: Starter $6, Creator $22(첫 달 $11), Pro $99, Scale $299, Business $990. 같은 페이지는 포함량을 v4 문자 수로 표기합니다(예: Creator 545k v4 / 1.09M v4 Turbo, Pro 2M v4). — [ElevenLabs API Pricing](https://elevenlabs.io/pricing/api)
- ⚠︎ 일반 요금 페이지와 수치가 충돌합니다. 일반 요금 페이지는 크레딧 기준으로 Free 10k, Starter 30k, Creator 121k, Pro 600k를 표기하고, "V2 Multilingual은 1자=1크레딧, Flash/Turbo는 0.5~1크레딧/자"라고 적습니다. 무료 플랜은 상업 라이선스가 없고 Starter부터 포함되며, Instant Voice Cloning은 Starter부터입니다. — [ElevenLabs Pricing](https://elevenlabs.io/pricing)
- ⚠︎ 무료 플랜의 API 접근 여부도 출처마다 다릅니다.
  - 공식 요금 페이지 요약: "Free plan does not include API access".
  - 제3자 정리: API 접근은 포함되며, 비상업 용도만 허용되고 'elevenlabs.io' 출처 표기가 필요하다고 함. — [terms.law 정리](https://terms.law/ai-output-rights/elevenlabs/)
- Voice Design은 텍스트 설명으로 새 보이스를 만드는 기능입니다. 문서에 "Eleven v4 is the model to use. Voice Design voices work with it"라고 되어 있습니다. 설명은 20~1000자, 미리듣기 텍스트는 100~1000자입니다. Professional Voice Clone은 voice-captcha로 본인 목소리인지 검증합니다. — [ElevenLabs Voices](https://elevenlabs.io/docs/capabilities/voices)
- WebSocket `stream-input` 엔드포인트는 LLM 토큰 스트림처럼 부분 텍스트를 넣는 용도입니다.
  - 주요 파라미터: `chunk_length_schedule`, `auto_mode`, `flush`, `inactivity_timeout`(기본 20초, 최대 180초).
  - 기본 모델은 `eleven_multilingual_v2`입니다.
  - 버퍼링 때문에 HTTP 요청보다 지연이 약간 클 수 있다고 명시합니다.

  — [ElevenLabs WebSocket](https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input)
- Artificial Analysis TTS 리더보드 1위는 Eleven v4입니다(Elo 1316, $80/1M자). v3 Conversational은 1199, Eleven v3는 1170($100/1M)입니다. ⚠︎ AA의 v3 가격 $100은 공식 API 단가 $0.08/1K(=$80/1M)와 다릅니다. — [Artificial Analysis Leaderboard](https://artificialanalysis.ai/text-to-speech/leaderboard)
- ⚠︎ 경쟁사 Typecast의 2026 비교 글은 ElevenLabs의 한국어 발음이 "완벽하지 못하다"고 평가합니다. 벤더가 쓴 글이라 편향 가능성이 큽니다. — [Typecast 블로그](https://typecast.ai/kr/learn/tts-natural-pronunciation-comparison-2026/)

#### OpenAI
- 모델은 세 가지입니다: `gpt-4o-mini-tts`(최신·권장), `tts-1`(저지연·저품질), `tts-1-hd`. — [OpenAI TTS guide](https://developers.openai.com/api/docs/guides/text-to-speech)
- 보이스
  - gpt-4o-mini-tts는 13종(alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer, verse, marin, cedar)이고, 최고 품질로 marin/cedar를 권장합니다.
  - tts-1 계열은 9종입니다.

  — [OpenAI TTS guide](https://developers.openai.com/api/docs/guides/text-to-speech)
- `instructions` 파라미터로 "Accent, Emotional range, Intonation, Impressions, Speed of speech, Tone, Whispering"을 제어합니다. — [OpenAI TTS guide](https://developers.openai.com/api/docs/guides/text-to-speech)
- 지원 언어는 Whisper를 따르며 한국어가 명시돼 있습니다. — [OpenAI TTS guide](https://developers.openai.com/api/docs/guides/text-to-speech)
- 출력 포맷은 mp3(기본), opus, aac, flac, wav, pcm입니다. 최저 지연에는 wav 또는 pcm을 권장하고, chunked transfer encoding으로 스트리밍합니다. — [OpenAI TTS guide](https://developers.openai.com/api/docs/guides/text-to-speech)
- 사용 정책상 최종 사용자에게 "AI-generated and not a human voice"임을 명확히 고지해야 합니다. — [OpenAI TTS guide](https://developers.openai.com/api/docs/guides/text-to-speech)
- 스냅샷은 `gpt-4o-mini-tts-2025-03-20`과 `gpt-4o-mini-tts-2025-12-15`(기본)입니다. 최대 입력은 2000토큰이고, Tier 1은 500 RPM입니다. — [OpenAI model page](https://developers.openai.com/api/docs/models/gpt-4o-mini-tts)
- 가격
  - gpt-4o-mini-tts: 텍스트 입력 $0.60/1M 토큰, 오디오 출력 $12/1M 토큰.
  - tts-1: $15/1M자. tts-1-hd: $30/1M자.

  — [OpenAI Pricing](https://developers.openai.com/api/docs/pricing)
- ⚠︎ 커뮤니티 추정으로는 분당 약 $0.015입니다(영어 기준 ~1k자 ≈ 1분). — [OpenAI Community](https://community.openai.com/t/understanding-gpt-4o-mini-tts-pricing-input-characters-cost/1151816)

#### Google — Chirp 3: HD (Cloud TTS)
- ko-KR을 지원하며 GA입니다. 보이스는 약 30종(Achernar, Aoede, Charon, Fenrir, Kore, Leda, Puck, Zephyr 등)입니다. — [Chirp 3 HD docs](https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd)
- 스트리밍은 `StreamingSynthesizeConfig`로 지원하지만, 스트리밍 요청에서는 SSML을 쓸 수 없습니다. — [Chirp 3 HD docs](https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd)
- 제어 수단은 속도(0.25x~2x), `[pause short]`/`[pause long]`/`[pause]` 마크업, IPA/X-SAMPA 발음 지정뿐입니다. 감정·스타일 프롬프트 기능은 없습니다. — [Chirp 3 HD docs](https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd)
- ⚠︎ 가격은 Chirp 3 HD 월 100만 자 무료, 이후 $30/1M자입니다. 공식 페이지가 JS 렌더링이라 직접 추출에 실패했고, 검색 스니펫과 제3자 자료로 확인했습니다. — [Google TTS pricing](https://cloud.google.com/text-to-speech/pricing), [costbench](https://costbench.com/software/ai-voice-tools/google-cloud-text-to-speech/free-plan/)

#### Google — Gemini TTS (Gemini API)
- **모델:** `gemini-3.8-flash-tts`, `gemini-3.8-flash-lite-tts`, `gemini-3.1-flash-tts-preview`, `gemini-2.5-pro-preview-tts`. — [Gemini speech generation](https://ai.google.dev/gemini-api/docs/speech-generation)
- **언어:** 3.8 Flash TTS는 130개 이상. 한국어는 Flash와 Flash-Lite 모두 체크돼 있습니다. — [Gemini speech generation](https://ai.google.dev/gemini-api/docs/speech-generation)
- **보이스:** 사전 구축 30종 — Puck "Upbeat", Kore "Firm", Zephyr "Bright", Fenrir "Excitable" 등. — [Gemini speech generation](https://ai.google.dev/gemini-api/docs/speech-generation)
- **스타일 지시:** `speech_metadata.style`(예: "cheerful and friendly")과 인라인 태그(`<sigh>`, `<cough>`)로 스타일·억양·속도·톤을 지시합니다. — [Gemini speech generation](https://ai.google.dev/gemini-api/docs/speech-generation)
- **멀티스피커:** 최대 2명(`speech_config.speakers`). — [Gemini speech generation](https://ai.google.dev/gemini-api/docs/speech-generation)
- **스트리밍:** `stream=True`로 켜며, 헤더 없는 16-bit LE PCM(24kHz, mono, `audio/l16`)이 나옵니다. — [Gemini speech generation](https://ai.google.dev/gemini-api/docs/speech-generation)
- 3.8 Flash TTS와 Flash-Lite TTS는 2026-09-22에 GA가 됐습니다(⚠︎ 일부 출처는 09-23). 언어 수는 Flash 130개, Flash-Lite 101개입니다. — [OpenRouter](https://openrouter.ai/google/gemini-3.8-flash-tts), [Gemini model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash-tts)
- **가격 (1M 토큰당, 입력 텍스트 / 출력 오디오).** 오디오는 초당 25토큰입니다. — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)

  | 모델 | 2026-12-31까지 | 2027-01-01부터 | 무료 티어 |
  |---|---|---|---|
  | 3.8 Flash TTS | $0.50 / $9.00 | $1.00 / $18.00 | "Free of charge" |
  | 3.8 Flash-Lite TTS | $0.50 / $6.00 | $1.00 / $12.00 | "Free of charge" |
  | 3.1 Flash TTS preview | $1 / $20 | — | 있음 |
  | 2.5 Flash preview TTS | $0.50 / $10 | — | 있음 |

- 무료(Unpaid) 티어의 입출력은 Google 제품 개선에 쓰이고 "human reviewers may read, annotate, and process" 대상입니다. 유료 티어는 제품 개선에 쓰이지 않습니다. — [Gemini API terms](https://ai.google.dev/gemini-api/terms)
- AA 리더보드: Gemini 3.8 Flash TTS Elo 1268(3위, $16.5/1M자), Flash-Lite 1240(7위, $11), 3.1 Flash TTS 1204. — [Artificial Analysis](https://artificialanalysis.ai/text-to-speech/leaderboard)

#### Azure AI Speech
- 한국어 보이스 목록 — [Azure language support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)
  - **일반 뉴럴:** SunHi(여), InJoon(남, 스타일은 `sad` 하나), BongJin, GookMin, Hyunsu, JiMin(여), SeoHyeon(여), SoonBok(여), YuJin(여).
  - **HD:** `ko-KR-SunHi:DragonHDLatestNeural`, `ko-KR-Hyunsu:DragonHDLatestNeural`.
  - **MAI-Voice-2:** `ko-KR-Haena:MAI-Voice-2`(+`-Flash`, 여)는 스타일 13종 — angry, confused, determined, embarrassed, excited, happy, hopeful, joyful, regretful, relieved, sad, softvoice, surprised. `ko-KR-Junho:MAI-Voice-2`(남)는 11종.
  - **다국어:** `ko-KR-HyunsuMultilingualNeural`.
- 과금은 공백·구두점·마크업을 포함한 문자 수 기준입니다(`<speak>`, `<voice>` 태그 제외). 원문: "Each Chinese character is counted as two characters for billing, including … hanja used in Korean". 즉 **한자만 2자이고 한글은 1자**입니다. HD 보이스 등 일부는 SSML 태그를 전부 지원하지 않습니다. — [Azure TTS overview](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech)
- 무료 F0는 "Neural: 0.5 million characters free per month"입니다. 유료 단가는 공식 페이지에서 지역별 placeholder("$-")로만 보였습니다. — [Azure Speech pricing](https://azure.microsoft.com/en-us/pricing/details/speech/)
- ⚠︎ 제3자 자료로는 Neural $15/1M자이고, HD 단가는 미확인입니다. — [speechactors](https://speechactors.com/article/?p=3863)

#### Amazon Polly
- 한국어 보이스는 Seoyeon(여; Generative·Neural·Standard 모두 지원)과 Jihye(여; Neural)입니다. Newscaster 스타일은 일부 영어·스페인어 보이스에만 있습니다. — [Polly voices](https://docs.aws.amazon.com/polly/latest/dg/available-voices.html)
- 가격(1M자당): Standard $4, Neural $16, Long-Form $100, Generative $30. — [Polly pricing](https://aws.amazon.com/polly/pricing/)
- 무료: Standard 월 5M자, Neural 월 1M자(첫 12개월), Generative 월 100k자(첫 12개월). — [Polly pricing](https://aws.amazon.com/polly/pricing/)

#### Cartesia Sonic
- Sonic 3.6이 GA입니다(스냅샷 `sonic-3.6-2026-08-27`). 44개 언어를 지원하며 `ko`가 포함됩니다. SSML이나 지시 없이도 transcript의 감정 맥락에 맞춰 페이스와 억양을 바꾸고, "uhm" 같은 말더듬을 자연스럽게 반영합니다. — [Cartesia models](https://docs.cartesia.ai/build-with-cartesia/tts-models/latest)
- 요금제 — [Cartesia pricing](https://cartesia.ai/pricing)

  | 플랜 | 월 가격 | 크레딧 | 상업 라이선스 | TTS 동시요청 |
  |---|---|---|---|---|
  | Free | $0 | 20K | 없음 | 2 |
  | Pro | $5 | 100K | 있음 | 3 |
  | Startup | $49 | 1.25M | 있음 | 5 |
  | Scale | $299 | 8M | 있음 | 15 |

- TTS는 약 1크레딧/자이고, Pro Voice Clone은 1.5크레딧/자입니다. — [Cartesia docs pricing](https://docs.cartesia.ai/pricing)
- AA 리더보드: Sonic 3.6 Elo 1275(2위, $49/1M자). — [Artificial Analysis](https://artificialanalysis.ai/text-to-speech/leaderboard)

#### Naver CLOVA Voice (NCP)
- 엔드포인트는 `https://naveropenapi.apigw.ntruss.com/tts-premium/v1`입니다. 파라미터: speaker, volume, speed, pitch, alpha, format, emotion, emotion-strength, end-pitch. — [NCP API](https://api.ncloud-docs.com/docs/ai-naver-clovavoice)
- 화자(speaker)와 조절 범위 — [CLOVA Voice Premium API](https://api.ncloud-docs.com/docs/ai-naver-clovavoice-ttspremium)
  - 화자 ID는 140개 이상이고 한국어가 다수입니다. 예: nara(여), jinho(남), nara_call(상담), dara_ang(화남).
  - 'v' 접두 프리미엄 화자(vara, vmikyung 등)만 감정 제어를 지원합니다.
  - 속도 -5~10, pitch -5~5, volume -5~5, alpha(음색: +는 높은 음색) -5~5.
  - emotion 0 중립 / 1 슬픔 / 2 기쁨 / 3 분노, emotion-strength 0~2.
  - 한국어는 요청당 2,000자까지입니다.
- 종량 요금제이며, 사용하지 않아도 기본료가 발생합니다. — [CLOVA Voice spec](https://guide.ncloud-docs.com/docs/clovavoice-spec)
- ⚠︎ 검색 스니펫 기준으로 Premium 기본료에 월 1,000,000자가 포함되고, 초과분은 1,000자 단위로 과금됩니다. 보이스는 100종이고 한·영·일·중·스페인어·대만어를 지원합니다. 기본료 금액은 확인하지 못했습니다. — [NCP CLOVA Voice](https://www.gov-ncloud.com/product/aiService/clovaVoice)

#### Typecast (Neosapience, 한국)
- API 요금 — [Typecast API](https://typecast.ai/developers/api/)

  | 플랜 | 월 가격 | 크레딧 | 1k 크레딧당 | 동시요청 |
  |---|---|---|---|---|
  | Free | $0 | 15k | — | 2 |
  | Lite | $15 | 200k | $0.075 | — |
  | Plus | $280 | 4M | $0.07 | 15 |

  - "1 credit per character" 방식입니다.
  - 35개 이상 언어를 지원합니다. 한국어·일본어 등 6개 언어는 "native-level naturalness"라고 표기합니다.
  - 보이스는 600종 이상이며 "Kid Voices", "Anime Voices", "Character Voices" 카테고리가 있습니다.
  - 감정/스타일 프리셋 7개가 있고, 강도·볼륨·피치·속도를 조절합니다.
  - 스트리밍 TTFB는 170~210ms입니다. 공식 SDK는 13종입니다.
  - 무료 플랜 오디오는 비상업 용도만 허용되고 출처 표기가 필요합니다.
- 모델은 `ssfm-v30`과 `ssfm-v21`이며, Streaming TTS와 WAV/MP3를 지원하고 JavaScript SDK가 있습니다. — [Typecast docs](https://typecast.ai/docs/overview)
- ssfm-v30 감정 프리셋은 normal, happy, sad, angry, whisper, toneup, tonedown이고, 문맥으로 감정을 추론하는 Smart Mode가 있습니다. — [Neosapience MCP 샘플 knowledge base](https://glama.ai/mcp/servers/@neosapience/typecast-api-mcp-server-sample/blob/2dbeae80be8e329e0cce20f103f14483a3f55310/app/knowledge.py)
- ⚠︎ 일부 검색 요약은 무료 크레딧을 30k로 적었지만, 공식 API 페이지는 15k입니다.

#### Supertone (HYBE 계열, 한국) — 서비스 종료
- 경과 — [Supertone 종료 안내](https://www.supertone.ai/ko/sunset)
  - 2026-07-15: 서비스 종료 공지. 모든 제품의 신규 가입·결제를 중단했습니다.
  - 2026-08-03: 일괄 내보내기 시작.
  - 2026-08-31: Play, API, Voice Builder 종료.
  - Shift, Clear, Air는 Antinode Audio Inc.로 이관됐습니다.
- HYBE가 Clear 등 일부 Supertone 제품을 Antinode Audio로 이전한다고 발표했습니다. — [Production Expert](https://www.production-expert.com/production-expert-1/hybe-announces-transfer-of-ownership-of-some-supertone-products-including-clear-to-antinode-audio-inc)
- 종료 전 API는 한·영·일 100개 이상의 감정 표현 보이스, 약 10초 샘플 클로닝, Starter 플랜 20 RPM을 제공했습니다. — [Supertone API](https://www.supertone.ai/en/api)
- ⚠︎ 커뮤니티 미러 쪽 설명에는 회사가 2026-07-15 임시주총에서 해산을 결의했다는 내용이 있습니다. 한국어 언론 검색으로는 확인하지 못했습니다. — [HF 미러](https://huggingface.co/jinhwan000/supertonic-3-mirror)

#### Humelo (휴멜로, 한국)
- Prosody는 STT, LLM, TTS를 연결하는 엔터프라이즈 보이스 에이전트 플랫폼입니다. 자체 엔진 DIVE를 쓰며 약 2분 샘플로 음성을 만들고, 캐릭터 음성 채팅앱 Tikita를 운영합니다. — [PyPI prosody](https://pypi.org/project/prosody/), [Speech Technology](https://www.speechtechmag.com/Articles/News/Speech-Technology-News/Humelo-to-Expand-Voice-Dubbing-and-TTS-Capabilities-149644.aspx)

#### Fish Audio (API)
- 가격은 `s2.1-pro` $15/M UTF-8 bytes, `s2.1-pro-free` $0.00, `s2-pro` $15, `s1` $15입니다. 동시요청은 Starter(누적 결제 $100 미만) 5건입니다. — [Fish Audio pricing](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits)
- 한국어 같은 비라틴 문자는 한 글자에 3~4바이트라, 같은 글자 수여도 비용이 커집니다. — [smallest.ai](https://smallest.ai/blog/fish-audio-pricing-plans-api-billing-commercial-use-in-2026)
- S2 Pro 모델 개요 — [HF fishaudio/s2-pro](https://huggingface.co/fishaudio/s2-pro)
  - 2026-03-09 공개(arXiv 2603.08823). 5B 파라미터(Slow AR 4B + Fast AR 400M).
  - 80개 이상 언어 중 한국어는 Tier 2입니다.
  - `[whisper in small voice]` 같은 자유형 괄호 태그를 씁니다(15,000종 이상).

#### MiniMax Speech
- ⚠︎ 가격은 Speech 2.8 HD $0.10/1K자, Turbo $0.06/1K자이고 입력은 최대 10,000자입니다(제3자 자료). AA 표기($100 / $60 per 1M, Elo 1171 / 1150)와 일치합니다. — [Scenario help](https://help.scenario.com/articles/8237857559-minimax-speech-2-8-the-essentials), [Artificial Analysis](https://artificialanalysis.ai/text-to-speech/leaderboard)
- Speech 2.6은 40개 이상 언어(한국어 포함)를 지원합니다. 감정은 auto로 두거나 happy, calm, surprised 등으로 수동 지정할 수 있습니다. — [Novita](https://blogs.novita.ai/minimax-speech-2-6-on-novita-ai-next-gen-tts-model-for-voice-synthesis/)
- 공식 가격 페이지에서는 구독 티어($5~$999)만 추출됐습니다. — [MiniMax pricing](https://platform.minimax.io/docs/guides/pricing)

#### Inworld TTS
- 모델은 `inworld-tts-2`(100ms TTFB)와 `inworld-tts-2-flash`(20ms TTFB, 5배 빠름)입니다. 200개 이상 언어·로케일과 인스턴트 클로닝을 지원하며, TTS-1.x는 deprecated입니다. — [Inworld docs](https://docs.inworld.ai/docs/tts/tts-models)
- 한국어(ko) 지원이 확인됩니다. — [famulor](https://www.famulor.io/voices/inworld/languages/ko)
- ⚠︎ 가격 충돌: AA는 TTS-2 $20.8, TTS-2 Flash $10.4 per 1M자(Elo 1247 / 1210)로 표기하고, 제3자 문서는 Flash를 $15/1M로 표기합니다. — [Artificial Analysis](https://artificialanalysis.ai/text-to-speech/leaderboard), [GMI Cloud](https://docs.gmicloud.ai/model-quickstarts/audio/inworld-tts-2-flash)

#### 참고: AA 리더보드 상위
- 상위 20위 중 주요 항목입니다. — [Artificial Analysis](https://artificialanalysis.ai/text-to-speech/leaderboard)

  | 모델 | Elo | 가격 (1M자당) |
  |---|---|---|
  | Eleven v4 | 1316 | $80 |
  | Cartesia Sonic 3.6 | 1275 | $49 |
  | Gemini 3.8 Flash TTS | 1268 | $16.5 |
  | Alibaba Qwen-Audio-3.0-TTS-Plus | 1258 | $19.3 |
  | Inworld Realtime TTS-2 | 1247 | $20.8 |
  | Speechify Simba 3.2 | 1241 | $6.6 |
  | MiniMax Speech 2.8 HD | 1171 | $100 |

### Inferences
- **한국어 전용 품질은 검증된 순위가 없습니다.** AA Elo는 언어를 나누지 않은 종합 순위라, 한국어 품질의 대리 지표로만 봐야 합니다. 실제 대사 10~20줄로 초텐·아메 톤 A/B 청취 테스트를 하는 것이 필수입니다.
- **한 엔진 안에서 캐릭터 둘을 구분하기 좋은 곳**
  - Gemini TTS: 보이스 30종에 턴별 자연어 스타일 지시를 줄 수 있고, 2화자 멀티스피커로 초텐·아메 만담을 한 요청에 합성할 수 있습니다.
  - ElevenLabs v4: Voice Design으로 고유 보이스 2개를 만들고, 오디오 태그로 감정을 붙입니다. v4 Text to Dialogue도 멀티스피커입니다.
  - OpenAI: instructions로 페르소나를 서술합니다.
- **Azure MAI-Voice-2 Haena**의 excited, joyful, embarrassed 스타일은 초텐의 발랄함에 잘 맞을 수 있습니다. 다만 MAI 여성 보이스는 Haena 하나뿐이라, 아메는 SunHi, JiMin, SeoHyeon 같은 일반 뉴럴 보이스에 속도와 피치를 낮춰 건조한 톤을 만드는 조합이 현실적입니다.
- **Chirp 3 HD와 Polly**는 감정 지시가 없어 캐릭터 연기보다 무료·저가 낭독용입니다. **CLOVA Voice**는 감정 4종과 alpha(음색 높낮이)로 "밝은 초텐 / 낮고 건조한 아메"를 파라미터만으로 나눌 여지가 있지만, 가격 구조(기본료)가 불투명합니다.
- **Supertone**은 서비스가 종료돼 신규 도입이 불가능합니다. 오픈 웨이트 Supertonic만 남았습니다(2번 항목).
- **Fish Audio**는 바이트 과금이라 한국어가 영어 대비 약 2.5~3배 비쌉니다. S2 Pro는 연구·비상업 라이선스입니다.
- **초저지연 순위(공식 수치 기준):** Inworld TTS-2 Flash(20ms) < ElevenLabs Flash v2.5(~75ms) < v4 Turbo·Inworld TTS-2(~100ms) < Typecast(170~210ms) < v3 Conversational(~280ms). OpenAI, Google, Azure는 공식 TTFB 수치를 찾지 못했습니다.

### Gaps
- 2026년 엔진들의 한국어 전용 MOS/CER 독립 비교는 찾지 못했습니다(velog/tistory 검색 결과 없음). Typecast 글은 벤더 편향입니다.
- ElevenLabs:
  - v4의 한국어 품질.
  - v4를 일반 TTS 엔드포인트와 `stream-input` WebSocket에서도 쓸 수 있는지(changelog에는 Text to Dialogue API/WebSocket만 언급).
  - 프로모션 종료(10-12) 후 플랜 크레딧 환산. 두 요금 페이지 수치가 상충합니다.
- Google Cloud TTS 공식 가격표 직접 확인(JS 렌더링 실패)과 Gemini TTS 무료 티어의 RPM/RPD 한도.
- Azure HD·MAI-Voice-2의 단가와 F0 무료 티어 적용 여부.
- CLOVA Voice:
  - Premium 기본료 금액(KRW).
  - 아동·청소년·캐릭터 화자 전체 목록.
  - CLOVA Dubbing의 API 제공 여부(미조사).
- Typecast에서 한국어 애니·아이돌 톤 보이스의 구체적인 이름·샘플, Lite 초과분 추가 구매 방식.
- MiniMax 공식 단가와 한국어 문자 과금 방식(1자=1인지).
- Humelo 셀프서브 API·가격 공개 여부.

---

## 2. 로컬/오픈소스 TTS (Apple Silicon, 한국어 지원)

### Takeaway
한국어가 되는 로컬 후보는 두 축입니다.
- **Supertonic 3:** 99M ONNX, 31개 언어. Node나 브라우저에서 Python 없이 돌고, sherpa-onnx-node가 공식 지원합니다. 다만 2026-07 아카이브돼 더 이상 업데이트가 없습니다.
- **Qwen3-TTS:** 2026-01 공개, Apache-2.0. 한국어 프리셋 "Sohee", VoiceDesign, 지시문 기반 감정 제어를 지원하고 mlx-audio로 돌릴 수 있습니다.

그 밖의 후보입니다.
- CosyVoice 3 (0.5B, 한국어, 지시 제어, Apache-2.0)
- Chatterbox Multilingual V3 (500M, ko, MIT, 워터마크)
- GPT-SoVITS (MIT, v2부터 한국어, 참조 음성 필요)
- MeloTTS / OpenVoice V2 (MIT, 가볍지만 표현력은 약함)
- Kani-TTS ko (Apache 2)
- Orpheus ko (연구 프리뷰)
- XTTS-v2 (CPML)
- Fish S2 Pro (5B, 연구 라이선스, 무거움)
- OmniVoice (Apache-2.0, 600개 이상 언어)

Kokoro, Piper, Zonos, Style-Bert-VITS2는 한국어를 지원하지 않아 탈락입니다.

### Cited Findings

#### Supertonic (Supertone, 오픈 웨이트) — 아카이브됨
- 저장소가 아카이브됐습니다. 원문: "This repository is archived. Development and support have ended." 웨이트와 코드는 `supertone-oss-archive` 조직(GitHub/HF)에 보존돼 있습니다. — [README](https://raw.githubusercontent.com/supertone-inc/supertonic/main/README.md)
- 연혁: 2025-12-10 PyPI 공개 → 2026-01-06 Supertonic 2(5개 언어) → 2026-01-22 Voice Builder → 2026-04-29 Supertonic 3(31개 언어). — [README](https://raw.githubusercontent.com/supertone-inc/supertonic/main/README.md)
- Supertonic 3 스펙 — [GitHub](https://github.com/supertone-inc/supertonic), [README](https://raw.githubusercontent.com/supertone-inc/supertonic/main/README.md)
  - 약 99M 파라미터, 44.1kHz 출력, 표현 태그 10종(`<laugh>`, `<breath>`, `<sigh>` 등).
  - ONNX Runtime 예제가 Python, Node.js, 브라우저(WebGPU), Swift, iOS, Rust 등으로 제공됩니다.
  - Raspberry Pi 평균 RTF 0.3.
  - 보이스 스타일은 M1~M5, F1~F5입니다(6종 추가).
  - 라이선스는 코드 MIT, 모델 OpenRAIL-M입니다.
- 아카이브 공지는 2026-07-23입니다. OpenRAIL-M은 OSI 승인 라이선스가 아니며 용도 제한이 붙습니다(딥페이크 금지, 고지 없는 기계 생성물 게시 금지 등). — [HF 미러](https://huggingface.co/jinhwan000/supertonic-3-mirror)
- 모델 카드는 "supports simple tags such as `<laugh>`, `<breath>`, and `<sigh>`"라고 적고 있습니다. 저작권은 "Copyright (c) 2026 Supertone Inc."입니다. — [HF Supertone/supertonic-3](https://huggingface.co/Supertone/supertonic-3)
- ⚠︎ Supertonic 2 소개(제3자): 66M 파라미터, 5개 언어(영·한·스·포·프), 실시간 대비 최대 167배 빠름. — [aioz 블로그](https://aioz.network/blog/supertonic-2-on-device-multilingual-tts-for-real-time-voice-generation)
- sherpa-onnx의 Korean 모델 목록에는 `supertonic-3-ko` **하나만** 있습니다. — [sherpa-onnx Korean](https://k2-fsa.github.io/sherpa/onnx/tts/all/Korean/index.html)
- sherpa-onnx 변환본 상세 — [sherpa-onnx supertonic-3-ko](https://k2-fsa.github.io/sherpa/onnx/tts/all/Korean/supertonic-3-ko.html)
  - int8 ONNX 4개(duration_predictor, text_encoder, vector_estimator, vocoder)로 구성됩니다.
  - 화자 10명(sid 0~9), 24kHz입니다. ⚠︎ README의 44.1kHz와 다릅니다.
  - 배포 파일: `sherpa-onnx-supertonic-3-tts-int8-2026-05-11.tar.bz2`.
  - Node 예시: `new sherpa_onnx.GenerationConfig({sid: 0, numSteps: 8, speed: 1.0, extra: {lang: 'ko'}})`.

#### Qwen3-TTS (Alibaba Qwen)
- 개요 — [Qwen3-TTS GitHub](https://github.com/QwenLM/Qwen3-TTS)
  - 2026-01-22 공개. 변형은 1.7B VoiceDesign / CustomVoice / Base, 0.6B CustomVoice / Base입니다.
  - 10개 언어(중·영·일·**한**·독·프·러·포·스·이)를 지원합니다.
  - 프리셋 화자는 9명이고, 한국어 원어민은 **Sohee**("Warm Korean female voice with rich emotion") 하나입니다.
  - 자연어 지시로 음색·감정·운율을 제어하고, 엔드투엔드 지연은 최저 97ms입니다. Apache-2.0입니다.
- VoiceDesign 모델은 자연어 설명으로 음색·감정·운율을 만듭니다. 10개 언어, 약 2B 파라미터(BF16), Apache 2.0이며 `pip install -U qwen-tts`로 설치합니다. — [HF VoiceDesign](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign)
- **Apple Silicon 속도**
  - ⚠︎ M5 Pro 48GB 벤치(프레임워크 미기재, "macOS 25.5" 표기는 Darwin 25.5=macOS 26.5로 추정). WER 측정 언어도 미기재입니다. — [soniqo benchmarks](https://soniqo.audio/benchmarks)

    | 모델 | 크기 | RTF | WER |
    |---|---|---|---|
    | Qwen3-TTS 1.7B 4-bit | ~2.3GB | 0.79 | 3.47% |
    | Qwen3-TTS 1.7B 8-bit | ~3.5GB | 0.85 | — |
    | Qwen3-TTS 0.6B 8-bit | — | 0.76 | 9.74% |
    | CosyVoice3 (500M) | ~1.9GB | 0.59 | 3.25% |
    | Kokoro-82M | 170MB | 0.17 | — |

  - M3 Max(64GB)에서 PyTorch MPS로 1.7B-CustomVoice를 돌리면 평균 RTF 2.97입니다(약 187초 분량을 559.8초에 생성). 즉 실시간보다 약 3배 느립니다(2026-03-12 기사). — [tinycomputers](https://tinycomputers.io/posts/the-real-cost-of-running-qwen-tts-locally-three-machines-compared.html)

#### mlx-audio (Apple Silicon용 러너)
- 지원 TTS와 언어 — [mlx-audio](https://github.com/Blaizzy/mlx-audio)
  - Qwen3-TTS: KO 포함.
  - OmniVoice: 646개 이상 언어.
  - Higgs Audio v3: 100개 언어.
  - Chatterbox: 23개 언어.
  - VoxCPM2: 30개 언어.
  - Kokoro: EN, JA, ZH, FR, ES, IT, PT, HI — **한국어 없음**.
- `mlx_audio.server --port 8000`으로 **OpenAI 호환** `/v1/audio/speech` REST API를 띄울 수 있습니다. 일부 모델은 스트리밍을 지원하고, 3/4/6/8-bit·mxfp4/mxfp8 양자화가 가능합니다. — [mlx-audio](https://github.com/Blaizzy/mlx-audio)

#### CosyVoice (FunAudioLLM)
- Fun-CosyVoice 3.0은 2025-12 공개, 0.5B입니다. 9개 언어(중·영·일·**한**·독·스·프·이·러)와 중국 방언 18개 이상을 지원합니다. 언어·방언·**감정**·속도·볼륨을 지시할 수 있고, 양방향 스트리밍 지연은 최저 150ms입니다. 코드는 Apache-2.0입니다. — [CosyVoice GitHub](https://github.com/FunAudioLLM/CosyVoice)

#### Chatterbox (Resemble AI)
- Multilingual V3(500M)는 23개 언어를 지원하며 **ko**가 포함됩니다. — [Chatterbox GitHub](https://github.com/resemble-ai/chatterbox)
- `exaggeration`과 `cfg_weight`로 표현력을 조절합니다(표현적인 말투: cfg ~0.3, exaggeration ~0.7). — [Chatterbox GitHub](https://github.com/resemble-ai/chatterbox)
- 모든 출력에 Perth 워터마크가 들어가고, 라이선스는 MIT, `device="mps"`를 지원합니다. Turbo(350M)와 Nano(110M)는 영어 전용입니다. — [Chatterbox GitHub](https://github.com/resemble-ai/chatterbox)

#### GPT-SoVITS
- 버전과 언어 — [GPT-SoVITS GitHub](https://github.com/RVC-Boss/GPT-SoVITS)
  - V2에서 한국어와 광둥어가 추가됐습니다. 이후 V2Pro, V3, V4(48k 출력)가 나왔습니다.
  - 지원 언어: 영·일·한·광둥어·중국어.
- 5초 샘플로 zero-shot, 1분 데이터로 few-shot 파인튜닝이 됩니다. — [GPT-SoVITS GitHub](https://github.com/RVC-Boss/GPT-SoVITS)
- Mac 주의: README 원문은 "models trained with GPUs on Macs result in significantly lower quality … temporarily using CPUs"입니다. — [GPT-SoVITS GitHub](https://github.com/RVC-Boss/GPT-SoVITS)
- `api_v2.py`로 HTTP API를 제공하고, 라이선스는 MIT입니다. — [GPT-SoVITS GitHub](https://github.com/RVC-Boss/GPT-SoVITS)

#### XTTS-v2 (Coqui)
- 17개 언어(ko 포함), 24kHz, 6초 클립으로 클로닝합니다. 라이선스는 Coqui Public Model License(CPML)입니다. — [HF coqui/XTTS-v2](https://huggingface.co/coqui/XTTS-v2)

#### MeloTTS / OpenVoice V2 (MyShell)
- MeloTTS는 한국어 'KR'을 지원합니다. README 표현으로 "Fast enough for CPU real-time inference"이며, 상업·비상업 모두 가능한 MIT 라이선스입니다. — [MeloTTS GitHub](https://github.com/myshell-ai/MeloTTS)
- OpenVoice V2는 "English, Spanish, French, Chinese, Japanese and Korean are natively supported"이고, 2024-04부터 V1·V2 모두 MIT입니다. — [OpenVoice GitHub](https://github.com/myshell-ai/OpenVoice)

#### Kani-TTS / Orpheus / Fish S2 Pro / OmniVoice
- Kani-TTS: `kani-tts-400m-ko`(한국어) 모델과 MLX 변형 `kani-tts-370m-mlx`가 있습니다. GPU RTF는 0.19~0.6, 라이선스는 Apache 2입니다. — [Kani-TTS GitHub](https://github.com/nineninesix-ai/kani-tts)
- Orpheus: 2025-04에 다국어 연구 프리뷰가 공개됐습니다. 한국어는 `canopylabs/3b-ko-ft-research_release`와 `canopylabs/3b-ko-pretrain-research_release`입니다. — [Orpheus GitHub](https://github.com/canopyai/Orpheus-TTS), [HF 컬렉션](https://huggingface.co/collections/canopylabs/orpheus-multilingual-research-release-67f5894cd16794db163786ba)
- Fish Audio S2 Pro(오픈 웨이트) — [HF s2-pro](https://huggingface.co/fishaudio/s2-pro), [fish-speech](https://github.com/fishaudio/fish-speech)
  - 5B 파라미터이며, 한국어는 Tier 2입니다.
  - "Fish Audio Research License": 연구·비상업 용도는 무료이고, 상업 용도는 별도 라이선스가 필요합니다.
  - RTF 0.195와 TTFA ~100ms는 H200 GPU 기준입니다.
- OmniVoice(k2-fsa) — [OmniVoice GitHub](https://github.com/k2-fsa/OmniVoice)
  - 600개 이상 언어를 zero-shot으로 지원합니다.
  - 보이스 디자인 속성: 성별, 나이(아이~노인), 피치(매우 낮음~매우 높음), whisper 스타일.
  - RTF 최저 0.025이고, Apple Silicon에서는 `device_map='mps'`를 씁니다. Apache-2.0입니다.
- ⚠︎ OmniVoice는 0.6B이고 Qwen3-0.6B-Base에서 파인튜닝됐으며 24kHz 출력입니다(제3자 리뷰). — [techsy 리뷰](https://techsy.io/en/blog/omnivoice-review)

#### 한국어 미지원 (탈락)
- Kokoro-82M: v1.0(2025-01-27), 8개 언어·54 보이스, Apache-2.0이며 한국어는 없습니다. — [HF Kokoro](https://huggingface.co/hexgrad/Kokoro-82M), [mlx-audio](https://github.com/Blaizzy/mlx-audio)
- Piper(piper1-gpl): 보이스 목록에 한국어가 없습니다. — [VOICES.md](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/VOICES.md)
- Zonos-v0.1: "supports English, Japanese, Chinese, French, and German"이고, Hybrid 모델은 NVIDIA 3000 시리즈 이상이 필요합니다. — [Zonos GitHub](https://github.com/Zyphra/Zonos)
- Style-Bert-VITS2: Bert-VITS2 v2.1과 JP-Extra 기반이며 한국어 언급이 없습니다. 라이선스는 AGPL-3.0/LGPL-3.0이고, 동작 확인 환경은 Windows, WSL2, Linux뿐입니다. — [Style-Bert-VITS2 GitHub](https://github.com/litagin02/Style-Bert-VITS2)

### Inferences
- **"Node만으로 오프라인" 최선책은 Supertonic 3입니다.** `sherpa-onnx-node`로 Python 사이드카 없이 Electron main 프로세스에서 한국어 합성이 가능합니다. 99M int8 ONNX라 CPU로도 매우 빠를 것으로 봅니다(Pi RTF 0.3 기준). 한계는 세 가지입니다.
  - 고정 보이스 10종과 간단한 태그뿐이라 초텐·아메 같은 캐릭터 연기에는 약합니다.
  - 개발이 끝나 버그 수정이 없고, 웨이트는 아카이브나 미러에서 받아야 합니다.
  - OpenRAIL-M의 용도 제한을 지켜야 합니다.
- **표현력 최선의 로컬 후보는 Qwen3-TTS(1.7B VoiceDesign/CustomVoice) + mlx-audio 서버입니다.**
  - VoiceDesign으로 실존 인물을 복제하지 않고 "발랄한 아이돌 소녀 / 무표정·건조한 소녀" 같은 설명만으로 고유 보이스를 만들 수 있습니다. 라이선스 측면에서 가장 깔끔합니다.
  - 속도: M5 Pro 기준 RTF 약 0.8(4-bit)이므로, 2~3초짜리 한 줄에 약 2초가 걸리는 셈입니다. PyTorch MPS로 돌리면 RTF 약 3이라 체감 지연이 큽니다.
  - 따라서 고정 대사는 미리 렌더링해 캐시하고, 실시간 답변에는 문장 단위 파이프라이닝이 필요합니다.
- **CosyVoice 3**는 같은 벤치에서 가장 빠르고(RTF 0.59) 정확했으며(WER 3.25), 감정 지시와 한국어를 지원하는 2순위입니다. 다만 Mac 설치 난이도는 확인하지 못했습니다.
- **GPT-SoVITS와 XTTS-v2**는 참조 음성이 필수입니다. 실존 성우·인물 음성을 참조로 쓰면 안 됩니다. 쓰려면 직접 녹음한(동의된) 목소리나, 약관상 허용될 경우 합성 보이스 결과물을 참조로 써야 합니다. XTTS-v2는 CPML 라이선스이고 2023년 모델이라 우선순위가 낮습니다. 회사(Coqui) 종료와 비상업 조항은 이번 세션에서 1차 출처로 확인하지 못했습니다(아래 Gaps 참고).
- **MeloTTS, OpenVoice V2**는 가볍고 MIT지만, 한국어 화자가 사실상 단일 기본 보이스라 캐릭터 구분에 불리할 가능성이 큽니다.
- **Fish S2 Pro(5B)**는 Mac 로컬 실시간 용도로는 과합니다. 로컬로는 비실용적이고 API 사용이 현실적입니다.

### Gaps
- 로컬 모델의 한국어 전용 품질(CER, MOS) 비교는 찾지 못했습니다. soniqo WER의 측정 언어도 미기재입니다.
- mlx-audio에서 Qwen3-TTS 스트리밍 지원 여부와 VoiceDesign 모델 지원 여부.
- VoiceDesign으로 만든 보이스를 일관되게 재사용하는 공식 절차(예: Base 모델 클론 경유) — 모델 카드에 명시가 없습니다.
- Chatterbox, Kani-TTS, Orpheus의 한국어 품질 평가.
- F5-TTS: 공식은 영어·중국어만 지원하며, 검증된 한국어 파인튜닝 체크포인트는 찾지 못했습니다.
- VoxCPM2, Higgs Audio v3의 한국어 지원 여부(mlx-audio 표기만 있음).
- CPML의 정확한 비상업 조항과 Coqui 회사 종료 사실 — 이번 세션에서는 1차 출처로 확인하지 못했습니다.
- Supertonic 3 한국어에서 표현 태그가 동작하는지, sherpa-onnx int8 변환본의 음질 저하 정도.
- 사용자 Mac의 칩(M1~M5)과 메모리 — 로컬 모델 선택에 영향을 줍니다.

---

## 3. macOS 내장 음성 (AVSpeechSynthesizer / `say`)

### Takeaway
이 Mac(macOS 26.5.2)에서 앱이 쓸 수 있는 한국어 음성은 "super-compact" 품질의 **Yuna**와 장난감 같은 Eloquence 음성 8종뿐입니다. Siri용 한국어 뉴럴 프리미엄 음성(minji) 에셋은 디스크에 있지만 앱 API에는 노출되지 않습니다. 상위 품질(Enhanced/Premium) 음성은 손쉬운 사용 > 음성 콘텐츠에서 내려받는 구조입니다. 다만 한국어 상위 품질 음성이 실제로 있는지는 확인하지 못했습니다. 품질은 뉴럴 클라우드보다 확연히 낮아 **오프라인 폴백 전용**입니다. Personal Voice는 사용자 본인 목소리(영어 중심)라 캐릭터 용도에 해당하지 않습니다.

### Cited Findings
- `say -v '?'`로 본 한국어 음성은 Yuna, Eddy, Flo, Grandma, Grandpa, Reed, Rocko, Sandy, Shelley입니다(ko_KR). — 로컬 확인: `say -v '?'` (macOS 26.5.2, 25F84, 2026-09-30)
- `AVSpeechSynthesisVoice.speechVoices()` 결과 — 로컬 확인: Swift 스크립트로 speechVoices() 조회
  - Yuna는 `com.apple.voice.super-compact.ko-KR.Yuna`, 품질 `.default`입니다.
  - 나머지는 `com.apple.eloquence.ko-KR.*`입니다.
  - enhanced나 premium 한국어 음성은 설치돼 있지 않습니다.
- `/System/Library/AssetsV2`에 Siri 한국어 음성 에셋 `com.apple.siri.tts.voice.ko_KR.minji.neural.premium`이 있지만 speechVoices() 목록에는 나오지 않습니다. — 로컬 확인: AssetsV2 파일 목록
- `say` 옵션 — 로컬 확인: `man say`
  - `-v voice`, `-r rate`(분당 단어 수), `-o out.aiff`.
  - `--file-format`: AIFF, caff, m4af, WAVE.
  - `--data-format`: 예) `LEF32@8000`, `aac`, `alac`.
- 상위 품질 음성은 시스템 설정 > 손쉬운 사용 > 음성 콘텐츠 > 시스템 음성 옆 정보(i) 아이콘에서 언어와 음성을 골라 내려받습니다. Enhanced/Premium 버전을 권장합니다. — [Texthelp 가이드](https://support.texthelp.com/help/how-can-i-add-a-language-voice-to-readwrite-for-the-mac)
- Chromium(따라서 Electron)의 macOS Web Speech 구현은 `NSSpeechSynthesizer availableVoices`로 음성 목록을 가져옵니다. ⚠︎ 확인한 소스는 구 리비전입니다. — [Chromium tts_mac.mm](https://chromium.googlesource.com/chromium/src/+/eb6a38f/content/browser/speech/tts_mac.mm)
- Chromium은 음성 목록을 지연 초기화합니다. `window.speechSynthesis`에 처음 접근한 직후 `getVoices()`를 부르면 빈 배열이 나오고, 나중에 다시 부르면 채워집니다. — [Readium: SpeechSynthesis in browsers](https://readium.org/speech/docs/WebSpeech.html)
- Personal Voice
  - 현재 영어로만 제공됩니다(⚠︎ 오래된 정보일 수 있음). — [AssistiveWare](https://www.assistiveware.com/support/proloquo4text/adjust-speech-output/apple-personal-voice)
  - 서드파티 앱은 `requestPersonalVoiceAuthorization`으로 사용자 허가를 받아야 하며, 사용자 본인 목소리입니다. — [Ben Dodson](https://bendodson.com/weblog/2024/04/03/using-your-personal-voice-in-an-ios-app/), [Apple Support](https://support.apple.com/HT213878)

### Inferences
- **Node에서 쓰는 가장 쉬운 폴백**은 `child_process.execFile('say', ['-v','Yuna','-r','190','-o', wavPath, '--file-format=WAVE', '--data-format=LEI16@22050', text])`로 파일을 만든 뒤 렌더러에서 재생하는 방식입니다. 또는 렌더러에서 `speechSynthesis.speak(new SpeechSynthesisUtterance(text))`에 `lang='ko-KR'` 음성을 지정합니다. Web Speech는 `pitch`와 `rate`를 조절할 수 있어 초텐(높고 빠르게)과 아메(낮고 느리게)를 최소한으로나마 구분할 수 있습니다.
- Eloquence 음성(Grandma, Rocko 등)은 복고풍 효과음 같은 연출 외에는 부적합합니다.
- Siri 음성은 앱 API에 노출되지 않으므로 기대하지 말아야 합니다. Personal Voice는 본인 음성·영어 중심이라 캐릭터 목소리 용도에 맞지 않습니다.

### Gaps
- 2026년 macOS에서 내려받을 수 있는 한국어 음성의 전체 목록(Yuna Enhanced/Premium 존재 여부, 다른 이름의 남녀 음성 유무)은 UI를 거치지 않고는 확인하지 못했습니다.
- Siri 음성을 시스템 음성으로 지정했을 때 `say`나 Web Speech에서 쓸 수 있는지는 미확인입니다.
- 최신 Chromium이 AVSpeechSynthesizer 기반으로 바뀌었는지(음성 목록 차이)도 미확인입니다.

---

## 4. Node/Electron 연동 — SDK, 렌더러 스트리밍 재생, 캐싱, 오프라인 폴백

### Takeaway
- 클라우드 엔진은 대부분 공식 JS SDK나 단순 REST를 제공하고, 저지연 스트리밍 포맷(PCM/WAV, WebSocket)을 지원합니다.
- 로컬은 두 갈래입니다.
  - sherpa-onnx-node(Supertonic 3): 순수 Node 네이티브 애드온입니다.
  - mlx-audio: OpenAI 호환 로컬 서버(Qwen3-TTS 등)를 띄워 `openai` SDK의 baseURL만 바꿔 같은 코드로 호출할 수 있습니다.
- Electron은 `autoplayPolicy` 기본값이 `no-user-gesture-required`라, 오버레이에서 사용자 입력 없이 자동 재생할 수 있습니다.

### Cited Findings
- **ElevenLabs**
  - npm 패키지는 `@elevenlabs/elevenlabs-js`입니다. `elevenlabs.textToSpeech.convert(voiceId, {text, modelId})`와 `.stream(...)`을 지원하고, 런타임은 Node.js 15+, Deno, Bun 등입니다. — [elevenlabs-js](https://github.com/elevenlabs/elevenlabs-js)
  - WebSocket `/v1/text-to-speech/{voice_id}/stream-input`은 부분 텍스트 입력용이며 `flush`와 `chunk_length_schedule`을 지원합니다. — [ElevenLabs WebSocket](https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input)
- **OpenAI** — chunked transfer로 스트리밍하며, 저지연에는 `wav`나 `pcm`을 권장합니다. — [OpenAI TTS guide](https://developers.openai.com/api/docs/guides/text-to-speech)
- **Gemini** — 스트리밍 응답은 헤더 없는 `audio/l16` 24kHz mono PCM 청크입니다. — [Gemini speech generation](https://ai.google.dev/gemini-api/docs/speech-generation)
- **Typecast** — Streaming TTS(청크 도착 즉시 재생)와 JavaScript SDK를 제공합니다. — [Typecast docs](https://typecast.ai/docs/overview)
- **Electron `webPreferences`**
  - `autoplayPolicy` 값은 `no-user-gesture-required`, `user-gesture-required`, `document-user-activation-required` 중 하나이고, 기본값은 `no-user-gesture-required`입니다.
  - `backgroundThrottling`은 백그라운드일 때 애니메이션과 타이머를 스로틀링하며 기본값은 true입니다.

  — [Electron WebPreferences](https://www.electronjs.org/docs/latest/api/structures/web-preferences)
- **sherpa-onnx-node**
  - Node 애드온 패키지는 `sherpa-onnx-node`입니다(WASM 판과 별개). 플랫폼별 패키지 `sherpa-onnx-darwin-arm64`/`-x64`가 있고, TTS 예제가 40개 이상입니다. Electron에 대한 언급은 없습니다. — [sherpa-onnx nodejs-addon-examples](https://github.com/k2-fsa/sherpa-onnx/tree/master/nodejs-addon-examples)
  - Supertonic 3 한국어는 `extra: {lang: 'ko'}`로 호출합니다. — [sherpa-onnx supertonic-3-ko](https://k2-fsa.github.io/sherpa/onnx/tts/all/Korean/supertonic-3-ko.html)
- **mlx-audio** — `mlx_audio.server`는 OpenAI 호환 `POST /v1/audio/speech`를 제공합니다. — [mlx-audio](https://github.com/Blaizzy/mlx-audio)
- **GPT-SoVITS** — HTTP API 서버 `api_v2.py`를 포함합니다. — [GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS)
- **Supertonic** — Node.js와 브라우저(WebGPU) ONNX Runtime 예제를 제공합니다. — [Supertonic GitHub](https://github.com/supertone-inc/supertonic)

### Inferences
- **권장 구조**
  - API 키는 main 프로세스(또는 기존 `~/.skinclaude` 설치본의 Node 쪽)에만 둡니다.
  - main이 TTS를 호출하고, 오디오 청크(ArrayBuffer)를 IPC로 렌더러에 넘깁니다.
  - 렌더러는 Web Audio로 재생합니다.
    - 문장 단위 WAV/MP3: `decodeAudioData` 후 `AudioBufferSourceNode`로 큐잉합니다.
    - PCM 스트림(OpenAI `pcm`, Gemini `l16`, ElevenLabs `pcm_*`): AudioWorklet 링버퍼로 이어 붙이면 첫 소리까지의 지연이 가장 짧습니다.
    - MediaSource(MSE)에 `audio/mpeg`를 붙이는 방식도 가능하지만, PCM + AudioWorklet 쪽이 단순하고 지연 제어가 쉽습니다.
- **Claude 답변 토큰 스트리밍 처리**
  - 토큰을 버퍼링하다가 문장 경계(`. ! ? … ~`, 줄바꿈)나 최대 길이에 닿으면 문장 단위로 TTS에 보내는 파이프라인이 엔진과 무관하게 동작해 가장 범용적입니다.
  - ElevenLabs는 `stream-input` WebSocket이 이 버퍼링을 대신 해 줍니다.
  - 말풍선 텍스트와 음성의 싱크는 문장 단위로 맞추는 것이 현실적입니다.
- **캐싱**
  - 키를 `sha256(engine|model|voice|style/instructions|text)`로 잡고 `~/.skinclaude/tts-cache/`에 파일로 저장합니다.
  - 초텐·아메의 고정 반응 대사(인사, 클릭 반응 등)는 설치 시 일괄 사전 렌더링합니다. 이러면 반복 줄의 비용이 0이 되고 지연도 0에 가까워집니다.
  - 캐시에 LRU 용량 제한을 둡니다.
- **폴백 체인:** 클라우드(주 엔진) → 로컬(Supertonic 3 / sherpa-onnx-node) → macOS `say`/Web Speech. 네트워크 오류나 예산 초과 시 자동으로 강등합니다.
- **입모양:** 렌더러의 `AnalyserNode` RMS로 픽셀아트 입모양 프레임을 바꾸면, 엔진과 무관하게 립싱크 연출이 가능합니다.
- **오버레이 창:** 숨김이나 비포커스 상태에서도 재생 타이밍이 밀리지 않게 `backgroundThrottling: false`를 검토합니다.

### Gaps
- `sherpa-onnx-node`를 Electron 44(Node 22 ABI)에 넣을 때 재빌드가 필요한지 공식 확인은 못 했습니다.
- mlx-audio 서버의 스트리밍 응답 포맷과 동시성 한계.
- ElevenLabs JS SDK가 v4/v4 Turbo(Text to Dialogue API/WebSocket)를 지원하는 버전.
- Electron 44의 MSE `audio/mpeg`와 AudioWorklet 관련 특이사항 — 이번 세션에서 1차 문서를 확인하지 않았습니다.

---

## 5. 비용 추정 — 하루 약 300줄, 약 15,000자(월 약 450,000자)

### Takeaway
월 약 45만 자면 다음과 같습니다.
- **무료 티어 안에서 해결 가능:** Google Chirp 3 HD(월 100만 자 무료), Azure Neural F0(월 50만 자, 한글은 1자 과금), Polly Neural(첫 12개월 월 100만 자), Gemini TTS 무료 티어(데이터 활용 조건), 로컬 엔진.
- **유료:** 캐릭터 연기용 유료 엔진은 대략 월 $5~$45 수준입니다. 싼 쪽은 Inworld Flash 약 $4.7, OpenAI tts-1 $6.75, Gemini 3.8 Flash-Lite 약 $9~11, gpt-4o-mini-tts 약 $14~19, ElevenLabs Flash·v4 Turbo 정가 $18, v4 정가 $36, MiniMax HD $45입니다.
- **예외:** Cartesia는 플랜 구조상 $49, Typecast는 Lite 한도(20만)를 넘으면 Plus $280로 뛰어 불리합니다.

### Cited Findings
- 단가는 1번 항목 출처와 같습니다. 주요 근거만 다시 적습니다.
  - Chirp 3 HD 월 100만 자 무료, $30/1M. — [Google TTS pricing](https://cloud.google.com/text-to-speech/pricing)
  - Azure F0 월 50만 자, 한자만 2자 과금. — [Azure pricing](https://azure.microsoft.com/en-us/pricing/details/speech/), [Azure TTS overview](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech)
  - Polly Neural $16/1M(첫 12개월 월 1M 무료), Generative $30/1M(월 100k 무료). — [Polly pricing](https://aws.amazon.com/polly/pricing/)
  - OpenAI tts-1 $15/1M, tts-1-hd $30/1M, gpt-4o-mini-tts 약 $0.015/분(추정). — [OpenAI Pricing](https://developers.openai.com/api/docs/pricing), [Community](https://community.openai.com/t/understanding-gpt-4o-mini-tts-pricing-input-characters-cost/1151816)
  - Gemini 3.8 Flash TTS 오디오 $9/1M 토큰, Flash-Lite $6/1M, 초당 25토큰, 2027년 2배. — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
  - ElevenLabs 1K자당 Flash·v4 Turbo $0.04, v4·v3·v2 $0.08, v4 프로모 $0.022(~10/12). — [ElevenLabs API Pricing](https://elevenlabs.io/pricing/api)
  - Cartesia 약 1크레딧/자, Startup $49=1.25M, Pro $5=100K. — [Cartesia pricing](https://cartesia.ai/pricing), [Cartesia docs](https://docs.cartesia.ai/pricing)
  - Fish $15/M UTF-8 bytes, `s2.1-pro-free` $0. — [Fish pricing](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits)
  - MiniMax 2.8 Turbo $60, HD $100 per 1M. — [AA](https://artificialanalysis.ai/text-to-speech/leaderboard)
  - Inworld TTS-2 Flash $10.4, TTS-2 $20.8 per 1M. — [AA](https://artificialanalysis.ai/text-to-speech/leaderboard)
  - Typecast 1자=1크레딧, Lite $15=200k, Plus $280=4M. — [Typecast API](https://typecast.ai/developers/api/)
  - CLOVA Premium 기본료에 월 100만 자 포함. — [NCP](https://www.gov-ncloud.com/product/aiService/clovaVoice)

### Inferences
- **가정 (출처 없음)**
  - 과금 문자 수: 15,000자/일 × 30 = 450,000자/월(공백·구두점 포함).
  - 오디오 길이: 한국어 TTS가 공백 포함 초당 약 6~8자를 읽는다고 보면, 하루 약 31~42분, 월 약 940~1,250분입니다.
  - UTF-8 바이트: 한글 3바이트, 공백·기호 1바이트로 한글 비중 80%를 가정하면 약 2.6바이트/자, 월 약 117만 바이트입니다.
- **월 비용 추정** (캐시 미적용 기준)

| 엔진 | 계산 | 월 비용 |
|---|---|---|
| Google Chirp 3 HD | 45만 < 무료 100만 | **$0** (초과 시 $30/1M) |
| Azure Neural(F0) | 45만 < 50만, 한글 1자 과금 | **$0** (S0 약 $15/1M 시 $6.75) |
| Amazon Polly Neural(Seoyeon/Jihye) | 첫 12개월 월 1M 무료 | **$0**(1년차) → $7.20 |
| Polly Generative(Seoyeon) | (45만 − 10만) × $30/1M | 1년차 $10.50 → 이후 $13.50 |
| Gemini 3.8 Flash/Flash-Lite 무료 티어 | 무료(한도 미확인, 데이터가 학습·검토에 쓰임) | **$0** |
| Gemini 3.8 Flash-Lite TTS(유료) | $6/1M 토큰 × 25토큰/초 = $0.009/분 | 약 $8.5~11.3 (2027년 약 $17~22.5) |
| Gemini 3.8 Flash TTS(유료) | $0.0135/분 | 약 $12.7~16.9 (2027년 약 $25~34) + 입력 텍스트 약 $0.1~0.2 |
| OpenAI tts-1 / tts-1-hd | $15 / $30 per 1M | $6.75 / $13.50 |
| OpenAI gpt-4o-mini-tts | 약 $0.015/분 | 약 $14~19 |
| Inworld TTS-2 Flash / TTS-2 | $10.4 / $20.8 per 1M (AA) | 약 $4.7 / $9.4 |
| ElevenLabs Flash v2.5 · v4 Turbo(정가) | $0.04/1K | $18 (v4 Turbo 프로모 기간 약 $4.95) |
| ElevenLabs v4 · v3 · Multilingual v2(정가) | $0.08/1K | $36 (v4 프로모 기간 약 $9.90) |
| Fish Audio s2-pro/s1 | 약 117만 바이트 × $15/M | 약 $17.6 (`s2.1-pro-free`는 $0, 한도 미확인) |
| MiniMax 2.8 Turbo / HD | $60 / $100 per 1M | $27 / $45 |
| Cartesia Sonic 3.6 | 약 45만 크레딧 → Pro(10만) 부족 | Startup **$49** |
| Typecast | 45만 크레딧 → Lite(20만) 부족 | 캐시로 20만 이하면 $15, 아니면 Plus **$280** |
| CLOVA Voice Premium | 기본료에 100만 자 포함 | 기본료만(금액 미확인) |
| 로컬(Supertonic 3 / Qwen3-TTS / CosyVoice 등) | 전기료 | **$0** |

- **캐시 효과:** 고정 대사를 사전 렌더링하면 과금 대상은 Claude 답변 같은 고유 문장만 남습니다. 고정 대사 비중이 절반이면 위 비용도 절반이 됩니다. Typecast Lite나 ElevenLabs 저가 플랜으로도 가능해질 수 있습니다.
- **개인 앱 관점**
  - ElevenLabs, Typecast, Cartesia의 무료 플랜 비상업·출처표기 조건은 녹음물을 공개 배포하지 않는 한 실질적인 제약이 적습니다. 다만 무료 한도(1만~2만 자)가 너무 작아 테스트 용도로만 적합합니다.
  - Gemini 무료 티어는 비용은 0이지만, Claude 답변 원문(개인 작업 내용 포함 가능)이 Google의 학습·사람 검토 대상이 된다는 프라이버시 비용이 있습니다.

### Gaps
- 한국어 TTS의 실제 초당 문자 수(엔진·보이스별)는 확인하지 못했습니다. 시간 과금 엔진(OpenAI, Gemini)의 추정 오차 요인입니다.
- 무료 티어들의 속도 제한(RPM, 동시성)이 하루 300줄 패턴에 걸리는지.
- ElevenLabs 프로모 종료 후 플랜별 포함량, Typecast 초과 과금, CLOVA 기본료.

---

## 6. 추천 매트릭스 (초텐 = 귀엽고 발랄한 아이돌 / 아메 = 무표정·건조한 츤데레)

### Takeaway
- **품질 우선 클라우드:** ElevenLabs v4(Voice Design으로 두 캐릭터의 고유 보이스 제작 + 오디오 태그).
- **가성비·무료:** Gemini 3.8 Flash(-Lite) TTS. 보이스 30종에 자연어 스타일 지시, 2화자 동시 합성, 무료 티어가 있습니다.
- **한국어 캐릭터 톤 특화:** Typecast(애니·캐릭터 보이스, 감정 프리셋). 반드시 청취 테스트로 확인해야 합니다.
- **로컬:** 표현력은 Qwen3-TTS(VoiceDesign, mlx-audio), 단순·고속·순수 Node는 Supertonic 3(sherpa-onnx-node, 아카이브 감수).
- **최후 폴백:** macOS `say` Yuna.

### Cited Findings
- 근거 요약입니다(세부 출처는 1~4번 항목).
  - Eleven v4: AA 1위, 90개 이상 언어, Voice Design은 v4 사용 권장. — [AA](https://artificialanalysis.ai/text-to-speech/leaderboard), [ElevenLabs Voices](https://elevenlabs.io/docs/capabilities/voices)
  - Gemini 3.8 Flash TTS: AA 3위, 한국어 지원, `speech_metadata.style`, 2화자. — [Gemini speech generation](https://ai.google.dev/gemini-api/docs/speech-generation)
  - Typecast: Anime/Character/Kid Voices, 감정 프리셋(happy, toneup, tonedown, whisper 등), TTFB 170~210ms. — [Typecast API](https://typecast.ai/developers/api/)
  - Azure MAI-Voice-2 Haena: excited, joyful, embarrassed, surprised 등 13개 스타일. — [Azure language support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)
  - Qwen3-TTS VoiceDesign(한국어 포함 10개 언어, Apache-2.0), Supertonic 3(ko, 10 voices, Node 예제, 아카이브). — [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS), [sherpa-onnx](https://k2-fsa.github.io/sherpa/onnx/tts/all/Korean/supertonic-3-ko.html)
  - Inworld TTS-2 Flash 20ms TTFB, ElevenLabs Flash v2.5 ~75ms. — [Inworld docs](https://docs.inworld.ai/docs/tts/tts-models), [ElevenLabs Models](https://elevenlabs.io/docs/models)

### Inferences
| 범주 | 1순위 | 대안 | 이유 / 주의 |
|---|---|---|---|
| 최고 품질 클라우드 | **ElevenLabs Eleven v4** (+Voice Design) | Gemini 3.8 Flash TTS, Cartesia Sonic 3.6 | Elo 상위이고 한국어 지원. v4는 2026-09-28 출시 직후라 한국어 품질·SDK 지원을 직접 검증해야 함. 정가 $0.08/1K |
| 최고 무료/저가 | **Gemini 3.8 Flash-Lite/Flash TTS** (무료 티어 → 유료 월 약 $9~17) | Google Chirp 3 HD(월 100만 자 무료), Azure F0 | Chirp 3 HD와 Azure 일반 뉴럴은 감정 연기가 약함. Gemini 무료 티어는 데이터가 학습·검토에 쓰임 |
| 최고 로컬(표현력) | **Qwen3-TTS 1.7B** (mlx-audio, OpenAI 호환 서버) | CosyVoice 3, Chatterbox Multilingual V3 | VoiceDesign으로 복제 없이 고유 보이스 제작. RTF 약 0.8(M5 Pro), Python 사이드카 필요 |
| 최고 로컬(단순·고속) | **Supertonic 3** (sherpa-onnx-node) | MeloTTS | 순수 Node·CPU. 아카이브(업데이트 없음), 보이스 10종 고정, OpenRAIL-M |
| 최저 지연 | **Inworld TTS-2 Flash** (20ms) / **ElevenLabs Flash v2.5** (~75ms) | v4 Turbo(~100ms), Typecast(170~210ms), 로컬 Supertonic | 체감 지연은 문장 분할·캐시 설계가 더 크게 좌우 |
| 초텐(발랄 아이돌) | ElevenLabs Voice Design("밝고 높은 톤의 에너지 넘치는 애니 아이돌 소녀") + `[excited]`·`[giggles]` 태그 | Typecast 애니·캐릭터 보이스 + happy/toneup, Gemini Zephyr(Bright)·Puck(Upbeat)·Fenrir(Excitable) + "bubbly, cheerful" 스타일, Azure Haena(excited/joyful), CLOVA 'v' 화자 emotion=2 + alpha↑ | 과장된 톤은 엔진마다 편차가 커서 청취 테스트 필수 |
| 아메(무표정·건조) | Gemini Kore(Firm) + "flat, dry, terse, low energy, deadpan" 스타일 | OpenAI gpt-4o-mini-tts instructions("deadpan, monotone, minimal emotion"), Typecast tonedown, ElevenLabs Voice Design("차분하고 무심한 저음 소녀"), Azure SunHi/SeoHyeon(속도·피치 하향) | "…" 침묵은 텍스트 전처리로 쉼(예: Chirp `[pause long]`, 태그)으로 변환 |
| 오프라인 폴백 | Supertonic 3 | macOS `say -v Yuna` / Web Speech | Yuna는 super-compact 품질. 상위 품질은 수동 다운로드 필요 |

- **단일 엔진 운영이 목표라면 Gemini TTS**가 가장 균형이 좋습니다. 한 API 안에서 두 캐릭터를 보이스와 스타일로 분리할 수 있고, 두 사람이 주고받는 대사도 2화자 합성으로 한 번에 처리됩니다. 품질 최우선이면 **ElevenLabs v4**, 완전 무료·오프라인이면 **Qwen3-TTS(고정 대사 사전 렌더) + Supertonic 3(실시간 폴백)** 조합이 합리적입니다.
- **라이선스·동의 원칙**
  - 실존 인물, 연예인, 성우 음성을 클로닝하지 않습니다.
  - Voice Design(ElevenLabs, Qwen3-TTS, OmniVoice)이나 공식 프리셋 보이스로 고유 캐릭터 음성을 만듭니다.
  - 커뮤니티 공유 보이스(ElevenLabs Voice Library, Fish Audio 사용자 모델 등)는 원 목소리 주인의 동의 여부를 확인할 수 없으면 피합니다.
  - OpenAI는 AI 음성 고지 정책이 있고, Supertonic OpenRAIL-M에는 딥페이크 금지와 고지 없는 게시 금지 조항이 있습니다. Chatterbox는 워터마크가 내장돼 있습니다.

### Gaps
- 두 캐릭터 톤을 실제로 구현할 수 있는지(특히 한국어 "애니 아이돌" 톤의 과장 표현과 건조한 츤데레 톤)를 엔진별로 비교한 자료는 없습니다. 실제 대사로 블라인드 청취 테스트를 해야 합니다.
- Gemini TTS와 ElevenLabs v4의 한국어 오디오 태그·스타일 지시 준수도(영어 지시 vs 한국어 지시)는 미검증입니다.
- Typecast 애니 보이스의 한국어 제공 범위와 API 노출 여부(웹 에디터 전용 보이스가 있는지)는 미확인입니다.
