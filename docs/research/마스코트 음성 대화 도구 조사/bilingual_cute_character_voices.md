# 초텐·아메용 한·일 겸용 귀여운 여성 음성 — 일본어 애니풍 TTS, 언어 간 단일 보이스, 캐릭터별 후보, 라이선스·지연·비용

- 조사 기준일: 2026-09-30. 버전·날짜는 각 출처 기준이다.
- 표기
  - ⚠︎: 제3자 출처, 출처 간 충돌, 또는 오래됐을 수 있는 정보.
  - (검색 요약): 원문을 직접 열지 못하고 검색 결과 요약으로만 확인한 항목. 신뢰도가 한 단계 낮다.
  - (기존 노트): 같은 폴더의 `text_to_speech.md`, `character_voice_and_lipsync.md`에 이미 출처와 함께 정리된 값을 계산에만 재사용한 것. 이번 세션에서 다시 확인하지 않았다.
- 범위: 한국어 전용 엔진의 세부(한국어 보이스 목록, 가격표, 감정 매핑)는 기존 노트에 있으므로 반복하지 않는다. 이 노트는 일본어 지원, 귀여운 여성 보이스, 두 언어에서 같은 목소리를 유지하는 방법에 집중한다. 립싱크는 범위 밖이다.
- 캐릭터 전제
  - 초텐(超てんちゃん풍 방송 페르소나): 밝고 들뜬 아이돌 톤. 달고 귀엽고 흥분이 많다.
  - 아메(あめ풍): 조용하고 건조한 무표정, 에너지 낮은 츤데레. 그래도 귀여운 젊은 여성 목소리여야 한다(부드럽고, 약간 졸리고 무심한 느낌).
  - 둘 다 성인이다. 20대 초반 여성 목소리여야 하며 아동 톤은 피한다.

---

## 1. 일본어 특화(애니풍) TTS — 엔진, 귀여운 여성 보이스, 라이선스, macOS에서 Node로 구동

### Takeaway
macOS(Apple Silicon)에서 Node로 바로 부릴 수 있는 일본어 애니풍 엔진은 두 가지가 1순위다. 둘 다 로컬 HTTP 서버에 요청 두 번(쿼리 생성 → 합성)을 보내는 방식이고, 무료·오프라인이지만 **일본어 전용**이라 한국어는 다른 엔진이 필요하다.
- **VOICEVOX:** 0.25.2(2026-04-30)가 최신이고 arm64 빌드가 있으며 HTTP 포트는 50021이다. 캐릭터 약 40명에 스타일이 풍부하다.
- **AivisSpeech:** Style-Bert-VITS2 계열이고 HTTP 포트는 10101이며 VOICEVOX 호환 API를 제공한다. AivisHub 모델은 크레딧 표기 의무가 없다.

보조 후보는 COEIROINK(Mac 지원, 팬 캐릭터 사용을 약관에 명시적으로 허용), VOICEPEAK(유료, Mac CLI), Irodori-TTS(2026년 MIT 오픈 모델, 일본어 설명문으로 목소리 설계)다. **にじボイス는 2026-02-04에 API까지 종료돼 탈락**이다.

### Cited Findings

#### VOICEVOX (무료, 로컬, 일본어 전용)
- **버전과 macOS 빌드:** 최신은 0.25.2(2026-04-30)이고 `VOICEVOX.0.25.2-arm64.dmg`, `voicevox-macos-cpu-arm64-0.25.2.zip` 같은 Apple Silicon 에셋이 있다. 이 릴리스에서 夜語トバリ·暁記ミタマ·里石ユカ 세 캐릭터가 추가됐다. — [VOICEVOX Releases](https://github.com/VOICEVOX/voicevox/releases)
- **엔진 API**
  - 기본 포트는 50021이다.
  - 합성은 `/audio_query?speaker=<id>`로 쿼리를 받은 뒤 `/synthesis?speaker=<id>`에 POST하는 2단계다.
  - 쿼리에서 `speedScale`, `pitchScale`, `intonationScale`을 조절한다.
  - 엔진 라이선스는 LGPL v3와 소스 공개가 필요 없는 별도 라이선스의 이중 라이선스다.

  — [voicevox_engine README](https://github.com/VOICEVOX/voicevox_engine)
- **소프트웨어 이용규약**
  - 상업·비상업 모두 이용할 수 있다. 원문: 「商用・非商用問わず利用することができます」.
  - 크레딧 표기가 필수다. 원문: 「ご利用の際は VOICEVOX を利用したことがわかるクレジット表記が必要です」.
  - 금지 사항은 무단 재배포, 리버스 엔지니어링, 제작자·제3자에게 해를 끼치는 행위, 공서양속 위반이다.
  - 생성 음성은 각 음성 라이브러리(캐릭터) 규약을 따라야 한다. 페이지에 날짜 표기는 없다.

  — [VOICEVOX 이용규약](https://voicevox.hiroshiba.jp/term/)
- **캐릭터별 스타일(여성 위주 발췌).** 스타일은 [voicevox_vvm README](https://github.com/VOICEVOX/voicevox_vvm), 캐릭터 설명은 각 공식 제품 페이지 기준이다.

  | 캐릭터 | 스타일 | 공식 설명 |
  |---|---|---|
  | 四国めたん | ノーマル, あまあま, ツンツン, セクシー, ささやき, ヒソヒソ | 고교 2학년. 「はっきりした芯のある声」 — [제품 페이지](https://voicevox.hiroshiba.jp/product/shikoku_metan/) |
  | 春日部つむぎ | ノーマル | 사이타마의 갸루 고교생. 목소리는 "元気で明るい" — [제품 페이지](https://voicevox.hiroshiba.jp/product/kasukabe_tsumugi/) |
  | 冥鳴ひまり | ノーマル | 귀여운 것을 좋아하는 저승 사신. 목소리는 "柔らかく温かい" — [제품 페이지](https://voicevox.hiroshiba.jp/product/meimei_himari/) |
  | No.7 | ノーマル, アナウンス, 読み聞かせ | 정체를 알 수 없는 여성. 목소리는 "凛とした" — [제품 페이지](https://voicevox.hiroshiba.jp/product/number_seven/) |
  | 九州そら | ノーマル, あまあま, ツンツン, セクシー, ささやき | — |
  | 満別花丸 | ノーマル, 元気, ささやき, ぶりっ子, ボーイ | — |
  | ぞん子 | ノーマル, 低血圧, 覚醒, 実況風 | — |
  | 夜語トバリ (0.25.2 신규) | ノーマル, 明るい, 哀しみ, 呆れ | — |
  | 暁記ミタマ (0.25.2 신규) | ノーマル, 怒り, 哀しみ, ささやき | — |
  | あんこもん | ノーマル, つよつよ, よわよわ, けだるげ, ささやき | — |
  | ユーレイちゃん | ノーマル, 甘々, 哀しみ, ささやき, ツクモちゃん | — |
  | もち子さん | ノーマル, セクシー／あん子, 泣き, 怒り, 喜び, のんびり | — |
  | 猫使アル | ノーマル, おちつき, うきうき, つよつよ, へろへろ | — |
  | 猫使ビィ | ノーマル, おちつき, 人見知り, つよつよ | — |
  | WhiteCUL | ノーマル, たのしい, かなしい, びえーん | — |
  | 櫻歌ミコ | ノーマル, 第二形態, ロリ | — |
  | 雨晴はう, 小夜/SAYO, 春歌ナナ, 琴詠ニア, 東北ずん子 | ノーマル | — |

- **四国めたん·ずんだもん 공통 음원 규약(東北ずん子·ずんだもん 프로젝트)** — [zunko.jp 음원 이용규약](https://zunko.jp/con_ongen_kiyaku.html)
  - 상업·비상업 모두 가능하다.
  - 크레딧이 필수다(예: 「VOICEVOX:ずんだもん」). 동영상은 설명란이나 화면에, 앱은 소개(프로모션) 영역에 표기한다.
  - 금지 사항은 공서양속 위반, 정치·종교 활동, 특정 대상 비방, 허위정보, 성산업 용도, 반사회 세력 관여다.
  - 크레딧을 생략하려면 캐릭터당 ¥400,000의 상용 계약이 필요하다.
  - 다른 캐릭터의 목소리로 쓰는 것과 AI 학습·음성 변환에 대한 명시 조항은 없다. 날짜·버전 표기도 없다.
- **冥鳴ひまり 규약** — [冥鳴ひまり 이용규약](https://www.meimeihimari.com/terms-of-use)
  - 상업·비상업 모두 가능하고 신고나 신청이 필요 없다.
  - 크레딧은 필수지만 형식은 지정하지 않는다.
  - 금지 사항은 공서양속 위반, 제3자 피해, 특정 사상·단체를 겨냥한 콘텐츠, 제작자가 부적절하다고 판단한 콘텐츠다.
  - **오리지널 캐릭터와 기존 캐릭터 모두의 목소리로 쓸 수 있다.** 기존 IP 캐릭터에 쓸 때는 그 IP 권리자의 규약을 따로 확인해야 한다.
  - AI 학습에 관한 언급은 없다.
- ⚠︎ 春日部つむぎ (검색 요약) — [crystal-method: VOICEVOX 상용 이용](https://crystal-method.com/blog/voicevox-commercial/)
  - 「VOICEVOX:春日部つむぎ」 크레딧을 달면 상업·비상업 모두 이용할 수 있다.
  - 목소리는 VTuber 春日部つくし의 목소리를 바탕으로 만들어졌다.
  - 공식 규약 URL은 `tsumugi-official.studio.site/rule`이지만 JS 렌더링 페이지라 본문을 추출하지 못했다.
- ⚠︎ No.7 (검색 요약) — [crystal-method: VOICEVOX 상용 이용](https://crystal-method.com/blog/voicevox-commercial/)
  - 「VOICEVOX:No.7」 크레딧을 달면 비상업 용도로 쓸 수 있다(동인 활동·방송 수익은 가능).
  - 그 밖의 상업 용도는 No.7製作委員会에 사전 확인이 필요하다.

#### AivisSpeech (Style-Bert-VITS2 계열, 무료, 로컬, 일본어 전용)
- **지원 OS:** Windows 10(22H2 이후)·11, macOS 13 Ventura 이후. Intel Mac은 적극적으로 검증하지 않으므로 Apple Silicon을 권장한다. — [AivisSpeech-Engine README](https://github.com/Aivis-Project/AivisSpeech-Engine)
- **HTTP API**
  - 기본 포트는 10101이고 `--port`로 바꿀 수 있다.
  - VOICEVOX ENGINE API와 대체로 호환된다. 단, `intonationScale`은 전체 억양 폭이 아니라 "感情表現の強さ(감정 표현 강도)"를 뜻한다.
  - 노래 합성, 모핑 등 일부 엔드포인트는 지원하지 않는다.

  — [AivisSpeech-Engine README](https://github.com/Aivis-Project/AivisSpeech-Engine)
- **모델 설치:** AIVMX 형식 모델을 macOS에서는 `~/Library/Application Support/AivisSpeech-Engine/Models`에 둔다. 첫 기동 때 기본 모델 약 250MB와 BERT 약 650MB를 내려받는다. — [README](https://github.com/Aivis-Project/AivisSpeech-Engine)
- **추론 장치:** ONNX Runtime으로 CPU 추론을 최적화했다. `--use_gpu`는 전용 GPU용이며, 내장 GPU는 보통 CPU보다 느리다. — [README](https://github.com/Aivis-Project/AivisSpeech-Engine)
- **라이선스와 크레딧:** 엔진은 LGPL-3.0이다. ACML/ACML-NC/CC0 모델은 원문 「クレジット表記の義務はありません」, 즉 크레딧 표기 의무가 없다. — [README](https://github.com/Aivis-Project/AivisSpeech-Engine)
- AivisHub의 모든 모델은 라이선스가 ACML, ACML-NC, 퍼블릭 도메인(CC0) 중 하나로 통일돼 있다(검색 요약). — [窓の杜](https://forest.watch.impress.co.jp/docs/news/1641373.html)
- **ACML 1.0** — [ACML-1.0.md](https://raw.githubusercontent.com/Aivis-Project/ACML/master/ACML-1.0.md)
  - 크레딧은 선택이다(「クレジット表記は任意です」). 금지 행위에 해당하지 않으면 상업·비상업 모두 가능하다.
  - 금지: 원 화자나 무관한 타인의 「本人」「原作者」「公式関係者」로 오인시키거나 속이는 이용.
  - 금지: 비판·공격·괴롭힘·비방·차별, 허위 정보, 허위·과장 마케팅, 정치·종교·음모론 선전, 범죄·반사회 목적.
  - ACML-NC는 비상업 용도로 한정된다. — [ACML 저장소](https://github.com/Aivis-Project/ACML)
- **기본 모델 Anneli의 스타일:** ノーマル, 通常, テンション高め, 落ち着き, 上機嫌, 怒り・悲しみ(2024-11-24 스크랩 기준). API 호출은 `GET /speakers`, `POST /audio_query`, `POST /synthesis` 순서다. — [Zenn kun432 스크랩](https://zenn.dev/kun432/scraps/d5f16386a23c28)

#### COEIROINK (무료, 로컬)
- **약관(2025-09-29 갱신)** — [COEIROINK 이용규약](https://coeiroink.com/terms)
  - 상업·비상업 모두 가능하다. 다만 보이스 라이브러리 쪽이 상업 이용을 금지하면 그 규정이 우선한다.
  - 크레딧에는 "COEIROINK"와 음성 캐릭터 이름을 함께 표기한다.
  - 금지 사항
    - 소프트웨어·모델 재배포.
    - 제공 모델로 전이학습(MYCOEIROINK 공식 절차는 예외).
    - COEIROINK 엔진 밖에서 모델 실행.
    - **머신러닝 학습 데이터로 사용**.
    - 개인 공격, 조닝(연령·수위 구분) 우회.
  - **팬 캐릭터 등 다른 캐릭터에 쓰는 것은 "어느 음성을 어느 캐릭터에 썼는지" 크레딧하면 허용된다.**
  - 캐릭터별 규약은 각 캐릭터 페이지에 있다.
- ⚠︎ Windows, macOS, Linux를 지원하며 최신 버전은 v2.13.0(2026-03)이다(검색 요약). — [crystal-method: COEIROINK](https://crystal-method.com/blog/coeiroink/)

#### にじボイス (NIJI Voice) — 종료
- 2026-02-04에 서비스가 종료됐고, 기업용 API도 함께 끝났다. 운영사는 Algomatic(DMM 자회사)이다. — [PC Watch 2025-11-25](https://pc.watch.impress.co.jp/docs/news/2065958.html)
- 종료 경위 — [PC Watch 2025-11-25](https://pc.watch.impress.co.jp/docs/news/2065958.html)
  - 日本俳優連合이 캐릭터 목소리가 회원의 목소리와 「酷似している」고 문제를 제기했다.
  - 회사는 「法的に権利侵害は認められなかった」라고 밝혔다.
  - 그럼에도 성우들의 우려가 계속될 것이라며 서비스 종료를 택했다.

#### Irodori-TTS (2026, Aratako, 오픈 모델)
- **500M-v3** — [HF Aratako/Irodori-TTS-500M-v3](https://huggingface.co/Aratako/Irodori-TTS-500M-v3)
  - 약 500M 파라미터이고, 코드와 가중치 모두 MIT다.
  - **일본어 텍스트 전용**이다.
  - 이모지로 스타일과 효과음을 제어하고, 참조 음성으로 제로샷 클로닝을 한다.
  - 모델 카드는 한자 읽기 정확도가 같은 규모 모델보다 약하다고 스스로 밝힌다.
  - 동의 없는 개인 목소리 복제·사칭, 딥페이크, 허위정보 생성을 금지한다.
- **500M-v2-VoiceDesign** — [HF Aratako/Irodori-TTS-500M-v2-VoiceDesign](https://huggingface.co/Aratako/Irodori-TTS-500M-v2-VoiceDesign)
  - 참조 음성 없이 일본어 설명문(캡션)으로 음색·나이·성별·감정을 지정해 목소리를 만든다.
  - 캡션 예시: "낮은 목소리의 여성이 초조함을 숨기며 서둘러 말함", "젊은 여성이 혼란스러워하며 혼잣말하듯 속삭임".
  - MIT, 일본어 전용이며 Apple Silicon 요구사항은 적혀 있지 않다.
- ⚠︎ v3는 2026년 5~6월 공개로, 음질 개선·출력 길이 지정·웹 UI 이모지 팔레트를 추가했다. NVIDIA GPU에서는 몇 초 만에 생성하고 CPU로도 돌릴 수 있다(검색 요약). — [GIGAZINE 2026-06-07](https://gigazine.net/news/20260607-irodori-tts-v3/), [GIGAZINE 2026-05-04](https://gigazine.net/news/20260504-irodori-tts-text-to-speech-ai/)

#### 상용 소프트웨어·기타 (VOICEPEAK, A.I.VOICE2, CoeFont, Kokoro)
- ⚠︎ **VOICEPEAK** (검색 요약)
  - Dreamtonics가 개발하고 AHS가 판매하며 Windows·Mac·Linux를 지원한다. 라이선스는 OS 간 공용이다. — [crystal-method: VOICEPEAK](https://crystal-method.com/blog/voicepeak/)
  - 「商用可能」 나레이터 세트는 개인·법인이 개별 연락 없이 상업 이용할 수 있다. — [crystal-method: VOICEPEAK](https://crystal-method.com/blog/voicepeak/)
  - 小春六花(TOKYO6 ENTERTAINMENT)는 VOICEPEAK 등 여러 합성 소프트웨어용 보이스 라이브러리를 가진 캐릭터다. — [萌娘百科: 小春六花](https://zh.moegirl.org.cn/%E5%B0%8F%E6%98%A5%E5%85%AD%E8%8A%B1)
- ⚠︎ **voicepeak-mcp**(`npx voicepeak-mcp@latest`)는 설치된 VOICEPEAK을 명령줄로 호출한다(검색 요약). — [glama: voicepeak-mcp](https://glama.ai/mcp/servers/k2wanko/voicepeak-mcp)
  - 파라미터: narrator, emotion, speed(50~200), pitch(−300~300), 출력 파일.
  - 1회 합성 텍스트는 최대 140자다.
- ⚠︎ **A.I.VOICE2**는 판매 표기상 Windows와 Apple silicon Mac을 지원한다(검색 요약). 외부 API나 CLI 자동화 수단은 확인하지 못했다. — [ビックカメラ 판매 페이지](https://www.biccamera.com/bc/item/12589547/)
- ⚠︎ **CoeFont**는 API 문서 v2.0.3을 공개하고 있다. "日·英·中·韓·仏·西·越 7개 언어" 언급은 통역 제품(CoeFont通訳) 맥락일 수 있다(검색 요약). — [CoeFont API docs](https://docs.coefont.cloud/en/)
- **Kokoro**는 mlx-audio에서 일본어 보이스(`jf_alpha`, `jm_kumo` 등)를 제공하며 `misaki[ja]` 설치가 필요하다. — [mlx-audio](https://github.com/Blaizzy/mlx-audio)

### Inferences
- **Node 연동:** VOICEVOX와 AivisSpeech는 둘 다 로컬 HTTP 서버에 2단계 호출(`audio_query` → `synthesis`)을 하는 구조다. 같은 클라이언트 코드를 포트(50021 / 10101)만 바꿔 재사용할 수 있다. 앱이 엔진 프로세스를 자식 프로세스로 띄우거나, 사용자가 앱을 켜 두는 방식 중 하나를 택하면 된다.
- **캐릭터 매칭(스타일 이름과 공식 설명 기반 추정, 청취 확인 필요)**
  - **초텐:**
    - 春日部つむぎ(元気で明るい)
    - 満別花丸 元気·ぶりっ子
    - 四国めたん あまあま
    - 夜語トバリ 明るい
    - 猫使アル うきうき, WhiteCUL たのしい, ユーレイちゃん 甘々
    - AivisSpeech Anneli テンション高め·上機嫌
  - **아메:**
    - 冥鳴ひまり(柔らかく温かい)
    - ぞん子 低血圧(졸리고 기운 없는 톤으로 추정)
    - 夜語トバリ 呆れ(어이없어하는 톤)
    - あんこもん けだるげ(나른함)
    - 四国めたん·九州そら ツンツン(츤)
    - 猫使ビィ おちつき·人見知り
    - AivisSpeech Anneli 落ち着き
  - 夜語トバリ(明るい ↔ 呆れ)와 Anneli(テンション高め ↔ 落ち着き)는 한 화자 안에 두 캐릭터 톤이 모두 있다. "초텐은 아메의 방송 페르소나"라는 원작 설정(기존 노트 참고)에 맞춰 한 목소리로 둘을 연기하는 선택지가 된다.
- **성인 톤 주의:**
  - 春日部つむぎ·四国めたん은 설정상 고교생이다. 아동 목소리는 아니지만 "20대 초반"의 인상이 필요하면 pitchScale을 조금 낮추거나 설정상 성인인 캐릭터를 우선한다. 冥鳴ひまり(사신), No.7(여성)이 그런 예다.
  - 櫻歌ミコ의 「ロリ」 스타일처럼 아동을 지향하는 스타일은 제외한다.
- **にじボイス 종료가 주는 교훈:** "원작 성우와 비슷하게 들리는 합성 목소리"만으로도 일본 성우계에서 분쟁이 된다. 공개 배포를 하지 않더라도 성우 유사성을 목표로 튜닝하지 않는 것이 안전하다(4절).
- **오프라인 일본어 품질의 한계:** 애니풍 일본어 품질과 스타일 폭은 전용 엔진(VOICEVOX, AivisSpeech)이 다국어 엔진의 기본 보이스보다 유리할 가능성이 크다. 다만 이것은 전용 엔진이 애니풍을 목적으로 설계됐다는 데서 나온 추정이고, 비교 청취 자료는 찾지 못했다.

### Gaps
- VOICEVOX, AivisSpeech, Irodori-TTS의 Apple Silicon 합성 속도(RTF, 첫 음성까지 걸리는 시간)는 공식 수치도 독립 벤치마크도 찾지 못했다.
- 규약 원문을 직접 확인하지 못한 캐릭터가 있다.
  - 春日部つむぎ·No.7: 검색 요약으로만 확인했다.
  - ぞん子·夜語トバリ·あんこもん 등: 조사하지 않았다.
  - 확인할 쟁점은 "다른 캐릭터(기존 IP)의 목소리로 쓸 수 있는가"다.
- ACML-NC 원문, AivisHub의 인기 여성 모델 이름과 각 모델 학습 음성의 출처 검증 절차를 확인하지 못했다.
- SHAREVOX 개발 상태(VOICEVOX 호환이라고만 알려짐), A.I.VOICE2의 자동화 API 유무, VOICEPEAK CLI 자동 호출이 라이선스상 허용되는 범위, CoeFont TTS의 한국어 지원 여부가 남아 있다.

---

## 2. 한 목소리로 한·일 두 언어 — 다국어 엔진의 단일 보이스와 억양 전이

### Takeaway
"같은 목소리로 한국어와 일본어를 모두 말하게 하기"는 다국어 엔진에서만 된다. 후보는 ElevenLabs, Gemini, Qwen3-TTS, MiniMax, Azure 다국어 보이스, Typecast, Hume Octave 2, Fish다.

다만 대부분 "목소리 정체성은 유지되지만 원래 억양도 따라온다"는 구조다.
- **ElevenLabs:** 억양이 언어를 넘어 유지된다고 공식적으로 밝힌다. 대신 **Voice Remix로 정체성을 유지한 채 억양만 바꿀 수 있어**, 캐릭터당 "일본어 억양판·한국어 억양판" 두 개의 voice_id를 만드는 것이 가장 확실한 경로다.
- **Gemini:** 30개 프리셋 보이스가 언어와 무관하고 ja-JP·ko-KR 모두 GA다. 3.8부터는 설명문으로 영구 보이스를 설계할 수 있다.
- **Qwen3-TTS:** 일본어 여성 Ono_Anna와 한국어 여성 Sohee를 제공하고 교차언어가 가능하지만, 공식적으로 모국어 사용을 권장한다.
- **OpenAI:** 일본어에서 미국식 억양이 강하다는 커뮤니티 평가가 있다.

**한·일 양쪽을 같은 목소리로 네이티브처럼 말하는지 검증한 독립 자료는 찾지 못했다.** 따라서 청취 테스트가 필수다.

### Cited Findings

#### ElevenLabs
- 다국어에서 억양이 유지된다고 명시한다. 원문: "the speaker's unique voice characteristics are maintained across all languages, including their original accent"(Multilingual v2 발표, 2023-08-22). — [ElevenLabs 블로그](https://elevenlabs.io/blog/elevenlabs-comes-out-of-beta-and-releases-eleven-multilingual-v2-a-foundational-ai-speech-model-for-nearly-30-languages)
- **Voice Remixing** — [ElevenLabs Voice remixing 문서](https://elevenlabs.io/docs/overview/capabilities/voice-remixing)
  - 리믹스할 수 있는 보이스: 본인이 만든 클론(IVC/PVC), **Voice Design으로 만든 보이스**, Voice Library에서 notice 기간이 무기한인 보이스.
  - 바꿀 수 있는 속성: 성별, **억양**, 말투, 페이스, 음질.
  - 프롬프트 강도
    - Low: "Subtle changes that maintain most of the original voice characteristics".
    - Medium: "Balanced transformation that modifies key attributes while preserving voice identity".
    - High: 톤이 크게 바뀔 수 있다.
    - Max: 목소리가 완전히 바뀐다.
  - 결과물은 v3에서 풀 품질이고, 다른 모델과도 하위 호환된다. 비용은 리믹스에 쓴 테스트 스크립트 길이로 계산한다.
- ⚠︎ 억양을 바꿀 때는 베이스 보이스와 목표 억양의 조합이 중요하며, 몇 번 시도해야 할 때도 있다(검색 요약). 같은 요약에는 "Voice Library 보이스는 리믹스할 수 없다"는 문장도 있어, 문서 본문의 "무기한 notice 보이스는 가능"과 충돌한다. — [ElevenLabs docs 검색 결과](https://elevenlabs.io/docs/capabilities/voice-remixing)
- ⚠︎ 2025-06-06 공개된 Eleven v3(알파)에서 일본어 낭독이 가능해졌다(검색 요약). — [GIGAZINE 2025-06-06](https://gigazine.net/news/20250606-eleven-labs-eleven-v3)
- ⚠︎ 일본 블로그 검증에서는 일본어 특화 보이스("Ishibashi - Strong Japanese Male Voice")가 다른 보이스보다 억양·템포가 자연스러웠다고 한다(검색 요약). — [giftx: ElevenLabs 일본어](https://ai.giftx.co.jp/blog/elevenlabs-japanese/)

#### Google — Gemini TTS / Chirp 3 HD
- Cloud TTS의 Gemini-TTS는 ja-JP·ko-KR을 모든 모델(gemini-3.1-flash-tts-preview, 2.5 flash/pro/flash-lite)에서 **GA**로 표기한다. 보이스 이름은 전 언어 공통이다. — [Cloud Gemini-TTS 문서](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts)
- 여성 보이스는 14종이다: Achernar, Aoede, Autonoe, Callirrhoe, Despina, Erinome, Gacrux, Kore, Laomedeia, Leda, Pulcherrima, Sulafat, Vindemiatrix, Zephyr. — [Cloud Gemini-TTS 문서](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts)
- 공식 한 단어 설명은 다음과 같다(Laomedeia의 설명어는 이번 추출에서 얻지 못함). — [Gemini API speech generation](https://ai.google.dev/gemini-api/docs/speech-generation)
  - Zephyr Bright, Kore Firm, **Leda Youthful**, Aoede Breezy, Callirrhoe Easy-going, Autonoe Bright
  - Despina Smooth, Erinome Clear, **Achernar Soft**, Gacrux Mature, Pulcherrima Forward, **Vindemiatrix Gentle**, Sulafat Warm
- 입력 언어는 자동 감지된다("The TTS models detect the input language automatically"). 억양은 Extended Voice Library에서 `region_code`, `accent`, `language_code`로 보이스를 골라 제어한다. — [Gemini API speech generation](https://ai.google.dev/gemini-api/docs/speech-generation)
- **Voice Design** (Gemini 3.8 Flash / Flash-Lite TTS, 문서 2026-09-24 갱신) — [Gemini API Voice design](https://ai.google.dev/gemini-api/docs/voice-design)
  - `POST /v1beta/voices`에 `type: "prompted"`와 `prompted.input`(설명문)을 보낸다. `display_name`, `gender`, `language_code` 등의 필드도 함께 쓴다.
  - 영구 `voice_...` ID가 발급된다. TTL은 1년이고 프로젝트당 200개까지다.
  - 모범 예시처럼 설명문에 억양을 넣을 수 있다.
  - 한 보이스가 여러 언어를 말할 수 있는지는 명시돼 있지 않다.
- 목소리 복제(`type="replicated"`)는 참조 음성과 **동의 음성**이 필요하다. — [Gemini API speech generation](https://ai.google.dev/gemini-api/docs/speech-generation)
- **일본어 평가**(Gemini 3.1 Flash TTS, 2026-04-16 작성·08-10 갱신) — [digirise: Gemini 3.1 Flash TTS](https://digirise.ai/chaen-ai-lab/gemini-3-1-flash-tts/)
  - 장면에 맞춰 억양을 자동으로 조정한다.
  - 사과문 같은 정형구는 평탄하게 들린다.
  - `[丁寧に]`, `[ゆっくり]`, `[申し訳なさそうに]` 같은 일본어 태그가 동작한다.
  - 일본어 설명: Zephyr 「明るい・女性」, Kore 「落ち着いた・女性」.
- **Chirp 3 HD** — [Chirp 3 HD 문서](https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd)
  - ja-JP·ko-KR 모두 GA다. 보이스 이름 형식은 `<locale>-<model>-<voice>`(예: `ja-JP-Chirp3-HD-Leda`)이고, 여성 페르소나 목록은 Gemini와 같다.
  - 로캘이 달라도 같은 화자인지는 문서에 없다.

#### OpenAI
- 커뮤니티 스레드(2025-10-25~11-01) 내용 — [OpenAI Community: soft and cute female voice](https://community.openai.com/t/how-to-get-a-soft-and-cute-female-voice-with-openai-tts/1363873)
  - 부드럽고 귀여운 여성 목소리를 찾던 사용자가 모든 보이스를 시험했지만 맞는 것이 없었다. 다른 사용자가 "sage"가 가장 적응력이 좋다고 제안했다.
  - 일본어 학습 용도에 대해 "The OpenAI AI models are going to give you a significant American foreigner accent"라는 지적이 나왔다.
  - OpenAI 직원 답변은 없다.

#### Qwen3-TTS (오픈 웨이트 + 클라우드)
- **CustomVoice 프리셋** — [Qwen3-TTS README](https://github.com/QwenLM/Qwen3-TTS)
  - `Ono_Anna`: "Playful Japanese female voice with a light, nimble timbre"(모국어 일본어).
  - `Sohee`: "Warm Korean female voice with rich emotion"(모국어 한국어).
  - 각 화자는 10개 언어를 모두 말할 수 있지만, 문서는 각 화자의 모국어 사용을 권장한다.
- Base 모델은 3초 참조 음성으로 다국어 클로닝을 하며, 언어 쌍 간 "strong performance"를 보였다고 한다. — [Qwen3-TTS README](https://github.com/QwenLM/Qwen3-TTS)
- ⚠︎ **일관된 캐릭터 목소리 절차(검색 요약, Qwen3-TTS 문서 미러)** — [Qwen3-TTS voice cloning 가이드](https://mintlify.com/QwenLM/Qwen3-TTS/guides/voice-cloning)
  1. VoiceDesign의 `generate_voice_design`으로 짧은 레퍼런스 클립을 만든다.
  2. Base 모델의 `create_voice_clone_prompt`로 재사용 프롬프트를 만든다.
  3. `generate_voice_clone`으로 대사를 생성한다.
  - VoiceDesign을 매번 호출할 때 목소리가 조금씩 달라지는 문제를 피하는 권장 절차다.
- **mlx-audio 지원** — [mlx-audio](https://github.com/Blaizzy/mlx-audio)
  - Qwen3-TTS CustomVoice와 VoiceDesign 모델(0.6B/1.7B)을 예시로 든다.
  - `--voice`로 프리셋 화자를 고르고, `--stream`으로 스트리밍한다.
  - OpenAI 호환 `POST /v1/audio/speech`를 제공한다.
- ⚠︎ **클라우드 Qwen3-TTS-Flash** (검색 요약) — [DeepInfra Qwen3-TTS](https://deepinfra.com/Qwen/Qwen3-TTS/api), [OpenRouter qwen-audio-3.0-tts-flash](https://openrouter.ai/qwen/qwen-audio-3.0-tts-flash/api)
  - 보이스 49종 이상, 10개 언어이며 일본어 Ono Anna(日语-小野杏)와 한국어 Sohee(韩语-素熙)를 포함한다.
  - DeepInfra는 1M자당 $20, OpenRouter는 1M자당 $15다.

#### MiniMax Speech
- **일본어 시스템 보이스 15종** — [MiniMax system voice ID](https://platform.minimax.io/docs/faq/system-voice-id)
  - Japanese_IntellectualSenior, Japanese_DecisivePrincess, Japanese_LoyalKnight, Japanese_DominantMan, Japanese_SeriousCommander
  - Japanese_ColdQueen, Japanese_DependableWoman, Japanese_GentleButler, Japanese_KindLady, Japanese_CalmLady
  - Japanese_OptimisticYouth, Japanese_GenerousIzakayaOwner, Japanese_SportyStudent, Japanese_InnocentBoy, Japanese_GracefulMaiden
- **한국어 시스템 보이스 49종 중 여성·소녀 계열로 보이는 이름**
  - Korean_SweetGirl, Korean_CheerfulLittleSister, Korean_ChildhoodFriendGirl, Korean_AirheadedGirl, Korean_QuirkyGirl, Korean_SassyGirl, Korean_ShyGirl
  - Korean_ColdGirl, Korean_MysteriousGirl, Korean_HaughtyLady, Korean_ElegantPrincess, Korean_EnchantingSister, Korean_CharmingSister, Korean_CalmLady 등
  - 문서에는 성별·나이 메타데이터가 없어 이름으로 분류했다. 문서 날짜도 없다.

  — [MiniMax system voice ID](https://platform.minimax.io/docs/faq/system-voice-id)
- **T2A API** — [MiniMax T2A HTTP](https://platform.minimax.io/docs/api-reference/speech-t2a-http)
  - 모델: speech-2.8-hd/turbo, 2.6, 02, 01.
  - `language_boost`: Japanese, Korean, auto 등 40개 이상 값을 받는다.
  - `voice_setting`: speed [0.5, 2.0], vol (0, 10], pitch [−12, 12].
  - emotion: happy, sad, angry, fearful, disgusted, surprised, calm, fluent, whisper(모델마다 다름).
  - 스트리밍을 지원하고, 입력은 10,000자 미만이다.

#### Azure AI Speech
- **ja-JP 보이스** — [Azure language support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)
  - 일반 뉴럴: Nanami(여, 스타일 chat·cheerful·customerservice), Aoi(여), Mayu(여), Shiori(여), Keita·Daichi·Naoki(남).
  - HD: Nanami·Masaru(DragonHDLatestNeural).
  - 다국어: MasaruMultilingual(남).
  - MAI-Voice-2-Flash: **Sakura(여)**·Haruto(남).
- ⚠︎ 출처 충돌: MAI-Voice 문서(2026-07-23 갱신)의 프리빌트 표에는 ja-JP 보이스가 없다. 여성 한국어 보이스 이름도 이 문서는 Hana로, 언어 지원 페이지는 Haena로 적는다. — [MAI-Voice 문서](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices)
- **다국어 보이스** — [Azure language support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)
  - ko-KR·ja-JP 로캘에는 **여성 다국어 보이스가 없다**. ko-KR은 HyunsuMultilingual(남)뿐이다.
  - 여성 다국어 보이스는 en-US의 Ava, Amanda, Emma, Phoebe, Cora, Evelyn, Jenny, Lola 등이다.
  - Nancy는 excited, friendly, funny, relieved, shy 스타일을 지원한다.
  - Serena는 empathetic, excited, friendly, relieved, sad, serious, shy 스타일을 지원한다.
- 다국어 보이스는 SSML로 말하는 언어를 바꿀 수 있다. — [Azure TTS overview](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech)

#### Typecast / CLOVA Voice / Hume Octave 2 / Fish Audio
- **Typecast** — [Typecast Japanese TTS](https://typecast.ai/languages/japanese-text-to-speech/)
  - 프로젝트 언어를 일본어로 고르면 "all of our AI voice characters speak with a native Japanese accent"라고 주장한다.
  - 일본어 여성 보이스 예시는 Miu Kobayashi, Miki Yamamoto다.
  - 35개 이상 언어를 지원하며 API가 있다. 벤더 페이지이고 날짜 표기는 없다.
- **CLOVA Voice Premium 일본어 화자** — [NCP CLOVA Voice Premium API](https://api.ncloud-docs.com/docs/ai-naver-clovavoice-ttspremium)
  - 여성: dnaomi(파생으로 dnaomi_formal 뉴스체, dnaomi_joyful 기쁨), driko, deriko, dmio, dsayuri, dtomoko, nnaomi, nsayuri, ntomoko.
  - 남성: dayumu, ddaiki, dhajime, shinji.
  - 모두 성인이다.
  - 두 언어 겸용 화자는 한국어·영어 조합(dara-danna, dsinu-matt)뿐이다.
- ⚠︎ **Hume Octave 2**(프리뷰, 검색 요약) — [Hume 블로그: Octave 2](https://hume.ai/blog/octave-2-launch)
  - 영어·일본어·한국어 등 11개 언어를 지원한다.
  - 텍스트 프롬프트로 목소리를 만들고, Action Instructions로 기존 목소리의 스타일을 바꾼다.
- **Fish Audio S2 Pro** — [HF fishaudio/s2-pro](https://huggingface.co/fishaudio/s2-pro)
  - 일본어는 Tier 1, 한국어는 Tier 2다.
  - Fish Audio Research License: 연구·비상업은 무료이고 상업은 별도 계약이 필요하다.
- ⚠︎ **Fish Audio 커뮤니티 모델과 약관**(검색 요약)
  - fish.audio에는 "アニメ声", "元気なアニメ声" 같은 사용자 업로드 모델이 많다. — [fish.audio 모델 예시](https://fish.audio/m/7a574cafcc974f87a0d66c1c70ae4484)
  - 약관(2024-08-18 발효, Hanabi AI)은 타인 사칭을 금지한다. — [fish.audio Terms](https://fish.audio/terms)

### Inferences
- **억양 전이 위험도(근거 수준을 함께 표기한 추정)**

  | 엔진 | 추정 위험도 | 근거 |
  |---|---|---|
  | OpenAI | 높음 | 커뮤니티 평가 |
  | ElevenLabs(리믹스 없이) | 높음 | 공식 문서: 원래 억양 유지 |
  | Qwen3 프리셋의 비모국어 | 중간~높음 | 공식 문서: 모국어 권장 |
  | Gemini 프리셋·Chirp 3 HD, MiniMax(`language_boost`), Azure en-US 다국어, Typecast | 미확인 | 근거 없음 |

- **가장 확실한 "한 목소리, 두 언어" 절차: ElevenLabs**
  1. Voice Design으로 캐릭터당 베이스 보이스 1개를 만든다. 설명문은 "20대 초반 동아시아 여성, 억양 중립" 식으로 쓴다.
  2. Remix를 Low 또는 Medium 강도로 두 번 돌린다. 한 번은 "native Japanese accent", 한 번은 "native Korean (Seoul) accent"다.
  3. 결과로 캐릭터당 `voice_id` 두 개(ja/ko)를 얻는다. 문서상 Medium은 정체성을 보존하므로 "같은 사람이 두 언어를 네이티브로 말하는" 결과에 가장 근접할 것으로 본다.
  - 실제 ko/ja 억양 변환 품질은 미검증이라 청취가 필요하다.
- **가장 단순한 경로: Gemini 프리셋 보이스**
  - 프리셋 보이스는 언어 공통이고 ja/ko 모두 GA라, 같은 보이스 이름(예: Leda)을 두 언어에 그대로 쓰면 된다.
  - Voice Design으로 만든 보이스는 생성할 때 `language_code`를 지정한다. 다른 언어로 말하게 했을 때의 품질은 따로 확인해야 한다.
- **로컬 경로: Qwen3-TTS**
  - Ono_Anna(일본어 모국어)로 한국어를 말하게 해 억양을 확인한다.
  - 또는 VoiceDesign으로 만든 레퍼런스를 Base로 교차언어 복제한다.
  - Apple Silicon 속도는 기존 노트의 수치(M5 Pro 4-bit 기준 RTF 약 0.8, PyTorch MPS는 약 3)를 참고한다.
- **MiniMax, Azure, CLOVA는 언어별 네이티브 보이스를 따로 고르는 편이 현실적이다.** 이 경우 캐릭터의 목소리가 언어마다 달라진다. MiniMax는 한 보이스에 `language_boost`를 걸어 다른 언어를 말하게 할 수 있지만 억양은 검증이 필요하다.
- **Typecast의 "일본어 선택 시 모든 캐릭터가 네이티브 억양"이 사실이라면** 한국어 캐릭터 한 명으로 일본어까지 말하게 할 수 있다. 벤더 주장이므로 청취로 확인한다.
- **금지된 우회:** 일본어 전용 엔진의 음성(VOICEVOX 등)을 레퍼런스로 다국어 모델에 복제해 "같은 목소리의 한국어"를 만드는 방법은 쓰지 않는다. 약관(COEIROINK는 ML 학습 데이터 사용을 명시 금지)과 "실존 목소리 복제 금지" 원칙에 걸린다(4절).

### Gaps
- 한·일 전용 청취 비교나 언어별 리더보드는 찾지 못했다. Artificial Analysis 등의 Elo는 언어를 나누지 않는다(기존 노트).
- Gemini 프리셋·설계 보이스, MiniMax, Azure 다국어, Typecast, Hume Octave 2 보이스가 모국어가 아닌 쪽(ko 또는 ja)에서 어떤 억양을 내는지는 미검증이다.
- ElevenLabs Remix로 한국어·일본어 억양을 바꾼 사례나 품질 평가는 없다.
- Chirp 3 HD에서 같은 페르소나 이름이 로캘 간 같은 화자인지는 확인하지 못했다.
- Fish Audio가 사용자 업로드 모델의 권리(원 화자 동의)를 실제로 얼마나 검증하는지 확인하지 못했다. "무단 복제 음성이 검증 없이 올라온 사례가 있다"는 취지의 제3자 지적이 검색 요약에 있었지만, 원문 페이지를 특정하지 못해 인용하지 않았다.
- Hume Octave 2의 가격과 일본어·한국어 품질, MiniMax 보이스의 공식 성별·나이 정보도 확인하지 못했다.

---

## 3. 캐릭터별 후보 숏리스트(엔진 + 보이스 ID)와 성격에 맞춘 피치·에너지 조절

### Takeaway
두 언어에서 목소리를 하나로 유지할 수 있는 조합은 세 가지다. 그중 ElevenLabs가 "같은 목소리"에 가장 가깝다.
- **ElevenLabs:** Voice Design + Remix(ja/ko 억양판)
- **Gemini 3.8:** 프리셋(초텐 Zephyr/Leda/Autonoe, 아메 Achernar/Vindemiatrix/Kore) 또는 Voice Design
- **Qwen3-TTS:** 로컬, Ono_Anna 또는 VoiceDesign → Base

일본어 애니풍 품질이 우선이면 일본어는 VOICEVOX(초텐 春日部つむぎ·満別花丸, 아메 冥鳴ひまり·ぞん子 低血圧)로 하고 한국어는 다른 엔진으로 분리한다. 이 경우 두 언어의 목소리가 달라지는 것을 감수해야 한다.

모든 후보는 이름과 설명어만 보고 고른 것이므로, 같은 대사 세트로 청취 테스트를 한 뒤 확정해야 한다.

### Cited Findings
- **조절 파라미터 범위**
  - VOICEVOX: `speedScale`, `pitchScale`, `intonationScale`. — [voicevox_engine](https://github.com/VOICEVOX/voicevox_engine)
  - AivisSpeech: `intonationScale`이 감정 표현 강도를 뜻한다. — [AivisSpeech-Engine](https://github.com/Aivis-Project/AivisSpeech-Engine)
  - MiniMax: pitch [−12, 12], speed [0.5, 2.0], emotion 9종. — [MiniMax T2A](https://platform.minimax.io/docs/api-reference/speech-t2a-http)
  - ⚠︎ VOICEPEAK: pitch −300~300, speed 50~200, emotion(검색 요약). — [voicepeak-mcp](https://glama.ai/mcp/servers/k2wanko/voicepeak-mcp)
  - Azure: MAI 보이스는 `mstts:express-as`의 `style`/`styledegree`로 감정을 조절한다. — [MAI-Voice](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices)
  - Azure: Nanami는 chat, cheerful, customerservice 스타일을 지원한다. — [language support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)
  - ElevenLabs: Remix 강도는 Low, Medium, High, Max 네 단계다. — [Voice remixing](https://elevenlabs.io/docs/overview/capabilities/voice-remixing)
  - Gemini: 설명문 기반 Voice Design과 일본어 인라인 태그(`[丁寧に]` 등)를 쓴다. — [Voice design](https://ai.google.dev/gemini-api/docs/voice-design), [digirise](https://digirise.ai/chaen-ai-lab/gemini-3-1-flash-tts/)
  - Irodori VoiceDesign: 일본어 캡션으로 나이·톤·감정을 지정한다. — [HF](https://huggingface.co/Aratako/Irodori-TTS-500M-v2-VoiceDesign)
- **보이스 설명 근거**
  - Gemini: Leda "Youthful", Zephyr·Autonoe "Bright", Achernar "Soft", Vindemiatrix "Gentle", Kore "Firm". — [Gemini API](https://ai.google.dev/gemini-api/docs/speech-generation)
  - Qwen3: Ono_Anna "Playful … light, nimble", Sohee "Warm … rich emotion". — [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS)
  - VOICEVOX: 春日部つむぎ "元気で明るい", 冥鳴ひまり "柔らかく温かい". — [VOICEVOX 제품 페이지](https://voicevox.hiroshiba.jp/product/kasukabe_tsumugi/), [冥鳴ひまり](https://voicevox.hiroshiba.jp/product/meimei_himari/)
  - MiniMax 보이스는 ID 이름 자체를 근거로 삼았다. — [MiniMax](https://platform.minimax.io/docs/faq/system-voice-id)

### Inferences

#### 초텐(밝고 들뜬 아이돌 스트리머) 후보

| 구분 | 엔진·보이스 ID | ja | ko | 한 목소리 여부 | 조절 방법(시작값 추정) |
|---|---|---|---|---|---|
| A. 단일 보이스(품질) | ElevenLabs Voice Design(`eleven_ttv_v3`) 베이스 → Remix 2종(ja/ko) | ○ | ○ | **가능**(리믹스 Low/Medium) | 설명문: "early-20s East Asian woman, bright sweet high voice, bubbly idol livestreamer, fast sing-song pacing, audible smile". 합성은 `eleven_v3` + `[excited]`, `[giggles]` 태그 |
| B. 단일 보이스(저가) | Gemini 3.8 Flash(-Lite) TTS `Zephyr`(Bright) / `Leda`(Youthful) / `Autonoe`(Bright) | ○ | ○ | **가능**(프리셋은 언어 공통) | 스타일 지시: "bubbly, high-energy idol streamer in her early 20s, sweet and excited, fast and bouncy". Voice Design으로 전용 보이스를 설계하는 방법도 있음 |
| C. 단일 보이스(로컬) | Qwen3-TTS `Ono_Anna`(CustomVoice) 또는 VoiceDesign → Base | ○(모국어) | △ 억양 확인 | 조건부 | instruct: "明るく元気なアイドル配信者、20代前半、甘く弾む声". mlx-audio `--voice` |
| D. 일본어 전용(애니풍) | VOICEVOX `春日部つむぎ`(ノーマル), `満別花丸`(元気/ぶりっ子), `四国めたん`(あまあま), `夜語トバリ`(明るい); AivisSpeech `Anneli`(テンション高め/上機嫌) | ◎ | × | 불가 | `speedScale` 1.1~1.2, `pitchScale` +0.02~0.05, `intonationScale` 1.2~1.5 |
| E. 언어별 분리(클라우드) | ja: Azure `ja-JP-NanamiNeural`(cheerful) 또는 `ja-JP-Sakura:MAI-Voice-2-Flash`(이름은 명명 규칙으로 추정). ko: Azure `ko-KR-Haena:MAI-Voice-2`(excited/joyful, 기존 노트) | ○ | ○ | 불가 | SSML `<mstts:express-as style="cheerful">`, `<prosody rate="+10%" pitch="+5%">` |
| F. 언어별 분리(MiniMax) | ja: `Japanese_DecisivePrincess` / `Japanese_GracefulMaiden` / `Japanese_SportyStudent`(성별 불명). ko: `Korean_SweetGirl` / `Korean_CheerfulLittleSister` / `Korean_AirheadedGirl` / `Korean_QuirkyGirl` | ○ | ○ | 불가 | emotion `happy`, pitch +2~+4, speed 1.1. "LittleSister"는 어리게 들릴 위험이 있으니 성인 톤인지 확인 |

#### 아메(조용·건조·무표정·졸린 츤데레, 그래도 귀여운 젊은 여성) 후보

| 구분 | 엔진·보이스 ID | ja | ko | 한 목소리 여부 | 조절 방법(시작값 추정) |
|---|---|---|---|---|---|
| A. 단일 보이스(품질) | ElevenLabs Voice Design 베이스 → Remix 2종(ja/ko) | ○ | ○ | **가능** | 설명문: "early-20s East Asian woman, soft slightly husky mid-low voice, deadpan and low-energy, sleepy aloof delivery, dry teasing". 태그 `[sighs]`, 말줄임표 "…" |
| B. 단일 보이스(저가) | Gemini `Achernar`(Soft) / `Vindemiatrix`(Gentle) / `Kore`(Firm, 기존 노트 추천) | ○ | ○ | **가능** | 스타일 지시: "quiet, deadpan young woman, flat and dry, low energy, a bit sleepy and aloof, soft voice, occasional small sigh" |
| C. 단일 보이스(로컬) | Qwen3-TTS VoiceDesign → Base(레퍼런스 고정), 또는 `Sohee` + instruct(한국어 모국어) | ○ | ○ | 조건부 | instruct: "低めで柔らかい、眠そうで無気力、淡々とした20代前半の女性" |
| D. 일본어 전용(애니풍) | VOICEVOX `冥鳴ひまり`(ノーマル, **기존 캐릭터 사용 명시 허용**), `ぞん子`(低血圧), `夜語トバリ`(呆れ), `あんこもん`(けだるげ), `四国めたん`/`九州そら`(ツンツン, 츤 장면용); AivisSpeech `Anneli`(落ち着き) | ◎ | × | 불가 | `speedScale` 0.85~0.95, `pitchScale` −0.03~0, `intonationScale` 0.5~0.8(평탄하게), "…"은 쉼표나 무음 길이로 표현 |
| E. 언어별 분리(클라우드) | ja: Azure `ja-JP-MayuNeural` / `ja-JP-ShioriNeural` / `ja-JP-AoiNeural`(스타일 없음). ko: `ko-KR-SunHiNeural` / `JiMinNeural` / `SeoHyeonNeural`(기존 노트) | ○ | ○ | 불가 | `<prosody rate="-10%" pitch="-5%">`. MAI Haena는 `softvoice`를 낮은 styledegree로 |
| F. 언어별 분리(MiniMax) | ja: `Japanese_ColdQueen` / `Japanese_CalmLady`. ko: `Korean_ColdGirl` / `Korean_MysteriousGirl` / `Korean_ShyGirl` | ○ | ○ | 불가 | emotion `calm`(또는 whisper), pitch −1~−3, speed 0.9 |

#### 운영 제안
- **1안 — "같은 목소리" 최우선(월 약 $15~31):** ElevenLabs에서 캐릭터별 베이스 보이스를 설계하고 ja/ko 리믹스를 만든다. 결과는 voice_id 4개다. 원작의 "초텐 = 아메의 방송 페르소나" 설정을 살리려면, 아메 베이스를 High 이하 강도로 리믹스해 초텐을 만드는 것도 실험할 만하다. 같은 사람이 톤만 바꾼 느낌을 노리는 것이다.
- **2안 — 저가 단일 엔진(월 약 $9~13, 무료 티어도 가능):** Gemini 3.8 Flash-Lite 또는 Flash의 프리셋 보이스에 캐릭터별 고정 스타일 문구를 쓴다. 억양이 마음에 들지 않으면 같은 설명문으로 Voice Design을 만들어 비교한다.
- **3안 — 일본어 애니풍 최우선(일본어 무료):** 일본어는 VOICEVOX(초텐 春日部つむぎ, 아메 冥鳴ひまり)로 하고, 한국어는 음색이 비슷한 클라우드 보이스(예: Gemini Leda / Achernar)를 고른다. "같은 캐릭터, 언어별로 다른 목소리"를 받아들이는 안이다.
- **4안 — 완전 로컬:** Qwen3-TTS(mlx-audio)로 VoiceDesign → Base 레퍼런스를 고정한다. 반복 대사는 미리 렌더링해 캐시한다.
- **청취 테스트 세트(제안):** 캐릭터마다 인사, 기쁨, 삐짐, 졸림, 놀람, 츤 대사를 한·일 각각 2줄씩, 모두 12줄로 만든다. 같은 대사로 모든 후보를 비교하며 확인할 항목은 다음과 같다.
  - 어린아이처럼 들리는지.
  - 억양이 모국어처럼 자연스러운지.
  - 두 언어가 같은 사람처럼 들리는지.

### Gaps
- 위 표의 VOICEVOX·AivisSpeech·MiniMax·Azure·Gemini 파라미터 시작값은 출처 없는 튜닝 제안이다. VOICEVOX `pitchScale`의 공식 허용 범위도 이번에 확인하지 못했다.
- MiniMax 일본어 라인업에는 이름상 "발랄한 젊은 여성" 보이스가 거의 없다(DecisivePrincess, GracefulMaiden 정도). 실제 음색은 들어 봐야 안다.
- Azure `ja-JP-Sakura:MAI-Voice-2-Flash`의 정확한 ShortName과 스타일 목록은 언어 지원 페이지에 명시되지 않았다(명명 규칙으로 추정).
- Gemini 3.8 Voice Design 결과물이 "20대 초반"과 "아동"을 안정적으로 구분해 내는지는 자료가 없다.

---

## 4. 개인용 데스크톱 앱(기존 게임 IP의 팬 캐릭터)에서의 라이선스·크레딧·금지선

### Takeaway
개인 PC 안에서만 재생하는 비공개 앱이라면 대부분의 선택지가 약관상 가능하다.

엔진별 조건:
- **VOICEVOX 계열:** 캐릭터별 크레딧("VOICEVOX:캐릭터명")을 지키면 대체로 쓸 수 있다. **冥鳴ひまり는 기존 IP 캐릭터의 목소리로 쓰는 것을 명시적으로 허용**한다.
- **COEIROINK:** "어느 음성을 어느 캐릭터에 썼는지" 크레딧하면 팬 캐릭터에 쓸 수 있다.
- **AivisHub(ACML):** 크레딧은 필요 없지만, 원 화자나 공식 관계자로 오인시키는 이용은 금지다.
- **클라우드 프리셋·설계 보이스:** 약관상 걸림이 거의 없다.

금지선:
1. 실존 성우(애니판 캐스트 포함)의 목소리를 복제하거나 닮게 튜닝하는 것.
2. 커뮤니티의 "애니 성우풍" 클론 모델을 쓰는 것. Fish Audio 사용자 모델이 대표적이다.
3. 일본어 엔진의 캐릭터 음성(실존 성우·VTuber의 목소리가 기반)을 다른 모델의 복제 레퍼런스나 학습 데이터로 쓰는 것.

にじボイス 종료 사례처럼, 일본에서는 "닮았다"는 이유만으로도 분쟁이 된다.

### Cited Findings
- **VOICEVOX 본체 약관:** 상업·비상업 모두 가능하다. 크레딧 표기가 필수이고, 생성 음성은 캐릭터별 규약을 따른다. — [VOICEVOX 이용규약](https://voicevox.hiroshiba.jp/term/)
- **四国めたん 등(東北ずん子 프로젝트)** — [zunko.jp](https://zunko.jp/con_ongen_kiyaku.html)
  - 크레딧이 필수이고, 앱은 소개 영역에 표기한다.
  - 정치·종교, 비방, 허위정보, 성산업, 반사회 세력 관련 이용을 금지한다.
  - 크레딧을 생략하려면 캐릭터당 ¥400,000 계약이 필요하다.
  - 다른 캐릭터의 목소리로 쓰는 것에 대한 조항은 없다.
- **冥鳴ひまり:** 오리지널과 기존 캐릭터 모두의 목소리로 쓸 수 있고, 기존 IP 규약은 따로 확인해야 한다. 크레딧 필수, 신고 불필요다. — [冥鳴ひまり 이용규약](https://www.meimeihimari.com/terms-of-use)
- ⚠︎ **春日部つむぎ:** 「VOICEVOX:春日部つむぎ」 크레딧으로 상업·비상업 가능하며, 목소리는 VTuber 春日部つくし 기반이다. **No.7:** 비상업은 크레딧으로 가능하고 상업은 사전 확인이 필요하다(검색 요약). — [crystal-method](https://crystal-method.com/blog/voicevox-commercial/)
- **COEIROINK:** 팬 캐릭터 사용은 "어느 음성을 어느 캐릭터에 썼는지" 크레딧하면 가능하다. 머신러닝 학습 데이터 사용, 엔진 밖에서 모델 실행, 모델 재배포는 금지다(2025-09-29 갱신). — [COEIROINK 이용규약](https://coeiroink.com/terms)
- **AivisSpeech·ACML** — [AivisSpeech-Engine README](https://github.com/Aivis-Project/AivisSpeech-Engine), [ACML-1.0.md](https://raw.githubusercontent.com/Aivis-Project/ACML/master/ACML-1.0.md)
  - ACML/ACML-NC/CC0 모델은 크레딧 의무가 없다.
  - ACML 1.0은 원 화자·타인의 「本人」「原作者」「公式関係者」로 오인시키는 이용, 괴롭힘·비방, 허위정보, 정치·종교 선전, 범죄 목적 이용을 금지한다.
- **にじボイス:** 日本俳優連合이 회원 목소리와 "酷似"하다고 문제를 제기하자, 법적 침해가 인정되지 않았다면서도 2026-02-04에 서비스를 종료했다. — [PC Watch](https://pc.watch.impress.co.jp/docs/news/2065958.html)
- **Irodori-TTS:** 동의 없는 개인 목소리 복제·사칭, 딥페이크, 허위정보를 금지한다. MIT 라이선스다. — [HF Irodori v3](https://huggingface.co/Aratako/Irodori-TTS-500M-v3)
- **Gemini:** 목소리 복제(replicated)에는 동의 음성이 필요하다. 설계 보이스(prompted) 페이지에는 실존 인물 모방에 대한 명시적 제한 문구가 없다. — [Gemini speech generation](https://ai.google.dev/gemini-api/docs/speech-generation), [Voice design](https://ai.google.dev/gemini-api/docs/voice-design)
- **Azure MAI:** 인스턴트 클로닝은 게이트 접근과 동의 절차를 거쳐야 한다("No unlicensed voice cloning is possible"). 프리빌트 보이스는 "Microsoft holds full licensing rights for commercial use"다. — [MAI-Voice](https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices)
- **Fish Audio**
  - S2 Pro 가중치는 연구·비상업 라이선스다. — [HF s2-pro](https://huggingface.co/fishaudio/s2-pro)
  - ⚠︎ 사이트에는 "アニメ声" 류의 사용자 업로드 모델이 많고(검색 요약), 약관은 타인 사칭을 금지한다. — [fish.audio 모델 예시](https://fish.audio/m/7a574cafcc974f87a0d66c1c70ae4484), [fish.audio Terms](https://fish.audio/terms)
- **ElevenLabs:** Remix는 본인 클론, Voice Design 보이스, 무기한 notice Library 보이스에만 쓸 수 있다. — [Voice remixing](https://elevenlabs.io/docs/overview/capabilities/voice-remixing)
- 원작(NEEDY GIRL OVERDOSE)의 2차창작 허용 범위, 애니판 초텐 성우, 한국 퍼블리시티 관련 법 동향, 각 클라우드 벤더의 클로닝·고지 정책은 기존 노트 `character_voice_and_lipsync.md` 2절에 정리돼 있다(기존 노트).

### Inferences
- **개인 앱에서 할 일**
  - VOICEVOX나 COEIROINK를 쓰면 앱의 정보·크레딧 화면에 표기를 넣는다. 예: 「VOICEVOX:冥鳴ひまり」, 「COEIROINK:(캐릭터명) — 아메 음성」.
  - 비공개 앱이라도 규약이 "이용 시 크레딧 필수"라고 적고 있으므로 넣어 두는 편이 가장 단순한 준수 방법이다.
- **캐릭터 선택 우선순위(라이선스 관점)**
  1. 冥鳴ひまり: 기존 캐릭터 사용이 명시적으로 허용돼 있다.
  2. COEIROINK 캐릭터: 크레딧 대응 표기만 하면 된다.
  3. AivisHub의 ACML/CC0 모델: 사칭 금지만 지키면 된다.
  4. 그 밖의 VOICEVOX 캐릭터: 개별 규약에 "다른 캐릭터의 목소리로 사용"이 허용되는지 확인해야 한다.
- **공유할 때 주의점:** 화면 녹화나 클립 등으로 외부에 공유한다면 "초텐 공식 보이스"처럼 보이게 하지 않는다. ACML의 공식 관계자 오인 금지 조항과 원작 애니 캐스팅을 고려한 것이다. "AI 합성 음성·팬 제작" 고지를 함께 붙인다.
- **대사 내용 주의:** 캐릭터 규약에 성산업·선정적 용도나 정치·종교 금지 조항이 있다. 수영복 의상 같은 성인 맥락 컷에 선정적 대사를 붙일 계획이라면, 해당 음성 라이브러리 규약을 먼저 확인한다. 冥鳴ひまり 규약에는 성인 콘텐츠에 대해 "VOICEVOX 규약을 확인하고 조심스럽게" 수준의 농담조 안내만 있다([冥鳴ひまり 이용규약](https://www.meimeihimari.com/terms-of-use)).
- **"같은 목소리의 한국어판"을 만들 때:** 일본어 엔진 음성을 클론 레퍼런스로 쓰지 말고, 반드시 텍스트 설계(ElevenLabs·Gemini Voice Design, Qwen3 VoiceDesign, Irodori VoiceDesign)나 프리셋 보이스에서 출발한다. VOICEVOX 캐릭터 음성은 실존 제공자(성우·VTuber)의 목소리를 기반으로 만들어졌으므로, 이를 복제하면 결국 실존 인물 목소리를 복제하는 셈이 된다.

### Gaps
- 春日部つむぎ(studio.site 규약)·No.7·ぞん子·夜語トバリ 규약 원문을 직접 확인하지 못했다. 특히 "기존 IP 캐릭터의 목소리로 사용"과 AI 학습 조항이 확인할 대상이다.
- ACML-NC 원문, AivisHub 모델별 학습 음성 출처를 공개하는지 여부를 확인하지 못했다.
- 원작 NGO(WSS playground)의 AI 음성 관련 최신 가이드라인은 기존 노트에서도 미확인이다.
- VOICEVOX 규약이 말하는 "크레딧 필수"가 외부에 공개하지 않는 사적 이용에도 적용되는지에 대한 공식 FAQ는 찾지 못했다.

---

## 5. 지연·오프라인·비용 — 하루 약 300줄(한·일 반반) 기준

### Takeaway
- **오프라인·무료:** VOICEVOX, AivisSpeech, COEIROINK, Irodori(모두 일본어 전용)와 Qwen3-TTS(mlx-audio, 한·일)가 해당한다. 다만 Apple Silicon에서의 지연 실측치는 찾지 못했다.
- **클라우드 한·일 단일 엔진의 월 비용(추정)**
  - Qwen3-TTS-Flash API: 약 $6~8.
  - Gemini 3.8 Flash-Lite: 약 $9, Flash: 약 $13. 2027년부터 2배가 되며, 무료 티어는 데이터 활용 조건이 붙는다.
  - OpenAI gpt-4o-mini-tts: 약 $15.
  - ElevenLabs Flash·v4 Turbo: 약 $15, v3·v4: 약 $31.
  - MiniMax: 약 $23~38.
  - Azure 일반 뉴럴과 Chirp 3 HD: 무료 한도 안(단, 감정 연기가 약함).
- **하이브리드("일본어 VOICEVOX + 한국어 Gemini Flash-Lite"):** 월 약 $5다.

### Cited Findings
- **로컬 엔진 성능 관련 근거**
  - AivisSpeech는 CPU(ONNX Runtime) 추론이 최적화돼 있고, 내장 GPU는 보통 CPU보다 느리다. — [AivisSpeech-Engine](https://github.com/Aivis-Project/AivisSpeech-Engine)
  - VOICEVOX는 macOS arm64 CPU 빌드를 배포한다. — [VOICEVOX Releases](https://github.com/VOICEVOX/voicevox/releases)
  - Irodori는 가변 길이 학습으로 RTF를 개선했다고만 적고 수치는 없다. — [HF Irodori v3](https://huggingface.co/Aratako/Irodori-TTS-500M-v3)
  - mlx-audio는 Qwen3-TTS 스트리밍(`--stream`)을 지원한다. — [mlx-audio](https://github.com/Blaizzy/mlx-audio)
- **Azure 과금 규칙:** 한자는 2자로 센다. 원문: "Each Chinese character is counted as two characters for billing, including kanji used in Japanese, hanja used in Korean". 또 "Charges apply even if speech is not generated due to a mismatch between the selected voice language and the input text"다. — [Azure TTS overview](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech)
- **MiniMax:** 입력은 10,000자 미만이고, 3,000자를 넘으면 스트리밍을 권장한다. 응답에 과금용 `usage_characters`가 포함된다. CJK 문자를 어떻게 세는지는 명시돼 있지 않다. — [MiniMax T2A](https://platform.minimax.io/docs/api-reference/speech-t2a-http)
- ⚠︎ **Qwen3-TTS-Flash:** DeepInfra 1M자당 $20, OpenRouter 1M자당 $15(검색 요약). — [DeepInfra](https://deepinfra.com/Qwen/Qwen3-TTS/api), [OpenRouter](https://openrouter.ai/qwen/qwen-audio-3.0-tts-flash/api)
- **VOICEPEAK:** 1회 최대 140자(검색 요약)라, 긴 답변은 문장 단위로 나눠야 한다. — [voicepeak-mcp](https://glama.ai/mcp/servers/k2wanko/voicepeak-mcp)
- **기존 노트에서 재사용한 단가·지연(이번 세션 재확인 안 함)**
  - Gemini 3.8 Flash TTS 오디오 $9/1M 토큰, Flash-Lite $6/1M, 초당 25토큰, 2027-01-01부터 2배. — [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)
  - ElevenLabs 1K자당 v4·v3 $0.08, Flash·v4 Turbo $0.04. — [ElevenLabs API pricing](https://elevenlabs.io/pricing/api)
  - gpt-4o-mini-tts 약 $0.015/분. — [OpenAI Community](https://community.openai.com/t/understanding-gpt-4o-mini-tts-pricing-input-characters-cost/1151816)
  - MiniMax 2.8 Turbo $60 / HD $100 per 1M자. — [Artificial Analysis](https://artificialanalysis.ai/text-to-speech/leaderboard)
  - Fish $15/1M UTF-8 바이트. — [Fish pricing](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits)
  - Azure F0 월 50만 자 무료. — [Azure pricing](https://azure.microsoft.com/en-us/pricing/details/speech/)
  - Chirp 3 HD 월 100만 자 무료. — [Google TTS pricing](https://cloud.google.com/text-to-speech/pricing)
  - Typecast Lite $15=20만 크레딧. — [Typecast API](https://typecast.ai/developers/api/)
  - 지연: ElevenLabs Flash v2.5 약 75ms, v4 Turbo 약 100ms. — [ElevenLabs Models](https://elevenlabs.io/docs/models)
  - 지연: Typecast TTFB 170~210ms. — [Typecast API](https://typecast.ai/developers/api/)
  - Qwen3-TTS Apple Silicon RTF: M5 Pro 4-bit 약 0.79. — [soniqo](https://soniqo.audio/benchmarks)
  - Qwen3-TTS Apple Silicon RTF: M3 Max PyTorch MPS 약 2.97. — [tinycomputers](https://tinycomputers.io/posts/the-real-cost-of-running-qwen-tts-locally-three-machines-compared.html)

### Inferences
- **가정(출처 없음)**
  - 하루 300줄은 한국어 150줄, 일본어 150줄이다.
  - 평균 글자 수는 한국어 50자(공백 포함, 기존 노트와 같음), 일본어 35자(띄어쓰기가 없고 한자가 압축되므로)다.
  - 따라서 하루 12,750자, 월 382,500자(한국어 225,000, 일본어 157,500)다.
  - 발화 속도는 한국어 초당 약 7자, 일본어 초당 약 6자로 잡는다.
  - 따라서 오디오는 하루 약 32분(한국어 17.9분, 일본어 14.6분), 월 약 973분(16.2시간)이다.
  - 일본어 텍스트의 한자 비율은 30%로 잡는다(Azure 과금용).
- **월 비용 추정(캐시 미적용)**

| 엔진(한·일 모두) | 계산 | 월 비용 |
|---|---|---|
| Google Chirp 3 HD | 38.3만 자 < 무료 100만 | **$0**(감정 지시 불가) |
| Azure 일반 뉴럴(F0) | 한 22.5만 + 일 15.75만 × 1.3(한자 2자 과금) ≈ 43만 < 50만 | **$0**(스타일 제한) |
| Qwen3-TTS-Flash API | 0.3825M자 × $15~20 | **약 $6~8** |
| Gemini 3.8 Flash-Lite TTS | 973분 × 60 × 25토큰 ≈ 146만 토큰 × $6/1M | **약 $9**(2027년 약 $17.5) |
| Gemini 3.8 Flash TTS | 146만 토큰 × $9/1M | **약 $13**(2027년 약 $26) |
| OpenAI gpt-4o-mini-tts | 973분 × $0.015 | 약 $15(일본어 억양 위험) |
| ElevenLabs Flash v2.5 / v4 Turbo | 382.5K자 × $0.04/1K | 약 $15 |
| ElevenLabs v3 / v4 | 382.5K자 × $0.08/1K | 약 $31 |
| Fish s2-pro | 한 22.5만 × 약 2.6B + 일 15.75만 × 약 2.9B ≈ 104만 바이트 × $15/M | 약 $16(커뮤니티 모델 리스크) |
| MiniMax 2.8 Turbo / HD | 0.3825M × $60 / $100(CJK 1자 = 1자 과금 가정) | 약 $23 / $38 |
| Typecast | 38.3만 크레딧 > Lite 20만 | 캐시로 20만 이하면 $15, 아니면 Plus $280 |
| 로컬(VOICEVOX·AivisSpeech·COEIROINK·Irodori: 일본어만 / Qwen3-TTS: 한·일) | 전기료 | **$0**, 오프라인 |
| 하이브리드: 일본어 VOICEVOX + 한국어 Gemini Flash-Lite | 한국어 약 537분 × 60 × 25 ≈ 80.5만 토큰 × $6/1M | **약 $5** |
| 하이브리드: 일본어 VOICEVOX + 한국어 Azure F0 | 한국어 22.5만 < 50만 | **$0**(목소리 불일치) |

- **지연 설계**
  - 로컬 일본어 엔진은 네트워크 왕복이 없지만 공식 수치가 없다. 사용자 Mac에서 대사 길이별 합성 시간을 한 번 재 보는 것이 선행 과제다.
  - 클라우드는 기존 노트의 문장 단위 파이프라인과 캐시 설계를 그대로 쓴다.
  - 고정 반응 대사(한·일 × 캐릭터 × 감정 변형)는 사전 렌더링한다. 그러면 과금과 지연이 Claude 답변 같은 고유 문장에만 남는다. 고정 대사 비중이 절반이면 위 비용도 대략 절반이 된다.
- **오프라인 폴백:** 두 가지 중 하나를 고른다.
  - 일본어 VOICEVOX/AivisSpeech + 한국어 Qwen3-TTS(mlx-audio) 조합.
  - 두 언어 모두 Qwen3-TTS 하나로 운영.
- **예산 관점:** 저예산 개인 앱이라면 다음 두 안이 월 $5~13 범위에서 균형이 가장 좋다.
  - 2안: Gemini 단일 엔진.
  - 하이브리드: 일본어 VOICEVOX + 한국어 Gemini.

  "같은 목소리" 요구가 강하면 ElevenLabs(월 $15~31)로 올리는 것이 합리적이다.

### Gaps
- VOICEVOX, AivisSpeech, Irodori-TTS의 Apple Silicon(M 시리즈별) 합성 시간과 첫 음성까지 걸리는 시간.
- Gemini, MiniMax, Qwen3-TTS-Flash, Hume의 TTFB 공식 수치.
- 한국어·일본어의 실제 초당 문자 수(엔진·보이스별). 시간 과금 엔진 추정치의 오차 요인이다.
- MiniMax의 CJK 과금 규칙과 공식 단가, Qwen3-TTS-Flash의 Alibaba 공식(DashScope) 단가.
- ElevenLabs가 일본어·한국어 문자를 어떻게 크레딧으로 환산하는지 공식 문구.
- 무료 티어(Gemini 등)의 RPM/RPD가 하루 300줄 패턴에 걸리는지.
