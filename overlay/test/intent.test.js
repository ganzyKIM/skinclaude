// intent.js — 모델 없이 바로 처리하는 부탁(변신·의상·사이트 열기·검색·재생) 판정 (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const { detect, langsOf, parseAction, cancelIntent, volumeIntent, screenIntent, formIntent, costumeIntent, openIntent, searchIntent, playIntent, mediaQuery, line, parseYouTubeResults, COSTUME_KEYS } = require('../intent.js');

test('변신: 이름과 변신·바꿔가 같이 오면 그 캐릭터로, 이름이 없으면 번갈아', () => {
  assert.equal(formIntent('아메로 변신'), 'ame');
  assert.equal(formIntent('아메로 변신해 줘.'), 'ame');
  assert.equal(formIntent('아메짱으로 바꿔 줘'), 'ame');
  assert.equal(formIntent('초텐으로 돌아와'), 'choten');
  assert.equal(formIntent('쵸텐짱 모드'), 'choten');
  assert.equal(formIntent('아메로'), 'ame');
  assert.equal(formIntent('변신!'), 'toggle');
  assert.equal(formIntent('변신해 줘'), 'toggle');
  assert.equal(formIntent('雨に変身して'), 'ame'); // 받아쓰기가 あめ 를 雨 로 적는다
  assert.equal(formIntent('雨に返信して'), 'ame'); // 変身 을 返信 으로 적은 것(2026-10-01 실사용)
  assert.equal(formIntent('アメちゃんに変わって'), 'ame');
  assert.equal(formIntent('超てんちゃんに変身'), 'choten');
  assert.equal(formIntent('頂点に戻って'), 'choten');
  assert.equal(formIntent('変身して'), 'toggle');
  assert.equal(formIntent('transform into Ame'), 'ame');
  assert.equal(formIntent('Switch to Ahmed Chan.'), 'ame'); // 영어 받아쓰기의 이름 표기
  assert.equal(formIntent('turn into Choten-chan'), 'choten');
  assert.equal(formIntent('transform'), 'toggle');
});

test('변신이 아닌 말은 건드리지 않는다', () => {
  assert.equal(formIntent('아메리카노로 바꿔 줘'), null);
  assert.equal(formIntent('雨になってきたね'), null);
  assert.equal(formIntent('返信して'), null); // 이름 없는 返信 은 "답장해"
  assert.equal(formIntent('メールに返信して'), null);
  assert.equal(formIntent('아메는 뭐 하고 있어?'), null);
  assert.equal(formIntent('switch to the main branch'), null);
  assert.equal(formIntent('오늘 초텐짱 방송에서 변신하는 장면 진짜 귀여웠다고 생각하지 않아?'), null);
});

test('의상: 이름과 입어·바꿔가 붙어 있으면 그 의상으로', () => {
  assert.equal(costumeIntent('기모노로 갈아입어 줘'), 'kimono');
  assert.equal(costumeIntent('기모노로'), 'kimono');
  assert.equal(costumeIntent('바니걸 옷 입어 줘'), 'bunny');
  assert.equal(costumeIntent('잠옷으로 갈아입어'), 'pajama');
  assert.equal(costumeIntent('여름 원피스로 바꿔 줘'), 'summer');
  assert.equal(costumeIntent('수영복 입어 봐'), 'swim');
  assert.equal(costumeIntent('간호사복으로 바꿔'), 'nurse');
  assert.equal(costumeIntent('기본 옷으로'), 'base'); // 2026-10-01 실사용
  assert.equal(costumeIntent('기본 의상으로 변신.'), 'base'); // 2026-10-01 실사용: 옷을 두고 "변신"이라고도 한다
  assert.equal(detect('아메로 변신', ['ko']).kind, 'form'); // 캐릭터 이름이면 변신
  assert.equal(costumeIntent('원래대로 갈아입어'), 'base');
  assert.equal(costumeIntent('평소 옷으로 돌아와'), 'base');
  assert.equal(costumeIntent('基本の服装で'), 'base'); // 2026-10-01 실사용
  assert.equal(costumeIntent('基本の服装で返信してみ。'), 'base'); // 変身 을 返信 으로 받아쓴 것(2026-10-01 실사용)
  assert.equal(costumeIntent('着物に着替えて'), 'kimono');
  assert.equal(costumeIntent('ナース服にして'), 'nurse');
  assert.equal(costumeIntent('水着を着て'), 'swim');
  assert.equal(costumeIntent('元の服に戻して'), 'base');
  assert.equal(costumeIntent('夏の服にして'), 'summer');
  assert.equal(costumeIntent('put on the bunny outfit'), 'bunny');
  assert.equal(costumeIntent('Change into your pajamas.'), 'pajama');
  assert.equal(costumeIntent('switch back to your normal outfit'), 'base');
  assert.equal(costumeIntent('옷 갈아입어 줘'), 'random');
  assert.equal(costumeIntent('着替えて'), 'random');
  assert.equal(costumeIntent('change your outfit'), 'random');
  for (const k of ['base', 'kimono', 'bunny', 'pajama', 'casual', 'summer', 'lounge', 'knit', 'nurse', 'swim', 'saint']) assert.ok(COSTUME_KEYS.includes(k), k); // index.html 의 의상 목록과 같다
});

test('의상이 아닌 말은 건드리지 않는다(지시 모드의 진짜 작업)', () => {
  assert.equal(costumeIntent('기본 설정으로 바꿔 줘'), null);
  assert.equal(costumeIntent('여름 이벤트 배너 색 바꿔 줘'), null);
  assert.equal(costumeIntent('니트 상품 이미지 바꿔 줘'), null);
  assert.equal(costumeIntent('夏の曲を流して'), null);
  assert.equal(costumeIntent('元に戻して'), null);
  assert.equal(costumeIntent('put on some music'), null);
  assert.equal(costumeIntent('switch to the default branch'), null);
  assert.equal(costumeIntent('기모노 입은 캐릭터 그림을 찾아서 폴더에 정리해 줘'), null);
});

test('사이트 열기: 사이트 이름과 열어 줘뿐인 짧은 말', () => {
  assert.deepEqual(openIntent('유튜브 열어 줘'), { site: 'youtube', url: 'https://www.youtube.com/' });
  assert.equal(openIntent('유튜브 켜 줘')?.site, 'youtube');
  assert.equal(openIntent('유튜브 뮤직 열어')?.site, 'ytmusic');
  assert.equal(openIntent('네이버에 들어가 줘')?.site, 'naver');
  assert.equal(openIntent('구글 지도 띄워 줘')?.site, 'maps');
  assert.equal(openIntent('지메일 좀 열어 줘')?.site, 'gmail');
  assert.equal(openIntent('YouTubeを開いて')?.site, 'youtube');
  assert.equal(openIntent('グーグル開いて。')?.site, 'google');
  assert.equal(openIntent('open YouTube')?.site, 'youtube');
  assert.equal(openIntent('Go to the GitHub website.')?.site, 'github');
  assert.equal(openIntent('유튜브에서 고양이 영상 열어 줘'), null);
  assert.equal(openIntent('open the file main.js'), null);
  assert.equal(openIntent('구글 캘린더에 회의 일정 넣어 줘'), null);
  assert.equal(openIntent('창문 열어 줘'), null);
});

test('검색 열기: "검색"이라고 한 말은 결과 페이지를 연다', () => {
  assert.deepEqual(searchIntent('구글에서 고양이 검색해 줘'), { engine: 'google', query: '고양이', url: 'https://www.google.com/search?q=%EA%B3%A0%EC%96%91%EC%9D%B4' });
  assert.equal(searchIntent('크롬에서 오늘 서울 날씨 검색해 줘')?.query, '오늘 서울 날씨');
  assert.equal(searchIntent('유튜브에서 아이묭 검색')?.engine, 'youtube');
  assert.equal(searchIntent('네이버에서 맛집 좀 찾아 줘')?.engine, 'naver');
  assert.equal(searchIntent('가을 검색해 줘')?.query, '가을'); // 끝 글자를 조사로 잘라 먹지 않는다
  assert.equal(searchIntent('グーグルで猫を検索して')?.query, '猫');
  assert.equal(searchIntent('YouTubeで米津玄師を検索して')?.engine, 'youtube');
  assert.equal(searchIntent('猫の動画ググって')?.query, '猫の動画');
  assert.equal(searchIntent('search for cats on YouTube')?.engine, 'youtube');
  assert.equal(searchIntent('Google the weather in Tokyo.')?.query, 'the weather in Tokyo');
  assert.equal(searchIntent('search youtube for lofi beats')?.query, 'lofi beats');
  assert.equal(searchIntent('검색해 줘'), null);
  assert.equal(searchIntent('구글에서 검색해 줘'), null); // 무엇을 찾을지 없다
  assert.equal(searchIntent('프로젝트에서 TODO 검색해 줘'), null); // 코드 검색은 지시가 맡는다
  assert.equal(searchIntent('search the code for TODO'), null);
  assert.equal(searchIntent('오늘 날씨 알려 줘'), null);
  assert.equal(searchIntent('猫について調べて'), null); // 답을 바라는 말은 모델에게
});

test('재생 부탁: 문장 끝이 틀어/재생/流して 이거나 영어는 play 로 시작', () => {
  assert.equal(playIntent('유튜브에서 캔디튠 바이바이 파이트 틀어줘', 'ko'), true);
  assert.equal(playIntent('아이묭 마리골드 재생해 줘', 'ko'), true);
  assert.equal(playIntent('마리골드 들려줘', 'ko'), false); // 짧고 어디서인지 없으면 모델이 판단한다
  assert.equal(playIntent('신나는 노래 하나 틀어 줘', 'ko'), true);
  assert.equal(playIntent('고양이 영상 보여 줘', 'ko'), true);
  assert.equal(playIntent('유튜브 영상 추천해 줘', 'ko'), false);
  assert.equal(playIntent('YouTubeで合言葉の歌ってみたを流して', 'ja'), true);
  assert.equal(playIntent('梅雨のロックな気味とはお別れだ。プレイして', 'ja'), true); // 2026-10-01 실사용
  assert.equal(playIntent('流して', 'ja'), false);
  assert.equal(playIntent('play some music on YouTube.', 'en'), true);
  assert.equal(playIntent('play again', 'en'), false);
});

test('지시 모드의 진짜 작업은 재생으로 가로채지 않는다', () => {
  assert.equal(playIntent('영상 재생 버튼 추가해 줘', 'ko'), false);
  assert.equal(playIntent('노래 재생 기능 테스트해 줘', 'ko'), false);
  assert.equal(playIntent('음악 플레이어 코드 보여 줘', 'ko'), false);
  assert.equal(playIntent('영상을 재생해 보고 버그 찾아 줘', 'ko'), false);
  assert.equal(playIntent('불 켜 줘', 'ko'), false);
  assert.equal(playIntent('動画の再生ボタンを直して', 'ja'), false);
  assert.equal(playIntent('play around with the settings', 'en'), false);
  assert.equal(detect('昼飯のメニューをお勧めしてくれ', ['ja']), null); // 2026-10-01 실사용 지시
  assert.equal(detect('테스트 돌리고 결과 알려 줘', ['ko']), null);
  assert.equal(detect('오늘 날씨 어때?', ['ko']), null);
});

test('재생 부탁에서 검색할 말만 남긴다', () => {
  assert.equal(mediaQuery('유튜브에서 아이묭 마리골드 틀어 줘', 'ko'), '아이묭 마리골드');
  assert.equal(mediaQuery('노을 틀어 줘', 'ko'), '노을'); // 제목 끝 글자를 조사로 자르지 않는다
  assert.equal(mediaQuery('노래 틀어 줘', 'ko'), ''); // 무엇을 틀지 없다
  assert.equal(mediaQuery('YouTubeで米津玄師のLemonを流して', 'ja'), '米津玄師のLemon');
  assert.equal(mediaQuery('でんぱ組の曲かけて', 'ja'), 'でんぱ組の曲'); // 제목 안의 で 를 지우지 않는다
  assert.equal(mediaQuery('梅雨のロックな気味とはお別れだ。プレイして', 'ja'), '梅雨のロックな気味とはお別れだ');
  assert.equal(mediaQuery('音楽流して', 'ja'), '');
  assert.equal(mediaQuery('クロムで 10の音楽プレイして', 'ja'), '10の音楽'); // 2026-10-01 실사용
  assert.equal(mediaQuery('Play Lemon by Kenshi Yonezu on YouTube, please.', 'en'), 'Lemon by Kenshi Yonezu');
  assert.equal(mediaQuery('play some music', 'en'), '');
});

test('한 번에 판정: 모드·언어·변신·의상·노래 조작·열기·재생·검색', () => {
  assert.deepEqual(detect('지시 모드', ['ko']), { kind: 'mode', mode: 'task' });
  assert.deepEqual(detect('English mode', ['ja']), { kind: 'lang', lang: 'en' });
  assert.deepEqual(detect('雨に変身して', ['ja']), { kind: 'form', to: 'ame' });
  assert.deepEqual(detect('基本の服装で', ['ja']), { kind: 'costume', to: 'base' });
  assert.equal(detect('유튜브 열어 줘', ['ko']).kind, 'open');
  assert.equal(detect('구글에서 고양이 검색해 줘', ['ko']).kind, 'search');
  assert.deepEqual(detect('유튜브에서 아이묭 마리골드 틀어 줘', ['ko']), { kind: 'play', query: '아이묭 마리골드', lang: 'ko' });
  assert.equal(detect('유튜브에서 아이묭 검색해 줘', ['ko']).engine, 'youtube');
  // 멈춰·다음 곡은 노래가 나오는(났던) 중이거나 노래를 짚어 말했을 때만 노래 조작
  assert.equal(detect('止めて', ['ja']), null);
  assert.equal(detect('멈춰 줘', ['ko']), null);
  assert.deepEqual(detect('止めて', ['ja'], { music: true }), { kind: 'media', op: 'pause', lang: 'ja' });
  assert.deepEqual(detect('音楽止めて', ['ja']), { kind: 'media', op: 'pause', lang: 'ja' });
  assert.deepEqual(detect('노래 멈춰', ['ko']), { kind: 'media', op: 'pause', lang: 'ko' }); // 음성 모드가 꺼져 있어(소리 감지 없음) 글로 쳐도 된다
  assert.equal(detect('다음 곡', ['ko'], { music: true }).op, 'next');
  // 무엇을 틀지 없는 재생 부탁은 언제든 이어 틀기(멈춰 둔 영상을 잇는다)
  assert.deepEqual(detect('노래 틀어 줘', ['ko']), { kind: 'media', op: 'play', lang: 'ko' });
  assert.deepEqual(detect('다시 틀어 줘', ['ko']), { kind: 'media', op: 'play', lang: 'ko' });
  // 노래가 없을 때 "続けて"·"이어서"·"continue"는 하던 이야기를 이으라는 말일 수 있다 → 노래 조작이 아니다
  assert.equal(detect('続けて', ['ja']), null);
  assert.equal(detect('이어서 말해 봐', ['ko']), null);
  assert.equal(detect('continue', ['en']), null);
  assert.equal(detect('続けて', ['ja'], { music: true }).op, 'play');
  // 작업 낱말이 섞인 말은 노래가 나오는 중이어도 노래 조작이 아니다
  assert.equal(detect('다음 테스트로 넘겨 줘', ['ko'], { music: true }), null);
});

test('멈춘 노래를 다시 틀라는 말은 새로 찾지 않고 이어 튼다(2026-10-01 실사용: 지시 에이전트로 넘어가 크롬을 뒤졌다)', () => {
  const resume = (t, lang, opts) => { const d = detect(t, [lang], opts); return d && d.kind === 'media' && d.op === 'play'; };
  assert.ok(resume('再生して。', 'ja', { music: true })); // 13:15 "あめちゃん再生して。" → 지시로 넘어갔다
  assert.ok(resume('またプレイして。', 'ja')); // 13:19 "あめちゃん、またプレイして。" → 지시로 넘어갔다
  assert.ok(resume('음악 재생해줘.', 'ko', { music: true })); // 13:17 끝의 마침표 때문에 새 검색("인기 노래 모음")으로 갔다
  assert.ok(resume('다시 재생해 줘', 'ko'));
  assert.ok(resume('もう一度再生してください', 'ja'));
  assert.ok(resume('音楽流して', 'ja'));
  assert.ok(resume('play the music', 'en'));
  assert.ok(resume('resume', 'en', { music: true }));
  // 무엇을 틀지 말했으면 새로 찾아 튼다
  assert.deepEqual(detect('이별만이 인생이다 재생해줘.', ['ko'], { music: true }), { kind: 'play', query: '이별만이 인생이다', lang: 'ko' });
  assert.deepEqual(detect('さよならだけが人生だ。プレイして。', ['ja'], { music: true }), { kind: 'play', query: 'さよならだけが人生だ', lang: 'ja' });
  assert.equal(detect('아이유 노래 틀어 줘', ['ko'], { music: true }).query, '아이유 노래');
  assert.equal(mediaQuery('もう一度再生して', 'ja'), ''); // "もう一度"는 검색어가 아니다
  assert.equal(mediaQuery('다시 재생해 줘', 'ko'), '');
});

test('앞 일이 도는 중에는 말로 취소한다(2026-10-01 실사용: "中止して"·"今のはキャンセル"가 "아직 하는 중"으로만 돌아왔다)', () => {
  assert.deepEqual(detect('中止して。', ['ja'], { busy: true }), { kind: 'cancel' });
  assert.deepEqual(detect('今のはキャンセル。', ['ja'], { busy: true }), { kind: 'cancel' });
  assert.deepEqual(detect('취소해 줘', ['ko'], { busy: true }), { kind: 'cancel' });
  assert.deepEqual(detect('never mind', ['en'], { busy: true }), { kind: 'cancel' });
  assert.equal(detect('中止して。', ['ja']), null); // 도는 일이 없으면 취소할 것도 없다
  // "멈춰"·"止めて"는 노래가 나오는 중이면 노래를 멈추라는 말이다
  assert.deepEqual(detect('止めて', ['ja'], { busy: true }), { kind: 'cancel' });
  assert.equal(detect('止めて', ['ja'], { busy: true, playing: true, music: true }).op, 'pause');
  assert.equal(detect('音楽止めて。', ['ja'], { busy: true, music: true }).op, 'pause');
  assert.equal(cancelIntent('오늘 회의 취소됐다는데 일정 좀 다시 잡아 줄 수 있을까 싶어서'), false); // 긴 말은 아니다
});

test('맥 음량: 올려·내려·값으로·음소거', () => {
  const mac = (t) => { const v = volumeIntent(t); if (!v) return null; assert.equal(v.target, 'mac', t); const { target, ...rest } = v; return rest; };
  assert.deepEqual(mac('볼륨 올려 줘'), { op: 'up', value: 12 });
  assert.deepEqual(mac('소리 좀 줄여 줘'), { op: 'down', value: 12 });
  assert.deepEqual(mac('소리 조금만 키워 줘'), { op: 'up', value: 6 });
  assert.deepEqual(mac('볼륨 50으로'), { op: 'set', value: 50 });
  assert.deepEqual(mac('볼륨 30으로 낮춰 줘'), { op: 'set', value: 30 });
  assert.deepEqual(mac('볼륨 최대로 올려'), { op: 'set', value: 100 });
  assert.deepEqual(mac('音楽のボリュームを 10%上げて。'), { op: 'up', value: 10 }); // 2026-10-01 실사용
  assert.deepEqual(mac('音量を50にして'), { op: 'set', value: 50 });
  assert.deepEqual(mac('音量を半分に'), { op: 'set', value: 50 });
  assert.deepEqual(mac('もっと大きく'), { op: 'up', value: 12 });
  assert.deepEqual(mac('turn the volume down a bit'), { op: 'down', value: 6 });
  assert.deepEqual(mac('set volume to 40'), { op: 'set', value: 40 });
  assert.deepEqual(mac('음소거'), { op: 'mute' });
  assert.deepEqual(mac('소리 꺼 줘'), { op: 'mute' });
  assert.deepEqual(mac('ミュート解除'), { op: 'unmute' });
  assert.deepEqual(mac('unmute'), { op: 'unmute' });
  // 음량 조절이 아닌 말
  assert.equal(volumeIntent('소리 3번 났어'), null);
  assert.equal(volumeIntent('볼륨 조절 기능 추가해 줘'), null);
  assert.equal(volumeIntent('사운드 파일 줄여 줘'), null);
  assert.equal(volumeIntent('오늘 음량 어때'), null);
  assert.equal(detect('노래 꺼 줘', ['ko'], { music: true }).op, 'pause'); // 노래를 끄라는 말은 멈춤
  assert.equal(detect('소리 줄여 줘', ['ko']).kind, 'volume'); // 노래가 없어도 맥 음량
  assert.deepEqual(detect('マックの音を 100%上げて', ['ja'], { music: true }), { kind: 'volume', op: 'up', value: 100 }); // 2026-10-01 실사용: 유튜브 음량만 올라갔다
  assert.deepEqual(mac('소리가 너무 작아'), { op: 'up', value: 12 });
  assert.deepEqual(mac('音が大きい'), { op: 'down', value: 12 });
});

test('캐릭터 목소리 크기: 목소리를 짚어 말하면 맥 음량이 아니라 목소리를 키우거나 줄인다', () => {
  const voice = (t) => { const d = detect(t, langsOf(t)); return d && d.kind === 'voicegain' ? d.op : null; };
  assert.equal(voice('목소리 키워 줘'), 'up');
  assert.equal(voice('목소리가 너무 작아'), 'up');
  assert.equal(voice('큰 소리로 말해'), 'up');
  assert.equal(voice('목소리가 너무 커'), 'down');
  assert.equal(voice('アメちゃんと超てんちゃんの声が小さい'), 'up');
  assert.equal(voice('大きい声で話して'), 'up'); // "大きい"가 있어도 줄이라는 말이 아니다
  assert.equal(voice('声が大きい'), 'down');
  assert.equal(voice('speak up'), 'up');
  assert.equal(voice('your voice is too loud'), 'down');
  assert.deepEqual(detect('목소리 20% 키워 줘', ['ko']), { kind: 'voicegain', op: 'up', value: 20 });
  assert.equal(voice('목소리 예쁘다'), null);
  assert.equal(voice('声がかわいいね'), null);
  assert.equal(voice('말해 봐'), null);
});


test('화면 깨우기·끄기', () => {
  assert.equal(screenIntent('화면 깨워 줘'), 'wake');
  assert.equal(screenIntent('화면 켜 줘'), 'wake');
  assert.equal(screenIntent('맥 깨워'), 'wake');
  assert.equal(screenIntent('仮面起こして。'), 'wake'); // 받아쓰기가 画面 을 仮面 으로 적었다(2026-10-01 실사용)
  assert.equal(screenIntent('画面をつけて'), 'wake');
  assert.equal(screenIntent('wake up the screen'), 'wake');
  assert.equal(screenIntent('모니터 꺼 줘'), 'sleep');
  assert.equal(screenIntent('画面消して'), 'sleep');
  assert.equal(screenIntent('turn off the display'), 'sleep');
  assert.equal(screenIntent('화면 캡처해서 보여 줘'), null);
  assert.equal(screenIntent('画面のスクショを撮って'), null);
  assert.equal(screenIntent('turn on the lights'), null);
  assert.equal(detect('화면 꺼 줘', ['ko'], { music: true }).kind, 'screen'); // 노래 멈춤("꺼 줘")으로 걸리지 않는다
});

test('글로 친 말은 그 글의 언어로만 본다', () => {
  assert.deepEqual(langsOf('유튜브에서 Candy Tune 틀어 줘'), ['ko']);
  assert.deepEqual(langsOf('YouTubeで合言葉を流して'), ['ja']);
  assert.deepEqual(langsOf('play Lemon by Kenshi Yonezu'), ['en']);
  assert.equal(detect('play Lemon by Kenshi Yonezu', langsOf('play Lemon by Kenshi Yonezu')).kind, 'play');
  assert.equal(detect('YouTubeで合言葉を流して', langsOf('YouTubeで合言葉を流して')).query, '合言葉');
  assert.equal(detect('next.js로 바꿔 줘', langsOf('next.js로 바꿔 줘'), { music: true }), null); // 영어 "next"(다음 곡)로 걸리지 않는다
  assert.equal(detect('Play 화면 디자인 바꿔 줘', langsOf('Play 화면 디자인 바꿔 줘')), null);
});

test('바로 처리한 뒤의 한 마디는 캐릭터·언어별로 있다', () => {
  for (const who of ['choten', 'ame']) for (const lang of ['ko', 'ja', 'en']) for (const kind of ['form', 'formSame', 'costume', 'open', 'search', 'fail', 'cancel', 'up', 'down', 'set', 'mute', 'unmute', 'volFail', 'wake', 'sleep', 'voiceUp', 'voiceDown']) assert.ok(line(who, lang, kind), `${who}/${lang}/${kind}`);
  assert.equal(line('ame', 'ja', 'form'), '…出てきた。');
  assert.equal(line('choten', 'ko', 'set', { n: 44 }), '볼륨 44에 맞췄어♡'); // 숫자마다 '으로/로'가 달라져서 '에'로 쓴다
});

test('유튜브 검색 결과에서 영상 id 와 제목을 차례로 뽑는다', () => {
  const html = 'x{"videoRenderer":{"videoId":"abcdefghijk","thumbnail":{},"title":{"runs":[{"text":"첫 \\"영상\\" MV"}]}}},{"reelItemRenderer":{"videoId":"SHORTS00000"}},{"videoRenderer":{"videoId":"lmnopqrstuv","title":{"runs":[{"text":"둘째"}]}}}';
  assert.deepEqual(parseYouTubeResults(html), [{ id: 'abcdefghijk', title: '첫 "영상" MV' }, { id: 'lmnopqrstuv', title: '둘째' }]);
  assert.deepEqual(parseYouTubeResults('<html>없음</html>'), []);
});

test('음량 판정이 재생 부탁을 가로채지 않는다(2026-10-01 실사용 오작동: 맥 음량이 50→62 로 올라갔다)', () => {
  const d = detect('今 YouTubeに上げている音楽プレイして', ['ja'], { music: true });
  assert.notEqual(d?.kind, 'volume');
  assert.equal(volumeIntent('今 YouTubeに上げている音楽プレイして'), null); // "音楽"의 音, 문장 가운데의 上げ
  assert.equal(volumeIntent('볼륨 올려서 노래 틀어 줘'), null); // 올려가 끝말이 아니다
  assert.equal(volumeIntent('play the volume up song'), null);
  assert.deepEqual(detect('マックの音を 100%上げて', ['ja'], { music: true }), { kind: 'volume', op: 'up', value: 100 });
});

test('지금 있는 것을 가리켜 틀라고 하면 새로 찾지 않고 잇는다', () => {
  const resume = (t, lang) => { const d = detect(t, [lang], { music: true }); return !!d && d.kind === 'media' && d.op === 'play'; };
  assert.ok(resume('今 YouTubeに音楽あるから、それをそのままプレイして。', 'ja')); // 2026-10-01 실사용: 그 문장을 검색어로 딴 영상을 틀었다
  assert.ok(resume('今 YouTubeに上げている音楽プレイして', 'ja'));
  assert.ok(resume('그거 그대로 틀어 줘', 'ko'));
  assert.ok(resume('지금 있는 노래 틀어 줘', 'ko'));
  assert.equal(detect('유튜브에서 아이묭 마리골드 틀어 줘', ['ko'], { music: true }).kind, 'play');
});

test('일본어는 발음으로도 알아듣는다: 받아쓰기가 낱말을 소리가 비슷한 딴 말로 적는다(2026-10-01 실사용)', () => {
  const tk = (...r) => r.map((x, i) => [x, i + 1]);
  // 超てん→拠点·商店, 変身→返信·変金
  assert.deepEqual(detect('拠点に返信して。', ['ja'], { tokens: tk('kyoten', 'ni', 'henshin', 'shi', 'te') }), { kind: 'form', to: 'choten' });
  assert.deepEqual(detect('商店に変金して', ['ja'], { tokens: tk('shouten', 'ni', 'hen', 'kin', 'shi', 'te') }), { kind: 'form', to: 'choten' });
  assert.equal(detect('メールに返信して', ['ja'], { tokens: tk('meru', 'ni', 'henshin', 'shi', 'te') }), null); // 진짜 "답장해"
  // パジャマ→風間
  assert.deepEqual(detect('風間に着替えて。', ['ja'], { tokens: tk('kazama', 'ni', 'kigae', 'te') }), { kind: 'costume', to: 'pajama' });
  assert.equal(detect('ここに着替えを置いて', ['ja'], { tokens: tk('koko', 'ni', 'kigae', 'wo', 'oi', 'te') }), null);
  // 会話モード→海外モード, 指示モード→支持モード
  assert.deepEqual(detect('普通な海外モードで。', ['ja'], { tokens: tk('futsuu', 'na', 'kaigai', 'mōdo', 'de') }), { kind: 'mode', mode: 'chat' });
  assert.deepEqual(detect('支持モード', ['ja'], { tokens: tk('shiji', 'mōdo') }), { kind: 'mode', mode: 'task' });
  assert.equal(detect('海外旅行のモードで', ['ja'], { tokens: tk('kaigairyokou', 'no', 'mōdo', 'de') }), null);
});

test('잡담 캐릭터의 [실행] 줄을 같은 꼴의 의도로 읽는다', () => {
  assert.deepEqual(parseAction('변신 아메'), { kind: 'form', to: 'ame' });
  assert.deepEqual(parseAction('변신 초텐'), { kind: 'form', to: 'choten' });
  assert.deepEqual(parseAction('의상 파자마'), { kind: 'costume', to: 'pajama' });
  assert.deepEqual(parseAction('의상 kimono'), { kind: 'costume', to: 'kimono' });
  assert.deepEqual(parseAction('재생 千本桜 初音ミク', 'ja'), { kind: 'play', query: '千本桜 初音ミク', lang: 'ja' });
  assert.equal(parseAction('이어재생').op, 'play');
  assert.equal(parseAction('멈춤').op, 'pause');
  assert.equal(parseAction('다음곡').op, 'next');
  assert.deepEqual(parseAction('음량 올려'), { kind: 'volume', op: 'up', value: 12 });
  assert.deepEqual(parseAction('음량 40'), { kind: 'volume', op: 'set', value: 40 });
  assert.deepEqual(parseAction('음량 음소거해제'), { kind: 'volume', op: 'unmute' });
  assert.deepEqual(parseAction('화면 꺼'), { kind: 'screen', op: 'sleep' });
  assert.deepEqual(parseAction('모드 지시'), { kind: 'mode', mode: 'task' });
  assert.equal(parseAction('모르는 동작'), null);
  // 풀어 쓴 꼴도 읽는다(2026-10-01 실사용 "[실행] 기본 의상으로 갈아입기")
  assert.deepEqual(parseAction('기본 의상으로 갈아입기'), { kind: 'costume', to: 'base' });
  assert.deepEqual(parseAction('기모노로 갈아입기'), { kind: 'costume', to: 'kimono' });
  assert.deepEqual(parseAction('아메로 변신하기'), { kind: 'form', to: 'ame' });
  assert.equal(parseAction('노래 멈추기')?.op ?? parseAction('음악 멈춰')?.op, 'pause');
});

test('2026-10-01 오후 실사용에서 나온 꼴들', () => {
  const tk = (...r) => r.map((x, i) => [x, i + 1]);
  // 이름이 뭉개져도("してちゃん") 변신 부탁은 조사 바로 앞의 이름으로 알아본다
  assert.equal(formIntent('してちゃん、雨に変身して。', tk('shite', 'chan', 'ame', 'ni', 'henshin', 'shi', 'te')), 'ame');
  assert.equal(formIntent('部長にちゃんと返信して', tk('buchou', 'ni', 'chanto', 'henshin', 'shi', 'te')), null);
  // 앞에 붙는 말
  assert.equal(costumeIntent('そっかじゃあパジャマに着替えてみるかい。'), 'pajama');
  // "プレイお願い"·"再生お願いします"
  assert.deepEqual(detect('YouTubeで千本桜プレイお願い', ['ja']), { kind: 'play', query: '千本桜', lang: 'ja' });
  assert.deepEqual(detect('千本桜を再生お願いします', ['ja']), { kind: 'play', query: '千本桜', lang: 'ja' });
  // 말을 거는 문장은 검색어로 쓰지 않는다(잡담 캐릭터가 뜻을 보고 [실행] 재생 …을 붙인다)
  assert.equal(detect('じゃあ一緒にマリーゴールド聞こうよ。 YouTubeですぐにプレイお願い。', ['ja'], { music: true }), null);
  assert.equal(detect('梅雨のロックな気味とはお別れだ。プレイして', ['ja']).query, '梅雨のロックな気味とはお別れだ');
});

test('옷 갈아입기(着替え): 앞에 딴 말이 붙어도 받는다(2026-10-01 실사용 "자꾸 옷 갈아입기를 못 알아듣는다")', () => {
  const tk = (...r) => r.map((x, i) => [x, i + 1]);
  assert.equal(costumeIntent('めちゃん、水着に着替えて。'), 'swim');
  assert.equal(costumeIntent('今私から水着に着替えた。'), 'swim');
  assert.equal(costumeIntent('ねえ、着物に着替えてくれない'), 'kimono');
  assert.equal(costumeIntent('초탄장 기모노로 갈아입어.'), 'kimono');
  // 기본(基本)이 日本 으로 적혀도 발음으로
  assert.equal(costumeIntent('日本の衣装で着替えた。', tk('nihon', 'no', 'ishou', 'de', 'kigae', 'ta')), 'base');
  assert.equal(costumeIntent('めちゃん、水木に着替えて', tk('mecha', 'n', 'mizuki', 'ni', 'kigae', 'te')), 'swim');
  // 의상 낱말 뒤에서 문장이 끝나지 않으면 옷 갈아입기가 아니다
  assert.equal(costumeIntent('水着に着替えた友達の写真を探して'), null);
  assert.equal(costumeIntent('기모노로 갈아입은 사진 찾아 줘'), null);
  assert.equal(costumeIntent('水着について説明して'), null);
});


test('골라 달라거나 앞서 한 이야기를 가리키는 재생 부탁은 그 문장으로 검색하지 않고 캐릭터에게 보낸다', () => {
  // 2026-10-01 실사용: 두 문장 모두 문장째 검색어가 되어 엉뚱한 영상이 나왔다
  assert.deepEqual(detect('聞いてみたことない 1曲だけお勧めしてプレイしてくれ。', ['ja']), { kind: 'chat' });
  assert.deepEqual(detect('あめちゃんがお勧めしてくれた歌い手の曲をプレイして。', ['ja']), { kind: 'chat' });
  assert.deepEqual(detect('아무 노래나 추천해서 틀어 줘', ['ko']), { kind: 'chat' });
  assert.deepEqual(detect('아까 말한 노래 틀어 줘', ['ko']), { kind: 'chat' });
  assert.deepEqual(detect('play something you recommend', ['en']), { kind: 'chat' });
  // 무엇을 틀지 말한 부탁은 그대로 바로 튼다
  assert.deepEqual(detect('歌い手ソラロの曲をプレイして。', ['ja']), { kind: 'play', query: '歌い手ソラロの曲', lang: 'ja' });
  assert.equal(detect('play Bohemian Rhapsody', ['en']).kind, 'play');
  // 틀어 달라는 말이 아니면 여기서 받지 않는다(잡담이 판단)
  assert.equal(detect('노래 추천해 줘', ['ko']), null);
  // 캐릭터의 "[실행]" 줄이 다시 캐릭터에게 돌아가지는 않는다
  assert.equal(parseAction('추천 노래 틀기', 'ko'), null);
});

test('소리 크기는 어떤 말로 해도 맥 음량이다(전에는 "make it louder"·"音楽を大きくして"만 유튜브 플레이어 음량이었다)', () => {
  assert.deepEqual(detect('make it louder', ['en']), { kind: 'volume', op: 'up', value: 12 });
  assert.deepEqual(detect('turn it up', ['en']), { kind: 'volume', op: 'up', value: 12 });
  assert.deepEqual(detect('turn the music down a bit', ['en']), { kind: 'volume', op: 'down', value: 6 });
  assert.deepEqual(detect('音楽を大きくして', ['ja']), { kind: 'volume', op: 'up', value: 12 });
  assert.deepEqual(detect('노래 좀 크게 해 줘', ['ko']), { kind: 'volume', op: 'up', value: 12 });
  // 가운데 낀 上げ 는 여전히 음량이 아니다(2026-10-01 오작동)
  assert.equal(detect('今YouTubeに上げている音楽プレイして', ['ja']).kind, 'media');
  assert.equal(detect('make it stop', ['en'], { music: true }).op, 'pause');
});

test('"止まって"도 노래 멈춤이다(가사에 흔한 "止まらない"는 아니다)', () => {
  assert.deepEqual(detect('止まって', ['ja'], { music: true }), { kind: 'media', op: 'pause', lang: 'ja' });
  assert.equal(detect('止まらない', ['ja'], { music: true }), null);
  assert.equal(detect('止まって', ['ja']), null); // 노래가 없을 때는 아니다
});

test('평범한 말이 상태를 바꾸지 않는다(2026-10-01 검토에서 나온 오작동들)', () => {
  const none = (t, lang, opts) => assert.equal(detect(t, [lang], opts), null, t);
  // 음량: 낱말이 들어 있기만 한 말·묻는 말·하지 말라는 말·상태를 말한 것
  for (const t of ['소리가 최대야', '이 소리 끝까지 들어봐', '음소거가 뭐야', '음소거 하지 마', '소리 꺼졌어', '음소거 단축키 추가해줘']) none(t, 'ko');
  none('ミュートって何', 'ja'); none('what is mute', 'en');
  assert.deepEqual(detect('음소거', ['ko']), { kind: 'volume', op: 'mute' });
  assert.deepEqual(detect('소리 좀 꺼줘', ['ko']), { kind: 'volume', op: 'mute' });
  assert.deepEqual(detect('ミュートにして', ['ja']), { kind: 'volume', op: 'mute' });
  assert.deepEqual(detect('음소거 풀어 줘', ['ko']), { kind: 'volume', op: 'unmute' });
  assert.deepEqual(detect('볼륨 최대로', ['ko']), { kind: 'volume', op: 'set', value: 100 });
  assert.deepEqual(detect('볼륨 반으로 줄여 줘', ['ko']), { kind: 'volume', op: 'set', value: 50 });
  // 취소(앞 일이 도는 중): 하지 말라는 말은 취소가 아니다
  for (const t of ['걱정하지 마', '무리하지 마', '멈추지 마', '취소하지 마']) none(t, 'ko', { busy: true });
  none('やめないで', 'ja', { busy: true }); none("don't stop", 'en', { busy: true });
  for (const t of ['하지 마', '그거 하지 마', '취소해 줘', '그만해']) assert.deepEqual(detect(t, ['ko'], { busy: true }), { kind: 'cancel' }, t);
  assert.deepEqual(detect('never mind', ['en'], { busy: true }), { kind: 'cancel' });
  // 노래 조작(노래가 나오는 중이어도): 딴 것을 끄라는 말·묻는 말·딴 일을 다시 하라는 말
  for (const t of ['불 꺼 줘', '다음 거 뭐야', '이어서 말해 봐', '멈추지 마', '물 틀어 줘', '에어컨 틀어 줘']) none(t, 'ko', { music: true });
  for (const t of ['電気消して', '冗談はやめて', 'もう一度言って', 'やめないで']) none(t, 'ja', { music: true });
  for (const t of ["don't stop", 'what is next on my schedule', 'let us continue our talk', 'stop talking']) none(t, 'en', { music: true });
  // 모드: 묻는 말
  none('지시 모드가 뭐야', 'ko'); none('会話モードって何', 'ja');
});

test('틀어 달라는 말: 분명하면 바로 틀고, 딴 뜻일 수 있으면 캐릭터가 본다', () => {
  // 짧은 제목 + 틀어: 전에는 멈춰 둔 딴 영상을 이어 틀었다
  assert.deepEqual(detect('아이유 틀어줘', ['ko'], { music: true }), { kind: 'play', query: '아이유', lang: 'ko' });
  assert.deepEqual(detect('재즈 틀어줘', ['ko']), { kind: 'play', query: '재즈', lang: 'ko' });
  assert.deepEqual(detect('千本桜流して', ['ja']), { kind: 'play', query: '千本桜', lang: 'ja' });
  assert.deepEqual(detect('マリーゴールドかけて', ['ja']), { kind: 'play', query: 'マリーゴールド', lang: 'ja' });
  // 무엇을 틀지 없으면 이어 틀기
  for (const t of ['노래 틀어 줘', '다시 틀어 줘', '음악 들려줘']) assert.deepEqual(detect(t, ['ko']), { kind: 'media', op: 'play', lang: 'ko' }, t);
  for (const t of ['音楽かけて', '曲を聞かせて', '再生して']) assert.deepEqual(detect(t, ['ja'], { music: true }), { kind: 'media', op: 'play', lang: 'ja' }, t);
  // 들려 줘·聞かせて·かけて 는 딴 뜻이 많다 → 캐릭터에게(그 문장으로 유튜브를 틀지 않는다)
  for (const t of ['옛날 얘기 하나 들려줘', '마리골드 들려줘', '추천해서 틀어 줘']) assert.deepEqual(detect(t, ['ko'], { music: true }), { kind: 'chat' }, t);
  for (const t of ['昔話を聞かせて', '電話かけて', '鍵かけて', '米津かけて']) assert.deepEqual(detect(t, ['ja'], { music: true }), { kind: 'chat' }, t);
  // 노래 낱말이 같이 있으면 재생 부탁이다
  assert.deepEqual(detect('아이묭 노래 들려줘', ['ko']), { kind: 'play', query: '아이묭 노래', lang: 'ko' });
  assert.equal(detect('アイミョンの曲を聞かせて', ['ja']).kind, 'play');
});

test('변신: 초텐의 이름 변형은 호출어와 같은 표를 쓴다', () => {
  assert.equal(formIntent('초틴으로 변신'), 'choten');
  assert.equal(formIntent('しょてんに変身して'), 'choten');
  assert.equal(formIntent('밤에 모드로 바꿔'), null); // 아메의 받아쓰기 변형("밤에 짱")은 변신에는 쓰지 않는다
});

test('노래를 짚은 "중지·중단·中止"는 앞 일 취소가 아니라 노래 멈춤이다(2026-10-02 실사용 "초된장 음악 중지 해줘")', () => {
  for (const t of ['음악 중지 해줘.', '음악 중지해 줘', '노래 중단해', '노래 정지 해 줘', '노래 일시 정지 해']) {
    assert.deepEqual(detect(t, ['ko'], { busy: true, playing: true, music: true }), { kind: 'media', op: 'pause', lang: 'ko' }, t);
    assert.deepEqual(detect(t, ['ko'], { busy: true }), { kind: 'media', op: 'pause', lang: 'ko' }, `${t} (노래가 멎은 뒤)`);
  }
  assert.deepEqual(detect('音楽中止して', ['ja'], { busy: true }), { kind: 'media', op: 'pause', lang: 'ja' });
  // 노래를 짚지 않은 중지·"취소"는 그대로 앞 일 취소
  for (const t of ['중지 해 줘', '작업 중지해', '노래 트는 거 취소해', '유튜브 검색 취소해']) assert.deepEqual(detect(t, ['ko'], { busy: true }), { kind: 'cancel' }, t);
  assert.deepEqual(detect('中止して', ['ja'], { busy: true }), { kind: 'cancel' });
  assert.equal(detect('불 꺼 줘', ['ko'], { busy: true, playing: true, music: true }), null);
});

test('성자 세트로 갈아입기(2026-10-06): 성녀·수녀·천사·흑미사·악마 어느 말로도, 옷 말 없는 흔한 문장은 아님', () => {
  for (const t of ['성자 옷으로 갈아입어', '성녀로 갈아입어 줘', '수녀복 입어 봐', '천사 옷 입어', '흑미사 의상으로 바꿔 줘', '악마 옷으로 갈아입어', 'シスターの服に着替えて', '天使に着替えて', 'put on the saint outfit']) assert.equal(costumeIntent(t), 'saint', t);
  for (const t of ['악마의 노래 틀어 줘', '천사 같은 하루였어', '聖女の物語を探して']) assert.notEqual(costumeIntent(t), 'saint', t);
  const { parseAction } = require('../intent.js');
  assert.deepEqual(parseAction('의상 성자'), { kind: 'costume', to: 'saint' });
});
