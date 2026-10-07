// 모델 없이 바로 처리하는 부탁을 알아보는 순수 로직(test/intent.test.js).
// 사용자 2026-10-01: "에이전트 내의 변신 지시라던지, 유튜브검색 크롬검색 등 아직도 브라우저 조작이나 너무 느리다".
// ⚡ 지시 모드에서는 "아메로 변신"(44초)·"기본 옷으로"(19초)·"노래 멈춰"(23초)까지 전부 Claude Code 에이전트가 소스를 읽어 가며 했다.
// 그래서 💬 대화·⚡ 지시 어느 쪽이든 맨 먼저 이 판정을 거친다(main.js quickIntent). 걸리면 main 이 직접 한다(0.1~4초).
// 지시 모드의 진짜 작업("영상 재생 버튼 추가해 줘")을 가로채면 안 되니 짧고 꼴이 분명한 말만 받는다:
//  - 한국어·일본어는 문장 끝이 그 동사일 것(틀어 줘·열어 줘·検索して…), 영어는 문장 머리가 그 동사일 것(play·open·search…)
//  - 코드·파일 같은 작업 낱말이 섞였으면 받지 않는다
const VOICE = require('./voice');

const flat = (s) => String(s || '').trim().replace(/[\s.,!?~…。、！？♡]+$/u, '').replace(/\s+/g, ' ');
const isEnglish = (t) => /^[\x20-\x7e]+$/.test(t);
const short = (t, n = 24) => t.length <= (isEnglish(t) ? Math.round(n * 1.8) : n);
// 지시 모드의 진짜 작업에 흔한 낱말: 이게 있으면 재생·검색으로 받지 않는다
const WORK_WORDS = /코드|파일|폴더|버튼|기능|함수|변수|버그|테스트|로그|설정|문서|프로젝트|소스|저장소|레포|디렉터리|커밋|スクリプト|コード|ファイル|フォルダ|ボタン|機能|関数|バグ|テスト|ログ|設定|プロジェクト|ソース|リポジトリ|\b(?:code|files?|folders?|buttons?|functions?|bugs?|tests?|logs?|settings?|project|repo|repository|directory|commit|script)\b/i;

/* ── 변신: "아메로 변신"·"雨に変身して"·"transform into Ame" → 'ame' | 'choten' | 'toggle' ── */
// 받아쓰기는 이름을 달리 적는다(あめ→雨·飴·姉, 超てん→頂点·商店…). 変身 은 返信 으로도 적혔다(2026-10-01 "雨に返信して") —
// 返信("답장")은 이름 바로 뒤에 올 때만 변신으로 본다.
const TAIL = '(?:짱|쨩|ちゃん|チャン)?';
// 초텐의 어간은 호출어(voice.js)와 같은 표를 쓴다. 아메는 흔한 말과 겹치는 표기(밤에·아나·穴)를 뺀 것만 — "밤에 모드로 바꿔"가 변신이 되면 안 된다.
const NAME = {
  ame: `(?:아메|아매|아네|あめ|アメ|雨|飴|姉|あね|アネ)${TAIL}`,
  choten: `(?:${VOICE.CHOTEN_KO}|${VOICE.CHOTEN_JA})${TAIL}`,
};
// 이름 뒤가 "(모드)(으)로 + 변신/바꿔…" 꼴로 끝까지 맞아야 한다("雨になってきた"·"아메리카노로 바꿔"는 아니다). 빈칸·쉼표는 빼고 본다.
const FORM_KO = '(?:모드)?(?:으로|로)?(?:다시)?(?:변신|변해|바꿔|바뀌어|체인지|교대|교체|전환|나와|불러|돌아가|돌아와)(?:해|해줘|해봐|하자|시켜줘|줘|줘요|주세요|줄래|봐|줘봐|라)?';
const FORM_JA = '(?:モード)?(?:に|へ)?(?:変身|返信|変心|へんしん|変わって|かわって|代わって|替わって|チェンジ|交代|なって|戻って|もどって)(?:して|する|だ)?(?:ください|くれ|くれる|よ|ね|ほしい|お願い)?';
const FORM_BARE = '(?:모드(?:으로|로)?|으로|로|モード(?:に|で)?)'; // "아메로"·"초텐 모드"·"アメモード"
const FORM_RE = Object.entries(NAME).map(([to, name]) => [to, new RegExp(`^(?:이제|그럼|다시|じゃあ|もう一度)?${name}(?:${FORM_KO}|${FORM_JA}|${FORM_BARE})$`)]);
const FORM_TOGGLE = /^(?:다시\s*)?(?:변신|체인지)\s*(?:해|해\s*줘|해\s*봐|하자|시켜\s*줘)?$|^(?:もう一度、?)?(?:変身|へんしん|チェンジ)(?:して|する|だ)?(?:ください|くれ|よ|ね)?$|^(?:please\s+)?(?:transform|change\s+form|switch\s+form)(?:\s+please)?$/i;
const FORM_EN = /^(?:please\s+)?(?:transform|turn|change|switch|go)\s+(?:back\s+)?(?:in)?to\s+(.+?)(?:\s+please)?$/i;
const { editDistance, AME_EN } = VOICE; // 이름의 영어 표기·글자 차이 재기는 voice.js(호출어)와 같은 것을 쓴다
// 일본어 받아쓰기는 낱말을 소리가 비슷한 다른 말로 적는다(2026-10-01 실사용: 超てん→拠点·商店, 変身→返信·変金, パジャマ→風間,
// 会話モード→海外モード). 글자 규칙으로는 끝이 없어서, sttd 가 주는 낱말별 발음(tokens: [로마자, 끝 자리])으로도 본다.
const romas = (tokens) => (Array.isArray(tokens) ? tokens.map(([r]) => VOICE.roma(r)).filter(Boolean) : []);
const near = (a, b, d) => Math.abs(a.length - b.length) <= d && editDistance(a, b) <= d;
const JA_TAIL = new Set(['shi', 'te', 'shite', 'suru', 'shiro', 'kudasai', 'kure', 'kureru', 'mi', 'miro', 'mite', 'yo', 'ne', 'onegai', 'hoshii', 'de', 'da']);
const nameByReading = (stem) => (VOICE.AME_STEMS.has(stem) ? 'ame' : (stem.length >= 4 && stem.length <= 8 && editDistance(stem, 'choten') <= 2) ? 'choten' : null);
// "〈이름〉(ちゃん)(に) へんしん(して)": 이름은 맨 앞 한두 낱말, 동사는 henshin 과 두 글자 안쪽 차이(返信 henshin·変金 hen+kin)
function formByReading(tokens) {
  const r = romas(tokens);
  if (r.length < 2 || r.length > 8) return null;
  let v = -1, vEnd = -1;
  for (let i = 1; i < r.length && v < 0; i++) {
    if (near(r[i], 'henshin', 2)) { v = i; vEnd = i; } else if (i + 1 < r.length && near(r[i] + r[i + 1], 'henshin', 2)) { v = i; vEnd = i + 1; }
  }
  if (v < 1 || !r.slice(vEnd + 1).every((x) => JA_TAIL.has(x))) return null;
  let k = v - 1;
  if (k >= 0 && ['ni', 'e', 'he'].includes(r[k])) k--;
  if (k >= 0 && /^(chan|tyan|tan|san)$/.test(r[k])) k--;
  if (k < 0) return null;
  // 이름은 동사(와 조사) 바로 앞 낱말, 또는 그 앞 낱말과 이은 것("cho"+"ten"). 앞에 딴 말이 붙어 있어도 된다(2026-10-01 "してちゃん、雨に変身して")
  const one = r[k].replace(/(chan|tyan|tan|san)$/, '');
  return nameByReading(one) || (k >= 1 ? nameByReading(r[k - 1] + one) : null);
}
function formIntent(text, tokens) {
  const t = flat(text);
  if (!t || !short(t)) return null;
  if (FORM_TOGGLE.test(t)) return 'toggle';
  const squashed = t.replace(/[\s、,]/g, '');
  for (const [to, re] of FORM_RE) if (re.test(squashed)) return to;
  const en = FORM_EN.exec(t);
  if (en) { // 영어 받아쓰기는 이름을 영어 낱말로 적는다("Ahmed Chan", "Chot and Chan")
    const stem = en[1].toLowerCase().replace(/\b(?:chan|chun|chen|jan|john|tan)\b/g, '').replace(/[^a-z0-9]/g, '').replace(/10/g, 'ten');
    if (AME_EN.has(stem) || (stem.length >= 2 && stem.length <= 4 && editDistance(stem, 'ame') <= 1)) return 'ame';
    if (stem.length >= 4 && stem.length <= 9 && editDistance(stem, 'choten') <= 2) return 'choten';
  }
  return formByReading(tokens);
}

/* ── 의상: "기모노로 갈아입어"·"基本の服装で"·"put on the bunny outfit" → 의상 키 | 'random' ── */
// 키는 renderer/index.html 의 의상 목록 value. generic 은 흔한 말(여름·기본…)이라 옷이라는 말이 같이 있어야 받는다.
const COSTUMES = [
  ['kimono', /기모노|着物|きもの|キモノ|和服|kimono/i],
  ['bunny', /바니\s*걸|바니|버니\s*걸|버니|토끼|バニーガール|バニー|うさぎ|ウサギ|bunny\s+girl|bunny(?:\s+suit)?|rabbit/i],
  ['pajama', /파자마|잠옷|パジャマ|寝巻き?|ねまき|pajamas?|pyjamas?|pjs/i],
  ['casual', /사복|평상복|캐주얼|私服|カジュアル|casual|street\s?clothes/i],
  ['summer', /(?:여름\s*)?원피스|(?:夏の?)?ワンピース|sundress|summer\s+dress/i],
  ['lounge', /룸웨어|홈웨어|실내복|라운지|ルームウェア|ルームウエア|部屋着|へやぎ|ラウンジ|loungewear|lounge\s?wear|room\s?wear/i],
  ['knit', /니트|스웨터|ニット|セーター|knit(?:wear)?|sweater/i],
  ['nurse', /간호사|너스|ナース|看護師|看護婦|nurse/i],
  ['swim', /수영복|비키니|水着|みずぎ|ビキニ|swim\s?suit|swimwear|bikini|bathing\s+suit/i],
  // 성자 세트(2026-10-06): 초텐은 가톨릭 성자풍, 아메는 그 짝인 악마 숭배 사제풍이라 어느 쪽 말로 불러도 같은 세트
  ['saint', /성자|성녀|수녀|사제|천사|흑미사|악마|聖女|聖人|シスター|司祭|天使|黒ミサ|悪魔|saint|priestess|\bnun\b|angel|devil/i],
];
const GENERIC = [
  ['summer', /여름|夏|なつ|サマー|summer/i],
  ['base', /기본|원래(?:대로)?|평소(?:대로)?|기존|처음|基本|元|もと|いつも|普段|ふだん|最初|デフォルト|default|normal|usual|basic|original|regular|first/i],
];
const COSTUME_KEYS = ['base', ...COSTUMES.map(([k]) => k)];
const NOUN_KO = '(?:옷|의상|복장|차림|코스튬|버전|모습|복)';
const NOUN_JA = '(?:服装|服|衣装|格好|かっこう|コスチューム|コスプレ|姿|やつ)';
const NOUN_EN = '(?:outfit|costume|clothes|clothing|dress|look|one)';
// 옷에만 쓰는 동사(입어·着て·wear) / 옷이 아니어도 쓰는 동사(바꿔·して·switch to)
const WEAR_KO = '(?:입어|입고|입자|입을래|갈아입)', ANY_KO = '(?:입어|입고|입자|입을래|갈아입|바꿔|바꾸|변경|변신|체인지|돌아|해\\s*줘|해$|부탁)';
const WEAR_JA = '(?:着替え|きがえ|着て)', ANY_JA = '(?:着替え|きがえ|着て|変えて|かえて|変身|返信|へんしん|して|チェンジ|なって|戻して|戻って|お願い)';
const WEAR_EN = '(?:wear|put\\s+on|dress\\s+in|get\\s+into)', ANY_EN = '(?:wear|put\\s+on|dress\\s+in|get\\s+into|change\\s+(?:back\\s+)?(?:in)?to|switch\\s+(?:back\\s+)?to|go\\s+back\\s+to)';
// 의상 낱말은 문장 어디에 있어도 된다(2026-10-01 실사용 "めちゃん、水着に着替えて"·"今私から水着に着替えた"가 앞말 때문에 안 걸렸다).
// 대신 의상 낱말 바로 뒤에 입는 말이 오고 거기서 문장이 끝나야 한다("水着に着替えた友達の写真を探して"는 아니다).
const PRE_KO = '(?:^|[\\s,.!?、。])', LEAD_EN = '^(?:please\\s+|can you\\s+|could you\\s+)?';
const END_KO = '[가-힣\\s.!?~]{0,6}$', END_JA = '[ぁ-ん。、！？!?\\s]{0,8}$';
const MID_KO = '\\s*(?:으로|로|을|를)?\\s*(?:좀\\s*|한번\\s*|다시\\s*)?', MID_JA = '(?:に|で|へ|を)?', ART_EN = '\\s+(?:the\\s+|your\\s+|a\\s+|an\\s+|that\\s+)?';
// 의상 이름(word) 하나에 대한 [한국어, 일본어, 영어] 판정. generic(여름·기본…)은 "옷"이라는 말이 붙거나 옷에만 쓰는 동사일 때만.
const dressRe = (word, generic) => {
  const w = `(?:${word.source})`;
  if (!generic) return [
    new RegExp(`${PRE_KO}${w}(?:\\s*${NOUN_KO})?(?:\\s*(?:으로|로)$|${MID_KO}${ANY_KO}${END_KO})`, 'i'), // "기모노로 갈아입어 줘"·"기모노로"
    new RegExp(`${w}(?:の?${NOUN_JA})?(?:(?:に|で)$|${MID_JA}${ANY_JA}${END_JA})`, 'i'),                 // "着物に着替えて"·"水着で"
    new RegExp(`${LEAD_EN}${ANY_EN}${ART_EN}${w}(?:\\s+${NOUN_EN})?(?:\\s+please)?$`, 'i'),             // "put on the bunny outfit"
  ];
  return [
    new RegExp(`${PRE_KO}${w}(?:\\s*${NOUN_KO}(?:\\s*(?:으로|로)$|${MID_KO}${ANY_KO}${END_KO})|${MID_KO}${WEAR_KO}${END_KO})`, 'i'), // "기본 옷으로"·"원래대로 갈아입어"
    new RegExp(`${w}(?:の?${NOUN_JA}(?:(?:に|で)$|${MID_JA}${ANY_JA}${END_JA})|${MID_JA}${WEAR_JA}${END_JA})`, 'i'),                 // "基本の服装で"·"元の服に戻して"
    new RegExp(`${LEAD_EN}(?:${ANY_EN}${ART_EN}${w}\\s+${NOUN_EN}|${WEAR_EN}${ART_EN}${w})(?:\\s+please)?$`, 'i'),                   // "switch to your normal outfit"
  ];
};
const DRESS = [...COSTUMES.map(([k, w]) => [k, dressRe(w, false)]), ...GENERIC.map(([k, w]) => [k, dressRe(w, true)])];
const DRESS_ANY = /^(?:옷|의상|복장)\s*(?:좀\s*)?(?:갈아입|바꿔|바꾸)|^다른\s*(?:옷|의상)|^갈아입어|^(?:服|衣装)を?(?:着替え|変えて|かえて|チェンジ)|^着替えて|^(?:違う|別の|ほかの)(?:服|衣装)|^(?:please\s+)?change\s+(?:your\s+)?(?:outfit|clothes|costume)|^(?:please\s+)?(?:wear|put on)\s+something\s+else/i;
// 의상 이름의 발음. "〈의상〉(の服)(に) 着替えて/着て" 꼴에서 의상 낱말이 이 가운데 하나와 비슷하면 받는다(風間 kazama → pajama).
// 옷에만 쓰는 동사(着替え·着て)가 있을 때만 보니, 비슷한 소리의 딴 말이 걸릴 여지는 작다.
const COSTUME_READING = {
  kimono: ['kimono', 'wafuku'], bunny: ['bani', 'banigaru', 'usagi'], pajama: ['pajama', 'nemaki'], casual: ['shifuku', 'kajuaru'], summer: ['wanpisu'],
  lounge: ['rumuuea', 'rumuwea', 'heyagi'], knit: ['nitto', 'seta'], nurse: ['nasu', 'kangoshi'], swim: ['mizugi', 'bikini'],
  saint: ['seijo', 'seijin', 'shisuta', 'shisai', 'tenshi', 'kuromisa', 'akuma'], base: ['kihon', 'itsumo', 'fudan', 'deforuto'],
};
function costumeByReading(tokens) {
  const r = romas(tokens);
  if (r.length < 2 || r.length > 9) return null;
  const v = r.findIndex((x, i) => i >= 1 && (/^kigae/.test(x) || x === 'kite' || (x === 'ki' && r[i + 1] === 'te')));
  if (v < 1) return null;
  let k = v - 1;
  if (k >= 0 && ['ni', 'wo', 'o', 'de', 'e'].includes(r[k])) k--;
  while (k >= 0 && ['fuku', 'fukuso', 'isho', 'kakko', 'no', 'yatsu'].includes(r[k])) k--; // "〜の服に"
  if (k < 0) return null;
  // 의상 낱말은 그 바로 앞 낱말(또는 앞 낱말과 이은 것). 앞에 딴 말이 붙어 있어도 된다("めちゃん、水着に着替えて")
  for (const word of [r[k], k >= 1 ? r[k - 1] + r[k] : null]) {
    if (!word) continue;
    let best = null, bestD = 9, tie = false;
    for (const [key, list] of Object.entries(COSTUME_READING)) for (const w of list) {
      const d = editDistance(word, w), limit = Math.min(word.length, w.length) <= 5 ? 1 : 2;
      if (d > limit || Math.abs(word.length - w.length) > limit) continue;
      if (d < bestD) { best = key; bestD = d; tie = false; } else if (d === bestD && key !== best) tie = true;
    }
    if (best && !tie) return best;
  }
  return null;
}
function costumeIntent(text, tokens) {
  const t = flat(text);
  if (!t || !short(t)) return null;
  const ja = t.replace(/\s+/g, ''); // 일본어 받아쓰기는 낱말 사이에 빈칸을 넣기도 한다
  for (const [key, res] of DRESS) if (res[0].test(t) || res[1].test(ja) || res[2].test(t)) return key;
  return costumeByReading(tokens) || (DRESS_ANY.test(t) ? 'random' : null);
}

// 모드 바꾸기도 발음으로: "会話モード"가 "海外モード"로, "指示モード"가 "支持モード"로 적힌다(2026-10-01 실사용 "普通な海外モードで" → 지시로 넘어갔다)
function modeByReading(tokens) {
  const r = romas(tokens);
  const i = r.findIndex((x) => x === 'modo' || x === 'mode');
  if (i < 1 || r.length > 7) return null;
  const w = r[i - 1];
  if (near(w, 'kaiwa', 2) || ['zatsudan', 'chatto', 'toku', 'oshaberi'].includes(w)) return 'chat';
  if (near(w, 'shiji', 1) || ['tasuku', 'sagyo', 'shigoto', 'meirei'].includes(w)) return 'task';
  return null;
}

/* ── 맥 음량: "볼륨 올려"·"音量を50に"·"소리 꺼 줘"·"volume down a bit" → { op: 'up'|'down'|'set'|'mute'|'unmute', value } ── */
// 사용자 2026-10-01: "맥의 볼륨을 조절하거나 화면을 깨우거나 하는 것도 빨리 알아듣고". 노래가 나오든 아니든 맥 출력 음량을 바꾼다.
// 캐릭터 목소리를 짚어 말하면("목소리 키워"·"声が小さい"·"speak up") 맥 음량이 아니라 캐릭터 목소리 크기를 바꾼다(target: 'voice').
// 노래를 크게·작게 해 달라는 말("音楽を大きくして"·"노래 좀 크게"·"make it louder")도 맥 음량이다(전에는 이런 말만 유튜브 플레이어 음량을 바꿨다).
const VOL_NOUN = /볼륨|음량|소리|사운드|ボリューム|音量|音(?![楽声])|サウンド|(?:노래|음악)\s*(?:을|를|좀)?\s*(?:좀\s*)?(?:더\s*)?(?:크게|작게)|(?:音楽|曲|歌)を?(?:もっと|もう少し|少し|ちょっと)?(?:大きく|小さく)|\b(?:volume|sound|(?:turn|make)\s+(?:it|that|the\s+(?:music|song)))\b/i;
const VOICE_NOUN = /목소리|말소리|말해|말하|얘기해|声|ボイス|話して|喋って|しゃべって|\b(?:voice|speak|talk)\b/i;
// 올려·내려는 문장의 끝말이어야 한다(한국어·일본어). "YouTubeに上げている音楽プレイして"의 上げ 처럼 가운데 있는 말은 아니다 —
// 그 말에 맥 음량이 50→62 로 올라갔다(2026-10-01 실사용 오작동).
const VEND_KO = '\\s*(?:해)?\\s*(?:줘|줘요|주세요|줄래|줄래요|봐|라)?$', VEND_JA = '(?:て|して|る|ろ)?(?:ください|くれ|くれる|よ|ね|ほしい|みて)?$';
const VOL_UP = new RegExp(`(?:키워|키우|올려|올리|높여|높이|크게)${VEND_KO}|(?:上げ|あげ|大きく|アップ)${VEND_JA}|\\b(?:up|louder|raise|increase|higher)\\b`, 'i');
const VOL_DOWN = new RegExp(`(?:줄여|줄이|낮춰|낮추|내려|내리|작게)${VEND_KO}|(?:下げ|さげ|小さく|ダウン)${VEND_JA}|\\b(?:down|quieter|softer|lower|decrease|reduce)\\b`, 'i');
// "큰 소리로 말해"·"大きい声で"는 키워 달라는 말, "목소리가 너무 커"·"声が大きい"는 줄여 달라는 말(작다는 그 반대)
const SAY_LOUD = /큰\s*(?:목)?소리로|大き[いな]声で|大声で/, SAY_SOFT = /작은\s*(?:목)?소리로|조용히\s*(?:말|얘기)|小さ[いな]声で|小声で/;
const TOO_QUIET = /(?:작아|작다|작네|작은데|안\s*들려|안\s*들린다|小さい|ちいさい|聞こえない|きこえない|聞こえにくい)(?:요|よ|ね|な|です)?$|\btoo\s+(?:quiet|low|soft)\b|\bcan'?t\s+hear\b/i;
const TOO_LOUD = /(?:너무\s*커|크다|크네|큰데|시끄러워|시끄럽다|大きい|おおきい|でかい|うるさい)(?:요|よ|ね|な|です)?$|\btoo\s+loud\b/i;
// 음소거·최대·절반도 그 말로 문장이 끝날 때만 받는다. 전에는 낱말이 들어 있기만 하면 받아서 "음소거가 뭐야"·"소리 꺼졌어"·"음소거 하지 마"가
// 음소거가 되고 "소리가 최대야"가 음량 100 이 됐다(2026-10-01 검토). 글로 친 지시 "음소거 단축키 추가해줘"도 음소거가 됐다.
const EN_IT = '(?:\\s+(?:it|the\\s+(?:sound|volume|mac|music)))?(?:\\s+please)?$';
const VOL_UNMUTE = new RegExp(`(?:음소거|뮤트)\\s*(?:해제|풀어|꺼|끄)${VEND_KO}|소리\\s*(?:좀\\s*)?(?:다시\\s*)?켜${VEND_KO}|ミュート(?:を)?(?:解除|オフ)(?:に)?${VEND_JA}|音を?(?:出し|つけ|戻し)${VEND_JA}|^(?:please\\s+)?unmute${EN_IT}`, 'i');
const VOL_MUTE = new RegExp(`(?:음소거|뮤트)(?:\\s*(?:로|으로))?${VEND_KO}|소리\\s*(?:좀\\s*)?(?:꺼|끄)${VEND_KO}|(?:ミュート|消音)(?:に)?${VEND_JA}|音を?(?:消し|切っ)${VEND_JA}|^(?:please\\s+)?mute${EN_IT}`, 'i');
const VOL_MAX = new RegExp(`(?:최대|맥스|끝까지)(?:\\s*(?:로|으로))?(?:\\s*(?:올려|키워|높여))?${VEND_KO}|(?:最大|マックス)(?:に|で|まで)?(?:上げ|あげ)?${VEND_JA}|\\b(?:max|maximum|full)(?:\\s+volume)?(?:\\s+please)?$|\\bvolume\\s+(?:to\\s+)?(?:max|maximum|full)\\b|\\ball\\s+the\\s+way\\s+up\\b`, 'i');
const VOL_HALF = new RegExp(`(?:절반|반)(?:\\s*(?:으로|로))?(?:\\s*(?:줄여|낮춰|내려|맞춰))?${VEND_KO}|半分(?:に|で|まで)?(?:下げ|さげ)?${VEND_JA}|\\bhalf(?:\\s+volume)?(?:\\s+please)?$|\\bvolume\\s+(?:to\\s+)?half\\b`, 'i');
const VOL_NUM = /(\d{1,3})\s*(?:%|퍼센트|퍼|프로|パーセント|percent)?/i;
const VOL_TO = /\d\s*(?:%|퍼센트|퍼|프로|パーセント|percent)?\s*(?:으로|로|까지|に|まで|\bto\b)/i; // "50으로"·"50まで" = 그 값으로
const VOL_SET = /\d\s*(?:%|퍼센트|퍼|프로|パーセント|percent)?\s*(?:으로|로|に)?\s*(?:해|맞춰|설정|して|設定|合わせ)?\s*(?:줘|주세요|ください|くれ)?$|\b(?:to|at)\s+\d|\bvolume\s+\d/i;
const VOL_LITTLE = /조금|살짝|약간|少し|ちょっと|\b(?:a\s+(?:bit|little)|slightly)\b/i, VOL_LOT = /많이|훨씬|확\s|かなり|ずっと|\b(?:a\s+lot|much|way)\b/i;
const VOL_BARE = /^(?:좀\s*)?(?:더\s*)?(?:크게|작게)(?:\s*해\s*줘)?$|^(?:もっと|もう少し|少し|ちょっと)?(?:大きく|小さく)(?:して)?(?:ください|くれ)?$|^(?:a\s+(?:bit|little)\s+)?(?:louder|quieter|softer)(?:\s+please)?$/i;
function volumeIntent(text) {
  const t = flat(text);
  if (!t || !short(t, 24) || WORK_WORDS.test(t)) return null;
  if (/^(?:please\s+|can you\s+|could you\s+)?(?:play|put on|search|google|open|go to)\b/i.test(t)) return null; // 재생·검색·열기 부탁이다
  const voice = VOICE_NOUN.test(t);
  if (!voice) {
    if (VOL_UNMUTE.test(t)) return { target: 'mac', op: 'unmute' };
    if (VOL_MUTE.test(t)) return { target: 'mac', op: 'mute' };
    if (!VOL_NOUN.test(t) && !VOL_BARE.test(t)) return null;
  }
  const num = VOL_NUM.exec(t), n = num ? Math.min(100, Number(num[1])) : null;
  const up = SAY_LOUD.test(t) || TOO_QUIET.test(t) || (VOL_UP.test(t) && !SAY_SOFT.test(t));
  const down = SAY_SOFT.test(t) || TOO_LOUD.test(t) || (VOL_DOWN.test(t) && !SAY_LOUD.test(t));
  if (up && down) return null;
  // 캐릭터 목소리: 키워/줄여만(몇 % 인지 말하면 그만큼, 아니면 25%)
  if (voice) return up || down ? { target: 'voice', op: up ? 'up' : 'down', value: n !== null ? n : 25 } : null;
  if (!up && !down) { // 올려·내려가 없다 → "볼륨 50으로"·"最大"·"절반"처럼 값을 말했을 때만
    if (VOL_MAX.test(t)) return { target: 'mac', op: 'set', value: 100 };
    if (VOL_HALF.test(t)) return { target: 'mac', op: 'set', value: 50 };
    return n !== null && VOL_SET.test(t) ? { target: 'mac', op: 'set', value: n } : null;
  }
  if (n !== null && VOL_TO.test(t)) return { target: 'mac', op: 'set', value: n }; // "30으로 낮춰 줘"
  if (up && VOL_MAX.test(t)) return { target: 'mac', op: 'set', value: 100 };      // "최대로 올려"
  if (down && n === null && VOL_HALF.test(t)) return { target: 'mac', op: 'set', value: 50 }; // "절반으로 줄여"
  return { target: 'mac', op: up ? 'up' : 'down', value: n !== null ? n : VOL_LITTLE.test(t) ? 6 : VOL_LOT.test(t) ? 25 : 12 }; // "10% 올려" → 그만큼
}

/* ── 화면: "화면 깨워"·"画面起こして"·"wake up the screen" → 'wake', "화면 꺼 줘"·"画面消して" → 'sleep' ── */
// 받아쓰기는 画面(がめん)을 仮面 으로도 적었다(2026-10-01 실사용 "仮面起こして")
const SCR = '(?:화면|모니터|디스플레이|스크린|画面|仮面|がめん|モニター|ディスプレイ|スクリーン)';
const MAC = '(?:맥북|맥|컴퓨터|マックブック|マック|パソコン|Mac)';
const TAIL_KO = '\\s*(?:줘|줘요|주세요|줄래|봐|라)?', TAIL_JA = '(?:ください|くれ|くれる|よ|ね)?';
const SCREEN = {
  wake: new RegExp(`^(?:${MAC}\\s*)?${SCR}\\s*(?:을|를|좀|は|を)?\\s*(?:다시\\s*)?(?:(?:깨워|켜|밝혀|살려)${TAIL_KO}|(?:起こして|おこして|つけて|点けて|付けて|オンにして)${TAIL_JA})$`
    + `|^${MAC}\\s*(?:을|를|좀|は|を)?\\s*(?:깨워${TAIL_KO}|起こして${TAIL_JA})$`
    + '|^(?:please\\s+)?(?:wake(?:\\s+up)?|turn\\s+on|switch\\s+on)\\s+(?:the\\s+|my\\s+)?(?:screen|display|monitor|mac)(?:\\s+up)?(?:\\s+please)?$|^(?:please\\s+)?turn\\s+(?:the\\s+|my\\s+)?(?:screen|display|monitor)\\s+on$', 'i'),
  sleep: new RegExp(`^(?:${MAC}\\s*)?${SCR}\\s*(?:을|를|좀|は|を)?\\s*(?:(?:꺼|끄|재워)${TAIL_KO}|(?:消して|けして|切って|オフにして|寝かせて|スリープ(?:して|させて)?)${TAIL_JA})$`
    + '|^(?:please\\s+)?(?:turn\\s+off|switch\\s+off|sleep)\\s+(?:the\\s+|my\\s+)?(?:screen|display|monitor)(?:\\s+please)?$|^(?:please\\s+)?turn\\s+(?:the\\s+|my\\s+)?(?:screen|display|monitor)\\s+off$', 'i'),
};
function screenIntent(text) {
  const t = flat(text);
  if (!t || !short(t, 20)) return null;
  const ja = t.replace(/\s+/g, '');
  for (const op of ['wake', 'sleep']) if (SCREEN[op].test(t) || SCREEN[op].test(ja)) return op;
  return null;
}

/* ── 사이트 열기: "유튜브 열어 줘"·"グーグルを開いて"·"open GitHub" → { site, url } ── */
const SITES = [
  ['ytmusic', 'https://music.youtube.com/', /유튜브\s*뮤직|유투브\s*뮤직|youtube\s*music|(?:ユーチューブ|YouTube)\s*ミュージック/i],
  ['youtube', 'https://www.youtube.com/', /유튜브|유투브|youtube|ユーチューブ|ようつべ/i],
  ['gmail', 'https://mail.google.com/', /지메일|g\s?mail|ジーメール|Gメール/i],
  ['maps', 'https://www.google.com/maps', /구글\s*(?:맵|지도)|google\s*maps?|(?:グーグル|Google)\s*マップ/i],
  ['calendar', 'https://calendar.google.com/', /구글\s*캘린더|google\s*calendar|(?:グーグル|Google)\s*カレンダー/i],
  ['drive', 'https://drive.google.com/', /구글\s*드라이브|google\s*drive|(?:グーグル|Google)\s*ドライブ/i],
  ['translate', 'https://translate.google.com/', /구글\s*번역|google\s*translate|(?:グーグル|Google)\s*翻訳/i],
  ['google', 'https://www.google.com/', /구글|google|グーグル/i],
  ['naver', 'https://www.naver.com/', /네이버|naver|ネイバー/i],
  ['github', 'https://github.com/', /깃허브|깃헙|github|ギットハブ/i],
  ['twitter', 'https://x.com/', /트위터|twitter|ツイッター/i],
  ['netflix', 'https://www.netflix.com/', /넷플릭스|netflix|ネットフリックス|ネトフリ/i],
  ['twitch', 'https://www.twitch.tv/', /트위치|twitch|ツイッチ/i],
  ['chzzk', 'https://chzzk.naver.com/', /치지직|chzzk/i],
  ['instagram', 'https://www.instagram.com/', /인스타그램|인스타|instagram|インスタグラム|インスタ/i],
  ['niconico', 'https://www.nicovideo.jp/', /니코니코(?:\s*동화)?|ニコニコ(?:動画)?|niconico/i],
  ['wikipedia', 'https://www.wikipedia.org/', /위키백과|위키피디아|wikipedia|ウィキペディア/i],
];
const OPEN_KO = /\s*(?:을|를|으로|로|에|좀|창|탭|사이트|홈페이지|페이지|새로|한번|다시|\s)*(?:열어|켜|띄워|들어가|접속해|가|오픈해|오픈)\s*(?:줘|줘요|주세요|줄래|줄래요|주라|봐|봐\s*줘|줘\s*봐|라)?$/;
const OPEN_JA = /(?:の(?:サイト|ページ|ホーム)|を|に|へ|\s)*(?:開いて|ひらいて|開けて|あけて|つけて|行って|いって|アクセスして|出して|オープンして|開く|オープン)(?:ください|くれ|くれる|よ|ね|ほしい)?$/;
const OPEN_EN = /^(?:please\s+|can you\s+|could you\s+)?(?:open(?:\s+up)?|go\s+to|launch|bring\s+up|pull\s+up|show\s+me)\s+(?:the\s+)?(.+?)(?:\s+(?:site|website|page|homepage|app))?(?:\s+please)?$/i;
function openIntent(text) {
  const t = flat(text);
  if (!t || !short(t, 20)) return null;
  // 사이트 이름을 뺀 나머지가 "열어 줘" 꼴뿐이어야 한다("유튜브에서 ○○ 열어 줘"는 아니다)
  const en = OPEN_EN.exec(t);
  for (const [site, url, re] of SITES) {
    const m = re.exec(en ? en[1] : t);
    if (!m) continue;
    if (en) { if (m[0].length === en[1].replace(/\.com$/i, '').length) return { site, url }; continue; }
    if (m.index !== 0) continue;
    const rest = t.slice(m[0].length);
    if (OPEN_KO.test(rest) && !rest.replace(OPEN_KO, '')) return { site, url };
    const restJa = rest.replace(/\s+/g, '');
    if (OPEN_JA.test(restJa) && !restJa.replace(OPEN_JA, '')) return { site, url };
  }
  return null;
}

/* ── 검색 열기: "구글에서 ○○ 검색해 줘"·"○○を検索して"·"search for ○○ on YouTube" → { engine, query, url } ── */
// "검색"이라고 한 말만 받는다. "알아봐 줘"·"調べて"·"look up"은 답을 바라는 말이라 모델에게 간다(엔진을 짚어 말했을 때는 받는다).
const ENGINES = {
  google: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  naver: (q) => `https://search.naver.com/search.naver?query=${encodeURIComponent(q)}`,
  youtube: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
};
const engineOf = (word) => (!word ? null : /유튜브|유투브|youtube|ユーチューブ|ようつべ/i.test(word) ? 'youtube' : /네이버|naver|ネイバー/i.test(word) ? 'naver' : 'google');
const ENGINE_KO = '(유튜브|유투브|구글|크롬|네이버|웹|인터넷|youtube|google|chrome|naver)';
const ENGINE_JA = '(ユーチューブ|ようつべ|グーグル|クローム|ネイバー|ウェブ|ネット|youtube|google|chrome|naver)';
const POLITE_KO = '(?:줘|줘요|주세요|줄래|줄래요|주라|봐|봐\\s*줘|줘\\s*봐|라)?';
const POLITE_JA = '(?:ください|くれ|くれる|みて|よ|ね|ほしい)?';
const SEARCH = [
  // 한국어: (엔진에서) ○○ 검색해 줘 / 엔진에서 ○○ 찾아 줘
  new RegExp(`^(?:${ENGINE_KO}\\s*(?:에서|에|로|으로)\\s*)?(.+?)\\s*(?:좀\\s*)?(?:검색|구글링|서치)\\s*(?:좀\\s*)?(?:해|해서)?\\s*${POLITE_KO}$`, 'i'),
  new RegExp(`^${ENGINE_KO}\\s*(?:에서|에)\\s*(.+?)\\s*(?:좀\\s*)?(?:찾아|쳐)\\s*${POLITE_KO}$`, 'i'),
  // 일본어: (エンジンで) ○○を検索して / エンジンで○○を調べて
  new RegExp(`^(?:${ENGINE_JA}\\s*で\\s*)?(.+?)(?:を|って|について)?\\s*(?:検索|けんさく|ググ)(?:して|って|る|お願い)?${POLITE_JA}$`, 'i'),
  new RegExp(`^${ENGINE_JA}\\s*で\\s*(.+?)(?:を|について)?\\s*(?:調べて|しらべて|探して|さがして)${POLITE_JA}$`, 'i'),
];
const SEARCH_EN = [
  /^(?:please\s+|can you\s+|could you\s+)?search\s+(google|youtube|naver|the\s+web|chrome)\s+for\s+(.+?)(?:\s+please)?$/i,
  /^(?:please\s+|can you\s+|could you\s+)?(?:google|search(?:\s+(?:for|up))?)\s+(.+?)(?:\s+on\s+(google|youtube|naver|the\s+web|chrome))?(?:\s+please)?$/i,
  /^(?:please\s+|can you\s+|could you\s+)?look\s+up\s+(.+?)\s+on\s+(google|youtube|naver|the\s+web|chrome)(?:\s+please)?$/i,
];
function searchIntent(text) {
  const t = flat(text);
  if (!t || t.length > 60) return null;
  let engineWord = null, query = null;
  if (isEnglish(t)) {
    const a = SEARCH_EN[0].exec(t), b = SEARCH_EN[1].exec(t), c = SEARCH_EN[2].exec(t);
    if (a) [engineWord, query] = [a[1], a[2]];
    else if (c) [engineWord, query] = [c[2], c[1]];
    else if (b) [engineWord, query] = [b[2], b[1]];
  }
  for (const re of query === null ? SEARCH : []) { const m = re.exec(t); if (m) { [engineWord, query] = [m[1], m[2]]; break; } }
  query = String(query || '').replace(/^[\s,、]+|[\s,、]+$/g, ''); // 끝의 조사(을·를)는 그대로 둔다("가을"·"노을"을 자르지 않게)
  if (!query || query.length > 40) return null;
  if (/^(?:유튜브|유투브|구글|크롬|네이버|웹|인터넷|youtube|google|chrome|naver|ユーチューブ|グーグル|クローム)\s*(?:에서|에|로|으로|で)?$/i.test(query)) return null; // 무엇을 찾을지 없다
  // 엔진을 짚지 않았으면 웹 검색이 아닐 수 있다: 작업 낱말("프로젝트에서 TODO 검색해 줘")이 있으면 모델에게
  if (!engineWord && WORK_WORDS.test(t)) return null;
  const engine = engineOf(engineWord) || 'google';
  return { engine, query, url: ENGINES[engine](query) };
}

/* ── 노래·영상 재생 부탁: "유튜브에서 ○○ 틀어 줘"·"○○を流して"·"play ○○" ── */
// strong: 노래를 틀라는 말로만 쓰는 말(틀어·재생·流して·プレイ). vague: 딴 뜻이 더 흔한 말 — 들려 줘("얘기 들려줘")·かけて("電話かけて")·
// 聞かせて("話を聞かせて"). vague 는 노래를 가리키는 낱말(what)이 같이 있을 때만 재생 부탁이고, 없으면 캐릭터가 뜻을 본다(detect 의 chat).
// weak(보여·켜·つけて·見せて)도 what 이 있어야 한다.
const PLAY = {
  ko: { what: /유튜브|유투브|youtube|노래|음악|영상|뮤비|플레이리스트|재생목록/i,
    strong: /(?:틀어|재생해|재생시켜|플레이해)\s*(?:줘|줘요|주세요|줄래|줄래요|주라|봐|봐\s*줘|줘\s*봐|라)?$|(?:재생|플레이)$/,
    vague: /들려\s*(?:줘|줘요|주세요|줄래|줄래요|주라|봐|봐\s*줘|줘\s*봐|라)?$/,
    weak: /(?:보여|켜)\s*(?:줘|줘요|주세요|줄래|줄래요|주라|봐|봐\s*줘|줘\s*봐)$/,
    // "물 틀어 줘"·"에어컨 틀어 줘"처럼 틀다의 딴 쓰임
    not: /(?:물|수도|샤워|에어컨|선풍기|보일러|히터|난방|냉방|가습기|불|TV|티비|텔레비전)\s*(?:을|를|좀)?\s*(?:틀어|켜)/i },
  ja: { what: /youtube|ユーチューブ|ようつべ|曲|音楽|歌|動画|ミュージック|プレイリスト|MV/i,
    strong: /(?:流して|ながして|再生して|プレイして|プレイ|再生)(?:ください|くれ|くれる|よ|ね|ほしい|を?お願い(?:します)?)?$/,
    vague: /(?:かけて|聴かせて|聞かせて)(?:ください|くれ|くれる|よ|ね|ほしい|を?お願い(?:します)?)?$/,
    weak: /(?:つけて|見せて|みせて)(?:ください|くれ|くれる|よ|ね|ほしい)?$/,
    not: /(?:電話|でんわ|鍵|カギ|かぎ|声|迷惑|心配|時間|お金|水|布団|毛布|アイロン|掃除機|目覚まし|タイマー|アラーム|エンジン|ブレーキ|眼鏡|メガネ|めがね|保険|負担|魔法|言葉|手間|カバー|話|はなし|意見|感想|理由|昔話|物語)(?:を|に|は)?(?:かけて|聴かせて|聞かせて)/ },
};
const PLAY_EN = /^(?:please\s+|can you\s+|could you\s+)?(?:play|put on)\s+\S+.*\S/i;
const PLAY_EN_NOT = /^(?:please\s+|can you\s+|could you\s+)?play\s+(?:again|it|that|around|with|along|nice|safe|a role|the role)\b/i;
function playIntent(text, lang = 'ko') {
  const t = flat(text);
  if (!t || t.length > 60 || WORK_WORDS.test(t)) return false;
  if (lang === 'en') return isEnglish(t) && PLAY_EN.test(t) && !PLAY_EN_NOT.test(t);
  const p = PLAY[lang] || PLAY.ko;
  const strong = p.strong.test(t), vague = p.vague.test(t), weak = p.weak.test(t);
  if (!strong && !vague && !weak) return false;
  if (p.not.test(lang === 'ja' ? t.replace(/\s+/g, '') : t)) return false;
  if (p.what.test(t)) return true; // 어디서·무엇을(유튜브·노래·영상…)이 있으면 재생 부탁
  // 틀라는 말이 분명하면 앞의 말이 제목이다("아이유 틀어줘"·"千本桜流して"). 전에는 짧은 제목을 받지 않아 멈춰 둔 딴 영상을 이어 틀었다(2026-10-01 검토)
  if (strong) return mediaQuery(t, lang) !== ''; // 제목 없이 "틀어 줘"·"流して"뿐이면 이어 틀기다(voice.js mediaControl)
  // かけて 는 제목(세 글자 이상) 뒤에 오면 재생으로 본다("マリーゴールドかけて"). 들려·聞かせて 는 노래 낱말이 없으면 받지 않는다
  return lang === 'ja' && /.{3,}かけて/.test(t.replace(/\s+/g, ''));
}
// 틀어 달라는 말일 수도 있는 것("옛날 얘기 들려줘"·"米津かけて"·"昔話を聞かせて"): 여기서 정하지 않고 캐릭터가 뜻을 본다
function vaguePlay(text, lang = 'ko') {
  const t = flat(text), p = PLAY[lang];
  if (!p || !t || t.length > 60 || WORK_WORDS.test(t)) return false;
  return p.vague.test(t) && !!mediaQuery(t, lang);
}
// 재생 부탁에서 검색할 말만 남긴다. 무엇을 틀지 없으면('노래 틀어 줘') ''.
const EMPTY_QUERY = /^(?:아무\s*)?(?:노래|음악|곡|뮤직|영상)?(?:\s*(?:아무거나|하나|좀))?$|^(?:何か|なんか|なにか|適当に)?(?:曲|音楽|歌|ミュージック|動画)?を?$|^(?:some\s+|a\s+|any\s+|the\s+)?(?:music|songs?|something|anything)$/i;
function mediaQuery(text, lang = 'ko') {
  let t = flat(text);
  if (lang === 'en') {
    t = t.replace(/^(?:please\s+|can you\s+|could you\s+)?(?:play|put on)\s+/i, '').replace(/\s*,?\s*please$/i, '')
      .replace(/\s+(?:on|from|in)\s+youtube$/i, '').replace(/^(?:me\s+)?(?:the\s+song|the\s+video|the\s+track|a\s+song\s+called)\s+/i, '');
  } else if (lang === 'ja') {
    t = t.replace(/\s+/g, ' ').replace(/(?:youtube|ユーチューブ|ようつべ|クローム|クロム|chrome)\s*(?:で|から|の)?/gi, ' ')
      .replace(/(?:を|って曲を?|という曲を?)?\s*(?:すぐに?\s*)?(?:流して|ながして|再生して|かけて|つけて|聴かせて|聞かせて|見せて|みせて|プレイして|プレイ|再生)(?:ください|くれ|くれる|よ|ね|ほしい|を?お願い(?:します)?)?$/u, '');
  } else {
    t = t.replace(/(?:유튜브|유투브|youtube|크롬|chrome)\s*(?:에서|로|으로)?/gi, ' ')
      .replace(/\s*(?:좀\s*)?(?:틀어|재생해|재생시켜|재생|들려|플레이해|플레이|보여|켜)\s*(?:줘|줘요|주세요|줄래|줄래요|주라|봐|봐\s*줘|줘\s*봐|라)?$/u, '');
  }
  t = t.replace(/^[\s,、。.]+|[\s,、。.]+$/g, '').replace(/\s+/g, ' ');
  // "다시 재생해 줘"·"もう一度再生して"·"play it again"의 다시·その曲 같은 말은 검색어가 아니다(남는 게 없으면 멈춰 둔 영상을 잇는다)
  t = t.replace(/^(?:다시|계속|이어서|아까\s*(?:그|틀던)?|방금\s*(?:그|틀던)?|그)\s*/, '').replace(/^(?:また|もう一度|もう一回|もういっかい|再び|続きを?|さっきの|今の|その)\s*/, '')
    .replace(/^(?:it|that|this)\b\s*/i, '').replace(/\s*\b(?:again|back on)$/i, '').replace(/^(?:거|것|やつ|の)\s*(?:を|를|을)?$/, '').trim();
  return EMPTY_QUERY.test(t) ? '' : t;
}
// 무엇을 틀지 말하지 않았을 때 찾는 말
const DEFAULT_QUERY = { ko: '인기 노래 모음', ja: '人気曲 メドレー', en: 'popular songs playlist' };

/* ── 한 번에 판정: langs 순서대로 보고 처음 걸린 것을 돌려준다. music: 노래가 나오는(났던) 중이라 "멈춰"를 노래 조작으로 받아도 되는지 ── */
// 검색어가 제목이 아니라 말을 거는 문장인지("じゃあ一緒にマリーゴールド聞こうよ"): 말머리·"같이"·권하는 끝말 가운데 둘 이상
const CHATTY = [/^(?:じゃあ|じゃ、|それじゃ|ねえ|そうだ|やっぱ|ところで|그럼|그러면|있잖아|우리\s)/, /一緒に|같이|함께/, /(?:[こそとのもろよおごぼ]うよ?|ましょう|ない[?？]?|よね|하자|듣자|보자|볼까|들을까|할까)$/];
const chatty = (q) => CHATTY.filter((re) => re.test(q)).length >= 2;
const PLAY_WORD = /틀어|재생|플레이|流して|ながして|かけて|再生|プレイ|\b(?:play|resume|unpause)\b/i;
// 틀어 달라는 말이지만 무엇을 틀지는 캐릭터가 정해야 하는 것: 골라 달라는 말("1曲お勧めしてプレイして"·"추천해서 틀어 줘")이나 앞서 나눈
// 이야기를 가리키는 말("あめちゃんがお勧めしてくれた歌い手の曲"·"아까 말한 노래"). 그 문장을 검색어로 틀면 엉뚱한 영상이 나온다
// (2026-10-01 실사용 두 번). ⚡ 지시 모드여도 지시 에이전트가 아니라 잡담 캐릭터에게 보낸다 — 캐릭터가 골라서 "[실행] 재생 …"으로 튼다.
const ASK_PICK = /お[勧薦奨]め|おすすめ|オススメ|推薦|選んで|えらんで|(?:言|い)ってた|話してた|教えてくれた|聞いた(?:こと|事)(?:が)?ない|聞いてみた(?:こと|事)(?:が)?ない|(?:君|きみ|あなた|お前)の好きな|추천|골라|말했던|말한|말해\s*준|알려\s*준|들어\s*본\s*적\s*없|안\s*들어\s*본|(?:네|니)가\s*좋아하는|\b(?:recommend(?:ed|ation)?|pick|you\s+(?:said|mentioned|told)|never\s+heard|your\s+favou?rite)\b/i;
// "그거 그대로 틀어"·"それをそのままプレイして": 지금 있는(멈춰 둔) 것을 가리키는 말이면 새로 찾지 않고 잇는다
// (2026-10-01 실사용 "今YouTubeに音楽あるから、それをそのままプレイして" → 그 문장을 검색어로 딴 영상을 틀었다)
const RESUME_HINT = /そのまま|それを|これを|今の(?:を|曲|音楽|歌|動画|やつ)|今.{0,12}(?:上げて|上がって|開いて|出て|止まって|止めて|流れて|かかって)(?:いる|る|た)|今ある|あるから|さっきの|止めた(?:やつ|の|曲|音楽)?|続きを|그대로|그거|이거|지금\s*.{0,8}(?:있는|떠\s*있는|열려\s*있는|멈춰\s*있는|틀어\s*놓은|켜져\s*있는)|지금\s*(?:그|거)|아까\s*(?:그|거|듣던|틀던)|멈춘\s*(?:거|노래|음악)|정지한\s*(?:거|노래|음악)|\b(?:it|that|this\s+one|what\s+was\s+playing|what'?s\s+(?:on|open|up|paused))\b/i;
// 하던 일(지시·크롬 도우미·잡담)을 말로 취소한다: 앞 일이 도는 중에만 본다(2026-10-01 실사용: "中止して"·"今のはキャンセル"가 "아직 하는 중"으로만 돌아왔다).
// "멈춰"·"止めて"·"stop"은 노래를 멈추라는 말일 수 있다 → 지금 노래가 나오는 중이거나 노래를 짚어 말했으면 취소가 아니다.
// 하지 말라는 말("멈추지 마"·"やめないで"·"don't stop"·"걱정하지 마")은 취소가 아니다. "하지 마"만 따로 말했을 때는 취소다.
const CANCEL_STRONG = /취소|중지|중단|中止|キャンセル|取り消|取消|もういい|\b(?:cancel|abort|never\s?mind|forget\s+it)\b/i;
const CANCEL_PHRASE = /^(?:그거\s*|그건\s*|이제\s*|그만\s*)?(?:하지\s*마|안\s*해도\s*돼)(?:요)?$|^(?:もう)?(?:しなくていい|やらなくていい)(?:よ)?$/;
const NEGATED = /지\s*마|지\s*말|면\s*안\s*돼|ないで|なくていい|ちゃだめ|ちゃダメ|\b(?:don'?t|do\s+not|never)\b/i;
const CANCEL_WEAK = /멈춰|멈추|그만|스톱|정지|止め|とめて|やめ|ストップ|\b(?:stop|quit)\b/i;
// 노래를 짚은 "음악 중지해 줘"·"노래 중단"·"音楽中止して"는 노래를 멈추라는 말이다(2026-10-02 실사용: ⚡ 지시가 막 끝나던 참이라 취소로 받아
// 노래가 안 멈췄다 — 지시가 도는 중이었으면 그 일을 끊었을 것이다). "취소"·"キャンセル"는 노래를 짚었어도 하던 일(재생 부탁 등)의 취소다
const CANCEL_STOP = /중지|중단|中止/;
const CANCEL_EXPLICIT = /취소|キャンセル|取り消|取消|\b(?:cancel|abort)\b/i;
const MUSIC_WORD = /노래|음악|곡|영상|유튜브|소리|音楽|曲|歌|動画|ユーチューブ|\b(?:music|songs?|video|youtube|sound)\b/i;
function cancelIntent(text, { playing = false } = {}) {
  const t = flat(text);
  if (!t || !short(t, 20)) return false;
  if (CANCEL_PHRASE.test(t)) return true;
  if (NEGATED.test(t) && !/\bnever\s?mind\b/i.test(t)) return false;
  if (MUSIC_WORD.test(t) && CANCEL_STOP.test(t) && !CANCEL_EXPLICIT.test(t)) return false;
  if (CANCEL_STRONG.test(t)) return true;
  return CANCEL_WEAK.test(t) && !playing && !MUSIC_WORD.test(t);
}
// 글로 친 말은 그 글의 언어로만 본다("next.js 설치해 줘"가 영어 "next"(다음 곡)로 걸리지 않게)
const langsOf = (text) => (/[\uac00-\ud7a3]/.test(text) ? ['ko'] : /[\u3040-\u30ff\u4e00-\u9fff]/.test(text) ? ['ja'] : ['en']);
function detect(text, langs = ['ko'], { music = false, busy = false, playing = false, tokens } = {}) {
  const t = String(text || '').trim();
  if (!t) return null;
  if (busy && cancelIntent(t, { playing })) return { kind: 'cancel' }; // 앞 일이 도는 중의 "취소"·"中止して"
  const mode = VOICE.modeSwitch(t) || modeByReading(tokens);
  if (mode) return { kind: 'mode', mode };
  const toLang = VOICE.langSwitch(t);
  if (toLang) return { kind: 'lang', lang: toLang };
  const form = formIntent(t, tokens);
  if (form) return { kind: 'form', to: form };
  const costume = costumeIntent(t, tokens);
  if (costume) return { kind: 'costume', to: costume };
  const volume = volumeIntent(t);
  if (volume) { const { target, ...v } = volume; return { kind: target === 'voice' ? 'voicegain' : 'volume', ...v }; }
  const screen = screenIntent(t);
  if (screen) return { kind: 'screen', op: screen };
  const open = openIntent(t);
  if (open) return { kind: 'open', ...open };
  // 노래 조작과 재생. 작업 낱말이 섞인 말("다음 테스트로 넘겨 줘")은 받지 않는다.
  const f = flat(t);
  for (const lang of WORK_WORDS.test(f) ? [] : langs) {
    const op = VOICE.mediaControl(f, lang);
    // 멈춰·다음 곡은 노래가 나오는(났던) 중이거나 노래를 짚어 말했을 때만("노래 멈춰"·"音楽止めて") — 노래가 없을 때의 "멈춰"는 딴 말이다
    if (op && op !== 'play') { if (music || MUSIC_WORD.test(f)) return { kind: 'media', op, lang }; continue; }
    const wantsPlay = playIntent(f, lang);
    if (!op && !wantsPlay) { if (vaguePlay(f, lang)) return { kind: 'chat' }; continue; }
    if (ASK_PICK.test(f)) return { kind: 'chat' };
    // 무엇을 틀지 없는 재생 부탁("再生して"·"음악 재생해줘"·"またプレイして"·"다시 틀어 줘")은 멈춰 둔 영상을 잇는다.
    // 이을 영상이 없으면 main 이 마지막에 튼 영상이나 기본 검색어로 튼다(모델에게 넘기지 않는다).
    // 노래가 없을 때 "続けて"·"이어서"·"continue"만으로는 받지 않는다(하던 이야기를 이으라는 말일 수 있다).
    if (op === 'play') { if (music || PLAY_WORD.test(f) || MUSIC_WORD.test(f)) return { kind: 'media', op: 'play', lang }; continue; }
    if (RESUME_HINT.test(f)) return { kind: 'media', op: 'play', lang };
    const query = mediaQuery(f, lang);
    if (!query) return { kind: 'media', op: 'play', lang };
    // 검색어가 문장 꼴이면(쉼표·"〜から"·"〜니까") 제목이 아니라 사정을 말한 것이다 → 여기서 받지 않는다(모델이 뜻을 본다)
    if ((/[、,]/.test(query) && /から|ので|けど|니까|는데|거든/.test(query)) || /[。！？!?]/.test(query) || chatty(query)) return null; // 문장이 둘 이상이거나 말을 거는 꼴이어도
    return { kind: 'play', query, lang }; // 무엇을 틀지 말했다 → 새로 찾아 튼다
  }
  const search = searchIntent(t);
  if (search) return { kind: 'search', ...search };
  return null;
}

// 잡담 모드의 안전망: 규칙이 놓친 말(받아쓰기가 낱말을 틀리게 적었거나 돌려 말한 것)은 잡담 캐릭터가 알아듣고 답 끝줄에
// "[실행] 동작"을 붙인다(persona.js). 그 줄을 detect 와 같은 꼴의 의도로 바꾼다 → main 이 같은 실행부로 돌린다.
const COSTUME_KO = { 기본: 'base', 기모노: 'kimono', 바니: 'bunny', 바니걸: 'bunny', 파자마: 'pajama', 잠옷: 'pajama', 사복: 'casual', 원피스: 'summer', 여름: 'summer', 룸웨어: 'lounge', 니트: 'knit', 간호사: 'nurse', 수영복: 'swim', 성자: 'saint', 성녀: 'saint', 수녀: 'saint', 천사: 'saint', 흑미사: 'saint', 악마: 'saint' };
function parseAction(action, lang = 'ko') {
  const a = String(action || '').trim().replace(/[.。]+$/, '');
  let m;
  if ((m = /^변신\s*(.*)$/.exec(a))) return /아메|ame|あめ|アメ/i.test(m[1]) ? { kind: 'form', to: 'ame' } : /초텐|쵸텐|choten|超てん|ちょうてん/i.test(m[1]) ? { kind: 'form', to: 'choten' } : { kind: 'form', to: 'toggle' };
  if ((m = /^의상\s*(.+)$/.exec(a))) { const w = m[1].trim().toLowerCase(); const to = COSTUME_KEYS.includes(w) ? w : COSTUME_KO[w] || Object.entries(COSTUME_KO).find(([k]) => w.includes(k))?.[1]; return to ? { kind: 'costume', to } : null; }
  if ((m = /^재생\s+(.+)$/.exec(a))) return { kind: 'play', query: m[1].trim(), lang };
  if (/^(?:이어\s*재생|다시\s*재생|재생)$/.test(a)) return { kind: 'media', op: 'play', lang };
  if (/^(?:멈춤|정지|일시\s*정지)$/.test(a)) return { kind: 'media', op: 'pause', lang };
  if (/^다음\s*곡$/.test(a)) return { kind: 'media', op: 'next', lang };
  if (/^이전\s*곡$/.test(a)) return { kind: 'media', op: 'prev', lang };
  if ((m = /^음량\s*(.+)$/.exec(a))) {
    const w = m[1].trim();
    if (/해제|켜/.test(w)) return { kind: 'volume', op: 'unmute' };
    if (/음소거|꺼/.test(w)) return { kind: 'volume', op: 'mute' };
    if ((m = /(\d{1,3})/.exec(w))) return /올려|키워/.test(w) ? { kind: 'volume', op: 'up', value: Number(m[1]) } : /내려|줄여/.test(w) ? { kind: 'volume', op: 'down', value: Number(m[1]) } : { kind: 'volume', op: 'set', value: Math.min(100, Number(m[1])) };
    return /올려|키워/.test(w) ? { kind: 'volume', op: 'up', value: 12 } : /내려|줄여/.test(w) ? { kind: 'volume', op: 'down', value: 12 } : null;
  }
  if ((m = /^화면\s*(.+)$/.exec(a))) return /꺼|끄/.test(m[1]) ? { kind: 'screen', op: 'sleep' } : /켜|깨/.test(m[1]) ? { kind: 'screen', op: 'wake' } : null;
  if ((m = /^모드\s*(.+)$/.exec(a))) return /지시/.test(m[1]) ? { kind: 'mode', mode: 'task' } : /대화|잡담/.test(m[1]) ? { kind: 'mode', mode: 'chat' } : null;
  // 정해 준 꼴이 아니라 풀어 썼을 때("기본 의상으로 갈아입기", 2026-10-01 실사용): 낱말로 맞춰 보고, 그래도 아니면 평소 판정에 넣어 본다
  if (/의상|옷|갈아입/.test(a)) { const hit = Object.entries(COSTUME_KO).find(([k]) => a.includes(k)) || COSTUME_KEYS.map((k) => [k, k]).find(([k]) => a.toLowerCase().includes(k)); if (hit) return { kind: 'costume', to: hit[1] }; }
  if (/변신|바꾸|바꿔/.test(a) && /아메|초텐|쵸텐/.test(a)) return { kind: 'form', to: /아메/.test(a) ? 'ame' : 'choten' };
  if (/음량|볼륨|소리/.test(a) && /올리|올려|키우|키워|높이|높여|내리|내려|줄이|줄여|낮추|낮춰/.test(a)) return { kind: 'volume', op: /올리|올려|키우|키워|높이|높여/.test(a) ? 'up' : 'down', value: 12 };
  const loose = detect(a, ['ko'], { music: true });
  return loose && !['cancel', 'lang', 'open', 'search', 'chat'].includes(loose.kind) ? loose : null;
}

// 바로 처리한 뒤의 한 마디(캐릭터·언어별). form 은 바뀐 캐릭터가 말한다.
const LINES = {
  choten: {
    ko: { form: '초텐짱 등장♡', formSame: '이미 초텐짱이야♡', costume: '갈아입었어♡ 어때?', open: '열었어♡', search: '검색해 놨어♡', cancel: '취소했어♡', up: '소리 키웠어♡', down: '소리 줄였어♡', set: '볼륨 {n}에 맞췄어♡', mute: '음소거했어♡', unmute: '소리 다시 켰어♡', volFail: '앗, 이 스피커는 음량을 못 바꿔…', wake: '화면 깨웠어♡', sleep: '화면 껐어♡', voiceUp: '목소리 키웠어♡ 이 정도면 들려?', voiceDown: '목소리 줄였어♡', fail: '앗, 크롬이 말을 안 들어…', noMedia: '지금 나오는 노래가 없는걸?' },
    ja: { form: '超てんちゃん参上♡', formSame: 'もう超てんちゃんだよ♡', costume: '着替えたよ♡ どう？', open: '開いたよ♡', search: '検索したよ♡', cancel: 'キャンセルしたよ♡', up: '音上げたよ♡', down: '音下げたよ♡', set: '音量{n}にしたよ♡', mute: 'ミュートにしたよ♡', unmute: '音出したよ♡', volFail: 'あれ、このスピーカーは音量を変えられない…', wake: '画面つけたよ♡', sleep: '画面消したよ♡', voiceUp: '声大きくしたよ♡ これで聞こえる？', voiceDown: '声小さくしたよ♡', fail: 'あれ、クロームが動かない…', noMedia: '今は何も流れてないよ？' },
    en: { form: "Choten-chan's here♡", formSame: "I'm already Choten-chan♡", costume: 'Changed♡ How do I look?', open: 'Opened it♡', search: 'Here are the results♡', cancel: 'Cancelled♡', up: 'Turned it up♡', down: 'Turned it down♡', set: 'Volume set to {n}♡', mute: 'Muted♡', unmute: 'Sound is back on♡', volFail: "Hmm, I can't change this speaker's volume…", wake: 'Screen is on♡', sleep: 'Screen off♡', voiceUp: "I'll speak up♡ Can you hear me now?", voiceDown: "I'll speak softer♡", fail: "Hmm, Chrome isn't responding…", noMedia: "Nothing's playing right now?" },
  },
  ame: {
    ko: { form: '…나왔어.', formSame: '…이미 나야.', costume: '…갈아입었어.', open: '…열었다.', search: '…검색해 놨다.', cancel: '…취소했다.', up: '…키웠다.', down: '…줄였다.', set: '…{n}에 맞췄다.', mute: '…소리 껐다.', unmute: '…소리 켰다.', volFail: '…이 스피커는 음량을 못 바꿔.', wake: '…깨웠다.', sleep: '…껐다.', voiceUp: '…크게 말할게.', voiceDown: '…작게 말할게.', fail: '…크롬이 안 움직여.', noMedia: '…지금 나오는 게 없어.' },
    ja: { form: '…出てきた。', formSame: '…もう私だけど。', costume: '…着替えた。', open: '…開いた。', search: '…検索しといた。', cancel: '…取り消した。', up: '…上げた。', down: '…下げた。', set: '…{n}にした。', mute: '…消音にした。', unmute: '…音を出した。', volFail: '…このスピーカーは音量を変えられない。', wake: '…つけた。', sleep: '…消した。', voiceUp: '…大きく話す。', voiceDown: '…小さく話す。', fail: '…クロームが動かない。', noMedia: '…今は何も流れてない。' },
    en: { form: "…I'm here.", formSame: "…It's already me.", costume: '…Changed.', open: '…Opened.', search: '…Searched.', cancel: '…Cancelled.', up: '…Louder.', down: '…Quieter.', set: '…Set to {n}.', mute: '…Muted.', unmute: '…Unmuted.', volFail: "…Can't change this speaker's volume.", wake: '…Screen on.', sleep: '…Screen off.', voiceUp: "…I'll speak up.", voiceDown: "…I'll keep it down.", fail: "…Chrome won't move.", noMedia: '…Nothing is playing.' },
  },
};
const line = (who, lang, kind, vars = {}) => (((LINES[who] || LINES.choten)[lang] || LINES.choten.ko)[kind] || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));

// 유튜브 검색 결과 HTML 에서 영상(쇼츠·광고 아님)을 차례로 뽑는다 → [{ id, title }]
function parseYouTubeResults(html) {
  const out = [];
  const re = /"videoRenderer":\{"videoId":"([\w-]{11})"[\s\S]{0,2500}?"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"\}/g;
  for (const m of String(html || '').matchAll(re)) {
    let title = m[2];
    try { title = JSON.parse(`"${m[2]}"`); } catch {}
    if (!out.some((h) => h.id === m[1])) out.push({ id: m[1], title });
    if (out.length >= 5) break;
  }
  return out;
}

module.exports = { detect, langsOf, parseAction, cancelIntent, volumeIntent, screenIntent, formIntent, costumeIntent, openIntent, searchIntent, playIntent, mediaQuery, line, parseYouTubeResults, COSTUME_KEYS, DEFAULT_QUERY, LINES };
