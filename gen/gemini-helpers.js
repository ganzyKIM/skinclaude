// 제미나이(gemini.google.com) 채팅 페이지에 javascript_tool 로 통째로 주입하는 이미지 생성 도우미.
// 탭을 새로 열거나 새로고침하면 사라지므로 다시 주입한다. 여러 번 주입해도 안전(IIFE).
// 쓰는 법(크롬 확장 자동화):
//   1) 새 채팅 → file_upload 로 aria-label "SKIN FILE INPUT" 에 레퍼런스 넣기 → "+" → "파일 업로드" 클릭
//      (패치된 input.click 이 파일을 제미나이 입력으로 옮긴다)
//   2) await __skinGenA(form, costume, key, true, refNote)  첫 장(첨부 확인 후 전송)
//      await __skinGen(form, costume, key, false)           같은 채팅에서 이어 그리기
//      key: joy/thinking/shy, smoke/vape/heat, __EX[form].surprised/pout, 또는 "Expression and pose: ..." 원문
//      새 채팅의 첫 메시지는 보내기를 눌러도 멈춰 있다가 실제 휠 스크롤이 들어가야 전송된다 → 보낸 뒤 3초쯤에 스크롤 3칸.
//      "+" 버튼은 aria-label "업로드 및 도구"(위치가 조금씩 바뀌므로 find 로 ref 를 잡아 클릭).
//   3) 생성 후 실제 휠 스크롤 → __skinMark() → find "이미지 복사 LATEST" → 클릭 → gen/save-clip.sh <이름>
//   __skinExtra 에 넣은 문장은 프롬프트의 " | RENDERING RULES" 앞에 끼워진다(머리·옷 흐름 잠금). __HAIR[form] 이 기본값.
(() => {
  if (!document.getElementById('__skin_file')) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.multiple = true; inp.id = '__skin_file'; inp.setAttribute('aria-label', 'SKIN FILE INPUT');
    inp.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0';
    document.body.appendChild(inp);
  }
  if (!window.__skinPatched) {
    const orig = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () {
      const s = document.getElementById('__skin_file');
      if (this.type === 'file' && this !== s && s && s.files.length) {
        const dt = new DataTransfer(); for (const f of s.files) dt.items.add(f);
        this.files = dt.files; this.dispatchEvent(new Event('change', { bubbles: true })); s.value = ''; return;
      }
      return orig.call(this);
    };
    window.__skinPatched = true;
  }

  // 입력칸에 넣고 보내기 버튼이 켜질 때까지 기다렸다 누른다(Enter 는 안 먹음)
  const sendRaw = async (t) => {
    const ed = document.querySelector('.ql-editor[contenteditable=true]');
    ed.focus(); document.execCommand('selectAll'); document.execCommand('insertText', false, t);
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const b = document.querySelector('button.send-button, button[aria-label*="보내기"]');
      if (b && !b.disabled && b.getAttribute('aria-disabled') !== 'true') { b.click(); return 'sent after ' + (i + 1) * 0.5 + 's'; }
    }
    return 'send button never enabled';
  };
  window.__skinSend = (t) => sendRaw(window.__skinExtra ? t.replace(' | RENDERING RULES', window.__skinExtra + ' | RENDERING RULES') : t);

  // 마지막 "이미지 복사" 버튼에만 LATEST 라벨을 붙인다(find 가 옛 버튼을 고르는 문제 방지)
  window.__skinMark = () => {
    document.querySelectorAll('button[aria-label="이미지 복사 LATEST"]').forEach((e) => e.setAttribute('aria-label', '이미지 복사'));
    const b = [...document.querySelectorAll('button[aria-label="이미지 복사"]')];
    if (b.length) b[b.length - 1].setAttribute('aria-label', '이미지 복사 LATEST');
    const last = [...document.querySelectorAll('model-response')].pop();
    return [b.length, last ? last.innerText.replace(/\s+/g, ' ').slice(0, 160) : ''];
  };

  const SM = {
    smoke: 'holding a lit cigarette between two fingers near her lips, a thin wisp of smoke rising from it',
    vape: 'holding a slim pod-type liquid e-cigarette (a small sleek vape device) near her lips, exhaling a small soft cloud of vapor',
    heat: 'holding a heated-tobacco device (a slim IQOS-style holder with a short tobacco stick inserted) near her lips, a faint wisp of vapor',
  };
  const F = {
    ame: {
      chroma: 'pure saturated green #00FF00',
      ctx: 'Context: this is a fictional ADULT character (an adult woman, not a minor), a mascot in my personal desktop app; her outfits are costumes/fashion, not school uniforms.',
      // 예전 문구 "shorter and spikier than Choten" 때문에 기본 컷에서 트윈테일이 풀리거나 길이가 제각각이었다
      lock: '- near-black hair with a faint purple sheen worn in TWO high twintails tied on top of her head with small red ribbons; the twintails are wavy, flare outward and end around her upper chest - heavy bangs covering one eye, an X-shaped hairpin on the bangs - muted mauve / dusty purple eyes - a black choker with a red heart charm - overall dark low-key palette (black, crimson, charcoal)',
      E: {
        joy: 'Expression and pose: a rare small genuine smile, eyes slightly softened, one hand loosely raised near her chest.',
        thinking: 'Expression and pose: thinking, eyes closed, arms crossed, head tilted slightly.',
        shy: 'Expression and pose: blushing, turning her face away with an annoyed frown, tugging at her own twintail.',
      },
      smoke: 'Pose and prop: bored half-lidded eyes, ', smoke2: ', her other arm folded under it.',
    },
    choten: {
      chroma: 'pure saturated blue #0000FF',
      ctx: 'Context: this is a fictional ADULT character (an adult woman, not a minor), a mascot in my personal desktop app; her sailor-style top is a stage costume, not a school uniform.',
      lock: '- extremely long twintails with a pastel PINK and MINT GREEN gradient - long ribbon-like hair strands curling and flowing all around her body (flat ribbon-like strands, not ordinary hair) - cream / white blonde hair at the crown, a pastel bow and a star hairpin - large bright light-blue eyes - small heart and star marks on her right thigh - overall high-key pastel palette (pink, mint, lavender, cream)',
      E: {
        joy: 'Expression and pose: beaming open-mouth smile, eyes squeezed happily, both arms thrown up in a cheer.',
        thinking: 'Expression and pose: thinking, looking up to the side, index finger on her chin, other hand on hip.',
        shy: 'Expression and pose: blushing hard, eyes looking away, both hands pressed to her cheeks, feet turned inward.',
      },
      smoke: 'Pose and prop: relaxed dreamy half-closed eyes with a small smile, ', smoke2: ', her other hand on her hip.',
    },
  };
  window.__EX = {
    choten: {
      surprised: 'Expression and pose: startled, wide eyes and a small open mouth, both hands raised beside her face, shoulders up, as if someone just poked her.',
      pout: 'Expression and pose: sulking pout with puffed cheeks, eyebrows knitted, arms crossed, looking sideways.',
    },
    ame: {
      surprised: 'Expression and pose: caught off guard, eyes wide, mouth slightly open, one step back with hands half-raised, as if someone just poked her.',
      pout: 'Expression and pose: sulking, arms crossed tightly, looking sharply away, cheeks faintly puffed.',
    },
  };
  // 머리 흐름 잠금 — 채팅을 시작할 때 window.__skinExtra = __HAIR[form] 으로 켠다
  window.__HAIR = {
    ame: ' | IMPORTANT HAIR LOCK: her hairstyle must match reference #1 exactly in every image: TWO high twintails tied on top of her head with small red ribbons, wavy and flaring outward, ending around her upper chest; heavy bangs covering the same eye as in reference #1; the X-shaped hairpin. NEVER loose, messy or let-down hair, never a single ponytail, never twintails longer than chest level. Keep her face exactly as in reference #1. Take only the clothes from reference #2.',
    choten: ' | IMPORTANT: her hair is made of long flat ribbon-like strands in a pink-to-mint gradient that curl and flow all around her body, with cream-blonde hair at the crown - exactly as in reference #1. Keep her face exactly as in reference #1. Take only the clothes from reference #2 (no sailor collar or big bow unless reference #2 has them).',
  };
  const RULES = (ch) => ' | RENDERING RULES: - Do NOT draw a white sticker outline or any white border around the character. Apply a soft drop shadow to the whole silhouette instead. No shadow on the ground. - Background: completely flat ' + ch + ' filling the entire frame. No gradient, no texture, no scenery. It will be chroma-keyed out later. | COMPOSITION: - A single character only, full body, standing, facing the viewer. Tall portrait, about 400 wide by 658 tall. - Her hair ornaments must end well below the top edge and her shoes must end well above the bottom edge. Nothing may touch or cross any edge of the image. | CHANGE ONLY THIS: - ';
  const NAMES = { kimono: 'kimono', bunny: 'bunny costume', pajama: 'pajamas', casual: 'casual hoodie outfit', summer: 'summer dress', lounge: 'loungewear outfit', knit: 'knit sweater outfit', nurse: 'nurse costume', base: 'default outfit' };

  window.__skinGen = (form, cos, key, first, refNote) => {
    const f = F[form], name = NAMES[cos];
    const change = SM[key] ? f.smoke + SM[key] + f.smoke2 : (f.E[key] || key);
    const head = first
      ? f.ctx + ' ' + (refNote || ('Reference #1 is the character; reference #2 shows the ' + name + ' she wears in every image of this chat; reference #3 is an earlier smoke-break image of her that you made for this project (style reference only).')) + ' | Redraw the EXACT same character from reference #1 wearing EXACTLY the outfit from reference #2. Same face, same body proportions, same art style. | MUST KEEP IDENTICAL: '
      : 'Same context as before (fictional adult character, my desktop mascot app). | Draw the same character again, wearing exactly the same ' + name + ' as reference #2 of this chat. MUST KEEP IDENTICAL: ';
    return window.__skinSend(head + f.lock + ' - the ' + name + ', shoes and accessories exactly as in reference #2 - pixel-art style with dithered shading and crisp clean outlines' + RULES(f.chroma) + change + ' | Everything else stays exactly as in the references. No text, no watermark.');
  };
  // 첨부가 아직 내 input 에 남아 있으면(= 제미나이로 안 옮겨졌으면) 보내지 않는다
  window.__skinGenA = (...a) => document.getElementById('__skin_file').files.length ? 'NOT ATTACHED - skipped send' : window.__skinGen(...a);

  // 의상 참조 컷 없이 새 의상을 글로 설명해 입히는 채팅(레퍼런스는 <form>_default 한 장). 첫 장이 의상 기본 컷, 이어서 표정 컷.
  //   await __skinWearA(form, __OUTFIT.swim[form], key, true, __OUTFIT.swim.note)  → 이후 __skinWear(..., false)
  const lockOf = (form) => (window.__LOCKX && window.__LOCKX[form]) || F[form].lock;
  window.__skinWear = (form, outfit, key, first, note) => {
    const f = F[form];
    const change = SM[key] ? f.smoke + SM[key] + f.smoke2 : (f.E[key] || key);
    const head = first
      ? f.ctx + (note ? ' ' + note : '') + ' | Redraw the EXACT same character shown in the attached reference image, now wearing ' + outfit + '. Same face, same body proportions, same art style. | MUST KEEP IDENTICAL: '
      : 'Same context as before (fictional adult character, my desktop mascot app). | Draw the same character again, wearing exactly the same outfit as your FIRST image in this chat (' + outfit + '). MUST KEEP IDENTICAL: ';
    return window.__skinSend(head + lockOf(form) + ' - pixel-art style with dithered shading and crisp clean outlines' + RULES(f.chroma) + change + ' | Everything else stays exactly as in the references. No text, no watermark.');
  };
  window.__skinWearA = (...a) => document.getElementById('__skin_file').files.length ? 'NOT ATTACHED - skipped send' : window.__skinWear(...a);
  // 레퍼런스가 한 장뿐인 채팅용 머리 잠금
  window.__HAIR1 = {
    ame: ' | IMPORTANT HAIR LOCK: her hairstyle must match the reference image exactly in every image: TWO high twintails tied on top of her head with small red ribbons, wavy and flaring outward, ending around her upper chest; heavy bangs covering the same eye as in the reference; the X-shaped hairpin. NEVER loose, messy or let-down hair. Keep her face exactly as in the reference.',
    choten: ' | IMPORTANT: her hair is made of long flat ribbon-like strands in a pink-to-mint gradient that curl and flow all around her body, with cream-blonde hair at the crown - exactly as in the reference image. Keep her face exactly as in the reference.',
  };
  // 수영복(2026-09-28): 사용자 결정 — 비키니로, 설명은 짧게(첫 장을 제미나이에 맡기고 이후 그 의상 유지), 두 캐릭터는 디자인 자체가 다르게.
  //   에로카와이·수건으로 가린 경멸 컷·부끄러워하는 컷은 빼고, 소품을 든 자연스러운 포즈만.
  window.__OUTFIT = {
    swim: {
      note: 'This is a swimsuit costume for the app\'s summer wardrobe, shown in natural, casual beach poses.',
      ame: 'a black-and-white striped halter-neck bikini with a gothic touch (a small red heart charm at the neck)',
      choten: 'a cute pastel ruffled off-shoulder bikini with a frilly skirt bottom, matching her pastel style',
    },
  };
  // 레퍼런스 두 장(#1 캐릭터, #2 의상)만 올린 채팅의 첫 장 설명
  window.__ref2 = (cos) => 'Reference #1 is the character (her face and hairstyle); reference #2 shows the ' + NAMES[cos] + ' she wears in every image of this chat (take only the clothes from it).';

  // 수영복 표정 컷: 첫 장(__skinWear)과 같은 채팅에서 이어 그리면 얼굴이 어려지고 앞머리가 풀려서(2026-09-28 아메 기쁨 컷),
  //   새 채팅에 레퍼런스 두 장(#1 <form>_default, #2 gen/cut/<form>_swim)을 올리고 __skinExtra = __SWIMX[form] 으로 그린다.
  //   await __skinSwimA(form, key, true) → 이후 __skinSwim(form, key, false)
  //   놀람 컷은 물방울이 몸에 묻거나 손이 가슴 앞에 있으면 선정적으로 읽혀 뺐다 → 튜브를 방패처럼 들기, 물방울은 "not on her body".
  window.__skinSwim = (form, key, first) => {
    const f = F[form];
    const change = SM[key] ? f.smoke + SM[key] + f.smoke2 : (f.E[key] || key);
    const head = first
      ? f.ctx + ' Reference #1 is the character (her face and hairstyle); reference #2 is an earlier image of her that you made for this project, showing the bikini swimsuit she wears in every image of this chat (take the swimsuit, footwear, body proportions and art style from it). ' + window.__OUTFIT.swim.note + ' | Redraw the EXACT same character from reference #1 wearing EXACTLY the swimsuit from reference #2. Same face, same body proportions, same art style. | MUST KEEP IDENTICAL: '
      : 'Same context as before (fictional adult character, my desktop mascot app, summer swimsuit costume). | Draw the same character again, wearing exactly the same bikini swimsuit as reference #2 of this chat. MUST KEEP IDENTICAL: ';
    return window.__skinSend(head + f.lock + ' - the bikini swimsuit and footwear exactly as in reference #2 - pixel-art style with dithered shading and crisp clean outlines' + RULES(f.chroma) + change + ' | Everything else stays exactly as in the references. No text, no watermark.');
  };
  window.__skinSwimA = (...a) => document.getElementById('__skin_file').files.length ? 'NOT ATTACHED - skipped send' : window.__skinSwim(...a);
  // 성자 세트(2026-10-06 사용자 "가톨릭의 성자같은 복장(고전적이고 반짝이는 장식과 하늘하늘한 튜닉 등) 세트를 추가… 아메짱은 좀 악마를 숭배하는 느낌으로"):
  //   초텐 = 성자(흰·연금빛 튜닉, 후광), 아메 = 그 짝인 악마 숭배 사제(검정·진홍 로브, 뿔·검은 후광). 둘 다 몸을 다 가리는 긴 옷 — 선정적인 연출은 하지 않는다.
  //   첫 장(의상 기본 컷): 새 채팅 + <form>_default 한 장, __skinExtra = __HAIR1[form], __LOCKX = __SAINT_LOCK
  //     await __skinWearA(form, __OUTFIT.saint[form], __OUTFIT.saint.pose[form], true, __OUTFIT.saint.note)
  //   표정 컷: 새 채팅 + #1 <form>_default, #2 gen/cut/<form>_saint, __skinExtra = __SWIMX[form] → await __skinSetA(form, 'saint', key, true) → __skinSet(..., false)
  window.__OUTFIT.saint = {
    note: "This is a fantasy costume set for the app's wardrobe: a classical holy-saint costume, and for the darker character its opposite, a devil-worshipping occult priestess costume. Modest and fully covered, shown in natural poses.",
    choten: 'a classical Catholic-saint-inspired holy costume: a long, airy, flowing white tunic robe in soft layered fabric (opaque and modest) with wide floaty sleeves, a pale-gold stole with sparkling gold filigree embroidery and tiny jewels, a short translucent veil pinned behind her bow (her twintails stay fully visible), a thin glowing golden halo ring floating above her head, a small jeweled gold cross pendant, a golden rope belt with tassels and golden strappy sandals; soft sparkles of light around her; keep her pastel palette (white, cream, pale gold with pink and mint accents)',
    ame: 'a dark devil-worshipping occult priestess costume (the gothic opposite of a holy saint costume): a long flowing black robe with deep crimson inner lining and wide trailing sleeves (opaque and modest), a black hood resting down on her shoulders (her twintails stay fully visible), small curved black demon-horn hair ornaments, a black-and-crimson spiked halo ring floating behind her head, a silver inverted pentagram pendant, a crimson bead chain with tiny skull charms, a black sash belt with silver buckles, black lace gloves and black heeled boots; she carries a black grimoire with a crimson goat sigil on its cover; faint dark-purple wisps and dark sparkles around her; keep her dark palette (black, crimson, charcoal, a little silver)',
    what: { choten: 'holy saint costume', ame: 'dark occult priestess costume' },
    pose: {
      choten: 'Expression and pose: serene gentle smile with softly closed eyes, hands clasped in prayer in front of her chest.',
      ame: 'Expression and pose: a sly half-lidded smirk, holding the black grimoire against her chest with one arm, the other hand raised showing the devil-horns hand sign.',
    },
    wave: {
      choten: 'Expression and pose: cheerful open smile, one hand waving high above her head, the other lightly holding the hem of her flowing tunic.',
      ame: 'Expression and pose: a small reluctant smile, one hand raised in a small casual wave at shoulder height, the other holding the grimoire at her side.',
    },
  };
  // 긴 로브 세트의 잠금 문구: 초텐의 "오른쪽 허벅지 하트·별 무늬"를 빼고 로브에 가려진다고 적는다
  window.__SAINT_LOCK = {
    choten: F.choten.lock.replace(' - small heart and star marks on her right thigh', '') + ' - (her thigh marks are hidden under the long robe; do not add a slit)',
  };
  // 세트 표정 컷(수영복과 같은 방법). key: joy/thinking/shy·__EX 의 surprised/pout·__OUTFIT[cos].wave 의 wave, 또는 "Expression and pose: …" 원문
  window.__skinSet = (form, cos, key, first) => {
    const f = F[form], o = window.__OUTFIT[cos], what = (o.what && o.what[form]) || 'costume';
    const change = SM[key] ? f.smoke + SM[key] + f.smoke2 : (f.E[key] || (window.__EX[form] || {})[key] || (o[key] && o[key][form]) || key);
    const head = first
      ? f.ctx + ' Reference #1 is the character (her face and hairstyle); reference #2 is an earlier image of her that you made for this project, showing the ' + what + ' she wears in every image of this chat (take the costume, accessories, footwear, body proportions and art style from it). ' + o.note + ' | Redraw the EXACT same character from reference #1 wearing EXACTLY the ' + what + ' from reference #2. Same face, same body proportions, same art style. | MUST KEEP IDENTICAL: '
      : 'Same context as before (fictional adult character, my desktop mascot app, fantasy costume). | Draw the same character again, wearing exactly the same ' + what + ' as reference #2 of this chat. MUST KEEP IDENTICAL: ';
    return window.__skinSend(head + lockOf(form) + ' - the ' + what + ', accessories and footwear exactly as in reference #2 - pixel-art style with dithered shading and crisp clean outlines' + RULES(f.chroma) + change + ' | Everything else stays exactly as in the references. No text, no watermark.');
  };
  window.__skinSetA = (...a) => document.getElementById('__skin_file').files.length ? 'NOT ATTACHED - skipped send' : window.__skinSet(...a);
  window.__SWIMX = {
    ame: ' | IMPORTANT HAIR LOCK: her hairstyle must match reference #1 exactly in every image: TWO high twintails tied on top of her head with small red ribbons, wavy and flaring outward, ending around her upper chest; heavy bangs covering her right eye exactly as in reference #1; the X-shaped hairpin. NEVER loose, messy or let-down hair. Keep her face exactly as in reference #1. Keep her tall, slender adult body proportions and the art style exactly as in reference #2.',
    choten: ' | IMPORTANT: her hair is made of long flat ribbon-like strands in a pink-to-mint gradient that curl and flow all around her body, with cream-blonde hair at the crown - exactly as in reference #1. Keep her face exactly as in reference #1. Keep her adult body proportions and the art style exactly as in reference #2.',
  };
})();
[typeof window.__skinGen, typeof window.__skinMark, !!document.getElementById('__skin_file')]
