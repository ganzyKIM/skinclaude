#!/usr/bin/env python3
# ttsd — 음성 모드의 입. Qwen3-TTS 0.6B Base(mlx-audio, 이 맥에서 무료로 돈다)로 캐릭터 목소리를 복제해 대사를 소리로 만든다.
# 캐릭터 목소리는 한 번 설계해 둔 참조 음성(~/.skinclaude/tts/voices/<voice>.wav + .txt, gen/voice-design.py)이고,
# 같은 참조로 한국어·일본어를 모두 말해 두 언어에서 같은 목소리가 난다(사용자 결정 2026-09-30).
# 실행: ~/.skinclaude/tts/venv/bin/python ttsd.py   (main.js 가 음성 모드를 켤 때 띄운다)
# stdin JSON 줄: {"id": 1, "text": "…", "voice": "choten", "lang": "ko", "stream": true}
# stdout JSON 줄: {"type": "ready"} (목소리마다 한 번씩 예열한 뒤) / 실패 {"id": 1, "error": "…"}
#   stream: {"id": 1, "pcm": base64(16bit LE 모노), "sr": 24000} 를 약 CHUNK_S 초 조각마다 → {"id": 1, "done": true, "ms", "first_ms", "dur"}
#   아니면: {"id": 1, "path": "…/out/1.wav", "ms": 생성시간, "dur": 소리길이초}
# 스트리밍인 까닭: 문장 전체를 다 만든 뒤 넘기면 첫 소리까지 2~4초 걸렸다. 조각으로 흘리면 0.3~0.5초이고, 합성 속도가
# 실시간의 약 2배라 받는 대로 이어 틀어도 끊기지 않는다(M4, 2026-10-01 측정).
import base64
import json
import os
import sys
import time

TTS_HOME = os.path.expanduser("~/.skinclaude/tts")
os.environ.setdefault("HF_HOME", os.path.join(TTS_HOME, "hf"))
os.environ.setdefault("HF_HUB_OFFLINE", "1")  # 모델은 받아 둔 것만 쓴다
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")

import wave  # noqa: E402

import mlx.core as mx  # noqa: E402
import numpy as np  # noqa: E402
from mlx_audio.tts.models.qwen3_tts.speech_tokenizer import Qwen3TTSSpeechTokenizerDecoder  # noqa: E402
from mlx_audio.tts.utils import load_model  # noqa: E402

MODEL = os.environ.get("SKINCLAUDE_TTS_MODEL", "mlx-community/Qwen3-TTS-12Hz-0.6B-Base-8bit")
VOICES = os.environ.get("SKINCLAUDE_TTS_VOICES", os.path.join(TTS_HOME, "voices"))
OUT = os.path.join(TTS_HOME, "out")
LANG = {"ko": "korean", "ja": "japanese", "en": "english"}
CHUNK_S = 0.5  # 스트리밍 조각 길이(초). 줄이면 첫 소리가 조금 빨라지고 조각마다 비용이 붙는다(1.0초와 첫 조각 차이 약 0.2초)


def pcm16(audio):
    return (np.clip(audio, -1.0, 1.0) * 32767).astype("<i2")


def write_wav(path, audio, sr):
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm16(audio).tobytes())


def say(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


refs = {}


def ref(voice):
    if voice not in refs:
        with open(os.path.join(VOICES, f"{voice}.txt"), encoding="utf-8") as f:
            refs[voice] = (os.path.join(VOICES, f"{voice}.wav"), f.read().strip())
    return refs[voice]


# ── 스트리밍 디코더를 참조 음성으로 미리 채워 두기 ──
# 비스트리밍은 [참조 음성 코드 + 새 코드]를 함께 디코딩해서 첫머리부터 캐릭터 음색이 잡힌다. 스트리밍은 빈 디코더에서 시작해
# 첫머리 음색이 달랐다(같은 시드 비교: 첫 0.3초 파형 상관 0.25~0.31). 참조로 한 번 채운 디코더 상태를 목소리마다 저장해 두고
# 요청이 시작될 때(reset_streaming_state) 되돌리면 비스트리밍과 거의 같은 소리(상관 0.96~0.999)가 추가 시간 없이 난다.
_reset = Qwen3TTSSpeechTokenizerDecoder.reset_streaming_state
_restore = [None]  # 다음 reset 에서 되돌릴 상태
_decoder = [None]  # 실제 디코더 모듈(모델 쪽 속성은 mx.compile 래퍼라 값을 바꿀 수 없어 여기서 잡는다)


def _reset_then_restore(self):
    _reset(self)
    _decoder[0] = self
    snap, _restore[0] = _restore[0], None
    if snap is None:
        return
    cache, bufs = snap
    self._transformer_cache = self.pre_transformer.make_cache()
    for c, (k, v, off) in zip(self._transformer_cache, cache):
        c.keys, c.values, c.offset = k[..., :off, :], v[..., :off, :], off  # 잘라 둔 새 배열이라 저장본은 안 바뀐다
    for m, attrs in bufs:
        for a, val in attrs.items():
            setattr(m, a, val)


Qwen3TTSSpeechTokenizerDecoder.reset_streaming_state = _reset_then_restore
primed = {}  # voice → 참조로 채운 디코더 상태


def prime(model, voice):
    wav, txt = ref(voice)
    for _ in model.generate(text="준비됐어.", ref_audio=wav, ref_text=txt, lang_code="korean", stream=True, streaming_interval=CHUNK_S):
        pass  # 예열(첫 생성은 느리다) + 참조 코드 캐시 채우기
    codes = next((v[0] for k, v in model._icl_cache.items() if k[0] == txt), None)
    if codes is None:
        return
    dec = model.speech_tokenizer.decoder
    dec.reset_streaming_state()
    mx.eval(dec.streaming_step(codes))
    d = _decoder[0]
    cache = [(c.keys, c.values, c.offset) for c in d._transformer_cache]
    bufs = [(m, {a: getattr(m, a) for a in ("_buffer", "_overflow") if hasattr(m, a)}) for _, m in d.named_modules() if hasattr(m, "reset_state")]
    dec.reset_streaming_state()
    primed[voice] = (cache, bufs)
    _restore[0] = primed[voice]  # 채운 상태로 도는 첫 요청도 한 번은 느려서(첫 소리 1.4초) 여기서 미리 한 번 돌린다
    try:
        for _ in model.generate(text="응, 알았어.", ref_audio=wav, ref_text=txt, lang_code="korean", stream=True, streaming_interval=CHUNK_S):
            pass
    finally:
        _restore[0] = None


def speak_stream(model, req, wav, txt, lang):
    t0 = time.time()
    first, samples = None, 0
    _restore[0] = primed.get(req.get("voice", "choten"))
    try:
        for r in model.generate(text=req["text"], ref_audio=wav, ref_text=txt, lang_code=lang, stream=True, streaming_interval=CHUNK_S):
            pcm = pcm16(np.array(r.audio))
            if not pcm.size:
                continue
            if first is None:
                first = time.time() - t0
            samples += pcm.size
            say({"id": req["id"], "pcm": base64.b64encode(pcm.tobytes()).decode("ascii"), "sr": model.sample_rate})
    finally:
        _restore[0] = None
    say({"id": req["id"], "done": True, "ms": int((time.time() - t0) * 1000), "first_ms": int((first or 0) * 1000),
         "dur": round(samples / model.sample_rate, 2)})


def main():
    os.makedirs(OUT, exist_ok=True)
    model = load_model(MODEL)
    for f in sorted(os.listdir(VOICES)):
        if f.endswith(".txt"):
            try:
                prime(model, f[:-4])
            except Exception as e:  # 못 채워도 스트리밍은 된다(첫머리 음색만 조금 다르다)
                print(f"prime {f[:-4]} 실패: {e}", file=sys.stderr)
    say({"type": "ready", "sr": model.sample_rate, "model": MODEL, "primed": sorted(primed)})
    for line in sys.stdin:
        req = {}
        try:
            req = json.loads(line)
            wav, txt = ref(req.get("voice", "choten"))
            lang = LANG.get(req.get("lang"), "auto")
            if req.get("stream"):
                speak_stream(model, req, wav, txt, lang)
                continue
            t0 = time.time()
            parts = [np.array(r.audio) for r in model.generate(text=req["text"], ref_audio=wav, ref_text=txt, lang_code=lang)]
            audio = np.concatenate(parts) if parts else np.zeros(1, dtype=np.float32)
            path = os.path.join(OUT, f"{req['id']}.wav")
            write_wav(path, audio, model.sample_rate)
            say({"id": req["id"], "path": path, "ms": int((time.time() - t0) * 1000), "dur": round(len(audio) / model.sample_rate, 2)})
        except Exception as e:  # 한 줄이 실패해도 다음 요청은 받는다
            say({"id": req.get("id"), "error": str(e)[:300]})


if __name__ == "__main__":
    main()
