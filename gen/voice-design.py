#!/usr/bin/env python3
# 캐릭터 목소리 설계(한 번만 돌린다). Qwen3-TTS VoiceDesign 1.7B 가 설명문으로 목소리를 만들고, 그 참조 음성을
# 0.6B Base 로 복제해 한국어·일본어 견본을 만든다. 사용자가 견본을 듣고 고른 후보를 ~/.skinclaude/tts/voices/<form>.wav/.txt 로 쓴다.
#   ~/.skinclaude/tts/venv/bin/python gen/voice-design.py [후보 수=2]
#   → ~/.skinclaude/tts/candidates/<form>_<n>.wav/.txt(참조), ~/.skinclaude/tts/samples/<form>_<n>_ko.wav, _ja.wav(견본)
# 실존 성우를 흉내 내지 않고 설명문으로만 만든다. 아이 같은 톤을 막으려고 "20대 초반 성인 여성"을 명시한다.
import gc
import os
import sys
import time
import wave

TTS = os.path.expanduser("~/.skinclaude/tts")
os.environ.setdefault("HF_HOME", os.path.join(TTS, "hf"))
os.environ.setdefault("HF_HUB_OFFLINE", "1")

import mlx.core as mx  # noqa: E402
import numpy as np  # noqa: E402
from mlx_audio.tts.utils import load_model  # noqa: E402

DESIGN_MODEL = os.path.join(TTS, "models", "Qwen3-TTS-12Hz-1.7B-VoiceDesign-8bit")
CLONE_MODEL = "mlx-community/Qwen3-TTS-12Hz-0.6B-Base-8bit"
CAND, SAMPLES = os.path.join(TTS, "candidates"), os.path.join(TTS, "samples")

VOICES = {
    "choten": {
        "instruct": "A bright, bubbly young adult woman in her early twenties with a high, sweet and cute voice. "
                    "She speaks energetically with lively, playful intonation like a popular idol streamer, full of affection.",
        "ref": "P, 왔구나! 오늘도 초텐쨩이 옆에서 제일 크게 응원할게. 힘든 일 있으면 바로 불러 줘, 알았지?",
        "ko": "P! 오늘도 완전 수고했어. 초텐쨩이 칭찬 많이 해 줄게!",
        "ja": "P、今日も本当にお疲れさま！超てんちゃんがいっぱい褒めてあげるね！",
    },
    "ame": {
        "instruct": "A young adult woman in her early twenties with a soft, low and slightly husky voice. "
                    "She speaks quietly and a little slowly in a drowsy, deadpan, calm tone, cool on the surface but gentle underneath.",
        "ref": "왔어? 딱히 기다린 건 아니야. 그냥, 오늘은 좀 일찍 쉬었으면 해서. 착각하지 마.",
        "ko": "늦었네. 밥은 먹었어? 딱히 걱정한 건 아니고.",
        "ja": "遅かったね。ご飯は食べた？別に心配してたわけじゃないけど。",
    },
}


def write_wav(path, audio, sr):
    pcm = (np.clip(np.array(audio), -1.0, 1.0) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def join(results):
    return np.concatenate([np.array(r.audio) for r in results])


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 2
    os.makedirs(CAND, exist_ok=True)
    os.makedirs(SAMPLES, exist_ok=True)

    t = time.time()
    model = load_model(DESIGN_MODEL)
    print(f"설계 모델 준비 {time.time() - t:.1f}초", flush=True)
    for form, v in VOICES.items():
        for i in range(1, n + 1):
            mx.random.seed(1000 + i)
            t = time.time()
            audio = join(model.generate_voice_design(text=v["ref"], instruct=v["instruct"], language="korean"))
            path = os.path.join(CAND, f"{form}_{i}")
            write_wav(path + ".wav", audio, model.sample_rate)
            with open(path + ".txt", "w", encoding="utf-8") as f:
                f.write(v["ref"])
            print(f"참조 {form}_{i}: {len(audio) / model.sample_rate:.1f}초 소리, {time.time() - t:.1f}초 걸림", flush=True)
    del model
    gc.collect()
    mx.clear_cache()

    model = load_model(CLONE_MODEL)
    for form, v in VOICES.items():
        for i in range(1, n + 1):
            ref = os.path.join(CAND, f"{form}_{i}")
            for lang, code in (("ko", "korean"), ("ja", "japanese")):
                t = time.time()
                audio = join(model.generate(text=v[lang], ref_audio=ref + ".wav", ref_text=v["ref"], lang_code=code))
                write_wav(os.path.join(SAMPLES, f"{form}_{i}_{lang}.wav"), audio, model.sample_rate)
                print(f"견본 {form}_{i}_{lang}: {len(audio) / model.sample_rate:.1f}초 소리, {time.time() - t:.1f}초 걸림", flush=True)


if __name__ == "__main__":
    main()
