#!/bin/bash
# 클립보드의 PNG 를 raw/<name>.png 로 저장하고 txtgame cutout 으로 cut/<name>.png (400x658 alpha) 를 만든다.
NAME="$1"; [ -n "$NAME" ] || { echo "usage: save-clip.sh <name>"; exit 2; }
DIR="$(cd "$(dirname "$0")" && pwd)"; TXTGAME="${TXTGAME_DIR:-$HOME/Desktop/txtgame}"; RAW="$DIR/raw/$NAME.png"
R=$(osascript -e 'try' -e "set f to open for access POSIX file \"$RAW\" with write permission" -e 'set eof f to 0' -e 'write (the clipboard as «class PNGf») to f' -e 'close access f' -e 'return "ok"' -e 'on error e' -e 'return "ERR " & e' -e 'end try')
[ "$R" = "ok" ] || { echo "clipboard: $R"; rm -f "$RAW"; exit 1; }
SUM=$(md5 -q "$RAW"); DUP=$(cd "$DIR/raw" && md5 -q *.png 2>/dev/null | grep -c "$SUM")
[ "$DUP" -gt 1 ] && { echo "DUPLICATE of an existing raw image — not saved"; rm -f "$RAW"; exit 1; }
# 옷 위에 찍힌 ✦ 워터마크는 원본에서 거꾸로 섞어 지운다(unmark.mjs — 배경 위의 것은 어차피 크로마키로 빠진다). 원래 것은 raw/<이름>.orig.png
node "$DIR/unmark.mjs" "$RAW" | tail -1
cd "$TXTGAME" && node tools/cutout.mjs "$RAW" --out "$DIR/cut/$NAME.png" 2>&1 | tail -1
node "$DIR/despeck.mjs" "$DIR/cut/$NAME.png"
