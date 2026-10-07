// settings.js — 설정 패널에서 오는 값의 허용 목록·범위 검사 (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../settings.js');

test('기본값을 채운다(있는 값은 그대로)', () => {
  const c = S.withDefaults({ form: 'ame', voice: { on: true, lang: 'ja', gain: 2 } });
  assert.equal(c.scale, 1);
  assert.equal(c.sounds, true);
  assert.deepEqual(c.announce, { on: true, mode: 'line', minSec: 30 });
  assert.deepEqual(c.voice, { on: true, lang: 'ja', gain: 2 });
  assert.equal(c.form, 'ame');
});

test('범위 안의 값은 받고 밖이면 null', () => {
  const base = S.withDefaults({});
  assert.equal(S.apply(base, 'scale', 1.4).scale, 1.4);
  assert.equal(S.apply(base, 'scale', 0.6).scale, 0.6);
  assert.equal(S.apply(base, 'scale', 1.5), null);
  assert.equal(S.apply(base, 'scale', 'abc'), null);
  assert.equal(S.apply(base, 'voice.gain', 3).voice.gain, 3);
  assert.equal(S.apply(base, 'voice.gain', 0.4), null);
  assert.equal(S.apply(base, 'announce.minSec', 60).announce.minSec, 60);
  assert.equal(S.apply(base, 'announce.minSec', 45), null);
  assert.equal(S.apply(base, 'announce.mode', 'summary').announce.mode, 'summary');
  assert.equal(S.apply(base, 'announce.mode', 'long'), null);
  assert.equal(S.apply(base, 'announce.on', false).announce.on, false);
  assert.equal(S.apply(base, 'sounds', false).sounds, false);
  assert.equal(S.apply(base, 'sounds', 'no'), null);
  assert.equal(S.apply(base, 'voice.lang', 'en').voice.lang, 'en');
  assert.equal(S.apply(base, 'voice.lang', 'fr'), null);
  assert.equal(S.apply(base, 'permissionMode', 'plan').permissionMode, 'plan');
  assert.equal(S.apply(base, 'costume', 'saint').costume, 'saint');
  assert.equal(S.apply(base, 'costume', '../x'), null);
  assert.equal(S.apply(base, 'chatModel', 'opus'), null); // 허용 목록 밖
});

test('원본은 건드리지 않고 다른 하위 값은 남긴다', () => {
  const base = S.withDefaults({ voice: { on: true, lang: 'ko', gain: 1, aec: 'ref' } });
  const next = S.apply(base, 'voice.gain', 2);
  assert.equal(base.voice.gain, 1);
  assert.deepEqual(next.voice, { on: true, lang: 'ko', gain: 2, aec: 'ref' });
});
