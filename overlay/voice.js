// 음성 모드의 순수 로직(test/voice.test.js). 사용자 결정(2026-09-30):
// - 음성 모드를 켜 둬도 "쵸텐짱"·"아메짱"이라고 불렀을 때만 반응한다(아무 소리나 받지 않는다). 부른 캐릭터가 대답한다.
// - 한국어·일본어 모드를 골라 듣기와 말하기 언어를 통일한다.
// 호출어 전용 엔진(무료 한·일)이 없어서, Apple 받아쓰기 결과의 앞부분이 이름과 비슷한지로 판정한다. 받아쓰기는 이름을
// 흔히 다르게 적는다(실측: 쵸텐짱→"쇼텐짱", 아메짱→"밤에 짱", あめちゃん→"雨ちゃん"), 그래서 변형을 넓게 받는다.

// 앞에 붙는 부름말(야·저기·ねえ…)은 건너뛴다
const LEAD = '(?:야|저기요?|거기|여기|어이|오이|에이|이봐|헤이|있잖아|ねえ|ねぇ|あの|おい|[Hh]ey|HEY)?';
const SUFFIX_KO = '(?:짱|쨩|장|쟝|찬|챤|잔|쨍)';
const SUFFIX_JA = '(?:ちゃん|チャン|ちゃ)';
// 일본어는 "ちゃん"은 잘 알아듣고 이름 쪽을 흔한 한자로 적는다(실측: 頂天·超天·笑点·ちょてん, あめ→ハメ). 사용자 뜻에 따라
// 끝은 ちゃん 계열만 받는다(じゃん 은 "雨じゃん" 같은 흔한 말과 겹친다). 이름 + じゃん 만으로 된 말은 예외(matchWakeBare 의 JAN_ONLY).
// 초텐의 어간(이름에서 짱을 뺀 부분). 변신 부탁(intent.js)도 같은 표를 쓴다 — 따로 두었더니 "초틴짱"은 불리는데 "초틴으로 변신"은 안 됐다.
const CHOTEN_KO = '[초쵸쇼조죠추츄][텐틴팅탠텡된탄턴톈뗀편펜]';
const CHOTEN_JA = 'ちょうてん|ちょーてん|ちょてん|チョウテン|チョーテン|チョテン|しょうてん|しょてん|ショウテン|ショテン|超てん|超テン|超天|超点|頂天|頂点|笑点|焦点|商店|昇天|書店';
// 비슷한 발음(사용자 2026-10-06 "쵸텐 아메 어이 쵸텐 어이 아메 등 다양한 부르는 방식과 유사한 발음도"): 작게 부르면 받아쓰기가 이름을
// 엉뚱한 낱말로 적는다(실사용 "어이 좆된."·"초 텐트."·"어이 밤에."·"거의 암에."). 글자를 하나씩 늘어놓는 대신 소리(초성·중성·종성)로
// 비슷한 음절을 모은다. 흔한 말과 겹칠 수 있어서 이 꼴은 말 전체가 이름(+부름말)뿐일 때만 받는다(matchWakeBare).
const JAMO_I = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ', JAMO_V = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ', JAMO_F = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';
const sylls = (i, v, f = ' ') => [...i].flatMap((a) => [...v].flatMap((b) => [...f].map((c) =>
  String.fromCharCode(0xAC00 + (JAMO_I.indexOf(a) * 21 + JAMO_V.indexOf(b)) * 28 + JAMO_F.indexOf(c))))).join('');
// 초: ㅊ·ㅈ·ㅉ(+ 쇼·쑈) + ㅗ·ㅛ. 받침은 없거나 [t]로 소리 나 뒤의 ㅌ 에 묻히는 것("좆된"·"촛텐")
const CHO_SOUND = sylls('ㅊㅈㅉ', 'ㅗㅛ', ' ㄷㅅㅆㅈㅊㅌ') + sylls('ㅅㅆ', 'ㅛ', ' ㄷㅅㅆㅈㅊㅌ');
// 텐: ㅌ·ㄷ·ㄸ + 에 소리(ㅔㅐㅖㅒㅚㅙㅞ) + ㄴ·ㅇ, 또는 틴·딘(ㅣ 는 ㄴ 받침만 — "초딩"은 낱말이다). ㅓ·ㅏ(조던·수단…)는 넣지 않는다
const TEN_SOUND = sylls('ㅌㄷㄸ', 'ㅔㅐㅖㅒㅚㅙㅞ', 'ㄴㅇ') + sylls('ㅌㄷㄸ', 'ㅣ', 'ㄴ');
const CHOTEN_SOUND = `[${CHO_SOUND}][${TEN_SOUND}]트?`; // "초텐트": 텐 뒤의 숨소리가 트로 적혔다
const AME_SOUND = '(?:아메|아매|암에|암애|하메|아몌)';
const NAMES = {
  // 텐이 틴·팅으로 적히기도 한다(2026-10-01 파일 시험: "초틴짱", "초팅짱"). 실사용에선 "초된장"·"조된장"·"초탄장"으로도 적혔다
  // "초편장"·"초짱"으로도 적혔다(2026-10-01 실사용). "초짱"은 짱·쨩일 때만("초장"은 딴 말이다)
  // 짧게 부른 것(2026-10-03 사용자 "처음 이름을 부를 때 좀 더 짧게 부를 때도 응답하게"): 실사용에서 "초단장"·"소탄장"·"텐짱"으로 적혀 버려졌다.
  // "텐짱"·"てんちゃん"은 초텐의 뒷부분만 들린 것. "단장"이 낱말이라 단·소는 이 꼴로만 받는다
  // 작게 부르면 "주된장"으로도 적혀 버려졌다(2026-10-03 사용자 "이름 불러서 호출할때 더 작은 목소리도 인식하도록"). "주된"이 낱말이라
  // 이 꼴로만, 뒤에 조사가 붙으면("주된 장을…") 받지 않는다
  choten: [`${CHOTEN_KO}${SUFFIX_KO}`, '[초쵸](?:짱|쨩)', '(?:[초쵸]단|소[텐탄틴])(?:짱|쨩|장|쟝)', '주[텐된탠](?:짱|쨩|장|쟝)(?!을|를|은|는|이|가|의|도|으로|로|에)',
    '텐(?:짱|쨩)', '(?:てん|テン)(?:ちゃん|チャン)',
    // ちょう·しょう 로 읽히는 한자 한 글자 + てん 으로 읽히는 글자(笑天·頂天·超点…). 발음 토큰이 훈독("warai ten")으로 올 때를 받는다
    `[超頂笑焦商昇書聴町長朝丁庁腸蝶調鳥小少正章唱勝賞省照昭将消][天点店典転展テて][んン]?${SUFFIX_JA}`,
    `(?:${CHOTEN_JA})(?:${SUFFIX_JA}|さん)`],
  // 노래 중(에코 제거)에는 あめ 가 姉·アナ 로 적혔다(2026-10-01 실사용: "姉ちゃん、音楽すめて", "アナちゃん音楽止めて")
  ame: [`(?:아메|아매|암에|밤에|아에|하메|아네|아나)${SUFFIX_KO}`, `(?:あめ|アメ|雨|飴|はめ|ハメ|姉|あね|アネ|あな|アナ|穴)${SUFFIX_JA}`, '(?:あめ|アメ|雨|飴)さん',
    '(?:なめ|め)(?:ちゃん|チャン)'], // "なめちゃん"·"めちゃん"(2026-10-01 실사용). ん 까지 있어야 한다 — "めちゃくちゃ"·"なめちゃった"와 겹친다
};
// 받아쓰기에 주는 이름 힌트(sttd words). 효과는 크지 않지만 해가 없다. 이름만("아메")은 넣지 않는다 — 흔한 대답 "아 네"가 "아메"로 기울면
// 짱 없이 부른 것으로 받게 된다(2026-10-06 짱 없는 부름을 받기 시작하며)
const WAKE_HINTS = { ko: ['쵸텐짱', '초텐짱', '아메짱', '어이 쵸텐', '어이 아메'], ja: ['超てんちゃん', 'ちょうてんちゃん', 'チョテンちゃん', 'あめちゃん', 'アメちゃん', 'おい超てん', 'おいアメ'], en: ['Choten-chan', 'Ame-chan', 'hey Choten', 'hey Ame'] };
// 공백·문장부호를 뺀 글자로 비교한다
const squash = (s) => String(s || '').replace(/[\s.,!?~…·、。！？「」『』"'`♡]/g, '');
// 이름을 두 번 부르기도 한다("거기 초텐 초텐짱" — 2026-10-06 실사용): 앞의 짱 없는 이름은 부름말처럼 건너뛴다
const REPEAT = { choten: '(?:[초쵸조죠쇼][텐탠])', ame: '(?:아메)' };
const PATTERNS = Object.entries(NAMES).map(([who, alts]) => ({ who, re: new RegExp(`^(${LEAD}${REPEAT[who]}?)(?:${alts.join('|')})`) }));

// 받아쓴 글이 이름으로 시작하면 { who, rest }(rest = 이름 뒤에 이어 말한 요청). 아니면 null.
// particle: 이름 바로 뒤에 조사가 붙어 있다("あめちゃんがお勧めしてくれた曲"·"초텐짱으로 변신") — 부른 게 아니라 문장의 한 부분이다.
// main 이 그때는 이름을 떼지 않고 문장 그대로 넘긴다(2026-10-01 실사용: "がお勧めしてくれた歌い手の曲"를 검색어로 틀었다).
function matchWakeStrict(text, tokens) { // "○○짱" 꼴만
  const flat = squash(text);
  for (const { who, re } of PATTERNS) {
    const m = re.exec(flat);
    if (!m) continue;
    const cut = cutAfter(text, m[0].length);
    if (!nameBounded(text, cutAfter(text, m[1].length), cut, tokens)) continue;
    return particleAt(text, cut, tokens) ? { who, rest: restFrom(text, cut), particle: true } : { who, rest: restFrom(text, cut) };
  }
  return null;
}
// 이름이 낱말로 끊겨 있는지. 빈칸·부호를 빼고 맞추다 보니 딴 말의 한가운데가 이름으로 읽혔다(2026-10-01 검토: "밤에 잔다"·"아 나 장난 아니야"·
// "조 된장 사와"·"雨ちゃんと降ってる"가 호출이 됐다).
//  - 이름 안의 빈칸은 짱 바로 앞 한 곳만("밤에 짱"은 실제로 그렇게 적혔다)
//  - 한국어(짱으로 끝남): 이름 뒤가 끝·빈칸·부호거나, 붙여 쓴 조사·부름말(아·야·이·으로…) 뒤가 끊겨 있을 것
//  - 일본어: 발음 토큰이 있으면 이름이 낱말 경계에서 끝날 것("ちゃんと"의 한가운데가 아닐 것)
const KO_AFTER = /^(?:$|[\s.,!?~…·、。！？]|(?:이랑|랑|이|가|은|는|의|도|을|를|아|야|님|한테|에게|으로|로)(?:$|[\s.,!?~…·、。！？]))/;
const SUFFIX_ONLY = new RegExp(`^(?:${SUFFIX_KO}|${SUFFIX_JA}|さん)$`);
function nameBounded(text, from, cut, tokens) {
  const src = String(text || '');
  const parts = src.slice(from, cut).replace(/^[\s.,!?~…·、。！？]+/, '').split(/\s+/).filter(Boolean);
  if (parts.length > 2 || (parts.length === 2 && !SUFFIX_ONLY.test(parts[1]))) return false;
  if (/[가-힣]/.test(src[cut - 1] || '')) return KO_AFTER.test(src.slice(cut));
  if (Array.isArray(tokens) && tokens.length) return tokens.some(([, end]) => end === cut);
  return true;
}
// 이름이 끝난 자리(cut) 바로 뒤가 조사인지. 한국어는 이름에 붙여 쓴 조사 뒤가 끊겨 있을 때("아메짱이 추천…"),
// 일본어는 낱말 경계를 알아야 해서("あめちゃんがんばって"의 が 는 조사가 아니다) 발음 토큰이 있을 때만 본다.
const KO_PARTICLE = /^(?:이랑|랑|이|가|은|는|의|도|을|를|한테|에게|으로|로)(?=[\s.,!?~…]|$)/;
const JA_CASE = new Set(['ga', 'ha', 'wa', 'no', 'ni', 'wo', 'mo', 'to', 'tte', 'he']);
function particleAt(text, cut, tokens) {
  const after = String(text || '').slice(cut);
  if (KO_PARTICLE.test(after)) return true;
  if (!Array.isArray(tokens)) return false;
  const next = tokens.find(([, end]) => end > cut);
  return !!next && JA_CASE.has(roma(next[0])) && /^[がはのにをもとへっ]/.test(after);
}
// "어이 쵸텐"·"어이 아메"·"おい超てん"처럼 짱 없이 부르기도 한다(사용자 2026-10-01). 이름만으로는 흔한 말과 겹치니("아메리카노"·"雨が…")
// 부름말(어이·야·おい·ねえ…) 바로 뒤에 이름이 오고, 이름 뒤가 끊겨 있을 때만(띄어쓰기·부호·끝) 받는다.
const HEY = '(?:어\\s?이|오이|에이|야|헤이|이봐|저기요?|おい|オイ|ねえ|ねぇ|ねー|なあ|へい|ヘイ|[Hh]ey|HEY)';
const BARE = {
  choten: '(?:[초쵸쇼조죠추츄][텐틴팅탠텡된탄턴톈뗀]|ちょうてん|ちょーてん|ちょてん|チョウテン|チョーテン|チョテン|超てん|超テン|超天|頂天|頂点|笑点|商店)(?:아|よ)?',
  // 암에·밤에는 뒤에 말이 이어지면 흔한 말이다("야 암에 좋대") — 부름말과 그것만 말했을 때만 받는다(matchWakeBare)
  ame: '(?:아메|아매|하메|あめ|アメ|雨|飴)(?:야|よ)?',
};
const HEY_RE = Object.entries(BARE).map(([who, name]) => ({ who, re: new RegExp(`^\\s*${HEY}[\\s,、~!]*${name}(?=$|[\\s.,!?~…·、。！？])`) }));
function matchWakeHey(text) {
  const src = String(text || '');
  for (const { who, re } of HEY_RE) {
    const m = re.exec(src);
    if (m) return { who, rest: src.slice(m[0].length).replace(/^[\s.,!?~…·、。！？]+/, '').trim() };
  }
  return null;
}
const matchWake = (text, tokens) => matchWakeStrict(text, tokens) || matchWakeHey(text);
// 말 전체가 이름뿐일 때("雨"·"アメ"·"초텐"): 짱도 부름말도 없지만 이름만 부른 것이다(2026-10-01 실사용: 노래 중에 "雨"만 받아써져 버렸다).
// 다 끝난 말(확정)에만 쓴다 — 말하는 도중("雨…が降ってる")에는 이름인지 알 수 없다.
// 흔한 낱말로 적힌 것(頂点·商店·笑点)은 한 마디만으로는 받지 않는다 — 잡음이 낱말 하나로 받아써지는 일이 잦다
// HEY_ALONE: 이름 앞에 붙을 수 있는 부름말(빈칸·부호를 뺀 글에 쓴다). "어이"가 "거의"·"어의"로도 적혔다(2026-10-06 "거의 암에.")
const HEY_ALONE = '(?:어이|어의|거의|오이|에이|헤이|이봐|야|저기요?|거기|여기)';
const BARE_ONLY = Object.entries({
  // "초대장"은 흔한 낱말이라 그것만 말했을 때만 받는다(2026-10-03 작게 부른 "초텐짱"이 "초대장."으로 적혀 버려졌다)
  choten: '(?:[초쵸쇼][텐틴]|초대장|ちょうてん|ちょーてん|ちょてん|チョウテン|チョーテン|チョテン|超てん|超テン)(?:아|야|よ)?',
  // 흔한 낱말로 적히는 변형(頂点·商店…)은 부름말과 함께 그것만 말했을 때 받는다("あ、頂点。"·"ねえ商店" — 2026-10-03 짧은 부름)
  choten_lead: `(?:あ|ああ|おい|ねえ|ねぇ|ほら)(?:${CHOTEN_JA})(?:よ)?`,
  ame: '(?:아메|あめ|アメ|雨|飴)(?:야|よ)?',
  // 비슷한 발음(CHOTEN_SOUND·AME_SOUND, 2026-10-06): 부름말과 이름뿐이거나 이름을 두 번 불렀을 때("어이 좆된."·"초 텐트."·"초텐 초텐")
  choten_sound: `${HEY_ALONE}?(?:${CHOTEN_SOUND})(?:아|야)?(?:${CHOTEN_SOUND}(?:아|야)?)?`,
  ame_sound: `${HEY_ALONE}?${AME_SOUND}(?:아|야)?(?:${AME_SOUND}(?:아|야)?)?`,
  // "밤에"는 흔한 말이라 "야"가 아닌 부름말과 그것만 말했을 때만("어이 밤에." — 2026-10-06 실사용)
  ame_sound_night: '(?:어이|어의|거의|오이|에이|헤이|이봐)(?:밤에|밤애)',
}).map(([who, name]) => ({ who: who.replace(/_.*$/, ''), sound: /_sound/.test(who), re: new RegExp(`^${name}$`) }));
// 이름 + じゃん 만으로 된 말도 부른 것으로 본다(사용자 2026-10-02 "じゃん은 이름만 부를 때만 받아라"). 받아쓰기가 "ちょうてんちゃん"을
// "頂点じゃん"·"商店じゃん"으로, "あめちゃん"을 "雨じゃん"으로 적어 부름이 버려졌다(실사용 5번). 뒤에 말이 이어지면("雨じゃん、傘持ってきた？")
// 흔한 말이라 받지 않는다. 앞의 부름말(おい·ねえ…)은 된다. "穴じゃん"처럼 그것만으로도 흔한 말인 변형은 뺐다
const JAN_ONLY = Object.entries({
  choten: `(?:${CHOTEN_JA}|[超頂笑焦商昇書聴町長朝丁庁腸蝶調鳥小少正章唱勝賞省照昭将消][天点店典転展テて][んン]?)`,
  ame: '(?:あめ|アメ|雨|飴|あね|アネ|姉|あな|アナ)',
}).map(([who, name]) => ({ who, re: new RegExp(`^${LEAD}${name}(?:じゃん|ジャン)$`) }));
function matchWakeBare(text) {
  const flat = squash(text);
  for (const { who, sound, re } of BARE_ONLY) if (re.test(flat)) return sound ? { who, rest: '', sound } : { who, rest: '' };
  for (const { who, re } of JAN_ONLY) if (re.test(flat)) return { who, rest: '' };
  return null;
}
// 짱도 부름말도 없이 이름으로 시작하는 말("쵸텐 노래 틀어 줘"·"아메, 오늘 날씨 어때" — 사용자 2026-10-06 "쵸텐 아메 어이 쵸텐 어이 아메 등
// 다양한 부르는 방식"). 한국어에는 이 이름과 겹치는 낱말이 없어서 받는다. 이름 뒤는 끊겨 있어야 한다("아메리카노"·"초텐이 귀여워"는 아니다).
// 일본어는 雨·あめ 가 흔한 말이라 이 꼴을 받지 않는다(한글 이름만). 노래 중에는 가사가 "아메"로 적힐 수 있어 main 이 소리 크기를 보고 쓴다
const NAME_START = Object.entries({ choten: '[초쵸조죠쇼]\\s?[텐탠]', ame: '아\\s?메' })
  .map(([who, name]) => ({ who, re: new RegExp(`^[\\s.,!?~…·]*(?:${name})(?:아|야)?(?=$|[\\s.,!?~…·])`) }));
function matchWakeName(text) {
  const src = String(text || '');
  for (const { who, re } of NAME_START) {
    const m = re.exec(src);
    if (m) return { who, rest: src.slice(m[0].length).replace(/^[\s.,!?~…·]+/, '').replace(/^(?:야|아)\s+/, '').trim() };
  }
  return null;
}
// 이름 앞부분이 안 들리고 "ちゃん"만 받아써질 때가 있다(작게 불렀거나 캐릭터 말이 끝나기 전에 부르기 시작함 — 2026-10-01 실사용 10번).
// "ちゃん"으로 시작하는 말은 이름을 부른 것밖에 없으니("ちゃんと"는 낱말이 다르다) 지금 캐릭터를 부른 것으로 본다 → { who: null, rest }
function matchWakeTail(text, tokens) {
  if (!Array.isArray(tokens) || !tokens.length) return null;
  const first = roma(tokens[0][0]);
  if (first !== 'chan' && first !== 'chanchan') return null;
  return { who: null, rest: String(text || '').slice(tokens[0][1]).replace(/^[\s.,!?~…·、。！？]+/, '').trim() };
}
// 일본어는 발음으로도 맞춘다: 받아쓰기가 이름을 흔한 한자로 달리 적어서(頂天·超天·笑点·超てっ…, 雨·姉·アナ…) 글자 목록으로는 끝이 없다.
// sttd 가 앞 낱말들의 [로마자 발음, 원문에서 끝나는 자리]를 준다(tokens). 낱말을 이어 붙이다가 "…chan"(·tan·cha)으로 끝나면
// 그 앞(어간)이 이름과 비슷한지 본다. 초텐: "choten" 과 두 글자 안쪽 차이(shoten·chote·chotten…), 아메: ame·ane·ana·hame·ama.
// 2026-10-01 사용자: "특히 일어일 때 더 못 알아듣는 듯".
const JA_LEAD = new Set(['nee', 'ne', 'ano', 'anou', 'oi', 'nene', 'hei', 'hey', 'naa', 'na']);
// 짱 없이 "おいアメ"·"ねえ超てん": 부름말 뒤 이름 다음에 조사가 오면("おい、雨が降ってる") 부른 게 아니다
const JA_PARTICLE = new Set(['ga', 'ha', 'wa', 'ni', 'wo', 'o', 'de', 'mo', 'no', 'to', 'da', 'desu', 'datta', 'deshita', 'ka', 'kara', 'made', 'yori', 'e', 'he', 'ya', 'ja', 'janai', 'dayo', 'dane', 'mitai', 'nano', 'nara', 'tte']);
const JA_SUFFIX = /(chan|tan|cha|tyan|san)$/;
const AME_STEMS = new Set(['ame', 'ane', 'ana', 'hame', 'ama', 'yame', 'ami', 'name', 'me']); // name·me: "なめちゃん"·"めちゃん"(2026-10-01 실사용)
const roma = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/~tsu/g, '').replace(/[^a-z]/g, '').replace(/ou|oo/g, 'o').replace(/uu/g, 'u');
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
// loose: 노래·영상 소리가 나는 중. 그 소리에 묻혀 이름이 더 달리 적히니("亀ちゃん"·"安部ちゃん"·"あやちゃん", 2026-10-01 실사용)
// 아메는 "ame"와 한 글자 차이까지 받는다. 조용할 때는 받지 않는다(흔한 이름·낱말과 겹친다).
const AME_LOOSE = new Set(['aya']);
function matchWakeReading(text, tokens, { loose = false, mid = false } = {}) {
  if (!Array.isArray(tokens) || !tokens.length) return null;
  let i = 0, acc = '';
  if (JA_LEAD.has(roma(tokens[0][0]))) i = 1; // "ねえ、" 같은 부름말은 건너뛴다
  const restOf = (k) => String(text || '').slice(tokens[k][1]).replace(/^[\s.,!?~…·、。！？]+/, '').trim();
  for (let k = i; k < Math.min(tokens.length, i + 5); k++) {
    acc += roma(tokens[k][0]);
    if (acc.length > 14) break;
    const m = JA_SUFFIX.exec(acc);
    if (!m) continue;
    const stem = acc.slice(0, m.index);
    const nearChoten = (d) => stem.length >= 5 && stem.length <= 7 && editDistance(stem, 'choten') <= d;
    // "○○さん"(2026-10-01 실사용 "商店さん"·"雨さん")은 이름이 또렷할 때만: "姉さん"·"お母さん" 같은 흔한 말과 겹친다
    const who = m[1] === 'san' ? (stem === 'ame' ? 'ame' : nearChoten(1) ? 'choten' : null)
      : (AME_STEMS.has(stem) && !((stem === 'me' || stem === 'name') && m[1] !== 'chan')) ? 'ame' // me·name 은 "…chan"일 때만("mecha"=めちゃ 는 아니다)
        : (stem === 'ten' && m[1] === 'chan') || (stem.length >= 4 && stem.length <= 8 && editDistance(stem, 'choten') <= 2) ? 'choten' // "天ちゃん"(2026-10-01 실사용)
          : (loose && m[1] === 'chan' && (AME_LOOSE.has(stem) || (stem.length >= 2 && stem.length <= 4 && editDistance(stem, 'ame') <= 1))) ? 'ame' : null;
    if (!who) continue; // 다음 낱말까지 이어 본다("mecha"+"n" = めちゃん). 이어 붙인 어간이 이름과 달라지면 어차피 안 맞는다
    const next = tokens[k + 1] ? roma(tokens[k + 1][0]) : '';
    return JA_CASE.has(next) ? { who, rest: restOf(k), particle: true } : { who, rest: restOf(k) };
  }
  // 짱이 없다: 부름말로 시작했을 때만 그 뒤 낱말(들)이 이름인지 본다("おいアメ"·"ねえ超てん、…")
  // 글 중간에서 찾을 때(mid, 노래 가사 뒤에 붙은 말)는 "おい"·"hey"만 부름말로 친다 — "ね"·"ねえ"는 가사의 문장 끝말이기도 하다("そうだね雨やんだ")
  if (i !== 1 || (mid && !['oi', 'hey', 'hei'].includes(roma(tokens[0][0])))) return null;
  acc = '';
  for (let k = 1; k < Math.min(tokens.length, 4); k++) {
    acc += roma(tokens[k][0]);
    const who = acc === 'ame' || (acc === 'yame' && roma(tokens[0][0]) === 'oi') ? 'ame' // "おいアメ"가 "おいやめ"로 적힌다(2026-10-01 실사용)
      : (acc.length >= 5 && acc.length <= 7 && editDistance(acc, 'choten') <= 1) ? 'choten' : null;
    if (!who) continue;
    const next = tokens[k + 1] ? roma(tokens[k + 1][0]) : '';
    if (next && (JA_PARTICLE.has(next) || JA_SUFFIX.test(next))) return null; // "雨が…"·"雨ちゃ…"(앞에서 못 맞춘 꼴)는 여기서 받지 않는다
    return { who, rest: restOf(k).replace(/^よ[、,\s]*/, '') };
  }
  return null;
}

// 영어 모드: 영어 받아쓰기는 이름을 영어 낱말로 적는다(시험: "Choten chan" → "Chot and Chan", "Ame chan" → "Ahmed Chan").
// 앞 네 낱말 안에 "chan" 꼴(chan·chun·chen·jan·john…)이 있고, 그 앞 낱말들을 이은 글자가 이름과 비슷하면 받는다.
// 초텐: "choten" 과 두 글자 안쪽 차이(chotand·showten…), 아메: 아래 목록이거나 "ame" 와 한 글자 차이.
const EN_LEAD = new Set(['hey', 'hi', 'ok', 'okay', 'yo', 'oh', 'um']);
const EN_SUFFIX = /^(chan|chun|chen|chang|chain|jan|john|jon|shan|tan)$/;
const AME_EN = new Set(['ame', 'amy', 'ami', 'amie', 'aimee', 'ammy', 'ama', 'amay', 'ahmay', 'ahme', 'ahmed', 'ahmad', 'amen', 'omy', 'ima', 'emma']);
// 짱 없이 "hey Choten"·"hey Ame": 부름말(hey·hi·yo·oi) 바로 뒤 낱말이 이름일 때만. 아메는 흔한 낱말과 겹치지 않는 표기만 받는다.
const EN_HEY = new Set(['hey', 'hi', 'yo', 'oi', 'ok', 'okay']);
const AME_BARE_EN = new Set(['ame', 'amy', 'ami', 'amie', 'aimee', 'ammy', 'amay', 'ahmay', 'ahme']);
function matchWakeEnglish(text) {
  const src = String(text || '');
  const words = [...src.matchAll(/[A-Za-z0-9']+/g)].map((m) => ({ w: m[0].toLowerCase().replace(/[^a-z0-9]/g, ''), end: m.index + m[0].length }));
  return matchWakeEnglishChan(src, words) || matchWakeEnglishHey(src, words);
}
function matchWakeEnglishHey(src, words) {
  if (words.length < 2 || !EN_HEY.has(words[0].w)) return null;
  const rest = (k) => src.slice(words[k].end).replace(/^[\s.,!?~…·]+/, '').trim();
  if (AME_BARE_EN.has(words[1].w)) return { who: 'ame', rest: rest(1) };
  for (const k of [1, 2]) { // "Choten"은 한 낱말("shoten")이나 두 낱말("show ten")로 적힌다
    if (!words[k]) break;
    const stem = words.slice(1, k + 1).map((x) => x.w).join('').replace(/10/g, 'ten');
    if (stem.length >= 5 && stem.length <= 8 && editDistance(stem, 'choten') <= 2) return { who: 'choten', rest: rest(k) };
  }
  return null;
}
function matchWakeEnglishChan(src, words) {
  let i = 0;
  if (words.length && EN_LEAD.has(words[0].w)) i = 1;
  let stem = '';
  for (let k = i; k < Math.min(words.length, i + 4); k++) {
    if (k > i && EN_SUFFIX.test(words[k].w)) {
      const s = stem.replace(/10/g, 'ten');
      const who = AME_EN.has(s) || (s.length >= 2 && s.length <= 4 && editDistance(s, 'ame') <= 1) ? 'ame'
        : (s.length >= 4 && s.length <= 9 && editDistance(s, 'choten') <= 2) ? 'choten' : null;
      if (!who) return null;
      return { who, rest: src.slice(words[k].end).replace(/^[\s.,!?~…·]+/, '').trim() };
    }
    stem += words[k].w;
  }
  return null;
}

// 노래 위로 부른 말은 확정 글 앞에 가사가 붙어 온다("…本を読みました。雨ちゃん今日の天気はどう"). 그때(sttd 의 noisy)만 이름을 글 중간에서도 찾는다.
// 여러 번 나오면 마지막 것을 쓴다.
function matchWakeLoose(text, tokens, opts) {
  const src = String(text || '');
  const shift = (from) => (Array.isArray(tokens) ? tokens.filter(([, end]) => end > from).map(([r, end]) => [r, end - from]) : undefined);
  let best = null;
  // 가사 속 말에 걸리지 않게 낱말이 시작하는 자리에서만, 짱 꼴과 "おい○○" 꼴만 찾는다(2026-10-01 검토: "お姉ちゃんが好き"·"そうだね雨やんだ"에 깼다)
  for (let i = 1; i < src.length; i++) { // 글자 기준: 빈칸·부호 바로 뒤에서 이름으로 시작하는지
    if (/[\s.,!?~…·、。！？]/.test(src[i]) || !/[\s.,!?~…·、。！？]/.test(src[i - 1])) continue;
    const m = matchWakeStrict(src.slice(i), shift(i));
    if (m) best = m;
  }
  if (Array.isArray(tokens)) for (let k = 1; k < tokens.length; k++) { // 발음 기준(일본어): 낱말이 시작하는 자리에서
    if (roma(tokens[k - 1][0]) === 'o') continue; // "お姉ちゃん"
    const from = tokens[k - 1][1];
    const m = matchWakeReading(src.slice(from), tokens.slice(k).map(([r, end]) => [r, end - from]), { ...opts, mid: true });
    if (m && (!best || m.rest.length <= best.rest.length)) best = m;
  }
  return best;
}

// 원문에서 이름까지(공백·부호를 뺀 글자 수 n)를 떼고 남은 말. 앞의 부호·"야/아" 같은 부름 조사도 뗀다.
function cutAfter(text, n) { // 이름이 끝나는 자리(원문 기준)
  let i = 0, seen = 0;
  const src = String(text || '');
  while (i < src.length && seen < n) { if (squash(src[i])) seen++; i++; }
  return i;
}
const restFrom = (text, cut) => String(text || '').slice(cut).replace(/^[\s.,!?~…·、。！？]+/, '').replace(/^(?:야|아)\s+/, '').trim();
// 이름을 문장의 한 부분으로 말했을 때(particle) 요청 글 앞에 다시 붙이는 바른 이름(받아쓰기는 "雨ちゃん"·"めちゃん"처럼 달리 적는다)
const CANON = { choten: { ko: '초텐짱', ja: '超てんちゃん', en: 'Choten-chan' }, ame: { ko: '아메짱', ja: 'あめちゃん', en: 'Ame-chan' } };
const canonName = (who, lang) => (CANON[who] || CANON.choten)[lang] || (CANON[who] || CANON.choten).ko;

// 이름만 불렀을 때 대답(말하고 나서 잠깐 이어서 듣는다)
const ACK = {
  choten: { ko: ['응응? 불렀어 P♡', '나 여기 있어~ 말해 봐!'], ja: ['なになに？呼んだ？P♡', 'はーい、ここにいるよ！'], en: ['Yes yes? You called, P♡', "I'm right here~ go ahead!"] },
  ame: { ko: ['…왜.', '…듣고 있어.'], ja: ['…なに。', '…聞いてる。'], en: ['…What.', "…I'm listening."] },
};
const ackLine = (who, lang, pick = (a) => a[Math.floor(Math.random() * a.length)]) => pick((ACK[who] || ACK.choten)[lang] || ACK.choten.ko);
// 음성으로 ⚡ 지시를 맡겼을 때 "받았다"는 짧은 대답(결과는 끝나면 따로 읽는다)
const TASK_ACK = {
  choten: { ko: ['알았어! 클로드한테 바로 넘길게♡', '접수~ 끝나면 알려 줄게!'], ja: ['りょーかい！クロードにお願いしとくね♡', '受付完了～終わったら教えるね！'], en: ["Got it! I'll hand it to Claude right away♡", "On it~ I'll tell you when it's done!"] },
  ame: { ko: ['…넘긴다. 끝나면 말해 줄게.', '…알았어. 기다려.'], ja: ['…渡しとく。終わったら言う。', '…わかった。待ってて。'], en: ["…Passing it on. I'll tell you when it's done.", '…Fine. Wait.'] },
};
const taskAckLine = (who, lang, pick = (a) => a[Math.floor(Math.random() * a.length)]) => pick((TASK_ACK[who] || TASK_ACK.choten)[lang] || TASK_ACK.choten.ko);
// ⚡ 지시를 다른 프로젝트의 대화 세션에 넘겼을 때(main.js startProjectTask): 어디로 넘겼는지 말해 준다 — 잘못 짚었으면 바로 "취소"할 수 있게.
// 제목은 한국어라 일본어·영어 목소리로는 못 읽으니 그때는 폴더 이름을 말한다
const DELEGATE = {
  choten: { ko: '{t}에 넘겼어! 끝나면 알려 줄게♡', ja: '{t}に頼んだよ！終わったら教えるね♡', en: "Sent it to {t}! I'll tell you when it's done♡" },
  ame: { ko: '…{t}에 넘겼다. 끝나면 말해 줄게.', ja: '…{t}に回した。終わったら言う。', en: "…Passed it to {t}. I'll tell you when it's done." },
};
function delegateLine(who, lang, { title = '', folder = '' } = {}) {
  const name = String(folder || '').split('/').filter(Boolean).pop() || '';
  let t = lang === 'ko' && title ? title : (/[가-힣]/.test(title) || !title ? name : title);
  if (t.length > 20) t = t.slice(0, 20);
  const set = (DELEGATE[who] || DELEGATE.choten);
  return (set[lang] || set.ko).replace('{t}', t || (lang === 'ja' ? 'そのプロジェクト' : lang === 'en' ? 'that project' : '그 프로젝트'));
}
// 앱의 대화창에서 오래 걸린 턴이 끝났을 때(설정 '완료 알림', main announce.js): 어느 대화가 끝났는지 한 마디.
// 제목 규칙은 delegateLine 과 같다(한국어면 제목, 일본어·영어 목소리는 한글 제목을 못 읽어 폴더 이름)
const DONE = {
  choten: { ko: 'P, {t} 끝났어♡ 확인해 봐!', ja: 'P、{t}終わったよ♡ 見てみて！', en: 'P, {t} is done♡ Go check!' },
  ame: { ko: '…{t}, 끝났어. 봐 봐.', ja: '…{t}、終わった。見て。', en: '…{t} is done. Go look.' },
};
function doneLine(who, lang, { title = '', folder = '' } = {}) {
  const name = String(folder || '').split('/').filter(Boolean).pop() || '';
  let t = lang === 'ko' && title ? title : (/[가-힣]/.test(title) || !title ? name : title);
  if (t.length > 20) t = t.slice(0, 20);
  const set = DONE[who] || DONE.choten;
  return (set[lang] || set.ko).replace('{t}', t || (lang === 'ja' ? '作業' : lang === 'en' ? 'the task' : '작업'));
}

// 잡담 캐릭터에게 넘길 때 앞에 붙이는 메모(화면에는 안 보인다). 일본어 모드면 일본어로 답하게 한다.
// 음성이면 짧게: 읽는 데 걸리는 시간이 곧 반응 속도다(두 문장 6초 → 한 문장 3초, 2026-10-01 "반응이 느리다")
function voiceNote(lang) {
  if (lang === 'ja') return '(메모: 음성 대화 중이고 일본어 모드야. 답은 반드시 자연스러운 일본어로, 소리 내어 읽기 좋게 짧은 한 문장(30자 안). 맨 앞 감정 태그는 [기쁨]처럼 한국어 태그 그대로 쓴다.)';
  if (lang === 'en') return '(메모: 음성 대화 중이고 영어 모드야. 답은 반드시 자연스러운 영어로, 소리 내어 읽기 좋게 짧은 한 문장(12단어 안). 맨 앞 감정 태그는 [기쁨]처럼 한국어 태그 그대로 쓴다.)';
  return '(메모: 음성 대화 중이야. 소리 내어 읽을 거니까 짧은 한 문장(30자 안)으로 답해.)';
}

// 노래·영상 재생 부탁("유튜브에서 ○○ 틀어 줘")은 모델을 거치지 않고 바로 튼다(판정은 intent.js playIntent, 실행은 main.js quickIntent).
// 캐릭터는 정해진 한 마디(quickAckLine)만 하고, 재생이 확인되면 조용히 끝난다.
const QUICK_ACK = {
  choten: { ko: ['알았어, 바로 틀게♡', '오케이 P, 금방 틀어 줄게♡'], ja: ['了解、すぐ流すね♡', 'オッケーP、今かけるね♡'], en: ["Okay, I'll play it right now♡", 'Sure thing P, coming right up♡'] },
  ame: { ko: ['…틀어 줄게.', '…알았다, 잠깐만.'], ja: ['…かけとく。', '…わかった、少し待て。'], en: ["…I'll put it on.", '…Fine. One moment.'] },
};
const quickAckLine = (who, lang, pick = (a) => a[Math.floor(Math.random() * a.length)]) => pick((QUICK_ACK[who] || QUICK_ACK.choten)[lang] || QUICK_ACK.choten.ko);
// 앞 일이 아직인데 또 부르면: 모델을 부르지 않고 바로 한 마디(잠자코 흘려보내면 띠링만 울리고 아무 일도 없어 보였다)
const BUSY = {
  choten: { ko: ['아직 하는 중이야, 조금만♡', '잠깐만 P, 거의 다 됐어!'], ja: ['まだやってる最中、ちょっと待って♡', 'もうちょっとだけ待ってねP！'], en: ['Still working on it, just a sec♡', 'Hold on P, almost done!'] },
  ame: { ko: ['…아직이야. 기다려.', '…하는 중. 잠깐만.'], ja: ['…まだ。待って。', '…やってる。少し待て。'], en: ['…Not yet. Wait.', '…Working. One moment.'] },
};
const busyLine = (who, lang, pick = (a) => a[Math.floor(Math.random() * a.length)]) => pick((BUSY[who] || BUSY.choten)[lang] || BUSY.choten.ko);

// 이름 없이 건 말(대화 직후 이어 듣기)을 받을지: 마이크에는 늘 잡소리·바람 소리가 들어온다(사용자 2026-10-01). 제대로 건 말만 받는다.
// - 글자가 3자 이상이거나, 확인을 기다리는 중의 짧은 대답("응"·"네"·"아니"·はい…)일 것
// - 소리가 바닥 소음보다 뚜렷이 클 것(peak/floor, sttd 가 알려 줄 때만 본다)
const SHORT_ANSWER = /^(응|어|네|예|넹|아니|아니야|그래|좋아|싫어|해|보내|취소|はい|うん|ええ|いいえ|いや|だめ|お願い|送って|yes|yeah|yep|no|nope|ok|okay|sure|send|cancel)$/i;
// called: 이름만 부르고 연 창이면 두 글자 말("안녕"·"뭐해")도 받는다 — 방금 부른 사람이 건 말이 분명하다(2026-10-06 실사용: 부르고 바로 한
//   두 글자 말이 "너무 짧음"으로 버려져, 사용자는 다시 불러야 했다)
function followWorthy(text, { peakRms, noiseFloor, aec = false, band = false, music = false, expectingAnswer = false, continuing = false, called = false } = {}) {
  const letters = (String(text || '').match(/[\p{L}\p{N}]/gu) || []).join('');
  if (!meaningful(text)) return { ok: false, why: '부호·군소리' };
  // continuing: 덜 끝난 말("유튜브에서…")의 뒷부분을 기다리는 중이면 짧아도("틀어") 받는다
  if (letters.length < (called ? 2 : 3) && !continuing && !(expectingAnswer && SHORT_ANSWER.test(letters))) return { ok: false, why: `너무 짧음(${letters.length}자)` };
  // 참조 에코 제거 중(band)에는 말로 잡힌 구간의 크기만 온다: 0 이면 말소리로 잡히지 않은 소리(남은 노래·딸깍)가 받아써진 것이다
  if (band && typeof peakRms === 'number' && !(peakRms > 0)) return { ok: false, why: '말소리로 잡히지 않음' };
  if (typeof peakRms === 'number' && peakRms > 0) {
    // 기준은 sttd 의 말소리 문턱과 맞춘다: 조용한 방(바닥 0.001)이면 0.006, 보통 방이면 0.012. 전에는 늘 0.012 라, sttd 가 말로 잡은
    // 작은 목소리(0.009)를 여기서 다시 버렸다(2026-10-01 검토).
    // band: 참조 방식 에코 제거 중이면 크기가 말소리 대역(300~3400Hz)의 것이라 전체 크기의 0.6~0.7배쯤이고, 바닥은 그 순간 예상되는
    //   주변 소리(방 소음 + 남은 노래)다. 조용한 방(바닥 0.0015)에서 작게 한 말(전체 0.011 → 대역 0.007)도 받는다 — 전체 크기 기준일 때는
    //   밤에 작게 한 대답이 "0.011 < 0.012"로 세 번 버려졌다(2026-10-02 실사용).
    // music: 노래가 나오는 중이면 남은 노래(봉우리 0.005~0.007)가 받아써진 것일 수 있으니 주변보다 4배·0.008 은 넘어야 한다
    const need = band ? Math.max(music ? 0.008 : 0.004, (music ? 4 : 3) * (noiseFloor || 0))
      : Math.max(aec ? 0.004 : Math.max(0.006, Math.min(0.012, 6 * (noiseFloor || 0))), 3 * (noiseFloor || 0));
    if (peakRms < need) return { ok: false, why: `소리가 작음(${peakRms.toFixed(3)} < ${need.toFixed(3)})` };
  }
  return { ok: true };
}
// 말이 덜 끝난 꼴(조사·연결어미로 끝남)이면 조금 더 기다린다: "유튜브에서…", "그리고…", "〜で", "〜を"
// 확실한 것만 둔다: "止めて"·"최고"·"ちょっと"·"いいの"처럼 다 끝난 말에도 흔한 꼴(て·고·と·の·는데…)을 넣었더니 7초씩 기다렸다(2026-10-01)
const UNFINISHED = /(에서|에게|한테|그리고|근데|해서|면서|를|YouTubeで|ユーチューブで|を|\b(?:on|in|at|to|the|a|an|and|for|with|of|from))$/i;
const looksUnfinished = (text) => UNFINISHED.test(String(text || '').replace(/[\s.,!?~…·、。！？]+$/u, ''));

// "지시 모드"·"대화 모드"라고 말해 입력 방식을 바꾼다(사용자 2026-10-01: "지시모드·대화모드도 내 음성을 통해 전환할 수 있어야 한다").
// 짧은 말(20자 안)에 모드 이름이 들어 있을 때만. 돌려주는 값은 'task'(⚡ 지시) | 'chat'(💬 대화) | null
const MODE_WORDS = {
  task: /지시\s*모드|작업\s*모드|명령\s*모드|指示モード|タスクモード|作業モード|仕事モード|命令モード|\b(?:task|command|work|agent)\s+mode\b/i,
  chat: /대화\s*모드|잡담\s*모드|채팅\s*모드|수다\s*모드|会話モード|雑談モード|チャットモード|トークモード|おしゃべりモード|\b(?:chat|talk|conversation)\s+mode\b/i,
};
// 묻는 말("지시 모드가 뭐야"·"会話モードって何")은 바꾸라는 말이 아니다
const ASKING = /뭐|무엇|무슨|어떤|왜|어떻게|何|なに|なんで|とは|どう|どんな|\b(?:what|why|how|which)\b/i;
function modeSwitch(text) {
  const t = String(text || '').trim();
  if (!t || t.length > (/[a-z]{3}/i.test(t) ? 36 : 20) || ASKING.test(t)) return null; // 영어는 글자 수가 많다("switch to task mode please")
  if (MODE_WORDS.task.test(t)) return 'task';
  if (MODE_WORDS.chat.test(t)) return 'chat';
  return null;
}
const MODE_LINES = {
  choten: { ko: { task: '지시 모드로 바꿨어♡', chat: '대화 모드로 바꿨어♡' }, ja: { task: '指示モードにしたよ♡', chat: '会話モードにしたよ♡' }, en: { task: 'Switched to task mode♡', chat: 'Switched to chat mode♡' } },
  ame: { ko: { task: '…지시 모드.', chat: '…대화 모드.' }, ja: { task: '…指示モード。', chat: '…会話モード。' }, en: { task: '…Task mode.', chat: '…Chat mode.' } },
};
const modeLine = (who, lang, mode) => ((MODE_LINES[who] || MODE_LINES.choten)[lang] || MODE_LINES.choten.ko)[mode] || '';
// 듣고 말하는 언어도 말로 바꾼다: "영어 모드"·"日本語モード"·"Korean mode". 지금 언어로 말해야 알아듣는다(영어 모드에선 "Korean mode").
const LANG_WORDS = {
  ko: /한국어\s*모드|한국말\s*모드|韓国語モード|コリアンモード|\bkorean\s+mode\b/i,
  ja: /일본어\s*모드|일어\s*모드|日本語モード|ジャパニーズモード|\bjapanese\s+mode\b/i,
  en: /영어\s*모드|잉글리시\s*모드|英語モード|イングリッシュモード|\benglish\s+mode\b/i, // "イングリッシュモードにお願い"(2026-10-01 실사용)
};
function langSwitch(text) {
  const t = String(text || '').trim();
  if (!t || t.length > (/[a-z]{3}/i.test(t) ? 36 : 20) || ASKING.test(t)) return null;
  for (const l of ['ko', 'ja', 'en']) if (LANG_WORDS[l].test(t)) return l;
  return null;
}
const LANG_LINES = {
  choten: { ko: '한국어 모드로 바꿨어♡', ja: '日本語モードにしたよ♡', en: 'English mode now♡' },
  ame: { ko: '…한국어로 한다.', ja: '…日本語にした。', en: '…English, then.' },
};
const langLine = (who, lang) => (LANG_LINES[who] || LANG_LINES.choten)[lang] || '';

// 노래 조작("멈춰"·"다음 곡"…)은 짧은 말이라 모델 없이 바로 알아듣는다(main.js 가 크롬 탭의 영상을 직접 조작). 긴 부탁("유튜브에서 ○○ 틀어줘")은 아니다.
// 소리 크기("소리 키워"·"louder")는 여기가 아니라 맥 음량이다(intent.js volumeIntent).
// 한 문장이 통째로 그 조작일 때만 받는다: 꾸밈말(잠깐·ちょっと) + 노래를 가리키는 말(노래·音楽·it) + 조작 말 + 끝말. 전에는 낱말이 들어 있기만
// 하면 받아서 "불 꺼 줘"·"冗談はやめて"가 노래를 멈추고, "다음 거 뭐야"가 다음 곡으로 넘기고, "もう一度言って"가 이어 틀었다(2026-10-01 검토).
const KO_ADV = '(?:(?:잠깐만|잠깐|잠시만|잠시|좀|이제|일단|당장|빨리)\\s*)*';
const KO_OBJ = '(?:(?:지금\\s*)?(?:이\\s*|그\\s*)?(?:노래|음악|곡|영상|동영상|유튜브|뮤직|재생|이거|그거)\\s*(?:를|을|은|는|좀)?\\s*)';
const KO_END = '\\s*(?:줘|줘요|주세요|줄래|줄래요|봐|라|요)?';
const KO_PLAY = '(?:틀어|재생(?:해|시켜)?|플레이(?:해)?)';
const JA_ADV = '(?:ちょっと|一旦|いったん|もう|今すぐ|すぐ|早く)*';
const JA_OBJ = '(?:(?:今の|この|その)?(?:音楽|曲|歌|動画|ユーチューブ|YouTube|ミュージック|再生|それ|これ)(?:を|は|の)?)';
const JA_END = '(?:ください|くれ|くれる|よ|ね)?';
const JA_PLAY = '(?:流して|ながして|かけて|再生して|プレイして|再生|プレイ)';
const EN_OBJ = '(?:\\s+(?:it|that|this|the\\s+(?:music|song|video|track|playback)|playing))?';
const whole = (src, flags) => new RegExp(`^(?:${src})$`, flags);
const MEDIA = {
  ko: [
    ['pause', whole(`${KO_ADV}${KO_OBJ}?${KO_ADV}(?:멈춰|멈추어|정지(?:\\s*해)?|일시\\s*정지(?:\\s*해)?|스톱(?:\\s*해)?|꺼|끊어|그만(?:\\s*(?:해|둬|틀어))?|중지(?:\\s*해)?|중단(?:\\s*해)?)${KO_END}`)],
    ['next', whole(`${KO_ADV}(?:다음(?:\\s*(?:곡|노래|영상|거|꺼))?(?:으로|로)?(?:\\s*(?:넘겨|넘어가|틀어|가|해))?|${KO_OBJ}?(?:넘겨|스킵(?:해)?|건너\\s*뛰어|패스))${KO_END}`)],
    ['prev', whole(`${KO_ADV}(?:(?:이전|앞|전)\\s*(?:곡|노래|영상|거|꺼)(?:으로|로)?(?:\\s*(?:돌아가|틀어|가|해))?|되감(?:아|기))${KO_END}`)],
    // 무엇을 틀지 없는 재생: "다시 틀어 줘"·"이어서"·"재생"·"노래 틀어 줘". 켜·들려는 딴 뜻이 많아 "다시"나 노래를 가리키는 말이 있을 때만
    ['play', whole(`${KO_ADV}(?:${KO_OBJ}?(?:(?:다시|계속|이어서)\\s*(?:${KO_PLAY}|켜|들려)?|${KO_PLAY})|${KO_OBJ}(?:켜|들려))${KO_END}`)],
  ],
  ja: [
    // "止まって"(2026-10-01 실사용: 잡담으로 넘어가 노래가 안 멈췄다). "止まらない"는 가사에 흔한 말이라 아니다
    ['pause', whole(`${JA_ADV}${JA_OBJ}?${JA_ADV}(?:止めて|とめて|止まって|とまって|止まれ|止める|停止(?:して)?|一時停止(?:して)?|中止(?:して)?|ストップ(?:して)?|ポーズ(?:して)?|やめて|消して|けして)${JA_END}`)],
    ['next', whole(`${JA_ADV}(?:次(?:の(?:曲|歌|動画|やつ)?)?(?:に|へ)?(?:して|行って|いって|進んで|お願い)?|${JA_OBJ}?(?:スキップ(?:して)?|飛ばして|とばして))${JA_END}`)],
    ['prev', whole(`${JA_ADV}(?:前の(?:曲|歌|動画|やつ)(?:に|へ)?(?:して|戻して|戻って|お願い)?|(?:一つ|ひとつ|1つ)前(?:の曲)?(?:に|へ)?(?:して|戻して|戻って)?|${JA_OBJ}?戻して)${JA_END}`)],
    ['play', whole(`${JA_ADV}(?:${JA_OBJ}?(?:(?:また|もう一度|もう一回|再び)(?:${JA_PLAY}|つけて|聴かせて|聞かせて)?|再開(?:して)?|続けて|続き(?:を)?(?:${JA_PLAY}|お願い)?|${JA_PLAY})|${JA_OBJ}(?:つけて|聴かせて|聞かせて))${JA_END}`)],
  ],
  en: [
    ['pause', whole(`(?:please\\s+)?(?:(?:stop|pause|shut\\s+up|be\\s+quiet)${EN_OBJ}|make\\s+it\\s+stop)(?:\\s+please)?`, 'i')],
    ['next', whole(`(?:please\\s+)?(?:(?:play\\s+(?:the\\s+)?)?next(?:\\s+(?:song|track|one|video))?|skip(?:\\s+(?:it|this|that|this\\s+(?:song|one|track)|the\\s+(?:song|track)))?)(?:\\s+please)?`, 'i')],
    ['prev', whole(`(?:please\\s+)?(?:(?:play\\s+(?:the\\s+)?)?(?:previous|last)(?:\\s+(?:song|track|one|video))?|go\\s+back(?:\\s+(?:one|a\\s+(?:song|track)))?)(?:\\s+please)?`, 'i')],
    ['play', whole(`(?:please\\s+)?(?:(?:resume|continue|unpause|keep\\s+playing)${EN_OBJ}|play(?:\\s+(?:again|it|that|it\\s+again|(?:the\\s+)?(?:music|song)(?:\\s+again)?))?)(?:\\s+please)?`, 'i')],
  ],
};
// 이름이 문장의 한 부분으로 붙어 왔을 때("あめちゃんの音楽止めて"·"あめちゃんが止めて")는 이름을 떼고 본다
const CALLED = /^(?:あめちゃん|超てんちゃん|아메짱|초텐짱)(?:が|は|の|も|이|가|은|는|의)?[\s、,]*/;
function mediaControl(text, lang = 'ko') {
  // 받아쓰기는 끝에 마침표를 붙인다("再生して。"·"음악 재생해줘."). 떼고 본다 — 안 뗐을 때 이어 틀기가 안 걸려 새 검색으로 갔다(2026-10-01)
  const t = String(text || '').trim().replace(/[\s.,!?~…。、！？♡]+$/u, '');
  if (!t || t.length > (lang === 'en' ? 40 : 24)) return null; // 조작은 짧다. 제목이 든 긴 부탁은 재생 부탁(intent.js playIntent)으로
  // 받아쓰기가 한 말을 문장 둘로 적기도 한다("止めて。止めて") → 문장마다 본다. 다만 이어 틀기(play)는 말 전체가 그것뿐일 때만 —
  // "さよならだけが人生だ。プレイして"의 앞 문장은 제목이다.
  const segs = t.split(/[.!?~…。！？♡]+/u).map((part) => {
    const seg = part.replace(/[、,]/g, ' ').replace(/\s+/g, ' ').trim().replace(CALLED, '');
    return lang === 'ja' ? seg.replace(/\s+/g, '') : seg;
  }).filter(Boolean);
  for (const seg of segs) for (const [kind, re] of MEDIA[lang] || MEDIA.ko) if (re.test(seg) && (kind !== 'play' || segs.length === 1)) return kind;
  return null;
}
const MEDIA_LINES = {
  choten: {
    ko: { pause: '멈췄어♡', play: '다시 틀게♡', next: '다음 곡♡', prev: '앞 곡으로♡' },
    ja: { pause: '止めたよ♡', play: 'また流すね♡', next: '次の曲♡', prev: '前の曲ね♡' },
    en: { pause: 'Paused♡', play: 'Playing again♡', next: 'Next song♡', prev: 'Going back one♡' },
  },
  ame: {
    ko: { pause: '…멈췄다.', play: '…다시 튼다.', next: '…다음.', prev: '…앞 곡.' },
    ja: { pause: '…止めた。', play: '…また流す。', next: '…次。', prev: '…前の曲。' },
    en: { pause: '…Stopped.', play: '…Playing.', next: '…Next.', prev: '…Previous.' },
  },
};
const mediaLine = (who, lang, kind) => ((MEDIA_LINES[who] || MEDIA_LINES.choten)[lang] || MEDIA_LINES.choten.ko)[kind] || '';

// 소리 내어 읽을 글: 감정 태그·크롬 표시 줄·이모지·꾸밈 기호를 뗀다. 감정 태그는 맨 앞뿐 아니라 문단마다 붙기도 한다
// ("[삐짐] …\n\n[응원] …" — 2026-10-07): 줄 머리의 짧은 [태그]와 글 속의 아는 태그를 모두 뗀다
const MARK_LINE = /^\s*\[(크롬|크롬 이어서|크롬 취소|확인 필요|실행)\]/;
const EMO_TAGS = ['기쁨', '부끄러움', '삐짐', '걱정', '질투', '졸림', '놀람', '자신만만', '슬픔', '웃음', '사랑', '생각', '인사', '응원', '짜증', '담배', '기본'];
const EMO_TAG_RE = new RegExp(`\\[(?:${EMO_TAGS.join('|')})\\]`, 'g');
function speakable(text) {
  return String(text || '')
    .split('\n').filter((l) => !MARK_LINE.test(l)).map((l) => l.replace(/^\s*\[[^\]\n]{1,6}\](?!\()\s*/, '')).join(' ')
    .replace(EMO_TAG_RE, '')
    .replace(/[♡♥❤️✨💕💖]/g, '')
    .replace(/[`*_#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 흘러오는 잡담 답(raw: 지금까지 온 글 전체)에서 at 이후로 소리 내어 읽어도 되는 끝난 부분만 떼어 준다 → { text, at }.
// 답이 다 온 뒤에 읽으면 첫 소리가 1초쯤 늦어서, 끝난 문장부터 합성을 시작한다(main chatSend). 줄 머리 "[" 가 아직
// 안 닫혔으면 감정 태그인지 [크롬] 표시 줄인지 모르니 기다리고, 표시 줄은 통째로 건너뛴다. 글자 MIN_PIECE 개가 안 되는
// 조각은 다음 문장과 합친다(한두 마디씩 끊어 읽지 않게). final 이면 남은 것을 모두 준다. text 는 speakable() 전의 글이다.
const SENTENCE_END = /[。！？]+|[.!?♡~…]+(?=\s)/g; // 일본어 문장부호는 뒤에 띄어쓰기가 없다
const MIN_PIECE = 6;
const letterCount = (s) => (speakable(s).match(/[\p{L}\p{N}]/gu) || []).length;
function takeSpoken(raw, at = 0, final = false) {
  const src = String(raw || '');
  let text = '';
  while (at < src.length) {
    const start = src.lastIndexOf('\n', at - 1) + 1; // at 이 든 줄의 시작
    let end = src.indexOf('\n', at);
    const whole = end >= 0 || final; // 이 줄이 다 왔나
    if (end < 0) end = src.length;
    const line = src.slice(start, end);
    if (!whole && /^\s*\[[^\]]*$/.test(line)) break;
    if (MARK_LINE.test(line)) { if (!whole) break; at = end + 1; continue; }
    let cut = end;
    if (!whole) { // 덜 온 줄은 마지막으로 끝난 문장까지만
      cut = -1;
      for (const m of src.slice(at, end).matchAll(SENTENCE_END)) {
        const c = at + m.index + m[0].length;
        if (letterCount(src.slice(at, c)) >= MIN_PIECE) cut = c;
      }
      if (cut < 0) break;
    }
    text += src.slice(at, cut) + '\n';
    at = whole ? end + 1 : cut;
    if (!whole) break;
  }
  return { text, at: Math.min(at, src.length) };
}

// 작업 결과(크롬·지시)를 소리로 읽을 때: 첫 문단(결과 요약)만, 마크다운을 걷어 내고 문장 단위로 max 글자까지.
// 뒤 문단의 경로·목록까지 읽으면 20초씩 걸렸다(2026-10-01 시험).
// 음성으로 맡긴 일은 결과를 그 세션에 글로도 남긴다(사용자 2026-10-03 "구두로 지시하고 이루어진 업무들도 정리해서 세션에 텍스트로 남겨두어라").
// 첫 1~2문장은 소리로 읽고(spokenSummary 는 첫 문단만, 기록 제목 앞까지만 읽는다) 빈 줄 뒤의 기록은 대화에 남겨 나중에 읽는다.
// 결과 설명은 전부 지금 언어 모드로 쓴다(사용자 2026-10-03 "영어 모드에서는 영어로 일본어 모드에서는 일본어로 한국어 모드에서는 한국어로").
// 첫 1~2문장만 한국어로 달라고 했더니 넘긴 일 셋 중 둘이 통째로 영어로 답했다(2026-10-03) → 답 전체를, 앞 대화가 영어여도 그 언어로 쓰라고 못 박는다.
// heard: 받아쓴 말 그대로(지시 에이전트가 오타를 고치거나 다른 언어로 옮겨 넘기니 원문을 기록에 남긴다).
const LANG_KO = { ko: '한국어', ja: '일본어', en: '영어' };
const RECORD_TITLE = { ko: '음성 지시 작업 기록', ja: '音声指示の作業記録', en: 'Voice task record' };
const WORK_RECORD = RECORD_TITLE.ko;
const RECORD_HEAD = /^\s{0,3}#{1,6}\s*(?:음성 지시 작업 기록|音声指示の作業記録|Voice task record)/mi;
function langRule(lang) {
  const name = LANG_KO[lang] || '한국어';
  return `마지막 답(결과 설명)은 처음부터 끝까지 전부 ${name}로 써 줘 — 제목·목록·요약 모두. 이 대화의 앞부분이나 요약, 도구 출력이 다른 언어여도 ${name}로만 써.`;
}
function voiceTaskNote(lang, { heard = '' } = {}) {
  return `이 지시는 음성으로 왔어. ${langRule(lang)} 첫 1~2문장은 소리 내어 읽기 좋은 결과 요약으로. `
    + `실제로 작업(파일을 고치거나 만들거나 명령을 실행)을 했으면 그 뒤에 빈 줄을 두고 "### ${RECORD_TITLE[lang] || WORK_RECORD}" 아래에 짧게 정리해 남겨 줘: `
    + `받은 지시${heard ? `(받아쓴 말 그대로: "${String(heard).replace(/"/g, "'")}")` : ''}, 한 일, 바꾼 파일, 확인한 것, 남은 일·사용자가 정할 것. `
    + '이 기록은 소리로 읽지 않고 이 대화에 남겨 두는 것이다.';
}
// 결과 글이 그 언어로 쓰이지 않았나(위처럼 지시를 어기고 영어로 답한 때 — main 이 말풍선·소리 전에 옮긴다).
// 코드·경로·주소를 빼고 글자 수로 본다: 한국어는 한글, 일본어는 가나·한자가 넷에 하나, 영어는 라틴 글자가 반은 넘어야 한다.
// 라틴 글자는 한 낱말에 여러 자라(파일 이름·함수 이름이 섞인 한국어 설명도 한글이 넷에 하나는 넘는다) 한국어·일본어 쪽 기준을 낮게 둔다.
function langMismatch(text, lang) {
  const t = String(text || '').replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ').replace(/[\w.~-]*\/[\w./~-]*/g, ' ');
  const count = (re) => (t.match(re) || []).length;
  const ko = count(/[가-힣]/g), kana = count(/[ぁ-ゖァ-ヺ]/g), han = count(/[一-龯]/g), latin = count(/[A-Za-z]/g);
  const total = ko + kana + han + latin;
  if (total < 20) return false; // 너무 짧으면 가리지 않는다("OK"·"YouTube 열었어")
  const mine = lang === 'ja' ? kana + han : lang === 'en' ? latin : ko;
  return mine / total < (lang === 'en' ? 0.5 : 0.25);
}
function spokenSummary(text, max = 160) {
  const flat = String(text || '').trim().split(RECORD_HEAD)[0].trim().split(/\n\s*\n/)[0]
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|[-*+]|\d+\.)\s+/gm, '')
    .replace(/\*\*|__|~~/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (flat.length <= max) return flat;
  const sentences = flat.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) || [flat];
  let out = '';
  for (const s of sentences) { if ((out + s).length > max) break; out += s; }
  return (out || flat.slice(0, max)).trim();
}

// 말하는 도중(부분 받아쓰기)에 "알아들었다"는 띠링을 울릴지: 이름이 들렸거나, 대답 직후 이어 듣는 중일 때만.
// 아무 말에나 울리지 않는다(이름을 부르지 않은 말은 소리 없이 버린다).
// 이어 듣는 중엔 받을 만한 말(3자 이상)이 되어야 울린다 — 잡소리 한두 글자에 띠링이 울리지 않게
const chimeWorthy = (partial, awake, tokens, { loose = false, lang = 'ko' } = {}) => (awake && followWorthy(partial).ok) || !!matchWake(partial, tokens)
  || !!matchWakeReading(partial, tokens, { loose }) || (lang === 'en' && !!matchWakeEnglish(partial)) // 영어 이름은 영어 모드에서만(확정 판정과 같게)
  // 짱 없이 이름만·이름으로 시작한 말(한국어). 노래 중엔 확정에서 소리 크기를 보고 정하니 여기선 울리지 않는다
  || (lang === 'ko' && !loose && !!(matchWakeName(partial) || matchWakeBare(partial)));
// 받아쓰기가 잡음을 "." 같은 부호만으로 적을 때가 있다(이어 듣는 동안 그게 잡담으로 넘어갔다). 글자·숫자가 있어야 말로 치고,
// "음"·"흠"·"えー" 같은 군소리만 있는 것도 뺀다. "응"·"네"·"はい" 같은 한 마디 대답(크롬 확인 등)은 받는다.
const FILLER = /^(?:음+|으+음*|흠+|엄+|えー*|えっと|あー+|うーん*|んー*|um+|uh+|hm+|er+|ah+|oh+)$/i;
function meaningful(text) {
  const letters = (String(text || '').match(/[\p{L}\p{N}]/gu) || []).join('');
  return letters.length >= 1 && !FILLER.test(letters);
}

// 합성된 목소리 크기 맞추기(사용자 2026-10-01 "아메와 쵸텐의 목소리 볼륨이 너무 작다. 20% 정도 더 키우면 좋겠다").
// 실측(말소리 구간 RMS): 초텐 −17.5~−18.6dBFS, 아메 긴 문장 −21.5dB, 아메의 짧은 대답("…かけとく。")은 −27dB — 말마다 10dB 까지 다르다.
// 그래서 고정 배수 대신 말마다 크기를 재서 목표(−15dBFS: 초텐 기준 +2.5dB, 귀로 듣는 크기로 20%쯤)에 맞춘다.
// pcmLevel: 16비트 PCM 조각을 20ms 틀로 나눠 말소리 틀(RMS 0.01 넘는 틀)의 에너지만 acc 에 더한다.
// normGain: 지금까지 모인 크기로 배수를 정한다. 말소리가 0.1초도 안 모였으면(첫 조각이 숨소리뿐) 그 캐릭터의 앞선 값(last)을 쓴다.
const VOICE_TARGET_RMS = 0.178, LEVEL_FRAME = 480, LEVEL_MIN = 2400;
function pcmLevel(pcm, acc) {
  const n = pcm.length >> 1;
  for (let i = 0; i + LEVEL_FRAME <= n; i += LEVEL_FRAME) {
    let sq = 0;
    for (let j = i; j < i + LEVEL_FRAME; j++) { const v = pcm.readInt16LE(j * 2) / 32768; sq += v * v; const a = v < 0 ? -v : v; if (a > acc.peak) acc.peak = a; }
    if (sq / LEVEL_FRAME > 1e-4) { acc.sq += sq; acc.n += LEVEL_FRAME; }
  }
  return acc;
}
// 합성된 소리 끝에 이미 있는 조용한 시간(ms): 뒤에서부터 조용한 틀(20ms, RMS 0.0056 아래)이 몇 개 이어지는지.
// 아메 목소리는 마지막 음절에서 바로 끝나서(0~60ms) 문장이 뚝 끊겨 들렸다(사용자 2026-10-01 "아메짱의 말이 자꾸 뒤에서 끊긴다").
// main 이 이 값을 보고 모자란 만큼 쉬는 시간을 덧붙인다(문장 사이·말끝).
function trailingQuietMs(pcm) {
  const n = pcm.length >> 1;
  let quiet = 0;
  for (let end = n; end - LEVEL_FRAME >= 0; end -= LEVEL_FRAME) {
    let sq = 0;
    for (let j = end - LEVEL_FRAME; j < end; j++) { const v = pcm.readInt16LE(j * 2) / 32768; sq += v * v; }
    if (sq / LEVEL_FRAME > 0.0056 * 0.0056) break;
    quiet += 20;
  }
  return quiet;
}
function normGain(level, last = 1.5) {
  if (!level || level.n < LEVEL_MIN) return last;
  return Math.max(0.5, Math.min(5, VOICE_TARGET_RMS / Math.sqrt(level.sq / level.n)));
}

module.exports = { voiceTaskNote, WORK_RECORD, RECORD_TITLE, langRule, langMismatch, pcmLevel, normGain, trailingQuietMs, VOICE_TARGET_RMS, roma, editDistance, AME_STEMS, AME_EN, CHOTEN_KO, CHOTEN_JA, canonName, matchWakeStrict, matchWakeHey, matchWake, matchWakeBare, matchWakeName, matchWakeTail, ackLine, taskAckLine, delegateLine, doneLine, voiceNote, speakable, takeSpoken, chimeWorthy, meaningful, spokenSummary, quickAckLine, busyLine, mediaControl, mediaLine, followWorthy, looksUnfinished, matchWakeReading, matchWakeLoose, matchWakeEnglish, modeSwitch, modeLine, langSwitch, langLine, ACK, WAKE_HINTS };
