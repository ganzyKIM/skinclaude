// voice.js — 호출어("쵸텐짱"·"아메짱") 판정과 음성용 글 다듬기 (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const { matchWake, ackLine, taskAckLine, voiceNote, speakable, chimeWorthy, meaningful, spokenSummary, takeSpoken, quickAckLine, busyLine, mediaControl, mediaLine, followWorthy, looksUnfinished, matchWakeReading, matchWakeLoose, matchWakeEnglish, modeSwitch, modeLine, langSwitch, langLine } = require('../voice.js');
const { playIntent: quickChrome } = require('../intent.js'); // 재생 부탁 판정은 intent.js 로 옮겼다(실사용 문장 회귀 시험은 여기 그대로 둔다)

test('실제 받아쓰기 결과의 이름 변형을 알아듣고 뒤의 요청을 떼어 낸다', () => {
  assert.deepEqual(matchWake('쇼텐짱 오늘 서울 날씨 어때?'), { who: 'choten', rest: '오늘 서울 날씨 어때?' });
  assert.deepEqual(matchWake('밤에 짱 나 오늘 좀 피곤해'), { who: 'ame', rest: '나 오늘 좀 피곤해' });
  assert.deepEqual(matchWake('雨ちゃん、今日の天気はどう ？'), { who: 'ame', rest: '今日の天気はどう ？' });
});

test('여러 표기와 부름말', () => {
  assert.equal(matchWake('쵸텐짱!')?.who, 'choten');
  assert.equal(matchWake('초텐 쨩 뭐해')?.rest, '뭐해');
  assert.equal(matchWake('야 아메짱 있잖아')?.who, 'ame');
  assert.equal(matchWake('ねえ、超てんちゃん')?.who, 'choten');
  assert.equal(matchWake('チョウテンチャン元気？')?.rest, '元気？');
  assert.equal(matchWake('あめちゃん')?.rest, '');
});

test('이름으로 시작하지 않으면 반응하지 않는다(아무 소리나 받지 않기)', () => {
  assert.equal(matchWake('오늘 초텐짱이 귀여웠어'), null);
  assert.equal(matchWake('아메리카노 한 잔 주세요'), null);
  assert.equal(matchWake('雨が降ってる'), null);
  assert.equal(matchWake(''), null);
});

test('이름만 불렀을 때의 대답은 캐릭터·언어에 맞는다', () => {
  const first = (a) => a[0];
  assert.equal(ackLine('ame', 'ko', first), '…왜.');
  assert.equal(ackLine('choten', 'ja', first), 'なになに？呼んだ？P♡');
});

test('일본어 모드 메모는 일본어로 답하라고 하고 감정 태그는 한국어 그대로', () => {
  assert.ok(voiceNote('ja').includes('일본어로') && voiceNote('ja').includes('[기쁨]'));
  assert.ok(voiceNote('ko').includes('음성 대화'));
});

test('읽을 글에서는 감정 태그·크롬 표시·하트를 뺀다', () => {
  assert.equal(speakable('[기쁨] 오케이P♡ 바로 알아볼게!\n[크롬] 구글에서 날씨 검색'), '오케이P 바로 알아볼게!');
  assert.equal(speakable('[기본] …관둔다.'), '…관둔다.');
});

test('띠링은 이름이 들렸거나 대답 직후 이어 듣는 중일 때만', () => {
  assert.equal(chimeWorthy('쇼텐짱 오늘', false), true);
  // 짱 없이 이름만 들려도 울린다(2026-10-06 "쵸텐 아메 … 다양한 부르는 방식"). 노래 중(loose)·일본어의 이름만은 확정에서 정한다
  assert.equal(chimeWorthy('쇼텐', false), true);
  assert.equal(chimeWorthy('쇼텐', false, undefined, { loose: true }), false);
  assert.equal(chimeWorthy('雨', false, undefined, { lang: 'ja' }), false);
  assert.equal(chimeWorthy('아메리카노', false), false);
  assert.equal(chimeWorthy('오늘 날씨 어때', false), false);
  assert.equal(chimeWorthy('오늘 날씨 어때', true), true);
});

test('작업 결과는 마크다운을 걷고 앞 문장들만 읽는다', () => {
  assert.equal(spokenSummary('오늘 서울은 맑고 24도예요. 강수확률은 10%예요.'), '오늘 서울은 맑고 24도예요. 강수확률은 10%예요.');
  const long = '## 결과\n- **테스트** 12개 통과했어요. 로그인 화면 버그를 고쳤어요. ' + '자세한 변경은 이렇습니다. '.repeat(20);
  const s = spokenSummary(long, 60);
  assert.ok(s.startsWith('결과 테스트 12개 통과했어요.') && s.length <= 60 && !s.includes('**'), s);
  assert.equal(spokenSummary('[문서](http://x.y) 를 `npm test` 로 확인'), '문서 를 npm test 로 확인');
});

test('음성 지시를 받았다는 대답도 캐릭터·언어에 맞는다', () => {
  const first = (a) => a[0];
  assert.equal(taskAckLine('choten', 'ko', first), '알았어! 클로드한테 바로 넘길게♡');
  assert.equal(taskAckLine('ame', 'ja', first), '…渡しとく。終わったら言う。');
});

test('부호만 받아쓴 잡음은 말로 치지 않고 띠링도 울리지 않는다', () => {
  assert.equal(meaningful('.'), false);
  assert.equal(meaningful('…?'), false);
  assert.equal(meaningful('음…'), false);
  assert.equal(meaningful('えー'), false);
  assert.equal(meaningful('응'), true);   // 크롬 확인에 "응"으로 답할 수 있게
  assert.equal(meaningful('네.'), true);
  assert.equal(meaningful('はい'), true);
  assert.equal(chimeWorthy('.', true), false);
});

test('작업 결과는 첫 문단(요약)만 읽고 뒤의 경로·목록은 읽지 않는다', () => {
  const r = '작업 폴더에는 파일이 하나도 없고 빈 `chrome` 폴더만 있어요. 아무것도 고치지 않았어요.\n\n- 경로: `/Users/me/workspace`\n- `chrome/`: 빈 폴더';
  assert.equal(spokenSummary(r), '작업 폴더에는 파일이 하나도 없고 빈 chrome 폴더만 있어요. 아무것도 고치지 않았어요.');
});

test('일본어 받아쓰기가 이름을 다르게 적어도 ちゃん 으로 끝나면 알아듣는다(실측 변형)', () => {
  assert.deepEqual(matchWake('頂天ちゃん、今日の天気教えて。'), { who: 'choten', rest: '今日の天気教えて。' });
  assert.equal(matchWake('ちょてんちゃん元気。')?.who, 'choten');
  assert.equal(matchWake('超天ちゃん、おはよう。')?.who, 'choten');
  assert.equal(matchWake('笑点ちゃんがいっぱい')?.who, 'choten');
  assert.deepEqual(matchWake('ハメちゃん、今何時 ？'), { who: 'ame', rest: '今何時 ？' });
});

test('じゃん 은 받지 않는다("雨じゃん" 같은 흔한 말로 깨지 않게)', () => {
  assert.equal(matchWake('雨じゃん、傘持ってきた？'), null);
  assert.equal(matchWake('書店じゃん。今日はどう'), null);
});

test('흘러오는 답은 끝난 문장부터 떼어 읽고, 태그가 덜 왔거나 문장이 안 끝났으면 기다린다', () => {
  assert.deepEqual(takeSpoken('[기', 0), { text: '', at: 0 });
  assert.deepEqual(takeSpoken('[기쁨] 벌써 저녁', 0), { text: '', at: 0 });
  const raw = '[기쁨] 벌써 저녁 얘기야? 아침부터 나랑';
  const r = takeSpoken(raw, 0);
  assert.equal(speakable(r.text), '벌써 저녁 얘기야?');
  assert.equal(takeSpoken(raw, r.at).text, ''); // 다음 문장은 아직 안 끝났다
  assert.equal(speakable(takeSpoken(`${raw} 데이트라니 좋아♡`, r.at, true).text), '아침부터 나랑 데이트라니 좋아');
  assert.equal(takeSpoken(raw, raw.length, true).text, '');
});

test('[크롬] 표시 줄은 흘러오는 중에도 한 글자도 읽지 않는다', () => {
  const full = '[생각] 크롬으로 바로 찾아볼게♡\n[크롬] 구글에서 내일 날씨를 검색해. 비 오는지 알려 줘';
  let at = 0, said = '';
  for (let i = 1; i <= full.length; i++) { const r = takeSpoken(full.slice(0, i), at); at = r.at; said += r.text; }
  said += takeSpoken(full, at, true).text;
  assert.equal(speakable(said), '크롬으로 바로 찾아볼게');
});

test('일본어는 。！？ 뒤에 띄어쓰기가 없어도 문장 끝으로 본다', () => {
  assert.equal(speakable(takeSpoken('[기쁨] おはよう、Pくん！今日も', 0).text), 'おはよう、Pくん！');
});

test('너무 짧은 조각은 다음 문장과 합쳐 읽는다(한두 마디씩 끊어 읽지 않게)', () => {
  assert.equal(takeSpoken('[기쁨] 응! 알았어 바로', 0).text, '');
  assert.equal(speakable(takeSpoken('[기쁨] 응! 알았어 바로 할게! 기', 0).text), '응! 알았어 바로 할게!');
});

test('한 글자씩 흘려 넣어 읽은 조각을 이으면 다 온 뒤 한 번에 읽은 것과 같다', () => {
  for (const full of ['[기쁨] P 벌써 일어났어? 초텐쨩은 계속 기다리고 있었다구~ 오늘도 힘내♡',
    '[걱정] …늦게까지 무리하지 마. 걱정되니까 하는 말은 아니고.',
    '[기쁨] おはよう、P！今日も一緒にがんばろうね♡ 無理しないでね。',
    '[생각] 내일 날씨는 크롬한테 부탁할게♡\n[크롬] 구글에서 내일 서울 날씨를 검색해 알려 줘']) {
    let at = 0; const parts = [];
    for (let i = 1; i <= full.length; i++) { const r = takeSpoken(full.slice(0, i), at); at = r.at; if (r.text) parts.push(r.text); }
    parts.push(takeSpoken(full, at, true).text);
    const flat = (s) => s.replace(/\s+/g, '');
    assert.equal(flat(parts.map(speakable).join('')), flat(speakable(full)));
  }
});

test('노래·영상 재생 부탁은 잡담 없이 바로 크롬으로(한·일)', () => {
  assert.equal(quickChrome('유튜브에서 캔디튠 바이바이 파이트 틀어줘', 'ko'), true);
  assert.equal(quickChrome('아이묭 마리골드 재생해 줘', 'ko'), true); // "재생해"는 그 자체로 재생 부탁
  assert.equal(quickChrome('마리골드 들려줘', 'ko'), false); // 짧고 어디서인지 없으면 잡담이 판단한다
  assert.equal(quickChrome('아이묭 마리골드 틀어줘', 'ko'), true); // 제목 두 단어 + 틀어 → 재생 부탁
  assert.equal(quickChrome('다시 틀어 줘', 'ko'), false); // 이어 틀기(mediaControl)
  assert.equal(quickChrome('신나는 노래 하나 틀어 줘', 'ko'), true);
  assert.equal(quickChrome('오늘 날씨 알려줘', 'ko'), false);
  assert.equal(quickChrome('유튜브 영상 추천해 줘', 'ko'), false);
  assert.equal(quickChrome('YouTubeで合言葉の歌ってみたを流して', 'ja'), true);
  assert.equal(quickChrome('今日の天気はどう？', 'ja'), false);
});

test('바로 넘길 때 한 마디와 바쁠 때 한 마디는 캐릭터·언어에 맞는다', () => {
  const first = (a) => a[0];
  assert.equal(quickAckLine('choten', 'ko', first), '알았어, 바로 틀게♡');
  assert.equal(quickAckLine('ame', 'ja', first), '…かけとく。');
  assert.equal(busyLine('ame', 'ko', first), '…아직이야. 기다려.');
  assert.equal(busyLine('choten', 'ja', first), 'まだやってる最中、ちょっと待って♡');
});

test('노래 조작 말은 모델 없이 바로 알아듣는다(짧은 말만)', () => {
  assert.equal(mediaControl('노래 멈춰', 'ko'), 'pause');
  assert.equal(mediaControl('잠깐 멈춰 줘', 'ko'), 'pause');
  assert.equal(mediaControl('다음 곡', 'ko'), 'next');
  assert.equal(mediaControl('다음 노래로 넘겨 줘', 'ko'), 'next');
  assert.equal(mediaControl('이전 곡으로', 'ko'), 'prev');
  assert.equal(mediaControl('다시 틀어 줘', 'ko'), 'play');
  // 소리 크기는 노래 조작이 아니라 맥 음량이다(intent.js volumeIntent)
  assert.equal(mediaControl('소리 좀 줄여 줘', 'ko'), null);
  assert.equal(mediaControl('볼륨 키워', 'ko'), null);
  // "止まって"도 멈춤(2026-10-01 실사용: 잡담으로 넘어가 노래가 안 멈췄다). "止まらない"는 가사에 흔한 말이라 아니다
  assert.equal(mediaControl('止まって', 'ja'), 'pause');
  assert.equal(mediaControl('止まらない', 'ja'), null);
  assert.equal(mediaControl('오늘 날씨 어때', 'ko'), null);
  assert.equal(mediaControl('유튜브에서 아이묭 마리골드 틀어줘', 'ko'), null); // 제목이 든 긴 부탁은 재생 부탁
  assert.equal(mediaControl('止めて', 'ja'), 'pause');
  // 받아쓰기가 끝에 붙이는 마침표를 떼고 본다(2026-10-01 실사용)
  assert.equal(mediaControl('再生して。', 'ja'), 'play');
  assert.equal(mediaControl('またプレイして。', 'ja'), 'play');
  assert.equal(mediaControl('음악 재생해줘.', 'ko'), 'play');
  assert.equal(mediaControl('次の曲', 'ja'), 'next');
  assert.equal(mediaLine('choten', 'ko', 'pause'), '멈췄어♡');
  assert.equal(mediaLine('ame', 'ja', 'next'), '…次。');
});

test('텐이 틴·팅으로 적혀도 이름으로 알아듣는다', () => {
  assert.equal(matchWake('초틴짱 오늘 날씨 어때?')?.who, 'choten');
  assert.equal(matchWake('초팅짱 오늘 날씨 어때?')?.rest, '오늘 날씨 어때?');
  assert.equal(matchWake('초딩짱 뭐해'), null);
});

test('이름 없이 건 말은 제대로 건 말만 받는다(잡소리·바람 소리 거르기)', () => {
  assert.equal(followWorthy('とう').ok, false);                       // 두 글자 잡음
  assert.equal(followWorthy('.').ok, false);
  assert.equal(followWorthy('응').ok, false);                         // 평소엔 한 글자 대답도 받지 않는다
  assert.equal(followWorthy('응', { expectingAnswer: true }).ok, true); // 확인을 기다리는 중이면 받는다
  assert.equal(followWorthy('고마워').ok, true);
  assert.equal(followWorthy('오늘 날씨 어때', { peakRms: 0.05, noiseFloor: 0.003 }).ok, true);
  assert.equal(followWorthy('오늘 날씨 어때', { peakRms: 0.008, noiseFloor: 0.003 }).ok, false); // 멀리서 난 작은 소리
  assert.equal(followWorthy('오늘 날씨 어때', { peakRms: 0.006, noiseFloor: 0.001, aec: true }).ok, true); // 에코 제거 중엔 전체가 작다
});

test('말이 덜 끝난 꼴이면 더 기다린다(확실한 것만)', () => {
  assert.equal(looksUnfinished('초텐짱 유튜브에서'), true);
  assert.equal(looksUnfinished('초텐짱 유튜브에서 노래 틀어줘'), false);
  assert.equal(looksUnfinished('あめちゃん、YouTubeで'), true);
  assert.equal(looksUnfinished('오늘 날씨 어때?'), false);
  // 다 끝난 말: 예전엔 て·고·と 로 끝난다고 7초씩 기다렸다
  assert.equal(looksUnfinished('音楽止めて'), false);
  assert.equal(looksUnfinished('カーポピンプレイして。'), false);
  assert.equal(looksUnfinished('오늘 기분 최고'), false);
  assert.equal(looksUnfinished('ちょっと'), false);
});

test('노래 중에 あめ 가 姉·アナ 로 적혀도 아메로 알아듣는다(실사용 변형)', () => {
  assert.deepEqual(matchWake('姉ちゃん、音楽すめて'), { who: 'ame', rest: '音楽すめて' });
  assert.deepEqual(matchWake('アナちゃん音楽止めて'), { who: 'ame', rest: '音楽止めて' });
  assert.equal(mediaControl('音楽止めて', 'ja'), 'pause');
  assert.equal(mediaControl('音楽すめて', 'ja'), null); // 이건 잡담이 받아 크롬으로 넘긴다
});

test('일본어는 발음(sttd 토큰)으로도 이름을 맞춘다', () => {
  // [로마자, 원문에서 끝나는 자리] — helper 의 CFStringTokenizer 출력 그대로
  const T = {
    '頂天ちゃん、今日の天気教えて。': [['chouten', 2], ['chan', 5], ['kyou', 8], ['no', 9], ['tenki', 11]],
    '超天ちゃん、おはよう': [['chou', 1], ['ten', 2], ['chan', 5], ['ohayou', 10]],
    '笑点ちゃんがいっぱい': [['shouten', 2], ['chan', 5], ['ga', 6], ['ippai', 10]],
    '超てったん YouTubeで音楽を流して。': [['chou', 1], ['te~tsu', 3], ['ta', 4], ['n', 5], ['YouTube', 13], ['de', 14]],
    '姉ちゃん、音楽すめて': [['ane', 1], ['chan', 4], ['ongaku', 7], ['sume', 9], ['te', 10]],
    'アナちゃん音楽止めて': [['ana', 2], ['chan', 5], ['ongaku', 7], ['tome', 9], ['te', 10]],
    '赤ちゃんが泣いてる': [['akachan', 4], ['ga', 5], ['nai', 7], ['teru', 9]],
    'ちょっと待って': [['chotto', 4], ['ma~tsu', 6], ['te', 7]],
    '商店街に行く': [['shouten', 2], ['gai', 3], ['ni', 4], ['iku', 6]],
    '書店じゃん': [['shoten', 2], ['jan', 5]],
    '雨じゃん': [['ame', 1], ['jan', 4]],
  };
  const m = (t) => matchWakeReading(t, T[t]);
  assert.deepEqual(m('頂天ちゃん、今日の天気教えて。'), { who: 'choten', rest: '今日の天気教えて。' });
  assert.deepEqual(m('超天ちゃん、おはよう'), { who: 'choten', rest: 'おはよう' });
  assert.equal(m('笑点ちゃんがいっぱい').who, 'choten');
  assert.deepEqual(m('超てったん YouTubeで音楽を流して。'), { who: 'choten', rest: 'YouTubeで音楽を流して。' });
  assert.deepEqual(m('姉ちゃん、音楽すめて'), { who: 'ame', rest: '音楽すめて' });
  assert.deepEqual(m('アナちゃん音楽止めて'), { who: 'ame', rest: '音楽止めて' });
  for (const no of ['赤ちゃんが泣いてる', 'ちょっと待って', '商店街に行く', '書店じゃん', '雨じゃん']) assert.equal(m(no), null, no);
  assert.equal(matchWakeReading('오늘 날씨', undefined), null);
});

test('일본어 재생 부탁: 제목 뒤에 プレイして·流して', () => {
  assert.equal(quickChrome('カーポピンプレイして。', 'ja'), true);
  assert.equal(quickChrome('アイライフの会いに来てプレイして。', 'ja'), true);
  assert.equal(quickChrome('流して', 'ja'), false);
  assert.equal(mediaControl('音楽止めて', 'ja'), 'pause');
});

test('훈독으로 읽힌 한자 표기(笑天ちゃん)도 초텐으로 받는다(2026-10-01 실사용)', () => {
  assert.deepEqual(matchWake('笑天ちゃん X JAPANの Lut N'), { who: 'choten', rest: 'X JAPANの Lut N' });
  assert.equal(matchWake('商店街に行く'), null);
});

test('노래 위로 부른 말: 가사 뒤에 붙은 이름을 글 중간에서 찾는다', () => {
  const t = '朝から公園を散歩して本を読みました。雨ちゃん今日の天気はどう';
  const toks = [['asa', 1], ['kara', 3], ['kouen', 5], ['wo', 6], ['sanpo', 8], ['shi', 9], ['te', 10], ['hon', 11], ['wo', 12], ['yomi', 14], ['mashi', 16], ['ta', 17], ['ame', 19], ['chan', 22], ['kyou', 24], ['no', 25], ['tenki', 27], ['ha', 28], ['dou', 30]];
  assert.deepEqual(matchWakeLoose(t, toks), { who: 'ame', rest: '今日の天気はどう' });
  assert.deepEqual(matchWakeLoose('파이파이너 파이너 초텐짱 노래 멈춰'), { who: 'choten', rest: '노래 멈춰' });
  assert.equal(matchWakeLoose('今日はとてもいい天気ですね', [['kyou', 2], ['ha', 3], ['totemo', 6], ['ii', 8], ['tenki', 10], ['desu', 12], ['ne', 13]]), null);
});

test('말로 지시 모드·대화 모드를 바꾼다', () => {
  assert.equal(modeSwitch('지시 모드'), 'task');
  assert.equal(modeSwitch('지시모드로 바꿔 줘'), 'task');
  assert.equal(modeSwitch('대화 모드'), 'chat');
  assert.equal(modeSwitch('잡담 모드로 전환'), 'chat');
  assert.equal(modeSwitch('指示モードにして'), 'task');
  assert.equal(modeSwitch('会話モード'), 'chat');
  assert.equal(modeSwitch('오늘 날씨 어때'), null);
  assert.equal(modeSwitch('지시 모드가 뭔지 자세하게 길게 설명해 줄 수 있을까'), null); // 긴 말은 그냥 대화
  assert.equal(modeLine('choten', 'ko', 'task'), '지시 모드로 바꿨어♡');
  assert.equal(modeLine('ame', 'ja', 'chat'), '…会話モード。');
});

test('영어 모드: 영어 낱말로 적힌 이름을 알아듣는다(파일 시험의 실제 표기)', () => {
  assert.deepEqual(matchWakeEnglish("Chot and Chan, what's the weather today?"), { who: 'choten', rest: "what's the weather today?" });
  assert.deepEqual(matchWakeEnglish('Ahmed Chan, play some music on YouTube.'), { who: 'ame', rest: 'play some music on YouTube.' });
  assert.equal(matchWakeEnglish('Hey Show 10 chan stop')?.who, 'choten');
  assert.equal(matchWakeEnglish('Amy chan')?.rest, '');
  assert.equal(matchWakeEnglish("What's the weather today?"), null);
  assert.equal(matchWakeEnglish('Jackie Chan is in this movie'), null);
  assert.equal(matchWakeEnglish('오늘 날씨 어때'), null);
});

test('영어 모드의 조작·재생·모드 전환·한 마디', () => {
  assert.equal(mediaControl('stop the music.', 'en'), 'pause');
  assert.equal(mediaControl('next song', 'en'), 'next');
  assert.equal(mediaControl('turn it up', 'en'), null); // 맥 음량(intent.js)
  assert.equal(mediaControl('play', 'en'), 'play');
  assert.equal(mediaControl("what's the weather today?", 'en'), null);
  assert.equal(quickChrome('play some music on YouTube.', 'en'), true);
  assert.equal(quickChrome('play again', 'en'), false);
  assert.equal(modeSwitch('switch to task mode please'), 'task');
  assert.equal(modeSwitch('chat mode'), 'chat');
  assert.ok(voiceNote('en').includes('영어'));
  assert.equal(mediaLine('choten', 'en', 'pause'), 'Paused♡');
  assert.equal(followWorthy('yes', { expectingAnswer: true }).ok, true);
  assert.equal(looksUnfinished('play some music on'), true);
});

test('말로 언어를 바꾼다(지금 언어로 말해도 된다)', () => {
  assert.equal(langSwitch('영어 모드'), 'en');
  assert.equal(langSwitch('일본어 모드로 바꿔 줘'), 'ja');
  assert.equal(langSwitch('英語モードにして'), 'en');
  assert.equal(langSwitch('韓国語モード'), 'ko');
  assert.equal(langSwitch('Korean mode'), 'ko');
  assert.equal(langSwitch('switch to Japanese mode please'), 'ja');
  assert.equal(langSwitch('영어 공부 어떻게 해'), null);
  assert.equal(langLine('choten', 'en'), 'English mode now♡');
});

test('목소리 크기 맞추기: 작게 합성된 말은 더 키우고 큰 말은 덜 키운다', () => {
  const { pcmLevel, normGain, VOICE_TARGET_RMS } = require('../voice.js');
  const tone = (amp, n = 12000) => { const b = Buffer.alloc(n * 2); for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(amp * 32767 * Math.sin(i / 8)), i * 2); return b; };
  const level = (amp) => pcmLevel(tone(amp), { peak: 0, sq: 0, n: 0 });
  const rms = (l) => Math.sqrt(l.sq / l.n);
  // 작게 합성된 말과 크게 합성된 말: 배수를 곱하면 같은 크기가 된다
  const quiet = level(0.05), loud = level(0.3);
  assert.ok(normGain(quiet) > normGain(loud));
  assert.ok(Math.abs(rms(quiet) * normGain(quiet) - VOICE_TARGET_RMS) < 0.002);
  assert.ok(Math.abs(rms(loud) * normGain(loud) - VOICE_TARGET_RMS) < 0.002);
  assert.equal(normGain(level(0.001)), 1.5); // 숨소리뿐이면(말소리 틀이 없다) 앞선 값을 쓴다
  assert.equal(normGain(level(0.001), 2.2), 2.2);
  assert.equal(normGain(level(0.02)), 5); // 너무 작은 소리도 5배까지만
  assert.equal(normGain(level(1)), 0.5);
  // 조용한 틈은 크기에 넣지 않는다
  const mixed = pcmLevel(Buffer.concat([tone(0.3), Buffer.alloc(24000)]), { peak: 0, sq: 0, n: 0 });
  assert.equal(mixed.n, 12000);
});

test('짱 없이 "어이 쵸텐"·"어이 아메"처럼 불러도 받는다(부름말 뒤에 이름이 끊겨 올 때만)', () => {
  assert.deepEqual(matchWake('어이 쵸텐'), { who: 'choten', rest: '' });
  assert.deepEqual(matchWake('어이 아메 노래 멈춰'), { who: 'ame', rest: '노래 멈춰' });
  assert.deepEqual(matchWake('어이 초텐, 지시 모드'), { who: 'choten', rest: '지시 모드' });
  assert.deepEqual(matchWake('야 아메야 뭐해'), { who: 'ame', rest: '뭐해' });
  assert.deepEqual(matchWake('おい、アメ。音楽止めて'), { who: 'ame', rest: '音楽止めて' });
  assert.equal(matchWake('おい超てん')?.who, 'choten');
  // 이름 뒤가 이어지면 딴 말이다
  assert.equal(matchWake('어이 아메리카노 한 잔'), null);
  assert.equal(matchWake('おい、雨が降ってる'), null);
  // 부름말 없이 이름으로 시작한 말은 matchWakeName 이 받는다(2026-10-06 사용자 "쵸텐 아메 어이 쵸텐 어이 아메 등 다양한 부르는 방식")
  assert.equal(matchWake('아메 노래 멈춰'), null);
  assert.deepEqual(require('../voice.js').matchWakeName('아메 노래 멈춰'), { who: 'ame', rest: '노래 멈춰' });
  assert.equal(matchWake('어이 거기'), null);
  // 일본어는 띄어쓰기가 없어 발음 낱말로 본다. 이름 다음이 조사면("雨が…") 부른 게 아니다
  assert.deepEqual(matchWakeReading('おいアメ音楽止めて', [['oi', 2], ['ame', 4], ['ongaku', 6], ['tomete', 9]]), { who: 'ame', rest: '音楽止めて' });
  assert.equal(matchWakeReading('おい雨が降ってる', [['oi', 2], ['ame', 3], ['ga', 4], ['futteru', 8]]), null);
  assert.equal(matchWakeReading('ねえ頂点今日の天気は', [['nee', 2], ['chouten', 4], ['kyou', 6], ['no', 7], ['tenki', 9], ['ha', 10]])?.who, 'choten');
  assert.equal(matchWakeReading('おい商店街に行こう', [['oi', 2], ['shoutengai', 5], ['ni', 6], ['ikou', 9]]), null);
  assert.equal(matchWakeReading('雨音楽止めて', [['ame', 1], ['ongaku', 3], ['tomete', 6]]), null); // 부름말이 없다
  // 영어
  assert.deepEqual(matchWakeEnglish('Hey Choten, play some music'), { who: 'choten', rest: 'play some music' });
  assert.equal(matchWakeEnglish('Hey Amy, stop the music.')?.who, 'ame');
  assert.equal(matchWakeEnglish('Hey, am I late?'), null);
  assert.equal(matchWakeEnglish('hey man what is up'), null);
  // 노래 위로 부른 말(글 중간에서 찾기)은 짱 꼴만 받는다
  assert.equal(matchWakeLoose('君はねえ雨 さよならだけが', undefined), null);
});

test('한국어 받아쓰기가 쵸텐짱을 "초된장"·"조된장"·"초탄장"으로 적어도 받는다(2026-10-01 실사용)', () => {
  assert.deepEqual(matchWake('초된장'), { who: 'choten', rest: '' });
  assert.deepEqual(matchWake('조된장.'), { who: 'choten', rest: '' });
  assert.deepEqual(matchWake('초탄장 기본 의상으로 갈아입어.'), { who: 'choten', rest: '기본 의상으로 갈아입어.' });
  assert.equal(matchWake('된장찌개 끓여 줘'), null);
  assert.equal(matchWake('조선장 이야기'), null);
  // "あめちゃん"의 あ 가 빠져 "めちゃん"으로 적힌다(2026-10-01 실사용 세 번)
  assert.deepEqual(matchWake('めちゃん、音楽止めて。'), { who: 'ame', rest: '音楽止めて。' });
  assert.equal(matchWake('めちゃくちゃ眠い'), null);
  assert.equal(matchWake('なめちゃった'), null);
  assert.equal(matchWakeReading('めちゃ眠い', [['mecha', 3], ['nemui', 5]]), null);
  assert.equal(matchWakeReading('めちゃん、音楽止めて', [['mecha', 3], ['n', 4], ['ongaku', 7], ['tome', 9]])?.who, 'ame');
});

test('합성된 소리 끝의 조용한 시간을 잰다(모자란 만큼 쉬는 시간을 덧붙이려고)', () => {
  const { trailingQuietMs } = require('../voice.js');
  const tone = (amp, ms) => { const n = 24 * ms, b = Buffer.alloc(n * 2); for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(amp * 32767 * Math.sin(i / 8)), i * 2); return b; };
  assert.equal(trailingQuietMs(tone(0.2, 300)), 0); // 말소리로 끝난다
  assert.equal(trailingQuietMs(Buffer.concat([tone(0.2, 200), Buffer.alloc(24 * 2 * 120)])), 120);
  assert.equal(trailingQuietMs(Buffer.concat([tone(0.2, 200), tone(0.002, 100)])), 100); // 아주 작은 소리는 조용한 것으로
  assert.equal(trailingQuietMs(Buffer.alloc(0)), 0);
  assert.equal(langSwitch('イングリッシュモードにお願い。'), 'en'); // 2026-10-01 실사용
});


test('이름 뒤에 조사가 붙으면 부른 게 아니라 문장의 한 부분이다(particle) — main 이 이름을 떼지 않고 넘긴다', () => {
  const V = require('../voice.js');
  // 2026-10-01 실사용: 이름을 떼고 "がお勧めしてくれた歌い手の曲"를 검색어로 틀었다
  const t = 'あめちゃんがお勧めしてくれた歌い手の曲をプレイして。';
  assert.deepEqual(V.matchWake(t, [['ame', 2], ['chan', 5], ['ga', 6], ['osusume', 9]]), { who: 'ame', rest: 'がお勧めしてくれた歌い手の曲をプレイして。', particle: true });
  // 낱말 경계를 봐야 한다: "がんばって"의 が 는 조사가 아니다. 토큰이 없으면 일본어는 보지 않는다
  assert.deepEqual(V.matchWake('あめちゃんがんばって', [['ame', 2], ['chan', 5], ['ganba~tsu', 9], ['te', 10]]), { who: 'ame', rest: 'がんばって' });
  assert.deepEqual(V.matchWake(t), { who: 'ame', rest: 'がお勧めしてくれた歌い手の曲をプレイして。' });
  assert.deepEqual(V.matchWake('あめちゃん、音楽止めて', [['ame', 2], ['chan', 5], ['ongaku', 8]]), { who: 'ame', rest: '音楽止めて' });
  // 발음으로 맞춘 이름도 같다("めちゃんに変身して")
  assert.deepEqual(V.matchWakeReading('亀ちゃんに変身して', [['ame', 1], ['chan', 4], ['ni', 5], ['henshin', 7]]), { who: 'ame', rest: 'に変身して', particle: true });
  // 한국어: 이름에 붙여 쓴 조사만("아메짱 이 노래"의 이 는 다음 낱말이다)
  assert.deepEqual(V.matchWake('아메짱이 추천해 준 노래 틀어 줘'), { who: 'ame', rest: '이 추천해 준 노래 틀어 줘', particle: true });
  assert.deepEqual(V.matchWake('아메짱 이 노래 뭐야'), { who: 'ame', rest: '이 노래 뭐야' });
  assert.deepEqual(V.matchWake('초텐짱으로 변신해 줘'), { who: 'choten', rest: '으로 변신해 줘', particle: true });
  assert.equal(V.canonName('ame', 'ja') + 'に変身して', 'あめちゃんに変身して');
  assert.equal(V.canonName('choten', 'ko'), '초텐짱');
});

test('말 전체가 이름뿐이거나 "ちゃん"만 남은 것도 부른 것이다(확정에서만 본다)', () => {
  const V = require('../voice.js');
  // 2026-10-01 실사용: 노래 중에 "雨"만 받아써져 버렸다
  for (const t of ['雨', '雨。', 'アメ', 'あめ', '아메', '아메야', '초텐', '쵸텐아', '超てん']) assert.ok(V.matchWakeBare(t), t);
  assert.equal(V.matchWakeBare('雨').who, 'ame');
  assert.equal(V.matchWakeBare('초텐').who, 'choten');
  for (const t of ['雨が降ってる', '아메리카노', '雨だ', 'あ、雨', '姉', '오늘 날씨']) assert.equal(V.matchWakeBare(t), null, t);
  // "ちゃん"만 들렸다(작게 불렀거나 캐릭터 말이 끝나기 전에 부르기 시작) → 지금 캐릭터(who: null)
  assert.deepEqual(V.matchWakeTail('ちゃん', [['chan', 3]]), { who: null, rest: '' });
  assert.deepEqual(V.matchWakeTail('ちゃん英語のもた。', [['chan', 3], ['eigo', 5]]), { who: null, rest: '英語のもた。' });
  assert.equal(V.matchWakeTail('ちゃんとやって', [['chanto', 4], ['ya~tsu', 6], ['te', 7]]), null);
  assert.equal(V.matchWakeTail('ちゃん', undefined), null);
});

test('노래 소리가 나는 중(loose)에는 더 달리 적힌 이름도 받는다 — 조용할 때는 받지 않는다', () => {
  const V = require('../voice.js');
  const kame = ['亀ちゃん、ボリューム 50%下げて。', [['kame', 1], ['chan', 4], ['boryūmu', 10]]];
  assert.equal(V.matchWakeReading(...kame), null);
  assert.deepEqual(V.matchWakeReading(...kame, { loose: true }), { who: 'ame', rest: 'ボリューム 50%下げて。' });
  assert.equal(V.matchWakeReading('あやちゃん', [['aya', 2], ['chan', 5]], { loose: true })?.who, 'ame');
  assert.equal(V.matchWakeReading('あやちゃん', [['aya', 2], ['chan', 5]]), null);
  assert.equal(V.matchWakeReading('さえきちゃん、メール', [['saeki', 3], ['chan', 6], ['mēru', 10]], { loose: true }), null);
  assert.equal(V.matchWakeReading('赤ちゃんが泣いてる', [['akachan', 4], ['ga', 5]], { loose: true }), null);
  // 노래 가사 뒤에 붙은 이름(글 중간)도 느슨하게
  assert.equal(V.matchWakeLoose('止まらない亀ちゃん止まって。', [['tomara', 3], ['nai', 5], ['kame', 6], ['chan', 9], ['toma~tsu', 12], ['te', 13]], { loose: true })?.rest, '止まって。');
});

test('이름 변형 보강: "天ちゃん"·"초편장"·"초짱"·"Hey雨"(2026-10-01 실사용)', () => {
  const V = require('../voice.js');
  assert.deepEqual(V.matchWakeReading('天ちゃん希望の。', [['ten', 1], ['chan', 4], ['kibou', 6], ['no', 7]]), { who: 'choten', rest: '希望の。' });
  assert.deepEqual(V.matchWake('초편장'), { who: 'choten', rest: '' });
  assert.deepEqual(V.matchWake('초짱 일본어 모드'), { who: 'choten', rest: '일본어 모드' });
  assert.equal(V.matchWake('초장 좀 줘'), null); // 장 은 아니다(초장)
  assert.deepEqual(V.matchWake('Hey雨。'), { who: 'ame', rest: '' });
  assert.equal(V.matchWake('Hey雨が降ってる'), null);
});

test('노래 조작은 한 문장이 통째로 그 조작일 때만(2026-10-01 검토: 낱말만 들어 있어도 받아서 딴 말이 노래를 멈췄다)', () => {
  const V = require('../voice.js');
  for (const [t, k] of [['노래 멈춰', 'pause'], ['잠깐 멈춰 줘', 'pause'], ['음악 꺼줘.', 'pause'], ['그만', 'pause'], ['이제 그만 틀어', 'pause'], ['다음 곡', 'next'],
    ['다음 노래로 넘겨 줘', 'next'], ['넘겨', 'next'], ['이전 곡으로', 'prev'], ['다시 틀어 줘', 'play'], ['이어서', 'play'], ['음악 재생해줘.', 'play'], ['노래 켜 줘', 'play']]) assert.equal(V.mediaControl(t, 'ko'), k, t);
  for (const t of ['불 꺼 줘', '다음 거 뭐야', '이어서 말해 봐', '아이유 틀어줘', '켜 줘', '멈추지 마', '오늘 날씨 어때']) assert.equal(V.mediaControl(t, 'ko'), null, t);
  for (const [t, k] of [['止めて', 'pause'], ['音楽を止めてください。', 'pause'], ['ちょっと、止めて', 'pause'], ['消して', 'pause'], ['次の曲', 'next'], ['スキップ', 'next'],
    ['前の曲', 'prev'], ['再生して。', 'play'], ['続けて', 'play'], ['またプレイして', 'play'], ['音楽かけて', 'play'], ['かけて', 'play']]) assert.equal(V.mediaControl(t, 'ja'), k, t);
  for (const t of ['冗談はやめて', '電気消して', 'もう一度言って', '電話かけて', '米津かけて', 'やめないで', '止まらない']) assert.equal(V.mediaControl(t, 'ja'), null, t);
  // 받아쓰기가 문장 둘로 적은 것("止めて。止めて")과 이름이 문장에 붙어 온 것도 받는다. 제목 뒤의 プレイして 는 이어 틀기가 아니다
  assert.equal(V.mediaControl('止めて。止めて', 'ja'), 'pause');
  assert.equal(V.mediaControl('あめちゃんが止めて。止めて', 'ja'), 'pause');
  assert.equal(V.mediaControl('あめちゃんの音楽止めて', 'ja'), 'pause');
  assert.equal(V.mediaControl('さよならだけが人生だ。プレイして。', 'ja'), null);
  for (const [t, k] of [['stop the music.', 'pause'], ['make it stop', 'pause'], ['next song', 'next'], ['skip', 'next'], ['go back', 'prev'], ['resume', 'play'], ['play again', 'play']]) assert.equal(V.mediaControl(t, 'en'), k, t);
  for (const t of ["don't stop", 'what is next on my schedule', 'let us continue our talk', 'stop talking']) assert.equal(V.mediaControl(t, 'en'), null, t);
});

test('이름은 낱말로 끊겨 있을 때만 받는다(2026-10-01 검토: 딴 말의 한가운데가 이름으로 읽혔다)', () => {
  const V = require('../voice.js');
  for (const t of ['밤에 잔다', '아 나 장난 아니야', '조 된장 사와', '초텐짱이야', '아메짱안녕']) assert.equal(V.matchWake(t), null, t);
  assert.equal(V.matchWake('雨ちゃんと降ってる', [['ame', 1], ['chanto', 5], ['fu~tsu', 7], ['teru', 9]]), null);
  // 받던 것은 그대로
  assert.deepEqual(V.matchWake('밤에 짱 나 오늘 좀 피곤해'), { who: 'ame', rest: '나 오늘 좀 피곤해' });
  assert.deepEqual(V.matchWake('조된장.'), { who: 'choten', rest: '' });
  assert.deepEqual(V.matchWake('야 초텐짱 뭐해'), { who: 'choten', rest: '뭐해' });
  assert.deepEqual(V.matchWake('아메짱아 노래 틀어'), { who: 'ame', rest: '노래 틀어' });
  assert.deepEqual(V.matchWake('ねえ、あめちゃん今日の天気は', [['nee', 2], ['ame', 5], ['chan', 8], ['kyou', 10]]), { who: 'ame', rest: '今日の天気は' });
  // 노래 가사 속 말: 낱말이 시작하는 자리의 "○○ちゃん"만 찾는다
  assert.equal(V.matchWakeLoose('お姉ちゃんが好き', [['onee', 2], ['chan', 5], ['ga', 6], ['suki', 8]], { loose: true }), null);
  assert.equal(V.matchWakeLoose('お姉ちゃんが好き', [['o', 1], ['ane', 2], ['chan', 5], ['ga', 6], ['suki', 8]], { loose: true }), null);
  assert.equal(V.matchWakeLoose('오늘 밤에 잔뜩 마셨어', undefined, { loose: true }), null);
  assert.equal(V.matchWakeLoose('そうだね雨やんだ', [['sou', 2], ['da', 3], ['ne', 4], ['ame', 5], ['yanda', 8]], { loose: true }), null);
  assert.equal(V.matchWakeLoose('止めてめちゃんが止めて。止めて', [['tome', 2], ['te', 3], ['mecha', 6], ['n', 7], ['ga', 8], ['tome', 10], ['te', 11], ['tome', 14], ['te', 15]], { loose: true })?.who, 'ame');
  // 한 마디만으로 부를 때 흔한 낱말로 적힌 것(商店·頂点)은 받지 않는다
  assert.equal(V.matchWakeBare('商店'), null);
  assert.equal(V.matchWakeBare('頂点'), null);
});

test('이어 듣기의 소리 크기 기준은 방의 조용함에 맞춘다 / 묻는 말은 모드를 바꾸지 않는다 / 영어 이름 띠링은 영어 모드에서만', () => {
  const V = require('../voice.js');
  assert.equal(V.followWorthy('今日の天気は', { peakRms: 0.009, noiseFloor: 0.001 }).ok, true);  // 조용한 방에서 작게 한 말
  assert.equal(V.followWorthy('今日の天気は', { peakRms: 0.009, noiseFloor: 0.003 }).ok, false); // 보통 방에서는 여전히 작은 소리
  assert.equal(V.followWorthy('今日の天気は', { peakRms: 0.004, noiseFloor: 0.001 }).ok, false);
  // 참조 에코 제거 중(band): 크기는 말소리 대역의 것(전체의 0.6~0.7배), 바닥은 그 순간 예상되는 주변 소리
  assert.equal(V.followWorthy('今日月が綺麗やね', { peakRms: 0.007, noiseFloor: 0.0015, band: true }).ok, true);  // 밤에 작게 한 말(전체 크기 0.011 — 전에는 버려졌다)
  assert.equal(V.followWorthy('今日月が綺麗やね', { peakRms: 0.0035, noiseFloor: 0.0015, band: true }).ok, false); // 방 소음보다 조금 큰 소리
  assert.equal(V.followWorthy('今日月が綺麗やね', { peakRms: 0, noiseFloor: 0.0015, band: true }).ok, false);      // 말소리로 잡히지 않은 소리가 받아써진 것
  assert.equal(V.followWorthy('次の曲にして', { peakRms: 0.03, noiseFloor: 0.002, band: true, music: true }).ok, true);    // 노래 위로 한 말
  assert.equal(V.followWorthy('忘れないように', { peakRms: 0.006, noiseFloor: 0.002, band: true, music: true }).ok, false); // 남은 노래의 봉우리(0.005~0.007)
  assert.equal(V.followWorthy('忘れないように', { peakRms: 0.012, noiseFloor: 0.004, band: true, music: true }).ok, false); // 덜 지워진 노래: 주변의 4배가 안 된다
  assert.equal(V.modeSwitch('지시 모드가 뭐야'), null);
  assert.equal(V.modeSwitch('지시 모드'), 'task');
  assert.equal(V.langSwitch('영어 모드가 뭐야'), null);
  assert.equal(V.chimeWorthy('Hey Amy what time is it', false, undefined, { lang: 'ko' }), false);
  assert.equal(V.chimeWorthy('Hey Amy what time is it', false, undefined, { lang: 'en' }), true);
});

test('실제 낱말 분석기(받아쓰기와 같은 것)가 준 토큰으로 본 이름 판정(2026-10-01 실사용 문장)', () => {
  const V = require('../voice.js');
  // 노래 가사 뒤에 붙은 "おい雨": 글 중간이어도 받는다("おい"는 가사의 끝말이 아니다). "ね"+"雨"는 받지 않는다
  const t1 = '止まらないおい雨止まって。', k1 = [['tomara', 3], ['nai', 5], ['oi', 7], ['ame', 8], ['toma~tsu', 11], ['te', 12]];
  assert.deepEqual(V.matchWakeLoose(t1, k1, { loose: true }), { who: 'ame', rest: '止まって。' });
  assert.equal(V.matchWakeLoose('そうだね雨やんだ', [['sou', 2], ['da', 3], ['ne', 4], ['ame', 5], ['yanda', 8]], { loose: true }), null);
  // 이름을 두 번 적은 것: 남은 말이 또 이름으로 시작한다(main 이 한 번 더 뗀다)
  const first = V.matchWake('あめちゃんめちゃん、音楽止めて。', [['ame', 2], ['chan', 5], ['me', 6], ['chan', 9], ['ongaku', 12], ['tome', 14], ['te', 15]]);
  assert.deepEqual(first, { who: 'ame', rest: 'めちゃん、音楽止めて。' });
  assert.deepEqual(V.matchWake(first.rest, [['me', 1], ['chan', 4], ['ongaku', 7], ['tome', 9], ['te', 10]]), { who: 'ame', rest: '音楽止めて。' });
  // "お姉ちゃん"(o + ane + chan)은 가사에 흔하다
  assert.equal(V.matchWakeLoose('お姉ちゃんが好き', [['o', 1], ['ane', 2], ['chan', 5], ['ga', 6], ['suki', 8]], { loose: true }), null);
  // "超てんちゃん"은 낱말 셋으로 나뉜다(chou·ten·chan)
  assert.deepEqual(V.matchWake('超てんちゃん、パジャマに着替えて', [['chou', 1], ['ten', 3], ['chan', 6], ['pajama', 11], ['ni', 12], ['kigae', 15]]), { who: 'choten', rest: 'パジャマに着替えて' });
});

test('다른 프로젝트 대화에 넘겼을 때의 대사: 한국어는 제목, 일본어·영어는 폴더 이름(한글 제목을 못 읽는다)', () => {
  const V = require('../voice.js');
  const where = { title: '포트폴리오 사이트 기획', folder: '/Users/a/Desktop/pofol' };
  assert.equal(V.delegateLine('choten', 'ko', where), '포트폴리오 사이트 기획에 넘겼어! 끝나면 알려 줄게♡');
  assert.match(V.delegateLine('ame', 'ko', where), /^…포트폴리오 사이트 기획에 넘겼다/);
  assert.match(V.delegateLine('choten', 'ja', where), /^pofolに頼んだよ/);
  assert.match(V.delegateLine('ame', 'en', where), /Passed it to pofol/);
  assert.match(V.delegateLine('choten', 'ja', { title: 'Add describe()', folder: '/x/backend' }), /^Add describe\(\)に/);
  // 일본어 "中止して"도 노래 멈춤 말이다
  assert.equal(V.mediaControl('音楽中止して', 'ja'), 'pause');
});

test('이름 + じゃん 만으로 된 말은 부름(사용자 2026-10-02 "じゃん은 이름만 부를 때만 받아라"), 뒤에 말이 이어지면 아니다', () => {
  const V = require('../voice.js');
  // 실사용에서 버려졌던 부름들
  for (const t of ['頂点じゃん。', '頂点じゃん', '商店じゃん。', 'ちょうてんじゃん', '超てんじゃん', 'おい頂店じゃん', 'ねえ、超天じゃん！']) assert.deepEqual(V.matchWakeBare(t), { who: 'choten', rest: '' }, t);
  for (const t of ['雨じゃん。', 'あめじゃん', 'アメじゃん', 'おい、雨じゃん。']) assert.deepEqual(V.matchWakeBare(t), { who: 'ame', rest: '' }, t);
  // 뒤에 말이 이어지는 흔한 말, 그것만으로도 흔한 말, 이름이 아닌 것
  for (const t of ['雨じゃん、傘持ってきた？', '書店じゃん。今日はどう', '雨じゃんか', '穴じゃん', 'じゃん', '雨じゃない', '頂点じゃない？']) assert.equal(V.matchWakeBare(t), null, t);
  // 이름을 글 안에서 찾는 쪽(matchWake)은 그대로 じゃん 을 받지 않는다
  assert.equal(V.matchWake('雨じゃん、傘持ってきた？'), null);
});

test('짧게 부른 것도 받는다(2026-10-03 "처음 이름을 부를 때 좀 더 짧게 부를 때도")', () => {
  const V = require('../voice.js');
  for (const t of ['초단장', '텐짱', 'てんちゃん']) assert.deepEqual(V.matchWake(t), { who: 'choten', rest: '' }, t);
  assert.deepEqual(V.matchWake('소탄장 음악 꺼줘.'), { who: 'choten', rest: '음악 꺼줘.' });
  for (const t of ['あ、頂点。', 'ねえ商店', 'おい、頂点']) assert.equal(V.matchWakeBare(t)?.who, 'choten', t);
  for (const t of ['頂点', '단장님', '소탄', '頂点を目指す', 'あ、頂点を取った']) assert.equal(V.matchWake(t) || V.matchWakeBare(t), null, t);
});

test('작게 불러 달리 적힌 이름도 받는다(2026-10-03 "이름 불러서 호출할때 더 작은 목소리도 인식하도록")', () => {
  const V = require('../voice.js');
  const wake = (s) => V.matchWake(s) || V.matchWakeBare(s);
  assert.equal(wake('주된장')?.who, 'choten');
  assert.equal(wake('주된장 음악 꺼 줘')?.rest, '음악 꺼 줘');
  assert.equal(wake('초대장.')?.who, 'choten'); // 그것만 말했을 때만
  // 흔한 말은 그대로 버린다
  assert.equal(wake('주된 장을 펼쳐'), null);
  assert.equal(wake('주된 장점은 속도야'), null);
  assert.equal(wake('초대장 보내 줘'), null);
});

test('음성 지시 메모는 답 전체를 그 언어로, 끝에 작업 기록을 남기게 한다(2026-10-03)', () => {
  const V = require('../voice.js');
  const ko = V.voiceTaskNote('ko', { heard: '초텐 "이거" 해 줘' });
  assert.match(ko, /처음부터 끝까지 전부 한국어로/);
  assert.match(ko, /### 음성 지시 작업 기록/);
  assert.match(ko, /받아쓴 말 그대로: "초텐 '이거' 해 줘"/);
  assert.match(V.voiceTaskNote('ja'), /전부 일본어로.*### 音声指示の作業記録/);
  assert.match(V.voiceTaskNote('en'), /전부 영어로.*### Voice task record/);
});

test('소리로 읽을 때는 작업 기록 앞에서 끊는다(언어마다 제목이 달라도)', () => {
  const V = require('../voice.js');
  assert.equal(V.spokenSummary('이름 변형을 더 받게 했어요. 시험 175개 통과.\n### 음성 지시 작업 기록\n- 받은 지시: 초텐 …'), '이름 변형을 더 받게 했어요. 시험 175개 통과.');
  assert.equal(V.spokenSummary('名前の言い方を増やしました。\n\n### 音声指示の作業記録\n- 指示: …'), '名前の言い方を増やしました。');
  assert.equal(V.spokenSummary('Done.\n## Voice task record\n- asked: …'), 'Done.');
});

test('결과 글이 그 언어가 아니면 알아챈다(셋 중 둘이 영어로 왔다, 2026-10-03)', () => {
  const { langMismatch } = require('../voice.js');
  const en = 'The mascot now responds to shorter name calls. I added "초단장", "소탄장" and "텐짱". All 170 tests pass.';
  assert.equal(langMismatch(en, 'ko'), true);
  assert.equal(langMismatch(en, 'en'), false);
  const ko = '이제 작업 결과 설명이 지금 언어 모드에 맞춰 나와요. `main.js` 의 resultNote 와 voice.js 의 langRule 을 고쳤고 /Users/dobedub/Desktop/skinclaude/overlay/test 를 돌렸어요.';
  assert.equal(langMismatch(ko, 'ko'), false);
  assert.equal(langMismatch(ko, 'ja'), true);
  assert.equal(langMismatch('作業結果の説明は今の言語モードに合わせて出ます。main.js と voice.js を直しました。', 'ja'), false);
  assert.equal(langMismatch('OK, done.', 'ko'), false); // 너무 짧으면 가리지 않는다
});

test('짱 없이·비슷한 발음으로 불러도 받는다(2026-10-06 "쵸텐 아메 어이 쵸텐 어이 아메 등 다양한 부르는 방식과 유사한 발음도")', () => {
  const V = require('../voice.js');
  // 이름으로 시작하는 말: 이름 뒤는 끊겨 있어야 한다
  assert.deepEqual(V.matchWakeName('쵸텐 노래 틀어 줘'), { who: 'choten', rest: '노래 틀어 줘' });
  assert.deepEqual(V.matchWakeName('아메, 오늘 날씨 어때'), { who: 'ame', rest: '오늘 날씨 어때' });
  assert.deepEqual(V.matchWakeName('초텐아 뭐해'), { who: 'choten', rest: '뭐해' });
  assert.deepEqual(V.matchWakeName('초 텐 노래 꺼 줘'), { who: 'choten', rest: '노래 꺼 줘' });
  for (const t of ['아메리카노 한 잔', '초텐이 귀여워', '아메짱안녕', '아 메일 왔어', '오늘 초텐 봤어', '雨が降ってる']) assert.equal(V.matchWakeName(t), null, t);
  // 실사용에서 버려졌던 부름(작게·빨리 불러 달리 적힘) — 말 전체가 부름말과 이름뿐일 때
  for (const [t, who] of [['어이 좆된.', 'choten'], ['초 텐트.', 'choten'], ['초텐 초텐', 'choten'], ['어이 밤에.', 'ame'], ['거의 암에.', 'ame'], ['아매', 'ame'], ['아메 아메', 'ame']]) {
    assert.deepEqual(V.matchWakeBare(t), { who, rest: '', sound: true }, t);
  }
  assert.deepEqual(V.matchWake('거기 초텐 초텐짱.'), { who: 'choten', rest: '' }); // 이름을 두 번
  // 흔한 말은 그대로 버린다: 낱말(초딩·조던·수단·초대·애매), 대답("아 네"), 뒤에 말이 이어지는 것("야 밤에 뭐 해"·"좆된다"·"야 암에 좋대")
  for (const t of ['초딩', '어이 초딩', '조던.', '수단.', '초대.', '애매.', '아 네.', '밤에.', '야 밤에', '야 밤에 뭐 해', '좆된다', '초탄성', '주된 장을 펼쳐']) {
    assert.equal(V.matchWake(t) || V.matchWakeBare(t) || V.matchWakeName(t), null, t);
  }
  assert.equal(V.matchWake('야 암에 좋대'), null);
  assert.deepEqual(V.matchWake('어이 아메 노래 멈춰'), { who: 'ame', rest: '노래 멈춰' }); // 받던 것은 그대로
  // 이름만 부르고 연 창에서는 두 글자 말도 받는다(부르고 바로 한 "안녕"이 버려졌다)
  assert.equal(V.followWorthy('안녕', { called: true }).ok, true);
  assert.equal(V.followWorthy('안녕').ok, false);
  assert.equal(V.followWorthy('응', { called: true }).ok, false);
});

test('문단마다 붙은 감정 태그도 읽지 않는다(2026-10-07 "[사랑] [응원] 등의 감정상태가 … 가려지는 게 좋겠다")', () => {
  const V = require('../voice.js');
  assert.equal(V.speakable('[삐짐] 에이, 쳇!\n\n[응원] 그래도 완벽한 선택이야♡'), '에이, 쳇! 그래도 완벽한 선택이야');
  assert.equal(V.speakable('[웃음] 푸핫 맞아\n[사랑] 약속이야 P?\n[크롬] 구글에서 날씨 검색'), '푸핫 맞아 약속이야 P?');
  assert.equal(V.speakable('그냥 말 [응원] 중간'), '그냥 말 중간');
  assert.equal(V.speakable('[기쁨] 링크 [여기](https://x.y)'), '링크 [여기](https://x.y)'); // 태그가 아닌 [글]은 둔다
});

test('완료 알림 한 마디: 캐릭터·언어, 제목 없으면 폴더, 일본어·영어는 한글 제목 대신 폴더(2026-10-07 설정 "완료 알림")', () => {
  const V = require('../voice.js');
  assert.equal(V.doneLine('choten', 'ko', { title: '포트폴리오 사이트', folder: '/Users/me/Desktop/portfolio' }), 'P, 포트폴리오 사이트 끝났어♡ 확인해 봐!');
  assert.equal(V.doneLine('ame', 'ko', { title: '', folder: '/Users/me/Desktop/portfolio' }), '…portfolio, 끝났어. 봐 봐.');
  assert.equal(V.doneLine('ame', 'ko', {}), '…작업, 끝났어. 봐 봐.');
  assert.equal(V.doneLine('choten', 'ja', { title: '포트폴리오', folder: '/x/portfolio' }), 'P、portfolio終わったよ♡ 見てみて！');
  assert.equal(V.doneLine('ame', 'en', { title: 'Site revamp', folder: '/x/site' }), '…Site revamp is done. Go look.');
  assert.equal(V.doneLine('choten', 'ko', { title: '아주아주아주아주아주아주아주아주아주아주 긴 제목', folder: '' }), 'P, 아주아주아주아주아주아주아주아주아주아주 끝났어♡ 확인해 봐!');
});
