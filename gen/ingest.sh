#!/bin/bash
# 생성 원본 PNG(크로마 배경) 를 오버레이 표정 이미지로 넣는다.
#   gen/ingest.sh <원본.png> <form>_<key>        예) gen/ingest.sh ~/Downloads/Gemini_Generated_Image_x.png choten_pout
#   <key> 는 renderer/mascot.js 의 EMO_FILES 후보 이름(joy shy pout worried jealous sleepy surprised smug sad laugh love thinking 등)
#   의상 컷은 <form>_<costume>_<key> (예: ame_kimono_sleepy). 처리 후 자동으로 install 까지 한다.
set -e
SRC="$1"; NAME="$2"; [ -f "$SRC" ] && [ -n "$NAME" ] || { echo "usage: ingest.sh <png> <form>_<key>"; exit 2; }
DIR="$(cd "$(dirname "$0")/.." && pwd)"; TXTGAME="${TXTGAME_DIR:-$HOME/Desktop/txtgame}"; mkdir -p "$DIR/gen/raw" "$DIR/gen/cut"
cp "$SRC" "$DIR/gen/raw/$NAME.png"
cd "$TXTGAME" && node tools/cutout.mjs "$DIR/gen/raw/$NAME.png" --out "$DIR/gen/cut/$NAME.png" | tail -1
node "$DIR/gen/despeck.mjs" "$DIR/gen/cut/$NAME.png"
cp "$DIR/gen/cut/$NAME.png" "$DIR/overlay/assets/char/$NAME.png"
"$DIR/bin/overlay-ctl.sh" install >/dev/null && echo "installed → 오버레이를 껐다 켜면 반영 (오버레이 끄기/켜기 바로가기)"
